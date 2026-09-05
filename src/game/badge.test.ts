import { describe, expect, it } from 'vitest';
import { contrast, luminance, wellFor } from './badge';

/**
 * 3:1 is the WCAG floor for a large graphic, and the badge glyph is exactly that: a solid
 * shape at 60-88px. Below it the swatch reads as a blob rather than as a key or a
 * crescent, which is the whole job of the badge.
 */
const FLOOR = 3;

describe('the badge well', () => {
  it('clears the contrast floor for every colour a fill could come out', () => {
    // Every fill in the set is an apparent colour -- composited, so effectively arbitrary.
    // Walking the cube is cheap and says something a handful of samples cannot.
    let worst = { fill: '', ratio: Infinity };
    for (let r = 0; r < 256; r += 15) {
      for (let g = 0; g < 256; g += 15) {
        for (let b = 0; b < 256; b += 15) {
          const fill = '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('');
          const ratio = contrast(fill, wellFor(fill));
          if (ratio < worst.ratio) worst = { fill, ratio };
        }
      }
    }
    expect(worst.ratio, `worst fill ${worst.fill} at ${worst.ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(FLOOR);
  });

  it('rescues the grey key that started this', () => {
    // mona-thu is a grey-olive key. Against the old fixed well it was grey on grey: the
    // player could see that something was there, but not what shape to go looking for.
    const OLD_WELL = '#6d6862';
    const greyOlive = '#7c7a6e';
    expect(contrast(greyOlive, OLD_WELL)).toBeLessThan(FLOOR);
    expect(contrast(greyOlive, wellFor(greyOlive))).toBeGreaterThanOrEqual(FLOOR);
  });

  it('keeps pale and dark fills on opposite wells', () => {
    expect(wellFor('#f2efe8')).not.toBe(wellFor('#1d222b'));
  });

  it('is a pure function of the fill, like everything else the player sees', () => {
    expect(wellFor('#b9b792')).toBe(wellFor('#b9b792'));
  });

  it('treats an unparseable fill as mid-grey rather than throwing', () => {
    expect(() => wellFor('var(--accent)')).not.toThrow();
    expect(luminance('nonsense')).toBeCloseTo(0.18, 5);
  });
});
