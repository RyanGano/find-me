import { existsSync, readFileSync } from 'node:fs';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { dayIndex, EPOCH, selectPuzzle } from './daily';
import {
  MAX_DAYS_PER_COLOUR,
  MIN_COLOURS_PER_WEEK,
  generalColour,
  type GeneralColour,
  type Rgb,
} from './palette';
import { IMAGES, PUZZLES } from './puzzles';
import { TESTBED_IMAGES, TESTBED_PUZZLES } from './testbed';

/**
 * The bench must never become the game.
 *
 * Everything else about `testbed.ts` is deliberately identical to `puzzles.ts` -- same
 * seed shape, same builder, same planner, same tuner -- because a bench that behaved
 * differently would answer questions about itself rather than about the game. The one
 * thing that must not be shared is the calendar, and "must not" is worth a test rather
 * than a comment: the whole file is machine-rewritten every time somebody tries an idea,
 * and the failure being guarded against is silent. A player would not see an error, they
 * would see a day they had already solved handed back to them as a different puzzle.
 */
describe('the play-test bench is not the rotation', () => {
  it('shares no painting with the shipped weeks', () => {
    const shipped = new Set(IMAGES.map((i) => i.id));
    for (const image of TESTBED_IMAGES) {
      expect(shipped, `${image.id} is both a bench painting and a shipped one`).not.toContain(
        image.id,
      );
    }
  });

  it('shares no puzzle id with the shipped days', () => {
    const shipped = new Set(PUZZLES.map((p) => p.id));
    for (const p of TESTBED_PUZZLES) {
      expect(shipped, `${p.id} is both a bench day and a shipped one`).not.toContain(p.id);
    }
  });

  /**
   * The load-bearing one. `daily.ts` maps a date onto `PUZZLES` by index and has no path
   * to the bench at all, so this cannot fail without somebody having wired the two lists
   * together -- which is exactly the change worth catching on the way in.
   */
  it('is never what the calendar hands anybody, on any date', () => {
    const bench = new Set(TESTBED_PUZZLES.map((p) => p.id));
    for (let d = -400; d < 800; d++) {
      const when = new Date(EPOCH.getFullYear(), EPOCH.getMonth(), EPOCH.getDate() + d);
      const { puzzle, isPractice } = selectPuzzle('', when);
      expect(isPractice).toBe(false);
      expect(bench, `${when.toDateString()} served bench puzzle ${puzzle.id}`).not.toContain(
        puzzle.id,
      );
    }
  });

  it('is not reachable through ?day=, only by name', () => {
    const bench = new Set(TESTBED_PUZZLES.map((p) => p.id));
    for (let d = -50; d < 200; d++) {
      expect(bench).not.toContain(selectPuzzle(`?day=${d}`).puzzle.id);
    }
  });

  /**
   * A bench day is served by `?puzzle=<id>`, because the tuner and the week sheets drive
   * the real page rather than a second one. It comes back as practice, with an index
   * that is not a day number and could not be mistaken for one -- so nothing that keys
   * on the day can write a bench run into a player's record even if the practice flag
   * were one day missed.
   */
  it('is served by name as practice, on a day number that is not a day', () => {
    const today = dayIndex();
    for (const p of TESTBED_PUZZLES) {
      const sel = selectPuzzle(`?puzzle=${p.id}`);
      expect(sel.puzzle.id).toBe(p.id);
      expect(sel.isPractice).toBe(true);
      expect(sel.index).toBeLessThan(0);
      expect(sel.index).not.toBe(today);
    }
  });

  it('does not answer to a shipped id', () => {
    for (const p of PUZZLES) {
      expect(selectPuzzle(`?puzzle=${p.id}`).puzzle.image).toBe(p.image);
    }
  });

  /**
   * Recorded in the `add-painting` skill's rejected list, which is the first gate that
   * skill applies. Without this the only thing keeping a spent painting out of the
   * rotation is somebody remembering that it was spent.
   */
  it('is on the rejected list, so no future week can pick one up', () => {
    const rejected = JSON.parse(
      readFileSync('.claude/skills/add-painting/rejected.json', 'utf8'),
    ) as { rejected: { title: string; reason: string }[] };
    const titles = new Map(rejected.rejected.map((r) => [r.title.toLowerCase(), r.reason]));
    for (const image of TESTBED_IMAGES) {
      // Written without its accent, as the rest of the list is; compare on the letters.
      const key = image.title.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      expect(titles.get(key), `${image.title} is not on the rejected list`).toBe('testbed');
    }
  });
});

/**
 * The same provenance the shipped assets are held to, for the same reason: the hiding
 * places are in the asset's own pixel space, so regenerating one of these from a
 * different scan would move every day of that bench week and quietly invalidate whatever
 * a round of testers had just told us about it.
 */
const SOURCE_SCANS: Record<string, { width: number; height: number }> = {
  proverbs: { width: 5649, height: 4000 },
  cafe: { width: 6415, height: 8000 },
  ambassadors: { width: 30000, height: 29560 },
};

describe('bench assets', () => {
  for (const image of TESTBED_IMAGES) {
    const file = `public/puzzles/${image.id}.jpg`;
    const scan = SOURCE_SCANS[image.id];

    it(`${image.id} exists and matches its declared dimensions`, async () => {
      expect(existsSync(file), `${file} is missing — run npm run images -- ${image.id}`).toBe(true);
      const meta = await sharp(file).metadata();
      expect(meta.width).toBe(image.width);
      expect(meta.height).toBe(image.height);
    });

    it(`${image.id} records the scan it was built from`, () => {
      expect(image.source).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
      expect(scan, `${image.id} is missing from SOURCE_SCANS`).toBeDefined();
    });

    it(`${image.id} has the shape of its recorded scan`, () => {
      // A pixel of slack, which the shipped version of this check does not need: sharp's
      // own rounding and the naive ratio can disagree by one on a given aspect, and did
      // here. A different scan of the same painting is a different crop and moves the
      // height by hundreds, so nothing this exists to catch fits through the gap.
      const derived = (scan.height / scan.width) * image.width;
      expect(Math.abs(derived - image.height)).toBeLessThanOrEqual(1);
    });
  }

  it('says what each bench painting is there to stress', () => {
    // Three paintings that fail in the same direction are one painting. The sentence is
    // the only thing recording that they do not, and it is what a fourth gets chosen
    // against.
    for (const image of TESTBED_IMAGES) expect(image.stresses.length).toBeGreaterThan(10);
    expect(new Set(TESTBED_IMAGES.map((i) => i.stresses)).size).toBe(TESTBED_IMAGES.length);
  });
});

/**
 * Mean paint over the shape's own footprint -- the window `plan-weeks.mjs` measures, and
 * a deliberate copy of the one in `variety.test.ts`. Copied rather than shared because
 * the two files are checking the same rule about two lists that must not be able to
 * reach each other, and a helper imported by both is one more thread between them.
 */
function paintUnder(
  pixels: Buffer,
  info: { width: number; height: number; channels: number },
  cx: number,
  cy: number,
  size: number,
): Rgb {
  const half = size / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let y = Math.max(0, Math.round(cy - half)); y < Math.min(info.height, cy + half); y++) {
    for (let x = Math.max(0, Math.round(cx - half)); x < Math.min(info.width, cx + half); x++) {
      const i = (y * info.width + x) * info.channels;
      r += pixels[i];
      g += pixels[i + 1];
      b += pixels[i + 2];
      n++;
    }
  }
  return [r / n, g / n, b / n];
}

/**
 * A bench week has to be seven different things too.
 *
 * Not for the tester's sake -- they are doing a job, not playing a streak -- but because
 * a week that hides five of its days in the same beige is not the game, and an opinion
 * about difficulty collected on it would be an opinion about that beige. The planner
 * picks under this rule; this is what holds the file to it after the tuner has been
 * through, exactly as `variety.test.ts` does for the rotation.
 */
describe('a bench week of colours', () => {
  for (const image of TESTBED_IMAGES) {
    const week = TESTBED_PUZZLES.filter((p) => p.image === image.id);

    it(`${image.id} hides its week in ${MIN_COLOURS_PER_WEEK} different colours`, async () => {
      const { data, info } = await sharp(`public/puzzles/${image.id}.jpg`)
        .raw()
        .toBuffer({ resolveWithObject: true });

      const counts = new Map<GeneralColour, string[]>();
      for (const puzzle of week) {
        const { cx, cy, size } = puzzle.target;
        const colour = generalColour(paintUnder(data, info, cx, cy, size));
        counts.set(colour, [...(counts.get(colour) ?? []), puzzle.id]);
      }
      const spread = [...counts].map(([colour, ids]) => `${colour}: ${ids.join(', ')}`).join('\n  ');

      for (const [colour, ids] of counts) {
        expect(
          ids.length,
          `${image.id} hides ${ids.length} of its seven days in ${colour} paint\n  ${spread}`,
        ).toBeLessThanOrEqual(MAX_DAYS_PER_COLOUR);
      }
      expect(
        counts.size,
        `${image.id} hides its whole week in only ${counts.size} colour(s)\n  ${spread}`,
      ).toBeGreaterThanOrEqual(MIN_COLOURS_PER_WEEK);
    });
  }
});
