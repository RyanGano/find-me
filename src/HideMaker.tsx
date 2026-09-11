import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Shape } from './components/Shape';
import { Stage } from './components/Stage';
import {
  clampHide,
  colourFor,
  HIDE_OPACITY,
  HIDE_SIZE,
  hideLink,
  minOpacityFor,
  paintStats,
  hidePuzzle,
  servedPaintings,
  type Hide,
  type Painting,
  type PaintStats,
} from './game/hide';
import { shareResult, SITE_URL } from './game/share';
import { SHAPES } from './game/shapes';
import { compose, constrainPan, fitTransform, invert, type GestureDelta } from './game/transform';
import type { Transform } from './game/types';
import { useGestures } from './hooks/useGestures';

const HELP_SEEN = 'find-me:hide-help-seen';

/** A few paints to start from; the colour well beside them takes anything. */
const SWATCHES = ['#f4ecd8', '#d9b36c', '#b5543c', '#6b8f5e', '#4f6d8f', '#2e2a26'];

/** A tap is a press that barely moved and did not linger -- anything else is a pan. */
const TAP_SLOP = 8;
const TAP_MS = 400;

function seen(): boolean {
  try {
    return localStorage.getItem(HELP_SEEN) !== null;
  } catch {
    return false;
  }
}

function markSeen(): void {
  try {
    localStorage.setItem(HELP_SEEN, '1');
  } catch {
    // Nothing kept on this browser; the help simply comes back next time.
  }
}

/**
 * Hide one for a friend: pick a painting the calendar has already served, tap where the
 * shape goes, set it, and send the link.
 *
 * Behind test mode for now (`?test&hide`), so the only people making hides are the ones
 * who asked to. The links it makes point at the real site and play for anyone.
 *
 * It writes nothing but a flag saying the help has been read, and sends nothing at all:
 * no storage, no tally.
 */
export default function HideMaker() {
  const paintings = useMemo(() => servedPaintings(), []);
  const [painting, setPainting] = useState<Painting>(() => paintings[paintings.length - 1]);
  const [shape, setShape] = useState('star');
  const [spot, setSpot] = useState<{ cx: number; cy: number } | null>(null);
  const [size, setSize] = useState(56);
  const [angle, setAngle] = useState(0);
  const [opacity, setOpacity] = useState(0.8);
  const [chosenFill, setChosenFill] = useState(SWATCHES[0]);
  // Auto until the setter picks a colour, and again whenever they ask for it back: the
  // colour then follows the paint under the shape as it moves and grows.
  const [auto, setAuto] = useState(true);
  const [showHelp, setShowHelp] = useState(() => !seen());
  const [status, setStatus] = useState<string | null>(null);
  // At the whole-painting view a hidden shape is a few pixels across, so the setter is
  // shown a ring round it -- and can put the ring away to judge how well it hides.
  const [showRing, setShowRing] = useState(true);

  // The paint under the shape, once the painting has been read -- which is what says
  // how strong a given color has to be to be findable there at all.
  const [samplerReady, setSamplerReady] = useState<string | null>(null);
  const [paint, setPaint] = useState<PaintStats | null>(null);
  const fill = auto && paint ? colourFor(paint) : chosenFill;
  const least = paint ? minOpacityFor(fill, paint) : HIDE_OPACITY.min;
  // A color this close to the paint cannot be found however solid it is drawn.
  const blends = least === null;
  const strength = Math.max(opacity, least ?? HIDE_OPACITY.max);

  const hide: Hide | null = spot
    ? clampHide(
        { image: painting.image, shape, cx: spot.cx, cy: spot.cy, size, angle, fill, opacity: strength },
        painting,
      )
    : null;

  // Before the first tap the stage still needs a target to draw, so it gets an invisible one.
  const puzzle = hidePuzzle(
    hide ?? { image: painting.image, shape, cx: 0, cy: 0, size, angle, fill, opacity: 0 },
    painting,
  );

  // ---- the view: the game's own gestures, with a tap to place ----

  const stageRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const [transform, setTransform] = useState<Transform | null>(null);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setBox({ w: width, h: height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const fit = useMemo(
    () => (box ? fitTransform(painting.width, painting.height, box.w, box.h) : null),
    [box, painting.width, painting.height],
  );

  // A new painting starts from the whole canvas. A new board size does not: the board
  // resizes whenever the controls under it grow or shrink -- the blends-in warning
  // coming and going, for one -- and snapping back to the whole painting then threw
  // away wherever the setter had panned and zoomed to. The view is only kept on screen.
  const fitted = useRef<string | null>(null);
  useEffect(() => {
    if (!fit || !box) return;
    const fresh = fitted.current !== painting.image;
    fitted.current = painting.image;
    // oxlint-disable-next-line react/set-state-in-effect
    setTransform((prev) =>
      fresh || !prev ? fit : constrainPan(prev, painting.width, painting.height, box.w, box.h),
    );
  }, [fit, box, painting.image, painting.width, painting.height]);

  const onGesture = useCallback(
    (delta: GestureDelta) => {
      if (!fit || !box) return;
      setTransform((prev) => {
        if (!prev) return prev;
        const next = compose(prev, delta, { min: fit.scale * 0.6, max: fit.scale * 14 });
        return constrainPan(next, painting.width, painting.height, box.w, box.h);
      });
    },
    [fit, box, painting.width, painting.height],
  );

  useGestures(stageRef, { onGesture, onInteract: () => {}, enabled: Boolean(transform) && !showHelp });

  // The painting, small, for reading the colour under a tap.
  const sampler = useRef<{ image: string; ctx: CanvasRenderingContext2D; k: number } | null>(null);
  useEffect(() => {
    const img = new Image();
    let live = true;
    img.onload = () => {
      if (!live) return;
      const k = Math.min(1, 800 / img.naturalWidth);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.naturalWidth * k);
      canvas.height = Math.round(img.naturalHeight * k);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      sampler.current = { image: painting.image, ctx, k: canvas.width / painting.width };
      setSamplerReady(painting.image);
    };
    img.src = painting.src;
    return () => {
      live = false;
    };
  }, [painting]);

  const samplePaint = useCallback(
    (cx: number, cy: number, r: number): PaintStats | null => {
      const s = sampler.current;
      if (!s || s.image !== painting.image) return null;
      const rad = Math.max(1, Math.round(r * s.k));
      const x = Math.max(0, Math.round(cx * s.k) - rad);
      const y = Math.max(0, Math.round(cy * s.k) - rad);
      try {
        return paintStats(s.ctx.getImageData(x, y, rad * 2, rad * 2).data);
      } catch {
        return null;
      }
    },
    [painting.image],
  );

  // Re-read whenever the shape moves or grows, since either changes the paint it covers.
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    setPaint(spot && samplerReady === painting.image ? samplePaint(spot.cx, spot.cy, size / 2) : null);
  }, [spot, size, samplerReady, painting.image, samplePaint]);

  // Which painting the stage has actually drawn. Changing `src` leaves the old picture on
  // screen, stretched to the new one's size, until the new one arrives -- so until the two
  // agree the canvas is hidden and a placeholder stands in its place.
  const [shown, setShown] = useState<string | null>(null);
  const loading = shown !== painting.image;
  const onReady = useCallback(() => setShown(painting.image), [painting.image]);

  const latest = useRef({ transform, showHelp, loading });
  useEffect(() => {
    latest.current = { transform, showHelp, loading };
  });

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    let press: { id: number; x: number; y: number; at: number } | null = null;
    let fingers = 0;
    const down = (e: PointerEvent) => {
      fingers += 1;
      press = fingers === 1 ? { id: e.pointerId, x: e.clientX, y: e.clientY, at: performance.now() } : null;
    };
    const up = (e: PointerEvent) => {
      fingers = Math.max(0, fingers - 1);
      const p = press;
      press = null;
      const { transform: t, showHelp: helping, loading: waiting } = latest.current;
      if (!p || p.id !== e.pointerId || !t || helping || waiting) return;
      if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > TAP_SLOP) return;
      if (performance.now() - p.at > TAP_MS) return;
      const r = el.getBoundingClientRect();
      const at = invert(t, { x: e.clientX - r.left, y: e.clientY - r.top });
      if (at.x < 0 || at.y < 0 || at.x > painting.width || at.y > painting.height) return;
      setSpot({ cx: at.x, cy: at.y });
      setStatus(null);
    };
    const cancel = () => {
      fingers = 0;
      press = null;
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', cancel);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', cancel);
    };
  }, [painting.width, painting.height]);

  // A mouse wheel scrolls up and down; over the shape row it should run along it.
  const shapeRow = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = shapeRow.current;
    if (!row) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || row.scrollWidth <= row.clientWidth) return;
      e.preventDefault();
      row.scrollLeft += e.deltaY;
    };
    row.addEventListener('wheel', onWheel, { passive: false });
    return () => row.removeEventListener('wheel', onWheel);
  }, []);

  const choosePainting = useCallback(
    (image: string) => {
      const next = paintings.find((p) => p.image === image);
      if (!next) return;
      setPainting(next);
      setSpot(null);
      setStatus(null);
    },
    [paintings],
  );

  const chooseFill = useCallback((colour: string) => {
    setChosenFill(colour);
    setAuto(false);
  }, []);

  const closeHelp = useCallback(() => {
    markSeen();
    setShowHelp(false);
  }, []);

  const share = useCallback(async () => {
    if (!hide) return;
    const link = hideLink(hide, SITE_URL);
    const text = `I hid a ${SHAPES[hide.shape].emoji} in ${painting.title}. Can you find it?\n${link}`;
    const result = await shareResult(text);
    setStatus(result === 'copied' ? 'Link copied' : result === 'failed' ? link : 'Shared');
  }, [hide, painting.title]);

  return (
    <div className="app hide-maker">
      <header className="topbar">
        <h1 className="title">
          <span className="title-btn">Find Me</span> <span className="title-day">hide one</span>
        </h1>
        <div className="topbar-actions">
          {spot && (
            <button
              type="button"
              className={`btn btn-icon btn-ring${showRing ? ' is-on' : ''}`}
              onClick={() => setShowRing((prev) => !prev)}
              title={showRing ? 'Hide the ring' : 'Show the ring'}
              aria-pressed={showRing}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M6 12.6l4 4 8-9" />
              </svg>
            </button>
          )}
          <button
            type="button"
            className="btn btn-icon"
            onClick={() => fit && setTransform(fit)}
            title="Reset view"
          >
            ⟲
          </button>
          <button type="button" className="btn btn-icon" onClick={() => setShowHelp(true)} title="How this works">
            ?
          </button>
        </div>
      </header>

      <p className="test-banner">
        <span className="test-banner-what">
          test mode <span>— making a hide</span>
        </span>
        <a className="test-banner-exit" href="./?test">
          back to the game
        </a>
      </p>

      <main className={`board${loading ? ' is-loading' : ''}`}>
        <Stage
          stageRef={stageRef}
          puzzle={puzzle}
          transform={transform ?? { x: 0, y: 0, scale: 1, rot: 0 }}
          fitScale={fit?.scale ?? 1}
          showRing={Boolean(spot) && showRing}
          blurred={false}
          paused={false}
          resumed={false}
          onReady={onReady}
        />
        {loading && fit && (
          <div
            className="hide-skeleton"
            aria-label="Loading the painting"
            role="status"
            style={{
              left: fit.x,
              top: fit.y,
              width: painting.width * fit.scale,
              height: painting.height * fit.scale,
            }}
          />
        )}
        {loading && <p className="loading">Loading the painting…</p>}
        {!spot && !showHelp && !loading && <p className="hide-hint">Tap the painting where you want to hide it</p>}

        {showHelp && (
          <>
            <div className="scrim" onClick={closeHelp} />
            <div className="howto" role="dialog" aria-label="Hide one for a friend">
              <h2>Hide one for a friend</h2>
              <p>Set a puzzle of your own and send it to someone as a link.</p>
              <ul>
                <li>Pick a painting — any one Find Me has already had on the calendar.</li>
                <li>Pick a shape, then tap the painting where you want it. Tap again to move it.</li>
                <li>
                  Set its color, size, angle and strength. <strong>Auto</strong> picks a color
                  from the paint underneath. Pinch or scroll to zoom in, and turn the ring off to
                  see how well it hides. A color that blends into the paint can&rsquo;t be shared.
                </li>
                <li>Press share and send the link. They hunt for it just like the daily puzzle.</li>
              </ul>
              <p className="howto-note">
                Nothing about a hide is saved or sent anywhere — the whole puzzle lives in the link.
              </p>
              <button type="button" className="btn btn-primary" onClick={closeHelp}>
                Got it
              </button>
            </div>
          </>
        )}
      </main>

      <section className="hide-controls" aria-label="Your hide" hidden={showHelp}>
        <label className="hide-row">
          <span>Painting</span>
          <select value={painting.image} onChange={(e) => choosePainting(e.target.value)}>
            {paintings.map((p) => (
              <option key={p.image} value={p.image}>
                {p.title} — {p.artist}
              </option>
            ))}
          </select>
        </label>

        <div className="hide-row">
          <span>Shape</span>
          <div className="hide-shapes" role="radiogroup" aria-label="Shape" ref={shapeRow}>
            {Object.entries(SHAPES).map(([key, def]) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={shape === key}
                className={`hide-shape${shape === key ? ' is-on' : ''}`}
                onClick={(e) => {
                  setShape(key);
                  // Keep the chosen one fully in the row, not half under the faded edge.
                  e.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
                }}
                title={def.label}
              >
                <Shape shape={key} size={22} />
              </button>
            ))}
          </div>
        </div>

        <div className="hide-row">
          <span>Color</span>
          <div className="hide-swatches">
            <button
              type="button"
              className={`hide-auto${auto ? ' is-on' : ''}`}
              onClick={() => setAuto(true)}
              aria-pressed={auto}
              title="Pick a color from the paint under the shape"
            >
              Auto
            </button>
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                className={`hide-swatch${!auto && chosenFill === c ? ' is-on' : ''}`}
                style={{ background: c }}
                onClick={() => chooseFill(c)}
                aria-label={`Color ${c}`}
              />
            ))}
            <input
              type="color"
              value={fill}
              onChange={(e) => chooseFill(e.target.value)}
              aria-label="Any color"
            />
          </div>
        </div>

        <label className="hide-row">
          <span>Size</span>
          <input
            type="range"
            min={HIDE_SIZE.min}
            max={HIDE_SIZE.max}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
          />
        </label>

        <label className="hide-row">
          <span>Angle</span>
          <input
            type="range"
            min={-180}
            max={180}
            value={angle}
            onChange={(e) => setAngle(Number(e.target.value))}
          />
        </label>

        <label className="hide-row">
          <span>Strength</span>
          <input
            type="range"
            min={Math.round((least ?? HIDE_OPACITY.max) * 100)}
            max={HIDE_OPACITY.max * 100}
            value={Math.round(strength * 100)}
            disabled={blends}
            onChange={(e) => setOpacity(Number(e.target.value) / 100)}
          />
        </label>

        {blends && (
          <p className="hide-warning" role="status">
            This color blends into the paint here. Pick one that stands out more, or move it.
          </p>
        )}

        <div className="hide-share">
          <button type="button" className="btn btn-primary" onClick={share} disabled={!hide || blends}>
            Share the link
          </button>
          {status && <span className="hide-status">{status}</span>}
        </div>
      </section>
    </div>
  );
}
