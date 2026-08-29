import { Shape } from './Shape';
import { formatTime } from '../game/format';
import type { MatchState } from '../game/match';
import type { Puzzle } from '../game/types';

interface Props {
  puzzle: Puzzle;
  /** The exact on-screen size the hidden shape must be matched to. */
  targetSize: number;
  match: MatchState | null;
  /** The finished time, or null while the hunt is still on. */
  solvedMs: number | null;
  /** Put the result card back up. Only reachable once solved. */
  onReopen: () => void;
}

/**
 * The always-visible corner reference: the shape drawn upright, in its real colour, at
 * exactly the size the player has to match.
 *
 * The colour matters as much as the size. This badge is the only description of what
 * is hidden, so drawing it in a house colour rather than the target's own fill sends
 * people hunting for the wrong thing. It sits on a neutral well because the fills range
 * from pale ice blue to dark slate and both have to read; the shape is drawn at full
 * opacity, since the blend against the painting cannot be reproduced on a flat card.
 *
 * The badge is also where the closeness hint lives. It lights when the view is nearly
 * right on size and angle, and greens on the match. Putting that hint on the hidden
 * shape instead -- which is where it started -- drew a bright ring around the very
 * thing the player is supposed to be searching for, handing over the answer to anyone
 * who had not spotted it yet. Here it says the same thing while revealing nothing:
 * closeness depends only on zoom and twist, never on position.
 *
 * The label never names the shape. "Find the crescent moon" is far wider than
 * "nearly", so the badge used to jump leftwards at the exact moment the player is
 * making fine adjustments. All three words are short now, and the label reserves a
 * fixed width, so the card and the shape inside it hold still for the whole run. The
 * drawing says what to look for better than the words did anyway.
 *
 * Once the day is solved the badge is the way back to the result card. Dismissing that
 * card used to be one stray tap from irreversible -- a refresh was the only way to see
 * your own time again -- and this is the element already carrying the run's state, in
 * the corner the player is already looking at, with nothing left to say after the
 * solve. It shows the time rather than "found" precisely so there is something worth
 * tapping.
 */
export function ReferenceCard({ puzzle, targetSize, match, solvedMs, onReopen }: Props) {
  const solved = solvedMs !== null;
  const state = solved ? ' is-solved' : match?.near ? ' is-near' : '';

  const inner = (
    <>
      <div className="reference-well" style={{ width: targetSize, height: targetSize }}>
        <Shape
          shape={puzzle.target.shape}
          size={targetSize}
          fill={puzzle.target.fill ?? 'var(--accent)'}
        />
      </div>
      <p className="reference-label">
        {solved ? `${formatTime(solvedMs)} ›` : match?.near ? 'nearly' : 'find me'}
      </p>
    </>
  );

  if (solved) {
    return (
      <button
        type="button"
        className={`reference${state}`}
        onClick={onReopen}
        title="Show your result"
        aria-label={`Solved in ${formatTime(solvedMs)}. Show your result.`}
      >
        {inner}
      </button>
    );
  }

  return (
    <div className={`reference${state}`} aria-label={`Find this ${puzzle.thing}`}>
      {inner}
    </div>
  );
}
