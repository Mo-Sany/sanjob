import { repo } from '../db/db';
import {
  KEEPALIVE_PORT,
  PANEL_PORT,
  type PanelRequest,
  type PanelResponse,
} from '../shared/messages';
import { saveSettings } from '../shared/settings';
import {
  BusyError,
  KEEPALIVE_ALARM,
  applyWindowMode,
  cancelRun,
  ensureLoop,
  markInterrupted,
  onTabClosed,
  onWindowClosed,
  pauseRun,
  resumeRun,
  startRun,
} from './runner';
import { addPanelPort } from './ui';

const SIDE_PANEL_PATH = 'src/sidepanel/index.html';

/**
 * One global side panel (no tabId): it stays open with live progress when the user switches
 * tabs, and clicking the toolbar icon opens it.
 */
function setupSidePanel(): void {
  chrome.sidePanel
    .setOptions({ path: SIDE_PANEL_PATH, enabled: true })
    .catch((err: unknown) => console.warn('[Sanjob] sidePanel.setOptions', err));
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((err: unknown) => console.warn('[Sanjob] sidePanel.setPanelBehavior', err));
}
setupSidePanel();
chrome.runtime.onInstalled.addListener(setupSidePanel);

chrome.runtime.onStartup.addListener(() => {
  void markInterrupted();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === KEEPALIVE_ALARM) void ensureLoop();
});

chrome.windows.onRemoved.addListener((windowId) => {
  void onWindowClosed(windowId);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void onTabClosed(tabId);
});

/**
 * Long-lived ports:
 * - side panel: subscribes to live state updates (the panel is only a view);
 * - collection tab: pings keep the service worker awake during long page loads.
 */
chrome.runtime.onConnect.addListener((port) => {
  if (port.sender?.id !== chrome.runtime.id) return;
  if (port.name === PANEL_PORT) {
    void repo.getRun().then((state) => addPanelPort(port, { type: 'state', state }));
    void ensureLoop();
  } else if (port.name === KEEPALIVE_PORT) {
    port.onMessage.addListener(() => {
      void ensureLoop();
    });
  }
});

async function handle(req: PanelRequest): Promise<PanelResponse> {
  switch (req.type) {
    case 'start':
      return {
        ok: true,
        state: await startRun(req.url, req.maxPages, req.generic, req.siteName),
      };
    case 'pause':
      await pauseRun();
      break;
    case 'resume':
      await resumeRun();
      break;
    case 'cancel':
      await cancelRun();
      break;
    case 'setWindowMode':
      await saveSettings({ windowMode: req.mode });
      await applyWindowMode(req.mode);
      break;
    case 'getState':
      await ensureLoop();
      break;
  }
  return { ok: true, state: await repo.getRun() };
}

const REQUEST_TYPES = new Set(['start', 'pause', 'resume', 'cancel', 'getState', 'setWindowMode']);

chrome.runtime.onMessage.addListener((msg: unknown, sender, sendResponse) => {
  // Only accept requests from our own extension pages (not from content scripts / websites).
  if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL(''))) {
    return false;
  }
  const req = msg as PanelRequest;
  if (!req || typeof req !== 'object' || !REQUEST_TYPES.has(req.type)) return false;
  handle(req)
    .then(sendResponse)
    .catch((err: unknown) => {
      console.error('[Sanjob] request', req.type, err);
      const response: PanelResponse = {
        ok: false,
        code: err instanceof BusyError ? 'busy' : req.type === 'start' ? 'window' : 'unknown',
        details: err instanceof Error ? err.message : String(err),
      };
      sendResponse(response);
    });
  return true;
});
