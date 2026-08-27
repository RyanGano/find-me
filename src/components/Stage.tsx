import { DEG } from '../game/transform';
import type { Puzzle, Transform } from '../game/types';
import { Shape } from './Shape';

interface Props {
  stageRef: React.RefObject<HTMLDivElement | null>;
  puzzle: Puzzle;
  transform: Transform;
  /** Draw the reveal ring. Only ever true once solved, and the player can turn it off. */
  showRing: boolean;
  /** Hide the detail until the player commits, so nobody can scan for free. */
  blurred: boolean;
  onReady: () => void;
}

/**
 * The pannable, zoomable, rotatable painting. Everything inside `.stage-canvas`
 * lives in image pixel coordinates; the single CSS transform maps it to the screen,
 * which keeps the hidden shape locked to the artwork under every gesture.
 */
export function Stage({ stageRef, puzzle, transform, showRing, blurred, onReady }: Props) {
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
            blur={target.blur}
          />
        </div>
        {showRing && (
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
