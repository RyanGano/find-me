/**
 * How a hidden shape is coloured, shared by the planner and the tuner so the two can
 * never drift apart.
 *
 * A shape that differs from its surroundings in hue reads as a sticker; one that differs
 * in brightness reads as light falling on the painting, which is what the eye forgives.
 * So dark paint gets a lighter shape screened on to it, light paint gets a darker one
 * multiplied in, and both keep the local hue.
 */

/** Mean colour of a square of the painting, in image pixels. */
export function colourAt(rgb, info, cx, cy, side) {
  const half = side / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let y = Math.max(0, Math.round(cy - half)); y < Math.min(info.height, cy + half); y++) {
    for (let x = Math.max(0, Math.round(cx - half)); x < Math.min(info.width, cx + half); x++) {
      const i = (y * info.width + x) * info.channels;
      r += rgb[i];
      g += rgb[i + 1];
      b += rgb[i + 2];
      n++;
    }
  }
  return [r / n, g / n, b / n];
}

export function hex(c) {
  return '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

/**
 * The blend mode and fill for a shape hidden at (cx, cy).
 *
 * `push` is how visible the shape is, from 0 to 2. 1 is the working default, a fill a
 * little over halfway from the paint to white or black; 2 is as far as colour goes, pure
 * white or pure black; **0 is genuinely invisible**.
 *
 * That last point is where an earlier version of this was wrong, and wrong in a way that
 * looked right. It ramped the fill from the paint's own colour, on the reasoning that a
 * shape painted the same colour as what is under it cannot be seen. Under a blend mode
 * that is false: `screen` composites to `1-(1-a)(1-b)`, so filling a shape with the
 * mid-grey it sits on still lifts every pixel of it towards white. The knob's zero was
 * not zero, Monday could not be dialled below a ratio of 5.7 on Turner's flat sky, and
 * the search dutifully reported that as the gentlest available.
 *
 * So the ramp runs from the blend's **identity** -- black for `screen`, white for
 * `multiply` -- through the paint-derived fill at 1, on to the opposite extreme at 2.
 * Scaling towards those endpoints keeps the paint's hue on the way.
 *
 * Two things need the upper half of that range. Monday has no transparency to spend, so
 * this is its only knob. And on a painting with little quiet paint, a shape at full
 * opacity and push 1 can still fail to reach the contrast its rung asks for; a fill
 * further from the paint is a more honest answer than a rung quietly missed.
 */
export function paintFor(rgb, info, cx, cy, size, push = 1) {
  const paint = colourAt(rgb, info, cx, cy, Math.round(size * 1.4));
  const lum = 0.299 * paint[0] + 0.587 * paint[1] + 0.114 * paint[2];
  const k = Math.max(0, Math.min(2, push));
  const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

  // Blue moves slightly further than red and green. Paint pushed towards a neutral
  // extreme reads as light or shadow falling on the painting, which the eye forgives;
  // paint pushed towards a warmer version of itself reads as a different pigment.
  const dark = paint.map((v, i) => v * (1 - (i === 2 ? 0.6 : 0.55)));
  const light = paint.map((v, i) => v + (255 - v) * (i === 2 ? 0.6 : 0.55));

  if (lum >= 128) {
    const fill = k <= 1 ? lerp([255, 255, 255], dark, k) : lerp(dark, [0, 0, 0], k - 1);
    return { blend: 'multiply', fill: hex(fill) };
  }
  const fill = k <= 1 ? lerp([0, 0, 0], light, k) : lerp(light, [255, 255, 255], k - 1);
  return { blend: 'screen', fill: hex(fill) };
}
