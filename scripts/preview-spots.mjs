import sharp from 'sharp';
const SPOTS = JSON.parse(process.argv[2]);
const TILE = 620;
const tiles = [];
for (const s of SPOTS) {
  const src = `public/puzzles/${s.id}.jpg`;
  const meta = await sharp(src).metadata();
  const base = await sharp(src).resize(TILE).toBuffer();
  const bm = await sharp(base).metadata();
  const k = bm.width / meta.width;
  const rx = s.cx * k, ry = s.cy * k, rr = Math.max(8, (s.size * k) / 2);
  const svg = Buffer.from(
    `<svg width="${bm.width}" height="${bm.height}">
      <circle cx="${rx}" cy="${ry}" r="${rr * 4}" fill="none" stroke="#ff00ff" stroke-width="3"/>
      <circle cx="${rx}" cy="${ry}" r="${rr}" fill="#00ffff" fill-opacity="0.5" stroke="#00ffff" stroke-width="2"/>
      <text x="8" y="26" font-size="22" fill="#ff00ff" font-family="sans-serif">${s.id}</text>
    </svg>`);
  const overlay = await sharp(svg).resize(bm.width, bm.height, { fit: "fill" }).png().toBuffer();
  const marked = await sharp(base).composite([{ input: overlay, top: 0, left: 0 }]).png().toBuffer();
  tiles.push(await sharp(marked)
    .resize({ width: TILE, height: TILE, fit: 'contain', background: '#111' }).png().toBuffer());
}
const cols = Math.min(4, tiles.length);
const rows = Math.ceil(tiles.length / cols);
await sharp({ create: { width: cols * TILE, height: rows * TILE, channels: 3, background: '#111' } })
  .composite(tiles.map((input, i) => ({ input, left: (i % cols) * TILE, top: Math.floor(i / cols) * TILE })))
  .jpeg({ quality: 78 }).toFile(process.argv[3]);
console.log('wrote', process.argv[3]);
