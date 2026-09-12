import { useMemo } from 'react';
import { formatTime } from './game/format';
import { applyRestoreOnce, type RestoreRequest } from './game/restore';
import { getResult, isPersistent } from './game/storage';
import { isTestMode } from './game/testMode';

/**
 * The `?restore=` page: a time put back on the browser that lost it, and a plain account
 * of what happened.
 *
 * A page of its own rather than a notice on the board, for the same reason `?diag` is
 * one. Whoever opens this is not here to play -- they are here to be told whether their
 * day is fixed -- and a write to the results store has no business happening underneath
 * a live hunt, where the board has already read the day it is about to be given.
 *
 * Everything it can say, it says. What the day reads now, what it read before, whether
 * the write was actually kept -- because the one failure worth catching is the browser
 * that accepts a write and throws it away, which is the same browser that loses streaks
 * and is therefore exactly the one a player in this position is likely to be on.
 */
export function Restore({ request }: { request?: RestoreRequest }) {
  const done = useMemo(() => (request ? applyRestoreOnce(request) : undefined), [request]);
  // Read it back rather than trusting the write: a browser keeping nothing is the case
  // this page exists to catch, and it reports success just like any other.
  const kept = useMemo(
    () => (request && done ? getResult(request.day)?.ms === done.written.ms : false),
    [done, request],
  );
  const persists = useMemo(() => isPersistent(), []);

  if (!request || !done) {
    return (
      <div className="diag">
        <h1>Find Me — restore a time</h1>
        <p className="diag-lead">
          That link isn&rsquo;t right, so nothing was changed. Ask for a new one.
        </p>
        <p>
          <a href="/">back to the game</a>
        </p>
      </div>
    );
  }

  const { replaced, written } = done;

  return (
    <div className="diag">
      <h1>Find Me — restore a time</h1>

      {kept ? (
        <p className="diag-lead">
          Done. Puzzle #{request.number} is back to the time you set on it.
        </p>
      ) : (
        <p className="diag-lead">
          This browser didn&rsquo;t keep the change. Nothing written here will last, and the
          same is true of your streak — <a href="/?diag">the storage check</a> says why.
        </p>
      )}

      <dl>
        <dt>puzzle</dt>
        <dd>#{request.number}</dd>

        <dt>now reads</dt>
        <dd className="ok">
          {formatTime(written.ms)}
          {written.gaveUp ? ' (gave up)' : ''}
        </dd>

        <dt>replaced</dt>
        <dd className={replaced ? 'bad' : undefined}>
          {replaced ? `${formatTime(replaced.ms)}${replaced.gaveUp ? ' (gave up)' : ''}` : 'nothing'}
        </dd>

        <dt>kept by this browser</dt>
        <dd className={kept && persists ? 'ok' : 'bad'}>{kept && persists ? 'yes' : 'no'}</dd>
      </dl>

      <p className="diag-lead">
        This changed only this browser, on this device. If you play Find Me somewhere else
        too — another browser, or from a link inside another app — that copy has its own
        record and is untouched.
      </p>

      {isTestMode() && (
        <p className="diag-lead">
          Test mode: this was written to the test store, not the real one.
        </p>
      )}

      <p>
        <a href="/">back to the game</a>
      </p>
    </div>
  );
}
