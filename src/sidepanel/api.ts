import contentScript from '../content/content-script.ts?iife';
import {
  PANEL_PORT,
  type Broadcast,
  type ContentCommand,
  type ContentResponse,
  type PanelRequest,
  type PanelResponse,
} from '../shared/messages';

export async function send(req: PanelRequest): Promise<PanelResponse> {
  try {
    const res = (await chrome.runtime.sendMessage(req)) as PanelResponse | undefined;
    if (res && !res.ok) console.warn('[Sanjob]', req.type, res.code, res.details);
    return res ?? { ok: false, code: 'unknown', details: 'no response from the service worker' };
  } catch (err) {
    console.warn('[Sanjob]', req.type, err);
    return { ok: false, code: 'unknown', details: String(err) };
  }
}

/**
 * Subscribes to live updates from the service worker over a long-lived port.
 * Reconnects automatically when the service worker restarts. Returns an unsubscribe function.
 */
export function subscribe(onMessage: (msg: Broadcast) => void): () => void {
  let port: chrome.runtime.Port | null = null;
  let closed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const connect = (): void => {
    if (closed) return;
    try {
      port = chrome.runtime.connect({ name: PANEL_PORT });
      port.onMessage.addListener((m: unknown) => onMessage(m as Broadcast));
      port.onDisconnect.addListener(() => {
        port = null;
        if (!closed) timer = setTimeout(connect, 1000);
      });
    } catch {
      timer = setTimeout(connect, 2000);
    }
  };
  connect();
  return () => {
    closed = true;
    clearTimeout(timer);
    port?.disconnect();
  };
}

export async function activeTab(): Promise<chrome.tabs.Tab | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ?? null;
}

export function originPattern(url: string): string | null {
  try {
    const u = new URL(url);
    return /^https?:$/.test(u.protocol) ? `${u.origin}/*` : null;
  } catch {
    return null;
  }
}

/** Requests access to one origin (generic mode). Must run inside a click handler. */
export async function ensureOriginAccess(url: string): Promise<boolean> {
  const pattern = originPattern(url);
  if (!pattern) return false;
  if (await chrome.permissions.contains({ origins: [pattern] })) return true;
  return chrome.permissions.request({ origins: [pattern] });
}

/** Runs a content command in the user's active tab (auto-detect / picker). */
export async function runInActiveTab(tabId: number, cmd: ContentCommand): Promise<ContentResponse> {
  await chrome.scripting.executeScript({ target: { tabId }, files: [contentScript] });
  const [res] = await chrome.scripting.executeScript({
    target: { tabId },
    func: (c: ContentCommand) => window.__sanjob!.run(c),
    args: [cmd],
  });
  return res?.result as ContentResponse;
}

export function downloadBytes(bytes: Uint8Array, fileName: string, mime: string): void {
  const blob = new Blob([bytes as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
