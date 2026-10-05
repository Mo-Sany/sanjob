import { isMostlyEmpty } from '../extract/detail';
import { repo } from '../db/db';
import { presetForUrl } from '../presets/presets';
import { loadSettings, randomDelayMs } from '../shared/settings';
import type { DetailResult, GenericConfig, RunState, WindowMode } from '../shared/types';
import {
  broadcast,
  closeWindow,
  createWorkerWindow,
  currentTabUrl,
  navigate,
  runInTab,
  setWindowMode,
  sleep,
  tabExists,
  waitForTabComplete,
} from './browser';

export const KEEPALIVE_ALARM = 'sanjob-keepalive';
/** Consecutive near-empty detail pages before suggesting the "small window" mode. */
const EMPTY_STREAK_HINT = 3;

let looping = false;
/** Set when the next listing step must read the current page instead of navigating (after a click). */
let skipNavigate = false;

function newRunId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function publish(state: RunState | null): Promise<void> {
  broadcast({ type: 'state', state });
}

/**
 * Merges `patch` into the stored run state – but only while the run is still the same run.
 * Status changes made by the user (pause/cancel) win over a step that was in flight.
 */
async function patchRun(runId: string, patch: Partial<RunState>): Promise<RunState | null> {
  const cur = await repo.getRun();
  if (!cur || cur.runId !== runId) return null;
  const nextStatus = patch.status && cur.status === 'running' ? patch.status : cur.status;
  const next: RunState = { ...cur, ...patch, status: nextStatus, updatedAt: Date.now() };
  await repo.setRun(next);
  await publish(next);
  return next;
}

async function keepAlive(on: boolean): Promise<void> {
  if (on) await chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: 0.5 });
  else await chrome.alarms.clear(KEEPALIVE_ALARM);
}

/** Ensures the collection window/tab exists; reopens it after a browser restart. */
async function ensureTab(state: RunState): Promise<{ tabId: number; windowId: number | null }> {
  if (state.tabId !== null && (await tabExists(state.tabId))) {
    return { tabId: state.tabId, windowId: state.windowId };
  }
  const settings = await loadSettings();
  const created = await createWorkerWindow('about:blank', settings.windowMode);
  await patchRun(state.runId, created);
  return created;
}

export async function startRun(
  url: string,
  maxPages: number,
  generic?: GenericConfig,
): Promise<RunState> {
  const existing = await repo.getRun();
  if (existing && ['running', 'paused', 'blocked'].includes(existing.status)) {
    throw new Error('A collection is already in progress. Cancel it first.');
  }
  if (existing) await repo.clearQueue(existing.runId);
  const preset = presetForUrl(url);
  const settings = await loadSettings();
  const { windowId, tabId } = await createWorkerWindow('about:blank', settings.windowMode);
  const state: RunState = {
    runId: newRunId(),
    status: 'running',
    phase: 'listing',
    site: preset?.id ?? 'generic',
    startUrl: url,
    pageUrl: url,
    pagesDone: 0,
    maxPages,
    total: 0,
    done: 0,
    errors: 0,
    skipped: 0,
    current: url,
    windowId,
    tabId,
    block: null,
    lastError: '',
    emptyStreak: 0,
    suggestWindowMode: false,
    startedAt: Date.now(),
    updatedAt: Date.now(),
  };
  if (generic) state.generic = generic;
  skipNavigate = false;
  await repo.setRun(state);
  await repo.setLastRunId(state.runId);
  await publish(state);
  await keepAlive(true);
  void loop();
  return state;
}

export async function pauseRun(): Promise<void> {
  const cur = await repo.getRun();
  if (!cur || cur.status !== 'running') return;
  const next = { ...cur, status: 'paused' as const, updatedAt: Date.now() };
  await repo.setRun(next);
  await publish(next);
  await keepAlive(false);
}

export async function resumeRun(): Promise<void> {
  const cur = await repo.getRun();
  if (!cur || !['paused', 'blocked', 'interrupted', 'error'].includes(cur.status)) return;
  const settings = await loadSettings();
  if (cur.status === 'blocked') await setWindowMode(cur.windowId, settings.windowMode);
  const next: RunState = {
    ...cur,
    status: 'running',
    block: null,
    lastError: '',
    updatedAt: Date.now(),
  };
  await repo.setRun(next);
  await publish(next);
  await keepAlive(true);
  void loop();
}

export async function cancelRun(): Promise<void> {
  const cur = await repo.getRun();
  if (!cur) return;
  await repo.setRun(null);
  await repo.clearQueue(cur.runId);
  await keepAlive(false);
  await closeWindow(cur.windowId);
  await publish(null);
}

export async function applyWindowMode(mode: WindowMode): Promise<void> {
  const cur = await repo.getRun();
  if (cur && cur.status !== 'blocked') await setWindowMode(cur.windowId, mode);
  if (cur) await patchRun(cur.runId, { suggestWindowMode: false, emptyStreak: 0 });
}

/** Called when the browser starts: a run that was active is now "interrupted" (offer Resume). */
export async function markInterrupted(): Promise<void> {
  const cur = await repo.getRun();
  if (cur && ['running', 'paused', 'blocked'].includes(cur.status)) {
    await repo.setRun({
      ...cur,
      status: 'interrupted',
      windowId: null,
      tabId: null,
      updatedAt: Date.now(),
    });
  }
  await keepAlive(false);
}

/** The user closed the collection window: pause instead of failing. */
export async function onWindowClosed(windowId: number): Promise<void> {
  const cur = await repo.getRun();
  if (!cur || cur.windowId !== windowId) return;
  const status = cur.status === 'running' || cur.status === 'blocked' ? 'paused' : cur.status;
  const next: RunState = { ...cur, status, windowId: null, tabId: null, updatedAt: Date.now() };
  await repo.setRun(next);
  await publish(next);
}

/** Restarts the loop if the service worker was suspended while a run was active. */
export async function ensureLoop(): Promise<void> {
  const cur = await repo.getRun();
  if (cur?.status === 'running' && !looping) void loop();
  if (!cur || cur.status !== 'running') await keepAlive(false);
}

async function stillRunning(runId: string): Promise<boolean> {
  const cur = await repo.getRun();
  return cur?.runId === runId && cur.status === 'running';
}

async function politeDelay(runId: string): Promise<void> {
  const ms = randomDelayMs(await loadSettings());
  const end = Date.now() + ms;
  while (Date.now() < end && (await stillRunning(runId)))
    await sleep(Math.min(1000, end - Date.now()));
}

async function loop(): Promise<void> {
  if (looping) return;
  looping = true;
  try {
    for (;;) {
      const state = await repo.getRun();
      if (!state || state.status !== 'running') break;
      try {
        if (state.phase === 'listing') await listingStep(state);
        else if (state.phase === 'details') await detailStep(state);
        else break;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await patchRun(state.runId, { status: 'error', lastError: message });
        break;
      }
    }
  } finally {
    looping = false;
  }
}

async function listingStep(state: RunState): Promise<void> {
  const { tabId, windowId } = await ensureTab(state);
  const pageUrl = state.pageUrl ?? state.startUrl;
  if (skipNavigate) skipNavigate = false;
  else await navigate(tabId, pageUrl);
  if (!(await stillRunning(state.runId))) return;

  await patchRun(state.runId, { current: pageUrl });
  const res = await runInTab(tabId, { type: 'listing', generic: state.generic });
  if (res.type !== 'listing') throw new Error('Unexpected response');
  const { links, nextUrl, nextIsClick, block } = res.result;

  if (block) {
    await setWindowMode(windowId, 'focused');
    await patchRun(state.runId, { status: 'blocked', block });
    return;
  }

  const { added, duplicates } = await repo.enqueue(state.runId, links);
  const counts = await repo.queueCounts(state.runId);
  const pagesDone = state.pagesDone + 1;
  // Stop at the last page, at the page limit, or when a page only repeats links already
  // seen in this run (some sites show the last page again for out-of-range page numbers).
  const lastPage =
    !nextUrl || pagesDone >= state.maxPages || links.length === 0 || added + duplicates === 0;

  const patch: Partial<RunState> = {
    pagesDone,
    total: counts.total - counts.skipped,
    skipped: counts.skipped,
  };
  if (lastPage) {
    await patchRun(state.runId, { ...patch, phase: 'details', pageUrl: null });
    await politeDelay(state.runId);
    return;
  }
  if (nextIsClick) {
    await politeDelay(state.runId);
    if (!(await stillRunning(state.runId))) return;
    const click = await runInTab(tabId, { type: 'clickNext' });
    if (click.type !== 'clickNext' || !click.clicked) {
      await patchRun(state.runId, { ...patch, phase: 'details', pageUrl: null });
      return;
    }
    await sleep(2500);
    await waitForTabComplete(tabId, 20000);
    skipNavigate = true;
    await patchRun(state.runId, { ...patch, pageUrl: await currentTabUrl(tabId) });
    return;
  }
  await patchRun(state.runId, { ...patch, pageUrl: nextUrl });
  await politeDelay(state.runId);
}

async function detailStep(state: RunState): Promise<void> {
  const item = await repo.nextPending(state.runId);
  if (!item || item.id === undefined) {
    await patchRun(state.runId, { status: 'done', phase: 'done', current: '' });
    await keepAlive(false);
    await closeWindow(state.windowId);
    await patchRun(state.runId, { windowId: null, tabId: null });
    return;
  }
  const { tabId, windowId } = await ensureTab(state);
  await patchRun(state.runId, { current: item.url });
  let result: DetailResult;
  try {
    await navigate(tabId, item.url);
    if (!(await stillRunning(state.runId))) return;
    const res = await runInTab(tabId, { type: 'detail', jobUrl: item.url, hints: item.hints });
    if (res.type !== 'detail') throw new Error('Unexpected response');
    result = res.result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await repo.markQueue(item.id, 'error', message);
    await patchRun(state.runId, { errors: state.errors + 1, lastError: `${item.url}: ${message}` });
    await politeDelay(state.runId);
    return;
  }

  if (result.block) {
    await setWindowMode(windowId, 'focused');
    await patchRun(state.runId, { status: 'blocked', block: result.block });
    return;
  }

  const settings = await loadSettings();
  const empty = isMostlyEmpty(result.job);
  const emptyStreak = empty ? state.emptyStreak + 1 : 0;
  const suggestWindowMode =
    state.suggestWindowMode ||
    (settings.windowMode === 'minimized' && emptyStreak >= EMPTY_STREAK_HINT);

  if (result.job) {
    await repo.addJob({
      ...result.job,
      site: state.site,
      runId: state.runId,
      collectedAt: Date.now(),
    });
    await repo.markQueue(item.id, 'done');
    await patchRun(state.runId, { done: state.done + 1, emptyStreak, suggestWindowMode });
    broadcast({ type: 'jobsChanged' });
  } else {
    await repo.markQueue(item.id, 'error', 'No job data found on the page');
    await patchRun(state.runId, {
      errors: state.errors + 1,
      lastError: `${item.url}: no job data found`,
      emptyStreak,
      suggestWindowMode,
    });
  }
  await politeDelay(state.runId);
}
