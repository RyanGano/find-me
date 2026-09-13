import { useCallback, useEffect, useMemo, useState } from 'react';
import { Credits } from './components/Credits';
import { ReferenceCard } from './components/ReferenceCard';
import { Stage } from './components/Stage';
import { countHide, fetchHide, type BrokenReason } from './game/count';
import { formatTime } from './game/format';
import {
  decodeHide,
  hideLink,
  hidePuzzle,
  hideTitle,
  readShortCode,
  shortLink,
  storedHide,
  type Decoded,
} from './game/hide';
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
  return <Opened result={decoded} link={decoded.ok ? hideLink(decoded.hide, SITE_URL) : ''} />;
}

type Result = Decoded | { ok: false; reason: 'unknown' | 'unreachable' };

/**
 * A hide stored behind a short code (`?p=`), fetched by that code alone. The fetch is made
 * whether or not this browser is counted -- it is how the puzzle arrives -- and the beacons
 * after it are behind the switch like every other. Sharing back sends the same short link,
 * rather than storing the hide a second time.
 */
export function StoredHunt({ code }: { code: string }) {
  const [result, setResult] = useState<Result | null>(null);
  useEffect(() => {
    let live = true;
    void fetchHide(code).then((fetched) => {
      if (live) setResult(fetched.ok ? storedHide(fetched.body) : fetched);
    });
    return () => {
      live = false;
    };
  }, [code]);
  if (!result) {
    return (
      <div className="app testbed">
        <div className="howto testbed-card" role="status">
          <p>Loading the hide…</p>
        </div>
      </div>
    );
  }
  const read = readShortCode(code);
  return <Opened result={result} link={read ? shortLink(read, SITE_URL) : ''} />;
}

function Opened({ result, link }: { result: Result; link: string }) {
  // Counted only once the link has turned out to be playable, so a cut-short link is not
  // a hunt somebody opened -- it is a broken one, counted as that, with why.
  const reason = result.ok ? null : result.reason;
  useEffect(() => {
    if (reason === null) countHide('hunted');
    else countHide('broken', { reason });
  }, [reason]);
  if (!result.ok) return <BadLink reason={result.reason} />;
  return (
    <Hunt
      puzzle={hidePuzzle(result.hide, result.painting)}
      link={link}
      title={hideTitle(result.hide, result.painting)}
      named={Boolean(result.hide.name)}
    />
  );
}

function BadLink({ reason }: { reason: BrokenReason }) {
  return (
    <div className="app testbed">
      <div className="howto testbed-card" role="dialog" aria-label="This link does not open">
        <h2>This hide will not open</h2>
        <p>
          {reason === 'future'
            ? 'It was made on a newer version of Find Me than this page. Reload, and if that does not do it, try again in a little while.'
            : reason === 'painting'
              ? 'It is set on a painting this page does not know yet. Try again tomorrow.'
              : reason === 'unreachable'
                ? 'Find Me could not be reached to fetch it. Check your connection, then reload to try again.'
                : reason === 'unknown'
                  ? 'No hide goes by that code. Check it was typed right, or ask for the link again.'
                  : 'The link looks cut short or mistyped. Ask for it to be sent again, whole.'}
        </p>
        <p className="howto-note">
          In the meantime, today&rsquo;s puzzle is at <a href="/">findme.ryangano.com</a>.
        </p>
      </div>
    </div>
  );
}

/**
 * `title` is what the hide goes by -- the setter's name for it, or the painting's title. The
 * puzzle keeps the painting's own, since the stage's alt text describes the picture.
 */
function Hunt({ puzzle, link, title, named }: { puzzle: Puzzle; link: string; title: string; named: boolean }) {
  const [showCard, setShowCard] = useState(false);
  const [showCredits, setShowCredits] = useState(false);
  const [shared, setShared] = useState<string | null>(null);

  const onSolved = useCallback(() => {
    countHide('found');
    setShowCredits(false);
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
  } = useHunt({ puzzle, runId: puzzle.id, onSolved, blocked: showCard || showCredits });

  const done = solvedMs ?? gaveUpMs;
  // A setter's name is quoted, since it can read as part of the sentence -- "hid in Eric's
  // favorite painting" -- where a painting's title never does.
  const quoted = named ? `“${title}”` : title;

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
      `Find Me · ${title}`,
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
  }, [done, gaveUpMs, link, metrics, puzzle.emoji, title]);

  return (
    <div className="app">
      <header className="topbar">
        <h1 className="title friend-title" title={named ? title : undefined}>
          {/* As on the daily game: the way to ask what the painting is. */}
          <button
            type="button"
            className="title-btn"
            onClick={() => {
              setShowCard(false);
              setShowCredits((open) => !open);
            }}
            title="About the painting"
          >
            Find Me
          </button>{' '}
          <span className="title-day">{named ? title : 'from a friend'}</span>
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

        {showCredits && <Credits puzzle={puzzle} onDismiss={() => setShowCredits(false)} />}

        {showCard && done !== null && (
          <>
            <div className="scrim" onClick={() => setShowCard(false)} />
            <div className="howto" role="dialog" aria-label="Your result">
              <h2>{gaveUpMs !== null ? 'There it was' : `Found it in ${formatTime(done)}`}</h2>
              <p>
                {gaveUpMs !== null
                  ? `The ringed ${puzzle.thing} is the one your friend hid in ${quoted}.`
                  : `You found the ${puzzle.thing} your friend hid in ${quoted}.`}
              </p>
              {named && (
                <p className="howto-note">
                  on {puzzle.title} by {puzzle.artist}
                </p>
              )}
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
