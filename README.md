# Find Me

A daily image-seek game. One painting a **week** has a small shape hidden in it — a
snowflake, a key, a crescent — a different one every day. Find it, then frame it so it
appears at the **same size and angle** as the badge in the corner. The clock starts on
your first move.

Play: **https://ryangano.github.io/find-me/**

## How it plays

1. The corner badge shows what you are looking for, drawn upright at exactly the size
   you have to match.
2. The shape is hidden somewhere in the painting, at some rotation and much too small.
3. Pan, zoom and rotate until it sits on screen at the badge's size and angle.
4. Share your time.

The painting starts blurred and the clock starts stopped. Both change on your first
pan, pinch or rotate, so there is no free look at the board before the timer runs.

Close enough counts: **±4% on size** and **±7.2° on angle**. The 7.2° is the rotational
equivalent of the same 4% tolerance, measured against a half-turn.

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

### The week

A painting stays for a whole week, Monday to Sunday in **your** timezone, and gets harder
every day of it. Monday is a gentle one; by Sunday you are looking for a small, faint
shape in the busiest corner of a painting you have been staring at for six days.

The ramp is aimed at a **time to find**, not at a contrast, because that is the thing a
player actually experiences. Targets, and the levers that reach them
(`src/game/difficulty.ts`):

| | Mon | Tue | Wed | Thu | Fri | Sat | Sun |
|---|---|---|---|---|---|---|---|
| roughly how long to find | 20s | 55s | 2m | 3m | 3m45 | 4m25 | 5m |
| `scan` target | 0.56 | 0.48 | 0.41 | 0.38 | 0.36 | 0.345 | 0.335 |
| size, image px | 40 | 37 | 34 | 31 | 28 | 25 | 22 |
| texture of the hiding place | flattest | → | → | → | → | → | busiest |
| degrees to turn | 12 | 25 | 34 | 46 | 70 | 104 | 148 |

- **`scan`** is what opacity is solved for, and the reading that corresponds to time to
  find: the shape's luminance shift with the whole painting on screen, divided by the
  texture of the paint immediately around it, and then by that canvas's own **search
  cost** — how much ground there is to cover and how much of it looks like something.

  All three parts had to be there, and each was learned by being wrong. Raw peak
  brightness said Rousseau's smooth sky and Bruegel's crowd were comparable when one was
  a beacon. Dividing by local texture fixed that within a painting but not across them:
  Rousseau at 0.45 cost 16 seconds while the Mona Lisa at 0.53 cost nearly four minutes,
  because a small plain canvas has far fewer places to look. Dividing by search cost lines
  them up — Bruegel's Monday at 0.56 and Rousseau's Sunday at 0.52 both took about twenty
  seconds. The scale is steep: 0.56 is twenty seconds and 0.36 is nearly four minutes.

- **Size** runs from 1.5% of the image width down to 0.85%. At the match the shape is
  always exactly `targetPx` across on screen, so size does not change how visible it is
  once you are on it — only how big a speck it is with the whole painting on screen, and
  how far you have to zoom. An earlier version of this ramp had it backwards and opened
  Monday at 64px, on the theory that a big shape makes a gentle day. It makes an instant
  one, and no amount of colour tuning rescues a shape that big.

- **Contrast at the match** is no longer a target. A day cannot be pinned to a time and a
  contrast at once. It is measured, recorded, and held above a floor of 0.95, because a
  shape you cannot see even when it is centred and correctly framed is not a hard puzzle —
  the player has done everything right and there is nothing there. Where the two conflict
  the day is brought back up and comes out easier than its rung asked for.

- **Monday carries no transparency at all.** It hides on size, placement and colour alone,
  so what gets solved for it is how far its fill sits from the paint beneath it.

- **Degrees** is the work after the shape's own symmetry is allowed for. A six-armed
  snowflake matches at every 60°, so it can never be asked for more than 30° of work,
  which is why the back half of the week always uses one-way shapes.

Every day also prefers paint that **repeats itself** — foliage, waves, roof tiles, a
crowd, a scatter of small stars — so that several specks look equally plausible and the
only way to tell is to try them. Monday leans on this hardest of anyone: it is the one day
with no transparency to hide behind, and a lone opaque shape in a clear sky is picked out
instantly however carefully its colour is matched. Sunday leans on it just as hard for the
opposite reason, because by then it is the whole puzzle.

It is measured against the surroundings two to five shape-widths out and never as an
overlap: a shape sitting on top of the thing it imitates is not hard, it is unfindable.
The score also discounts whatever similarity is owed to a single straight edge, since a
long boundary resembles itself everywhere along its length while offering a hidden shape
no company at all — Rousseau's Sunday scored 0.97 sitting on the line where the water
meets the sand, and played easy.

Within a week no shape, and no hiding place, is ever reused. Across weeks they are, and
that is fine.

Eight paintings therefore give eight weeks -- fifty-six days -- and `week.test.ts`
asserts the rules rather than the numbers: seven days per painting, seven different
shapes, every hiding place 400px from the others, and each day strictly smaller, fainter
and further round than the one before it.

Two things a hiding place may never be, both learned from looking at week sheets rather
than at numbers. It may not sit **under the corner badge**, which is opaque: a shape
there is not camouflaged but covered, and Bruegel's Tuesday measured a fitted-view peak
of 1 and read as a superb hiding place when it was really just furniture on top of it.
And it must clear the **edge of the canvas** by enough that the edge, and the black
beyond it, stays out of the frame at the winning zoom -- that is both ugly and a
landmark, telling a player which part of the painting they are in.

A hiding place must also let the two views be satisfied at once: the shape has to be
subtle with the whole painting on screen *and* plain once framed, which needs paint that is
smooth at a distance and rough close up. Where it is not, the tuner has to raise the day to
stay visible and it lands easier than the day before it — Seurat's Sunday came out easier
than its own Monday that way. The planner refuses such spots up front, on a floor of 1.5
measured across the eight paintings. Deriving that floor from the two requirements instead
gave 2.7, which reads plausibly and is above the 98th percentile of anything Van Gogh has
to offer, because the derivation assumes the shape shifts the paint equally at both zooms
and shrinking it averages its edges away.

There is one more axis that is measured and reported but deliberately **not** solved for:
how loud the shape is with the whole painting on screen. It does not move with contrast
-- a shape on smooth empty sky can be gentle against its immediate surroundings and still
be the one thing that catches the eye. Two attempts to solve for it both made the game
worse. Hand-picked ceilings dimmed nearly every day in the set, taking Bruegel's Monday
to 1.96 and four days below 1.0; a relative rule, never louder than yesterday, chained
instead, one loud Tuesday dragging its whole week down to 0.68. `npm run camouflage`
flags it and `npm run preview:week` settles it.

### Choosing a painting

Not every painting can hold a week. `npm run rate` measures the texture a canvas offers
between its quietest and busiest usable paint, which is what the ramp spends:

```bash
npm run rate -- public/puzzles/*.jpg .source-images/candidate.jpg
```

Two paintings have been dropped this way, failing at opposite ends.

**Bosch's *Garden of Earthly Delights*** had no quiet paint anywhere: its quietest measures
29.9 where every painting that tunes cleanly sits at 18.5 or below, so its Monday could not
be made easy at any fill or opacity. Rousseau's *The Sleeping Gypsy* replaced it.

**Turner's *The Fighting Temeraire*** failed the other way, and was caught only after the
ramp started aiming at times. A median texture of 8.2 means there is nothing anywhere for a
shape to hide *in*, so hard-to-scan and visible-once-framed became mutually exclusive: all
seven days had to be raised back up to stay visible and none of them could be made hard.
Bruegel's *The Tower of Babel* replaced it, at 6.2 quiet and 42.3 median — a quiet sky at
the top and dense detail below, which is the shape of a canvas that can hold a week.

The thresholds in `rate-painting.mjs` are calibrated against the paintings already tuned
rather than guessed, and the browser tuner stays the authority.

### Fairness

Everything is fixed and identical for every player: which painting a week gets, which
day of it you are on, where the shape hides, its size, its angle and its colour. The day
rolls over at **your** local midnight, and the week lines up with your own calendar --
`daily.test.ts` walks 400 consecutive real dates and checks that every Monday gets a
Monday puzzle, because a ramp that has drifted a day out of step looks perfect on any
single day you happen to check. Nothing is randomised or derived
from the session, so two people's times are timing the same thing. `determinism.test.ts`
holds that line -- it pins the day-to-puzzle mapping, checks every target is fully
specified, and fails the build if `Math.random` or a crypto random ever appears in
`src/`.

The corner badge is drawn in the target's **own** fill colour, not a house colour, since
it is the only description a player gets of what they are hunting for.

### Feedback

There is exactly one running hint, and it lives **on the badge**: once the shape is
**on screen** at close to the right size and angle, the badge lights amber, and it turns
green as you land the match.

All three conditions matter. The badge used to light on zoom and twist alone, which meant
it announced "nearly there" to a player still staring at completely the wrong corner of
the painting. That is not what nearly means, and it let you sweep for the shape blind
rather than look for it.

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

The shape has two jobs that pull against each other. Someone scanning the whole painting
must not pick it out; someone who has zoomed in on it must be able to see it plainly. It
should be *camouflaged*, not *hidden*.

Those are separable, thanks to an asymmetry worth stating outright. At the match the
shape is always exactly `targetPx` across on screen, because the winning scale is
`targetPx / size` — so how findable it is there depends on contrast alone, and not at all
on `size`. At the fitted view it is `size * fitScale` across, which does shrink with
`size`. **Shrinking a shape makes it harder to scan for without making it any harder to
see once you are on it.** That asymmetry is what lets the week ramp both at once: sizes
run from 2.5% of the image width on Monday down to 1.3% on Sunday, and contrast comes
down with them.

`npm run camouflage` reports both jobs: `found` is the contrast at the matched framing,
and `scannable` is the peak luminance shift at the fitted view — a single bright speck is
what gives a shape away when someone is scanning, so a peak reads that better than an
average over a shape only a few pixels across.

Opacity is solved for, not chosen. The same fill and opacity that vanish into Leonardo's
glazed landscape sit up and wave on Hokusai's flat woodblock, so no single number works
everywhere. `npm run camouflage` measures how far the shape shifts the pixels underneath
it **relative to the local texture it has to compete with**, and binary-searches for the
ratio that day's rung asks for. Monday is solved the same way on a different knob: it
keeps full opacity and moves its fill closer to the paint instead.

That ratio, rather than a flat contrast figure, is the whole point. An earlier pass
targeting a fixed luminance shift left several puzzles genuinely unfindable even at the
matched zoom: a shift that reads clearly on a smooth glaze is swallowed whole by
hard-edged waves. Measuring against local texture fixed it.

```bash
npm run plan                       # pick every week's hiding places, shapes and angles
npm run plan -- mona               # just one painting
npm run camouflage                 # report every day against its rung
npm run camouflage -- --solve      # solve each day's paint and write puzzles.ts
npm run preview:week -- mona       # look at a whole week, seven rows of three
```

The day lines in `puzzles.ts` are written by those two and rewritten in place, which is
why each is one dense line. Editing one by hand is fine; keep it on one line.

`preview:week` is the third check and the one the numbers cannot make: each day as the
player meets it, the same frame with the answer ringed, and the winning framing. A Monday
that reads as a sticker or a Sunday that is simply not there shows up there and nowhere
else.

| Path | What lives there |
|---|---|
| `src/game/transform.ts` | Viewport transform, gesture composition, pan constraint |
| `src/game/symmetry.test.ts` | Measures each shape's true rotational symmetry from pixels |
| `src/game/match.ts` | Win condition and the tolerances |
| `src/game/puzzles.ts` | Eight weeks of seven days — image, hiding place, size, angle |
| `src/game/difficulty.ts` | The Monday-to-Sunday ramp, and what each rung means |
| `scripts/plan-weeks.mjs` | Picks each week's hiding places, shapes, angles and colours |
| `scripts/rate-painting.mjs` | Whether a painting can hold a week at all |
| `scripts/lib/paint.mjs` | How a hidden shape is coloured, shared by planner and tuner |
| `scripts/preview-week.mjs` | Screenshots a whole week, to look at the ramp |
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
npm test           # unit tests (transform maths, win condition, the weekly ramp)
npm run build      # typecheck + production build into dist/
```

### Testing a specific puzzle

Any puzzle can be opened directly. These runs are marked *practice* and are not
recorded or counted towards a streak.

```
?puzzle=starry-wed   # by id: <painting>-<mon|tue|wed|thu|fri|sat|sun>
?day=3               # by day number
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
4. Solve its opacity with `node scripts/tune-camouflage.mjs --target 1.9`. If it cannot
   reach the target at any opacity, the spot is too busy — use `--scan` to find one that
   works, or give the shape a fill with more luminance separation. Then check `scannable`
   has not climbed: a spot that needs near-full opacity to be findable will be a bright
   speck at the fitted view, which is how starry and delights ended up being moved.
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

Keep `size` small, around 1.5% of the image width. Smaller means more zoom to reach the
match, which is the fair way to make a puzzle harder; it also means the painting is shown
further above its native resolution at the moment of the match, so there is a floor.

## Deployment

Pushing to `main` runs lint, tests and a build, then publishes `dist/` to GitHub Pages.
The site is served from a subpath, so `base` in `vite.config.ts` and `SITE_URL` in
`src/game/share.ts` both have to agree with the repository name.

## Credits

All paintings are in the public domain, sourced from Wikimedia Commons. The `i` button in
the top bar credits every one of them by title, painter and year; the `year` field lives
beside `title` and `artist` on each week seed in `src/game/puzzles.ts`.
