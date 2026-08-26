import { existsSync } from 'node:fs';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { PUZZLES } from './puzzles';

/**
 * Target coordinates are in the asset's own pixel space, so a re-generated image at a
 * different size would silently move every hiding place. Pin the two together.
 */
describe('puzzle assets', () => {
  for (const p of PUZZLES) {
    const file = `public/puzzles/${p.id}.jpg`;

    it(`${p.id} exists and matches its declared dimensions`, async () => {
      expect(existsSync(file), `${file} is missing — run npm run images`).toBe(true);
      const meta = await sharp(file).metadata();
      expect(meta.width).toBe(p.width);
      expect(meta.height).toBe(p.height);
    });
  }
});
