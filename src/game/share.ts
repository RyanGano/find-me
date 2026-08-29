import { formatTime } from './format';
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
