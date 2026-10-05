/**
 * The collection run, orchestrated entirely in the service worker.
 * It never depends on the active tab or on the side panel: pages load in an inactive tab of a
 * dedicated window, and all state (queue, progress, results) lives in IndexedDB.
 */
import { isMostlyEmpty } from '../extract/detail';
import { repo } from '../db/db';
import { presetForUrl } from '../presets/presets';
import { excludeMatcher } from '../shared/filter';
import { excludeKeywordsOf, loadSettings, randomDelayMs } from '../shared/settings';
import type { ContentCommand, ContentResponse } from '../shared/messages';
import type {
  CollectMode,
  DetailResult,
  GenericConfig,
  ListingLink,
  ListingResult,
  NoticeKey,
  RunState,
  WindowMode,
} from '../shared/types';
import {
  broadcast,
  closeWindow,
  createWorkTab,
  createWorkerWindow,
  currentTabUrl,
  navigate,
  reloadTab,
  runInTab,
  setWindowMode,
  sleep,
  tabExists,
  waitForTabComplete,
  windowExists,
} from './browser';
import { followToPage, pushLive } from './live';
import { notifyDone, publishToPanels, updateBadge } from './ui';

export const KEEPALIVE_ALARM = 'sanjob-keepalive';
/** Consecutive near-empty detail pages before suggesting the "small window" mode. */
const EMPTY_STREAK_HINT = 3;
/** Content-ready timeout per attempt (then one retry). */
const READY_TIMEOUT_MS = 15000;

let looping = false;
/** Set when the next listing step must read the current page instead of navigating (after a click). */
let skipNavigate = false;

function newRunId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const describe = (err: unknown): string => (err instanceof Error ? err.message : String(err));

async function publish(state: RunState | null): Promise<void> {
  publishToPanels({ type: 'state', state });
  broadcast({ type: 'state', state });
  await updateBadge(state);
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

const notice = (key: NoticeKey): RunState['notice'] => ({ key, at: Date.now() });

/** Updates the live view in the user's results tab (fire-and-forget, never blocks the run). */
async function live(runId: string, action: 'sync' | 'end' = 'sync'): Promise<void> {
  const state = await repo.getRun();
  if (!state || state.runId !== runId || state.liveTabId === null) return;
  const url = await pushLive(state, action);
  if (url === null) await patchRun(runId, { liveTabId: null, liveUrl: null });
  else if (url !== state.liveUrl) await patchRun(runId, { liveUrl: url });
}

/** The user toggled the "Live view" setting. */
export async function onLiveViewSetting(on: boolean): Promise<void> {
  const state = await repo.getRun();
  if (!state || state.liveTabId === null) return;
  if (on) void live(state.runId);
  else void pushLive(state, 'clear');
}

async function keepAlive(on: boolean): Promise<void> {
  if (on) await chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: 0.5 });
  else await chrome.alarms.clear(KEEPALIVE_ALARM);
}

/** Ensures the collection window and its inactive work tab exist (reopened after a restart). */
async function ensureTab(state: RunState): Promise<{ tabId: number; windowId: number | null }> {
  if (state.tabId !== null && (await tabExists(state.tabId))) {
    return { tabId: state.tabId, windowId: state.windowId };
  }
  if (state.windowId !== null && (await windowExists(state.windowId))) {
    const tabId = await createWorkTab(state.windowId);
    await patchRun(state.runId, { tabId });
    return { tabId, windowId: state.windowId };
  }
  const settings = await loadSettings();
  const created = await createWorkerWindow(settings.windowMode);
  await patchRun(state.runId, created);
  return created;
}

/** A run is already active. */
export class BusyError extends Error {
  constructor() {
    super('A collection is already in progress');
  }
}

export async function startRun(
  url: string,
  maxPages: number,
  generic?: GenericConfig,
  siteName?: string,
  sourceTabId?: number,
  requestedMode: CollectMode = 'pages',
): Promise<RunState> {
  const existing = await repo.getRun();
  if (existing && ['running', 'paused', 'blocked'].includes(existing.status)) {
    throw new BusyError();
  }
  if (existing) await repo.clearQueue(existing.runId);
  const preset = presetForUrl(url);
  const settings = await loadSettings();
  const { windowId, tabId } = await createWorkerWindow(settings.windowMode);
  let host = '';
  try {
    host = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    /* ignore */
  }
  const state: RunState = {
    runId: newRunId(),
    status: 'running',
    // Continuous mode reads the user's own page instead of paging through results.
    phase: requestedMode === 'continuous' && sourceTabId !== undefined ? 'details' : 'listing',
    site: preset?.id ?? 'generic',
    siteName: siteName || preset?.name || host,
    startUrl: url,
    pageUrl: url,
    pagesDone: 0,
    maxPages,
    total: 0,
    done: 0,
    errors: 0,
    skipped: 0,
    filtered: 0,
    // Continuous mode watches the user's own tab, so it needs that tab.
    mode: requestedMode === 'continuous' && sourceTabId !== undefined ? 'continuous' : 'pages',
    watchTabId: requestedMode === 'continuous' ? (sourceTabId ?? null) : null,
    waiting: false,
    current: url,
    currentTitle: '',
    notice: null,
    avgItemMs: 0,
    liveTabId: sourceTabId ?? null,
    liveUrl: sourceTabId === undefined ? null : url,
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
  if (state.mode === 'continuous') await startWatching(state);
  void loop();
  return state;
}

export async function pauseRun(): Promise<void> {
  const cur = await repo.getRun();
  if (!cur || cur.status !== 'running') return;
  const next: RunState = { ...cur, status: 'paused', updatedAt: Date.now() };
  await repo.setRun(next);
  await publish(next);
  await keepAlive(false);
  void live(next.runId);
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
    notice: null,
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
  // Stopped: the live view keeps its ✓ marks (with a "Clear marks" button); the queue is
  // cleared once those marks are drawn.
  void pushLive(cur, 'end').finally(() => repo.clearQueue(cur.runId));
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
    const next: RunState = {
      ...cur,
      status: 'interrupted',
      windowId: null,
      tabId: null,
      updatedAt: Date.now(),
    };
    await repo.setRun(next);
    await updateBadge(next);
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

/** The user closed only the work tab: a new one is created on the next step. */
export async function onTabClosed(tabId: number): Promise<void> {
  const cur = await repo.getRun();
  if (!cur || cur.tabId !== tabId) return;
  await repo.setRun({ ...cur, tabId: null, updatedAt: Date.now() });
  skipNavigate = false;
}

/** Restarts the loop if the service worker was suspended while a run was active. */
export async function ensureLoop(): Promise<void> {
  const cur = await repo.getRun();
  await updateBadge(cur);
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
  while (Date.now() < end && (await stillRunning(runId))) {
    await sleep(Math.min(1000, end - Date.now()));
  }
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
        // Unexpected problem: pause with a friendly notice; the details stay technical.
        console.error('[Sanjob] run step', err);
        await patchRun(state.runId, {
          status: 'paused',
          notice: notice('noResponse'),
          lastError: describe(err),
        });
        await keepAlive(false);
        break;
      }
    }
  } finally {
    looping = false;
  }
}

type Outcome<T> = { result: T | null; problem: string };

/**
 * Loads `url` (unless null) in the work tab and runs one content command. If the page does
 * not become ready within 15 s, or does not respond, it is reloaded and tried once more.
 */
async function loadAndRead<T extends ListingResult | DetailResult>(
  state: RunState,
  tabId: number,
  url: string | null,
  cmd: ContentCommand,
  hasData: (r: T) => boolean,
): Promise<Outcome<T>> {
  let problem = '';
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      if (attempt === 1 && url) await navigate(tabId, url);
      if (attempt === 2) {
        await patchRun(state.runId, { notice: notice('retrying') });
        await reloadTab(tabId);
      }
      if (!(await stillRunning(state.runId))) return { result: null, problem: '' };
      const res: ContentResponse = await runInTab(tabId, cmd);
      const result = 'result' in res ? (res.result as T) : null;
      if (result && (result.ready !== false || hasData(result) || result.block)) {
        return { result, problem: '' };
      }
      problem = 'content not ready after 15 s';
      if (attempt === 2 && result) return { result, problem };
    } catch (err) {
      problem = describe(err);
      console.warn('[Sanjob] page attempt', attempt, problem);
    }
  }
  return { result: null, problem };
}

async function listingStep(state: RunState): Promise<void> {
  const { tabId, windowId } = await ensureTab(state);
  const pageUrl = state.pageUrl ?? state.startUrl;
  const navigateTo = skipNavigate ? null : pageUrl;
  skipNavigate = false;
  await patchRun(state.runId, { current: pageUrl, currentTitle: '' });

  const { result, problem } = await loadAndRead<ListingResult>(
    state,
    tabId,
    navigateTo,
    { type: 'listing', generic: state.generic, timeoutMs: READY_TIMEOUT_MS },
    (r) => r.links.length > 0,
  );
  if (!(await stillRunning(state.runId))) return;

  if (!result) {
    // The result page never answered: read the jobs found so far, or pause.
    const counts = await repo.queueCounts(state.runId);
    if (counts.pending > 0) {
      await patchRun(state.runId, { phase: 'details', pageUrl: null, lastError: problem });
    } else {
      await patchRun(state.runId, {
        status: 'paused',
        notice: notice('noResponse'),
        lastError: problem,
      });
      await keepAlive(false);
    }
    return;
  }

  const { links, nextUrl, nextIsClick, block } = result;
  if (block) {
    await setWindowMode(windowId, 'focused');
    await patchRun(state.runId, { status: 'blocked', block, lastError: block.reason });
    return;
  }

  const { added, duplicates, filtered } = await addLinks(state.runId, links);
  const counts = await repo.queueCounts(state.runId);
  const pagesDone = state.pagesDone + 1;
  // Stop at the last page, at the page limit, or when a page only repeats links already
  // seen in this run (some sites show the last page again for out-of-range page numbers).
  const lastPage =
    !nextUrl ||
    pagesDone >= state.maxPages ||
    links.length === 0 ||
    added + duplicates + filtered === 0;

  const patch: Partial<RunState> = {
    pagesDone,
    total: counts.total - counts.skipped - counts.filtered,
    skipped: counts.skipped,
    filtered: counts.filtered,
  };
  if (links.length === 0 && state.pagesDone === 0) patch.notice = notice('nothingFound');

  if (lastPage) {
    await patchRun(state.runId, { ...patch, phase: 'details', pageUrl: null });
    void live(state.runId);
    await politeDelay(state.runId);
    return;
  }
  void live(state.runId);
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
  // The live tab follows to the next results page (unless the user navigated it elsewhere).
  const liveUrl = state.liveTabId === null ? null : await followToPage(state, nextUrl);
  await patchRun(state.runId, {
    ...patch,
    pageUrl: nextUrl,
    liveUrl,
    liveTabId: liveUrl === null ? null : state.liveTabId,
  });
  await politeDelay(state.runId);
}

/** Queues links; the title filter marks excluded jobs as "filtered" (never opened). */
async function addLinks(
  runId: string,
  links: ListingLink[],
): Promise<{ added: number; duplicates: number; filtered: number }> {
  const isExcluded = excludeMatcher(excludeKeywordsOf(await loadSettings()));
  return repo.enqueue(runId, links, (link) => isExcluded(link.hints?.title) !== null);
}

/** "Finish" button: end the run now and show the summary (used in continuous mode). */
export async function finishRunNow(): Promise<void> {
  const cur = await repo.getRun();
  if (!cur || ['done', 'idle'].includes(cur.status)) return;
  // finishRun only changes the status of a running run; make it running for this moment.
  if (cur.status !== 'running') await repo.setRun({ ...cur, status: 'running' });
  await finishRun({ ...cur, status: 'running' });
}

/** Continuous mode: start (or restart after a navigation) watching the user's tab. */
export async function startWatching(state: RunState): Promise<void> {
  if (state.mode !== 'continuous' || state.watchTabId === null) return;
  try {
    const res = await runInTab(state.watchTabId, { type: 'watch', generic: state.generic });
    if (res.type === 'watch') await onWatchLinks(state.watchTabId, res.url, res.links);
  } catch (err) {
    console.debug('[Sanjob] watching the page is not possible', err);
  }
}

/** Continuous mode: new job links appeared in the watched tab. */
export async function onWatchLinks(
  tabId: number,
  url: string,
  links: ListingLink[],
): Promise<void> {
  const state = await repo.getRun();
  if (!state || state.mode !== 'continuous' || state.watchTabId !== tabId) return;
  if (!['running', 'paused', 'blocked'].includes(state.status) || !links.length) return;
  await addLinks(state.runId, links);
  const counts = await repo.queueCounts(state.runId);
  await patchRun(state.runId, {
    total: counts.total - counts.skipped - counts.filtered,
    skipped: counts.skipped,
    filtered: counts.filtered,
    pagesDone: Math.max(1, state.pagesDone),
    // The live view follows the watched page, also after the user navigated it.
    liveUrl: state.liveTabId === tabId ? url : state.liveUrl,
  });
  void live(state.runId);
}

async function finishRun(state: RunState): Promise<void> {
  if (state.mode === 'continuous' && state.watchTabId !== null) {
    void runInTab(state.watchTabId, { type: 'unwatch' }).catch(() => undefined);
  }
  const done = await patchRun(state.runId, {
    status: 'done',
    phase: 'done',
    current: '',
    currentTitle: '',
    waiting: false,
  });
  await keepAlive(false);
  await closeWindow(state.windowId);
  await patchRun(state.runId, { windowId: null, tabId: null });
  void live(state.runId, 'end');
  if (done) await notifyDone(done.done, (await loadSettings()).language);
}

async function detailStep(state: RunState): Promise<void> {
  const item = await repo.nextPending(state.runId);
  if (!item || item.id === undefined) {
    if (state.mode === 'continuous') {
      // Everything read so far – wait for new jobs to appear while the user scrolls.
      if (!state.waiting)
        await patchRun(state.runId, { waiting: true, current: '', currentTitle: '' });
      const end = Date.now() + 2000;
      while (Date.now() < end && (await stillRunning(state.runId))) await sleep(500);
      return;
    }
    await finishRun(state);
    return;
  }
  if (state.waiting) await patchRun(state.runId, { waiting: false });
  const startedAt = Date.now();
  const { tabId, windowId } = await ensureTab(state);
  await patchRun(state.runId, { current: item.url, currentTitle: item.hints?.title ?? '' });
  void live(state.runId);

  const { result, problem } = await loadAndRead<DetailResult>(
    state,
    tabId,
    item.url,
    { type: 'detail', jobUrl: item.url, hints: item.hints, timeoutMs: READY_TIMEOUT_MS },
    (r) => r.job !== null,
  );
  if (!(await stillRunning(state.runId))) return;

  if (result?.block) {
    await setWindowMode(windowId, 'focused');
    await patchRun(state.runId, {
      status: 'blocked',
      block: result.block,
      lastError: result.block.reason,
    });
    return;
  }

  const settings = await loadSettings();
  const empty = isMostlyEmpty(result?.job ?? null);
  const emptyStreak = empty ? state.emptyStreak + 1 : 0;
  const suggestWindowMode =
    state.suggestWindowMode ||
    (settings.windowMode === 'minimized' && emptyStreak >= EMPTY_STREAK_HINT);
  const why = problem || 'no job data found on the page';
  // The title filter also applies to titles only known from the detail page.
  const excludedBy = result?.job
    ? excludeMatcher(excludeKeywordsOf(settings))(result.job.title)
    : null;

  if (result?.job && excludedBy) {
    await repo.markQueue(item.id, 'filtered', `title contains "${excludedBy}"`);
  } else if (result?.job) {
    await repo.addJob({
      ...result.job,
      site: state.site,
      runId: state.runId,
      collectedAt: Date.now(),
    });
    await repo.markQueue(item.id, 'done');
  } else {
    await repo.markQueue(item.id, 'error', why);
  }

  await politeDelay(state.runId);
  const elapsed = Date.now() - startedAt;
  const avgItemMs = state.avgItemMs ? Math.round(state.avgItemMs * 0.7 + elapsed * 0.3) : elapsed;

  if (result?.job && excludedBy) {
    await patchRun(state.runId, { filtered: state.filtered + 1, avgItemMs });
    void live(state.runId);
  } else if (result?.job) {
    await patchRun(state.runId, {
      done: state.done + 1,
      currentTitle: result.job.title,
      emptyStreak,
      suggestWindowMode,
      avgItemMs,
    });
    publishToPanels({ type: 'jobsChanged' });
    broadcast({ type: 'jobsChanged' });
    void live(state.runId);
  } else {
    await patchRun(state.runId, {
      errors: state.errors + 1,
      notice: notice('skipped'),
      lastError: `${item.url}: ${why}`,
      emptyStreak,
      suggestWindowMode,
      avgItemMs,
    });
    void live(state.runId);
  }
}
