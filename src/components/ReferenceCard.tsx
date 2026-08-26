import { Shape } from './Shape';
import type { Puzzle } from '../game/types';

interface Props {
  puzzle: Puzzle;
  /** The exact on-screen size the hidden shape must be matched to. */
  targetSize: number;
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
 */
export function ReferenceCard({ puzzle, targetSize }: Props) {
  return (
    <div className="reference" aria-label={`Find this ${puzzle.thing}`}>
      <div className="reference-well" style={{ width: targetSize, height: targetSize }}>
        <Shape
          shape={puzzle.target.shape}
          size={targetSize}
          fill={puzzle.target.fill ?? 'var(--accent)'}
        />
      </div>
      <p className="reference-label">find the {puzzle.thing}</p>
    </div>
  );
}
