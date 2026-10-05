/**
 * Content script, injected on demand with chrome.scripting into the collection tab
 * (or the user's tab for the element picker). It only reads the page; it never fills forms,
 * solves challenges or touches credentials.
 */
import { extractDetail } from '../extract/detail';
import { clickNext, extractListing } from '../extract/listing';
import { detectCardGroups } from '../extract/generic';
import { presetForUrl } from '../presets/presets';
import type { ContentCommand, ContentResponse } from '../shared/messages';
import { startPicker } from './picker';

declare global {
  interface Window {
    __sanjob?: { run: (cmd: ContentCommand) => Promise<ContentResponse> };
  }
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function waitForAny(selectors: string[], timeoutMs: number): Promise<boolean> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    for (const sel of selectors) {
      try {
        if (document.querySelector(sel)) return true;
      } catch {
        /* invalid selector */
      }
    }
    await sleep(300);
  }
  return false;
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

async function run(cmd: ContentCommand): Promise<ContentResponse> {
  const preset = presetForUrl(location.href);
  switch (cmd.type) {
    case 'listing': {
      await waitForAny(preset?.listing.ready ?? ['a[href]'], 15000);
      await sleep(600);
      await autoScroll();
      const result = extractListing({
        doc: document,
        pageUrl: location.href,
        preset,
        generic: cmd.generic,
      });
      return { type: 'listing', result };
    }
    case 'detail': {
      await waitForAny(preset?.detail.ready ?? ['h1', 'script[type="application/ld+json"]'], 15000);
      await sleep(600);
      const result = extractDetail({
        doc: document,
        pageUrl: location.href,
        jobUrl: cmd.jobUrl,
        preset,
        hints: cmd.hints,
      });
      return { type: 'detail', result };
    }
    case 'clickNext':
      return { type: 'clickNext', clicked: clickNext(document, preset) };
    case 'detectCards': {
      const best = detectCardGroups(document, 1)[0];
      if (best) {
        for (const card of best.cards) (card as HTMLElement).style.outline = '2px solid #0d9488';
        setTimeout(() => best.cards.forEach((c) => ((c as HTMLElement).style.outline = '')), 2500);
      }
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
}

if (!window.__sanjob) {
  window.__sanjob = { run };
}
