/**
 * Hover preview before a run starts: while the side panel shows a job list, hovering the list
 * on the page highlights the WHOLE list in green with "List with 25 jobs · about 360 in total".
 * It never intercepts clicks. It ends when the side panel closes (its port disconnects),
 * when a run starts, or when the panel turns it off.
 */
import { listAt, presetList, type JobList } from '../extract/lists';
import { presetForUrl } from '../presets/presets';
import { formatNumber } from '../shared/i18n';
import { HOVER_PORT } from '../shared/messages';
import type { GenericConfig, Language } from '../shared/types';
import { ListOverlay } from './overlay';

const TEXT: Record<Language, { withTotal: string; onlyPage: string; smart: string }> = {
  en: {
    withTotal: 'List with {n} jobs · about {total} in total',
    onlyPage: 'List with {n} jobs on this page',
    smart: 'Smart detection',
  },
  de: {
    withTotal: 'Liste mit {n} Jobs · ca. {total} insgesamt',
    onlyPage: 'Liste mit {n} Jobs auf dieser Seite',
    smart: 'Intelligente Erkennung',
  },
};

export interface HoverOptions {
  lang: Language;
  totalResults: number | null;
  generic?: GenericConfig;
}

export function hoverLabel(count: number, total: number | null, lang: Language): string {
  const t = TEXT[lang];
  const n = formatNumber(count, lang);
  return total && total > count
    ? t.withTotal.replace('{n}', n).replace('{total}', formatNumber(total, lang))
    : t.onlyPage.replace('{n}', n);
}

let stop: (() => void) | null = null;

export function stopHoverPreview(): void {
  stop?.();
}

export function startHoverPreview(opts: HoverOptions): void {
  stopHoverPreview();
  const ctx = {
    doc: document,
    url: location.href,
    preset: presetForUrl(location.href),
    generic: opts.generic,
  };
  let pageList: JobList | null = presetList(ctx);
  let current: JobList | null = null;
  const overlay = new ListOverlay('sanjob-hover');

  const onMove = (e: MouseEvent): void => {
    overlay.moveTo(e.clientX, e.clientY);
    const target = e.target instanceof Element ? e.target : null;
    if (!target) return;
    const found = listAt(target, ctx, pageList);
    if (found?.container === current?.container && found?.items.length === current?.items.length)
      return;
    current = found;
    if (!found) overlay.show(null, null);
    else {
      overlay.show(
        found.items,
        hoverLabel(found.items.length, opts.totalResults, opts.lang),
        found.smart ? TEXT[opts.lang].smart : null,
      );
    }
  };
  const onLeave = (): void => {
    current = null;
    overlay.show(null, null);
  };
  const onScroll = (): void => overlay.schedule();
  const refresh = setInterval(() => {
    pageList = presetList(ctx);
  }, 1500);

  document.addEventListener('mousemove', onMove, { capture: true, passive: true });
  document.documentElement.addEventListener('mouseleave', onLeave);
  window.addEventListener('scroll', onScroll, { capture: true, passive: true });

  // Ends automatically when the side panel goes away.
  let port: chrome.runtime.Port | null = null;
  try {
    port = chrome.runtime.connect({ name: HOVER_PORT });
    port.onDisconnect.addListener(() => stopHoverPreview());
  } catch {
    /* extension reloaded */
  }

  stop = () => {
    document.removeEventListener('mousemove', onMove, { capture: true });
    document.documentElement.removeEventListener('mouseleave', onLeave);
    window.removeEventListener('scroll', onScroll, { capture: true });
    clearInterval(refresh);
    overlay.destroy();
    try {
      port?.disconnect();
    } catch {
      /* already closed */
    }
    stop = null;
  };
}
