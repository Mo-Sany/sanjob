/**
 * "Which job list is under the mouse?" – used by the hover preview and the list picker.
 * On sites with a preset (Indeed, XING, LinkedIn, StepStone) the preset's job cards define the
 * list, so the whole list is found even when the cards sit in several blocks. Elsewhere the
 * sibling-similarity heuristic finds the largest repeating group around the cursor.
 */
import type { SitePreset } from '../presets/types';
import type { GenericConfig } from '../shared/types';
import { detectCardGroups, findListAround } from './generic';
import { listingCards } from './listing';

export interface JobList {
  /** Element that contains all items (used for the big green box). */
  container: Element;
  items: Element[];
  /** CSS selector for the items (only for heuristic lists – presets need none). */
  selector: string | null;
  /** Found via the site preset or the page-wide best list: show "Smart detection". */
  smart: boolean;
  fromPreset: boolean;
}

/** Lowest common ancestor of a set of elements. */
export function commonAncestor(elements: Element[]): Element | null {
  const [first, ...rest] = elements;
  if (!first) return null;
  let cur: Element | null = first;
  while (cur && !rest.every((el) => cur!.contains(el))) cur = cur.parentElement;
  return cur;
}

export interface ListContext {
  doc: Document;
  url: string;
  preset: SitePreset | null;
  generic?: GenericConfig;
}

/** The page's job list according to the preset (or the user's picked list). */
export function presetList(ctx: ListContext): JobList | null {
  if (!ctx.preset && !ctx.generic) return null;
  const cards = listingCards({
    doc: ctx.doc,
    pageUrl: ctx.url,
    preset: ctx.preset,
    generic: ctx.generic,
  }).map((c) => c.card);
  if (cards.length < 2) return null;
  const container = commonAncestor(cards);
  if (!container || container === ctx.doc.body || container === ctx.doc.documentElement) {
    // Cards spread over the whole page: still show them, the box then covers the items only.
    return { container: cards[0]!, items: cards, selector: null, smart: true, fromPreset: true };
  }
  return { container, items: cards, selector: null, smart: true, fromPreset: true };
}

const bestCache = new WeakMap<Document, { at: number; parent: Element | null }>();

/** The page-wide best list (cached for 2 s – this runs on every mouse move). */
function bestGroupCached(doc: Document): { parent: Element } | null {
  const hit = bestCache.get(doc);
  if (hit && Date.now() - hit.at < 2000) return hit.parent ? { parent: hit.parent } : null;
  const parent = detectCardGroups(doc, 1)[0]?.parent ?? null;
  bestCache.set(doc, { at: Date.now(), parent });
  return parent ? { parent } : null;
}

/** The list under `target`, preferring the preset list. */
export function listAt(target: Element, ctx: ListContext, known?: JobList | null): JobList | null {
  const page = known === undefined ? presetList(ctx) : known;
  if (page && (page.container.contains(target) || page.items.some((i) => i.contains(target)))) {
    return page;
  }
  const group = findListAround(target);
  if (!group) return null;
  const top = bestGroupCached(ctx.doc);
  return {
    container: group.parent,
    items: group.cards,
    selector: group.selector,
    smart: top?.parent === group.parent,
    fromPreset: false,
  };
}
