import { existsSync } from 'node:fs';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { IMAGES } from './puzzles';

/**
 * Target coordinates are in the asset's own pixel space, so a re-generated image at a
 * different size would silently move every hiding place -- all seven of them, since a
 * painting now carries a whole week. Pin the two together.
 */
describe('puzzle assets', () => {
  for (const image of IMAGES) {
    const file = `public/puzzles/${image.id}.jpg`;

    it(`${image.id} exists and matches its declared dimensions`, async () => {
      expect(existsSync(file), `${file} is missing — run npm run images`).toBe(true);
      const meta = await sharp(file).metadata();
      expect(meta.width).toBe(image.width);
      expect(meta.height).toBe(image.height);
    });
  }
});
