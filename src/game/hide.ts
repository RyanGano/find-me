import { fingerprint } from './build';
import { dayIndex, EPOCH, weekday } from './daily';
import { PUZZLES } from './puzzles';
import { getShape, SHAPES } from './shapes';
import type { Puzzle } from './types';

/**
 * A friend hide: a shape a player placed on a painting themselves, carried whole in a
 * link.
 *
 * Puzzles are data, not painted pixels, so the whole of one fits in a URL fragment and
 * needs no server. The fragment (`#h=`) rather than the query string is deliberate: a
 * fragment is never sent to the host or put in a referrer, so the answer only ever lives
 * in the link and in the page reading it.
 *
 * Nothing about a friend hide is recorded or counted. It is not a day, it has no
 * calendar slot, and it never reaches `storage.ts` or `count.ts`.
 */
export interface Hide {
  /** Asset id of the painting -- one the calendar has already served. */
  image: string;
  shape: string;
  cx: number;
  cy: number;
  size: number;
  angle: number;
  /** `#rrggbb`. */
  fill: string;
  opacity: number;
}

/** Bumped when the packed layout changes; a link from a newer build is refused politely. */
export const HIDE_VERSION = 1;

/**
 * How small and how faint a setter may go, in the painting's own pixels (every asset is
 * 2600 wide). Chosen by eye rather than measured: the shipped days run 16--40px and are
 * tuned against the painting in a browser, and a hide has no tuner behind it, so the
 * floor here sits well above the hardest of them. The ceiling is only there so a shape
 * still has to be looked for.
 */
export const HIDE_SIZE = { min: 30, max: 110 } as const;
export const HIDE_OPACITY = { min: 0.7, max: 1 } as const;

/** Softening, as every shipped day carries -- a razor vector edge gives itself away. */
const HIDE_BLUR = 0.5;

export interface Painting {
  image: string;
  title: string;
  artist: string;
  year: string;
  width: number;
  height: number;
  src: string;
}

/**
 * The paintings a hide may be set on: every week the calendar has reached, the current
 * one included. Never a week still to come, because showing a painting early gives away
 * the week it belongs to.
 *
 * Worked out from the calendar rather than from the array, the same way `daily.ts` maps
 * it: `PUZZLES` is laid out in weeks of seven, and the current week's index is how many
 * of them have begun.
 */
export function servedPaintings(now: Date = new Date()): Painting[] {
  const week = Math.floor((dayIndex(now) + weekday(EPOCH)) / 7);
  const weeks = PUZZLES.length / 7;
  const reached = Math.min(weeks, Math.max(0, week + 1));
  return Array.from({ length: reached }, (_, w) => {
    const p = PUZZLES[w * 7];
    return {
      image: p.image,
      title: p.title,
      artist: p.artist,
      year: p.year,
      width: p.width,
      height: p.height,
      src: p.src,
    };
  });
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** A hide held to the limits and to its painting's edges. */
export function clampHide(h: Hide, painting: Pick<Painting, 'width' | 'height'>): Hide {
  const size = Math.round(clamp(h.size, HIDE_SIZE.min, HIDE_SIZE.max));
  const half = size / 2;
  return {
    ...h,
    size,
    cx: Math.round(clamp(h.cx, half, painting.width - half)),
    cy: Math.round(clamp(h.cy, half, painting.height - half)),
    angle: Math.round(((((h.angle + 180) % 360) + 360) % 360) - 180),
    opacity: Math.round(clamp(h.opacity, HIDE_OPACITY.min, HIDE_OPACITY.max) * 100) / 100,
  };
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(code: string): string {
  const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/**
 * The hide as a fragment value. Base64 of a packed array: not secret, only not readable
 * at a glance in a message preview.
 */
export function encodeHide(h: Hide): string {
  const packed = [
    HIDE_VERSION,
    h.image,
    h.shape,
    Math.round(h.cx),
    Math.round(h.cy),
    Math.round(h.size),
    Math.round(h.angle),
    h.fill.replace(/^#/, '').toLowerCase(),
    Math.round(h.opacity * 100),
  ];
  return toBase64Url(JSON.stringify(packed));
}

export type Decoded =
  | { ok: true; hide: Hide; painting: Painting }
  | { ok: false; reason: 'malformed' | 'future' | 'painting' };

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A fragment value back to a hide, or the reason it cannot be played.
 *
 * The painting has to be one the calendar has reached -- judged a day ahead, so a link
 * made on a Monday morning in one timezone still opens on a Sunday night in another.
 * Size and opacity are held to the limits whatever the link says: an edited link cannot
 * make an impossible puzzle.
 */
export function decodeHide(code: string, now: Date = new Date()): Decoded {
  let packed: unknown;
  try {
    packed = JSON.parse(fromBase64Url(code));
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (!Array.isArray(packed) || typeof packed[0] !== 'number') return { ok: false, reason: 'malformed' };
  if (packed[0] > HIDE_VERSION) return { ok: false, reason: 'future' };
  if (packed[0] !== HIDE_VERSION || packed.length !== 9) return { ok: false, reason: 'malformed' };

  const [, image, shape, cx, cy, size, angle, fill, opacity] = packed;
  const numbers = [cx, cy, size, angle, opacity];
  if (
    typeof image !== 'string' ||
    typeof shape !== 'string' ||
    !Object.hasOwn(SHAPES, shape) ||
    typeof fill !== 'string' ||
    !/^[0-9a-f]{6}$/.test(fill) ||
    !numbers.every((n) => typeof n === 'number' && Number.isFinite(n))
  ) {
    return { ok: false, reason: 'malformed' };
  }

  const painting = servedPaintings(new Date(now.getTime() + DAY_MS)).find((p) => p.image === image);
  if (!painting) return { ok: false, reason: 'painting' };

  const hide = clampHide(
    { image, shape, cx, cy, size, angle, fill: `#${fill}`, opacity: opacity / 100 },
    painting,
  );
  return { ok: true, hide, painting };
}

/** The value of `h` in a location hash, if there is one. */
export function hideFromHash(hash: string): string | null {
  const value = new URLSearchParams(hash.replace(/^#/, '')).get('h');
  return value || null;
}

/** The link a hide travels in. Always the real site, so it plays for anyone. */
export function hideLink(h: Hide, site: string): string {
  return `${site}#h=${encodeHide(h)}`;
}

/**
 * A hide as a puzzle the hunt can run. Its id and version come from the same fingerprint
 * a shipped day's do, keyed on `hide`, so it can never collide with one.
 */
export function hidePuzzle(h: Hide, painting: Painting): Puzzle {
  const def = getShape(h.shape);
  const target = {
    shape: h.shape,
    cx: h.cx,
    cy: h.cy,
    size: h.size,
    angle: h.angle,
    fill: h.fill,
    opacity: h.opacity,
    blur: HIDE_BLUR,
    symmetry: def.symmetry,
  };
  const version = fingerprint(h.image, 'hide', target);
  return {
    id: `hide-${version}`,
    image: h.image,
    dayOfWeek: 0,
    title: painting.title,
    artist: painting.artist,
    year: painting.year,
    src: painting.src,
    width: painting.width,
    height: painting.height,
    thing: def.label,
    emoji: def.emoji,
    version,
    target,
  };
}

/** The paint under a hide, as far as telling a shape from it goes. */
export interface PaintStats {
  /** Mean color, 0--255 per channel. */
  mean: [number, number, number];
  /** RMS difference of the paint from its own mean, in CIE Lab: its busyness. */
  texture: number;
}

/**
 * sRGB to CIE Lab (D65). Differences are measured here rather than in RGB because RGB
 * counts a step in blue as heavily as one in green, and the eye does not: a cream shape
 * on yellow paint is a long way off in RGB and barely there to look at.
 */
function lab([r, g, b]: readonly number[]): [number, number, number] {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const [lr, lg, lb] = [lin(r), lin(g), lin(b)];
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const x = f((0.4124 * lr + 0.3576 * lg + 0.1805 * lb) / 0.95047);
  const y = f(0.2126 * lr + 0.7152 * lg + 0.0722 * lb);
  const z = f((0.0193 * lr + 0.1192 * lg + 0.9505 * lb) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

const CHROMA_WEIGHT = 0.5;

function distance(a: readonly number[], b: readonly number[]): number {
  const [la, aa, ba] = lab(a);
  const [lb, ab, bb] = lab(b);
  // Hue counts for half: in textured paint a shape is picked out by being lighter or
  // darker, and one that differs only in hue -- cream on yellow -- all but vanishes.
  return Math.hypot(la - lb, (aa - ab) * CHROMA_WEIGHT, (ba - bb) * CHROMA_WEIGHT);
}

/** Mean and texture of a block of RGBA pixels. */
export function paintStats(data: ArrayLike<number>): PaintStats {
  const n = Math.max(1, Math.floor(data.length / 4));
  let r = 0;
  let g = 0;
  let b = 0;
  for (let i = 0; i < n * 4; i += 4) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
  }
  const mean: [number, number, number] = [r / n, g / n, b / n];
  let sq = 0;
  for (let i = 0; i < n * 4; i += 4) {
    sq += distance([data[i], data[i + 1], data[i + 2]], mean) ** 2;
  }
  return { mean, texture: Math.sqrt(sq / n) };
}

function rgb(hex: string): [number, number, number] {
  const v = parseInt(hex.replace(/^#/, ''), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/**
 * How far a shape has to stand off the paint to be findable at all: an absolute floor,
 * and a multiple of the paint's own texture, since the same step that shows on a calm
 * glaze disappears into streaky brushwork. Chosen by eye on the served paintings, not
 * measured against play the way the daily ramp is.
 */
export const HIDE_CONTRAST = { floor: 20, texture: 1.6 } as const;

/**
 * The least opacity at which `fill` can be told from this paint -- never under
 * `HIDE_OPACITY.min` -- or `null` when not even full strength is enough, which is the
 * yellow-on-yellow case: a color that close to the paint cannot be found however solid
 * it is drawn.
 *
 * A translucent fill moves the paint toward itself by `opacity` of the way; the least
 * opacity is found by bisection, since Lab is not linear in that mix.
 */
export function minOpacityFor(fill: string, paint: PaintStats): number | null {
  const need = Math.max(HIDE_CONTRAST.floor, HIDE_CONTRAST.texture * paint.texture);
  // Translucent paint mixes in RGB, so the shown color is found there and then compared.
  const f = rgb(fill);
  const shown = (o: number) => paint.mean.map((m, i) => m + (f[i] - m) * o);
  if (distance(shown(HIDE_OPACITY.max), paint.mean) < need) return null;
  let lo = 0;
  let hi: number = HIDE_OPACITY.max;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (distance(shown(mid), paint.mean) >= need) hi = mid;
    else lo = mid;
  }
  const least = hi;
  return Math.ceil(Math.max(HIDE_OPACITY.min, least) * 100) / 100;
}

/**
 * A default paint for a spot: the painting's own color there, pushed lighter on dark
 * paint and darker on light, by as little as leaves it findable at `opacity`. The
 * exact color of the paint would be a shape that is not there at all.
 */
export function colourFor(paint: PaintStats, opacity = 0.8): string {
  const [r, g, b] = paint.mean;
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  let best = '';
  for (let step = 0.25; step <= 1.0001; step += 0.05) {
    const shift = lum < 0.5 ? step : -step;
    const push = (c: number) => Math.round(clamp(shift > 0 ? c + (255 - c) * shift : c * (1 + shift), 0, 255));
    best = `#${[r, g, b].map((c) => push(c).toString(16).padStart(2, '0')).join('')}`;
    const least = minOpacityFor(best, paint);
    if (least !== null && least <= opacity) break;
  }
  return best;
}
