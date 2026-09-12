import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { dayIndex, EPOCH, weekday } from './daily';
import {
  cleanName,
  colourFor,
  decodeHide,
  encodeHide,
  HIDE_NAME_MAX,
  HIDE_OPACITY,
  HIDE_SIZE,
  HIDE_VERSION,
  hexToHsv,
  hideFromHash,
  hideLink,
  hidePuzzle,
  hideShareText,
  hideTitle,
  limitName,
  hsvToHex,
  minOpacityFor,
  paintStats,
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
  it('opens the custom sliders on the color already chosen', () => {
    expect(hexToHsv('#ff0000')).toEqual({ h: 0, s: 100, v: 100 });
    expect(hexToHsv('#000000')).toEqual({ h: 0, s: 0, v: 0 });
    expect(hsvToHex({ h: 120, s: 100, v: 100 })).toBe('#00ff00');
    expect(hsvToHex({ h: 360, s: 0, v: 100 })).toBe('#ffffff');
    const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    for (const hex of ['#a1b2c3', '#f4ecd8', '#2e2a26', '#6b8f5e', '#b5543c', '#4f6d8f']) {
      const back = channels(hsvToHex(hexToHsv(hex)));
      channels(hex).forEach((c, i) => expect(Math.abs(c - back[i])).toBeLessThanOrEqual(3));
    }
  });

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

  it('packs an unnamed hide exactly as links were packed before names', () => {
    const code = encodeHide(sample({ name: '   ' }));
    const packed = JSON.parse(atob(code.replace(/-/g, '+').replace(/_/g, '/')));
    expect(packed).toEqual([1, first.image, 'star', 400, 600, 50, -30, 'a1b2c3', 70]);
    // And one made before names still opens, with no name on it.
    const old = decodeHide(pack(packed), NOW);
    expect(old.ok).toBe(true);
    if (old.ok) expect('name' in old.hide).toBe(false);
  });

  it('round-trips a name, emoji and quotes included', () => {
    for (const name of ['Grandma’s pick', 'Find "it" 🌻 if you can', 'a'.repeat(HIDE_NAME_MAX)]) {
      const back = decodeHide(encodeHide(sample({ name })), NOW);
      expect(back.ok).toBe(true);
      if (back.ok) expect(back.hide).toEqual(sample({ name }));
    }
  });

  it('cleans a name, however the link was edited', () => {
    expect(cleanName('  two\t\tspaces \n here  ')).toBe('two spaces here');
    expect(cleanName('bellring')).toBe('bell ring');
    expect(Array.from(cleanName('🌻'.repeat(80)))).toHaveLength(HIDE_NAME_MAX);
    expect(limitName('keeps a trailing space ')).toBe('keeps a trailing space ');
    const long = decodeHide(pack([2, first.image, 'star', 400, 600, 50, 0, 'aabbcc', 70, ` ${'x'.repeat(90)} `]), NOW);
    expect(long.ok && long.hide.name).toBe('x'.repeat(HIDE_NAME_MAX));
    const blank = decodeHide(pack([2, first.image, 'star', 400, 600, 50, 0, 'aabbcc', 70, '  ']), NOW);
    expect(blank.ok).toBe(true);
    if (blank.ok) expect('name' in blank.hide).toBe(false);
  });

  it('refuses a name in the wrong place', () => {
    for (const code of [
      pack([1, first.image, 'star', 1, 1, 50, 0, 'aabbcc', 70, 'named']),
      pack([2, first.image, 'star', 1, 1, 50, 0, 'aabbcc', 70]),
      pack([2, first.image, 'star', 1, 1, 50, 0, 'aabbcc', 70, 42]),
    ]) {
      expect(decodeHide(code, NOW)).toEqual({ ok: false, reason: 'malformed' });
    }
  });

  it('never lets the name move the hunt', () => {
    expect(hidePuzzle(sample({ name: 'one' }), first)).toEqual(hidePuzzle(sample(), first));
  });

  it('goes by its name, or the painting when it has none', () => {
    expect(hideTitle(sample(), first)).toBe(first.title);
    expect(hideTitle(sample({ name: 'Mine' }), first)).toBe('Mine');
    const link = 'https://example.test/#h=x';
    expect(hideShareText(sample({ name: 'Mine' }), first, link)).toBe(
      `I created a Find Me puzzle named "Mine"\nCan you find the star ${SHAPES.star.emoji} in the painting?\n${link}`,
    );
    expect(hideShareText(sample(), first, link)).toBe(
      `I created a Find Me puzzle in "${first.title}"\nCan you find the star ${SHAPES.star.emoji} in the painting?\n${link}`,
    );
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

  // A flat block of one color, as the paint under a hide.
  const flat = (r: number, g: number, b: number) => paintStats(Array.from({ length: 64 }, () => [r, g, b, 255]).flat());

  it('refuses a color that blends into the paint however solid it is', () => {
    // Cream on cream, and a yellow a shade off the yellow it sits on.
    expect(minOpacityFor('#f4ecd8', flat(251, 238, 202))).toBeNull();
    expect(minOpacityFor('#f0bc40', flat(243, 185, 58))).toBeNull();
  });

  it('allows a hard color that can still be found', () => {
    // Gold on yellow is a hard hide, not an impossible one.
    expect(minOpacityFor('#d9b36c', flat(243, 185, 58))).not.toBeNull();
  });

  it('judges a color against the paint under the shape, not the block round it', () => {
    // Pale paint in dark, with the shape covering the pale and straying a row onto the dark.
    const data: number[] = [];
    const cover: number[] = [];
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        const inShape = x >= 2 && x <= 7 && y >= 2 && y <= 7;
        data.push(...(inShape && y <= 6 ? [230, 225, 210] : [50, 80, 120]), 255);
        cover.push(inShape ? 1 : 0);
      }
    }
    expect(minOpacityFor('#f4ecd8', paintStats(data, cover))).toBeNull();
    expect(minOpacityFor('#d9b36c', paintStats(data, cover))).not.toBeNull();
    // Judged on the whole block, mostly dark, the pale color passed.
    expect(minOpacityFor('#f4ecd8', paintStats(data))).not.toBeNull();
  });

  it('never lets a findable color go under the opacity floor', () => {
    expect(minOpacityFor('#101010', flat(240, 240, 240))).toBe(HIDE_OPACITY.min);
  });

  it('asks more of a color that only differs in hue', () => {
    // Same lightness step either way; the hue-only one must be drawn stronger.
    const light = minOpacityFor('#f4ecd8', flat(243, 185, 58));
    const dark = minOpacityFor('#7a5a10', flat(243, 185, 58));
    expect(light).not.toBeNull();
    expect(dark).not.toBeNull();
    expect(light!).toBeGreaterThanOrEqual(dark!);
  });

  it('asks more on busy paint than on calm', () => {
    const calm = paintStats(Array.from({ length: 64 }, () => [150, 150, 150, 255]).flat());
    // A checkerboard, so every neighbor differs.
    const busy = paintStats(Array.from({ length: 64 }, (_, i) => ((i + (i >> 3)) % 2 ? [76, 76, 76, 255] : [232, 232, 232, 255])).flat());
    expect(busy.texture).toBeGreaterThan(calm.texture);
    // Faint enough on calm paint to need more than the opacity floor.
    const onCalm = minOpacityFor('#c2c2c2', calm) ?? 2;
    const onBusy = minOpacityFor('#c2c2c2', busy) ?? 2;
    expect(onCalm).toBeGreaterThan(HIDE_OPACITY.min);
    expect(onBusy).toBeGreaterThan(onCalm);
  });

  it('defaults to a color findable at the default strength, never the paint itself', () => {
    for (const [r, g, b] of [[0, 0, 0], [255, 255, 255], [120, 80, 40], [200, 190, 170], [243, 185, 58]]) {
      const paint = flat(r, g, b);
      const hex = colourFor(paint);
      expect(hex).toMatch(/^#[0-9a-f]{6}$/);
      const least = minOpacityFor(hex, paint);
      expect(least, hex).not.toBeNull();
      expect(least!).toBeLessThanOrEqual(0.8);
    }
  });

  const HIDE_FILES = ['src/FriendHunt.tsx', 'src/HideMaker.tsx', 'src/game/hide.ts'];

  it('cannot record anything', () => {
    // A friend hide is not a day: it may never reach the player's store, the backup
    // cookie or the bench's answers. Checked on the imports, so a later edit that reached
    // for one would fail here rather than in someone's streak.
    for (const file of HIDE_FILES) {
      const source = readFileSync(file, 'utf8');
      for (const banned of ['/storage', '/backup', '/review', '/testbedStore']) {
        expect(source, `${file} imports ${banned}`).not.toMatch(new RegExp(`from '[^']*${banned}'`));
      }
    }
  });

  it('counts the feature and never a run', () => {
    // The five hide counters say whether anyone uses the thing. Nothing here may reach the
    // run tally: `count` would write a row keyed to a puzzle day, which is exactly what a
    // hide is not, and `fetchTally` would put somebody else's numbers on a hide that has
    // none. `countHide` is the only thing these files may take from the tally module.
    for (const file of HIDE_FILES) {
      const source = readFileSync(file, 'utf8');
      for (const imported of source.matchAll(/import \{([^}]*)\} from '[^']*\/count'/g)) {
        const names = imported[1].split(',').map((n) => n.trim()).filter(Boolean);
        expect(names, `${file} imports more than countHide from the tally`).toEqual(['countHide']);
      }
    }
  });
});
