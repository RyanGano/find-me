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
 * Deterministic by construction -- no randomness, only the hash -- and forward-only: a
 * week's shapes depend on the weeks before it and never on the weeks after, so appending
 * a painting leaves every existing week's shapes exactly where they were.
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
 * **Before adding or removing a shape, add every week already served to this list.** The
 * choice is a function of the shape registry, so a registry change re-deals every week not
 * named here the next time `npm run plan` touches it.
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
  /** The shapes the week carries now, Monday first. Kept as-is for an exempt week. */
  shapes: string[];
}

/**
 * The shapes for every week, Monday first, in calendar order.
 *
 * Exempt weeks keep what they carry and count as the neighbour of the week after them;
 * every other week is chosen here. Within a week the days are filled hardest first,
 * because Saturday and Sunday can only take a one-way shape and Monday can take anything:
 * filling Monday first would spend one-way shapes the back of the week needs.
 */
export function shapeRun(weeks: WeekShapes[], exempt: readonly string[] = SHAPES_AS_SERVED): string[][] {
  const all = Object.keys(SHAPES);
  const uses = new Map(all.map((s) => [s, 0]));
  const out: string[][] = [];

  for (const [w, week] of weeks.entries()) {
    if (exempt.includes(week.image)) {
      out.push(week.shapes.slice());
      continue;
    }
    const yesterday = out[w - 1]?.[RAMP.length - 1];
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
    out.push(chosen as string[]);
  }
  return out;
}
