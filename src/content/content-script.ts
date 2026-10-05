/**
 * Content script, injected on demand with chrome.scripting into the collection tab
 * (or the user's tab for page analysis and the list picker). It only reads the page; it never
 * fills forms, solves challenges or touches credentials.
 */
import { analyzePage } from '../extract/analyze';
import { extractDetail } from '../extract/detail';
import { detectCardGroups } from '../extract/generic';
import { clickNext, extractListing } from '../extract/listing';
import { presetForUrl } from '../presets/presets';
import { KEEPALIVE_PORT, type ContentCommand, type ContentResponse } from '../shared/messages';
import { startPicker } from './picker';

declare global {
  interface Window {
    __sanjob?: { run: (cmd: ContentCommand) => Promise<ContentResponse> };
  }
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const DEFAULT_READY_TIMEOUT = 15000;

function anyMatches(selectors: string[]): boolean {
  for (const sel of selectors) {
    try {
      if (document.querySelector(sel)) return true;
    } catch {
      /* invalid selector in a preset */
    }
  }
  return false;
}

/**
 * "Content ready" check: resolves true as soon as one of the selectors exists (watched with a
 * MutationObserver, so late-rendering single-page apps are caught), false after the timeout.
 */
export function waitForContent(selectors: string[], timeoutMs: number): Promise<boolean> {
  if (anyMatches(selectors)) return Promise.resolve(true);
  return new Promise((resolve) => {
    let settled = false;
    const done = (value: boolean): void => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      clearTimeout(timer);
      resolve(value);
    };
    const observer = new MutationObserver(() => {
      if (anyMatches(selectors)) done(true);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    const timer = setTimeout(() => done(anyMatches(selectors)), timeoutMs);
  });
}

/** Scrolls the page and the main scrollable list so lazy-loaded cards render. */
async function autoScroll(steps = 8): Promise<void> {
  const scrollables = Array.from(document.querySelectorAll<HTMLElement>('main *, body > div *'))
    .filter((el) => el.scrollHeight > el.clientHeight + 200 && el.querySelector('a[href]'))
    .filter((el) => /(auto|scroll)/.test(getComputedStyle(el).overflowY))
    .slice(0, 3);
  for (let i = 0; i < steps; i++) {
    window.scrollBy(0, window.innerHeight);
    for (const el of scrollables) el.scrollTop += el.clientHeight;
    await sleep(350);
  }
  window.scrollTo(0, 0);
}

/**
 * Long-lived port to the service worker while this page is open in the collection tab.
 * Regular messages on it keep the service worker awake during long page loads.
 */
let keepAliveStarted = false;
function keepServiceWorkerAwake(): void {
  if (keepAliveStarted) return;
  keepAliveStarted = true;
  try {
    const port = chrome.runtime.connect({ name: KEEPALIVE_PORT });
    const timer = setInterval(() => {
      try {
        port.postMessage({ type: 'ping' });
      } catch {
        clearInterval(timer);
      }
    }, 20000);
    port.onDisconnect.addListener(() => clearInterval(timer));
    addEventListener('pagehide', () => {
      clearInterval(timer);
      port.disconnect();
    });
  } catch {
    /* extension reloaded */
  }
}

async function run(cmd: ContentCommand): Promise<ContentResponse> {
  const preset = presetForUrl(location.href);
  switch (cmd.type) {
    case 'listing': {
      keepServiceWorkerAwake();
      const selectors = cmd.generic
        ? [cmd.generic.cardSelector]
        : (preset?.listing.ready ?? ['a[href]']);
      const ready = await waitForContent(selectors, cmd.timeoutMs ?? DEFAULT_READY_TIMEOUT);
      await sleep(600);
      await autoScroll();
      const result = extractListing({
        doc: document,
        pageUrl: location.href,
        preset,
        generic: cmd.generic,
      });
      return { type: 'listing', result: { ...result, ready } };
    }
    case 'detail': {
      keepServiceWorkerAwake();
      const ready = await waitForContent(
        preset?.detail.ready ?? ['h1', 'script[type="application/ld+json"]'],
        cmd.timeoutMs ?? DEFAULT_READY_TIMEOUT,
      );
      await sleep(600);
      const result = extractDetail({
        doc: document,
        pageUrl: location.href,
        jobUrl: cmd.jobUrl,
        preset,
        hints: cmd.hints,
      });
      return { type: 'detail', result: { ...result, ready } };
    }
    case 'analyze': {
      // Runs in the user's own tab: no scrolling, only a short wait for late content.
      const selectors = cmd.generic
        ? [cmd.generic.cardSelector]
        : (preset?.listing.ready ?? ['a[href]']);
      await waitForContent(selectors, 2500);
      return {
        type: 'analyze',
        result: analyzePage({ doc: document, url: location.href, preset, generic: cmd.generic }),
      };
    }
    case 'clickNext':
      return { type: 'clickNext', clicked: clickNext(document, preset) };
    case 'detectCards': {
      const best = detectCardGroups(document, 1)[0];
      return {
        type: 'detectCards',
        selector: best?.selector ?? null,
        count: best?.cards.length ?? 0,
      };
    }
    case 'startPicker':
      startPicker(cmd.lang);
      return { type: 'ok' };
    case 'probe':
      return {
        type: 'probe',
        url: location.href,
        title: document.title,
        site: preset?.id ?? 'generic',
      };
  }
  return { type: 'ok' };
}

if (!window.__sanjob) {
  window.__sanjob = { run };
}
