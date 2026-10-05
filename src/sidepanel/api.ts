import contentScript from '../content/content-script.ts?iife';
import type {
  ContentCommand,
  ContentResponse,
  PanelRequest,
  PanelResponse,
} from '../shared/messages';

export async function send(req: PanelRequest): Promise<PanelResponse> {
  const res = (await chrome.runtime.sendMessage(req)) as PanelResponse | undefined;
  return res ?? { ok: false, error: 'No response from background' };
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
