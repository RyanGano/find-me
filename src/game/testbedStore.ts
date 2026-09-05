import { newRunId } from './count';
import type { Transform } from './types';

/**
 * What this device remembers about play-testing.
 *
 * A separate key from `find-me:v1` on purpose, and the separation is the point rather
 * than a tidiness: nothing here can reach a result, a streak or a banked daily run, and
 * nothing there can be changed by play-testing. `testbedStore.test.ts` holds it to that.
 *
 * It answers two questions. Where had this tester got to -- so a round survives the
 * phone being put down, which for six hunts it will be. And has this device already
 * finished this round -- so the same person running through it twice does not read as
 * two people agreeing with each other.
 *
 * The tester id is a random string with nothing attached to it. It exists so the rows
 * from one person's six hunts can be read as one person's six hunts; it is not an
 * account, it never leaves this device except on those rows, and clearing the browser
 * mints a new one. That makes the "once each" rule a device rule and not a person rule,
 * which is the honest description of what it is.
 */
const KEY = 'find-me:testbed:v1';

export interface Answer {
  /** Run clock in ms: how long the hunt took, or how long they searched before giving up. */
  ms: number;
  gaveUp: boolean;
  /** 1 far too easy .. 5 far too hard. */
  hard: number;
  /** Did it feel findable and fair: 1 yes, -1 no. */
  fair: 1 | -1;
  at: string;
}

interface RoundState {
  answers: Record<string, Answer>;
  /** When the tester submitted. Set means this device is finished with this round. */
  done?: string;
  /** A hunt in progress, so a phone put down mid-search does not restart the clock. */
  progress?: BenchProgress;
}

/** A bench run left mid-hunt. The daily game's `Progress`, minus everything daily. */
export interface BenchProgress {
  puzzle: string;
  ms: number;
  t: Transform;
  w: number;
  h: number;
  at: string;
}

interface Store {
  tester: string;
  rounds: Record<string, RoundState>;
}

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Store>;
      if (parsed && typeof parsed.tester === 'string' && parsed.tester) {
        return { tester: parsed.tester, rounds: parsed.rounds ?? {} };
      }
    }
  } catch {
    // Storage off, private tab, damaged value: a fresh tester, and the round simply
    // cannot be resumed. Nothing here is worth failing a tester's session over.
  }
  return { tester: newRunId(), rounds: {} };
}

function write(store: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // The round still plays; it just will not survive being closed.
  }
}

/** This device's tester id, minted and kept on first use. */
export function testerId(): string {
  const store = read();
  write(store);
  return store.tester;
}

function stateOf(store: Store, round: string): RoundState {
  return store.rounds[round] ?? { answers: {} };
}

export function answersFor(round: string): Record<string, Answer> {
  return stateOf(read(), round).answers;
}

/** The first answer wins. A day re-played after answering is not a second opinion. */
export function saveAnswer(round: string, puzzle: string, answer: Omit<Answer, 'at'>): void {
  const store = read();
  const state = stateOf(store, round);
  if (state.answers[puzzle]) return;
  store.rounds[round] = {
    ...state,
    answers: { ...state.answers, [puzzle]: { ...answer, at: new Date().toISOString() } },
    progress: undefined,
  };
  write(store);
}

export function isDone(round: string): boolean {
  return Boolean(stateOf(read(), round).done);
}

export function finishRound(round: string): void {
  const store = read();
  store.rounds[round] = { ...stateOf(store, round), done: new Date().toISOString(), progress: undefined };
  write(store);
}

/**
 * Wipe this device's record of a round so it can be run again. Reached only by
 * `?testbed=<round>&again=1`, which is for checking a round works before it is sent to
 * anybody -- a run started that way is flagged as a dry run and is not counted.
 */
export function resetRound(round: string): void {
  const store = read();
  delete store.rounds[round];
  write(store);
}

/** How long a bench hunt stays resumable. As for the daily game: long enough to eat. */
const PROGRESS_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export function getBenchProgress(round: string, puzzle: string): BenchProgress | undefined {
  const progress = stateOf(read(), round).progress;
  if (!progress || progress.puzzle !== puzzle) return undefined;
  if (Date.now() - Date.parse(progress.at) >= PROGRESS_MAX_AGE_MS) return undefined;
  return progress;
}

export function saveBenchProgress(round: string, progress: Omit<BenchProgress, 'at'>): void {
  const store = read();
  const state = stateOf(store, round);
  if (state.done) return;
  store.rounds[round] = { ...state, progress: { ...progress, at: new Date().toISOString() } };
  write(store);
}
