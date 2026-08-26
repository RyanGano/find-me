import { getShape } from '../game/shapes';
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
  /** Hide the detail until the player commits, so nobody can scan for free. */
  blurred: boolean;
  onReady: () => void;
}

/**
 * The pannable, zoomable, rotatable painting. Everything inside `.stage-canvas`
 * lives in image pixel coordinates; the single CSS transform maps it to the screen,
 * which keeps the hidden shape locked to the artwork under every gesture.
 */
export function Stage({ stageRef, puzzle, transform, match, solved, blurred, onReady }: Props) {
  const { target } = puzzle;
  const css = `translate(${transform.x}px, ${transform.y}px) rotate(${transform.rot * DEG}deg) scale(${transform.scale})`;

  // Keep the reveal ring a constant thickness on screen however far we are zoomed in.
  const ringSize = target.size * 2.2;
  const ringWidth = 3 / transform.scale;

  // The outline is drawn in the shape's own 100-unit space, so convert from the screen
  // width we want back through both the shape's size and the current zoom.
  const outlineWidth = (2.5 * 100) / (target.size * transform.scale);
  const outlined = Boolean(match && (match.near || solved));

  return (
    <div
      ref={stageRef}
      className="stage"
      tabIndex={0}
      role="application"
      aria-label={`Find the ${puzzle.thing} hidden in ${puzzle.title}`}
    >
      {/* The blur sits on this unscaled wrapper rather than on the canvas itself: a
          filter inside the zoom would have its radius scaled along with everything
          else, so it would all but vanish at the fitted view. */}
      <div className={`stage-viewport${blurred ? ' is-blurred' : ''}`}>
      <div
        className="stage-canvas"
        style={{ width: puzzle.width, height: puzzle.height, transform: css }}
      >
        <img
          className="stage-image"
          // A cached image can already be complete before React attaches onLoad, and a
          // missed load event used to leave every gesture disabled for good.
          ref={(node) => {
            if (node?.complete) onReady();
          }}
          src={puzzle.src}
          width={puzzle.width}
          height={puzzle.height}
          alt={`${puzzle.title} by ${puzzle.artist}`}
          onLoad={onReady}
          // Even a broken image should leave a usable page rather than a dead one.
          onError={onReady}
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
          {outlined && (
            <svg
              className={`stage-outline${solved ? ' is-solved' : ''}`}
              width={target.size}
              height={target.size}
              viewBox="0 0 100 100"
              aria-hidden="true"
              style={{ transform: `rotate(${target.angle}deg)` }}
            >
              <path
                d={getShape(target.shape).path}
                fill="none"
                fillRule={getShape(target.shape).fillRule ?? 'evenodd'}
                strokeWidth={outlineWidth}
                strokeLinejoin="round"
              />
            </svg>
          )}
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
      </div>

      {blurred && <p className="stage-start-hint">Pan, pinch or rotate to start</p>}
    </div>
  );
}
