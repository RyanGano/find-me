import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { dayIndex, EPOCH, weekday } from './daily';
import {
  colourFor,
  decodeHide,
  encodeHide,
  HIDE_OPACITY,
  HIDE_SIZE,
  HIDE_VERSION,
  hideFromHash,
  hideLink,
  hidePuzzle,
  servedPaintings,
  type Hide,
} from './hide';
import { PUZZLES } from './puzzles';
import { SHAPES } from './shapes';

const NOW = new Date(2026, 8, 10);
const first = servedPaintings(NOW)[0];

function sample(over: Partial<Hide> = {}): Hide {
  return {
    image: first.image,
    shape: 'star',
    cx: 400,
    cy: 600,
    size: 50,
    angle: -30,
    fill: '#a1b2c3',
    opacity: 0.7,
    ...over,
  };
}

function pack(value: unknown): string {
  return btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

describe('friend hides', () => {
  it('round-trips every shape through the link', () => {
    for (const shape of Object.keys(SHAPES)) {
      const hide = sample({ shape });
      const back = decodeHide(encodeHide(hide), NOW);
      expect(back.ok, shape).toBe(true);
      if (back.ok) expect(back.hide).toEqual(hide);
    }
  });

  it('keeps the answer out of plain sight', () => {
    const code = encodeHide(sample());
    expect(code).not.toContain(first.image);
    expect(code).not.toContain('star');
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('reads the hide out of a fragment and puts it on the real site', () => {
    const link = hideLink(sample(), 'https://example.test/');
    expect(link.startsWith('https://example.test/#h=')).toBe(true);
    expect(hideFromHash(new URL(link).hash)).toBe(encodeHide(sample()));
    expect(hideFromHash('')).toBeNull();
  });

  it('refuses a malformed link politely', () => {
    for (const code of ['', 'not base64 !!', pack({}), pack([1, first.image]), pack([1, first.image, 'nope', 1, 1, 50, 0, 'aabbcc', 70]), pack([1, first.image, 'star', 1, 1, 50, 0, 'red', 70])]) {
      expect(decodeHide(code, NOW)).toEqual({ ok: false, reason: 'malformed' });
    }
  });

  it('refuses a link from a newer build', () => {
    const code = pack([HIDE_VERSION + 1, first.image, 'star', 1, 1, 50, 0, 'aabbcc', 70]);
    expect(decodeHide(code, NOW)).toEqual({ ok: false, reason: 'future' });
  });

  it('holds size and opacity to the limits whatever the link says', () => {
    const tiny = decodeHide(encodeHide(sample({ size: 2, opacity: 0.01 })), NOW);
    const huge = decodeHide(encodeHide(sample({ size: 900, opacity: 3 })), NOW);
    expect(tiny.ok && huge.ok).toBe(true);
    if (tiny.ok) {
      expect(tiny.hide.size).toBe(HIDE_SIZE.min);
      expect(tiny.hide.opacity).toBe(HIDE_OPACITY.min);
    }
    if (huge.ok) {
      expect(huge.hide.size).toBe(HIDE_SIZE.max);
      expect(huge.hide.opacity).toBe(HIDE_OPACITY.max);
    }
  });

  it('keeps the shape on its painting', () => {
    const off = decodeHide(encodeHide(sample({ cx: -500, cy: 99999 })), NOW);
    expect(off.ok).toBe(true);
    if (off.ok) {
      expect(off.hide.cx).toBeGreaterThanOrEqual(off.hide.size / 2);
      expect(off.hide.cy).toBeLessThanOrEqual(first.height - off.hide.size / 2);
    }
  });

  it('only offers paintings the calendar has already reached', () => {
    for (const now of [EPOCH, NOW, new Date(2027, 2, 1)]) {
      const week = Math.floor((dayIndex(now) + weekday(EPOCH)) / 7);
      const offered = servedPaintings(now).map((p) => p.image);
      const expected = PUZZLES.filter((_, i) => Math.floor(i / 7) <= week && i % 7 === 0).map((p) => p.image);
      expect(offered).toEqual(expected);
    }
  });

  it('refuses a painting the calendar has not reached yet', () => {
    const served = servedPaintings(EPOCH).map((p) => p.image);
    const later = PUZZLES.find((p) => !served.includes(p.image));
    if (!later) return;
    const code = encodeHide(sample({ image: later.image }));
    expect(decodeHide(code, EPOCH)).toEqual({ ok: false, reason: 'painting' });
  });

  it('never shares an id with a shipped day', () => {
    const p = hidePuzzle(sample(), first);
    expect(PUZZLES.some((d) => d.id === p.id || d.version === p.version)).toBe(false);
    expect(p.target.symmetry).toBe(SHAPES.star.symmetry);
  });

  it('never defaults to the exact colour of the paint', () => {
    for (const [r, g, b] of [[0, 0, 0], [255, 255, 255], [120, 80, 40], [200, 190, 170]]) {
      const hex = colourFor(r, g, b);
      expect(hex).toMatch(/^#[0-9a-f]{6}$/);
      const exact = `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
      expect(hex).not.toBe(exact);
    }
  });

  it('cannot record or count anything', () => {
    // A friend hide is not a day: it may never reach the player's store, the backup
    // cookie, the tally or the bench's answers. Checked on the imports, so a later edit
    // that reached for one would fail here rather than in someone's streak.
    for (const file of ['src/FriendHunt.tsx', 'src/HideMaker.tsx', 'src/game/hide.ts']) {
      const source = readFileSync(file, 'utf8');
      for (const banned of ['/count', '/storage', '/backup', '/review', '/testbedStore']) {
        expect(source, `${file} imports ${banned}`).not.toMatch(new RegExp(`from '[^']*${banned}'`));
      }
    }
  });
});
