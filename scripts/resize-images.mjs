import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
const OUT = 'public/puzzles';
mkdirSync(OUT, { recursive: true });
const files = ['mona:.source-images/mona.jpg','wave:.source-images/wave.jpg','starry:.source-images/starry.jpg','boating:.source-images/boating.jpg','jatte:.source-images/jatte.jpg','issus:.source-images/issus.jpg','hunters:.source-images/hunters.jpg','babel:.source-images/babel.jpg','deheem:.source-images/deheem.jpg','venice:.source-images/venice.jpg'];
const MAX = 2600;

/**
 * Which paintings to (re)generate. Named on the command line -- `npm run images -- venice`
 * -- and every painting only when none is named.
 *
 * The filter is not a convenience. `.source-images/` is gitignored, so there is no
 * guarantee the scan sitting there is the one a shipped asset was made from; a local copy
 * that is a different crop or a different scan regenerates that painting at different
 * pixels and silently moves every hiding place in its week. Regenerating one painting to
 * add it should not be able to touch the other nine, so name the one you mean.
 */
const only = process.argv.slice(2);
const chosen = only.length ? files.filter((f) => only.includes(f.split(':')[0])) : files;
const missing = only.filter((n) => !files.some((f) => f.split(':')[0] === n));
if (missing.length) throw new Error(`no such painting: ${missing.join(', ')}`);

for (const f of chosen) {
  const [name, src] = f.split(':');
  const img = sharp(src, { limitInputPixels: false }).rotate();
  const meta = await img.metadata();
  const w = Math.min(meta.width, MAX);
  const info = await sharp(src, { limitInputPixels: false }).rotate().resize({ width: w, withoutEnlargement: true })
    .jpeg({ quality: 76, mozjpeg: true }).toFile(`${OUT}/${name}.jpg`);
  console.log(`${name}: ${meta.width}x${meta.height} -> ${info.width}x${info.height} (${(info.size/1024).toFixed(0)} KB)`);
}
