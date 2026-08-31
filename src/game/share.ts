import { PAR_AGE, SPREAD } from './age';
import { RAMP } from './difficulty';
import { formatTime } from './format';
import type { RunMetrics } from './metrics';
import type { Puzzle } from './types';

export const SITE_URL = 'https://findme.ryangano.com/';

/**
 * A spoiler-free result line: the thing found and how long it took, plus a five-block
 * speed bar so results are comparable at a glance without naming the hiding place.
 */
export function speedBar(ms: number): string {
  const thresholds = [15000, 30000, 60000, 120000];
  const filled = 5 - thresholds.filter((t) => ms > t).length;
  return '🟩'.repeat(filled) + '⬜'.repeat(5 - filled);
}

export function buildShareText(
  day: number,
  puzzle: Puzzle,
  ms: number,
  streak: number,
  age: number | null,
): string {
  const lines = [
    `Find Me #${day} ${puzzle.emoji}`,
    `${formatTime(ms)}  ${speedBar(ms)}`,
  ];
  // Sits directly under the clock, because it is the same result read a second way:
  // the time says how fast, the age says how it was played.
  if (age !== null) lines.push(`Your Find Me Age: ${age}`);
  if (streak > 1) lines.push(`🔥 ${streak} day streak`);
  lines.push(SITE_URL);
  return lines.join('\n');
}

/**
 * Everything a retune of the age estimate needs from one run, as pasteable text.
 *
 * Separate from `buildShareText` on purpose. That one is what a player posts in public
 * and is spoiler-free and short; this is a beta instrument, and it is verbose because
 * the alternative -- inferring a run from the age it produced -- is how the estimate got
 * two tunings in a row wrong. `age.ts` normalises everything against the day, so the day
 * has to travel with the run, and so does the scale it was read on: a reading is
 * `PAR_AGE + SPREAD * L`, so recording both recovers what the run was worth even after
 * the scale has moved under it.
 *
 * The real age is the one thing the game does not know and the only thing that makes the
 * rest worth having, so the text opens with a blank for it rather than hoping whoever
 * pastes it remembers to say.
 */
export function buildAgeDataText(
  day: number,
  puzzle: Puzzle,
  ms: number,
  age: number,
  metrics: RunMetrics | null,
  isPractice: boolean,
): string {
  const rung = RAMP[puzzle.dayOfWeek];
  const secs = (n: number) => `${(n / 1000).toFixed(1)}s`;
  const lines = [
    `Find Me #${day} age data${isPractice ? ' (practice)' : ''}`,
    'real age: ',
    `puzzle: ${puzzle.id} (${rung.label}, scan ${puzzle.target.scan ?? rung.scan})`,
    `time: ${secs(ms)}`,
    `read: ${age} (par ${PAR_AGE}, spread ${SPREAD})`,
  ];
  if (
    metrics &&
    typeof metrics.searchMs === 'number' &&
    typeof metrics.adjustMs === 'number'
  ) {
    lines.push(
      `search: ${secs(metrics.searchMs)}  adjust: ${secs(metrics.adjustMs)}`,
      `passes: ${metrics.passes}  overshoots: ${metrics.overshoots}  reversals: ${metrics.reversals}  idle: ${secs(metrics.idleMs)}`,
    );
  } else {
    // Worth saying out loud rather than leaving the lines off: a run with no metrics was
    // read on the clock alone, and knowing that is the difference between a data point
    // and a mystery.
    lines.push('metrics: none (read on the clock alone)');
  }
  return lines.join('\n');
}

/** Copy text, preferring the native share sheet on touch devices. */
export async function shareResult(text: string): Promise<'shared' | 'copied' | 'failed'> {
  if (typeof navigator !== 'undefined' && navigator.share && isTouch()) {
    try {
      await navigator.share({ text });
      return 'shared';
    } catch (err) {
      // The user dismissing the sheet is not a failure worth reporting.
      if (err instanceof DOMException && err.name === 'AbortError') return 'shared';
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}

function isTouch(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
}
