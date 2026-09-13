import { describe, expect, it } from 'vitest';
import { inviteRound, openRound, puzzlesOf, roundById, ROUNDS, TEST_ROUND } from './rounds';
import { TESTBED_PUZZLES } from './testbed';

/**
 * A round is served to real people on a link that never changes, which is what makes
 * these worth checking rather than eyeballing. Every failure mode here looks fine in the
 * file and shows up as a tester opening the link and getting a blank page, an error, or
 * somebody else's round -- by which point the round is spent.
 */
describe('play-test rounds', () => {
  it('names only bench puzzles', () => {
    const bench = new Set(TESTBED_PUZZLES.map((p) => p.id));
    for (const round of ROUNDS) {
      for (const id of round.days) {
        expect(bench, `round ${round.id} names ${id}, which is not on the bench`).toContain(id);
      }
      // The strong version of the same thing: `puzzlesOf` is what the page calls, and it
      // throws rather than rendering half a round.
      expect(() => puzzlesOf(round)).not.toThrow();
    }
  });

  it('never serves the same puzzle twice in one round', () => {
    for (const round of ROUNDS) {
      expect(new Set(round.days).size, `round ${round.id} repeats a puzzle`).toBe(
        round.days.length,
      );
    }
  });

  it('gives every round a distinct id', () => {
    expect(new Set(ROUNDS.map((r) => r.id)).size).toBe(ROUNDS.length);
  });

  it('opens before it closes', () => {
    for (const round of ROUNDS) {
      expect(round.opens).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(round.closes).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(round.opens <= round.closes, `round ${round.id} closes before it opens`).toBe(true);
    }
  });

  /**
   * The one that cannot be seen by reading a single round. Two open at once and the link
   * quietly serves the older of them, so a round somebody thought they had started is
   * collecting nothing.
   */
  it('never runs two rounds at the same time', () => {
    for (const [i, a] of ROUNDS.entries()) {
      for (const b of ROUNDS.slice(i + 1)) {
        const overlap = a.opens <= b.closes && b.opens <= a.closes;
        expect(overlap, `rounds ${a.id} and ${b.id} are both open at once`).toBe(false);
      }
    }
  });

  it('records the question it exists to answer', () => {
    for (const round of ROUNDS) expect(round.asks.length).toBeGreaterThan(10);
  });

  it('tells a tester what to expect without telling them what it hopes to find', () => {
    for (const round of ROUNDS) {
      expect(round.expect.length, round.id).toBeGreaterThan(10);
      // Short enough to be read rather than skipped. The first version of this copy ran
      // to ninety words of rationale and was the reason `asks` stopped being shown.
      expect(round.expect.length, `${round.id} expect is too long to read`).toBeLessThan(220);
      // A tester told the time a day is meant to take rates it against that number.
      expect(round.expect, `${round.id} tells testers how long a hunt should take`).not.toMatch(
        /\b(second|minute|meant to|should take|expect(ed)? to)\b/i,
      );
    }
  });

  it('serves a round on its own days and nothing outside them', () => {
    for (const round of ROUNDS) {
      const [oy, om, od] = round.opens.split('-').map(Number);
      const [cy, cm, cd] = round.closes.split('-').map(Number);
      const open = new Date(oy, om - 1, od);
      const close = new Date(cy, cm - 1, cd);

      expect(openRound(open)?.id).toBe(round.id);
      expect(openRound(close)?.id).toBe(round.id);
      // Late on the closing day is still the closing day: rounds roll over at the
      // tester's own midnight, as the daily puzzle does.
      expect(openRound(new Date(cy, cm - 1, cd, 23, 59))?.id).toBe(round.id);
      expect(openRound(new Date(oy, om - 1, od - 1))?.id).not.toBe(round.id);
      expect(openRound(new Date(cy, cm - 1, cd + 1))?.id).not.toBe(round.id);
    }
  });

  it('keeps the ?test round off the real link, but playable by name', () => {
    expect(ROUNDS.map((r) => r.id)).not.toContain(TEST_ROUND.id);
    for (const round of ROUNDS) expect(round.id).not.toBe(TEST_ROUND.id);
    expect(() => puzzlesOf(TEST_ROUND)).not.toThrow();
    expect(roundById(TEST_ROUND.id)).toBe(TEST_ROUND);
    expect(inviteRound(true)).toBe(TEST_ROUND);
    // A day with no real round open invites nobody outside `?test`.
    const quiet = new Date(2026, 0, 1);
    expect(openRound(quiet)).toBeUndefined();
    expect(inviteRound(false, quiet)).toBeUndefined();
  });

  it('is a short sitting, because a long one gets abandoned at the hard end', () => {
    for (const round of ROUNDS) {
      expect(round.days.length).toBeGreaterThan(0);
      expect(round.days.length, `round ${round.id} asks for ${round.days.length} hunts`).toBeLessThanOrEqual(
        12,
      );
    }
  });
});
