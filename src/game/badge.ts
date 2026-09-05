/**
 * What colour to put behind the shape in the corner badge.
 *
 * The badge is the only description of what is hidden, and it is drawn in the target's
 * *apparent* colour -- the fill composited over the paint it hides in -- because a
 * declared fill on its own says very little (see ReferenceCard and apparent.ts). That is
 * right, and it is also what makes a fixed background unsafe: the apparent colours run
 * the whole range, and sooner or later one of them lands on whatever the well is painted.
 *
 * It did. The Mona Lisa's Thursday is a grey-olive key, and against the old fixed
 * `#6d6862` well the badge showed a grey key on grey -- a player could see that something
 * was there and not what shape it was, which is the one thing the badge exists to say.
 *
 * The fix belongs here rather than in the fills. A fill is chosen to hide in the paint,
 * which is the whole game; forbidding the ones that happen to clash with a UI colour
 * would trade camouflage away to fix a contrast bug. The well is free to move instead,
 * and moving it reveals nothing the badge does not already show.
 *
 * Two neutral tones, and whichever is further from the fill wins. Two is enough: the
 * worst case is a fill sitting exactly between them, and even there the better of the two
 * clears 3:1 (the algebra: contrast against dark rises as the fill lightens while
 * contrast against light falls, and they cross at 3.06:1). A mid-tone third option would
 * only ever be chosen when it was the *least* readable of the three.
 */

/** Deliberately near-neutral, so the swatch still reads as the shape's own colour. */
const DARK = '#2b2825';
const LIGHT = '#d8d3cc';

function srgbToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance. Anything unparseable reads as mid-grey rather than throwing. */
export function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0.18;
  const n = parseInt(m[1], 16);
  return (
    0.2126 * srgbToLinear((n >> 16) & 255) +
    0.7152 * srgbToLinear((n >> 8) & 255) +
    0.0722 * srgbToLinear(n & 255)
  );
}

/** WCAG contrast ratio, 1 (identical) to 21 (black on white). */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** The well colour for a shape that will be drawn in `fill`. */
export function wellFor(fill: string): string {
  return contrast(fill, DARK) >= contrast(fill, LIGHT) ? DARK : LIGHT;
}
