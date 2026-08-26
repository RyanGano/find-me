import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { selectPuzzle } from './daily';
import { PUZZLES } from './puzzles';

/**
 * Every player must get the identical puzzle: same painting, same hiding place, same
 * size, same angle, same colour. Shared times only mean something if the thing being
 * timed is the same thing. Nothing here may vary by player, session, or reload.
 */
describe('determinism', () => {
  it('gives the same day the same puzzle on every call', () => {
    const a = selectPuzzle('?day=5', new Date(2026, 7, 26));
    const b = selectPuzzle('?day=5', new Date(2027, 0, 14));
    expect(a.puzzle).toEqual(b.puzzle);
  });

  it('depends on the date only, not the time of day', () => {
    const morning = selectPuzzle('', new Date(2026, 8, 3, 6, 15));
    const night = selectPuzzle('', new Date(2026, 8, 3, 23, 45));
    expect(morning.index).toBe(night.index);
    expect(morning.puzzle).toEqual(night.puzzle);
  });

  it('fully specifies every target, leaving nothing to be filled in per player', () => {
    for (const p of PUZZLES) {
      const t = p.target;
      for (const [field, value] of Object.entries({
        shape: t.shape, cx: t.cx, cy: t.cy, size: t.size,
        angle: t.angle, fill: t.fill, opacity: t.opacity, blend: t.blend,
      })) {
        expect(value, `${p.id}.${field} is not pinned down`).toBeDefined();
      }
    }
  });

  it('draws the reference badge in the target\'s own colour', () => {
    // The badge is the only description of what is hidden. If it is drawn in a house
    // colour, players go looking for the wrong thing.
    const card = readFileSync('src/components/ReferenceCard.tsx', 'utf8');
    expect(card).toContain('puzzle.target.fill');
    expect(card).not.toContain('fill="var(--accent)"');
  });

  it('has no randomness anywhere in the game logic', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(path);
        } else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) {
          const source = readFileSync(path, 'utf8');
          if (/Math\.random|crypto\.getRandomValues|randomUUID/.test(source)) {
            offenders.push(path);
          }
        }
      }
    };
    walk('src');
    expect(offenders, `randomness found in: ${offenders.join(', ')}`).toEqual([]);
  });
});
