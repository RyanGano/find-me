import { useState } from 'react';
import { Reporting } from './Reporting';

interface Props {
  thing: string;
  /** Monday, Tuesday... Named so the ramp is something a player can see coming. */
  rung?: string;
  /**
   * A hide a friend set, which is very often somebody's first sight of Find Me: the same
   * controls, but no week, no hint and no streak to explain.
   */
  friend?: boolean;
  /**
   * A play-testing round that is open today: how many hunts it asks for, and whether this
   * browser has already answered it. Absent when there is no round.
   */
  invite?: { hunts: number; done: boolean };
  /**
   * Opened for the player rather than by them, on their first sight of the game: only what
   * they need to make a first move, with the rest one tap away. A wall of rules on move
   * zero reads as "never mind". Opened from the ? it is the whole thing.
   */
  brief?: boolean;
  onDismiss: () => void;
}

export function HowTo({ thing, rung, friend, invite, brief, onDismiss }: Props) {
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const [more, setMore] = useState(!brief);
  // Folded away rather than always on show: it is a promise the player can go and read,
  // not something to make them wade through before their first game.
  const [showPrivacy, setShowPrivacy] = useState(false);

  // The reporting note takes the panel over rather than unfolding below the rules: it is a
  // thing the player has gone looking for, and reading it next to the how-to left them
  // scrolling past the game to find the one control it exists for.
  if (showPrivacy) return <Reporting onBack={() => setShowPrivacy(false)} />;

  return (
    <div className="howto" role="dialog" aria-label="How to play">
      <h2>How to play</h2>
      {/* First, while a round is open: the highlighted ? in the bar is what brings a player
          here, so the thing it is highlighted for should not be below the fold. Not on a
          first sight of the game, which is no time to ask for testers. The link opens a new
          tab because the player may well be mid-hunt. */}
      {invite && !friend && more && (
        <p className="howto-invite">
          {invite.done ? (
            'Thanks for play-testing — your answers are in.'
          ) : (
            <>
              <strong>Help test Find Me:</strong> {invite.hunts} short hunts on paintings that
              aren&rsquo;t in the game.{' '}
              <a href="/?beta" target="_blank" rel="noopener noreferrer">
                Try them in a new tab
              </a>
            </>
          )}
        </p>
      )}
      <p>
        {friend
          ? `A friend hid a ${thing} somewhere in this painting.`
          : `A ${thing} is hidden somewhere in today’s painting.`}{' '}
        Pan, zoom, and rotate until it matches the badge in the corner —{' '}
        <strong>same size, same angle</strong>.
      </p>
      <ul>
        {coarse ? (
          <>
            <li>One finger to pan</li>
            <li>Two fingers to pinch and twist</li>
          </>
        ) : (
          <>
            <li>Drag to pan, scroll to zoom</li>
            <li>Shift + scroll or shift + drag to rotate</li>
          </>
        )}
        {more && (
          <li>The corner badge lights up once the {thing} is on screen at close to the right size and angle</li>
        )}
      </ul>
      {more && (
        <>
          <p className="howto-note">
            The painting stays blurred, and the clock stays stopped, until your first move — so
            there is no free look.
          </p>
          {friend ? (
            <p className="howto-note">
              If it beats you, <strong>give up</strong> shows you where it was.
            </p>
          ) : (
            <>
              <p className="howto-note">
                Stuck? After a while of hunting, <strong>hint</strong> draws a circle the {thing}{' '}
                is somewhere inside. You still have to find it, your streak is safe, and your
                share shows a 💡.
              </p>
              <p className="howto-note">
                If it beats you, <strong>give up</strong> will show you where it was. It opens a
                little after the hint, and it ends your streak.
              </p>
              <p className="howto-note">
                This painting stays all week, with something different to find in it each day
                and each day harder than the last. Today is <strong>{rung}</strong>.
              </p>
              <p className="howto-note">
                Once today&rsquo;s is done, <strong>hide one for a friend</strong>: set your own
                puzzle in a painting and send it as a link.
              </p>
            </>
          )}
        </>
      )}
      {/* Reporting is on unless the player turns it off, so even the brief first screen says
          so -- in one line, with the way to the details and the switch. */}
      <p className="howto-note">
        Find Me reports plays anonymously.{' '}
        <button type="button" className="link-btn" onClick={() => setShowPrivacy(true)}>
          What&rsquo;s reported
        </button>
      </p>
      {more && (
        <p className="howto-note">All artwork is in the public domain; the scans come from Wikimedia Commons.</p>
      )}

      <div className="howto-foot">
        {!more && (
          <button type="button" className="link-btn" onClick={() => setMore(true)}>
            How it works
          </button>
        )}
        <button type="button" className="btn btn-primary" onClick={onDismiss}>
          Close
        </button>
      </div>
    </div>
  );
}
