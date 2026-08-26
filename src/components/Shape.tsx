import { getShape } from '../game/shapes';

interface Props {
  shape: string;
  size: number;
  /** Degrees clockwise. */
  angle?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  blend?: string;
  /** Edge softening in the shape's own pixel units. */
  blur?: number;
  className?: string;
  style?: React.CSSProperties;
}

/** Draws a registry shape at an exact pixel size, upright unless rotated. */
export function Shape({
  shape,
  size,
  angle = 0,
  fill = 'currentColor',
  stroke,
  strokeWidth,
  opacity,
  blend,
  blur,
  className,
  style,
}: Props) {
  const def = getShape(shape);
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
      style={{
        display: 'block',
        transform: angle ? `rotate(${angle}deg)` : undefined,
        opacity,
        mixBlendMode: blend as React.CSSProperties['mixBlendMode'],
        filter: blur ? `blur(${blur}px)` : undefined,
        ...style,
      }}
    >
      <path
        d={def.path}
        fill={fill}
        fillRule={def.fillRule ?? "evenodd"}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </svg>
  );
}
