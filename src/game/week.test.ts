import { describe, expect, it } from 'vitest';
import { expectedSearchMs } from './age';
import { angleWork, DAYS_PER_WEEK, RAMP } from './difficulty';
import { IMAGES, PUZZLES } from './puzzles';
import { getShape } from './shapes';

/**
 * Days the visible-when-framed floor rescued, and which therefore came out easier than
 * their rung asked for.
 *
 * Named one at a time on purpose. The trade itself is deliberate -- a shape nobody can see
 * even when correctly framed is broken rather than hard, so `FRAMED_FLOOR` in
 * tune-camouflage.mjs outranks the clock -- but it should cost somebody a decision each
 * time, not quietly become the rule. A week that lands two days in here has a hiding place
 * problem or a size ladder that has been shrunk past what the painting can carry.
 *
 * jatte-sun: Seurat at a 16px Sunday. 16px is the far end of what it can hold -- at 16, 18
 * and 20 the tuner floored every time, landing at 0.47, 0.41 and 0.40 against a target of
 * 0.341, so by the clock it should be a 58-second day where the rung asked for 291.
 *
 * It is not, and that is the interesting part: played cold it went over a minute without
 * being found. So this entry records a day that *measures* easy rather than one that plays
 * easy, and the exemption is here because the reading is untrustworthy at this size, not
 * because the day is a write-off.
 */
const FLOORED = new Set(['jatte-sun']);

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
 * same shape, a Saturday easier than its Sunday -- produces a file that looks completely
 * plausible and plays wrong.
 */
/**
 * Weeks whose Monday was already played when the busyness term arrived, and was
 * deliberately left as it was served.
 *
 * Re-tuning a day changes its `version`, and a day already in somebody's record comes
 * back to them as playable if it moves. So where the rest of a week has been corrected
 * mid-flight, its Monday stays wrong on purpose and the ramp is asserted from Tuesday.
 *
 * The cost is real and is worth stating rather than hiding behind the skip: that Monday
 * is harder than the Tuesday after it. It is the *served* day that is out of line, so
 * every day still ahead of the player climbs properly, which is the half that can still
 * be fixed. Entries come off this list when the week rolls out of the calendar.
 */
const MONDAY_LEFT_AS_SERVED = ['starry'];

/**
 * Weeks still carrying the paint they were solved to before the ramp measured busyness.
 *
 * They are held to every other rule; this one they cannot meet, because the ramp they
 * were tuned against had no term for the canvas and the model now prices them wherever
 * the painting puts them. `babel` is the only one that actually trips it -- the other
 * five happen to still climb -- and it misses by three per cent, on a week nobody has
 * reached yet.
 *
 * It comes off this list the moment it is re-tuned. A list of exemptions, never of weeks
 * held to the rule, so a painting added later is caught by default.
 */
const AWAITING_RETUNE: string[] = [];

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

    it.skipIf(AWAITING_RETUNE.includes(image))(`${image} takes longer to find as the week goes on`, () => {
      // Asserted on the *time* each day is priced at, not on `scan`.
      //
      // Those used to be the same statement, and are not any more. `scan` is a contrast
      // reading, and since the ramp gained a dimness term the same reading buys a
      // different hunt on dark paint than on light -- so a week can climb perfectly in
      // time while its scan numbers wander. Two shipped weeks do exactly that. Asserting
      // the proxy instead of the thing would have failed them for being right.
      //
      // Asserted at the anchors rather than day by day: a day whose contrast would have
      // fallen below the visible-when-framed floor is raised back up, which can leave it
      // easier than the day before it. That is a deliberate trade -- see FRAMED_FLOOR in
      // tune-camouflage.mjs -- and forbidding it here would mean forbidding the fix.
      const priced = week.map((p) =>
        expectedSearchMs(p.target.scan ?? RAMP[p.dayOfWeek].scan, p.clutter, p.target.dim),
      );
      const from = MONDAY_LEFT_AS_SERVED.includes(image) ? 1 : 0;
      expect(
        Math.min(...priced.slice(from)),
        `${image}: some day is quicker than the one the week opens on`,
      ).toBe(priced[from]);
      expect(priced[3], `${image}: Thursday is no harder than the day it opens on`).toBeGreaterThan(
        priced[from],
      );
      if (!FLOORED.has(week[6].id)) {
        expect(priced[6], `${image}: Sunday is no harder than Thursday`).toBeGreaterThan(priced[3]);
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
