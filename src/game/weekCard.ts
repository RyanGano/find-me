import { RAMP } from './difficulty';
import type { Mark } from './history';
import { SITE_URL } from './share';

/**
 * The picture a player shares when a week is done: the painting, its title and artist,
 * the seven marks and the address. Drawn to a canvas in the page.
 *
 * It is given a `CardWeek` and nothing else. There is no puzzle, no day and no target in
 * that type, so the card cannot ring, crop or highlight where anything was hidden -- the
 * calendar comes round again, and a finished week is not a safe week to spoil.
 * `gallery.test.ts` holds this file to that.
 */
export interface CardWeek {
  title: string;
  artist: string;
  year: string;
  marks: Mark[];
  full: boolean;
}

/** Portrait, 4:5: the shape that takes the most room in a feed. */
export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;

const BG = '#12100e';
const RAISED = '#1c1916';
const LINE = '#332e28';
const TEXT = '#f0e9df';
const MUTED = '#a39a8d';
const ACCENT = '#e8b647';
const OK = '#6fca7a';
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** Draw the card. `painting` must already be loaded. */
export function drawWeekCard(ctx: CanvasRenderingContext2D, painting: HTMLImageElement, week: CardWeek): void {
  const W = CARD_WIDTH;
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, CARD_HEIGHT);

  // The painting, whole, in a frame -- gold for a full week.
  const box = { x: 90, y: 80, w: W - 180, h: 800 };
  const k = Math.min(box.w / painting.naturalWidth, box.h / painting.naturalHeight);
  const pw = painting.naturalWidth * k;
  const ph = painting.naturalHeight * k;
  const px = box.x + (box.w - pw) / 2;
  const py = box.y + (box.h - ph) / 2;
  const border = week.full ? 14 : 6;
  ctx.fillStyle = week.full ? ACCENT : LINE;
  ctx.fillRect(px - border, py - border, pw + 2 * border, ph + 2 * border);
  ctx.drawImage(painting, px, py, pw, ph);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = TEXT;
  ctx.font = `600 46px ${FONT}`;
  ctx.fillText(fit(ctx, week.title, W - 160), W / 2, 970);
  ctx.fillStyle = MUTED;
  ctx.font = `32px ${FONT}`;
  ctx.fillText(fit(ctx, `${week.artist} · ${week.year}`, W - 160), W / 2, 1020);

  // The seven marks, Monday first, under their day letters.
  const size = 76;
  const gap = 18;
  const left = (W - (7 * size + 6 * gap)) / 2;
  ctx.font = `600 26px ${FONT}`;
  week.marks.forEach((mark, i) => {
    const x = left + i * (size + gap);
    ctx.fillStyle = MUTED;
    ctx.fillText(RAMP[i].label[0], x + size / 2, 1090);
    drawMark(ctx, mark, x, 1110, size);
  });

  ctx.fillStyle = MUTED;
  ctx.font = `30px ${FONT}`;
  ctx.fillText(SITE_URL.replace(/^https?:\/\//, '').replace(/\/$/, ''), W / 2, 1290);
}

function drawMark(ctx: CanvasRenderingContext2D, mark: Mark, x: number, y: number, size: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x + 2, y + 2, size - 4, size - 4, 12);
  if (mark === 'solved') {
    ctx.fillStyle = OK;
    ctx.fill();
  } else if (mark === 'gave-up') {
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = MUTED;
    ctx.fill();
  } else {
    ctx.fillStyle = RAISED;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = mark === 'today' ? ACCENT : LINE;
    if (mark !== 'missed' && mark !== 'today') ctx.setLineDash([10, 8]);
    ctx.stroke();
  }
  ctx.restore();
}

/** Shorten a line with an ellipsis until it fits. */
function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > max) s = s.slice(0, -1);
  return `${s.trimEnd()}…`;
}

/** Load the painting and draw the card to a JPEG. Null if anything goes wrong. */
export async function renderWeekCard(src: string, week: CardWeek): Promise<Blob | null> {
  try {
    const painting = new Image();
    painting.decoding = 'async';
    painting.src = src;
    await painting.decode();
    const canvas = document.createElement('canvas');
    canvas.width = CARD_WIDTH;
    canvas.height = CARD_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    drawWeekCard(ctx, painting, week);
    return await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
  } catch {
    return null;
  }
}

/** A file name for the card, from the painting's title. */
export function cardFileName(title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `find-me-${slug || 'week'}.jpg`;
}

/**
 * Share the card as an image where the device can, and save it where it cannot.
 *
 * The blob has to be ready before the tap: a share sheet only opens inside the tap that
 * asked for it, and loading and drawing a painting takes longer than a browser lets that
 * last. So the card is rendered when the button appears, and this does no waiting.
 */
export async function shareWeekCard(blob: Blob, title: string): Promise<'shared' | 'saved' | 'failed'> {
  const file = new File([blob], cardFileName(title), { type: 'image/jpeg' });
  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: SITE_URL });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'shared';
    }
  }
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return 'saved';
  } catch {
    return 'failed';
  }
}
