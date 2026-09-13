import { useEffect, useState } from 'react';

export interface Size {
  w: number;
  h: number;
}

/**
 * The content box of the element behind `ref`, or null until it has been measured. A box
 * with no area -- hidden, or not laid out yet -- is not reported, so the last real size
 * stands.
 */
export function useElementSize(ref: React.RefObject<HTMLElement | null>): Size | null {
  const [size, setSize] = useState<Size | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ w: width, h: height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}
