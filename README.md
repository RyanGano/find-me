# Find Me

A daily image-seek game. One painting a day has a shape hidden in it — a star, a key,
a crescent. Find it, then frame it so it appears at the **same size and angle** as the
badge in the corner. The clock starts on your first move.

Play: **https://ryangano.github.io/find-me/**

## How it plays

1. The corner badge shows what you are looking for, drawn upright at exactly the size
   you have to match.
2. The shape is hidden somewhere in the painting, at some rotation and much too small.
3. Pan, zoom and rotate until it sits on screen at the badge's size and angle.
4. Share your time.

Close enough counts: **±5% on size** and **±9° on angle**. The 9° is the rotational
equivalent of the same 5% tolerance, measured against a half-turn. Shapes with
rotational symmetry — a five-pointed star, a four-leaf clover — match at every
equivalent rotation, so you are never asked to distinguish two identical positions.

### Controls

| | Touch | Mouse / trackpad |
|---|---|---|
| Pan | one finger | drag, or arrow keys |
| Zoom | pinch | scroll, `+` / `-`, or alt+drag |
| Rotate | twist two fingers | shift+scroll, shift+drag, or `Q` / `E` |

### The gauges

The size and angle gauges at the bottom are always live. They depend only on the zoom
and twist of your view, never on where the shape is, so they help you lock in the match
without ever hinting at the hiding place. Finding it is still on you.

## How it is built

The whole game is one similarity transform. `src/game/transform.ts` maps image-space
points to screen-space points, and every gesture — a pinch, a twist, a wheel tick, an
arrow key — is folded in as a scale/rotation about a pivot plus a pan. That is why two
fingers can pinch, twist and drag at once and the image tracks them exactly.

The hidden shapes are not painted into the JPEGs. Each puzzle declares where its shape
sits in image pixels, at what size and rotation, and the app draws it into the image
layer with a blend mode (`src/game/puzzles.ts`). That keeps the win condition exact —
the ground truth *is* the render — and adding a puzzle means adding a few numbers
rather than editing a painting.

| Path | What lives there |
|---|---|
| `src/game/transform.ts` | Viewport transform, gesture composition, pan constraint |
| `src/game/match.ts` | Win condition and the tolerances |
| `src/game/puzzles.ts` | Puzzle definitions — image, hiding place, size, angle |
| `src/game/shapes.ts` | Shape paths and their rotational symmetry |
| `src/game/daily.ts` | Which puzzle a given day gets |
| `src/hooks/useGestures.ts` | Pointer, wheel, Safari gesture and keyboard input |

## Development

```bash
npm install
npm run dev        # http://localhost:5173/find-me/
npm test           # unit tests (transform maths, win condition, daily rotation)
npm run build      # typecheck + production build into dist/
```

### Testing a specific puzzle

Any puzzle can be opened directly. These runs are marked *practice* and are not
recorded or counted towards a streak.

```
?puzzle=starry     # by id
?day=3             # by day number
```

### Browser smoke test

`scripts/smoke.mjs` drives the real page with Playwright: it solves the puzzle through
genuine wheel and pointer events, checks the gauges, the timer, the result card and
that the result survives a reload, then repeats the pinch-and-twist on a touch
viewport. Screenshots land in `.source-images/shots`.

```bash
npm run build
npx vite preview --port 4173 &
node scripts/smoke.mjs
```

It uses your installed Chrome or Edge, so there is no browser download.

## Adding a puzzle

1. Drop a high-resolution source image in `.source-images/` and add it to the list in
   `scripts/resize-images.mjs`, then run `npm run images`. Assets are generated at
   2600px wide into `public/puzzles/`.
2. Add an entry to `SEEDS` in `src/game/puzzles.ts` with the image's dimensions and
   where the shape hides — `cx`, `cy`, `size` and `angle` are all in the **generated
   asset's** pixel space.
3. Preview the hiding place before committing to it:
   ```bash
   node scripts/preview-spots.mjs '[{"id":"mona","cx":676,"cy":3055,"size":75}]' out.jpg
   ```
4. `npm test` checks that every asset exists, that its dimensions match what the puzzle
   declares, and that the hiding place needs a real zoom to reach.

Tune `size` to set difficulty: smaller means more zoom, but keep the required zoom near
the asset's native resolution so the shape stays crisp at the moment of the match.

## Deployment

Pushing to `main` runs lint, tests and a build, then publishes `dist/` to GitHub Pages.
The site is served from a subpath, so `base` in `vite.config.ts` and `SITE_URL` in
`src/game/share.ts` both have to agree with the repository name.

## Credits

All paintings are in the public domain, sourced from Wikimedia Commons.
