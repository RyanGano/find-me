import { useCallback, useEffect, useMemo, useState } from 'react';
import { ReferenceCard } from './components/ReferenceCard';
import { Stage } from './components/Stage';
import { countHide } from './game/count';
import { formatTime } from './game/format';
import { decodeHide, hideLink, hidePuzzle, type Decoded } from './game/hide';
import { huntTrace, shareResult, SITE_URL } from './game/share';
import type { Puzzle } from './game/types';
import { useHunt } from './hooks/useHunt';

/**
 * A hide a friend set, opened from the link it travels in.
 *
 * The same hunt as the daily game -- `useHunt`, down to the gestures and the solve --
 * with the keeping score taken off. Nothing about the hide is recorded: it never touches
 * the player's store, their streak or the run tally, and `hide.test.ts` holds it to that.
 * Three of the five hide counters are sent from here -- a hide was opened, it was found,
 * the finder told the setter -- and none of them carries the hide, the painting or the
 * shape. It works for anyone with the link, test mode or not, because the link is the
 * puzzle.
 */
export default function FriendHunt({ code }: { code: string }) {
  const decoded = useMemo<Decoded>(() => decodeHide(code), [code]);
  // Counted only once the link has turned out to be playable, so a cut-short link is not
  // a hunt somebody opened.
  const opened = decoded.ok;
  useEffect(() => {
    if (opened) countHide('hunted');
  }, [opened]);
  if (!decoded.ok) return <BadLink reason={decoded.reason} />;
  return (
    <Hunt
      puzzle={hidePuzzle(decoded.hide, decoded.painting)}
      link={hideLink(decoded.hide, SITE_URL)}
    />
  );
}

function BadLink({ reason }: { reason: 'malformed' | 'future' | 'painting' }) {
  return (
    <div className="app testbed">
      <div className="howto testbed-card" role="dialog" aria-label="This link does not open">
        <h2>This hide will not open</h2>
        <p>
          {reason === 'future'
            ? 'It was made on a newer version of Find Me than this page. Reload, and if that does not do it, try again in a little while.'
            : reason === 'painting'
              ? 'It is set on a painting this page does not know yet. Try again tomorrow.'
              : 'The link looks cut short or mistyped. Ask for it to be sent again, whole.'}
        </p>
        <p className="howto-note">
          In the meantime, today&rsquo;s puzzle is at <a href="/">findme.ryangano.com</a>.
        </p>
      </div>
    </div>
  );
}

function Hunt({ puzzle, link }: { puzzle: Puzzle; link: string }) {
  const [showCard, setShowCard] = useState(false);
  const [shared, setShared] = useState<string | null>(null);

  const onSolved = useCallback(() => {
    countHide('found');
    setShowCard(true);
  }, []);

  const {
    stageRef,
    transform,
    ready,
    onReady,
    fitScale,
    targetSize,
    match,
    startedAt,
    clock,
    running,
    paused,
    solvedMs,
    gaveUpMs,
    metrics,
    togglePause,
    reset,
    giveUp,
  } = useHunt({ puzzle, runId: puzzle.id, onSolved, blocked: showCard });

  const done = solvedMs ?? gaveUpMs;

  const onGiveUp = useCallback(() => {
    giveUp();
    setShowCard(true);
  }, [giveUp]);

  const share = useCallback(async () => {
    if (done === null) return;
    const trace = huntTrace(metrics);
    const lines = [
      gaveUpMs !== null
        ? `I gave up on your ${puzzle.emoji} after ${formatTime(done)}`
        : `Found your ${puzzle.emoji} in ${formatTime(done)}`,
      ...(trace ? [trace] : []),
      `Find Me · ${puzzle.title}`,
      // The hide itself, not the front door: whoever this goes to can hunt the same
      // shape, which is most of the point of telling them about it.
      link,
    ];
    countHide('told');
    const result = await shareResult(lines.join('\n'));
    // Short on purpose: this sits on the button beside "Today's puzzle", and the two
    // have to stay on one line down to a 320px phone. "Try again" is also the truer
    // word -- the button still works, so it is an invitation, not a verdict.
    setShared(result === 'copied' ? 'Copied' : result === 'failed' ? 'Try again' : 'Shared');
  }, [done, gaveUpMs, link, metrics, puzzle.emoji, puzzle.title]);

  return (
    <div className="app">
      <header className="topbar">
        <h1 className="title">
          <span className="title-btn">Find Me</span>{' '}
          <span className="title-day">from a friend</span>
        </h1>
        <p className={`clock${running ? ' is-running' : ''}`}>
          {startedAt === null ? 'ready' : formatTime(clock)}
        </p>
        <div className="topbar-actions">
          {startedAt !== null && done === null && (
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
          {done === null && (
            <button
              type="button"
              className="btn testbed-giveup"
              onClick={onGiveUp}
              disabled={startedAt === null}
              title={startedAt === null ? 'Have a look first' : 'Stop the clock and show me'}
            >
              give up
            </button>
          )}
        </div>
      </header>

      <p className="practice-note">a hide from a friend — nothing here is recorded</p>

      <main className="board">
        <Stage
          stageRef={stageRef}
          puzzle={puzzle}
          transform={transform ?? { x: 0, y: 0, scale: 1, rot: 0 }}
          fitScale={fitScale}
          showRing={gaveUpMs !== null}
          blurred={paused || (startedAt === null && done === null)}
          paused={paused}
          resumed={false}
          onReady={onReady}
        />

        {!ready && <p className="loading">Loading the painting…</p>}

        <ReferenceCard
          puzzle={puzzle}
          targetSize={targetSize}
          match={match}
          solvedMs={solvedMs}
          onReopen={() => setShowCard(true)}
        />

        {showCard && done !== null && (
          <>
            <div className="scrim" onClick={() => setShowCard(false)} />
            <div className="howto" role="dialog" aria-label="Your result">
              <h2>{gaveUpMs !== null ? 'There it was' : `Found it in ${formatTime(done)}`}</h2>
              <p>
                {gaveUpMs !== null
                  ? `The ringed ${puzzle.thing} is the one your friend hid in ${puzzle.title}.`
                  : `You found the ${puzzle.thing} your friend hid in ${puzzle.title}.`}
              </p>
              {huntTrace(metrics) && <p className="hide-trace">{huntTrace(metrics)}</p>}
              {/* Two, so they sit on one line on a phone. There is no third for looking
                  around the painting because there does not need to be one: the scrim is
                  the whole board, so a tap on the picture puts the card away, and the
                  badge in the corner brings it back. */}
              <div className="hide-actions">
                <button type="button" className="btn btn-primary" onClick={share}>
                  {shared ?? 'Tell them'}
                </button>
                <a className="btn" href="/">
                  Today&rsquo;s puzzle
                </a>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
