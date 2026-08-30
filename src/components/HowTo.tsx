import { useState } from 'react';
import { isCounted, setCounted } from '../game/count';

interface Props {
  thing: string;
  /** Monday, Tuesday... Named so the ramp is something a player can see coming. */
  rung: string;
  onDismiss: () => void;
}

export function HowTo({ thing, rung, onDismiss }: Props) {
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  // Folded away rather than always on show: it is a promise the player can go and read,
  // not something to make them wade through before their first game.
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [counted, setCountedState] = useState(isCounted);

  const toggleCounted = () => {
    const next = !counted;
    setCounted(next);
    setCountedState(next);
  };

  // The tally note takes the panel over rather than unfolding below the rules: it is a
  // thing the player has gone looking for, and reading it next to the how-to left them
  // scrolling past the game to find the one control it exists for.
  if (showPrivacy) {
    return (
      <div className="howto" role="dialog" aria-label="What’s counted">
        <h2>What&rsquo;s counted</h2>
        <p className="howto-note">
          The only thing this site records is that a run happened, whether it was solved,
          and how long it took — nothing that identifies you.
        </p>
        <div className="howto-foot">
          <button type="button" className="btn btn-primary" onClick={() => setShowPrivacy(false)}>
            Back
          </button>
          <button type="button" className="btn btn-quiet" onClick={toggleCounted}>
            {counted ? 'Don’t count my runs' : 'Counting is off — count them again'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="howto" role="dialog" aria-label="How to play">
      <h2>How to play</h2>
      <p>
        A {thing} is hidden somewhere in today&rsquo;s painting. Find it, then frame it so it
        appears at the <strong>same size and angle</strong> as the badge in the corner.
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
      <p className="howto-note">
        This painting stays all week, with something different to find in it each day and
        each day harder than the last. Today is <strong>{rung}</strong>.
      </p>

      <p className="howto-note">
        Find Me is still in beta: the puzzles are being tuned as people play, so times,
        ages and streaks may change or reset.
      </p>

      <div className="howto-foot">
        <button type="button" className="btn btn-primary" onClick={onDismiss}>
          Close
        </button>
        <button
          type="button"
          className="btn btn-quiet"
          onClick={() => setShowPrivacy(true)}
        >
          What&rsquo;s counted
        </button>
      </div>
    </div>
  );
}
