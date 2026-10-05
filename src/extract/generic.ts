/**
 * Generic fallback for job boards without a preset:
 * finds repeating "job cards" via sibling similarity, and helpers for the element picker.
 */
import { elementText, oneLine } from '../shared/text';

const IGNORED_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'TEMPLATE',
  'SVG',
  'HEAD',
  'OPTION',
  'SELECT',
]);

function classSet(el: Element): Set<string> {
  return new Set(
    Array.from(el.classList).filter((c) => !/^(active|selected|highlight|is-|has-|vjs-)/i.test(c)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

/** Two siblings look alike: same tag and mostly the same classes. */
export function similar(a: Element, b: Element): boolean {
  return a.tagName === b.tagName && jaccard(classSet(a), classSet(b)) >= 0.5;
}

/** Best link of a card: the card itself, a link inside a heading, or the link with most text. */
export function cardLink(card: Element, linkSelector?: string): HTMLAnchorElement | null {
  if (linkSelector) {
    try {
      const el = card.matches(linkSelector) ? card : card.querySelector(linkSelector);
      const a = el?.closest('a[href]') ?? el?.querySelector('a[href]');
      if (a) return a as HTMLAnchorElement;
    } catch {
      /* invalid selector */
    }
  }
  if (card.matches('a[href]')) return card as HTMLAnchorElement;
  const anchors = Array.from(card.querySelectorAll<HTMLAnchorElement>('a[href]')).filter((a) => {
    const href = a.getAttribute('href') ?? '';
    return href && !href.startsWith('#') && !/^(javascript|mailto|tel):/i.test(href);
  });
  const inHeading = anchors.find(
    (a) => a.closest('h1,h2,h3,h4,h5') || a.querySelector('h1,h2,h3,h4,h5'),
  );
  if (inHeading) return inHeading;
  return (
    anchors.sort((x, y) => oneLine(y.textContent).length - oneLine(x.textContent).length)[0] ?? null
  );
}

function escapeCss(s: string): string {
  return typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(s) : s.replace(/([^\w-])/g, '\\$1');
}

/** A reasonably stable CSS path to `el` (ids when unique and not auto-generated). */
export function cssPath(el: Element): string {
  const parts: string[] = [];
  let cur: Element | null = el;
  while (cur && cur.tagName !== 'HTML' && cur.tagName !== 'BODY') {
    const id = cur.id;
    if (
      id &&
      !/\d{3,}|[:.]/.test(id) &&
      cur.ownerDocument.querySelectorAll(`#${escapeCss(id)}`).length === 1
    ) {
      parts.unshift(`#${escapeCss(id)}`);
      break;
    }
    const tag = cur.tagName.toLowerCase();
    const parent: Element | null = cur.parentElement;
    if (!parent) {
      parts.unshift(tag);
      break;
    }
    const sameTag = Array.from(parent.children).filter((c) => c.tagName === cur!.tagName);
    parts.unshift(sameTag.length > 1 ? `${tag}:nth-of-type(${sameTag.indexOf(cur) + 1})` : tag);
    cur = parent;
  }
  if (parts.length && !parts[0]!.startsWith('#')) parts.unshift('body');
  return parts.join(' > ');
}

/** Selector that matches `cards` (siblings under one parent). */
export function selectorForCards(parent: Element, cards: Element[]): string {
  const first = cards[0];
  if (!first) return '';
  const common = Array.from(classSet(first)).filter((c) =>
    cards.every((k) => k.classList.contains(c)),
  );
  const tag = first.tagName.toLowerCase();
  const own =
    tag +
    common
      .slice(0, 3)
      .map((c) => `.${escapeCss(c)}`)
      .join('');
  return `${cssPath(parent)} > ${own}`;
}

export interface CardGroup {
  parent: Element;
  cards: Element[];
  selector: string;
  score: number;
}

/**
 * Sibling-similarity heuristic: the parent whose children are the largest group of similar
 * elements that each contain a link with text is most likely the result list.
 */
export function detectCardGroups(doc: Document, limit = 5): CardGroup[] {
  const groups: CardGroup[] = [];
  for (const parent of Array.from(doc.body?.querySelectorAll('*') ?? [])) {
    if (IGNORED_TAGS.has(parent.tagName) || parent.childElementCount < 3) continue;
    const children = Array.from(parent.children).filter((c) => !IGNORED_TAGS.has(c.tagName));
    let bestCluster: Element[] = [];
    const seen = new Set<Element>();
    for (const c of children) {
      if (seen.has(c)) continue;
      const cluster = children.filter((x) => similar(c, x));
      cluster.forEach((x) => seen.add(x));
      if (cluster.length > bestCluster.length) bestCluster = cluster;
    }
    if (bestCluster.length < 3) continue;
    const withLinks = bestCluster.filter((card) => {
      const a = cardLink(card);
      return a !== null && oneLine(a.textContent).length >= 5;
    });
    if (withLinks.length < 3 || withLinks.length < bestCluster.length * 0.6) continue;
    const avgText =
      withLinks.reduce((sum, card) => sum + Math.min(oneLine(card.textContent).length, 600), 0) /
      withLinks.length;
    if (avgText < 20) continue;
    // Nav menus have short items; job cards have title + company + location.
    const score = withLinks.length * Math.log(avgText);
    groups.push({ parent, cards: withLinks, selector: selectorForCards(parent, withLinks), score });
  }
  return groups.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** From a clicked element, walk up to the first ancestor that repeats among its siblings. */
export function cardFromPicked(
  el: Element,
): { card: Element; selector: string; count: number } | null {
  let cur: Element | null = el;
  while (cur && cur.parentElement && cur.tagName !== 'BODY') {
    const parent: Element = cur.parentElement;
    const siblings = Array.from(parent.children).filter((c) => similar(c, cur!));
    if (siblings.length >= 3 && cardLink(cur)) {
      const selector = selectorForCards(parent, siblings);
      return { card: cur, selector, count: siblings.length };
    }
    cur = parent;
  }
  return null;
}

/** Generic "next page" control. */
export function genericNext(doc: Document): Element | null {
  const rel = doc.querySelector('a[rel="next"][href], link[rel="next"][href]');
  if (rel) return rel;
  const re = /^(next|next page|weiter|nächste|nächste seite|›|»|>|→)$/i;
  for (const el of Array.from(doc.querySelectorAll('a[href], button'))) {
    const label = oneLine(el.getAttribute('aria-label') ?? el.textContent);
    if (
      re.test(label) &&
      !el.hasAttribute('disabled') &&
      el.getAttribute('aria-disabled') !== 'true'
    ) {
      return el;
    }
  }
  return null;
}

/** Generic description: the longest text block among likely containers. */
export function genericDescription(doc: Document): string {
  const candidates = Array.from(
    doc.querySelectorAll(
      '[class*="description" i], [id*="description" i], [class*="job-detail" i], [itemprop="description"], article, main',
    ),
  );
  let best = '';
  for (const el of candidates) {
    const text = elementText(el);
    if (text.length > best.length) best = text;
  }
  return best;
}
