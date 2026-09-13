import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Shape } from './components/Shape';
import { Stage } from './components/Stage';
import {
  clampHide,
  cleanName,
  colourFor,
  HIDE_NAME_MAX,
  HIDE_OPACITY,
  HIDE_SIZE,
  hexToHsv,
  hideLink,
  hideShareText,
  hsvToHex,
  limitName,
  minOpacityFor,
  paintStats,
  hidePuzzle,
  servedPaintings,
  type Hide,
  type Hsv,
  type Painting,
  type PaintStats,
} from './game/hide';
import { countHide, shortHideLink } from './game/count';
import { isTestMode } from './game/testMode';
import { shareResult, SITE_URL } from './game/share';
import { SHAPES } from './game/shapes';
import { compose, constrainPan, fitTransform, invert, type GestureDelta } from './game/transform';
import type { Transform } from './game/types';
import { useGestures } from './hooks/useGestures';

const HELP_SEEN = 'find-me:hide-help-seen';

/** A few paints to start from; the custom sliders beside them take anything. */
const SWATCHES = ['#f4ecd8', '#d9b36c', '#b5543c', '#6b8f5e', '#4f6d8f', '#2e2a26'];

/** A tap is a press that barely moved and did not linger -- anything else is a pan. */
const TAP_SLOP = 8;
const TAP_MS = 400;

/**
 * How much of each pixel of a `box`-wide square the shape covers, 0--1: the shape drawn the
 * way the stage draws it, `size` across, turned `angle` degrees clockwise about (cx, cy).
 */
function shapeCover(
  shape: string,
  size: number,
  angle: number,
  cx: number,
  cy: number,
  box: number,
): Float32Array | undefined {
  const canvas = document.createElement('canvas');
  canvas.width = box;
  canvas.height = box;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return undefined;
  const def = SHAPES[shape];
  ctx.translate(cx, cy);
  ctx.rotate((angle * Math.PI) / 180);
  ctx.scale(size / 100, size / 100);
  ctx.translate(-50, -50);
  ctx.fill(new Path2D(def.path), def.fillRule ?? 'evenodd');
  const alpha = ctx.getImageData(0, 0, box, box).data;
  return Float32Array.from({ length: box * box }, (_, i) => alpha[i * 4 + 3] / 255);
}

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
 * shape goes, set it, and send the link. A layer over the daily board, opened from it once
 * the day's puzzle is over -- it has no address of its own, so it is never a way out of a
 * hunt in progress and never a way round playing the day. `onClose` puts it away.
 *
 * It writes nothing but a flag saying the help has been read, and the only thing it sends
 * is two of the five hide counters -- the maker was opened, and a link was shared. Those
 * say nothing about the hide: not the painting, not the shape, not where. No storage, and
 * nothing that reaches the run tally.
 */
export default function HideMaker({ onClose }: { onClose: () => void }) {
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
  // The custom sliders, open or not. Our own rather than the browser's colour well: Chrome
  // on Android opens its well's Custom view on black whatever the colour is, so the setter
  // lost the auto colour they meant to adjust. Held as HSV so the hue survives a trip
  // through gray.
  const [mixing, setMixing] = useState(false);
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(SWATCHES[0]));
  const [showHelp, setShowHelp] = useState(() => !seen());
  const [status, setStatus] = useState<string | null>(null);
  // At the whole-painting view a hidden shape is a few pixels across, so the setter can
  // put a ring round it to see where it went. Off to begin with: the point of the thing is
  // how the shape sits in the painting, and a ring is the one view that cannot show that.
  const [showRing, setShowRing] = useState(false);
  // An optional name, typed into a field that stays folded away behind a button on the
  // painting row until asked for, so the controls are no taller for the many who skip it.
  // Kept across a change of painting: it is the setter's, not the painting's.
  const [name, setName] = useState('');
  const [naming, setNaming] = useState(false);
  const named = cleanName(name);
  const nameLength = Array.from(name).length;

  // One of the five hide counters: somebody opened the maker. Once per page load, before
  // anything has been set, so it is the top of the funnel and not a measure of finishing.
  useEffect(() => {
    countHide('opened');
  }, []);

  // The paint under the shape, once the painting has been read -- which is what says
  // how strong a given color has to be to be findable there at all.
  const [samplerReady, setSamplerReady] = useState<string | null>(null);
  const [paint, setPaint] = useState<PaintStats | null>(null);
  // Held between renders: the check reads every pixel under the shape, and the board
  // re-renders on every frame of a pinch.
  const fill = useMemo(() => (auto && paint ? colourFor(paint) : chosenFill), [auto, paint, chosenFill]);
  const least = useMemo(() => (paint ? minOpacityFor(fill, paint) : HIDE_OPACITY.min), [fill, paint]);
  // A color this close to the paint cannot be found however solid it is drawn.
  const blends = least === null;
  const strength = Math.max(opacity, least ?? HIDE_OPACITY.max);

  const hide: Hide | null = spot
    ? clampHide(
        { image: painting.image, shape, cx: spot.cx, cy: spot.cy, size, angle, fill, opacity: strength, name },
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
  // resizes whenever the controls under it grow or shrink -- a message under the share
  // button wrapping, or a phone turning -- and snapping back to the whole painting then
  // threw away wherever the setter had panned and zoomed to. The view is only kept on
  // screen.
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

  // The painting at half size, for reading the colour under the shape: fine enough that
  // the smallest shape still covers a block of pixels its own shape can be traced on.
  const sampler = useRef<{ image: string; ctx: CanvasRenderingContext2D; k: number } | null>(null);
  useEffect(() => {
    const img = new Image();
    let live = true;
    img.onload = () => {
      if (!live) return;
      const k = Math.min(1, 1300 / img.naturalWidth);
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
    (cx: number, cy: number, shapeName: string, shapeSize: number, shapeAngle: number): PaintStats | null => {
      const s = sampler.current;
      if (!s || s.image !== painting.image) return null;
      // Wide enough to hold the shape at any angle. Not held to the canvas: a read off the
      // edge comes back transparent, and keeps the shape centered in the block.
      const rad = Math.max(1, Math.ceil((shapeSize / 2) * Math.SQRT2 * s.k));
      const x = Math.round(cx * s.k) - rad;
      const y = Math.round(cy * s.k) - rad;
      try {
        const data = s.ctx.getImageData(x, y, rad * 2, rad * 2).data;
        return paintStats(data, shapeCover(shapeName, shapeSize * s.k, shapeAngle, cx * s.k - x, cy * s.k - y, rad * 2));
      } catch {
        return null;
      }
    },
    [painting.image],
  );

  // Re-read whenever the shape moves, grows, turns or changes, since each changes the
  // paint it covers.
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    setPaint(spot && samplerReady === painting.image ? samplePaint(spot.cx, spot.cy, shape, size, angle) : null);
  }, [spot, shape, size, angle, samplerReady, painting.image, samplePaint]);

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

  // Opening starts from whatever is showing -- the auto colour included -- and fixes it,
  // so it stops following the paint while it is being adjusted.
  const toggleMixer = useCallback(() => {
    if (mixing) {
      setMixing(false);
      return;
    }
    setHsv(hexToHsv(fill));
    chooseFill(fill);
    setMixing(true);
  }, [mixing, fill, chooseFill]);

  const mix = useCallback(
    (next: Hsv) => {
      setHsv(next);
      chooseFill(hsvToHex(next));
    },
    [chooseFill],
  );
  const custom = !auto && !SWATCHES.includes(chosenFill);

  const closeHelp = useCallback(() => {
    markSeen();
    setShowHelp(false);
  }, []);

  // The link last minted for a hide, so pressing share again on the same hide reuses it
  // rather than storing a second row -- and goes straight to the share sheet, which a
  // phone may refuse after the wait for the first code has used up the tap.
  const minted = useRef<{ key: string; link: string } | null>(null);
  const [sharing, setSharing] = useState(false);

  const share = useCallback(async () => {
    if (!hide || sharing) return;
    const key = hideLink(hide, SITE_URL);
    let link = minted.current?.key === key ? minted.current.link : null;
    if (link === null) {
      setSharing(true);
      const got = await shortHideLink(hide, SITE_URL);
      setSharing(false);
      link = got.link;
      minted.current = { key, link };
      // Counted on the press, like a share of a daily result: what is being asked is
      // whether people reach for it, and a share sheet that is dismissed never comes back
      // to say so. `long` says the short code could not be had.
      countHide('made', got.short ? {} : { long: true });
    }
    const result = await shareResult(hideShareText(hide, painting, link));
    setStatus(result === 'copied' ? 'Link copied' : result === 'failed' ? link : 'Shared');
  }, [hide, painting, sharing]);

  return (
    <div className="app hide-maker">
      <header className="topbar">
        <h1 className="title">
          Find Me <span className="title-day">hide one</span>
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

      {isTestMode() ? (
        <p className="test-banner">
          <span className="test-banner-what">
            test mode <span>— making a hide</span>
          </span>
          <button type="button" className="test-banner-exit" onClick={onClose}>
            back to the game
          </button>
        </p>
      ) : (
        <p className="practice-note">
          <span className="test-banner-what">hide one for a friend</span>
          <button type="button" className="test-banner-exit" onClick={onClose}>
            back to the game
          </button>
        </p>
      )}

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
                  see how well it hides. There <em>are</em> guards in place to keep you from
                  sharing an impossible puzzle.
                </li>
                <li>
                  Give it a name with <strong>✎ Name</strong> if you like. Without one it goes by
                  the painting&rsquo;s title.
                </li>
                <li>Press share and send the link. They hunt for it just like the daily puzzle.</li>
              </ul>
              <p className="howto-note">
                To keep the link short, the hide is saved on the Find Me server — its painting,
                shape, position, color and name, and nothing about who made it. With counting
                switched off it is saved nowhere, and the link is a longer one that carries the
                whole puzzle.
              </p>
              <button type="button" className="btn btn-primary" onClick={closeHelp}>
                Got it
              </button>
            </div>
          </>
        )}
      </main>

      <section className="hide-controls" aria-label="Your hide" hidden={showHelp}>
        <div className="hide-row">
          <span>Painting</span>
          <div className="hide-painting">
            <select aria-label="Painting" value={painting.image} onChange={(e) => choosePainting(e.target.value)}>
              {paintings.map((p) => (
                <option key={p.image} value={p.image}>
                  {p.title} — {p.artist}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={`hide-name-btn${named || naming ? ' is-on' : ''}`}
              onClick={() => setNaming((prev) => !prev)}
              aria-expanded={naming}
              title={named ? `Named “${named}”` : 'Name your puzzle'}
            >
              <span aria-hidden="true">✎</span> <span className="hide-name-label">{named || 'Name'}</span>
            </button>
          </div>
        </div>

        {naming && (
          <label className="hide-row">
            <span>Name</span>
            <span className="hide-name">
              <input
                type="text"
                value={name}
                placeholder={painting.title}
                onChange={(e) => {
                  setName(limitName(e.target.value));
                  setStatus(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setNaming(false);
                }}
                enterKeyHint="done"
                autoComplete="off"
                spellCheck
              />
              {nameLength >= HIDE_NAME_MAX - 10 && (
                <span className="hide-name-count" aria-live="polite">
                  {nameLength}/{HIDE_NAME_MAX}
                </span>
              )}
            </span>
          </label>
        )}

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
              onClick={() => {
                setAuto(true);
                setMixing(false);
              }}
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
                onClick={() => {
                  chooseFill(c);
                  setMixing(false);
                }}
                aria-label={`Color ${c}`}
              />
            ))}
            <button
              type="button"
              className={`hide-custom${custom || mixing ? ' is-on' : ''}`}
              style={custom ? { background: chosenFill } : undefined}
              onClick={toggleMixer}
              aria-expanded={mixing}
              aria-label="Custom color"
              title="Custom color"
            />
          </div>
        </div>

        {mixing && (
          <div className="hide-mix">
            <label className="hide-row">
              <span>Hue</span>
              <input
                type="range"
                min={0}
                max={359}
                value={hsv.h}
                onChange={(e) => mix({ ...hsv, h: Number(e.target.value) })}
                style={{
                  background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
                }}
              />
            </label>
            <label className="hide-row">
              <span>Vivid</span>
              <input
                type="range"
                min={0}
                max={100}
                value={hsv.s}
                onChange={(e) => mix({ ...hsv, s: Number(e.target.value) })}
                style={{
                  background: `linear-gradient(to right, ${hsvToHex({ ...hsv, s: 0 })}, ${hsvToHex({ ...hsv, s: 100 })})`,
                }}
              />
            </label>
            <label className="hide-row">
              <span>Light</span>
              <input
                type="range"
                min={0}
                max={100}
                value={hsv.v}
                onChange={(e) => mix({ ...hsv, v: Number(e.target.value) })}
                style={{ background: `linear-gradient(to right, #000, ${hsvToHex({ ...hsv, v: 100 })})` }}
              />
            </label>
          </div>
        )}

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

        {/* The warning sits beside the button rather than above it, so the controls keep
            their height whether it shows or not and the board above them never resizes. */}
        <div className="hide-share">
          <button type="button" className="btn btn-primary" onClick={share} disabled={!hide || blends || sharing}>
            {sharing ? 'Saving…' : 'Share'}
          </button>
          {blends ? (
            <span className="hide-warning" role="status">
              This color blends into the paint here. Pick one that stands out more, or move it.
            </span>
          ) : (
            status && <span className="hide-status">{status}</span>
          )}
        </div>
      </section>
    </div>
  );
}
