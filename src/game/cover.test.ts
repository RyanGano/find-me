import { describe, expect, it } from 'vitest';
import { COVER_FLOOR, RAMP } from './difficulty';
import { PUZZLES } from './puzzles';

/**
 * Days served before `COVER_FLOOR` existed, exempt by name.
 *
 * A list of exemptions rather than of days held to the rule, so a painting added later is
 * caught by default. Adding a cover to one of these would change its `version` and hand a
 * finished board back to everyone who has played it. The last entry is the day the rule
 * came out of, and it fails the rule: without its exemption this file is red.
 */
const BEFORE_COVER = [
  'mona-tue', 'mona-wed', 'mona-thu', 'mona-fri', 'mona-sat', 'mona-sun',
  'wave-tue', 'wave-wed', 'wave-thu', 'wave-fri', 'wave-sat', 'wave-sun',
  'starry-tue', 'starry-wed', 'starry-thu', 'starry-fri',
];

describe('solid shapes', () => {
  for (const puzzle of PUZZLES) {
    // Monday is opaque and hides on colour alone; it has nothing for strokes to run through.
    if (RAMP[puzzle.dayOfWeek].opaque) continue;

    it.skipIf(BEFORE_COVER.includes(puzzle.id))(
      `${puzzle.id} covers at least ${COVER_FLOOR} of the paint under it`,
      () => {
        expect(puzzle.target.cover).toBeGreaterThanOrEqual(COVER_FLOOR);
        expect(puzzle.target.base).toMatch(/^#[0-9a-f]{6}$/);
      },
    );
  }

  it('the day the rule came out of would fail it', () => {
    const day = PUZZLES.find((p) => p.id === 'starry-fri');
    expect(day?.target.cover ?? 0).toBeLessThan(COVER_FLOOR);
  });

  it('exempts only days that exist and are see-through', () => {
    for (const id of BEFORE_COVER) {
      const day = PUZZLES.find((p) => p.id === id);
      expect(day, id).toBeDefined();
      expect(RAMP[day!.dayOfWeek].opaque, id).toBeFalsy();
    }
  });
});
