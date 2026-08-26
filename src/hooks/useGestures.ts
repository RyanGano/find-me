import { useEffect, useRef } from 'react';
import { gestureFromPointerPair } from '../game/transform';
import type { Vec } from '../game/types';
import type { GestureDelta } from '../game/transform';

interface Options {
  onGesture: (delta: GestureDelta) => void;
  /** Called once per gesture that actually moves the image. Starts the clock. */
  onInteract: () => void;
  enabled: boolean;
}

const WHEEL_ZOOM = 0.0015;
const TRACKPAD_PINCH_ZOOM = 0.01;
const WHEEL_ROTATE = 0.0035;
const DRAG_ROTATE = 0.006;
const DRAG_ZOOM = 0.006;

/**
 * Pointer, wheel and Safari gesture handling for the puzzle stage.
 *
 * Touch: one finger pans, two fingers pinch, twist and pan at once.
 * Mouse/trackpad: drag pans, wheel zooms at the cursor, shift+wheel or shift+drag
 * rotates, alt+drag zooms. Everything funnels into a single similarity transform.
 */
export function useGestures(
  ref: React.RefObject<HTMLElement | null>,
  { onGesture, onInteract, enabled }: Options,
): void {
  // Kept in a ref so the listeners can stay attached across renders while still
  // seeing the latest callbacks and enabled flag.
  const cb = useRef({ onGesture, onInteract, enabled });
  useEffect(() => {
    cb.current = { onGesture, onInteract, enabled };
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const pointers = new Map<number, Vec>();

    const emit = (delta: GestureDelta) => {
      if (!cb.current.enabled) return;
      cb.current.onInteract();
      cb.current.onGesture(delta);
    };

    const local = (e: { clientX: number; clientY: number }): Vec => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const centre = (): Vec => {
      const r = el.getBoundingClientRect();
      return { x: r.width / 2, y: r.height / 2 };
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!cb.current.enabled) return;
      el.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, local(e));
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      e.preventDefault();

      const ids = [...pointers.keys()];
      const next = local(e);

      if (ids.length === 1) {
        const prev = pointers.get(e.pointerId)!;
        const d = { x: next.x - prev.x, y: next.y - prev.y };
        pointers.set(e.pointerId, next);
        if (d.x === 0 && d.y === 0) return;

        if (e.shiftKey) {
          emit({ rotBy: d.x * DRAG_ROTATE, pivot: centre() });
        } else if (e.altKey || e.ctrlKey || e.metaKey) {
          emit({ scaleBy: Math.exp(-d.y * DRAG_ZOOM), pivot: centre() });
        } else {
          emit({ pan: d });
        }
        return;
      }

      // Two or more pointers: use the first two as the pinch/twist pair.
      const [a, b] = ids;
      const from: [Vec, Vec] = [pointers.get(a)!, pointers.get(b)!];
      pointers.set(e.pointerId, next);
      const to: [Vec, Vec] = [pointers.get(a)!, pointers.get(b)!];
      emit(gestureFromPointerPair(from, to));
    };

    const release = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    };

    const onWheel = (e: WheelEvent) => {
      if (!cb.current.enabled) return;
      e.preventDefault();
      const pivot = local(e);
      if (e.shiftKey) {
        emit({ rotBy: (e.deltaX || e.deltaY) * WHEEL_ROTATE, pivot });
      } else {
        // Trackpad pinches arrive as ctrl+wheel with much smaller deltas.
        const k = e.ctrlKey ? TRACKPAD_PINCH_ZOOM : WHEEL_ZOOM;
        emit({ scaleBy: Math.exp(-e.deltaY * k), pivot });
      }
    };

    // Safari desktop reports trackpad pinch/rotate through its own gesture events.
    let gestureScale = 1;
    let gestureRotation = 0;
    const onGestureStart = (e: Event) => {
      if (!cb.current.enabled) return;
      e.preventDefault();
      gestureScale = 1;
      gestureRotation = 0;
    };
    const onGestureChange = (e: Event) => {
      if (!cb.current.enabled) return;
      e.preventDefault();
      const g = e as Event & { scale: number; rotation: number; clientX: number; clientY: number };
      const pivot = local(g);
      emit({
        scaleBy: gestureScale > 0 ? g.scale / gestureScale : 1,
        rotBy: ((g.rotation - gestureRotation) * Math.PI) / 180,
        pivot,
      });
      gestureScale = g.scale;
      gestureRotation = g.rotation;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (!cb.current.enabled) return;
      const step = e.shiftKey ? 60 : 20;
      const pivot = centre();
      switch (e.key) {
        case 'ArrowLeft': emit({ pan: { x: step, y: 0 } }); break;
        case 'ArrowRight': emit({ pan: { x: -step, y: 0 } }); break;
        case 'ArrowUp': emit({ pan: { x: 0, y: step } }); break;
        case 'ArrowDown': emit({ pan: { x: 0, y: -step } }); break;
        case '+': case '=': emit({ scaleBy: 1.12, pivot }); break;
        case '-': case '_': emit({ scaleBy: 1 / 1.12, pivot }); break;
        case 'q': case 'Q': emit({ rotBy: -0.04, pivot }); break;
        case 'e': case 'E': emit({ rotBy: 0.04, pivot }); break;
        default: return;
      }
      e.preventDefault();
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('lostpointercapture', release);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('gesturestart', onGestureStart as EventListener);
    el.addEventListener('gesturechange', onGestureChange as EventListener);
    el.addEventListener('gestureend', onGestureStart as EventListener);
    el.addEventListener('keydown', onKeyDown);

    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', release);
      el.removeEventListener('pointercancel', release);
      el.removeEventListener('lostpointercapture', release);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('gesturestart', onGestureStart as EventListener);
      el.removeEventListener('gesturechange', onGestureChange as EventListener);
      el.removeEventListener('gestureend', onGestureStart as EventListener);
      el.removeEventListener('keydown', onKeyDown);
    };
  }, [ref]);
}
