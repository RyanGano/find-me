import sharp from 'sharp';
import { mkdirSync, readdirSync } from 'node:fs';

/**
 * Small copies of the shipped paintings, for the gallery wall in the stats panel.
 *
 * Made from the committed 2600px assets in `public/puzzles/`, not from `.source-images/`:
 * the scans are deleted once a painting ships, so the asset is the only copy of every
 * painting that is guaranteed to still be here. A thumbnail is only ever looked at, never
 * hunted in, so nothing about its pixels has to line up with a hiding place.
 *
 *   npm run thumbs             every painting
 *   npm run thumbs -- venice   one
 */
const IN = 'public/puzzles';
const OUT = 'public/puzzles/thumbs';
/** Wide enough to fill the panel on a phone at 2x without looking soft. */
const WIDTH = 480;

mkdirSync(OUT, { recursive: true });
const all = readdirSync(IN).filter((f) => f.endsWith('.jpg')).map((f) => f.slice(0, -4));
const only = process.argv.slice(2);
const missing = only.filter((n) => !all.includes(n));
if (missing.length) throw new Error(`no such painting: ${missing.join(', ')}`);

for (const name of only.length ? only : all) {
  const info = await sharp(`${IN}/${name}.jpg`)
    .resize({ width: WIDTH, withoutEnlargement: true })
    .jpeg({ quality: 72, mozjpeg: true })
    .toFile(`${OUT}/${name}.jpg`);
  console.log(`${name}: ${info.width}x${info.height} (${(info.size / 1024).toFixed(0)} KB)`);
}
