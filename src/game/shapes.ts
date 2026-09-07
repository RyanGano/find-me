/**
 * Shapes are authored in a 100x100 box centred on (50, 50) and drawn upright.
 * `symmetry` is the shape's rotational symmetry, which sets how many rotations
 * count as "matching" the reference.
 */
export interface ShapeDef {
  path: string;
  /**
   * Rotational symmetry **about the centre of the 100x100 box**, which is the point the
   * app rotates shapes around. A shape whose symmetry is only true about some other
   * point does not count -- see the triangle, whose vertices are placed on a circle
   * centred on the box rather than sitting flat on its base. `symmetry.test.ts`
   * measures this from the rendered drawing rather than taking these numbers on trust.
   */
  symmetry: number;
  label: string;
  emoji: string;
  /** Overlapping sub-paths need 'nonzero' to union; holes need 'evenodd'. */
  fillRule?: 'nonzero' | 'evenodd';
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

/** A thick line segment, as a filled quad. */
function bar(x1: number, y1: number, x2: number, y2: number, width: number): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const nx = (-dy / len) * (width / 2);
  const ny = (dx / len) * (width / 2);
  return polygon([
    [x1 + nx, y1 + ny],
    [x2 + nx, y2 + ny],
    [x2 - nx, y2 - ny],
    [x1 - nx, y1 - ny],
  ]);
}

/** Six arms with side branches, built around the box centre so the symmetry is exact. */
function snowflakePath(): string {
  const parts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 - Math.PI / 2;
    parts.push(bar(50, 50, 50 + 47 * Math.cos(a), 50 + 47 * Math.sin(a), 10));
    for (const side of [-1, 1]) {
      const bx = 50 + 26 * Math.cos(a);
      const by = 50 + 26 * Math.sin(a);
      const b = a + (side * Math.PI) / 3;
      parts.push(bar(bx, by, bx + 18 * Math.cos(b), by + 18 * Math.sin(b), 7.5));
    }
  }
  return parts.join(' ');
}

/** A circle, as a path, so petals can be unioned under 'nonzero'. */
function circle(cx: number, cy: number, r: number): string {
  return `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${r * 2} 0 a${r} ${r} 0 1 0 ${-r * 2} 0 Z`;
}

/**
 * Round petals on a ring, plus a middle to close the gaps. Built about the box centre,
 * so the symmetry is exactly the petal count and not an accident of the drawing.
 */
function blossomPath(petals: number): string {
  const parts = [circle(50, 50, 17)];
  for (let i = 0; i < petals; i++) {
    const a = (i * 2 * Math.PI) / petals - Math.PI / 2;
    parts.push(circle(50 + 29 * Math.cos(a), 50 + 29 * Math.sin(a), 21));
  }
  return parts.join(' ');
}

/**
 * Four leaves on the diagonals: narrow where they meet the centre, round at the tip.
 * Built about the box centre from one lobe rotated four times, so the leaves sit at
 * exactly 45 degrees and the symmetry is exactly 4.
 */
function cloverPath(): string {
  // Reach and width are set so the four leaves together cover the same area as the
  // hand-drawn ones they replace, since that area is what the tuner solved each day's
  // opacity against.
  const reach = 32.11;
  const half = 16.57;
  const parts: string[] = [];
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    const at = (along: number, across: number) =>
      `${(50 + along * ux - across * uy).toFixed(2)} ${(50 + along * uy + across * ux).toFixed(2)}`;
    // Out along one side of the diagonal to the tip, then the mirror of that back: the
    // second control point sits square across the axis, so the tip comes out round and
    // the waist at the centre comes out to a point.
    parts.push(
      `M50 50 C${at(0.3 * reach, 0.7 * half)} ${at(0.98 * reach, half)} ${at(reach, 0)}` +
        ` C${at(0.98 * reach, -half)} ${at(0.3 * reach, -0.7 * half)} 50 50 Z`,
    );
  }
  return parts.join(' ');
}

export const SHAPES: Record<string, ShapeDef> = {
  snowflake: {
    path: snowflakePath(),
    symmetry: 6,
    label: 'snowflake',
    emoji: '❄️',
    fillRule: 'nonzero',
  },
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
    // Drawn so that a half turn about (50, 50) maps the outline exactly onto itself:
    // every vertex has its opposite number in the list. The old outline was a couple of
    // pixels out of true, which read as identical upside down but did not measure so.
    path: 'M62 2 L22 56 L46 56 L38 98 L78 44 L54 44 Z',
    symmetry: 2,
    label: 'lightning bolt',
    emoji: '⚡',
  },
  crescent: {
    /**
     * The inner arc's radius has to reach between the two tips, or SVG silently inflates
     * it to a semicircle and the crescent comes out a hairline. That is what the first
     * version of this did -- it asked for r38 across a 92-unit chord -- and a play-tester
     * went over the whole painting several times without ever seeing the moon. Fuller by
     * a little over half in area, and still unmistakably a crescent.
     */
    path: 'M72.88 9.01 A46 46 0 1 0 72.88 90.99 A41 41 0 1 1 72.88 9.01 Z',
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
    /**
     * Each leaf is centred exactly on a diagonal of the box, because the shape reads as
     * one that ought to point at the corners: hand-drawn leaves a few degrees off the
     * diagonal had players twisting past the match and back, fighting the instinct the
     * drawing itself gives them. Same reach and area as the leaves it replaces, so a day
     * hiding a clover is the size it always was.
     */
    path: cloverPath(),
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
    // Vertices on a circle about (50, 50): rotating by 120 degrees about the box
    // centre must map the drawing onto itself, which a flat-based triangle does not.
    path: polygon([
      [50, 4],
      [50 + 46 * Math.cos(Math.PI / 6), 50 + 46 * Math.sin(Math.PI / 6)],
      [50 - 46 * Math.cos(Math.PI / 6), 50 + 46 * Math.sin(Math.PI / 6)],
    ]),
    symmetry: 3,
    label: 'triangle',
    emoji: '🔺',
  },
  blossom: {
    path: blossomPath(5),
    symmetry: 5,
    label: 'blossom',
    emoji: '🌸',
    fillRule: 'nonzero',
  },
  cross: {
    path: 'M38 8 H62 V38 H92 V62 H62 V92 H38 V62 H8 V38 H38 Z',
    symmetry: 4,
    label: 'cross',
    emoji: '➕',
  },
  diamond: {
    // Taller than it is wide on purpose: a square standing on its point would be
    // four-fold, and there is already a shape for every quarter turn in the set.
    path: polygon([
      [50, 3],
      [82, 50],
      [50, 97],
      [18, 50],
    ]),
    symmetry: 2,
    label: 'diamond',
    emoji: '🔷',
  },
  droplet: {
    path: 'M50 3 C78 24 88 52 88 66 C88 84 72 97 50 97 C28 97 12 84 12 66 C12 52 22 24 50 3 Z',
    symmetry: 1,
    label: 'droplet',
    emoji: '💧',
  },
  leaf: {
    // A cusp at the tip and a round shoulder opposite it. Both ends pointed would read
    // as a lens, which turns onto itself every half turn and would be a two-fold shape.
    path: 'M92 8 C46 8 10 40 10 70 C10 84 20 94 34 94 C70 94 96 56 92 8 Z',
    symmetry: 1,
    label: 'leaf',
    emoji: '🍃',
  },
  house: {
    path: 'M50 6 L96 44 H84 V94 H16 V44 H4 Z',
    symmetry: 1,
    label: 'house',
    emoji: '🏠',
  },
  crown: {
    path: 'M6 30 L28 54 L50 16 L72 54 L94 30 L86 88 H14 Z',
    symmetry: 1,
    label: 'crown',
    emoji: '👑',
  },
  spade: {
    path:
      'M50 4 C50 4 12 36 12 58 C12 72 22 81 33 81 C40 81 46 78 49 73 ' +
      'C48 83 43 91 34 96 H66 C57 91 52 83 51 73 C54 78 60 81 67 81 ' +
      'C78 81 88 72 88 58 C88 36 50 4 50 4 Z',
    symmetry: 1,
    label: 'spade',
    emoji: '♠️',
  },
  tree: {
    path: 'M50 3 L72 35 H62 L80 61 H68 L88 89 H58 V98 H42 V89 H12 L32 61 H20 L38 35 H28 Z',
    symmetry: 1,
    label: 'pine tree',
    emoji: '🌲',
  },
  note: {
    path:
      'M62 6 C80 16 90 26 90 41 C90 50 85 57 78 61 C83 51 80 43 62 33 ' +
      'V72 C62 85 50 96 36 96 C26 96 19 90 19 82 C19 71 30 63 42 63 ' +
      'C47 63 52 64 55 67 V6 Z',
    symmetry: 1,
    label: 'music note',
    emoji: '🎵',
  },
};

export function getShape(key: string): ShapeDef {
  const s = SHAPES[key];
  if (!s) throw new Error(`Unknown shape: ${key}`);
  return s;
}
