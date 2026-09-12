import { describe, expect, it } from 'vitest';
import { angleWork, DAYS_PER_WEEK, RAMP } from './difficulty';
import { IMAGES, PUZZLES } from './puzzles';
import { getShape } from './shapes';

/**
 * Days that ask for less turning than their rung, because the shape on them turned out
 * to be kinder than it was planned as.
 *
 * wave-sat: the lightning bolt was planned as a one-way shape and is not -- upside down
 * it looks exactly like itself, so the day was rejecting a rotation players could see
 * was right. Giving the bolt its true two-fold symmetry costs this Saturday 28 degrees
 * of its 104, and the alternative was re-hiding a day that was already being played.
 * Nothing else has to live here: `canHold` in shapeOrder.ts only offers a shape
 * to a day it can actually turn far enough for, so with the symmetry corrected the bolt
 * can no longer be planned onto a Saturday or a Sunday at all.
 */
const SHORT_TURN = new Set(['wave-sat']);

/** The seven puzzles of each week, in Monday-to-Sunday order. */
const weeks = IMAGES.map((image) => PUZZLES.filter((p) => p.image === image.id));

/**
 * What a week is, as rules rather than as a description.
 *
 * The data these check is machine-written (`npm run plan`, `npm run camouflage`), which
 * is exactly why they exist: a generator that quietly drifts -- two Thursdays with the
 * same shape, a shape nobody can see once framed -- produces a file that looks completely
 * plausible and plays wrong.
 *
 * Only defects live here. How hard a week *feels* -- whether it climbs in time to find,
 * whether a calm painting plateaus -- is a judgement, not a defect, and is reported by
 * `npm run difficulty` for a person to decide on rather than failed in CI.
 */
describe('a week', () => {
  it('is a whole number of weeks long', () => {
    expect(PUZZLES.length % DAYS_PER_WEEK).toBe(0);
    expect(PUZZLES.length).toBe(IMAGES.length * DAYS_PER_WEEK);
  });

  for (const [i, week] of weeks.entries()) {
    const image = IMAGES[i].id;

    it(`${image} runs one painting Monday to Sunday`, () => {
      expect(week.length).toBe(DAYS_PER_WEEK);
      expect(week.map((p) => p.dayOfWeek)).toEqual(RAMP.map((_, d) => d));
      expect(new Set(week.map((p) => p.title)).size).toBe(1);
    });

    it(`${image} asks for something different every day`, () => {
      // A different shape each day, and a different place to look for it. Repeating
      // either inside one week is the one thing a player would notice immediately.
      expect(new Set(week.map((p) => p.target.shape)).size).toBe(DAYS_PER_WEEK);
      for (const a of week) {
        for (const b of week) {
          if (a === b) continue;
          const apart = Math.hypot(a.target.cx - b.target.cx, a.target.cy - b.target.cy);
          expect(apart, `${a.id} and ${b.id} hide in the same place`).toBeGreaterThan(400);
        }
      }
    });

    it(`${image} gets harder every day`, () => {
      for (let d = 1; d < week.length; d++) {
        const prev = week[d - 1].target;
        const here = week[d].target;
        // Smaller: a longer zoom to reach the match, and a smaller speck to scan for.
        expect(here.size, `${week[d].id} is not smaller than ${week[d - 1].id}`).toBeLessThan(prev.size);
        // Further to turn, after the shape's own symmetry has been allowed for.
        const work = (p: (typeof week)[number]) => angleWork(p.target.angle, getShape(p.target.shape).symmetry);
        expect(work(week[d]), `${week[d].id} is not turned further than ${week[d - 1].id}`).toBeGreaterThan(
          work(week[d - 1]),
        );
      }
    });

    it(`${image} stays visible once it is framed`, () => {
      // The one thing that must never be traded away. A shape you cannot see when it is
      // centred, upright and the right size is not a hard puzzle -- the player has done
      // everything the game asked and there is nothing there.
      for (const p of week) {
        expect(p.target.ratio, `${p.id} cannot be seen even when correctly framed`).toBeGreaterThanOrEqual(0.95);
      }
    });

    it(`${image} opens the week with no transparency at all`, () => {
      // Monday's shape hides on size and colour alone -- see the `opaque` rung.
      expect(week[0].target.opacity).toBe(1);
    });
  }

  it('turns every shape no further than its symmetry allows', () => {
    for (const p of PUZZLES) {
      const shape = getShape(p.target.shape);
      const work = angleWork(p.target.angle, shape.symmetry);
      expect(work, `${p.id}`).toBeLessThanOrEqual(180 / shape.symmetry);
      if (SHORT_TURN.has(p.id)) continue;
      // The rung is the contract: the stored angle may be anything congruent to it.
      expect(Math.abs(work - RAMP[p.dayOfWeek].angle), `${p.id} is ${work} degrees, not ${RAMP[p.dayOfWeek].angle}`).toBeLessThan(1);
    }
  });
});

describe('angleWork', () => {
  it('folds an angle into the shape rotations that look identical', () => {
    expect(angleWork(41, 6)).toBeCloseTo(19);
    expect(angleWork(-148, 1)).toBeCloseTo(148);
    expect(angleWork(148, 4)).toBeCloseTo(32);
    expect(angleWork(0, 1)).toBe(0);
  });
});
