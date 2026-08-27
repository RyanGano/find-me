import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
const OUT = 'public/puzzles';
mkdirSync(OUT, { recursive: true });
const files = ['mona:.source-images/mona.jpg','wave:.source-images/wave.jpg','starry:.source-images/starry.jpg','proverbs:.source-images/proverbs.jpg','jatte:.source-images/jatte.jpg','athens:.source-images/athens.jpg','hunters:.source-images/hunters.jpg','babel:.source-images/babel.jpg'];
const MAX = 2600;
for (const f of files) {
  const [name, src] = f.split(':');
  const img = sharp(src, { limitInputPixels: false }).rotate();
  const meta = await img.metadata();
  const w = Math.min(meta.width, MAX);
  const info = await sharp(src, { limitInputPixels: false }).rotate().resize({ width: w, withoutEnlargement: true })
    .jpeg({ quality: 76, mozjpeg: true }).toFile(`${OUT}/${name}.jpg`);
  console.log(`${name}: ${meta.width}x${meta.height} -> ${info.width}x${info.height} (${(info.size/1024).toFixed(0)} KB)`);
}
