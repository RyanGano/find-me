import { getShape } from './shapes';
import type { Puzzle } from './types';

/**
 * What colour the hidden shape *actually* is once it is painted into the picture.
 *
 * The badge is the only description of what the player is hunting for, so it is drawn
 * in the target's own fill. But `fill` is only half of how a shape is painted: most
 * days carry an opacity and a blend mode, and a screened or multiplied fill can land a
 * very long way from the swatch it started as -- Hokusai's Monday star is declared as
 * near-white cream and arrives on the canvas as dark blue, because it multiplies into
 * the wave. Sending someone to look for cream is worse than saying nothing.
 *
 * So the badge asks the render what colour it ended up. This composites the shape over
 * the paint it is actually hiding in, exactly as the stage does -- same fill, same
 * opacity, same blend -- and averages the result over the shape's own mask, so a
 * crescent is measured across the crescent rather than the square it sits in.
 */
const SAMPLE = 64;

/** Rounds a sampled colour back to a CSS hex string. */
function hex(r: number, g: number, b: number): string {
  const part = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
}

function canvas(size: number): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  const el = document.createElement('canvas');
  el.width = size;
  el.height = size;
  return el.getContext('2d', { willReadFrequently: true });
}

/** Lays the shape's path into the context at sample scale, rotated as it is hidden. */
function tracePath(shape: string, angle: number): Path2D {
  const m = new DOMMatrix()
    .translateSelf(SAMPLE / 2, SAMPLE / 2)
    .rotateSelf(angle)
    .scaleSelf(SAMPLE / 100)
    .translateSelf(-50, -50);
  const path = new Path2D();
  path.addPath(new Path2D(getShape(shape).path), m);
  return path;
}

/**
 * The colour the target reads as on the canvas, or null when it cannot be measured --
 * no DOM, no 2D context, or an image that did not load. Callers fall back to the
 * declared fill, which is what the badge showed before.
 */
export function measureApparentFill(puzzle: Puzzle, image: CanvasImageSource): string | null {
  const { target } = puzzle;
  if (!target.fill) return null;

  const shot = canvas(SAMPLE);
  const mask = canvas(SAMPLE);
  if (!shot || !mask) return null;

  const def = getShape(target.shape);
  const rule = (def.fillRule ?? 'evenodd') as CanvasFillRule;

  // The paint underneath, blown up to the sample square.
  const half = target.size / 2;
  try {
    shot.drawImage(
      image,
      target.cx - half,
      target.cy - half,
      target.size,
      target.size,
      0,
      0,
      SAMPLE,
      SAMPLE,
    );
  } catch {
    return null;
  }

  // The shape over it, painted the way the stage paints it. Blur is left out on
  // purpose: it softens the edge without moving the colour inside.
  const path = tracePath(target.shape, target.angle);
  shot.save();
  shot.globalAlpha = target.opacity ?? 1;
  shot.globalCompositeOperation = (target.blend ?? 'source-over') as GlobalCompositeOperation;
  shot.fillStyle = target.fill;
  shot.fill(path, rule);
  shot.restore();

  // Weights: only the pixels the shape actually covers count towards its colour.
  mask.fillStyle = '#fff';
  mask.fill(tracePath(target.shape, target.angle), rule);

  let pixels: Uint8ClampedArray;
  let weights: Uint8ClampedArray;
  try {
    pixels = shot.getImageData(0, 0, SAMPLE, SAMPLE).data;
    weights = mask.getImageData(0, 0, SAMPLE, SAMPLE).data;
  } catch {
    return null;
  }

  let r = 0;
  let g = 0;
  let b = 0;
  let total = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    const w = weights[i + 3];
    if (!w) continue;
    r += pixels[i] * w;
    g += pixels[i + 1] * w;
    b += pixels[i + 2] * w;
    total += w;
  }
  if (!total) return null;
  return hex(r / total, g / total, b / total);
}
