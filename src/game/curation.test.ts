import { describe, expect, it } from 'vitest';
import { CREDITS, GENRES } from './puzzles';

/**
 * What the rotation as a whole has to look like, as rules rather than as taste.
 *
 * A week is seven days on one painting, so the list in `puzzles.ts` is not a list of
 * puzzles -- it is a running order, and a player meets it one painting at a time over
 * months. Three landscapes together is a season of the same picture, and two Bruegels
 * back to back reads as the game repeating itself even though every day of both is
 * different.
 *
 * None of that is visible in a diff. A new week is appended to the bottom of a file whose
 * other entries are hundreds of lines away, and it looks perfectly fine on its own; the
 * only thing that can see the run is something that looks at the neighbours. That is what
 * these are for.
 *
 * They constrain the *order* of the list, never its contents, and the order is
 * effectively append-only -- `daily.ts` maps the calendar onto `PUZZLES` by index, so
 * moving a week that players have already been served moves every painting after it. A
 * failure here is therefore about the painting being added, and the fix is a different
 * painting rather than a different position.
 */
describe('the rotation', () => {
  it('says what kind of painting each week is', () => {
    for (const week of CREDITS) {
      expect(GENRES, `${week.id} has an unknown genre`).toContain(week.genre);
    }
  });

  it('never runs the same painter two weeks together', () => {
    for (const [i, week] of CREDITS.entries()) {
      if (i === 0) continue;
      expect(
        week.artist,
        `${week.id} follows ${CREDITS[i - 1].id} and both are ${week.artist} -- ` +
          'weeks that have shipped cannot be moved, so this one needs a different painting',
      ).not.toBe(CREDITS[i - 1].artist);
    }
  });

  it('never runs the same kind of painting three weeks together', () => {
    // Two together is a pair and reads as variety with a rhyme in it. Three is a season
    // of the same picture, which is the thing worth failing a build over.
    for (let i = 2; i < CREDITS.length; i++) {
      const run = [CREDITS[i - 2], CREDITS[i - 1], CREDITS[i]];
      expect(
        new Set(run.map((w) => w.genre)).size,
        `${run.map((w) => w.id).join(', ')} are all ${run[0].genre}`,
      ).toBeGreaterThan(1);
    }
  });

  it('does not let one painter take over the rotation', () => {
    // A painter can hold several weeks -- Bruegel holds three and the set is better for
    // it -- but not most of them, which is where a rotation stops being a rotation.
    const byPainter = new Map<string, number>();
    for (const week of CREDITS) byPainter.set(week.artist, (byPainter.get(week.artist) ?? 0) + 1);
    for (const [artist, held] of byPainter) {
      expect(held, `${artist} holds ${held} of ${CREDITS.length} weeks`).toBeLessThanOrEqual(
        Math.max(3, Math.ceil(CREDITS.length / 3)),
      );
    }
  });

  it('keeps more than one kind of painting in play', () => {
    // A guard against the slow version of the problem: no three in a row, and yet the
    // whole rotation quietly becomes landscapes anyway.
    const kinds = new Set(CREDITS.map((w) => w.genre));
    expect(kinds.size, `${CREDITS.length} weeks across only ${kinds.size} kinds`).toBeGreaterThanOrEqual(
      Math.min(4, CREDITS.length),
    );
  });

  it('gives every week a distinct painting', () => {
    expect(new Set(CREDITS.map((w) => w.id)).size).toBe(CREDITS.length);
    expect(new Set(CREDITS.map((w) => w.title)).size).toBe(CREDITS.length);
  });
});
