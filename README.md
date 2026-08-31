# Find Me

A daily image-seek game. One painting a **week** has a small shape hidden in it — a
snowflake, a key, a crescent — a different one every day. Find it, then frame it so it
appears at the **same size and angle** as the badge in the corner. The clock starts on
your first move.

Play: **https://findme.ryangano.com/**

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

  All three parts had to be there, and each was learned by being wrong. The calibration
  numbers below are from a Rousseau week that is no longer in the rotation; they are kept
  because they are what the formula was fitted against. Raw peak
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

Nine paintings therefore give nine weeks -- sixty-three days -- and `week.test.ts`
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
be made easy at any fill or opacity.

**Turner's *The Fighting Temeraire*** failed the other way, and was caught only after the
ramp started aiming at times. A median texture of 8.2 means there is nothing anywhere for a
shape to hide *in*, so hard-to-scan and visible-once-framed became mutually exclusive: all
seven days had to be raised back up to stay visible and none of them could be made hard.
Bruegel's *The Tower of Babel* replaced it, at 6.2 quiet and 42.3 median — a quiet sky at
the top and dense detail below, which is the shape of a canvas that can hold a week.

The thresholds in `rate-painting.mjs` are calibrated against the paintings already tuned
rather than guessed, and the browser tuner stays the authority.

Every painting turned down is recorded in `.claude/skills/add-painting/rejected.json` with
what it failed on, so a candidate is sourced and measured once rather than every few
months.

### Variety

A week is seven days on one painting, so the list in `puzzles.ts` is a running order and a
player meets it one painting at a time over months. Three landscapes together is a season
of the same picture; two paintings by one painter back to back reads as the game repeating
itself, even though all fourteen days differ. Neither is visible in a diff — a new week is
appended to the bottom of a long file and looks perfectly fine on its own.

So each week declares a `genre` from a closed list, and `curation.test.ts` holds the order
to four rules: no painter two weeks running, no genre three weeks running, no painter
holding more than a third of the rotation, and at least four kinds of painting in play.
Two weeks of a kind together is allowed — a pair reads as variety with a rhyme in it, and
banning it would make the list hard to extend for no gain.

The rules constrain the order, and the order is effectively append-only: `daily.ts` maps
the calendar onto `PUZZLES` by index, so moving a week that players have already been
served moves every painting after it too. A failure is therefore about the painting being
added, and the fix is normally a different painting rather than a different position.

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

The corner badge is drawn in the target's **own** colour, not a house colour, since it
is the only description a player gets of what they are hunting for. That means the
colour the shape *ends up*, not the one it is declared as. `fill` is only an ingredient:
every day but Monday is painted at partial opacity through a blend mode, so the fill and
the finished shape can be a long way apart -- Hokusai's Monday star is declared as
near-white cream and lands the colour of wet sand, and the Mona Lisa's Monday snowflake
screens on to arrive markedly lighter than the dark brown it is declared as. A badge showing the declared colour sends the player hunting for a
thing that is not in the painting.

So the badge asks the render instead. `src/game/apparent.ts` composites the shape over
the paint it is actually hiding in -- same fill, same opacity, same blend -- and averages
the result over the shape's own footprint, so a crescent is measured across the crescent
rather than the square around it. It is drawn opaque on the neutral well: the swatch has
to read on a flat card, and re-applying the transparency there would only blend it into
the wrong background. Until the painting is decoded, and if the measurement cannot be
made at all, the declared fill stands in.

`node scripts/diag-badge.mjs` is the check. It compares every day's badge against a
completely separate render of the same shape over the same paint -- the browser's own
CSS `mix-blend-mode` over a crop cut by sharp -- so an error in the canvas maths cannot
agree with itself into looking right. The whole rotation currently sits within 6 levels
per channel of that second opinion, which is resampling drift rather than arithmetic.

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
| `scripts/diag-badge.mjs` | Checks each badge against the shape's real colour on the canvas |
| `src/game/daily.ts` | Which puzzle a given day gets |
| `src/game/storage.ts` | Recorded times, versioned by puzzle definition |
| `src/hooks/useGestures.ts` | Pointer, wheel, Safari gesture and keyboard input |

## Development

```bash
npm install
npm run dev        # http://localhost:5173/
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

### Keeping a streak on an iPhone

`localStorage` is the primary store, and on iOS it is the least durable thing a page can
write. WebKit deletes *all* script-writable storage -- localStorage, IndexedDB, the Cache
API -- for a site the player has not opened as first-party in seven days, and in a private
tab it never survives the tab at all. Neither shows any sign at the time. The player earns
a streak, quits Safari, comes back and the game has forgotten them.

Cookies live under a different rule. They are not taken by that sweep; instead a
script-set cookie's lifetime is *capped* at seven days and re-armed every time it is
written. So `src/game/backup.ts` keeps a second, compact copy of the results in a cookie,
`storage.ts` reads it behind localStorage and fills in any day only the cookie remembers,
and `touch()` rewrites it on every visit -- on the way in, not on the solve, or anyone who
opens the game without finishing would still lose the streak they already had.

The mirror is lossy on purpose: a cookie holds 4KB, so it carries the most recent 150 days
as day, time and puzzle version, plus the lifetime played count and best time for
everything older. It does not carry the per-run metrics, so a result restored from the
cookie shows a Find Me Age taken from its clock alone, exactly like a result recorded
before the metrics existed. localStorage always wins where both remember a day, and a
visit writes whatever only the cookie has back into localStorage, so a swept store heals
itself rather than living on the fallback.

The commonest way a streak is actually lost is none of the above: the player opens the
game from a link inside another app. That web view gets its own storage container,
dropped when the view closes, so they solve today's puzzle, come back tomorrow through
the same link, and meet a game that has never heard of them. `src/game/browser.ts` spots
it from the user agent -- on iOS, every real browser carries the `Safari/` token and a
bare `WKWebView` does not -- and the board says so, with the way out.

That test is deliberately blunt and only ever drives a dismissible sentence. It also has
one blind spot it cannot close: `SFSafariViewController`, the other way an app can open a
link, *is* Safari and reports Safari's exact user agent, while still getting storage of
its own. Nothing distinguishes it from inside the page, which is why the notice
recommends Add to Home Screen as well -- an installed copy has durable storage of its own
and is exempt from the seven-day sweep, and it is the one answer that holds however the
link was opened.

What none of this can fix is a browser that keeps nothing at all -- a private tab, or
"Block All Cookies" in Settings. That case now says so instead of failing silently:
`isPersistent()` writes a value and reads it back, in both stores, and the page carries a
plain warning above the board when neither survives. Trusting the calls not to throw is
not enough; a private tab accepts every write and simply forgets it.

### `?diag`

`/?diag` reports what the browser actually kept: a marker stamped on first open and how
old it is, what is in each store, whether cookies are on, the storage quota, and whether
the page was opened from the Home Screen or a tab. It is not linked from anywhere.

It exists because the durability of storage cannot be measured in one session -- a web
view accepts every write and reads it straight back, right up until it is closed. Across
sessions it is obvious. Open it, quit the browser, open it again: two markers still
reading "written just now" means nothing this site writes survives, and that is the whole
diagnosis.

## Deployment

Pushing to `main` runs lint, tests and a build, then publishes `dist/` to GitHub Pages.
The site is served from the custom domain in `public/CNAME`, at the root rather than a
subpath, so `base` in `vite.config.ts` stays `/` and `SITE_URL` in `src/game/share.ts`
has to match the domain.

## Counting

The site keeps an anonymous tally: how many runs are started each day, how many are
solved, and how long both take. One row per run, keyed by a random id the page mints when
the clock starts and forgets when the run ends -- no account, no cookie, and nothing that
outlives a single run, so the rows cannot be grouped by person even in principle. Practice
runs are never counted.

`What's counted` in the how-to panel says as much to the player, and switches it off.

The client half is `src/game/count.ts`, and it posts to whatever `VITE_COUNT_URL` the
build was given. Everything on the other end of that URL -- where the rows go, and how to
read them -- is deliberately not in this repository.

## Credits

All paintings are in the public domain, sourced from Wikimedia Commons. The `i` button in
the top bar credits every one of them by title, painter and year; the `year` field lives
beside `title` and `artist` on each week seed in `src/game/puzzles.ts`.
