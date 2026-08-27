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
 *
 * It moves **lightness only**, and keeps the hue and the saturation of the paint it is
 * hiding in. An earlier version rode straight down the RGB line towards black or white,
 * which is hue-preserving as arithmetic and grey as an experience: every shape in the
 * Mona Lisa's week came out a shade of putty. A hidden shape should look like the
 * painting's own colour under a different light, not like a neutral sticker, so the
 * chroma is carried across explicitly and floored, which also stops muted paint from
 * producing a shape with no colour in it at all.
 *
 * The colour is sampled over the shape's own footprint rather than half again its size.
 * A wider window averages in whatever is next door, and averaging paint is how you make
 * grey.
 *
 * Two things need the upper half of the range. Monday has no transparency to spend, so
 * this is its only knob. And on a painting with little quiet paint, a shape at full
 * opacity and push 1 can still fail to reach the contrast its rung asks for; a fill
 * further from the paint is a more honest answer than a rung quietly missed.
 */
function toHsl([r, g, b]) {
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
  return [h, s, l];
}

function fromHsl(h, s, l) {
  if (s < 1e-6) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return [channel(h + 1 / 3) * 255, channel(h) * 255, channel(h - 1 / 3) * 255];
}

export function paintFor(rgb, info, cx, cy, size, push = 1) {
  const paint = colourAt(rgb, info, cx, cy, Math.round(size));
  const lum = 0.299 * paint[0] + 0.587 * paint[1] + 0.114 * paint[2];
  const k = Math.max(0, Math.min(2, push));
  const [hue, chroma, light] = toHsl(paint);
  // Muted paint still gets a shape with some colour in it, and vivid paint keeps its own.
  const sat = Math.min(0.85, Math.max(chroma, 0.22));
  const lerp = (a, b, t) => a + (b - a) * t;

  if (lum >= 128) {
    // Multiply: identity is white, and the shape reads as shadow falling on the paint.
    const target = k <= 1 ? lerp(1, light * 0.45, k) : lerp(light * 0.45, 0, k - 1);
    return { blend: 'multiply', fill: hex(fromHsl(hue, sat, target)) };
  }
  // Screen: identity is black, and the shape reads as light falling on the paint.
  const raised = light + (1 - light) * 0.55;
  const target = k <= 1 ? lerp(0, raised, k) : lerp(raised, 1, k - 1);
  return { blend: 'screen', fill: hex(fromHsl(hue, sat, target)) };
}
