const BLOCK_TAGS = new Set([
  'ADDRESS',
  'ARTICLE',
  'ASIDE',
  'BLOCKQUOTE',
  'DD',
  'DETAILS',
  'DIV',
  'DL',
  'DT',
  'FIELDSET',
  'FIGCAPTION',
  'FIGURE',
  'FOOTER',
  'FORM',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'HEADER',
  'HR',
  'LI',
  'MAIN',
  'NAV',
  'OL',
  'P',
  'PRE',
  'SECTION',
  'SUMMARY',
  'TABLE',
  'TBODY',
  'THEAD',
  'TFOOT',
  'TR',
  'UL',
]);
const CELL_TAGS = new Set(['TD', 'TH']);
const SKIP_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'TEMPLATE',
  'SVG',
  'IFRAME',
  'OBJECT',
  'CANVAS',
  'BUTTON',
  'SELECT',
  'INPUT',
  'TEXTAREA',
]);

/**
 * Converts an element to plain text the way it reads on the page, following the line-break
 * rules of the browser's innerText: block elements start/end a line, <p> is separated by a
 * blank line, <br> breaks a line, table cells are tab-separated. Unlike innerText it does not
 * depend on layout, so it behaves the same in tests and in a minimized browser window.
 */
export function elementText(root: Node | null | undefined): string {
  if (!root) return '';
  // Strings are text; numbers are "at least N line breaks here".
  const out: Array<string | number> = [];
  const walk = (node: Node): void => {
    if (node.nodeType === 3) {
      out.push((node.nodeValue ?? '').replace(/[\t\n\r\f ]+/g, ' '));
      return;
    }
    if (node.nodeType !== 1 && node.nodeType !== 9 && node.nodeType !== 11) return;
    const el = node as Element;
    const tag = el.tagName?.toUpperCase() ?? '';
    // Skip non-content descendants (the root itself is always read, e.g. a <button> pill).
    if (node !== root && SKIP_TAGS.has(tag)) return;
    if (tag === 'BR') {
      out.push('\n');
      return;
    }
    const breaks = tag === 'P' ? 2 : BLOCK_TAGS.has(tag) ? 1 : 0;
    if (breaks) out.push(breaks);
    if (tag === 'PRE') {
      out.push((el.textContent ?? '').replace(/ /g, '\u00a0'));
    } else {
      for (const child of Array.from(node.childNodes)) walk(child);
    }
    if (CELL_TAGS.has(tag)) out.push('\t');
    if (breaks) out.push(breaks);
  };
  walk(root);

  let text = '';
  let pending = 0;
  for (const part of out) {
    if (typeof part === 'number') {
      pending = Math.max(pending, part);
      continue;
    }
    if (pending && !part.trim()) continue;
    if (pending) {
      if (text) text += '\n'.repeat(pending);
      pending = 0;
    }
    text += part;
  }
  return tidy(text);
}

/** Normalizes whitespace while keeping paragraph structure. */
export function tidy(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\u00a0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Single-line text (for short fields like title or company). */
export function oneLine(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

/** Parses an HTML fragment (e.g. a JSON-LD description) into an inert fragment. */
export function htmlToFragment(html: string, doc: Document): DocumentFragment {
  const parse = (source: string): DocumentFragment => {
    const tpl = doc.createElement('template');
    tpl.innerHTML = source;
    return tpl.content;
  };
  const first = parse(html);
  // Some sites HTML-escape the markup twice ("&lt;p&gt;"); decode once more in that case.
  const text = first.textContent ?? '';
  return /<\/?(p|br|ul|li|div|strong|b|h\d)\b[^>]*>/i.test(text) ? parse(text) : first;
}

/** Converts an HTML fragment (e.g. JSON-LD description) to plain text. */
export function htmlToText(html: string, doc: Document): string {
  if (!/[<&]/.test(html)) return tidy(html);
  return elementText(htmlToFragment(html, doc));
}
