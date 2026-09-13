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
  onDismiss: () => void;
}

export function HowTo({ thing, rung, friend, onDismiss }: Props) {
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
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
      <p>
        {friend
          ? `A friend hid a ${thing} somewhere in this painting.`
          : `A ${thing} is hidden somewhere in today’s painting.`}{' '}
        Find it, then frame it so it appears at the <strong>same size and angle</strong> as
        the badge in the corner.
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
        <li>The corner badge lights up once the {thing} is on screen at close to the right size and angle</li>
      </ul>
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
            Stuck? After a while of hunting, <strong>hint</strong> draws a circle the {thing} is
            somewhere inside. You still have to find it, your streak is safe, and your share
            shows a 💡.
          </p>
          <p className="howto-note">
            If it beats you, <strong>give up</strong> will show you where it was. It opens a
            little after the hint, and it ends your streak.
          </p>
          <p className="howto-note">
            This painting stays all week, with something different to find in it each day and
            each day harder than the last. Today is <strong>{rung}</strong>.
          </p>
        </>
      )}
      {/* Reporting is on unless the player turns it off, so the first screen they see says
          so -- in one line, with the way to the details and the switch. */}
      <p className="howto-note">
        Find Me reports plays anonymously.{' '}
        <button type="button" className="link-btn" onClick={() => setShowPrivacy(true)}>
          What&rsquo;s reported
        </button>
      </p>

      <div className="howto-foot">
        <button type="button" className="btn btn-primary" onClick={onDismiss}>
          Close
        </button>
      </div>
    </div>
  );
}
