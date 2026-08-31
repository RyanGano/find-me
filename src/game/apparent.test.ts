import { describe, expect, it } from 'vitest';
import { measureApparentFill } from './apparent';
import { PUZZLES } from './puzzles';

/**
 * The colour itself is measured in a real browser -- `node scripts/diag-badge.mjs`
 * checks every day's badge against an independent CSS render of the same shape over
 * the same paint, which is the only place the answer can honestly be judged.
 *
 * What matters here is the other half of the contract: off a canvas there is no answer,
 * and the badge has to fall back to the declared fill rather than draw nothing.
 */
describe('measureApparentFill', () => {
  it('gives up rather than guessing when there is no canvas to draw on', () => {
    const image = {} as CanvasImageSource;
    for (const puzzle of PUZZLES) {
      expect(measureApparentFill(puzzle, image)).toBeNull();
    }
  });
});
