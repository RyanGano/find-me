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

/**
 * The size of the Commons scan each shipped asset was generated from.
 *
 * The scans themselves are not kept -- they are hundreds of megabytes each, used once by
 * `resize-images.mjs` and never again -- so `source` in `puzzles.ts` records the address
 * instead. An address alone is not enough, though: several of these paintings have half a
 * dozen scans on Commons at different crops, and two of them differ only in their
 * retouching. These dimensions are what makes the record checkable.
 *
 * Verified against Commons in September 2026; eight of the ten were byte-identical to the
 * local copy at the time, and the two thumbnails matched Commons' own rendering exactly.
 */
const SOURCE_SCANS: Record<string, { width: number; height: number }> = {
  mona: { width: 2835, height: 4289 },
  wave: { width: 3859, height: 2594 },
  starry: { width: 44567, height: 35291 },
  boating: { width: 9025, height: 6684 },
  jatte: { width: 20000, height: 13313 },
  hunters: { width: 6819, height: 4853 },
  issus: { width: 4592, height: 6000 },
  babel: { width: 4943, height: 3959 },
  deheem: { width: 4570, height: 3704 },
  venice: { width: 8392, height: 5724 },
};

/**
 * Where each asset came from, so a lost scan is a re-download rather than a hunt.
 *
 * The aspect-ratio check is the one that earns its place. `resize-images.mjs` only ever
 * scales to width, so the asset's shape is the scan's shape; if someone re-generates a
 * painting from a different scan of the same work -- a different crop, which is what most
 * of the alternatives on Commons are -- the height moves and every hiding place in that
 * week moves with it. That is not hypothetical: `mona` shipped from the 2835px scan while
 * a 6441px Louvre scan of a visibly different crop sat in `.source-images/` as an upgrade
 * that was downloaded and never applied. This test is what would have caught applying it.
 */
describe('asset provenance', () => {
  for (const image of IMAGES) {
    const scan = SOURCE_SCANS[image.id];

    it(`${image.id} records the scan it was built from`, () => {
      expect(image.source, `${image.id} has no source`).toMatch(
        /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/,
      );
      expect(scan, `${image.id} is missing from SOURCE_SCANS`).toBeDefined();
    });

    it(`${image.id} has the shape of its recorded scan`, () => {
      // Round-trip the scan's ratio through the generated width, as `npm run images` does.
      expect(Math.round((scan.height / scan.width) * image.width)).toBe(image.height);
    });

    if (image.sourceWidth !== undefined) {
      it(`${image.id} was taken from a thumbnail wide enough to generate from`, () => {
        expect(image.sourceWidth).toBeLessThan(scan.width);
        expect(image.sourceWidth).toBeGreaterThanOrEqual(image.width);
      });
    }
  }

  it('does not point two paintings at the same scan', () => {
    const urls = IMAGES.map((i) => i.source);
    expect(new Set(urls).size).toBe(urls.length);
  });
});
