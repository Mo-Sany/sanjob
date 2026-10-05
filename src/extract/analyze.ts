/**
 * Reads the current page before a run: which site, how many jobs on this page, how many in
 * total ("360 Jobs gefunden") and how many result pages.
 */
import type { SitePreset } from '../presets/types';
import { excludeMatcher } from '../shared/filter';
import { oneLine } from '../shared/text';
import type { GenericConfig, PageAnalysis } from '../shared/types';
import { detectCardGroups } from './generic';
import { extractListing } from './listing';

const NUMBER = '(\\d{1,3}(?:[.,\\u00a0\\u202f ]\\d{3})+|\\d+)';
const TOTAL_RE = new RegExp(
  `${NUMBER}\\s*\\+?\\s*(?:passende[n]?\\s+|offene[n]?\\s+|neue[n]?\\s+)?(?:jobs?|stellen(?:angebote|anzeigen)?|ergebnisse|treffer|results?|vacancies|positions|openings)\\b`,
  'i',
);
const OF_TOTAL_RE = new RegExp(
  `\\b(?:von|of)\\s+${NUMBER}\\s*(?:jobs?|stellen|ergebnissen|results)?`,
  'i',
);
const PAGE_OF_RE = /\b(?:seite|page)\s+\d+\s+(?:von|of)\s+(\d{1,4})\b/i;

export function parseCount(text: string): number | null {
  const n = Number(text.replace(/[.,\u00a0\u202f ]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function textOf(el: Element | null): string {
  return oneLine(el?.textContent);
}

/** "360 Jobs gefunden", "1–20 von 360", "360 results" … → 360 */
export function readTotalResults(
  doc: Document,
  preset: SitePreset | null,
  minimum = 0,
): number | null {
  for (const sel of preset?.listing.total ?? []) {
    try {
      const t = textOf(doc.querySelector(sel));
      const m = t.match(new RegExp(NUMBER));
      const n = m ? parseCount(m[1] ?? '') : null;
      if (n) return n;
    } catch {
      /* invalid selector */
    }
  }
  // Short text blocks that mention a result count (headings, counters, status lines).
  const candidates = Array.from(
    doc.querySelectorAll(
      'h1, h2, h3, [class*="count" i], [data-testid*="count" i], [data-at*="count" i], [role="status"], header span, main span, main div',
    ),
  );
  for (const el of candidates) {
    if (el.childElementCount > 6) continue;
    const t = textOf(el);
    if (!t || t.length > 120) continue;
    const m = t.match(TOTAL_RE) ?? t.match(OF_TOTAL_RE);
    const n = m ? parseCount(m[1] ?? '') : null;
    if (n && n >= minimum && n < 5_000_000) return n;
  }
  return null;
}

/** Highest page number in the pagination, or "Seite 1 von 18". */
export function readTotalPages(doc: Document): number | null {
  const explicit = oneLine(doc.body?.textContent).match(PAGE_OF_RE);
  if (explicit) return Number(explicit[1]);
  let max = 0;
  const navs = doc.querySelectorAll(
    '[class*="pagination" i], [data-testid*="pagination" i], [aria-label*="pagination" i], [data-at*="pagination" i], nav[aria-label*="seite" i], nav[aria-label*="page" i]',
  );
  for (const nav of Array.from(navs)) {
    for (const el of Array.from(nav.querySelectorAll('a, button, li, span'))) {
      const t = textOf(el);
      if (/^\d{1,4}$/.test(t)) max = Math.max(max, Number(t));
    }
  }
  return max > 1 ? max : null;
}

export interface AnalyzeInput {
  doc: Document;
  url: string;
  preset: SitePreset | null;
  generic?: GenericConfig;
  /** Title filter keywords (to show how many jobs on the page would be skipped). */
  exclude?: string[];
}

export function analyzePage({ doc, url, preset, generic, exclude }: AnalyzeInput): PageAnalysis {
  const listing = extractListing({ doc, pageUrl: url, preset, generic });
  const isExcluded = excludeMatcher(exclude ?? []);
  const items = listing.links.length;
  const totalResults = items ? readTotalResults(doc, preset, items) : null;
  const pagination = readTotalPages(doc);
  let totalPages: number | null = null;
  if (items) {
    if (!listing.nextUrl) totalPages = 1;
    else if (totalResults) totalPages = Math.max(1, Math.ceil(totalResults / items));
    else if (pagination) totalPages = pagination;
  }
  let host = '';
  try {
    host = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    /* ignore */
  }
  const confident =
    items > 0 && (Boolean(preset) || Boolean(generic) || detectCardGroups(doc, 1).length > 0);
  return {
    site: preset?.id ?? 'generic',
    siteName: preset?.name ?? host,
    isJobList: items > 0 && !listing.block,
    itemsOnPage: items,
    totalResults,
    totalPages,
    links: listing.links.map((l) => l.url),
    confident,
    excludedOnPage: listing.links.filter((l) => isExcluded(l.hints?.title)).length,
  };
}

/** Estimated run time in seconds: every result page and job page costs one delay + load. */
export function estimateSeconds(
  pages: number,
  jobs: number,
  avgDelaySec: number,
  loadSec = 3,
): number {
  return Math.round((pages + jobs) * (avgDelaySec + loadSec));
}
