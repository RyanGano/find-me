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

/*
 * Sensitivities are set against the win tolerances, not against feel alone. A notched
 * mouse wheel reports about 100 deltaY per click, so at the old 0.0015 one click moved
 * the zoom 16% and one shift-click swung the angle 20 degrees -- neither could ever be
 * landed inside a 2% / 3.6-degree window. These give roughly 4% and 3.4 degrees per
 * click, with the keyboard finer still for the last nudge.
 */
const WHEEL_ZOOM = 0.0004;
const TRACKPAD_PINCH_ZOOM = 0.006;
const WHEEL_ROTATE = 0.0006;
const DRAG_ROTATE = 0.004;
const DRAG_ZOOM = 0.004;
const KEY_ZOOM = 1.02;
const KEY_ROTATE = 0.012;

/**
 * Pointer, wheel and Safari gesture handling for the puzzle stage.
 *
 * Touch: one finger pans, two fingers pinch, twist and pan at once.
 * Mouse/trackpad: drag pans, wheel zooms at the cursor, shift+wheel or shift+drag
 * rotates, alt+drag zooms. Everything funnels into a single similarity transform.
 *
 * Most of the care here is about never being left holding a finger that is no longer
 * on the glass. A stale entry in `pointers` turns the next one-finger drag into a
 * two-finger pinch against a ghost, which reads to the player as "zoom is broken" or
 * "zoom is way too strong". iOS drops pointers in several ordinary situations -- a
 * call arrives, the app is backgrounded, Safari claims the gesture -- so the cleanup
 * below is deliberately belt-and-braces.
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

    const forget = (pointerId: number) => {
      pointers.delete(pointerId);
      try {
        if (el.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId);
      } catch {
        // Already released, or the pointer is gone. Nothing to do.
      }
    };

    const forgetAll = () => {
      for (const id of [...pointers.keys()]) forget(id);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!cb.current.enabled) return;

      // `isPrimary` means this is the first contact of a new gesture, so anything we
      // still think is down is a leftover from a gesture that never ended cleanly.
      if (e.isPrimary) forgetAll();

      // Register before capturing: setPointerCapture can throw (iOS raises
      // NotFoundError if the pointer is already gone), and a throw here used to skip
      // the registration entirely and leave the finger permanently invisible.
      pointers.set(e.pointerId, local(e));
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // Without capture we still track the pointer; the window-level listeners
        // below catch the release even if it happens off the element.
      }
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

    const onPointerRelease = (e: PointerEvent) => forget(e.pointerId);

    // If the page loses the user's attention mid-gesture we will never see the
    // matching pointerup, so drop everything rather than keep a ghost finger.
    const onHidden = () => {
      if (document.visibilityState === 'hidden') forgetAll();
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

    // Safari's own trackpad pinch/rotate events. On iOS these fire *alongside* the
    // touch pointer events for the same two fingers, so acting on both would apply
    // every pinch twice and zoom roughly the square of what the fingers asked for.
    // Only trust them when no pointers are down, which is the desktop trackpad case.
    let gestureScale = 1;
    let gestureRotation = 0;
    const gestureUsable = () => cb.current.enabled && pointers.size === 0;

    const onGestureStart = (e: Event) => {
      if (!gestureUsable()) return;
      e.preventDefault();
      gestureScale = 1;
      gestureRotation = 0;
    };
    const onGestureChange = (e: Event) => {
      if (!gestureUsable()) return;
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
        case '+': case '=': emit({ scaleBy: KEY_ZOOM, pivot }); break;
        case '-': case '_': emit({ scaleBy: 1 / KEY_ZOOM, pivot }); break;
        case 'q': case 'Q': emit({ rotBy: -KEY_ROTATE, pivot }); break;
        case 'e': case 'E': emit({ rotBy: KEY_ROTATE, pivot }); break;
        default: return;
      }
      e.preventDefault();
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('gesturestart', onGestureStart as EventListener);
    el.addEventListener('gesturechange', onGestureChange as EventListener);
    el.addEventListener('gestureend', onGestureStart as EventListener);
    el.addEventListener('keydown', onKeyDown);

    // Releases go on the window: with pointer capture they would reach the element
    // anyway, but when capture failed they can land anywhere at all.
    window.addEventListener('pointerup', onPointerRelease);
    window.addEventListener('pointercancel', onPointerRelease);
    window.addEventListener('blur', forgetAll);
    document.addEventListener('visibilitychange', onHidden);

    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('gesturestart', onGestureStart as EventListener);
      el.removeEventListener('gesturechange', onGestureChange as EventListener);
      el.removeEventListener('gestureend', onGestureStart as EventListener);
      el.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerup', onPointerRelease);
      window.removeEventListener('pointercancel', onPointerRelease);
      window.removeEventListener('blur', forgetAll);
      document.removeEventListener('visibilitychange', onHidden);
      forgetAll();
    };
  }, [ref]);
}
