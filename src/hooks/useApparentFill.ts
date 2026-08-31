import { useEffect, useState } from 'react';
import { measureApparentFill } from '../game/apparent';
import type { Puzzle } from '../game/types';

/**
 * The colour the day's shape really reads as on the canvas, for the corner badge.
 *
 * The measurement is kept against the puzzle it was taken from, so a change of day
 * shows the declared fill again immediately rather than a stale colour sampled from
 * yesterday's painting. Until the image is decoded -- and for good, if the measurement
 * cannot be made at all -- the declared fill stands in, so the badge is never blank
 * while it waits. The painting is already being fetched by the stage, so asking for it
 * again costs a cache hit rather than a download.
 */
export function useApparentFill(puzzle: Puzzle): string | undefined {
  const [measured, setMeasured] = useState<{ id: string; fill: string } | null>(null);

  useEffect(() => {
    if (typeof Image === 'undefined') return;

    let live = true;
    const img = new Image();
    const measure = () => {
      if (!live) return;
      const fill = measureApparentFill(puzzle, img);
      if (fill) setMeasured({ id: puzzle.id, fill });
    };
    img.onload = measure;
    img.src = puzzle.src;
    if (img.complete) measure();

    return () => {
      live = false;
    };
  }, [puzzle]);

  return measured?.id === puzzle.id ? measured.fill : puzzle.target.fill;
}
