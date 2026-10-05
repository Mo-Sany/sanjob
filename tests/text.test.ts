import { JSDOM } from 'jsdom';
import { elementText, htmlToText } from '../src/shared/text';

const el = (html: string): Element => {
  const d = new JSDOM(`<div id="r">${html}</div>`).window.document;
  return d.getElementById('r')!;
};

describe('elementText', () => {
  it('keeps paragraphs, list items and line breaks like innerText', () => {
    const text = elementText(
      el(
        '<h2>Aufgaben</h2><ul><li>Planen</li><li>Bauen</li></ul><p>Erste Zeile<br>zweite   Zeile</p><p>Ende</p>',
      ),
    );
    expect(text).toBe('Aufgaben\nPlanen\nBauen\n\nErste Zeile\nzweite Zeile\n\nEnde');
  });

  it('skips scripts, styles and buttons', () => {
    expect(
      elementText(el('<style>.a{}</style>Text<script>x()</script><button>Apply</button>')),
    ).toBe('Text');
  });

  it('keeps umlauts and special characters untouched', () => {
    expect(elementText(el('<p>Größe &amp; Übung – 30 € · ß</p>'))).toBe('Größe & Übung – 30 € · ß');
  });
});

describe('htmlToText', () => {
  it('decodes double-escaped HTML', () => {
    const d = new JSDOM('').window.document;
    expect(htmlToText('&lt;p&gt;Hallo&lt;/p&gt;&lt;p&gt;Welt&lt;/p&gt;', d)).toBe('Hallo\n\nWelt');
  });
});
