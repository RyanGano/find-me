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

/**
 * How much of the painting a hiding place's colour has to itself -- and why the back half
 * of the week is owed the crowded colours rather than the rare ones.
 *
 * The rule above spreads a week across the canvas. It does not say which day gets which
 * of those places, and a week that satisfies it can still hand out its scarcest colour on
 * its hardest day. One shipped Sunday came back from play as the easiest day of its week:
 * every rung met -- small, low contrast, the right texture, well camouflaged against the
 * paint immediately around it -- and hiding in a colour that barely occurs on that canvas.
 * Once a player has clocked what colour they are hunting, a rare colour collapses the
 * search to a glance.
 *
 * That is a kind of company (see `company` in `difficulty.ts`) nothing could see. Company
 * measures grey-level lookalikes two to five shape-widths out: it asks whether the shape
 * has neighbours that resemble it, and it is blind to colour and blind to anything beyond
 * a few shape-widths. Prominence is the same question asked of the whole canvas at once --
 * after the player knows the colour, how much of the painting is still in play? A day in
 * the dominant paint leaves them the whole picture to search; a day in the one odd patch
 * leaves them a glance.
 *
 * So it belongs to the ramp: Monday and Tuesday may hide anywhere, and every day after
 * them has a floor that rises. It is the one difficulty lever that is a property of the
 * *week* rather than of the day -- the same odd patch of paint is a fair Monday and a
 * wasted Sunday -- which is why it is enforced where the week is chosen rather than where
 * a day is tuned. `tune-camouflage.mjs` cannot fix it afterwards: solving a lone speck of a
 * rare colour down to its scan target only makes a fainter lone speck of a rare colour.
 */

/**
 * Measured on the paint, not on the nine names above.
 *
 * `generalColour` is deliberately coarse, and for the spread rule that is right -- if
 * someone would call two patches "sort of sandy" they are one colour and the week should
 * not get credit for using both. For this rule the same coarseness is fatal: `sand` covers
 * pale cream and dark brown alike, so the day that prompted all of this measures as one of
 * the most abundant colours on its canvas while a player could not confuse it with any of
 * that paint. What matters here is not which word the paint gets but how much other paint a
 * player could mistake for it, so this measures distance in the paint itself.
 *
 * Lightness, saturation and hue, with hue weighted by how much colour is actually there --
 * two greys a hundred degrees apart are the same grey, and treating their hues as a
 * difference would credit a neutral painting with variety it does not have. At full
 * saturation the weighting makes ninety degrees of hue count for as much as the whole
 * lightness range, which is about right: cream and brown are near in hue and far apart in
 * lightness, and it is the lightness that tells them apart.
 */
export type Hsl = readonly [number, number, number];

export function colourDistance(a: Hsl, b: Hsl): number {
  const chroma = (hueGap(a[0], b[0]) / 180) * Math.min(a[1], b[1]) * 2;
  return Math.hypot(a[2] - b[2], a[1] - b[1], chroma);
}

/**
 * How near two patches of paint have to be to count as the same hunt.
 *
 * Set off the shipped set rather than picked: at this radius the paintings' best colours
 * hold 37% to 77% of their canvas, which is the right shape of answer -- a dominant colour
 * should be most of a painting without being all of it. Widen it to 0.3 and every
 * painting's best is over 90%, so the measure stops distinguishing anything; narrow it to
 * 0.1 and one end of a single stretch of paint lands in a different bucket from the other.
 */
export const COLOUR_RADIUS = 0.18;

/**
 * The sweep the population is measured on: one window in the middle of the ramp's size
 * ladder, on a regular grid, for the whole week at once.
 *
 * One reading for all seven days for the same reason `survey()` in `plan-weeks.mjs`
 * measures texture once: a day's own size would move these numbers barely at all and
 * would make Monday's prominence and Sunday's two different quantities, which the ramp
 * would then compare anyway.
 */
export const PROMINENCE_WINDOW = 32;
export const PROMINENCE_STEP = 48;

export interface Pixels {
  data: Uint8Array | Uint8ClampedArray | Buffer | number[];
  info: { width: number; height: number; channels: number };
}

/** Mean colour of a square of the painting, in image pixels. */
export function meanColour({ data, info }: Pixels, cx: number, cy: number, side: number): Rgb {
  const half = side / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let y = Math.max(0, Math.round(cy - half)); y < Math.min(info.height, cy + half); y++) {
    for (let x = Math.max(0, Math.round(cx - half)); x < Math.min(info.width, cx + half); x++) {
      const i = (y * info.width + x) * info.channels;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      n++;
    }
  }
  return [r / n, g / n, b / n];
}

/**
 * A painting's prominence scale, and the one reading a day is held to.
 *
 * `prominence(paint)` runs 0 to 1: the share of the painting's usable paint a player could
 * mistake for this paint, divided by the largest such share the canvas offers. It is
 * normalised per painting on purpose. The Mona Lisa is nearly all one colour and Renoir's
 * boaters are four colours in earnest; an absolute floor would be trivial on Renoir and
 * unreachable on Leonardo, and the question the ramp is actually asking -- is this one of
 * the crowded colours *here* -- is relative by nature.
 *
 * Windows that are nearly dead black or blown white are left out of the population,
 * mirroring the same refusal in `survey()`. No shape can hide in them, so counting them
 * would credit a painting with hiding places it does not have: a canvas that is half black
 * shadow does not get to call its shadow a crowded colour.
 */
export function prominenceOn(pixels: Pixels): (paint: Rgb) => number {
  const { info } = pixels;
  const half = PROMINENCE_WINDOW / 2;
  const population: Hsl[] = [];
  for (let y = half; y < info.height - half; y += PROMINENCE_STEP) {
    for (let x = half; x < info.width - half; x += PROMINENCE_STEP) {
      const paint = meanColour(pixels, x, y, PROMINENCE_WINDOW);
      // Luma, the reading `survey()` refuses dead-black and blown-white paint on.
      const luma = 0.299 * paint[0] + 0.587 * paint[1] + 0.114 * paint[2];
      if (luma < 28 || luma > 228) continue;
      population.push(toHsl(paint));
    }
  }
  const share = (hsl: Hsl) => {
    let n = 0;
    for (const other of population) if (colourDistance(hsl, other) <= COLOUR_RADIUS) n++;
    return n / population.length;
  };
  const best = Math.max(...population.map(share));
  return (paint: Rgb) => share(toHsl(paint)) / best;
}

/**
 * The floor each day's hiding place must clear, Monday first.
 *
 * Monday and Tuesday are unconstrained, and that is the point rather than a gap: the odd
 * patch of paint nobody else can use makes a perfectly good gentle day, and penning it in
 * with everything else would waste it. From Wednesday on the floor rises, so that the days
 * asking for a long hunt are the days with somewhere to hunt.
 *
 * The numbers are what the shipped set says is reachable, not an ambition. The ceiling is
 * 1 by construction, and Sunday is asked for rather more than half of it. Pushing the tail
 * higher starts refusing paintings instead of improving weeks, and this rule should never
 * be the reason a painting is turned down -- the spread rule above already is that, and
 * this one only decides which of the places a week already has goes on which day.
 */
export const MIN_PROMINENCE = [0, 0, 0.2, 0.3, 0.4, 0.5, 0.6];
