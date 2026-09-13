import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

/**
 * A line of a bar that has to stay one line, whatever it holds -- a friend's fifty-character
 * name on a 360px phone, say.
 *
 * When it fits it is plain text. When it does not, it drifts to its far end and back, so the
 * whole of it can be read where it is, and a tap lays it out over as many lines as it needs
 * until it is tapped again. With reduced motion it keeps still and ends in an ellipsis, and
 * the tap is the way to the rest.
 */
export function Marquee({ children, className }: { children: ReactNode; className?: string }) {
  const outer = useRef<HTMLSpanElement>(null);
  const inner = useRef<HTMLSpanElement>(null);
  const [shift, setShift] = useState(0);
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    // Laid out over several lines it overflows nothing, so hold on to what it measured on
    // one line: that is what the tap back is returning to.
    if (open) return;
    const box = outer.current;
    const text = inner.current;
    if (!box || !text) return;
    // `scrollWidth` is the text's full length and, unlike a bounding rect, ignores the
    // transform that is scrolling it, so measuring mid-drift gives the same answer.
    const measure = () => setShift(Math.max(0, Math.ceil(text.scrollWidth - box.clientWidth)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    observer.observe(text);
    return () => observer.disconnect();
  }, [open]);

  const over = shift > 1;
  // About 18px a second while moving, with a still spell at each end long enough to read
  // the start before it moves off.
  const style = over
    ? ({ '--marquee-shift': `-${shift}px`, '--marquee-time': `${Math.max(6, shift / 18).toFixed(1)}s` } as CSSProperties)
    : undefined;

  return (
    <span
      ref={outer}
      className={['marquee', over && 'is-over', open && 'is-open', className].filter(Boolean).join(' ')}
      style={style}
      onClick={over ? () => setOpen((prev) => !prev) : undefined}
    >
      <span ref={inner} className="marquee-inner">
        {children}
      </span>
    </span>
  );
}
