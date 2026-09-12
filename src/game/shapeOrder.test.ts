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

  // Adding, inserting or re-planning a week must cost that week and nothing else, so the
  // pipeline never has to re-plan and re-tune paintings that did not change.
  function expectOnlyDealt(run: string[][], before: typeof weeks, w: number) {
    run.forEach((shapes, i) => {
      if (i !== w) expect(shapes, `${before[i].image} was re-dealt`).toEqual(before[i].shapes);
    });
    const image = before[w].image;
    const prev = run[(w - 1 + run.length) % run.length];
    const next = run[(w + 1) % run.length];
    expect(run[w][0], `${image} Monday repeats the Sunday before it`).not.toBe(prev[6]);
    expect(run[w][6], `${image} Sunday repeats the Monday after it`).not.toBe(next[0]);
    expect(new Set(run[w]).size, `${image} repeats a shape`).toBe(7);
    run[w].forEach((s, d) => expect(canHold(s, d), `${image} cannot turn ${s} on day ${d}`).toBe(true));
  }

  it('re-plans one week without re-dealing any other', () => {
    for (const week of chosen) expectOnlyDealt(shapeRun(weeks, [week.image]), weeks, weeks.indexOf(week));
  });

  it('deals an inserted week around its neighbours without moving them', () => {
    for (let at = SHAPES_AS_SERVED.length; at <= weeks.length; at++) {
      const inserted = [...weeks.slice(0, at), { image: 'inserted', shapes: [] }, ...weeks.slice(at)];
      expectOnlyDealt(shapeRun(inserted, ['inserted']), inserted, at);
    }
  });
});
