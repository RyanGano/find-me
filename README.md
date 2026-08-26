# Find Me

A daily image-seek game. One painting a day has a small shape hidden in it — a snowflake,
a key, a crescent. Find it, then frame it so it appears at the **same size and angle** as
the badge in the corner. The clock starts on your first move.

Play: **https://ryangano.github.io/find-me/**

## How it plays

1. The corner badge shows what you are looking for, drawn upright at exactly the size
   you have to match.
2. The shape is hidden somewhere in the painting, at some rotation and much too small.
3. Pan, zoom and rotate until it sits on screen at the badge's size and angle.
4. Share your time.

The painting starts blurred and the clock starts stopped. Both change on your first
pan, pinch or rotate, so there is no free look at the board before the timer runs.

Close enough counts: **±2% on size** and **±3.6° on angle**. The 3.6° is the rotational
equivalent of the same 2% tolerance, measured against a half-turn. It was ±5% until the
badge started hinting; with a hint in play, the landing has to be worth something.

Input sensitivity is set against those tolerances rather than by feel. A notched mouse
wheel reports about 100 deltaY per click, which at the old sensitivity moved the zoom
16% and swung the angle 20° in a single click -- neither could ever be landed inside the
window. A click is now about 4% and 3.4°, with `+`/`-` and `Q`/`E` finer still for the
last nudge.

Shapes with rotational symmetry — a six-armed snowflake, a five-pointed star, a
four-leaf clover — match at **every** equivalent rotation, so you are never asked to
distinguish two positions that look identical. Getting this wrong is easy and invisible
by inspection, so `symmetry.test.ts` measures it rather than trusting the numbers: it
rasterises each shape, rotates the raster about the same point the app rotates it
about, and derives the true rotational order. That test caught a triangle whose
symmetry was real about its centroid but not about the box centre the app spins it
around.

### Controls

| | Touch | Mouse / trackpad |
|---|---|---|
| Pan | one finger | drag, or arrow keys |
| Zoom | pinch | scroll, `+` / `-`, or alt+drag |
| Rotate | twist two fingers | shift+scroll, shift+drag, or `Q` / `E` |

### Fairness

Everything is fixed and identical for every player: which painting a day gets, where
the shape hides, its size, its angle and its colour. Nothing is randomised or derived
from the session, so two people's times are timing the same thing. `determinism.test.ts`
holds that line -- it pins the day-to-puzzle mapping, checks every target is fully
specified, and fails the build if `Math.random` or a crypto random ever appears in
`src/`.

The corner badge is drawn in the target's **own** fill colour, not a house colour, since
it is the only description a player gets of what they are hunting for.

### Feedback

There is exactly one running hint, and it lives **on the badge**: once your view is close
on both size and angle it lights amber, and it turns green as you land the match.

It was briefly drawn on the hidden shape instead, which was a straightforward mistake --
it put a bright ring around the very thing the player is meant to be searching for and
handed the answer to anyone who had not spotted it yet. On the badge it says exactly the
same thing while revealing nothing, because closeness depends only on zoom and twist,
never on position.

Before that, live size and angle gauges ran along the bottom. They worked, but they let
you dial in a perfect match before finding anything and then simply sweep the painting,
which turned a seek game into a scan.

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

### Camouflage is measured, not eyeballed

Shapes are small — around 2% of the image width. A small shape is invisible in the fitted
view on its own merits, and zooming in to match it magnifies it back to something
findable, so difficulty comes from scale rather than from making the shape so faint that
finding it is unfair.

Opacity is solved for, not chosen. The same fill and opacity that vanish into Leonardo's
glazed landscape sit up and wave on Hokusai's flat woodblock, so no single number works
everywhere. `npm run camouflage` measures how far the shape shifts the pixels underneath
it **relative to the local texture it has to compete with**, and binary-searches the
opacity that lands on a chosen ratio. Every puzzle is tuned to 2.0.

That ratio, rather than a flat contrast figure, is the whole point. An earlier pass
targeting a fixed luminance shift left several puzzles genuinely unfindable even at the
matched zoom: a shift that reads clearly on a smooth glaze is swallowed whole by
hard-edged waves. Measuring against local texture fixed it.

```bash
npm run camouflage                                    # report every puzzle
npx vite-node scripts/tune-camouflage.ts -- --target 2  # solve for a ratio
npx vite-node scripts/tune-camouflage.ts -- --scan      # find workable hiding places
```

`--scan` reports where in a painting a shape *can* hide: textured enough to disappear
into, not so busy that no opacity makes it findable. Five of the current positions came
from it, after the tuner showed their original spots could not reach the target ratio at
any opacity at all.

| Path | What lives there |
|---|---|
| `src/game/transform.ts` | Viewport transform, gesture composition, pan constraint |
| `src/game/symmetry.test.ts` | Measures each shape's true rotational symmetry from pixels |
| `src/game/match.ts` | Win condition and the tolerances |
| `src/game/puzzles.ts` | Puzzle definitions — image, hiding place, size, angle |
| `src/game/shapes.ts` | Shape paths and their rotational symmetry |
| `scripts/tune-camouflage.mjs` | Measures and solves how well a shape hides, in-browser |
| `scripts/diag-camouflage.mjs` | Screenshots the match zoom, to look at a hiding place |
| `src/game/daily.ts` | Which puzzle a given day gets |
| `src/game/storage.ts` | Recorded times, versioned by puzzle definition |
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
genuine wheel and pointer events, checks the blur, the timer, the outline, the result
card and that the result survives a reload. It then runs a set of touch regressions
that pin down two input bugs which only appear on real devices:

- **Safari gesture events double-applying.** On iOS, `gesturestart`/`gesturechange`
  fire *alongside* the touch pointer events for the same two fingers. Acting on both
  zooms roughly the square of what the fingers asked for, which is what reached us as
  "the zoom doesn't match my pinch". The handler now ignores them whenever pointers are
  down, which leaves them serving only their real purpose, the desktop trackpad.
- **Ghost fingers.** If a `pointerup` never arrives -- the app is backgrounded, a call
  comes in, Safari claims the gesture -- a stale entry used to sit in the pointer map
  forever, and the next one-finger drag was read as a pinch against a motionless ghost.
  In the regression that turns a 60px drag into an 803px lurch with a 0.72x zoom, which
  is both "zoom is way too strong" and "zoom stopped working". Releases are now tracked
  on the window, a primary `pointerdown` clears any leftovers, and losing visibility
  drops everything.

Both regressions were confirmed to fail against the unfixed code before the fix landed.
Screenshots land in `.source-images/shots`.

```bash
npm run build
npx vite preview --port 4173 &
node scripts/smoke.mjs
```

It uses your installed Chrome or Edge, so there is no browser download.

`scripts/diag-size.mjs` is a narrower tool for one recurring question: does the hidden
shape really render at the badge's size when the game says it matches? It measures the
painted path geometry of both through their live transform matrices, on desktop and at
iPhone dimensions. It reports a ratio of 1.0000 on both, which is how the "the object
looks bigger than the badge" report was traced to gesture gain rather than geometry.

## Adding a puzzle

1. Drop a high-resolution source image in `.source-images/` and add it to the list in
   `scripts/resize-images.mjs`, then run `npm run images`. Assets are generated at
   2600px wide into `public/puzzles/`.
2. Add an entry to `SEEDS` in `src/game/puzzles.ts` with the image's dimensions and
   where the shape hides — `cx`, `cy`, `size` and `angle` are all in the **generated
   asset's** pixel space.
3. Look at the hiding place as a player will see it — the real page, snapped to the
   exact winning framing:
   ```bash
   node scripts/diag-camouflage.mjs mona '[{}]' out.jpg
   ```
   It also takes a list of variants to compare, e.g.
   `'[{"opacity":0.1},{"opacity":0.2,"blur":1.5}]'`. **Judge camouflage only from this**,
   never from a composited preview — see the note above about what that cost.
4. Solve its opacity with `node scripts/tune-camouflage.mjs --target 1.05`. If it cannot
   reach the target at any opacity, the spot is too busy — use `--scan` to find one that
   works, or give the shape a fill with more luminance separation.
5. `npm test` checks that every asset exists, that its dimensions match what the puzzle
   declares, and that the hiding place needs a real zoom to reach.

### Changing a puzzle that people have already played

Each result is stored with a fingerprint of the puzzle it was set on -- the id, shape,
position, size, angle, fill, opacity and blend. Move the shape, resize it, recolour it
or swap it for another, and the fingerprint changes, so anyone holding a result for that
day gets it handed back to them as playable rather than being shown a finished board for
a puzzle that no longer exists. Their old time still counts towards played, best and
streak; it just no longer locks the day. Editing a title or an artist line does not
trip this, since it does not change what the player has to do.

Keep `size` small, around 2% of the image width. Smaller means more zoom to reach the
match, which is the fair way to make a puzzle harder; it also means the painting is shown
further above its native resolution at the moment of the match, so there is a floor.

## Deployment

Pushing to `main` runs lint, tests and a build, then publishes `dist/` to GitHub Pages.
The site is served from a subpath, so `base` in `vite.config.ts` and `SITE_URL` in
`src/game/share.ts` both have to agree with the repository name.

## Credits

All paintings are in the public domain, sourced from Wikimedia Commons.
