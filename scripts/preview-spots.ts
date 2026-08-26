/**
 * Render candidate hiding places onto a painting using the real shape geometry, fill
 * and blend mode, so camouflage can be judged before it ships.
 *
 * Run through vite-node so it can import the game's own shape registry:
 *   npx vite-node scripts/preview-spots.ts -- '[{"id":"mona","shape":"snowflake",...}]' out.jpg
 *
 * Each tile shows the spot at three zooms: the fitted view (can you not see it?),
 * a mid zoom, and the matched size (can you see it once you are there?).
 */
import sharp from 'sharp';
import { getShape } from '../src/game/shapes';

interface Spot {
  id: string;
  shape: string;
  cx: number;
  cy: number;
  size: number;
  angle: number;
  fill: string;
  opacity: number;
  blend: string;
}

const spots: Spot[] = JSON.parse(process.argv[2]);
const out = process.argv[3];

const TILE = 660;
const ZOOMS = [
  { label: 'fitted', crop: 0 },
  { label: 'mid', crop: 900 },
  { label: 'matched', crop: 330 },
];

const rows: Buffer[] = [];

for (const spot of spots) {
  const src = `public/puzzles/${spot.id}.jpg`;
  const meta = await sharp(src).metadata();
  const def = getShape(spot.shape);

  // Paint the shape into the full-size image exactly as the app layers it.
  const overlay = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${meta.width}" height="${meta.height}">` +
      `<g transform="translate(${spot.cx} ${spot.cy}) rotate(${spot.angle}) scale(${spot.size / 100}) translate(-50 -50)">` +
      `<path d="${def.path}" fill="${spot.fill}" fill-rule="${def.fillRule ?? 'evenodd'}" ` +
      `fill-opacity="${spot.opacity}"/></g></svg>`,
  );
  const composed = await sharp(src)
    .composite([{ input: overlay, blend: spot.blend === 'screen' ? 'screen' : 'multiply' }])
    .toBuffer();

  const tiles: Buffer[] = [];
  for (const zoom of ZOOMS) {
    let tile: Buffer;
    if (zoom.crop === 0) {
      tile = await sharp(composed)
        .resize({ width: TILE, height: TILE, fit: 'contain', background: '#111' })
        .png()
        .toBuffer();
    } else {
      const half = zoom.crop;
      const left = Math.max(0, Math.min(meta.width! - half * 2, Math.round(spot.cx - half)));
      const top = Math.max(0, Math.min(meta.height! - half * 2, Math.round(spot.cy - half)));
      tile = await sharp(composed)
        .extract({ left, top, width: half * 2, height: half * 2 })
        .resize({ width: TILE, height: TILE, fit: 'contain', background: '#111' })
        .png()
        .toBuffer();
    }
    const caption = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE}" height="${TILE}">` +
        `<text x="10" y="26" font-size="20" fill="#ff00ff" font-family="sans-serif">` +
        `${spot.id} / ${spot.shape} / ${zoom.label}</text></svg>`,
    );
    tiles.push(await sharp(tile).composite([{ input: caption, top: 0, left: 0 }]).png().toBuffer());
  }

  rows.push(
    await sharp({ create: { width: TILE * 3, height: TILE, channels: 3, background: '#111' } })
      .composite(tiles.map((input, i) => ({ input, left: i * TILE, top: 0 })))
      .png()
      .toBuffer(),
  );
}

await sharp({ create: { width: TILE * 3, height: TILE * rows.length, channels: 3, background: '#111' } })
  .composite(rows.map((input, i) => ({ input, left: 0, top: i * TILE })))
  .jpeg({ quality: 80 })
  .toFile(out);

console.log('wrote', out);
