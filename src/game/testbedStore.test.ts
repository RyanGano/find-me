import { beforeEach, describe, expect, it } from 'vitest';
import { saveResult, getStats, getResult } from './storage';
import {
  answersFor,
  finishRound,
  getBenchProgress,
  isDone,
  resetRound,
  saveAnswer,
  saveBenchProgress,
  testerId,
} from './testbedStore';

const GAME_KEY = 'find-me:v1';
const BENCH_KEY = 'find-me:testbed:v1';

let data: Map<string, string>;

/** Minimal localStorage, since the tests run in node. As in `storage.test.ts`. */
function installStorage(): void {
  data = new Map<string, string>();
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

beforeEach(installStorage);

const t = { x: 10, y: 20, scale: 0.5, rot: 0 };

describe('what the bench remembers', () => {
  it('mints a tester id once and keeps it', () => {
    const first = testerId();
    expect(first).toBeTruthy();
    expect(testerId()).toBe(first);
  });

  it('keeps the answers a tester has given, so a round can be picked back up', () => {
    saveAnswer('r1', 'cafe-fri', { ms: 41000, gaveUp: false, hard: 4, fair: 1 });
    const answers = answersFor('r1');
    expect(answers['cafe-fri'].hard).toBe(4);
    expect(answers['cafe-fri'].fair).toBe(1);
    expect(answers['cafe-fri'].ms).toBe(41000);
    expect(answers['cafe-fri'].at).toBeTruthy();
  });

  it('keeps the first answer, so replaying a day is not a second opinion', () => {
    saveAnswer('r1', 'cafe-fri', { ms: 41000, gaveUp: false, hard: 4, fair: 1 });
    saveAnswer('r1', 'cafe-fri', { ms: 9000, gaveUp: false, hard: 1, fair: -1 });
    expect(answersFor('r1')['cafe-fri'].hard).toBe(4);
  });

  it('records giving up as an answer of its own', () => {
    saveAnswer('r1', 'cafe-sat', { ms: 300000, gaveUp: true, hard: 5, fair: -1 });
    expect(answersFor('r1')['cafe-sat'].gaveUp).toBe(true);
  });

  it('keeps rounds apart', () => {
    saveAnswer('r1', 'cafe-fri', { ms: 1000, gaveUp: false, hard: 3, fair: 1 });
    expect(answersFor('r2')).toEqual({});
  });

  it('will not run the same round twice on the same device', () => {
    expect(isDone('r1')).toBe(false);
    finishRound('r1');
    expect(isDone('r1')).toBe(true);
    expect(isDone('r2')).toBe(false);
  });

  it('can be cleared for a deliberate second run, which is what ?again is for', () => {
    saveAnswer('r1', 'cafe-fri', { ms: 1000, gaveUp: false, hard: 3, fair: 1 });
    finishRound('r1');
    resetRound('r1');
    expect(isDone('r1')).toBe(false);
    expect(answersFor('r1')).toEqual({});
  });
});

describe('a bench hunt left half-finished', () => {
  it('comes back with its clock and its view', () => {
    saveBenchProgress('r1', { puzzle: 'cafe-fri', ms: 12000, t, w: 390, h: 700 });
    const back = getBenchProgress('r1', 'cafe-fri');
    expect(back?.ms).toBe(12000);
    expect(back?.t).toEqual(t);
  });

  it('belongs to the hunt it was left in, not to the next one', () => {
    saveBenchProgress('r1', { puzzle: 'cafe-fri', ms: 12000, t, w: 390, h: 700 });
    expect(getBenchProgress('r1', 'cafe-sat')).toBeUndefined();
    expect(getBenchProgress('r2', 'cafe-fri')).toBeUndefined();
  });

  it('is dropped once the hunt has been answered for', () => {
    saveBenchProgress('r1', { puzzle: 'cafe-fri', ms: 12000, t, w: 390, h: 700 });
    saveAnswer('r1', 'cafe-fri', { ms: 12500, gaveUp: false, hard: 3, fair: 1 });
    expect(getBenchProgress('r1', 'cafe-fri')).toBeUndefined();
  });

  it('is not resumed a day later', () => {
    saveBenchProgress('r1', { puzzle: 'cafe-fri', ms: 12000, t, w: 390, h: 700 });
    const stale = JSON.parse(data.get(BENCH_KEY)!);
    stale.rounds.r1.progress.at = new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString();
    data.set(BENCH_KEY, JSON.stringify(stale));
    expect(getBenchProgress('r1', 'cafe-fri')).toBeUndefined();
  });
});

/**
 * The promise the whole bench rests on.
 *
 * A tester is usually also a player -- they are the people who care enough to be asked --
 * so the two records live in the same browser under the same origin, and the only thing
 * keeping a play-test away from somebody's streak is that they are different keys. That
 * is worth asserting from both sides rather than trusting to a constant at the top of a
 * file that nobody reads twice.
 */
describe('the bench cannot reach the game', () => {
  it('writes nothing outside its own key', () => {
    testerId();
    saveAnswer('r1', 'cafe-fri', { ms: 1000, gaveUp: false, hard: 3, fair: 1 });
    saveBenchProgress('r1', { puzzle: 'cafe-sat', ms: 500, t, w: 390, h: 700 });
    finishRound('r1');
    expect([...data.keys()]).toEqual([BENCH_KEY]);
  });

  it('leaves a streak, a best time and a recorded day exactly as it found them', () => {
    saveResult(3, 45000, 'abc');
    saveResult(4, 30000, 'def');
    const before = getStats(4);

    testerId();
    saveAnswer('r1', 'cafe-fri', { ms: 1000, gaveUp: false, hard: 3, fair: 1 });
    saveBenchProgress('r1', { puzzle: 'cafe-sat', ms: 500, t, w: 390, h: 700 });
    finishRound('r1');
    resetRound('r1');

    expect(getStats(4)).toEqual(before);
    expect(getResult(3)?.ms).toBe(45000);
    expect(getResult(4)?.ms).toBe(30000);
  });

  it('is not disturbed by the game writing either', () => {
    saveAnswer('r1', 'cafe-fri', { ms: 1000, gaveUp: false, hard: 3, fair: 1 });
    const tester = testerId();
    saveResult(9, 12000, 'xyz');
    expect(testerId()).toBe(tester);
    expect(answersFor('r1')['cafe-fri'].hard).toBe(3);
    expect(data.has(GAME_KEY)).toBe(true);
  });
});
