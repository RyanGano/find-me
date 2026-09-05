import { useCallback, useMemo, useState } from 'react';
import { ReferenceCard } from './components/ReferenceCard';
import { ReviewCard } from './components/ReviewCard';
import { Stage } from './components/Stage';
import { formatTime } from './game/format';
import type { RunMetrics } from './game/metrics';
import { submitReview } from './game/review';
import { openRound, puzzlesOf, roundById, type Round } from './game/rounds';
import {
  answersFor,
  finishRound,
  getBenchProgress,
  isDone,
  resetRound,
  saveAnswer,
  saveBenchProgress,
  testerId,
} from './game/testbedStore';
import type { Puzzle } from './game/types';
import { useHunt, type LeftRun } from './hooks/useHunt';

/**
 * The play-test bench.
 *
 * `/?testbed` and nothing else: whichever round is open today, picked up wherever the
 * tester left off, on paintings that are not in the game. It is the daily board with the
 * daily game taken off it -- no streak, no result card, no share, no calendar -- and one
 * question after each hunt.
 *
 * Three things it must never do, all of them structural rather than remembered. It never
 * touches `find-me:v1`, so no amount of play-testing can move a streak, a best time or a
 * recorded day. It never posts a run beacon, so a tester's six hunts do not land in the
 * daily tally as six players. And it can only reach `TESTBED_PUZZLES`, which the
 * calendar cannot reach at all.
 *
 * What it does share is the hunt: the same `useHunt` the daily game runs on, down to the
 * gestures and the solve. That is the whole reason the bench is worth building -- an
 * opinion collected on a slightly different game is an opinion about that game.
 */
export default function Testbed() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  // `?testbed=<id>` names a round directly, for looking at one before it opens or after
  // it has closed. `&again=1` clears this device's record of it so it can be walked
  // through a second time. Both mean the run is a check rather than a tester's, and it
  // is recorded as such rather than being silently dropped -- a row that says it is a
  // dry run can be excluded on the way out; a missing row cannot be reasoned about.
  const named = params.get('testbed') ?? '';
  const again = params.has('again');
  const round = useMemo(() => (named ? roundById(named) : undefined) ?? openRound(), [named]);
  const dry = Boolean(round) && (again || round !== openRound());

  const [replayed] = useState(() => {
    if (again && round) resetRound(round.id);
    return true;
  });

  if (!round || !replayed) return <NoRound />;
  return <Session round={round} dry={dry} />;
}

function NoRound() {
  return (
    <div className="app testbed">
      <div className="howto testbed-card" role="dialog" aria-label="No round running">
        <h2>Nothing to test right now</h2>
        <p>
          There is no play-testing round open today. This link comes back to life whenever
          the next one starts — the address never changes, so it is worth keeping.
        </p>
        <p className="howto-note">
          Looking for the game? It is at <a href="/">findme.ryangano.com</a>.
        </p>
      </div>
    </div>
  );
}

function Session({ round, dry }: { round: Round; dry: boolean }) {
  const puzzles = useMemo(() => puzzlesOf(round), [round]);
  const tester = useMemo(() => testerId(), []);

  // Where this device had got to. Read once: everything after this point keeps its own
  // state and writes through to storage, so a re-read would only be a chance to disagree
  // with what is on screen.
  const [answers, setAnswers] = useState(() => answersFor(round.id));
  const [done, setDone] = useState(() => isDone(round.id));

  // The first hunt with no answer against it. That is the whole of resuming: a tester who
  // closes the tab after three comes back to the fourth.
  const at = puzzles.findIndex((p) => !answers[p.id]);
  const [started, setStarted] = useState(() => at > 0);
  // What the finished hunt came to, while the tester is answering for it.
  const [finished, setFinished] = useState<{ ms: number; metrics: RunMetrics | null; gaveUp: boolean } | null>(
    null,
  );

  const answer = useCallback(
    (hard: number, fair: 1 | -1) => {
      const puzzle = puzzles[at];
      if (!finished || !puzzle) return;
      saveAnswer(round.id, puzzle.id, { ms: finished.ms, gaveUp: finished.gaveUp, hard, fair });
      submitReview({
        tester,
        round: round.id,
        puzzle: puzzle.id,
        ms: Math.round(finished.ms),
        gaveUp: finished.gaveUp,
        hard,
        fair,
        metrics: finished.metrics ?? undefined,
        ...(dry ? { dry: true } : {}),
      });
      setFinished(null);
      setAnswers(answersFor(round.id));
      // The last answer ends the round for this device. Nothing is submitted here that
      // was not already sent one hunt at a time -- most rounds are abandoned partway, and
      // the part that gets abandoned is the hard end, which is the part being asked about.
      if (at === puzzles.length - 1) {
        finishRound(round.id);
        setDone(true);
      }
    },
    [at, puzzles, finished, round.id, tester, dry],
  );

  if (done) return <Finished round={round} answers={answers} puzzles={puzzles} dry={dry} />;
  if (!started) {
    return <Intro round={round} count={puzzles.length} onStart={() => setStarted(true)} />;
  }

  const puzzle = puzzles[at];
  if (!puzzle) return <Finished round={round} answers={answers} puzzles={puzzles} dry={dry} />;

  if (finished) {
    return (
      <div className="app testbed">
        <ReviewCard
          step={at + 1}
          of={puzzles.length}
          ms={finished.ms}
          gaveUp={finished.gaveUp}
          thing={puzzle.thing}
          onSubmit={answer}
        />
      </div>
    );
  }

  return (
    <BenchHunt
      key={puzzle.id}
      puzzle={puzzle}
      round={round}
      tester={tester}
      step={at + 1}
      of={puzzles.length}
      onDone={setFinished}
    />
  );
}

function Intro({ round, count, onStart }: { round: Round; count: number; onStart(): void }) {
  return (
    <div className="app testbed">
      <div className="howto testbed-card" role="dialog" aria-label="About this round">
        <p className="review-step">play-testing</p>
        <h2>{round.asks}</h2>
        {round.note && <p>{round.note}</p>}
        <p>
          Same game, same controls: drag to move, pinch or scroll to zoom, twist to turn.
          Frame the shape at the size and angle on the card. After each one you say how it
          felt, in two taps.
        </p>
        <ul>
          <li>{count} puzzles, about fifteen minutes.</li>
          <li>Stop whenever you like — this link picks up where you left off.</li>
          <li>
            Stuck is useful. There is a <strong>give up</strong> button, and pressing it
            tells us more than struggling on does.
          </li>
          <li>None of this touches the real game, your streak or your times.</li>
        </ul>
        <button type="button" className="btn btn-primary review-next" onClick={onStart}>
          Start
        </button>
      </div>
    </div>
  );
}

function Finished({
  round,
  answers,
  puzzles,
  dry,
}: {
  round: Round;
  answers: ReturnType<typeof answersFor>;
  puzzles: Puzzle[];
  dry: boolean;
}) {
  const played = puzzles.filter((p) => answers[p.id]);
  return (
    <div className="app testbed">
      <div className="howto testbed-card" role="dialog" aria-label="Round finished">
        <h2>That is the lot — thank you.</h2>
        <p>
          {played.length} of {puzzles.length} answered, and every one of them is already
          sent. {dry && 'This was a dry run and is marked as one. '}
          You cannot run this round again on this device, which is deliberate: one
          person&rsquo;s second opinion would read as a second person agreeing.
        </p>
        <ul className="testbed-summary">
          {played.map((p) => {
            const a = answers[p.id]!;
            return (
              <li key={p.id}>
                <span>{p.title}</span>
                <span>
                  {a.gaveUp ? `gave up ${formatTime(a.ms)}` : formatTime(a.ms)} · hard {a.hard}/5 ·{' '}
                  {a.fair === 1 ? 'fair' : 'not fair'}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="howto-note">
          The next round opens on this same link. Round <code>{round.id}</code>.
        </p>
      </div>
    </div>
  );
}

interface HuntProps {
  puzzle: Puzzle;
  round: Round;
  tester: string;
  step: number;
  of: number;
  onDone(result: { ms: number; metrics: RunMetrics | null; gaveUp: boolean }): void;
}

/**
 * One bench hunt. Mounted fresh for each puzzle -- keyed on the puzzle id -- so that the
 * clock, the view and the age collector start clean, exactly as they would if the tester
 * had opened the day for the first time.
 */
function BenchHunt({ puzzle, round, tester, step, of, onDone }: HuntProps) {
  const resume = useMemo(() => getBenchProgress(round.id, puzzle.id), [round.id, puzzle.id]);
  // Deterministic rather than random: the same hunt resumed is the same run, and
  // `determinism.test.ts` allows randomness in exactly one file, which is not this one.
  const runId = `${tester}-${round.id}-${puzzle.id}`;

  const onSolved = useCallback(
    (ms: number, metrics: RunMetrics) => onDone({ ms, metrics, gaveUp: false }),
    [onDone],
  );

  const onLeave = useCallback(
    (left: LeftRun) => {
      saveBenchProgress(round.id, { puzzle: puzzle.id, ms: left.ms, t: left.t, w: left.w, h: left.h });
    },
    [round.id, puzzle.id],
  );

  const {
    stageRef,
    transform,
    ready,
    onReady,
    fitScale,
    targetSize,
    match,
    startedAt,
    elapsed,
    clock,
    running,
    paused,
    resuming,
    solvedMs,
    togglePause,
    reset,
  } = useHunt({ puzzle, resume, runId, onSolved, onLeave });

  // Giving up is data, not a dead end: how long somebody hunted before deciding it was
  // not going to happen is the clearest signal a day is too hard, and a tester with no
  // way out of a hunt they cannot finish abandons the whole round instead.
  const giveUp = useCallback(() => {
    onDone({ ms: startedAt === null ? 0 : elapsed, metrics: null, gaveUp: true });
  }, [onDone, startedAt, elapsed]);

  return (
    <div className="app testbed">
      <header className="topbar">
        <h1 className="title">
          <span className="title-btn">Find Me</span>{' '}
          <span className="title-day">
            {step}/{of}
          </span>
        </h1>
        <p className={`clock${running ? ' is-running' : ''}`}>
          {startedAt === null ? 'ready' : formatTime(clock)}
        </p>
        <div className="topbar-actions">
          {startedAt !== null && solvedMs === null && (
            <button
              type="button"
              className="btn btn-icon btn-pause"
              onClick={togglePause}
              title={paused ? 'Resume' : 'Pause'}
              aria-label={paused ? 'Resume' : 'Pause'}
              aria-pressed={paused}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                {paused ? (
                  <path d="M9 6.5l9 5.5-9 5.5z" />
                ) : (
                  <>
                    <path d="M9.5 6v12" />
                    <path d="M14.5 6v12" />
                  </>
                )}
              </svg>
            </button>
          )}
          <button type="button" className="btn btn-icon" onClick={reset} title="Reset view">
            ⟲
          </button>
          <button type="button" className="btn testbed-giveup" onClick={giveUp}>
            give up
          </button>
        </div>
      </header>

      <main className="board">
        <Stage
          stageRef={stageRef}
          puzzle={puzzle}
          transform={transform ?? { x: 0, y: 0, scale: 1, rot: 0 }}
          fitScale={fitScale}
          showRing={false}
          blurred={paused || (startedAt === null && solvedMs === null)}
          paused={paused}
          resumed={resuming}
          onReady={onReady}
        />

        {resuming && (
          <p className="resume-note">continuing — clock held at {formatTime(elapsed)}</p>
        )}

        {!ready && <p className="loading">Loading the painting…</p>}

        <ReferenceCard
          puzzle={puzzle}
          targetSize={targetSize}
          match={match}
          solvedMs={solvedMs}
          onReopen={() => {}}
        />
      </main>
    </div>
  );
}
