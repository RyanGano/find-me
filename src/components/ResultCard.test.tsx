import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PUZZLES } from '../game/puzzles';
import type { Stats } from '../game/storage';
import { ResultCard } from './ResultCard';

const puzzle = PUZZLES[0];
const stats = { played: 1, streak: 1, best: 5000 } as Stats;

function card(props: { showNote?: boolean; gaveUp?: boolean }) {
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
// tested here is the other half: that it carries the note when asked, after a find and a
// give-up alike, and says nothing about the painting when it is not.
describe('the note on the result card', () => {
  const note = puzzle.note!.replace(/'/g, '&#x27;').replace(/"/g, '&quot;');

  it('is shown after a find, with a link to the painting on Commons', () => {
    const html = card({ showNote: true });
    expect(html).toContain(note);
    expect(html).toContain(`href="${puzzle.source}"`);
  });

  it('is shown after a give-up too', () => {
    expect(card({ showNote: true, gaveUp: true })).toContain(note);
  });

  it('is not shown unless asked for', () => {
    expect(card({})).not.toContain('result-note');
  });
});
