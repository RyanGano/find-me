/**
 * What colour a hiding place is, so that "a week of seven different things" is a property
 * the build can check rather than something a curator has to hold in their head.
 *
 * Nothing used to check it, and it showed. Hokusai's week shipped with five of its seven
 * days inside two degrees of the same hue, every one in the empty cream sky, and none at
 * all in the water, the foam or the boats. Every day measured correctly against its own
 * rung; the failure was only visible across the week, which was the one view nothing had.
 *
 * **This names the paint, not the shape painted on to it**, and that is the whole trick.
 * The obvious thing to name is the badge -- the fill composited over the paint, which is
 * what a player is actually shown, and what `apparent.ts` measures for the page. It does
 * not work as a rule, because the badge is not settled until `tune-camouflage.mjs` has
 * solved the day in a browser, and it solves opacity anywhere from 0.17 to 0.99 for
 * camouflage reasons that have nothing to do with colour. A week planned as four colours
 * came back from the tuner as three. A rule the planner cannot plan against is not a rule.
 *
 * The paint can be named, because tuning never moves it: the tuner rewrites `fill`,
 * `opacity`, `ratio` and `scan`, never `cx` or `cy`. And naming it is not a dodge, because
 * `paintFor` builds every fill from the paint's own hue and floors its saturation -- the
 * shape is meant to look like the painting's own colour under a different light. So the
 * badge's hue *is* the paint's hue, within ten degrees across the whole rotation, which
 * `variety.test.ts` pins rather than assumes. What tuning moves is how light or dark the
 * badge ends up, and that is exactly what these names avoid depending on.
 *
 * Naming the paint also answers the second half of the same complaint. Days that were all
 * one colour were all in one place, because a stretch of paint one colour throughout is a
 * region of the picture: Hokusai's sky, his water, his foam, his boats. Spreading a week
 * across four colours of paint spreads it across the painting, which raw distance did not
 * -- the days that shipped were already 400px apart and still all in the sky.
 */

/**
 * A closed list, and a deliberately coarse one.
 *
 * An earlier version had `tan`, `brown` and `yellow` as three separate things, and
 * measured across the rotation that split let two days sit side by side in the same
 * stretch of beige and count as two different colours -- arithmetic agreeing with itself
 * rather than anything a player would recognise. If someone would call both of them "sort
 * of sandy", they are one colour here, and `cyan` went into `blue` for the same reason.
 */
export const GENERAL_COLOURS = [
  'black',
  'white',
  'grey',
  'red',
  'sand',
  'green',
  'blue',
  'purple',
  'pink',
] as const;

export type GeneralColour = (typeof GENERAL_COLOURS)[number];

export type Rgb = readonly [number, number, number];

/** Hue in degrees, saturation and lightness in 0..1. */
export function toHsl([r, g, b]: Rgb): [number, number, number] {
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  const d = max - min;
  if (d < 1e-6) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === R) h = ((G - B) / d + (G < B ? 6 : 0)) / 6;
  else if (max === G) h = ((B - R) / d + 2) / 6;
  else h = ((R - G) / d + 4) / 6;
  return [h * 360, s, l];
}

/**
 * The one word for a patch of paint.
 *
 * Very pale and very dark paint is named for that first, and only weakly-coloured paint
 * qualifies -- the thresholds are set off the rotation's own spread rather than picked.
 * Hokusai's foam sits at lightness 0.87 to 0.90 and saturation 0.26 to 0.30, and three
 * days of it are three days in the same foam whatever their hues do; his Monday sky is
 * nearly as light at 0.84 but properly coloured at 0.62, and is sand. At the other end
 * Bruegel's shadows run to lightness 0.07 and van Gogh's night to 0.11, while de Heem's
 * dark crimson holds saturation 0.47 at lightness 0.14 and stays red, because it reads as
 * a colour and not as an absence of one.
 */
export function generalColour(paint: Rgb): GeneralColour {
  const [h, s, l] = toHsl(paint);
  if (l > 0.8 && s < 0.45) return 'white';
  if (l < 0.16 && s < 0.4) return 'black';
  if (s < 0.15) return 'grey';
  if (h < 16 || h >= 345) return 'red';
  if (h < 70) return 'sand';
  if (h < 165) return 'green';
  if (h < 255) return 'blue';
  if (h < 290) return 'purple';
  return 'pink';
}

/**
 * One pixel of paint with a shape's fill laid over it, exactly as the stage composites it.
 *
 * Not what the variety rule is measured on -- see above -- but what `variety.test.ts` uses
 * to hold the assumption underneath it: that a badge still shows the hue of the paint it
 * came out of. If that ever stopped being true, naming the paint would stop being a way of
 * naming what the player is sent to look for.
 *
 * Kept here rather than in `apparent.ts` because that one measures the live render through
 * a 2D canvas and needs a DOM. Averaging the paint first and blending once is exact for
 * both blends used, since `multiply` and `screen` are each linear in the paint.
 */
export function blendOver(paint: Rgb, fill: Rgb, opacity: number, blend: string): Rgb {
  const out: number[] = [];
  for (let i = 0; i < 3; i++) {
    const a = paint[i] / 255;
    const b = fill[i] / 255;
    const mixed = blend === 'multiply' ? a * b : blend === 'screen' ? 1 - (1 - a) * (1 - b) : b;
    out.push(255 * (a + (mixed - a) * opacity));
  }
  return out as unknown as Rgb;
}

export function parseHex(hex: string): Rgb {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

/** The smaller angle between two hues, in degrees. */
export function hueGap(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * How many days of a week may hide in one colour, and therefore how many colours a week
 * needs. Seven days at two apiece is four colours; a painting that cannot offer four is
 * not a painting this game can run a week on.
 */
export const MAX_DAYS_PER_COLOUR = 2;
export const MIN_COLOURS_PER_WEEK = 4;
