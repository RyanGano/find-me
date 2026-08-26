/**
 * Shapes are authored in a 100x100 box centred on (50, 50) and drawn upright.
 * `symmetry` is the shape's rotational symmetry, which sets how many rotations
 * count as "matching" the reference.
 */
export interface ShapeDef {
  path: string;
  symmetry: number;
  label: string;
  emoji: string;
}

function polygon(points: Array<[number, number]>): string {
  return points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ') + ' Z';
}

function starPath(points: number, inner: number): string {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < points * 2; i++) {
    const r = (i % 2 === 0 ? 50 : 50 * inner);
    const a = (i * Math.PI) / points - Math.PI / 2;
    pts.push([50 + r * Math.cos(a), 50 + r * Math.sin(a)]);
  }
  return polygon(pts);
}

export const SHAPES: Record<string, ShapeDef> = {
  star: {
    path: starPath(5, 0.42),
    symmetry: 5,
    label: 'star',
    emoji: '⭐',
  },
  key: {
    path:
      'M50 4 A18 18 0 1 0 50 40 A18 18 0 1 0 50 4 Z ' +
      'M50 14 A8 8 0 1 1 50 30 A8 8 0 1 1 50 14 Z ' +
      'M44 38 H56 V78 H70 V88 H56 V96 H44 Z',
    symmetry: 1,
    label: 'key',
    emoji: '🔑',
  },
  bolt: {
    path: 'M62 2 L22 56 H46 L38 98 L80 42 H54 Z',
    symmetry: 1,
    label: 'lightning bolt',
    emoji: '⚡',
  },
  crescent: {
    path: 'M64 4 A48 48 0 1 0 64 96 A38 38 0 1 1 64 4 Z',
    symmetry: 1,
    label: 'crescent moon',
    emoji: '🌙',
  },
  heart: {
    path: 'M50 92 C6 62 4 34 22 20 C36 9 50 20 50 32 C50 20 64 9 78 20 C96 34 94 62 50 92 Z',
    symmetry: 1,
    label: 'heart',
    emoji: '❤️',
  },
  arrow: {
    path: 'M50 2 L86 44 H64 V98 H36 V44 H14 Z',
    symmetry: 1,
    label: 'arrow',
    emoji: '➡️',
  },
  clover: {
    path:
      'M50 50 C50 30 34 24 26 32 C16 42 26 56 50 50 Z ' +
      'M50 50 C70 50 76 34 68 26 C58 16 44 26 50 50 Z ' +
      'M50 50 C50 70 66 76 74 68 C84 58 74 44 50 50 Z ' +
      'M50 50 C30 50 24 66 32 74 C42 84 56 74 50 50 Z',
    symmetry: 4,
    label: 'clover',
    emoji: '🍀',
  },
  fish: {
    path: 'M8 50 C28 20 66 20 82 50 C66 80 28 80 8 50 Z M82 50 L98 30 V70 Z',
    symmetry: 1,
    label: 'fish',
    emoji: '🐟',
  },
  anchor: {
    path:
      'M46 6 A6 6 0 1 1 54 6 A6 6 0 1 1 46 6 Z ' +
      'M45 18 H55 V88 H45 Z M28 30 H72 V38 H28 Z ' +
      'M10 58 C10 84 30 96 50 96 C70 96 90 84 90 58 H80 C80 76 66 86 50 86 C34 86 20 76 20 58 Z',
    symmetry: 1,
    label: 'anchor',
    emoji: '⚓',
  },
  triangle: {
    path: polygon([[50, 6], [92, 88], [8, 88]]),
    symmetry: 3,
    label: 'triangle',
    emoji: '🔺',
  },
};

export function getShape(key: string): ShapeDef {
  const s = SHAPES[key];
  if (!s) throw new Error(`Unknown shape: ${key}`);
  return s;
}
