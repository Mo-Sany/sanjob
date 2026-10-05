/**
 * Rule-based splitting of a job description into
 * "Ihre Aufgaben" (tasks) / "Ihr Profil" (profile) / "Wir bieten" (offer) / "Sonstiges" (other).
 *
 * Works on the HTML structure: headings (h1–h6), lines that are entirely <strong>/<b>,
 * short lines ending with ":" and ALL-CAPS lines are heading candidates. A heading candidate
 * whose text matches a synonym from sections.config.ts opens that section; any other heading
 * opens "Sonstiges". Text before the first heading also goes to "Sonstiges".
 * If no known heading is found at all, every section stays empty.
 */
import { BULLET, SECTION_SYNONYMS, type SectionKey } from './sections.config';

export interface JobSections {
  tasks: string;
  profile: string;
  offer: string;
  other: string;
}

export const EMPTY_SECTIONS: JobSections = { tasks: '', profile: '', offer: '', other: '' };

/** One visual line of the description. */
export interface Line {
  text: string;
  /** Came from <h1>–<h6>. */
  tag: boolean;
  /** Every visible character is inside <strong>/<b>. */
  strong: boolean;
  /** Starts a list item (or a "- " / "• " text bullet). */
  bullet: boolean;
  /** A blank line separates it from the previous line (new paragraph/block). */
  gap: boolean;
}

const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'BUTTON', 'IFRAME']);
const BLOCK = new Set([
  'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DD', 'DIV', 'DL', 'DT', 'FIGURE', 'FOOTER',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER', 'HR', 'LI', 'MAIN', 'OL', 'P', 'PRE',
  'SECTION', 'TABLE', 'TR', 'UL',
]); // prettier-ignore
const HEADING_TAGS = /^H[1-6]$/;
const BOLD_TAGS = new Set(['STRONG', 'B']);
const TEXT_BULLET = /^\s*([-*•–·▪●◦‣]|\d{1,2}[.)])\s+/;

interface Piece {
  text: string;
  bold: boolean;
  heading: boolean;
}

/** Converts description HTML into lines, remembering bold/heading/bullet structure. */
export function linesFromElement(root: Node): Line[] {
  const lines: Line[] = [];
  let pieces: Piece[] = [];
  let pendingBullet = false;
  let pendingGap = false;

  const flush = (gapAfter = false): void => {
    const text = pieces
      .map((p) => p.text)
      .join('')
      .replace(/\s+/g, ' ')
      .trim();
    if (text) {
      const visible = pieces.filter((p) => p.text.trim());
      lines.push({
        text,
        tag: visible.every((p) => p.heading),
        strong: visible.every((p) => p.bold || p.heading),
        bullet: pendingBullet,
        gap: pendingGap && lines.length > 0,
      });
      pendingBullet = false;
      pendingGap = false;
    }
    pieces = [];
    if (gapAfter) pendingGap = true;
  };

  const walk = (node: Node, bold: boolean, heading: boolean): void => {
    if (node.nodeType === 3) {
      pieces.push({ text: node.nodeValue ?? '', bold, heading });
      return;
    }
    if (node.nodeType !== 1 && node.nodeType !== 11) return;
    const el = node as Element;
    const tag = el.tagName?.toUpperCase() ?? '';
    if (SKIP.has(tag)) return;
    if (tag === 'BR') {
      flush();
      return;
    }
    const block = BLOCK.has(tag);
    const isHeading = heading || HEADING_TAGS.test(tag);
    const isBold = bold || BOLD_TAGS.has(tag) || isBoldStyle(el);
    if (block) flush(tag === 'P' || isHeading);
    if (tag === 'LI') pendingBullet = true;
    for (const child of Array.from(node.childNodes)) walk(child, isBold, isHeading);
    if (block) flush(tag === 'P' || isHeading || tag === 'UL' || tag === 'OL');
  };
  walk(root, false, false);
  flush();
  return lines;
}

function isBoldStyle(el: Element): boolean {
  const w = (el as HTMLElement).style?.fontWeight;
  return w === 'bold' || (Number(w) >= 600 && Number(w) <= 1000);
}

/** Plain-text fallback (e.g. a JSON-LD description without markup). */
export function linesFromText(text: string): Line[] {
  const out: Line[] = [];
  let gap = false;
  for (const raw of text.split('\n')) {
    const t = raw.replace(/\s+/g, ' ').trim();
    if (!t) {
      gap = out.length > 0;
      continue;
    }
    out.push({ text: t, tag: false, strong: false, bullet: false, gap });
    gap = false;
  }
  return out;
}

/** Lowercase, no trailing colon/punctuation, no leading bullets or emoji, single spaces. */
export function normalizeHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .replace(/[\s:：.!?\-–—]+$/u, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const MATCHERS: Array<{ key: SectionKey; phrase: string; re: RegExp }> = (
  Object.entries(SECTION_SYNONYMS) as Array<[SectionKey, string[]]>
)
  .flatMap(([key, list]) =>
    list.map((phrase) => {
      const p = normalizeHeading(phrase);
      return { key, phrase: p, re: new RegExp(`(^|[^\\p{L}])${escapeRe(p)}($|[^\\p{L}])`, 'u') };
    }),
  )
  .sort((a, b) => b.phrase.length - a.phrase.length);

/** Section for a heading text, or null if it is not a known heading. */
export function matchHeading(text: string): SectionKey | null {
  const n = normalizeHeading(text);
  if (!n) return null;
  for (const m of MATCHERS) if (n === m.phrase) return m.key;
  // Contained phrase: only for short headings, so normal sentences never switch sections.
  if (n.split(' ').length > 8) return null;
  for (const m of MATCHERS) if (m.re.test(n)) return m.key;
  return null;
}

const words = (s: string): number => s.split(/\s+/).filter(Boolean).length;

function isAllCaps(text: string): boolean {
  const letters = text.replace(/[^\p{L}]/gu, '');
  return (
    letters.length >= 3 && letters === letters.toUpperCase() && letters !== letters.toLowerCase()
  );
}

/** Does this line look like a heading (independent of its wording)? */
export function isHeadingLike(line: Line): boolean {
  const t = line.text;
  if (t.length > 100 || line.bullet) return false;
  if (line.tag && words(t) <= 12) return true;
  if (line.strong && words(t) <= 10) return true;
  if (/[:：]\s*$/.test(t) && t.length <= 70 && words(t) <= 9) return true;
  if (isAllCaps(t) && words(t) <= 6) return true;
  return false;
}

type Bucket = SectionKey | 'other';

/** Splits description lines into the four sections. */
export function splitLines(lines: Line[]): JobSections {
  const buckets: Record<Bucket, Array<{ text: string; bullet: boolean; gap: boolean }>> = {
    tasks: [],
    profile: [],
    offer: [],
    other: [],
  };
  let current: Bucket = 'other';
  let foundKnown = false;
  let newGroup = false;

  for (const line of lines) {
    const known = matchHeading(line.text);
    const headingLike = isHeadingLike(line);
    // A known heading phrase on its own line counts even without bold/colon ("Ihr Profil").
    const exactKnown = known !== null && normalizeHeading(line.text).split(' ').length <= 5;
    if (known && (headingLike || exactKnown)) {
      current = known;
      foundKnown = true;
      newGroup = true;
      continue;
    }
    if (headingLike) {
      // Unknown heading (e.g. "Über uns"): its text and what follows go to "Sonstiges".
      current = 'other';
      buckets.other.push({ text: line.text, bullet: false, gap: true });
      newGroup = false;
      continue;
    }
    const textBullet = TEXT_BULLET.test(line.text);
    const bullet = line.bullet || textBullet;
    const text = textBullet ? line.text.replace(TEXT_BULLET, '') : line.text;
    buckets[current].push({ text, bullet, gap: newGroup || line.gap });
    newGroup = false;
  }

  if (!foundKnown) return { ...EMPTY_SECTIONS };
  const render = (items: (typeof buckets)[Bucket]): string => {
    let out = '';
    items.forEach((it, i) => {
      const prefix = it.bullet ? BULLET : '';
      if (i > 0) out += it.gap ? '\n\n' : '\n';
      out += prefix + it.text;
    });
    return out.trim();
  };
  return {
    tasks: render(buckets.tasks),
    profile: render(buckets.profile),
    offer: render(buckets.offer),
    other: render(buckets.other),
  };
}

/** Splits a description element (preferred) or plain text into sections. */
export function splitSections(source: Node | string | null | undefined): JobSections {
  if (!source) return { ...EMPTY_SECTIONS };
  const lines = typeof source === 'string' ? linesFromText(source) : linesFromElement(source);
  return splitLines(lines);
}
