import { Shape } from './Shape';
import type { Puzzle } from '../game/types';

interface Props {
  puzzle: Puzzle;
  /** The exact on-screen size the hidden shape must be matched to. */
  targetSize: number;
}

/**
 * The always-visible corner reference: the shape drawn upright at exactly the size
 * the player has to match, so it can be compared to the image by eye.
 */
export function ReferenceCard({ puzzle, targetSize }: Props) {
  return (
    <div className="reference" aria-label={`Find this ${puzzle.thing}`}>
      <div className="reference-well" style={{ width: targetSize, height: targetSize }}>
        <Shape shape={puzzle.target.shape} size={targetSize} fill="var(--accent)" />
      </div>
      <p className="reference-label">find the {puzzle.thing}</p>
    </div>
  );
}
