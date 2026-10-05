/**
 * Live view driver: sends the real run state to the user's results tab, which marks the job
 * cards (see content/liveview.ts). Purely cosmetic – nothing here can stop or slow the run.
 */
import { repo } from '../db/db';
import { loadSettings } from '../shared/settings';
import type { LiveStatus, LiveUpdate, QueueItem, RunState } from '../shared/types';
import { normalizeUrl } from '../shared/url';
import { runInTab, waitForTabComplete } from './browser';

export function liveStatus(item: QueueItem, focusKey: string | null): LiveStatus {
  switch (item.status) {
    case 'done':
      return 'done';
    case 'error':
      return 'skipped';
    case 'skipped':
      return 'dup';
    default:
      return item.key === focusKey ? 'progress' : 'queued';
  }
}

/** Seconds left, from the measured time per job (or the configured delay). */
export function remainingSeconds(
  state: RunState,
  delayMinSec: number,
  delayMaxSec: number,
): number | null {
  if (!state.total) return null;
  const perItem = state.avgItemMs ? state.avgItemMs / 1000 : (delayMinSec + delayMaxSec) / 2 + 3;
  return Math.max(0, state.total - state.done - state.errors) * perItem;
}

/** Builds what the live view should show for the run. */
export function buildLiveUpdate(
  state: RunState,
  items: QueueItem[],
  settings: { language: LiveUpdate['language']; delayMinSec: number; delayMaxSec: number },
  action: LiveUpdate['action'],
): LiveUpdate {
  const focus =
    state.phase === 'details' && state.status === 'running' && state.current
      ? normalizeUrl(state.current)
      : null;
  const update: LiveUpdate = {
    action,
    items: items.map((it) => [it.key, liveStatus(it, focus)]),
    focus,
    done: state.done,
    total: state.total,
    remainingSec: remainingSeconds(state, settings.delayMinSec, settings.delayMaxSec),
    language: settings.language,
  };
  if (state.generic) update.generic = state.generic;
  return update;
}

const sameUrl = (a: string | undefined | null, b: string | null): boolean => {
  if (!a || !b) return false;
  return normalizeUrl(a) === normalizeUrl(b);
};

/**
 * Is the live tab still showing the page the run expects? Returns the tab's URL (after a
 * redirect caused by our own navigation) or null when the user went elsewhere.
 */
async function liveTabUrl(state: RunState): Promise<string | null> {
  if (state.liveTabId === null) return null;
  try {
    let tab = await chrome.tabs.get(state.liveTabId);
    if (sameUrl(tab.pendingUrl, state.liveUrl)) {
      await waitForTabComplete(state.liveTabId, 20000);
      tab = await chrome.tabs.get(state.liveTabId);
      return tab.url ?? null;
    }
    return sameUrl(tab.url, state.liveUrl) ? (tab.url ?? null) : null;
  } catch {
    return null;
  }
}

let chain: Promise<unknown> = Promise.resolve();

/**
 * Pushes the current state to the live tab (serialized; failures are ignored because the
 * live view is cosmetic). Resolves to the live tab's URL, or null when the user navigated the
 * tab elsewhere – the caller then stops the live view quietly.
 */
export function pushLive(
  state: RunState,
  action: LiveUpdate['action'] = 'sync',
): Promise<string | null> {
  const job = chain.then(async (): Promise<string | null> => {
    if (state.liveTabId === null) return null;
    const settings = await loadSettings();
    if (!settings.liveView && action !== 'clear') return state.liveUrl;
    const url = await liveTabUrl(state);
    if (!url) return null;
    const items = action === 'clear' ? [] : await repo.queueItems(state.runId);
    const update = buildLiveUpdate(state, items, settings, action);
    try {
      await runInTab(state.liveTabId, { type: 'live', update });
    } catch (err) {
      console.debug('[Sanjob] live view not updated', err);
    }
    return url;
  });
  chain = job.catch(() => undefined);
  return job.catch(() => state.liveUrl);
}

/**
 * Moves the live tab to the next results page together with the run – only if the user
 * has not navigated that tab elsewhere. Returns the new live URL, or null to stop live view.
 */
export async function followToPage(state: RunState, nextUrl: string): Promise<string | null> {
  if (state.liveTabId === null) return null;
  if (!(await loadSettings()).liveView) return state.liveUrl;
  try {
    const tab = await chrome.tabs.get(state.liveTabId);
    if (!sameUrl(tab.url, state.liveUrl)) return null;
    await chrome.tabs.update(state.liveTabId, { url: nextUrl });
    return nextUrl;
  } catch {
    return null;
  }
}
