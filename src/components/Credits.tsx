import type { Puzzle } from '../game/types';

interface Props {
  /** This week's painting. */
  puzzle: Puzzle;
  /** The one that takes over on Monday. */
  next: Puzzle;
  onDismiss: () => void;
}

/**
 * Credit for the painting on the board, and a look at the one coming next.
 *
 * The result card names the painting too, but only after the solve and only for the
 * day it was solved; this is how a player can ask what they have been staring at all
 * week, and see what is worth coming back for.
 */
export function Credits({ puzzle, next, onDismiss }: Props) {
  return (
    <div className="howto credits" role="dialog" aria-label="About the painting">
      <h2>The painting</h2>
      <ul className="credits-list">
        <li>
          <em>This week</em>
          <strong>{puzzle.title}</strong>
          <span>
            {puzzle.artist} &middot; {puzzle.year}
          </span>
        </li>
        <li>
          <em>Next week</em>
          <strong>{next.title}</strong>
          <span>
            {next.artist} &middot; {next.year}
          </span>
        </li>
      </ul>
      <p className="howto-note">
        A painting stays for the whole week, with something different to find in it each
        day. All of them are in the public domain; the scans come from Wikimedia Commons.
      </p>
      <button type="button" className="btn btn-primary" onClick={onDismiss}>
        Close
      </button>
    </div>
  );
}
