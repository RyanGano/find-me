import { DEG } from '../game/transform';
import type { MatchState } from '../game/match';
import type { Puzzle, Transform } from '../game/types';
import { Shape } from './Shape';

interface Props {
  stageRef: React.RefObject<HTMLDivElement | null>;
  puzzle: Puzzle;
  transform: Transform;
  match: MatchState | null;
  solved: boolean;
  onLoad: () => void;
}

/**
 * The pannable, zoomable, rotatable painting. Everything inside `.stage-canvas`
 * lives in image pixel coordinates; the single CSS transform maps it to the screen,
 * which keeps the hidden shape locked to the artwork under every gesture.
 */
export function Stage({ stageRef, puzzle, transform, match, solved, onLoad }: Props) {
  const { target } = puzzle;
  const css = `translate(${transform.x}px, ${transform.y}px) rotate(${transform.rot * DEG}deg) scale(${transform.scale})`;

  // Keep the reveal ring a constant thickness on screen however far we are zoomed in.
  const ringSize = target.size * 2.2;
  const ringWidth = 3 / transform.scale;

  return (
    <div
      ref={stageRef}
      className="stage"
      tabIndex={0}
      role="application"
      aria-label={`Find the ${puzzle.thing} hidden in ${puzzle.title}`}
    >
      <div className="stage-canvas" style={{ width: puzzle.width, height: puzzle.height, transform: css }}>
        <img
          className="stage-image"
          src={puzzle.src}
          width={puzzle.width}
          height={puzzle.height}
          alt={`${puzzle.title} by ${puzzle.artist}`}
          onLoad={onLoad}
          draggable={false}
        />
        <div
          className="stage-target"
          style={{ left: target.cx - target.size / 2, top: target.cy - target.size / 2 }}
        >
          <Shape
            shape={target.shape}
            size={target.size}
            angle={target.angle}
            fill={target.fill}
            stroke={target.stroke}
            strokeWidth={target.strokeWidth}
            opacity={target.opacity}
            blend={target.blend}
          />
        </div>
        {solved && (
          <div
            className="stage-ring"
            style={{
              left: target.cx - ringSize / 2,
              top: target.cy - ringSize / 2,
              width: ringSize,
              height: ringSize,
              borderWidth: ringWidth,
            }}
          />
        )}
      </div>
      {match && !solved && !match.onScreen && match.sizeOk && match.angleOk && (
        <p className="stage-nudge">Size and angle matched — now pan until it is on screen</p>
      )}
    </div>
  );
}
