/** Thin wrappers around chrome.* APIs used by the runner. */
import contentScript from '../content/content-script.ts?iife';
import type { ContentCommand, ContentResponse } from '../shared/messages';
import type { WindowMode } from '../shared/types';

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const NORMAL_SIZE = { width: 520, height: 700 };

/**
 * Opens the dedicated collection window. Job pages are loaded in a separate tab created with
 * active:false inside it, so the run never touches the user's own tabs.
 */
export async function createWorkerWindow(
  mode: WindowMode,
): Promise<{ windowId: number; tabId: number }> {
  const win = await chrome.windows.create(
    mode === 'minimized'
      ? { url: 'about:blank', state: 'minimized', focused: false, type: 'normal' }
      : { url: 'about:blank', focused: false, type: 'normal', ...NORMAL_SIZE, left: 40, top: 40 },
  );
  if (!win?.id) throw new Error('chrome.windows.create returned no window');
  const tabId = await createWorkTab(win.id);
  return { windowId: win.id, tabId };
}

/** A background (inactive) tab in the collection window. */
export async function createWorkTab(windowId: number): Promise<number> {
  const tab = await chrome.tabs.create({ windowId, url: 'about:blank', active: false });
  if (tab.id === undefined) throw new Error('chrome.tabs.create returned no tab');
  return tab.id;
}

export async function windowExists(windowId: number | null): Promise<boolean> {
  if (windowId === null) return false;
  try {
    await chrome.windows.get(windowId);
    return true;
  } catch {
    return false;
  }
}

export async function tabExists(tabId: number | null): Promise<boolean> {
  if (tabId === null) return false;
  try {
    await chrome.tabs.get(tabId);
    return true;
  } catch {
    return false;
  }
}

export async function setWindowMode(
  windowId: number | null,
  mode: WindowMode | 'focused',
): Promise<void> {
  if (windowId === null) return;
  try {
    if (mode === 'minimized') await chrome.windows.update(windowId, { state: 'minimized' });
    else if (mode === 'normal')
      await chrome.windows.update(windowId, { state: 'normal', ...NORMAL_SIZE });
    else
      await chrome.windows.update(windowId, {
        state: 'normal',
        focused: true,
        width: 1100,
        height: 800,
      });
  } catch {
    /* window already closed */
  }
}

export async function closeWindow(windowId: number | null): Promise<void> {
  if (windowId === null) return;
  try {
    await chrome.windows.remove(windowId);
  } catch {
    /* already closed */
  }
}

/** Resolves when the tab finished loading (or after the timeout). */
export function waitForTabComplete(tabId: number, timeoutMs = 45000): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      chrome.tabs.onUpdated.removeListener(listener);
      clearTimeout(timer);
      resolve();
    };
    const listener = (id: number, info: { status?: string }): void => {
      if (id === tabId && info.status === 'complete') finish();
    };
    const timer = setTimeout(finish, timeoutMs);
    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs
      .get(tabId)
      .then((tab) => {
        if (tab.status === 'complete' && !tab.pendingUrl) finish();
      })
      .catch(finish);
  });
}

export async function navigate(tabId: number, url: string): Promise<void> {
  await chrome.tabs.update(tabId, { url });
  await sleep(300);
  await waitForTabComplete(tabId);
}

export async function reloadTab(tabId: number): Promise<void> {
  await chrome.tabs.reload(tabId);
  await sleep(300);
  await waitForTabComplete(tabId);
}

export async function currentTabUrl(tabId: number): Promise<string> {
  return (await chrome.tabs.get(tabId)).url ?? '';
}

/** Injects the content script (idempotent) and runs one command in the tab. */
export async function runInTab(tabId: number, cmd: ContentCommand): Promise<ContentResponse> {
  await chrome.scripting.executeScript({ target: { tabId }, files: [contentScript] });
  const [res] = await chrome.scripting.executeScript({
    target: { tabId },
    func: (c: ContentCommand) => window.__sanjob!.run(c),
    args: [cmd],
  });
  if (!res || res.result === undefined || res.result === null) {
    throw new Error('The page did not respond (it may still be loading or not be accessible).');
  }
  return res.result as ContentResponse;
}

export function broadcast(message: unknown): void {
  chrome.runtime.sendMessage(message).catch(() => {
    /* side panel closed – nothing listens */
  });
}
