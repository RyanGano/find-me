import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { SHAPES, type ShapeDef } from './shapes';

/**
 * A shape's declared `symmetry` decides how many rotations count as a match. Get it
 * wrong and the game either rejects a rotation that looks identical to the player, or
 * accepts one that plainly is not.
 *
 * Rather than trust the numbers, measure them: rasterise each shape, rotate the raster,
 * and find the true rotational order of the drawing itself.
 */

const N = 240;

async function raster(path: string, rule: string): Promise<Buffer> {
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${N}" height="${N}" viewBox="0 0 100 100">` +
      `<path d="${path}" fill="#000" fill-rule="${rule}"/></svg>`,
  );
  // Flatten onto white so the alpha channel cannot hide differences.
  return sharp(svg).resize(N, N).flatten({ background: '#fff' }).greyscale().raw().toBuffer();
}

async function rotated(path: string, rule: string, degrees: number): Promise<Buffer> {
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${N}" height="${N}" viewBox="0 0 100 100">` +
      `<g transform="rotate(${degrees} 50 50)">` +
      `<path d="${path}" fill="#000" fill-rule="${rule}"/></g></svg>`,
  );
  return sharp(svg).resize(N, N).flatten({ background: '#fff' }).greyscale().raw().toBuffer();
}

/** Fraction of pixels that differ between two rasters, ignoring anti-aliasing noise. */
function difference(a: Buffer, b: Buffer): number {
  let differing = 0;
  let ink = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] < 128 || b[i] < 128) ink++;
    if (Math.abs(a[i] - b[i]) > 96) differing++;
  }
  return ink === 0 ? 0 : differing / ink;
}

/** True if rotating the shape by 360/order degrees leaves it looking the same. */
async function repeatsAt(def: ShapeDef, order: number): Promise<boolean> {
  const rule = def.fillRule ?? 'evenodd';
  const base = await raster(def.path, rule);
  const turned = await rotated(def.path, rule, 360 / order);
  return difference(base, turned) < 0.06;
}

describe('shape symmetry', () => {
  for (const [key, def] of Object.entries(SHAPES)) {
    it(`${key} really has ${def.symmetry}-fold symmetry`, async () => {
      if (def.symmetry > 1) {
        // Every declared repeat must actually look identical.
        expect(await repeatsAt(def, def.symmetry), `${key} does not repeat at ${360 / def.symmetry} deg`).toBe(true);
      }

      // And nothing higher may repeat, or the player would be denied matching rotations.
      for (let order = def.symmetry + 1; order <= 12; order++) {
        if (order % def.symmetry !== 0 && def.symmetry !== 1) continue;
        if (order === def.symmetry) continue;
        expect(
          await repeatsAt(def, order),
          `${key} also repeats every ${360 / order} deg, so its symmetry is at least ${order}`,
        ).toBe(false);
      }
    }, 20000);
  }
});
