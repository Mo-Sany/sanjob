import { repo } from '../db/db';
import {
  KEEPALIVE_PORT,
  PANEL_PORT,
  type OpenPanelRequest,
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
  onLiveViewSetting,
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
        state: await startRun(req.url, req.maxPages, req.generic, req.siteName, req.sourceTabId),
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

// The live view's progress chip asks to open the side panel (user click on the page).
chrome.runtime.onMessage.addListener((msg: unknown, sender) => {
  if (sender.id !== chrome.runtime.id || !sender.tab) return false;
  if ((msg as OpenPanelRequest | null)?.type !== 'openSidePanel') return false;
  const windowId = sender.tab.windowId;
  chrome.sidePanel
    .open({ windowId })
    .catch((err: unknown) => console.debug('[Sanjob] side panel not opened', err));
  return false;
});

// The "Live view" setting was switched on or off.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes['settings']) return;
  const before = (changes['settings'].oldValue as { liveView?: boolean } | undefined)?.liveView;
  const after = (changes['settings'].newValue as { liveView?: boolean } | undefined)?.liveView;
  if ((before !== false) !== (after !== false)) void onLiveViewSetting(after !== false);
});

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
