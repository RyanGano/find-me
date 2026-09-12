/**
 * Which shape each day of the rotation hides, across weeks rather than inside one.
 *
 * Three rules, all measured on the calendar a player actually walks through:
 *
 * 1. **Never the same shape two days running** -- including a week's Sunday and the next
 *    week's Monday, which are two different paintings but one player's yesterday and today.
 * 2. **Every shape about as often as every other.** The count of each shape over the
 *    weeks this module chooses stays within one of every other shape that could have
 *    held those days.
 * 3. **No visible order.** A player who notices the shapes stepping through a list can
 *    guess tomorrow's, so ties are broken by a hash of week, day and shape rather than by
 *    the order `SHAPES` happens to be declared in.
 *
 * Inside a week the old rules still hold and outrank these: seven different shapes, and
 * a shape only on a day it can turn far enough for (`180 / symmetry` must clear the rung's
 * angle), which is what keeps the symmetric shapes on the front of the week.
 *
 * Deterministic by construction -- no randomness, only the hash -- and local: only the
 * weeks being planned are dealt, and every other week keeps what it carries and stands as
 * a fixed neighbour on either side. So appending a painting, inserting one among upcoming
 * weeks, or re-planning one upcoming week moves that week's shapes and nobody else's.
 */
import { RAMP } from './difficulty';
import { SHAPES } from './shapes';

/**
 * Weeks whose shapes were chosen before these rules existed, and are kept as they were
 * written rather than re-chosen.
 *
 * These are the weeks that had already been served, or were being played, when the rules
 * arrived. Re-choosing a shape moves a day's `spot`, which hands a finished board back as
 * playable. A list of exemptions, never of weeks held to the rules, so a painting added
 * later is caught by default.
 *
 * They are never dealt, even by a bare `npm run plan` that names no week, and they are left
 * out of the balance in rule 2. **Before adding or removing a shape, add every week already
 * served to this list**: the choice is a function of the shape registry, so a registry
 * change re-deals every week a bare `npm run plan` touches.
 */
export const SHAPES_AS_SERVED = ['mona', 'wave', 'starry'];

/** Can this shape be turned as far as day `d` asks, once its symmetry is allowed for? */
export function canHold(shape: string, d: number): boolean {
  return 180 / SHAPES[shape].symmetry >= RAMP[d].angle + 2;
}

/** FNV-1a over a string: a stable, well-mixed tie-break with nothing random in it. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export interface WeekShapes {
  image: string;
  /** The shapes the week carries now, Monday first. Kept as-is unless the week is dealt. */
  shapes: string[];
}

/**
 * The shapes for every week, Monday first, in calendar order.
 *
 * Only the weeks named in `planned` (and not exempt) are dealt; every other week keeps what
 * it carries and counts towards the balance. A dealt week must not repeat the Sunday before
 * it or the Monday after it, wherever those neighbours are already settled -- a week that is
 * not being dealt, or one dealt earlier in this run -- including the wrap from the last week
 * back to the first. Within a week the days are filled hardest first, because Saturday and
 * Sunday can only take a one-way shape and Monday can take anything: filling Monday first
 * would spend one-way shapes the back of the week needs.
 */
export function shapeRun(
  weeks: WeekShapes[],
  planned: readonly string[] = weeks.map((w) => w.image),
  exempt: readonly string[] = SHAPES_AS_SERVED,
): string[][] {
  const all = Object.keys(SHAPES);
  const last = RAMP.length - 1;
  const dealt = (week: WeekShapes) => planned.includes(week.image) && !exempt.includes(week.image);

  const out = weeks.map((w) => w.shapes.slice());
  const settled = new Set(weeks.flatMap((w, i) => (dealt(w) ? [] : [i])));
  const uses = new Map(all.map((s) => [s, 0]));
  for (const week of weeks) {
    if (dealt(week) || exempt.includes(week.image)) continue;
    for (const s of week.shapes) if (uses.has(s)) uses.set(s, uses.get(s)! + 1);
  }

  for (const [w, week] of weeks.entries()) {
    if (!dealt(week)) continue;
    const prev = (w - 1 + weeks.length) % weeks.length;
    const next = (w + 1) % weeks.length;
    const yesterday = prev !== w && settled.has(prev) ? out[prev][last] : undefined;
    const tomorrow = next !== w && settled.has(next) ? out[next][0] : undefined;
    const chosen: (string | undefined)[] = RAMP.map(() => undefined);
    // Backtracking rather than greedy, so a week that paints itself into a corner on
    // Monday -- its only legal shapes spent later in the week -- tries again rather than
    // throwing. In practice the first path almost always succeeds.
    const order = RAMP.map((_, d) => d).reverse();
    const fill = (i: number): boolean => {
      if (i === order.length) return true;
      const d = order[i];
      const candidates = all
        .filter((s) => canHold(s, d))
        .filter((s) => !chosen.includes(s))
        .filter((s) => s !== chosen[d - 1] && s !== chosen[d + 1])
        .filter((s) => d !== 0 || s !== yesterday)
        .filter((s) => d !== last || s !== tomorrow)
        .sort(
          (a, b) =>
            uses.get(a)! - uses.get(b)! || hash(`${week.image}:${d}:${a}`) - hash(`${week.image}:${d}:${b}`),
        );
      for (const s of candidates) {
        chosen[d] = s;
        uses.set(s, uses.get(s)! + 1);
        if (fill(i + 1)) return true;
        uses.set(s, uses.get(s)! - 1);
        chosen[d] = undefined;
      }
      return false;
    };
    if (!fill(0)) throw new Error(`${week.image}: no seven shapes satisfy the week's rules`);
    out[w] = chosen as string[];
    settled.add(w);
  }
  return out;
}
