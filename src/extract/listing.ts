import type { ListingPreset, SitePreset } from '../presets/types';
import { normalizeDate } from '../shared/date';
import { oneLine } from '../shared/text';
import type { GenericConfig, JobHints, ListingLink, ListingResult } from '../shared/types';
import { canonicalJobUrl, normalizeUrl } from '../shared/url';
import { detectBlock } from './block';
import { readFields } from './fields';
import { cardLink, detectCardGroups, genericNext } from './generic';

function queryAll(root: ParentNode, selector: string): Element[] {
  try {
    return Array.from(root.querySelectorAll(selector));
  } catch {
    return [];
  }
}

function toAbsolute(href: string | null | undefined, base: string): string | null {
  if (!href || /^(javascript|mailto|tel):/i.test(href) || href.startsWith('#')) return null;
  try {
    const u = new URL(href, base);
    return /^https?:$/.test(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
}

function hintsFrom(card: Element | null, preset: ListingPreset, now: Date): JobHints | undefined {
  if (!card || !preset.cardFields) return undefined;
  const fields = readFields(card, preset.cardFields) as JobHints;
  if (fields.datePosted) fields.datePosted = normalizeDate(fields.datePosted, now);
  return Object.keys(fields).length ? fields : undefined;
}

function linkUrl(el: Element, preset: ListingPreset, base: string): string | null {
  const idAttrs = preset.idAttr ? [preset.idAttr].flat() : [];
  for (const ia of idAttrs) {
    const sel = `[${ia.attr}]`;
    const holder = el.matches(sel) ? el : (el.closest(sel) ?? el.querySelector(sel));
    let id = holder?.getAttribute(ia.attr) ?? null;
    if (id && ia.match) id = new RegExp(ia.match).exec(id)?.[1] ?? null;
    if (id && /^[\w-]+$/.test(id)) return toAbsolute(ia.template.replace('{id}', id), base);
  }
  const anchor = el.closest('a[href]') ?? (el.matches('[href]') ? el : el.querySelector('a[href]'));
  return toAbsolute(anchor?.getAttribute('href'), base);
}

function pageParamUrl(pageUrl: string, pp: NonNullable<ListingPreset['pageParam']>): string {
  const u = new URL(pageUrl);
  const current = Number(u.searchParams.get(pp.name) ?? pp.first);
  u.searchParams.set(pp.name, String((Number.isFinite(current) ? current : pp.first) + pp.step));
  return u.href;
}

function usesPageParam(pageUrl: string, pp: NonNullable<ListingPreset['pageParam']>): boolean {
  if (!pp.path) return true;
  try {
    return new RegExp(pp.path, 'i').test(new URL(pageUrl).pathname);
  } catch {
    return false;
  }
}

function isDisabled(el: Element): boolean {
  return (
    el.hasAttribute('disabled') ||
    el.getAttribute('aria-disabled') === 'true' ||
    /\bdisabled\b/i.test(el.getAttribute('class') ?? '')
  );
}

function findNext(
  doc: Document,
  pageUrl: string,
  preset: ListingPreset | null,
): { nextUrl: string | null; nextIsClick: boolean } {
  let el: Element | null = null;
  if (preset) {
    for (const sel of preset.next) {
      el = queryAll(doc, sel).find((e) => !isDisabled(e)) ?? null;
      if (el) break;
    }
  } else {
    el = genericNext(doc);
  }
  if (el) {
    const href = toAbsolute(el.getAttribute('href'), pageUrl);
    if (href && href !== pageUrl) return { nextUrl: href, nextIsClick: false };
    if (preset?.pageParam && usesPageParam(pageUrl, preset.pageParam))
      return { nextUrl: pageParamUrl(pageUrl, preset.pageParam), nextIsClick: false };
    return { nextUrl: pageUrl, nextIsClick: true };
  }
  if (preset?.pageParam?.always && usesPageParam(pageUrl, preset.pageParam)) {
    return { nextUrl: pageParamUrl(pageUrl, preset.pageParam), nextIsClick: false };
  }
  return { nextUrl: null, nextIsClick: false };
}

export interface ListingInput {
  doc: Document;
  pageUrl: string;
  preset: SitePreset | null;
  generic?: GenericConfig;
  now?: Date;
}

export interface ListingCard {
  /** Canonical job URL. */
  url: string;
  /** De-duplication key (same as the queue/history key). */
  key: string;
  /** The element that represents the job on the page (card, or the link itself). */
  card: Element;
  hints?: JobHints;
}

/** Every job on a results page with its card element, in document order, without duplicates. */
export function listingCards(input: ListingInput): ListingCard[] {
  const { doc, pageUrl, preset } = input;
  const now = input.now ?? new Date();
  const seen = new Set<string>();
  const out: ListingCard[] = [];
  const add = (url: string | null, card: Element, hints: JobHints | undefined): void => {
    if (!url) return;
    const canonical = canonicalJobUrl(url);
    const key = normalizeUrl(canonical);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(hints ? { url: canonical, key, card, hints } : { url: canonical, key, card });
  };

  // A list the user picked manually wins over the preset's link selectors.
  if (preset && !input.generic) {
    const lp = preset.listing;
    const pattern = lp.jobUrlPattern ? new RegExp(lp.jobUrlPattern, 'i') : null;
    for (const sel of lp.links) {
      for (const el of queryAll(doc, sel)) {
        const url = linkUrl(el, lp, pageUrl);
        if (!url || (pattern && !pattern.test(url))) continue;
        const card = lp.card ? el.closest(lp.card) : null;
        add(url, card ?? el, hintsFrom(card, lp, now));
      }
    }
  } else {
    let cards: Element[] = [];
    if (input.generic?.cardSelector) cards = queryAll(doc, input.generic.cardSelector);
    if (!cards.length) cards = detectCardGroups(doc, 1)[0]?.cards ?? [];
    for (const card of cards) {
      const a = cardLink(card, input.generic?.linkSelector);
      const url = toAbsolute(a?.getAttribute('href'), pageUrl);
      const title = oneLine(a?.textContent);
      add(url, card, title ? { title } : undefined);
    }
  }
  return out;
}

/** Collects job links (+ card hints) and the next-page target from a results page. */
export function extractListing(input: ListingInput): ListingResult {
  const { doc, pageUrl, preset } = input;
  const links: ListingLink[] = listingCards(input).map(({ url, hints }) =>
    hints ? { url, hints } : { url },
  );

  const block = detectBlock(doc, pageUrl, preset?.block, links.length > 0);
  const next = links.length
    ? findNext(doc, pageUrl, preset?.listing ?? null)
    : { nextUrl: null, nextIsClick: false };
  return { links: block ? [] : links, ...next, block };
}

/** Clicks the next/load-more control (used when it has no href). Returns true when clicked. */
export function clickNext(doc: Document, preset: SitePreset | null): boolean {
  const selectors = preset ? preset.listing.next : [];
  for (const sel of selectors) {
    const el = queryAll(doc, sel).find((e) => !isDisabled(e));
    if (el instanceof HTMLElement) {
      el.scrollIntoView?.({ block: 'center' });
      el.click();
      return true;
    }
  }
  const generic = genericNext(doc);
  if (generic instanceof HTMLElement) {
    generic.click();
    return true;
  }
  return false;
}
