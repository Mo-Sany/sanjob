/**
 * Continuous mode: reads every job on the user's (infinite-scroll) page and reports NEW job
 * links whenever more cards appear – e.g. when the user scrolls down. Only reads the page.
 */
import { listingCards } from '../extract/listing';
import { presetForUrl } from '../presets/presets';
import type { WatchLinksMessage } from '../shared/messages';
import type { GenericConfig, ListingLink } from '../shared/types';

let stopWatching: (() => void) | null = null;

export function unwatch(): void {
  stopWatching?.();
}

/** Starts watching; returns the links that are on the page right now. */
export function watch(generic?: GenericConfig, debounceMs = 700): ListingLink[] {
  unwatch();
  const sent = new Set<string>();
  const collect = (): ListingLink[] => {
    const fresh: ListingLink[] = [];
    for (const card of listingCards({
      doc: document,
      pageUrl: location.href,
      preset: presetForUrl(location.href),
      generic,
    })) {
      if (sent.has(card.key)) continue;
      sent.add(card.key);
      fresh.push(card.hints ? { url: card.url, hints: card.hints } : { url: card.url });
    }
    return fresh;
  };

  let timer: ReturnType<typeof setTimeout> | undefined;
  const check = (): void => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const links = collect();
      if (!links.length) return;
      const msg: WatchLinksMessage = { type: 'watchLinks', url: location.href, links };
      chrome.runtime.sendMessage(msg).catch(() => unwatch());
    }, debounceMs);
  };
  const observer = new MutationObserver(check);
  observer.observe(document.body ?? document.documentElement, { childList: true, subtree: true });
  window.addEventListener('scroll', check, { passive: true, capture: true });

  stopWatching = () => {
    clearTimeout(timer);
    observer.disconnect();
    window.removeEventListener('scroll', check, { capture: true });
    stopWatching = null;
  };
  return collect();
}
