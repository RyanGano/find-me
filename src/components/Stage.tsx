import { DEG } from '../game/transform';
import type { Puzzle, Transform } from '../game/types';
import { Shape } from './Shape';

interface Props {
  stageRef: React.RefObject<HTMLDivElement | null>;
  puzzle: Puzzle;
  transform: Transform;
  /** The scale at which the whole painting is on screen, which fixes the shape's softening. */
  fitScale: number;
  /** Draw the reveal ring. Only ever true once solved, and the player can turn it off. */
  showRing: boolean;
  /** Hide the detail until the player commits, so nobody can scan for free. */
  blurred: boolean;
  /** Blurred because the player paused, rather than because they have not started. */
  paused: boolean;
  /** Blurred on a run picked up again after the player left the page mid-hunt. */
  resumed: boolean;
  onReady: () => void;
}

/**
 * The pannable, zoomable, rotatable painting. Everything inside `.stage-canvas`
 * lives in image pixel coordinates; the single CSS transform maps it to the screen,
 * which keeps the hidden shape locked to the artwork under every gesture.
 */
export function Stage({
  stageRef,
  puzzle,
  transform,
  fitScale,
  showRing,
  blurred,
  paused,
  resumed,
  onReady,
}: Props) {
  const { target } = puzzle;
  const css = `translate(${transform.x}px, ${transform.y}px) rotate(${transform.rot * DEG}deg) scale(${transform.scale})`;

  // Keep the reveal ring a constant thickness on screen however far we are zoomed in.
  const ringSize = target.size * 2.2;
  const ringWidth = 3 / transform.scale;

  // How far past the fitted view we are, which the shape's edge softening is divided by.
  //
  // The softening is a scanning-view lever: it is what stops a vector edge reading as a
  // vector edge among the specks, and every day in the file is tuned against how it looks
  // at the fitted view. But the filter lives inside the zoom, so the radius was growing
  // with every pinch -- by the match the painting is drawn five to ten times native and
  // half an image pixel had become a smear several screen pixels wide, which is not what
  // the player is asked to match: the badge beside it is a crisp vector. Dividing it out
  // holds the softening at exactly what it is when the whole painting is on screen, so the
  // fitted view is untouched and the shape sharpens as the player closes in.
  const zoom = Math.max(1, transform.scale / fitScale);

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
        style={{ width: puzzle.width, height: puzzle.height, transform: css, '--stage-zoom': zoom } as React.CSSProperties}
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
          style={
            {
              left: target.cx - target.size / 2,
              top: target.cy - target.size / 2,
              '--shape-blur': `${target.blur ?? 0}px`,
            } as React.CSSProperties
          }
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

      {blurred && (
        <p className={`stage-start-hint${resumed ? ' is-resumed' : ''}`}>
          {resumed
            ? 'Still hunting — press play to pick up where you left off'
            : paused
              ? 'Paused — press play to carry on'
              : 'Pan, pinch or rotate to start'}
        </p>
      )}
    </div>
  );
}
