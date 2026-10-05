import { repo } from '../db/db';
import type { PanelRequest, PanelResponse } from '../shared/messages';
import { saveSettings } from '../shared/settings';
import {
  KEEPALIVE_ALARM,
  applyWindowMode,
  cancelRun,
  ensureLoop,
  markInterrupted,
  onWindowClosed,
  pauseRun,
  resumeRun,
  startRun,
} from './runner';

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);

chrome.runtime.onStartup.addListener(() => {
  void markInterrupted();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === KEEPALIVE_ALARM) void ensureLoop();
});

chrome.windows.onRemoved.addListener((windowId) => {
  void onWindowClosed(windowId);
});

async function handle(req: PanelRequest): Promise<PanelResponse> {
  switch (req.type) {
    case 'start':
      return { ok: true, state: await startRun(req.url, req.maxPages, req.generic) };
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

chrome.runtime.onMessage.addListener((msg: unknown, sender, sendResponse) => {
  // Only accept requests from our own extension pages (not from content scripts / websites).
  if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL(''))) {
    return false;
  }
  const req = msg as PanelRequest;
  if (!req || typeof req !== 'object' || !('type' in req)) return false;
  if (!['start', 'pause', 'resume', 'cancel', 'getState', 'setWindowMode'].includes(req.type)) {
    return false;
  }
  handle(req)
    .then(sendResponse)
    .catch((err: unknown) =>
      sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
    );
  return true;
});
