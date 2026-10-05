import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';

export function loadFixture(path: string, url = 'https://example.com/'): Document {
  const html = readFileSync(resolve(__dirname, '../../fixtures', path), 'utf8');
  return new JSDOM(html, { url }).window.document;
}
