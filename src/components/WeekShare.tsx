import { useEffect, useState } from 'react';
import type { Frame } from '../game/gallery';
import { renderWeekCard, shareWeekCard } from '../game/weekCard';

interface Props {
  frame: Frame;
  label: string;
  className?: string;
  /** The card went out, for the tally. */
  onShared?: () => void;
}

/**
 * The button that shares a week as a picture. The card is drawn as soon as the button is
 * on screen, because a share sheet only opens inside the tap that asked for it -- see
 * `shareWeekCard`.
 */
export function WeekShare({ frame, label, className = 'btn', onShared }: Props) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [status, setStatus] = useState<'idle' | 'shared' | 'saved' | 'failed'>('idle');
  const { src, title, artist, year, week } = frame;

  useEffect(() => {
    let live = true;
    // Picked by name: the card is handed the painting and the marks, and nothing else.
    void renderWeekCard(src, { title, artist, year, marks: week.marks, full: week.full }).then((b) => {
      if (live) setBlob(b);
    });
    return () => {
      live = false;
    };
  }, [src, title, artist, year, week]);

  const share = async () => {
    if (!blob) return;
    const result = await shareWeekCard(blob, title);
    setStatus(result);
    if (result !== 'failed') onShared?.();
  };

  return (
    <button type="button" className={className} onClick={share} disabled={!blob}>
      {status === 'saved' ? 'Saved!' : status === 'failed' ? 'Couldn’t share' : label}
    </button>
  );
}
