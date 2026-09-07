import { TESTBED_PUZZLES } from './testbed';
import type { Puzzle } from './types';

/**
 * A round of play-testing: one question, a handful of bench days chosen to answer it,
 * and the fortnight it is being asked in.
 *
 * The unit is the round rather than "the bench", because what needs testing changes and
 * the link must not. Testers are people doing a favour; asking them to keep a different
 * URL straight each time is how a round quietly gets no data. So `/?beta` always
 * serves whichever round is open today, and the next round is one object added below.
 *
 * A round is any slice of the bench that answers its question. If Saturday feels too
 * hard, that is three paintings' Saturdays with the Fridays beside them as a control. If
 * one *kind* of painting feels rough, that is all seven days of that one canvas. Keep it
 * short: six hunts is fifteen minutes and gets finished, and a round nobody finishes is
 * a round whose hard end -- the part in question -- is the part with no answers in it.
 *
 * Rounds do not overlap. Where two would, the first one listed wins, and the test below
 * fails on the overlap rather than leaving it to be discovered by a tester.
 */
export interface Round {
  id: string;
  /** First local date the round is served, `YYYY-MM-DD`. */
  opens: string;
  /** Last local date the round is served, inclusive. */
  closes: string;
  /**
   * The question this round exists to answer.
   *
   * **Not shown to testers.** It is the record of why the round was run, for whoever
   * reads the answers back months later. It stopped being tester-facing the first time a
   * round's own goal was put in front of the people being asked: a tester told what the
   * round hopes to prove has been handed the answer, and a tester told the time a day is
   * meant to take rates it against that number instead of against how it felt.
   */
  asks: string;
  /**
   * What a tester is told to expect from *this* round, in one or two sentences.
   *
   * Anything they need in order to know what they are about to play, and nothing about
   * why we are asking. No expected times, no mention of what changed, no hypothesis.
   */
  expect: string;
  /** Bench puzzle ids, in the order they are served. */
  days: string[];
}

export const ROUNDS: Round[] = [
  {
    id: 'r1-weekend',
    opens: '2026-09-05',
    closes: '2026-09-06',
    asks: 'Is the end of the week too hard?',
    expect: 'Three paintings you have not seen in the game, two hunts on each.',
    days: [
      'proverbs-fri',
      'proverbs-sat',
      'cafe-fri',
      'cafe-sat',
      'ambassadors-fri',
      'ambassadors-sat',
    ],
  },
  {
    id: 'r2-busyness',
    opens: '2026-09-07',
    closes: '2026-09-28',
    asks: 'Does a Monday feel like a Monday whatever the painting?',
    expect:
      'Two paintings the daily game has already been through. The shape is somewhere ' +
      'new in each, so having played them before will not help.',
    days: ['starryreplan-mon', 'wavereplan-mon'],
  },
];

function localDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * The round being served today, in the tester's own timezone -- the same rule the daily
 * puzzle rolls over on, so a tester in New Zealand is not told a round has closed while
 * it is still Tuesday where they are.
 */
export function openRound(now: Date = new Date()): Round | undefined {
  const today = localDate(now);
  return ROUNDS.find((r) => r.opens <= today && today <= r.closes);
}

export function roundById(id: string): Round | undefined {
  return ROUNDS.find((r) => r.id === id);
}

/** The puzzles of a round, in order. Throws on an id that is not on the bench. */
export function puzzlesOf(round: Round): Puzzle[] {
  return round.days.map((id) => {
    const puzzle = TESTBED_PUZZLES.find((p) => p.id === id);
    if (!puzzle) throw new Error(`round ${round.id} names ${id}, which is not a bench puzzle`);
    return puzzle;
  });
}
