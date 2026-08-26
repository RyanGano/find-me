import { ANGLE_TOLERANCE_DEG, SIZE_TOLERANCE, type MatchState } from '../game/match';

const SIZE_RANGE = 1.0; // The bar spans half to double the target size.
const ANGLE_RANGE = 90;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Live size and rotation gauges. Both depend only on the zoom and twist of the
 * viewport, never on where the shape is, so they help the player lock in the match
 * without giving away the hiding place.
 */
export function Meters({ match }: { match: MatchState }) {
  const sizePos = 50 + (clamp(match.sizeError, -SIZE_RANGE, SIZE_RANGE) / SIZE_RANGE) * 50;
  const sizeBand = (SIZE_TOLERANCE / SIZE_RANGE) * 50;
  const anglePos = 50 + (clamp(match.angleError, -ANGLE_RANGE, ANGLE_RANGE) / ANGLE_RANGE) * 50;
  const angleBand = (ANGLE_TOLERANCE_DEG / ANGLE_RANGE) * 50;

  return (
    <div className="meters">
      <Gauge
        label="size"
        ok={match.sizeOk}
        pos={sizePos}
        band={sizeBand}
        hint={match.sizeOk ? 'matched' : match.sizeError < 0 ? 'zoom in' : 'zoom out'}
      />
      <Gauge
        label="angle"
        ok={match.angleOk}
        pos={anglePos}
        band={angleBand}
        hint={match.angleOk ? 'matched' : match.angleError < 0 ? 'rotate right' : 'rotate left'}
      />
    </div>
  );
}

interface GaugeProps {
  label: string;
  ok: boolean;
  pos: number;
  band: number;
  hint: string;
}

function Gauge({ label, ok, pos, band, hint }: GaugeProps) {
  return (
    <div className={`gauge${ok ? ' is-ok' : ''}`}>
      <div className="gauge-head">
        <span className="gauge-label">{label}</span>
        <span className="gauge-hint">{hint}</span>
      </div>
      <div className="gauge-track">
        <div
          className="gauge-band"
          style={{ left: `${50 - band}%`, width: `${band * 2}%` }}
        />
        <div className="gauge-needle" style={{ left: `${pos}%` }} />
      </div>
    </div>
  );
}
