import { describe, expect, it } from 'vitest';
import { IMAGES, PUZZLES } from './puzzles';
import { canHold, shapeRun, SHAPES_AS_SERVED } from './shapeOrder';
import { SHAPES } from './shapes';

const weeks = IMAGES.map((image) => ({
  image: image.id,
  shapes: PUZZLES.filter((p) => p.image === image.id).map((p) => p.target.shape),
}));
const chosen = weeks.filter((w) => !SHAPES_AS_SERVED.includes(w.image));
const keys = Object.keys(SHAPES);

describe('the order shapes come in', () => {
  it('never hides the same shape two days running', () => {
    // Across the whole calendar, including the wrap back to the first week, because
    // `daily.ts` indexes `PUZZLES` modulo its length and every week comes round again.
    for (let i = 0; i < PUZZLES.length; i++) {
      const next = PUZZLES[(i + 1) % PUZZLES.length];
      expect(next.target.shape, `${PUZZLES[i].id} then ${next.id}`).not.toBe(PUZZLES[i].target.shape);
    }
  });

  it('uses every shape about as often as every other', () => {
    const days = chosen.flatMap((w) => w.shapes);
    const uses = new Map(keys.map((k) => [k, 0]));
    for (const s of days) uses.set(s, uses.get(s)! + 1);
    // Held to within one of each other, but only among shapes that could have taken any
    // of those days at all -- a shape nothing in the ramp can hold has no share to miss.
    const eligible = keys.filter((k) => chosen.some((w) => w.shapes.some((_, d) => canHold(k, d))));
    const counts = eligible.map((k) => uses.get(k)!);
    expect(Math.max(...counts) - Math.min(...counts), JSON.stringify(Object.fromEntries(uses))).toBeLessThanOrEqual(1);
  });

  it('does not step through the shape list in order', () => {
    // Two days running whose shapes sit next to each other in `SHAPES` happen by chance
    // about one time in sixteen; a rotation that loops the list does it nearly every day.
    const days = chosen.flatMap((w) => w.shapes);
    let neighbours = 0;
    for (let i = 1; i < days.length; i++) {
      const step = Math.abs(keys.indexOf(days[i]) - keys.indexOf(days[i - 1]));
      if (step === 1 || step === keys.length - 1) neighbours++;
    }
    expect(neighbours / Math.max(1, days.length - 1)).toBeLessThan(0.25);
  });

  it('is what the planner would choose', () => {
    // So the three rules above are not satisfied by a hand edit the next `npm run plan`
    // would undo.
    expect(chosen.map((w) => w.shapes)).toEqual(
      shapeRun(weeks).filter((_, i) => !SHAPES_AS_SERVED.includes(weeks[i].image)),
    );
  });
});
