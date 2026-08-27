import { CREDITS } from '../game/puzzles';

interface Props {
  /** Asset id of this week's painting, so it can be marked in the list. */
  image: string;
  onDismiss: () => void;
}

/**
 * Attribution for the paintings. Every one is in the rotation all the time, so the
 * whole list is credited rather than just today's -- and this week's is marked, which
 * is also how a player finds out what they have been staring at without waiting for
 * the solve.
 */
export function Credits({ image, onDismiss }: Props) {
  return (
    <div className="howto credits" role="dialog" aria-label="Image credits">
      <h2>The paintings</h2>
      <ul className="credits-list">
        {CREDITS.map((art) => (
          <li key={art.id} className={art.id === image ? 'is-current' : undefined}>
            <strong>{art.title}</strong>
            <span>
              {art.artist} &middot; {art.year}
            </span>
            {art.id === image && <em>this week</em>}
          </li>
        ))}
      </ul>
      <p className="howto-note">
        All eight are in the public domain; the scans come from Wikimedia Commons.
      </p>
      <button type="button" className="btn btn-primary" onClick={onDismiss}>
        Close
      </button>
    </div>
  );
}
