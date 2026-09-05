import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import {
  MAX_DAYS_PER_COLOUR,
  MIN_COLOURS_PER_WEEK,
  blendOver,
  generalColour,
  hueGap,
  parseHex,
  toHsl,
  type GeneralColour,
  type Rgb,
} from './palette';
import { IMAGES, PUZZLES } from './puzzles';

/**
 * A week has to be seven different things, not one thing seven times.
 *
 * Hokusai's week shipped with five of its seven days inside two degrees of the same hue,
 * every one of them in the empty cream sky, and none at all in the water, the foam or the
 * boats. Nothing was broken: every day measured correctly against its own rung, and the
 * badge honestly reported the colour it found. The failure was only visible across the
 * week, which is the one view no other check has.
 *
 * `plan-weeks.mjs` picks hiding places under this rule, so in principle it should never
 * fire. It is here because the day lines are editable by hand, and because a rule that
 * lives only in a script is a rule that can be quietly lost in a refactor. A failure is
 * fixed by re-planning the week -- `npm run plan -- <image>`, then
 * `npm run camouflage -- --solve <image>` -- or, if the painting really does have only
 * three colours in it, by replacing the painting.
 */

/** Mean paint over the shape's own footprint: the window `plan-weeks.mjs` measures. */
function paintUnder(
  pixels: Buffer,
  info: { width: number; height: number; channels: number },
  cx: number,
  cy: number,
  size: number,
): Rgb {
  const half = size / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let y = Math.max(0, Math.round(cy - half)); y < Math.min(info.height, cy + half); y++) {
    for (let x = Math.max(0, Math.round(cx - half)); x < Math.min(info.width, cx + half); x++) {
      const i = (y * info.width + x) * info.channels;
      r += pixels[i];
      g += pixels[i + 1];
      b += pixels[i + 2];
      n++;
    }
  }
  return [r / n, g / n, b / n];
}

const raw = new Map<string, { data: Buffer; info: { width: number; height: number; channels: number } }>();
async function pixels(id: string) {
  if (!raw.has(id)) {
    raw.set(id, await sharp(`public/puzzles/${id}.jpg`).raw().toBuffer({ resolveWithObject: true }));
  }
  return raw.get(id)!;
}

describe('a week of colours', () => {
  for (const image of IMAGES) {
    const week = PUZZLES.filter((p) => p.image === image.id);

    it(`${image.id} hides its week in ${MIN_COLOURS_PER_WEEK} different colours`, async () => {
      const { data, info } = await pixels(image.id);

      const counts = new Map<GeneralColour, string[]>();
      for (const puzzle of week) {
        const { cx, cy, size } = puzzle.target;
        const colour = generalColour(paintUnder(data, info, cx, cy, size));
        counts.set(colour, [...(counts.get(colour) ?? []), puzzle.id]);
      }

      const spread = [...counts].map(([colour, ids]) => `${colour}: ${ids.join(', ')}`).join('\n  ');

      for (const [colour, ids] of counts) {
        expect(
          ids.length,
          `${image.id} hides ${ids.length} of its seven days in ${colour} paint ` +
            `(${ids.join(', ')}) -- the week reads as one puzzle played over\n  ${spread}`,
        ).toBeLessThanOrEqual(MAX_DAYS_PER_COLOUR);
      }

      expect(
        counts.size,
        `${image.id} hides its whole week in only ${counts.size} colour(s)\n  ${spread}`,
      ).toBeGreaterThanOrEqual(MIN_COLOURS_PER_WEEK);
    });
  }

  /**
   * The assumption the rule above rests on.
   *
   * Variety is measured on the paint because the paint is the half of it the tuner cannot
   * move. That is only a way of describing what the *player* is sent after for as long as
   * the badge keeps the hue of the paint it came out of -- which it does by construction,
   * since `paintFor` builds every fill from the local hue and moves lightness only. If a
   * change to how shapes are coloured ever broke that, a week could pass the rule above
   * and still show a player seven badges the same colour, so it is pinned here rather
   * than trusted. The rotation currently sits within ten degrees; twenty is the guard.
   */
  it('paints every shape in the hue of the paint it hides in', async () => {
    const drift: string[] = [];
    for (const puzzle of PUZZLES) {
      const { cx, cy, size, fill, opacity, blend } = puzzle.target;
      if (!fill) continue;
      const { data, info } = await pixels(puzzle.image);
      const paint = paintUnder(data, info, cx, cy, size);
      const badge = blendOver(paint, parseHex(fill), opacity ?? 1, blend ?? 'source-over');
      const [ph, ps] = toHsl(paint);
      const [bh, bs] = toHsl(badge);
      // Hue is meaningless in paint with no colour in it, and those days are named for
      // being neutral rather than for their hue anyway.
      if (ps < 0.15 || bs < 0.15) continue;
      const gap = hueGap(ph, bh);
      if (gap > 20) drift.push(`${puzzle.id}: paint h${Math.round(ph)}, badge h${Math.round(bh)}`);
    }
    expect(drift, `the badge no longer shows the hue of its paint:\n  ${drift.join('\n  ')}`).toEqual([]);
  });
});
