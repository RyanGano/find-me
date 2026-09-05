import type { RunMetrics } from './metrics';

/**
 * What a play-tester tells us, and how it gets back here.
 *
 * One row per answered hunt, posted the moment it is answered rather than at the end of
 * the round. Most rounds will not be finished -- somebody starts six hunts on a bus and
 * gets off after three -- and the part that gets abandoned is the hard end, which is the
 * part the round was asking about. Posting per answer means those three still count.
 *
 * This is not the daily tally and does not pretend to be. The tally is anonymous by
 * construction: an id minted at the start of a run and forgotten with it. A review row
 * carries a tester id that lives on the device across a whole round, because six answers
 * from one person mean something different from six answers from six. That is a real
 * difference in kind, so it goes in its own row type rather than being quietly mixed in
 * with the run rows. It is still nothing but a random string -- no account, no address,
 * nothing that outlives the browser it was minted in.
 *
 * `build` is the deploy that served the round: the same stamp `version.json` carries.
 * That is what makes a round readable after the fact, since the way to try a change is
 * to deploy it and run a round on it, and two rounds' answers only compare if you can
 * see which build each was answered on.
 *
 * Fails silently, like the tally. A blocked request must not cost a tester their round.
 */
export interface ReviewPayload {
  kind: 'review';
  tester: string;
  round: string;
  build: string;
  puzzle: string;
  /** Run clock in ms: to the solve, or to giving up. */
  ms: number;
  gaveUp: boolean;
  /** 1 far too easy .. 5 far too hard. */
  hard: number;
  /** Did it feel fair: 1 yes, -1 no. */
  fair: 1 | -1;
  /** How the run was played, when there was a run to measure. */
  metrics?: RunMetrics;
  /** A checking run, not a tester's. Recorded and excluded from any read. */
  dry?: boolean;
}

function endpoint(): string {
  return import.meta.env.VITE_COUNT_URL ?? '';
}

export function buildId(): string {
  return typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev';
}

export function submitReview(review: Omit<ReviewPayload, 'kind' | 'build'>): void {
  const url = endpoint();
  if (!url) return;

  const body = JSON.stringify({ kind: 'review', build: buildId(), ...review } satisfies ReviewPayload);
  try {
    void fetch(url, {
      method: 'POST',
      body,
      // `text/plain` for the same reason the tally uses it: a JSON content type makes
      // this a preflighted cross-origin request, and a preflight cannot be relied on
      // when the page is going away underneath it.
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      keepalive: true,
      mode: 'cors',
    }).catch(() => {});
  } catch {
    // Blocked, offline, or refused. The round is unaffected.
  }
}
