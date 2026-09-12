import { beforeEach, describe, expect, it } from 'vitest';
import { dayIndex, puzzleNumber } from './daily';
import { applyRestoreOnce, forgetRestore, parseRestore } from './restore';
import { getCurrentResult, getResult, getStats, saveGaveUp, saveResult } from './storage';

/** Minimal localStorage, since the tests run in node. As in `storage.test.ts`. */
function installStorage(): void {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
      clear: () => data.clear(),
    },
  });
}

beforeEach(() => {
  installStorage();
  Reflect.deleteProperty(globalThis, 'document');
  forgetRestore();
});

/** A date, and the puzzle number a player is looking at on it. */
const NOW = new Date('2026-09-12T12:00:00');
const TODAY = puzzleNumber(dayIndex(NOW));

describe('parseRestore', () => {
  it('is absent without the parameter, so every other page is untouched', () => {
    expect(parseRestore('', NOW)).toBeNull();
    expect(parseRestore('?test', NOW)).toBeNull();
  });

  it('reads a puzzle number, a time and a version', () => {
    const read = parseRestore(`?restore=18:34676:16xku87`, NOW);
    expect(read?.request).toEqual({
      number: 18,
      day: 17,
      ms: 34676,
      v: '16xku87',
      gaveUp: false,
    });
  });

  it('reads a day that was given up on', () => {
    expect(parseRestore('?restore=18:34676:16xku87:g', NOW)?.request?.gaveUp).toBe(true);
  });

  it('reports a malformed link rather than doing nothing quietly', () => {
    const bad = [
      '?restore=',
      '?restore=18',
      '?restore=18:34676',
      '?restore=18:34676:16xku87:x',
      '?restore=18:34676:16xku87:g:g',
      '?restore=eighteen:34676:16xku87',
      '?restore=18:quick:16xku87',
      '?restore=18.5:34676:16xku87',
      '?restore=18:34676.5:16xku87',
      // A version is base-36 of a hash and nothing else: anything with room in it for a
      // payload is not one.
      '?restore=18:34676:16XKU87',
      '?restore=18:34676:<script>',
      '?restore=18:34676:0123456789abcdef',
    ];
    for (const search of bad) {
      const read = parseRestore(search, NOW);
      expect(read, search).not.toBeNull();
      expect(read?.request, search).toBeUndefined();
    }
  });

  it('refuses a day nobody has played yet, and a time nobody set', () => {
    expect(parseRestore(`?restore=${TODAY + 1}:34676:aaaa`, NOW)?.request).toBeUndefined();
    expect(parseRestore('?restore=0:34676:aaaa', NOW)?.request).toBeUndefined();
    expect(parseRestore('?restore=-3:34676:aaaa', NOW)?.request).toBeUndefined();
    expect(parseRestore('?restore=18:0:aaaa', NOW)?.request).toBeUndefined();
    expect(parseRestore('?restore=18:-500:aaaa', NOW)?.request).toBeUndefined();
    expect(parseRestore(`?restore=18:${24 * 60 * 60 * 1000 + 1}:aaaa`, NOW)?.request).toBeUndefined();
  });

  it('accepts today, which is the day most likely to need putting back', () => {
    expect(parseRestore(`?restore=${TODAY}:34676:aaaa`, NOW)?.request?.number).toBe(TODAY);
  });
});

describe('applyRestoreOnce', () => {
  const request = { number: 18, day: 17, ms: 34676, v: '16xku87', gaveUp: false };

  it('writes the time over a replay that superseded it, and says what it replaced', () => {
    // Exactly the case this exists for: a re-tuned day, replayed, the real time gone.
    saveResult(17, 6712, 'czplxb');

    const done = applyRestoreOnce(request);

    expect(done.replaced?.ms).toBe(6712);
    expect(getResult(17)?.ms).toBe(34676);
    expect(getCurrentResult(17, '16xku87')?.ms).toBe(34676);
  });

  it('reports an empty day as having replaced nothing', () => {
    expect(applyRestoreOnce(request).replaced).toBeUndefined();
    expect(getResult(17)?.ms).toBe(34676);
  });

  it('writes once, so a re-run cannot report the day as replacing its own restore', () => {
    saveResult(17, 6712, 'czplxb');
    const first = applyRestoreOnce(request);
    const second = applyRestoreOnce(request);
    expect(second).toBe(first);
    expect(second.replaced?.ms).toBe(6712);
  });

  it('restores a give-up as a give-up, which is played but is not a time', () => {
    saveResult(17, 6712, 'czplxb');
    applyRestoreOnce({ ...request, gaveUp: true });
    expect(getResult(17)?.gaveUp).toBe(true);
    expect(getStats(17).best).toBeNull();
    expect(getStats(17).played).toBe(1);
  });

  it('puts the day back into the stats it earned', () => {
    saveResult(16, 50000, 'aaaa');
    saveResult(17, 6712, 'czplxb');
    expect(getStats(17).best).toBe(6712);

    applyRestoreOnce(request);

    const stats = getStats(17);
    expect(stats.best).toBe(34676);
    expect(stats.played).toBe(2);
    expect(stats.streak).toBe(2);
  });

  it('leaves every other day alone', () => {
    saveResult(16, 50000, 'aaaa');
    saveGaveUp(15, 90000, 'bbbb');
    applyRestoreOnce(request);
    expect(getResult(16)?.ms).toBe(50000);
    expect(getResult(15)?.gaveUp).toBe(true);
  });

  it('leaves the day playable when the version is wrong, rather than passing it off', () => {
    applyRestoreOnce({ ...request, v: 'wrong' });
    // Counted in the stats, because the time was really set -- but not a solve of the
    // puzzle as it stands now, which is `record`'s rule and is not up to a restore.
    expect(getResult(17)?.ms).toBe(34676);
    expect(getCurrentResult(17, '16xku87')).toBeUndefined();
  });
});
