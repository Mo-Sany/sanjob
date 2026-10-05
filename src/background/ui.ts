/** Everything the background shows outside the side panel: ports, badge, notification. */
import type { Broadcast } from '../shared/messages';
import type { Language, RunState } from '../shared/types';

/** Open side panels subscribed to live updates. */
const panelPorts = new Set<chrome.runtime.Port>();

export function addPanelPort(port: chrome.runtime.Port, initial: Broadcast): void {
  panelPorts.add(port);
  port.onDisconnect.addListener(() => panelPorts.delete(port));
  safePost(port, initial);
}

function safePost(port: chrome.runtime.Port, message: Broadcast): void {
  try {
    port.postMessage(message);
  } catch {
    panelPorts.delete(port);
  }
}

/** Sends to every subscribed side panel. */
export function publishToPanels(message: Broadcast): void {
  for (const port of panelPorts) safePost(port, message);
}

const COLORS = {
  running: '#0d9488',
  attention: '#f59e0b',
  done: '#16a34a',
};

/** Badge text such as "45/360" while reading jobs. */
export function badgeFor(state: RunState | null): { text: string; color: string } {
  if (!state) return { text: '', color: COLORS.running };
  switch (state.status) {
    case 'running':
      return state.phase === 'details'
        ? { text: `${state.done + state.errors}/${state.total}`, color: COLORS.running }
        : { text: state.total ? String(state.total) : '…', color: COLORS.running };
    case 'paused':
    case 'interrupted':
    case 'error':
      return { text: 'II', color: COLORS.attention };
    case 'blocked':
      return { text: '!', color: COLORS.attention };
    case 'done':
      return { text: '✓', color: COLORS.done };
    default:
      return { text: '', color: COLORS.running };
  }
}

let lastBadge = '';
export async function updateBadge(state: RunState | null): Promise<void> {
  const { text, color } = badgeFor(state);
  const key = `${text}|${color}`;
  if (key === lastBadge) return;
  lastBadge = key;
  try {
    await chrome.action.setBadgeBackgroundColor({ color });
    await chrome.action.setBadgeText({ text });
  } catch {
    /* badge is cosmetic */
  }
}

export function doneMessage(collected: number, lang: Language): string {
  return lang === 'de'
    ? `Fertig! ${collected} Jobs gesammelt`
    : `Done! ${collected} job${collected === 1 ? '' : 's'} collected`;
}

export async function notifyDone(collected: number, lang: Language): Promise<void> {
  try {
    await chrome.notifications.create(`sanjob-done-${Date.now()}`, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title: 'Sanjob',
      message: doneMessage(collected, lang),
      priority: 0,
    });
  } catch (err) {
    console.warn('[Sanjob] notification not shown', err);
  }
}
