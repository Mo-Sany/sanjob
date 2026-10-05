// Packs dist/ into sanjob-<version>.zip for the Chrome Web Store upload.
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { zipSync } from 'fflate';

const root = new URL('..', import.meta.url).pathname;
const dist = join(root, 'dist');
const { version } = JSON.parse(readFileSync(join(dist, 'manifest.json'), 'utf8'));
const files = {};
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (!name.endsWith('.map') && name !== '.DS_Store') {
      files[relative(dist, path).split('\\').join('/')] = readFileSync(path);
    }
  }
};
walk(dist);
const out = join(root, `sanjob-${version}.zip`);
writeFileSync(out, zipSync(files, { level: 9 }));
console.log(`${relative(root, out)} – ${Object.keys(files).length} files`);
