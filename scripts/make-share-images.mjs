/**
 * The pictures the site is known by outside itself: the preview card a link unfurls into,
 * and the icons a phone puts on its home screen.
 *
 * Drawn from files already in the repository -- the favicon and one painting asset, which
 * carries no shape of its own -- so they can be remade whenever either changes.
 *
 * Usage: npm run share-images
 */
import sharp from 'sharp';
import { readFileSync } from 'node:fs';

const PUBLIC = 'public';
const favicon = readFileSync(`${PUBLIC}/favicon.svg`);

// ---- icons -----------------------------------------------------------------------------

for (const [file, size] of [
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
]) {
  await sharp(favicon, { density: (72 * size) / 100 }).resize(size, size).png().toFile(`${PUBLIC}/${file}`);
}

// A maskable icon is cropped to a circle or squircle by the launcher, so the mark sits
// inside the middle 80% on a full-bleed ground.
{
  const size = 512;
  const inner = Math.round(size * 0.8);
  const mark = await sharp(favicon, { density: (72 * inner) / 100 }).resize(inner, inner).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: '#12100e' } })
    .composite([{ input: mark, left: (size - inner) / 2, top: (size - inner) / 2 }])
    .png()
    .toFile(`${PUBLIC}/icon-maskable-512.png`);
}

// ---- link preview ----------------------------------------------------------------------

const W = 1200;
const H = 630;

const painting = await sharp(`${PUBLIC}/puzzles/starry.jpg`)
  .resize(W, H, { fit: 'cover', position: 'centre' })
  .toBuffer();

const iconSize = 132;
const icon = await sharp(favicon, { density: (72 * iconSize) / 100 }).resize(iconSize, iconSize).png().toBuffer();

const overlay = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="fade" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="#12100e" stop-opacity="0.94"/>
      <stop offset="0.55" stop-color="#12100e" stop-opacity="0.78"/>
      <stop offset="1" stop-color="#12100e" stop-opacity="0.15"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#fade)"/>
  <text x="84" y="330" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="112"
        font-weight="700" fill="#f0e9df">Find Me</text>
  <text x="88" y="410" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="40"
        fill="#e8b647">A daily puzzle in a famous painting</text>
  <text x="88" y="466" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="32"
        fill="#a39a8d">Find the hidden shape. Match its size and angle.</text>
</svg>`);

await sharp(painting)
  .composite([
    { input: overlay, left: 0, top: 0 },
    { input: icon, left: 84, top: 104 },
  ])
  // A photograph of a painting: JPEG keeps it small enough for every link unfurler.
  .jpeg({ quality: 84, mozjpeg: true })
  .toFile(`${PUBLIC}/og.jpg`);

console.log('wrote og.jpg, apple-touch-icon.png, icon-192.png, icon-512.png, icon-maskable-512.png');
