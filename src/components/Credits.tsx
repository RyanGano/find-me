import type { Puzzle } from '../game/types';

interface Props {
  puzzle: Puzzle;
  onDismiss: () => void;
}

/**
 * Credit for the painting on the board.
 *
 * The result card names it too, but only after the solve and only for the day it was
 * solved; this is how a player can ask what they have been staring at all week.
 */
export function Credits({ puzzle, onDismiss }: Props) {
  return (
    <div className="howto credits" role="dialog" aria-label="About the painting">
      <h2>The painting</h2>
      <p className="credits-art">
        <strong>{puzzle.title}</strong>
        <span>
          {puzzle.artist} &middot; {puzzle.year}
        </span>
      </p>
      <p className="howto-note">
        All artwork is in the public domain; the scans come from Wikimedia Commons.
      </p>
      <button type="button" className="btn btn-primary" onClick={onDismiss}>
        Close
      </button>
    </div>
  );
}
