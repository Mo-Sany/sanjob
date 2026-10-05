/**
 * Rule-based splitting of a job description into
 * "Ihre Aufgaben" (tasks) / "Ihr Profil" (profile) / "Wir bieten" (offer) / "Sonstiges" (other).
 *
 * A line is a heading when it is short and matches a synonym from sections.config.ts (exactly,
 * or contained when it ends with ":"/"?" or is an <h1>–<h6>/bold line). Headings glued to
 * their text ("Ihre Aufgaben Je nach …") are split. Text before the first heading is the
 * intro ("Beschreibung"); footer lines (contact, e-mail, address, "Ihre Bewerbung") and an
 * unknown <h2> after the sections start "Sonstiges". Every line lands in exactly one part.
 * If no known heading is found at all, every part stays empty.
 */
import {
  BULLET,
  FOOTER_MARKERS,
  SECTION_SYNONYMS,
  WEAK_SYNONYMS,
  type SectionKey,
} from './sections.config';

export interface JobSections {
  /** Text before the first known heading (what "Beschreibung" shows when sections exist). */
  intro: string;
  tasks: string;
  profile: string;
  offer: string;
  other: string;
}

export const EMPTY_SECTIONS: JobSections = {
  intro: '',
  tasks: '',
  profile: '',
  offer: '',
  other: '',
};

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

interface Matcher {
  key: SectionKey;
  phrase: string;
  re: RegExp;
}

function matchersFor(source: Record<SectionKey, string[]>): Matcher[] {
  return (Object.entries(source) as Array<[SectionKey, string[]]>)
    .flatMap(([key, list]) =>
      list.map((phrase) => {
        const p = normalizeHeading(phrase);
        return { key, phrase: p, re: new RegExp(`(^|[^\\p{L}])${escapeRe(p)}($|[^\\p{L}])`, 'u') };
      }),
    )
    .sort((a, b) => b.phrase.length - a.phrase.length);
}

const MATCHERS = matchersFor(SECTION_SYNONYMS);
const WEAK_MATCHERS = matchersFor(WEAK_SYNONYMS);
const FOOTER_RE = new RegExp(
  `^(${FOOTER_MARKERS.map((m) => escapeRe(normalizeHeading(m))).join('|')})($|[^\\p{L}])`,
  'u',
);
const EMAIL_RE = /[\w.+-]+@[\w-]+(\.[\w-]+)+/;
/** German postal code + city ("09456 Annaberg-Buchholz"), not an amount ("45000 Euro"). */
const POSTAL_RE = /(^|[\s,])\d{5}\s+(?!(Euro|EUR|Mitarbeit|Stunden|Kunden)\b)\p{Lu}\p{L}+/u;

/** "Jetzt als Elektroniker (m/w/d) bewerben »" */
const APPLY_RE = /^jetzt\s.{0,100}\bbewerben\b/u;

/** Max length of a heading line. */
const HEADING_MAX = 60;

/**
 * Section for a heading line, or null if it is no heading.
 * A heading is short (≤ 60 chars) and either equals a known phrase, or ends with ":" / "?"
 * (or is structurally a heading, `structural`) and contains a known phrase as whole words.
 * "Warum <Firma>?" counts as "Wir bieten".
 */
export function matchHeading(
  text: string,
  structural = false,
  matchers: Matcher[] = MATCHERS,
): SectionKey | null {
  const t = text.trim();
  if (t.length > HEADING_MAX) return null;
  const n = normalizeHeading(t);
  if (!n) return null;
  for (const m of matchers) if (n === m.phrase) return m.key;
  const marked = /[:：?]\s*$/.test(t);
  if (!marked && !structural) return null;
  if (matchers === MATCHERS && /^(warum|why)\s/.test(n) && /\?\s*$/.test(t)) return 'offer';
  for (const m of matchers) if (m.re.test(n)) return m.key;
  return null;
}

/** A known heading glued to its text on one line: "Ihre Aufgaben Je nach Qualifikation…". */
function gluedHeading(text: string, matchers: Matcher[]): { key: SectionKey; rest: string } | null {
  const t = text.replace(/^[^\p{L}\p{N}]+/u, '');
  const lower = t.toLowerCase();
  for (const m of matchers) {
    if (!lower.startsWith(m.phrase)) continue;
    const after = t.slice(m.phrase.length);
    // "Heading: text" always; "Heading Text" only for "Ihre/Dein … X" noun phrases followed by
    // a capitalized word, so sentences like "Wir bieten Ihnen …" or "Aufgaben wie …" stay text.
    const colon = /^\s*[:：]\s*\S/.exec(after);
    const noun =
      /^(ihr|ihre|dein|deine|unser|your)\s/.test(m.phrase) && /^\s+[\p{Lu}\p{N}]/u.test(after);
    if (colon || noun) return { key: m.key, rest: after.replace(/^\s*[:：]?\s*/, '') };
  }
  return null;
}

/** Contact/footer line: ends the current section. */
export function isFooterLine(text: string): boolean {
  const n = normalizeHeading(text);
  return FOOTER_RE.test(n) || APPLY_RE.test(n) || EMAIL_RE.test(text) || POSTAL_RE.test(text);
}

const isStructural = (line: Line): boolean =>
  (line.tag || line.strong) && !line.bullet && line.text.length <= HEADING_MAX;

type Bucket = SectionKey | 'intro' | 'other';

interface Classified {
  line: Line;
  heading: SectionKey | null;
  weak: SectionKey | null;
  /** Text after a glued heading (null: the whole line is the heading). */
  rest: string | null;
  footer: boolean;
}

function classify(line: Line): Classified {
  const structural = isStructural(line);
  const base = { line, heading: null, weak: null, rest: null, footer: false };
  if (!line.bullet) {
    const heading = matchHeading(line.text, structural);
    if (heading) return { ...base, heading };
  }
  if (isFooterLine(line.text)) return { ...base, footer: true };
  if (line.bullet) return base;
  const glued = gluedHeading(line.text, MATCHERS);
  if (glued) return { ...base, heading: glued.key, rest: glued.rest };
  const weak = matchHeading(line.text, structural, WEAK_MATCHERS);
  if (weak) return { ...base, weak };
  const weakGlued = gluedHeading(line.text, WEAK_MATCHERS);
  if (weakGlued) return { ...base, weak: weakGlued.key, rest: weakGlued.rest };
  return base;
}

/**
 * Splits description lines into intro / tasks / profile / offer / other.
 * intro = text before the first known heading, other = footer (contact, "Ihre Bewerbung"…)
 * after the sections. Every line ends up in exactly one bucket.
 * Without any known heading everything stays empty (the full text is the description).
 */
export function splitLines(lines: Line[]): JobSections {
  const items = lines.map(classify);
  // Weak headings ("Stellenbeschreibung") only count when nothing else opens that section.
  const strong = new Set(items.map((c) => c.heading).filter(Boolean));
  for (const c of items) {
    if (c.weak && !strong.has(c.weak)) c.heading = c.weak;
  }
  if (!items.some((c) => c.heading)) return { ...EMPTY_SECTIONS };

  const buckets: Record<Bucket, Array<{ text: string; bullet: boolean; gap: boolean }>> = {
    intro: [],
    tasks: [],
    profile: [],
    offer: [],
    other: [],
  };
  let current: Bucket = 'intro';
  let newGroup = false;
  const push = (text: string, line: Line): void => {
    const textBullet = TEXT_BULLET.test(text);
    const bullet = line.bullet || textBullet;
    buckets[current].push({
      text: textBullet ? text.replace(TEXT_BULLET, '') : text,
      bullet,
      gap: newGroup || line.gap,
    });
    newGroup = false;
  };

  for (const c of items) {
    if (c.heading) {
      current = c.heading;
      newGroup = true;
      if (c.rest) push(c.rest, { ...c.line, bullet: false, gap: true });
      continue;
    }
    if (current !== 'intro') {
      if (c.footer) {
        if (current !== 'other') newGroup = true;
        current = 'other';
      } else if (c.line.tag && !/[:：]\s*$/.test(c.line.text) && current !== 'other') {
        // An unknown <h2>/<h3> after the sections ("Über uns", "Kontakt") starts the rest.
        current = 'other';
        newGroup = true;
      }
    }
    push(c.line.text, c.line);
  }

  const render = (list: (typeof buckets)[Bucket]): string => {
    let out = '';
    list.forEach((it, i) => {
      const prefix = it.bullet ? BULLET : '';
      if (i > 0) out += it.gap ? '\n\n' : '\n';
      out += prefix + it.text;
    });
    return out.trim();
  };
  return {
    intro: render(buckets.intro),
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
