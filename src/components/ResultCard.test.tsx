import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { frameFor, weekOf, type Frame } from '../game/gallery';
import { PUZZLES } from '../game/puzzles';
import type { Stats } from '../game/storage';
import { ResultCard } from './ResultCard';

const puzzle = PUZZLES[0];
const stats = { played: 1, streak: 1, best: 5000 } as Stats;

function card(props: { gaveUp?: boolean; isPractice?: boolean; week?: Frame | null }) {
  return renderToStaticMarkup(
    <ResultCard
      day={1}
      puzzle={puzzle}
      ms={5000}
      stats={stats}
      isPractice={false}
      metrics={null}
      tally={null}
      onShared={() => {}}
      onReplay={() => {}}
      {...props}
    />,
  );
}

// The card is mounted only once a hunt has ended (`done !== null` in App.tsx), so what is
// tested here is the other half: that it carries the note after a find and a give-up alike.
describe('the note on the result card', () => {
  const note = puzzle.note!.replace(/'/g, '&#x27;').replace(/"/g, '&quot;');

  it('is shown after a find, with a link to the painting on Commons', () => {
    const html = card({});
    expect(html).toContain(note);
    expect(html).toContain(`href="${puzzle.source}"`);
  });

  it('is shown after a give-up too', () => {
    expect(card({ gaveUp: true })).toContain(note);
  });

  it('is shown on a practice run too', () => {
    expect(card({ isPractice: true })).toContain(note);
  });
});

describe('sharing the week from the result card', () => {
  const week = frameFor(weekOf([{ day: 11, ms: 5000, gaveUp: false }], 11, 11));

  it('is offered when the card is handed a week', () => {
    expect(card({ week })).toContain('Share your week');
  });

  it('is not offered without one, or on a practice run', () => {
    expect(card({})).not.toContain('Share your week');
    expect(card({ week, isPractice: true })).not.toContain('Share your week');
  });
});
