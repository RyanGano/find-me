import { getShape } from './shapes';
import type { Puzzle } from './types';

const base = import.meta.env.BASE_URL;

interface PuzzleSeed extends Omit<Puzzle, 'src' | 'thing' | 'emoji'> {
  thing?: string;
  emoji?: string;
}

/**
 * One puzzle per day, cycling in order.
 *
 * Coordinates are in the pixel space of the generated asset in `public/puzzles`
 * (2600px wide — see `npm run images`), so re-generating at a different width means
 * rescaling `cx`, `cy` and `size` by the same factor.
 *
 * `size` is picked so solving needs roughly a 4-8x zoom from the fitted view while
 * still landing near the image's native resolution, which keeps the shape crisp at
 * the moment of the match. The fill and blend mode settle the shape into the
 * brushwork so it reads as part of the painting until you are close.
 */
const SEEDS: PuzzleSeed[] = [
  {
    id: 'mona',
    title: 'Mona Lisa',
    artist: 'Leonardo da Vinci, c. 1503',
    width: 2600,
    height: 3933,
    target: { shape: 'star', cx: 676, cy: 3055, size: 75, angle: 137, fill: '#a8813f', opacity: 0.5, blend: 'screen' },
  },
  {
    id: 'wave',
    title: 'The Great Wave off Kanagawa',
    artist: 'Katsushika Hokusai, c. 1831',
    width: 2600,
    height: 1748,
    target: { shape: 'key', cx: 806, cy: 559, size: 81, angle: -48, fill: '#3d5f96', opacity: 0.55, blend: 'multiply' },
  },
  {
    id: 'starry',
    title: 'The Starry Night',
    artist: 'Vincent van Gogh, 1889',
    width: 2600,
    height: 2059,
    target: { shape: 'crescent', cx: 1534, cy: 559, size: 78, angle: 112, fill: '#e2ca7c', opacity: 0.5, blend: 'screen' },
  },
  {
    id: 'proverbs',
    title: 'Netherlandish Proverbs',
    artist: 'Pieter Bruegel the Elder, 1559',
    width: 2600,
    height: 1841,
    target: { shape: 'clover', cx: 1885, cy: 1274, size: 73, angle: 24, fill: '#7d5527', opacity: 0.55, blend: 'multiply' },
  },
  {
    id: 'jatte',
    title: 'A Sunday on La Grande Jatte',
    artist: 'Georges Seurat, 1884',
    width: 2600,
    height: 1731,
    target: { shape: 'bolt', cx: 910, cy: 1365, size: 75, angle: 156, fill: '#54613a', opacity: 0.55, blend: 'multiply' },
  },
  {
    id: 'delights',
    title: 'The Garden of Earthly Delights',
    artist: 'Hieronymus Bosch, c. 1500',
    width: 2600,
    height: 1480,
    target: { shape: 'heart', cx: 1300, cy: 806, size: 70, angle: -71, fill: '#7a4f42', opacity: 0.55, blend: 'multiply' },
  },
  {
    id: 'hunters',
    title: 'The Hunters in the Snow',
    artist: 'Pieter Bruegel the Elder, 1565',
    width: 2600,
    height: 1850,
    target: { shape: 'fish', cx: 1716, cy: 1118, size: 78, angle: 39, fill: '#4e6274', opacity: 0.55, blend: 'multiply' },
  },
  {
    id: 'temeraire',
    title: 'The Fighting Temeraire',
    artist: 'J. M. W. Turner, 1839',
    width: 2600,
    height: 1932,
    target: { shape: 'anchor', cx: 650, cy: 1495, size: 81, angle: -124, fill: '#5f4d3b', opacity: 0.5, blend: 'multiply' },
  },
];

export const PUZZLES: Puzzle[] = SEEDS.map((seed) => {
  const shape = getShape(seed.target.shape);
  return {
    ...seed,
    src: `${base}puzzles/${seed.id}.jpg`,
    thing: seed.thing ?? shape.label,
    emoji: seed.emoji ?? shape.emoji,
    target: { symmetry: shape.symmetry, ...seed.target },
  };
});
