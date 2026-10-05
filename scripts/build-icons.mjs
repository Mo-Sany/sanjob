// Renders public/icons/icon.svg to the PNG sizes Chrome needs.
import { readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const svg = readFileSync(new URL('../public/icons/icon.svg', import.meta.url), 'utf8');
for (const size of [16, 32, 48, 128]) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  writeFileSync(new URL(`../public/icons/icon${size}.png`, import.meta.url), png);
  console.log(`icon${size}.png`);
}
