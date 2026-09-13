import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { IMAGES } from './puzzles';
import { countWeeks } from './weekCount';

describe('the week count the build publishes', () => {
  it('matches the weeks puzzles.ts actually builds', () => {
    // If this fails, `version.json` is telling the live site the wrong runway.
    expect(countWeeks(readFileSync('src/game/puzzles.ts', 'utf8'))).toBe(IMAGES.length);
  });
});
