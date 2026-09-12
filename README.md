# Find Me

A daily image-seek game. One painting a **week** has a small shape hidden in it — a
snowflake, a key, a crescent — a different one every day. Find it, then frame it so it
appears at the **same size and angle** as the badge in the corner. The clock starts on
your first move.

Play: **https://findme.ryangano.com/**

## Nothing here spoils a puzzle

This file, `CLAUDE.md`, the skills and every code comment explain *how* hiding places are
chosen and *why* the numbers are what they are. None of them ever says **where** a shipped
day hides, or anything a player could narrow the search with — not the object a shape sits
on, not the region of the canvas, not "the only red thing in the picture", and not a table
of per-day measurements that amounts to the same hint in numbers.

The whole game is the fun of finding it, and a repository is a public document. The rule is
worth a little vagueness in the prose: a failure is described by what went wrong, not by
where. Where a specific example genuinely cannot be dropped, use a painting that was
rejected and never shipped, or a bench painting from `testbed.ts` that will never be in the
rotation. Weeks that have already been served are not an exception, because the rotation
wraps and every one of them comes round again.

The diagnostic tools are the place for specifics. `npm run plan`, `npm run camouflage` and
`npm run preview:week` print and draw exactly where everything is, and they write to
`.scratch/`, which is gitignored.

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
around. It did not catch the lightning bolt, because the bolt was two-fold symmetric to
the eye and a couple of pixels out of true in the path, so the measurement agreed with
the wrong declared number: it now reads a half turn onto itself exactly, and matches
upside down. That costs it the back half of the week — a shape that matches every 180°
can never ask for more than 90° of work — which `canHold` in `shapeOrder.ts` enforces on its own.

A shape earns its place in the registry on two things the path string cannot show: the
silhouette has to be unmistakable as an 18px speck with a whole painting around it, and
the emoji it carries into the share text has to name the same thing an unprompted player
would call it. `npm run preview:shapes` writes a sheet of every shape at badge size,
turned as far as a hard day would ask, as that speck, and laid over real paint, next to
the share line it produces — which is the only way to judge either. Two of them were
drawn twice on the strength of it: the leaf is pointed at one end and round at the other
because a lens pointed at both turns onto itself every half turn and would have been a
two-fold shape, and the diamond is taller than it is wide for the same reason a square
standing on its point would not be.

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

- **`scan`** is what opacity is solved for, the reading that corresponds to time to find,
  and **the only lever in the ramp that changes difficulty**: the shape's luminance shift
  with the whole painting on screen, divided by the texture of the paint immediately
  around it.

  Both parts of the measure were learned by being wrong. The calibration numbers here are
  from a Rousseau week that is no longer in the rotation; they are kept because they are
  what the formula was fitted against. Raw peak brightness said Rousseau's smooth sky and
  Bruegel's crowd were comparable when one was a beacon. Dividing by local texture fixed
  that. The scale is steep: 0.56 is twenty seconds and 0.36 is nearly four minutes.

  `scan` is a **local** reading, and for a long time that was the whole of the ramp. It
  answers "how well is this shape hidden where it sits". It has nothing to say about "how
  many other places on this canvas will the eye stop on before it gets there" — and the
  second question turns out to be most of the hunt. See
  [Busyness](#busyness-what-the-ramp-was-missing), which is the correction.

  The rungs below are the target **at a canvas of reference busyness**, derived from the
  time each day is meant to take: **45s, 70s, 100s, 140s, 180s, 230s, 290s**.
  `scanForTime` shifts them for the painting the day is actually on.

  The usable band is narrow. `expectedSearchMs` clamps to [0.3, 0.6], so a target outside
  it is clamped rather than obeyed — and on a very calm painting that clamp bites for most
  of the week. `npm run rungs` prints where.

  **Nothing else moves difficulty.** Size, `company` and the asset resolution were each
  tried as levers, and the solver compensated every one of them straight back out — it
  brightens the shape until the day takes the time the rung asked for. Raising the assets
  from 2600px to 3400px, which shrinks every shape to 77% of its old share of the canvas
  at identical magnification, produced no measured gain at all; what it produced was eight
  days the solver could not place, because reaching the required loudness at that size
  tripped the beacon ceiling once framed. If a day should be harder, change its time.

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
that is fine -- but which shape comes when is chosen across the whole calendar, by
`shapeRun` in `src/game/shapeOrder.ts`, to three rules:

1. **Never the same shape two days in a row**, including a Sunday and the Monday after it.
2. **Every shape about as often as every other** -- within one use of each other over the
   weeks the rules choose.
3. **No order a player could learn.** The old planner stepped through a fixed list, so a
   player who noticed could guess tomorrow's shape. Ties are now broken by a hash of the
   week, the day and the shape.

A shape still only lands on a day it can turn far enough for, so the symmetric ones stay
on the front half of the week. The weeks already served when the rules arrived keep their
shapes and are named in `SHAPES_AS_SERVED`, a list of exemptions. The choice depends on
the shape registry, so **before adding or removing a shape, add every week already served
to that list**; otherwise the next plan re-deals them. `shapeOrder.test.ts` holds the file
to all three rules and to what the planner would choose.

Ten paintings therefore give ten weeks -- seventy days -- and `week.test.ts`
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

### Busyness: what the ramp was missing

**It is harder to spot a clover among a thousand paint splotches, and the ramp did not
know that.** Every day, on every painting, was solved to the same `scan` reading. So a
week of heavy, crowded, high-frequency paint came out exactly as much harder than a week
of smooth glaze as the painting happened to make it — and nothing in the tooling said so.

The numbers are not subtle. Across seventeen days with real recorded times — eleven from
the daily tally, six from play-test round `r1-weekend` — `scan`, the reading the entire
ramp is solved against, correlates with how long a day actually takes at a **rank
correlation of −0.14**. That is slightly worse than knowing nothing at all, and with the
sign the wrong way round. Two consecutive Mondays: same rung, same measured scan, a median
of **22 seconds** on the calmer painting and **3 minutes 21** on the busier one.

There had been a term for this, and it was removed. The rung's scan used to be multiplied
by the canvas's **search cost**, on exactly the right reasoning — a painting with more
ground to cover has earned a louder shape. It was dropped because `expectedSearchMs`
mapped a raw scan reading to a time with no cost term in it, so cost-scaled targets came
out at unequal times. That argument is circular: the targets were being judged against a
clock built without the term they were carrying. Two things were wrong at once, and only
one of them was the mechanism.

The other was the measure. `searchCost` was the median standard deviation of 200px
windows — **coarse** structure: a wave's edge, a figure's outline, the join between a
curtain and a wall. That is not what a hunt competes with. It ranked the flattest painting
on the bench (1.56) *above* the busiest (1.32), and real play separated those two by a
factor of thirty on the same rung.

What competes with the hunt is detail **the size of the shape**, because that is what the
eye has to stop and check. So `clutter` (`scripts/lib/busy.mjs`) is a band-pass: subtract
a blurred copy of the painting, and what survives is everything at roughly one shape
width. `clutter` is the share of the canvas carrying any of it. The rotation runs 0.39
(smooth glazed portrait) to 0.73 (dense short brushwork).

A second, smaller term came out of the same data. Contrast readings are absolute
grey-level shifts, and the same shift is harder to pick out of dark paint than out of
light, so `dim` — how dark the ground is at the hiding place — is measured per day.

Together, in `canvasShift`:

| | weight | range across the set | worth |
|---|---|---|---|
| `clutter` | 10.34 | 0.39 – 0.73 | about 30× in time to find |
| `dim` | 1.38 | 0.11 – 0.90 | about 1.4× |

Both are fitted as the residual of `expectedSearchMs` against those seventeen days, and
both are held zero-mean at the rotation's median canvas, so adding them re-levels nothing:
a day on a typical painting is asked for exactly the scan it was asked for before. What
moves is the two ends. The model's rank correlation with observed time goes from **−0.14
to +0.49**.

**What this is worth, and what it is not.** Seventeen days is enough to establish the
sign, the rough size, and the fact that the old model had neither. It is not enough to
trust the third digit, and `dim` in particular is the second term in a three-parameter fit
— read it as "the sign is right and the size is small". Both are meant to be refitted as
the tally grows. What is *not* on the table is going back to no term at all: that is a
measure that does not predict the thing it exists to predict.

Three things the fit says that are worth knowing before touching any of it:

- **Two open residuals.** Within one painting the model still misses badly in both
  directions — one bench Friday it prices at 93 seconds took a median of 387, and one
  bench Saturday it prices at 92 took 330. Canvas-level busyness cannot explain a
  within-painting swing; the hiding place can, and no local reading tried so far has
  predicted it. Local clutter at four window sizes was tested and added nothing beyond the
  canvas reading.
- **The whole set runs fast.** At the reference canvas the shipped days come in about
  2.5× quicker than the ramp intends. That is a separate question from busyness — a
  level, not a spread — and it is deliberately *not* folded into the correction here,
  because re-levelling the ramp on seventeen days would move every day in the game at
  once.
- **Paint alone cannot make a hard day on a calm painting.** `npm run rungs` prints the
  target for the calmest and busiest canvas in the set, and on the calmest six of the
  seven rungs clamp at the bottom of the fitted range. The Mona Lisa's Friday, Saturday
  and Sunday ran 8s, 12s and 15s in the tally, and no opacity fixes that. `sizeScale` is
  the lever that might; a very calm painting carrying a whole week may simply be a bad
  idea.

Both readings are measured by `npm run busyness`, written into `puzzles.ts` (`clutter` per
week) and into each day line (`dim`), and read by both the tuner and the age scale.
Neither is part of a day's `version` — they describe the painting, not the challenge — so
measuring them hands nobody a finished board back.

`scanForTime` and `expectedSearchMs` are exact inverses, and `busyness.test.ts` holds them
to it. The tuner solves a day with the first and the age scores it with the second; if the
two ever drift, the game starts pricing a day differently from the way it built it —
silently, and only visibly in a play-test months later.

### Solid shapes

**A shape the brushstrokes run straight through has no edge, and a shape with no edge is
not hidden, it is gone.** The Friday of the third week in the rotation played at a median
of nine minutes, and it was the first day anyone gave up on: two of the first six runs,
where every earlier day had none. The days either side of it, on the same painting, were
found in under a minute.

Nothing the tools measured could tell it apart from them. `scan`, the size-aware
`--fov` reading, both of those at phone size, a colour-only reading and a reading at
scanning zoom all put it level with its neighbours. What told it apart was looking at it:
a pale, see-through lift on brushwork whose strokes were the size of the shape, so the
strokes carried on through it undisturbed.

That is built into how a shape was painted. `screen` and `multiply` can only lighten or
darken the paint, and with either one opacity and fill trade for each other exactly -- a
screened fill `f` at opacity `o` lands at `a + o*f*(1-a)`, which depends on `o*f` alone.
So every day, however it was dialled, let the painting through, and an **opacity floor
would have done nothing**: the tuner would have darkened the fill to compensate and drawn
the same pixels.

So every see-through day now carries a flat layer of the paint's own colour under the
blended fill, covering at least `COVER_FLOOR` (0.5) of what is beneath (`cover` and `base`
on a `Target`). The strokes flatten inside the shape and it gets an edge of its own. At the
whole-painting view it is the painting's own average colour and changes nothing; it only
shows once a player is close enough to be looking.

The measurements cannot see it either, for the same reason they could not see the
problem: `scan` and `ratio` average the size of the shift a shape makes, and flattening
pushes pixels up and down around the blend's lift without moving that average. The tuner
still solves the blend to the day's rung on top of the cover, so **a covered day plays
easier than its `scan` says**, by an amount nothing prices. That is the direction a floor
should err in. The value was chosen by eye with `diag-camouflage.mjs`'s `cover` override:
below about 0.45 the edge does not appear.

Monday carries none; it is already opaque and hides on colour alone. Days served before
the rule are exempt by name in `BEFORE_COVER` in `cover.test.ts`, and the last of them
fails it. `cover` joins a day's `version` only where a day has one, so adding the field
moved no shipped day.

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

A canvas also has to have enough *colour* in it to hold a week, not just enough texture:
four different colours of paint, in places a week can legally use them. `npm run plan`
refuses a painting that cannot manage it and says which colours it found — see
[Variety inside a week](#variety-inside-a-week). No painting in the rotation has failed on
this, but a monochrome candidate would.

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

### Variety inside a week

The section above is about not serving the same *painting* twice running. The same problem
happens inside a single week, and for a long time nothing caught it.

Hokusai's week shipped with six of its seven days hidden in the same sandy paint — five of
them within two degrees of the same hue — and every one of those in the empty cream sky.
Nothing was in the blue of the wave, the foam, or the boats. Every day measured correctly
against its own rung and the badge honestly reported the colour it found; the failure was
only visible across the week, which was the one view nothing had. It was not one bad week
either. Measured against the rule that now exists, **all nine weeks in the rotation failed
it** — Bruegel's hunters and Altdorfer's battle were each six days of one colour, de Heem
six days of red.

The cause was that nothing in `plan-weeks.mjs` had any opinion about colour, and the
cheapest paint on a canvas is all in one place. The `viewAgreement` band compounded it:
asking for paint that is smooth close up and busier further out is very nearly a
description of empty background, so the water and the foam were refused and the sky was
not.

So a week now has to hide in at least **four different colours, with no colour used more
than twice** — seven days at two apiece is four — and a colour may only be used twice in
two different textures of paint, so that the second sandy day is a boat rather than more
sky. `palette.ts` holds the closed list of colour names and `variety.test.ts` holds the
shipped file to the rule. A painting that cannot offer four colours fails planning outright
with a message saying so, and the fix is a different painting.

**The rule is measured on the paint, not on the badge.** That is not the obvious choice —
the badge is what a player is actually shown — and the obvious choice was tried first and
does not work. A day's badge is not settled until `tune-camouflage.mjs` has solved it in a
browser, and it solves opacity anywhere from 0.17 to 0.99 for camouflage reasons that have
nothing to do with colour; a week planned as four colours came back from the tuner as
three, five times out of nine. A rule the planner cannot plan against is not a rule. The
paint can be planned against, because tuning rewrites `fill`, `opacity`, `ratio` and `scan`
and never `cx` or `cy`. It is also not a dodge: `paintFor` builds every fill out of the
local hue and moves lightness only, so the badge shows the hue of the paint it came out of
to within ten degrees across the whole rotation. `variety.test.ts` pins that rather than
assuming it, since it is what makes naming the paint a way of naming what the player is
sent after.

The list of colour names is deliberately coarse. An earlier version separated `tan`,
`brown` and `yellow`, and that let two days sit side by side in the same stretch of beige
and count as two different colours — arithmetic agreeing with itself rather than anything a
player would recognise. They are all `sand` now, and `cyan` went into `blue` for the same
reason. Very pale and very dark paint is named for that before its hue, because Hokusai's
foam holds a hue at saturation 0.28 and three days of it are still three days in the same
foam; the thresholds come from the rotation's own spread rather than being picked.

**Distance was the wrong lever, and was tried.** The complaint that the days were all "in
the same place" looks like a spacing problem and is not one: the week that shipped already
had every day 400px from its neighbours and no more than two in any ninth of the canvas.
Tightening that actively breaks weeks — raising the minimum separation from 420px to 700px,
or allowing only one day per ninth, both left Hokusai's Saturday with no legal spot at all
and tripled Friday's cost. Days that are all one colour are all in one place because a
stretch of paint one colour throughout *is* a region of the picture, so constraining colour
constrains position for free: the re-planned Hokusai week lands in seven of the nine cells
without any rule mentioning geometry.

Two other things had to move with it:

- **The week is now chosen as a whole.** Picking days one at a time cheapest-first cannot
  honour a constraint that spans the week — Monday takes the last cheap sand and Saturday,
  which had nowhere else to go, fails. `spotsForWeek` is a bounded depth-first search over
  each day's shortlist that backtracks when the caps cannot be met, and the shortlist is
  stratified by region so the search is handed a real choice rather than a hundred spots in
  the same sky.
- **Texture stopped being able to veto.** A day off its texture rung loses some of the
  cover the paint would have given it, and the tuner solves its opacity against the scan
  target afterwards regardless; a week where every badge is the same colour cannot be fixed
  later at all. So texture stays a term in the cost where a hard constraint can overrule it.
  The knock-on was not obvious: the `company` discount was guarded by `cost < 1.2`, which
  stood in for "roughly on its rung" back when nothing could push a day off it, and the
  re-planned Hokusai week came out with six of seven days off-rung and therefore earning no
  company at all. The guard now says what it always meant — the paint must not be flat.

### Prominence across a week

The rule above spreads a week across four colours. It says nothing about which day gets
which of them, and that turned out to be half the problem.

A Sunday came back from play as the easiest day of its week. Every rung was met — the
smallest shape of the week, the lowest contrast, the right texture, solved in a browser
onto its scan target like every other day — and it was well camouflaged against the paint
immediately around it. What did for it was that the colour it was hiding in barely occurs
on that canvas. Once a player has clocked what colour they are hunting, a rare colour
collapses the search to a glance.

So a hiding place has a second property worth measuring: **how much of the painting shares
its colour**. Call it prominence. A day in the dominant paint leaves a player the whole
picture to search; a day in the one odd patch leaves them almost nothing to search. That is
a difficulty lever, it runs the opposite way from where it had been landing, and nothing
could see it.

**It is a near miss for `company`, and the difference is what makes it a separate rule.**
`company` already asks whether a shape has lookalikes — but it measures grey-level
similarity on rings two to five shape-widths out. It is blind to colour, and blind to
anything further away than a few shape-widths. It answers "does this speck blend into its
neighbourhood"; prominence answers "how much of the canvas is still in play once the colour
is known". The day above scored respectably on the first and terribly on the second.

The ramp is a floor per day, rising through the week, in `MIN_PROMINENCE`:

| | mon | tue | wed | thu | fri | sat | sun |
|---|---|---|---|---|---|---|---|
| floor | — | — | 0.20 | 0.30 | 0.40 | 0.50 | 0.60 |

Monday and Tuesday are deliberately unconstrained. A patch of paint no other day can use
makes a perfectly good gentle day, and penning it in with everything else would waste it.

**It is measured on the paint, not on the nine colour names.** The names are the right
instrument for the spread rule and the wrong one here, because they are coarse by design:
`sand` covers pale cream and dark brown alike, so a day in a colour a canvas has almost
none of can measure as one of its most abundant. Prominence instead counts how much of the
painting a player could *confuse* with this paint — the share of usable windows within 0.18
of it in lightness, saturation and chroma-weighted hue. Hue is weighted by how much colour
is actually present, because two greys a hundred degrees apart are the same grey.

**It is normalised per painting**, against the largest such share the canvas offers, so 1.0
is the most crowded colour a painting has rather than a fixed amount of canvas. One
painting in the rotation is nearly nine-tenths a single colour and another is four colours
in earnest; an absolute floor would be trivial on the second and unreachable on the first.
The question the ramp is asking — is this one of the crowded colours *here* — is relative
by nature.

The measure is stable and cheap: sampled at a 32px window on a 48px grid, it agrees with a
full 24px sweep to within 0.02 on every day of every week, so the sparse grid is what
`prominenceOn` uses.

Two practical notes:

- **It is a hard gate in the planner, not a term in the cost.** That is what the failure
  called for. The day that prompted it was the cheapest spot on its canvas by every other
  measure, and any penalty small enough to leave the rest of the cost meaningful would have
  lost to it.
- **The tuner cannot fix it afterwards.** Solving a lone speck of a rare colour down to its
  scan target only produces a fainter lone speck of a rare colour. Like the colour spread,
  it has to be settled where the week is chosen.

#### Which weeks are held to it

Every week except the two that were already behind the calendar when the rule arrived.
Those two are named in `BEFORE_PROMINENCE` in `variety.test.ts`, and the list is of
exemptions rather than of weeks held to the rule, so a painting added later is caught by
default.

They are exempt because re-planning a week moves every hiding place in it, changing each
day's `version` and handing the day back to everyone who has already played it as an
unplayed board. That is a fair price for a week nobody has been served yet and a poor one
for a week they have. Measured before the re-plan, **seven of the ten weeks** put a colour
their canvas barely uses on a day asking for a long hunt, and four of them did it on the
Sunday — so this was the normal case rather than one unlucky week.

One thing the re-plan turned up that the arithmetic did not: forcing the back half of a
week into crowded paint moves the *whole* week, front included, because the search picks
the seven days together. On one painting that pushed a Monday somewhere the tuner had to
run the fill to its extreme and still only reached a contrast of 1.13 — a Monday you can
barely see even when framed, which clears the 0.95 floor and is still a bad Monday. The
spot went into `scripts/avoid.json`, which is what that file is for, and the day came back
at 2.09. Expect a prominence re-plan to shake a spot loose like this; `npm run preview:week`
is what catches it.

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

#### The reveal ring has no colour

The ring drawn round the answer -- after a solve, or after a give-up -- is a pale core
between two dark casings, and not a colour. It was `--ok` green for a long time, which is
the game's colour for a finished thing everywhere else, and on the dark chrome it reads
perfectly. On a painting it does not: a single stroke is only legible against paint it
happens to differ from, and a mid-green one laid over light warm paint all but disappears
at the exact moment it is supposed to be saying "here it was". A player who has just
solved a day, or given up on one, is owed an unmissable answer.

Light-on-dark-on-light has nothing to lose. Whatever is underneath, at least one of the
three edges is far from it, so the ring holds on every painting in the rotation without
anyone having to tune it per day -- and per-day tuning of a chrome element is exactly the
kind of maintenance the rest of the file avoids. It also drops the one hue pair the
running feedback should not lean on: the badge's "nearly" is amber and its solve was
green, and amber against green is the common form of colour blindness. The badge still
uses both, but it says the same thing three more ways -- the label changes from `nearly`
to the finished time, the card comes up, and the ring appears -- so no part of finishing a
day rests on telling those two apart. The ring, which had no second cue at all, no longer
depends on it.

All three widths are screen-constant: `Stage` divides them out of the zoom the same way it
does the shape's edge softening, so the ring is the same weight framed as it is fitted.

### The hunt trace

The share text carries one line of emoji: every time the player had the shape and let it
go, in order, then how it ended.

```
Find Me #212 🎨
🔍🔍🟨🔍🟨🟨🟩  1:42.0
```

- 🔍 **moved past it**: the whole shape was on screen, anywhere, drawn at a quarter or more
  of its final size, and the player moved off it without the badge ever lighting.
- 🟨 **nearly**: the badge went amber and then went off again.
- 💡 **took a hint**, where in the run it was taken. It is never compressed out of a long
  trace: whether a hint was taken is the one thing about a run the line must not lose.
- 🟩 **got it**, or 🏳️ on a give-up.

One mark per encounter, the closer of the two: an encounter that lit the badge is a 🟨 and
not a 🔍 as well. A loss only counts once it has lasted half a second, because squaring up at
the edge of the near band flickers the badge, and slipping off the edge of the screen and
straight back is the same look at it, not two.

**"In view" is its own rule** (`inView` in `metrics.ts`), not the age's hot zone. The hot
zone asks whether the player has *found* the shape, so it wants it close to its final size
and near the middle. The trace asks whether it was there to be seen and they went past it:
a quarter of its final size is about 15-22px across, 3-6x zoom on a phone, and a normal
scanning zoom. The first cut used the hot zone, which on a phone needs about 7x zoom and the
middle of the screen, and a tester who scanned past the shape several times got two 🔍. A
quarter is still above anything the fitted view draws (4-19% of final size across the
shipped puzzles), so a glance at the whole painting never counts. The result card
shows the line with a one-line key under it; the share text is the line alone.

**Events, not time.** The first version mixed the two: 🔍 was fifteen seconds of searching,
while 🟨 and 🟩 were events. Nobody could read it -- a tester took `🔍🔍🟨🔍🟨🟨🟩` for three
stretches of looking and two of positioning. Wordle's grid works because every square is
the same unit. The clock already says how long; what a player can learn from a trace,
theirs or a friend's, is how often the shape was had and let go. Getting better at this
game is panning past the shape less, not just being faster. Stored traces from that first
version keep their `s` marks, which are simply not drawn.

**It follows the badge.** The first version's 🟨 used the Find Me Age's *pass*, which then
needed the shape in the middle of the screen, and a tester who had watched the badge go
amber three times off-centre got a line with no 🟨 in it at all. That turned up a worse bug:
the age's hot zone (`isHot` in `metrics.ts`) could only be *entered* in the middle, so a
player who sized and squared up the shape anywhere else -- up beside the badge, to compare
the two -- never entered it. Their framing time read as zero, their near misses and
overshoots went uncounted, and the same run read three to seven years younger than it did
framed in the middle; dragging a found shape up to the badge counted as losing it. The zone
is now entered in the middle *or* by lighting the badge, and once entered it holds anywhere
on screen at roughly the right size. The middle stays one way in because at the fitted zoom
a shape sitting unnoticed at the edge of the screen has not been found.

The trace replaced a five-block speed bar that was a function of the time alone, so two
players on the same clock posted identical lines however differently they had played. It
records *that* a player had the shape, never where, so a trace from any day says nothing
about where that day hides. It is never sent anywhere; it lives in the run's metrics
(`trace` in `metrics.ts`) and is only ever posted by the player.

It is capped at twelve glyphs so it stays on one line in a share sheet: the longest run of
one mark loses a glyph at a time (`compressTrace`), so every kind of event stays in the
line and the ending always survives. Runs recorded before the trace existed, and runs
banked mid-hunt across that deploy, have none, and share with the speed bar as they did.

### Hints

The give-up used to be the only way out, and it costs the streak, so a walled player had
two choices: stare on, or lose the streak. A **hint** is the gentler third. It draws a
dashed circle on the painting that the shape lies wholly inside, and the run carries on:
same clock, same solve, streak kept. The share shows a 💡 where the hint was taken, and
the card's key explains it on a run that used one.

- **The circle** (`hint.ts`) has a radius of 16% of the painting's shorter side -- about a
  fifteenth of a landscape canvas -- and its centre sits 55% of a radius off the shape, in a
  direction derived from the day's id. Never centred, because players learn to look in the
  middle of a centred circle within a day; the same for every player, because everything in
  a day is.
- **It opens** after the day's own `expectedSearchMs`, on a 30-second floor and a
  two-minute cap (`hintAfterMs`), so it always opens strictly before the give-up. It first
  shared the give-up's 45-second floor, and on a gentle day the two opened in the same
  instant. The button follows the give-up's rules: visible and dimmed from the start,
  answering an early press with encouragement. That early press is *not* reported as
  `stuck`, which has always meant a reach for the give-up.
- **It speaks up when the give-up opens.** A few pulses, then still: a player about to
  reach for the harsher way out should see the gentler one first. And pressing give up
  without having taken the hint asks whether they want a hint instead, before it asks
  whether to end the streak.
- **It lives in the trace**, so a run banked mid-hunt comes back with its circle drawn.
- **It is counted.** A `hint` report carries the run clock when it was taken, and is kept
  beside however the run ended; see "Counting".
- **The bench has no hint button.** `takeHint` is in `useHunt`, but a play-test measures how
  hard a day is unaided.

### Giving up

Every estimate in `difficulty.ts` is a **median**, so by construction a large slice of
players are well past it on any given day, and the back half of the week is where that
slice is largest. For a long time the game's only answer to those players was a blank
screen: close the tab, and the day ends with no answer, no result and no record that you
played at all. That is the single most likely way a streak ends for good, and it is the
one outcome that teaches a player nothing -- the whole skill this game trains is a way of
scanning a painting, and you cannot learn it from a puzzle you never saw the answer to.

So there is a deliberate way out. It stops the clock, frames the shape in the middle of
the board at a little **under** the size a match needs, and closes the day out as played.
The framing is `reveal()` in `useHunt.ts` and is deliberately on the zoomed-*out* side of
the match: from there every zoom-out leads away from the match and towards the whole
canvas, which is where somebody who has just been shown the answer is trying to get to.
Landing on the match, or past it, would trip the solve on the way.

**The streak ends.** A give-up counts towards `played` and never towards `best`, and it
breaks the streak on the day it happened. The alternative was considered and is worse: a
give-up that kept the streak alive would be strictly better than not playing at all, which
is exactly the wrong thing to reward. The share text says plainly that it was not found
and carries no speed bar and no Find Me Age -- both of those say how well a hunt went, and
a hunt that ended in being shown the answer did not go well. Dressing it as a score is the
one thing this must not do. It may carry the hunt trace (see "The hunt trace"), ending in
🏳️ rather than 🟩, because a trace says how the looking went and not how well.

**The wait before it opens** is 1.5x the day's own `expectedSearchMs`, floored at
forty-five seconds and capped at three minutes (`giveUpAfterMs` in `age.ts`). A multiple
rather than a fixed number because the ramp already knows how hard each day is. The floor
because the multiple alone is nonsense at the gentle end -- a Monday priced at a few
seconds of searching would open its exit eleven seconds in, before somebody who had
merely opened the page had finished looking at the painting, and a Monday give-up rate
built out of glances would mean nothing. The cap because past about three minutes the
wait stops protecting the puzzle and becomes the thing the player quits over, which is
the failure it exists to prevent arrived at by a longer road.

The button is **visible from the moment the clock starts** and merely shut until then --
not hidden and then produced half way through a run. A control nobody knows is coming
cannot reassure the player it exists for, who is deciding whether to close the tab. And
pressing it early is not a mis-tap: it is somebody saying they are stuck, which is worth
hearing, so it answers rather than doing nothing. What comes back is deliberately vague
about how much longer -- a countdown turns the wait into the thing being watched, and a
player watching a number is not looking at the painting.

**The wait is known to run long, and is deliberately not corrected.** The first look at
real play against the ramp -- a dozen shipped days, every one of them with a finish rate
above ninety per cent, so the medians are not missing the slow half -- came in at a median
of about a third of what `expectedSearchMs` predicts. The gate inherits that, so it opens
later than the 1.5x it claims to.

The obvious fix is a calibration constant on the gate, and it was rejected. It would give
the ramp and the gate two different beliefs about how long a day takes while `age.ts` went
on using the uncorrected one, and a difficulty number that disagrees with itself in two
places is the failure this file already records twice. If the curve runs long, the curve is
what is wrong, and refitting it means refitting the age with it -- on far more than a dozen
days of a handful of runs each, mostly from people who play every day and are quicker than
the players the number is meant to describe.

So the gate is left approximate on purpose, erring late. Late is the safer error: the risk
worth avoiding is a way out so easy to reach that it eats into the solve rate. What settles
it is not more solve medians but the `stuck` readings below, which measure the wanted thing
directly.

That early press is also the best difficulty reading the tally has ever had. A `left`
beacon is ambiguous: a phone call, a back-swipe, a flat battery. A give-up is
unambiguous but only ever heard from the players who stopped. The early press -- `stuck`
in `count.ts`, recorded on the run row beside whatever the run goes on to become -- is
heard from the players who carried on and **found** it too. Per-day give-up and stuck
rates arrive for every player, rather than for the handful a testbed round can reach.

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

The shape's edges are softened by half an image pixel, which is a scanning-view lever:
among specks a few pixels across, a hard vector edge is itself a tell, and every day in
the file is tuned with that softening in place. The filter lives inside the zoom, though,
so the radius was growing with every pinch — by the winning framing the painting is drawn
five to ten times its native resolution and half an image pixel had become a smear several
screen pixels wide. The player was being asked to match a smudge against a badge that is a
crisp vector. `--stage-zoom` (`src/index.css`, set by `Stage`) divides the zoom back out,
which holds the softening at exactly the radius it has when the whole painting is on
screen: the fitted reading every day was solved against is untouched — measured, not
assumed — and the shape sharpens as the player closes in, reading `found` about 30% higher
at the match. Anything that drives the canvas transform by hand, which is all the browser
tools in `scripts/`, has to set `--stage-zoom` alongside it or it is looking at a blur no
player ever sees.

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
| `src/game/puzzles.ts` | Ten weeks of seven days — image, hiding place, size, angle |
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

### `?test`

Practice mode forces a puzzle and then writes *nothing* — no result, no streak, no
tally. That makes it the wrong tool for a change to the parts of the game that only
exist because something is written: the streak, the result card, resuming a run that was
left mid-hunt, the beacons. `?test` is for those. It plays **today's real puzzle** at
today's real difficulty and records everything, against a store and a tally row that are
not real:

| | real run | `?test` |
| --- | --- | --- |
| results | `find-me:v1` | `find-me:test` |
| cookie mirror | `fm-results` | `fm-test` |
| tally row | counted | written with `dry: true`, excluded by every reader |

Three things are worth knowing about it.

**It lasts exactly as long as the URL says so.** Going to the plain address is the real
game, always — there is no flag to clear and no state to remember. The first version of
this did keep a `sessionStorage` flag, on the theory that a reload which dropped the
parameter would silently put a half-finished test run back on the real store. That theory
was wrong twice over. The only reload the app performs itself is the update notice's
`location.reload()`, which keeps the query string; and `sessionStorage` survives every
navigation within a tab *and* is handed back by session restore, so quitting the browser
and reopening it would return you to test mode without your having asked for it a second
time. Predictable beat sticky. A banner still says which mode you are in on every render,
because the two look identical otherwise.

The cost is real and worth stating: leave a test run mid-hunt and come back to the plain
address, and you are in the real game. The banked test run is still in `find-me:test`,
untouched and unreachable until you ask for `?test` again — so nothing is lost, but the
run is not resumed either. That is the right way round. A mode that quietly resumed as
*test* on the real address would be the failure this arrangement exists to prevent.

**The tally row is written, not suppressed.** Suppressing it would mean the beacon path
is the one path a test run cannot check. Writing it flagged means the path is exercised
and the row is excluded at read time — and, importantly, before the rollup can fold it
into a day summary, which is a thing that cannot be undone by deleting the row
afterwards. This is the same `dry` flag the play-test bench puts on a review it does not
want counted, for the same stated reason: *a row that says it is a dry run can be
excluded, and a row that was never written cannot be reasoned about.*

**There is still no user id.** A run is keyed by the random per-run id it always was,
minted when the clock starts and forgotten when the run ends. `dry` is a property of the
row, not of a person — nothing here identifies who sent it, and nothing outlives the run.
That property is the whole design of `count.ts` and was not worth trading away for a
convenience.

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
Screenshots land in `.scratch/shots`.

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

   `.source-images/` is **staging, not a library**: it holds the scan of the painting
   being added, and nothing else. Once step 1 has produced the asset the scan has no
   further reader in this repo, so it is deleted; the seed's `source` field records the
   Commons file page it came from, and everything a browser tool renders goes to
   `.scratch/`, which the tools default to. The folder had reached 1.4GB — week sheets,
   diag frames, badge screenshots, scans of paintings already rejected — for files used
   exactly once each.

   **Record the scan, don't keep it.** `source` names the file page and `SOURCE_SCANS` in
   `assets.test.ts` names its pixel size; the test derives the asset's height from that
   size and fails if they disagree. That pairing is what makes deleting the scan safe,
   because the address alone does not identify a scan — most of these paintings have
   several on Commons at different crops. `mona` had a 6441px Louvre scan sitting in
   `.source-images/` as an upgrade over the 2835px one it actually shipped from, a
   visibly different crop; running `npm run images -- mona` on it would have moved all
   seven of that week's hiding places, and nothing in the repo would have said so.
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

Each result is stored with two fingerprints of the puzzle it was set on. The `version`
covers everything the player contends with -- id, shape, position, size, angle, fill,
opacity, blend and cover. The `spot` covers the hunt alone -- id, shape, position, size
and angle -- and none of the paint.

Only the `spot` decides whether the day is handed back. Move the shape, resize it, turn
it or swap it for another, and the day opens playable again: that is a hunt this player
has not taken, and showing them a finished board would cost them a puzzle. Re-solve the
day's opacity or fill and the day stays finished, because the shape is exactly where they
found it -- the card says the puzzle changed and offers the new one as a practice run,
which is not recorded. Editing a title or an artist line trips neither, since it does not
change what the player has to do.

It used to be the `version` alone, and that was one fingerprint doing two jobs. Re-tuning
a day is a routine thing to do to a day nobody has played yet -- and it moves the version
of every day in that week's file, including the ones people finished that morning. Anyone
with the old build still open got a fresh clock on a painting they had just solved, with
nothing on screen to say why, and `record` then let the second run supersede the first. It
cost a real 34.7s solve, replaced by a 6.7s re-solve of a crown the player already knew
the location of. A recorded time exists in exactly one place -- that browser's
`localStorage` -- so there was nothing to put it back from. See [`?restore`](#restore) for
the door that had to be built, and keep it shut.

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

### `?restore`

`/?restore=<puzzle>:<ms>:<version>` writes one result back onto the browser that opened
it, and reports what it replaced. `/?restore=18:34676:16xku87` puts 34.676s back on
puzzle #18 as a solve of the version named; a trailing `:g` restores a day that was given
up on instead.

It exists because there is nowhere else the repair could happen. A result lives in that
player's own `localStorage` and nowhere else -- the daily tally is keyed by a run id
minted when a run starts and forgotten when it ends, so no server holds anyone's day to
correct -- and the browser that lost the time is a phone, which has no console in it.
Desktop devtools can fix this in ten seconds; the people it happens to are not on a
desktop. So it is a link you send them.

A time gets lost in the first place because `record` keeps the first result of a given
version but lets a *newer* version supersede it: that is what hands a re-tuned day back
as playable, and it is also what lets a replay of that day overwrite the time really set
on the old one. `restoreResult` is the only write that ignores those rules, and it is
reached from here and nowhere else.

It is not a hole in anything. A result only ever moves the board, streak and best of the
browser it is written on; the tally cannot see it, and neither can the calendar or anyone
else's game. Someone who wanted to lie to themselves about their own stats could already
do it with devtools, on any browser that has them.

Two things it deliberately cannot do. It cannot forge a puzzle: the version is written
exactly as given, so a wrong one leaves the day playable rather than passing an invented
time off as a solve of the current puzzle. And it cannot overwrite quietly: the page
always says what was there before, so a link sent to the wrong person, or carrying the
wrong day, shows up the moment it is opened. It also reads the result back afterwards and
says whether the browser kept it, since a browser that keeps nothing is exactly the one a
player in this position tends to be on -- `?diag` above is the rest of that answer.

The number in the link is the **puzzle number**, the `#18` off the player's own share
text, not the day index it is stored under. Converting it is `dayOfNumber` in `daily.ts`,
next to `puzzleNumber`, so the offset is in one place rather than in whoever writes the
link.

## Deployment

Pushing to `main` runs lint, tests and a build, then publishes `dist/` to GitHub Pages.
The site is served from the custom domain in `public/CNAME`, at the root rather than a
subpath, so `base` in `vite.config.ts` stays `/` and `SITE_URL` in `src/game/share.ts`
has to match the domain.

## Counting

The site keeps an anonymous tally: how many runs are started each day, how many are
solved, how many end in a give-up, how many simply walk away, how long each of those
took, how far into a hunt somebody first reached for the way out, and how far in they took
a hint. One row per run, keyed by a random id the page mints when
the clock starts and forgets when the run ends -- no account, no cookie, and nothing that
outlives a single run, so the rows cannot be grouped by person even in principle. Practice
runs are never counted.

`What's counted` in the how-to panel says as much to the player, and switches it off.
Switching it off also stops the reads below: a player who has asked not to be counted is
not asking the server anything either, so they go without everyone else's numbers, and
the note tells them so.

It also records, as a flag on a run it already has, whether the share button was pressed
-- the clearest sign the result card is worth reading, and so the thing to watch when the
card changes. A share never creates a run and never counts as a play.

Taking the hint is recorded once per run, with the run clock at that moment, beside
whatever the run goes on to become -- so a day can say how many people took a hint, how
far in, and how many of them then found the shape. Like the other flags it never counts
as a play.

Opening the stats panel is recorded once per page load. With a run on record it is a flag
on that run, so it can be read against the run's own time -- is the panel reached for more
after a slow day than a fast one. Without one -- opened before the clock starts, or on a
board reopened after a reload -- it is counted on its own, as that page load's random id
and the day, and never as a play. It used to be dropped in those cases, and since that is
where most opens happen the count read zero while players were sharing pictures of the
panel. Nothing that would join one run or page load to the next is kept.

The tally is read back in two places. The result card, once a run is over, says what
share of the day's runs found the shape and the median find time. The stats panel sets
each weekday of the player's own history beside everyone's median on the same days --
only ever days the player has already finished, asked for together in one read. Never before or
during a hunt -- a solve rate on screen is a difficulty hint, and would leak into the
times the ramp is tuned against -- and never on a practice run. It is aggregates only,
computed on a schedule and served from cache, and a day with fewer than `TALLY_FLOOR`
solves says nothing: a median of a handful is noise, and a median of one is somebody's
time. The floor is 5 while the game is in beta so the line can be seen at all; it
should rise towards 30 as there are players to fill it. It is not yet in the share text,
and should not be until the numbers have been watched for a while.

The client half is `src/game/count.ts`, and it posts to whatever `VITE_COUNT_URL` the
build was given, and reads from the same address. Everything on the other end of that URL -- where the rows go, and how to
read them -- is deliberately not in this repository.

A hide from a friend (below) is counted as a *feature* and never as a puzzle. Five
counters say whether anybody uses the thing at all: the maker was opened, a hide was
shared, a hide was opened, one was found, and a finder shared their result back. That is
the whole of it -- a hide row carries no day, no painting, no shape and no position, so
nothing here can say which hide it was, and none of it can ever count as a play. The first
two come from the setter and the last three from whoever they sent the link to, so the
step that matters is the one between them: whether the links get opened. Each is written
once per page load, keyed by a random id minted on that load and never kept, which is why
a double-tap on share is one share and why nothing joins the two ends of a hide together.
`countHide` in `src/game/count.ts` is all of it, and it is switched off by the same opt-out
as everything else.

## Hide one for a friend

A player picks a painting, taps where a shape goes, sets its colour, size, angle and
strength, and gets a link. Whoever opens the link hunts for that shape with the same
`useHunt` the daily game runs on. The links it makes point at the real site and play for
anyone.

The way in is the puzzle piece in the top bar, and it appears **only once the day's own
puzzle is over** -- solved or given up on. Before that it would be a door out of a hunt in
progress, and the maker's painting list is every week the calendar has reached, which is a
thing a player in the middle of today's hunt has no business reading. The address is
`?hide` and works on its own; `?test&hide` is the same thing inside test mode.

- **The link is the puzzle.** `src/game/hide.ts` packs the hide into base64 in the URL
  fragment (`#h=`), which is never sent to the host or a referrer. It is not secret, only
  not readable at a glance. A link from a newer build, a cut-short one, or one naming a
  painting this page does not know gets a friendly card rather than a broken board.
- **A name is optional.** The setter can give a hide a name of up to 50 characters behind
  the **✎ Name** button on the painting row, folded away so the controls are no taller for
  those who skip it. It replaces the painting's title in the friend's top bar, their result
  card and the line they share back, and in the setter's share text; the alt text keeps
  the painting's. Only a named hide is packed as layout 2 -- layout 1 with the name on the
  end -- so an unnamed link is byte for byte what it was and still opens on a page cached
  from before names, while a named one sent to such a page is told it came from a newer
  version rather than that it was cut short. The name is cleaned (control characters out,
  space collapsed, trimmed, held to the length) both when it is packed and when a link is
  opened, and no fingerprint reads it: naming a hide cannot change the hunt.
- **Only paintings already served.** The painting list is every week the calendar has
  reached, worked out the way `daily.ts` maps it, so the maker cannot show a painting
  early.
- **No tuner behind it.** Size is held to `HIDE_SIZE`, and strength never goes under
  `HIDE_OPACITY.min` (0.7). On top of that, the maker measures the paint under the shape
  and asks for a minimum contrast (`HIDE_CONTRAST`): an absolute floor, raised on busy
  paint. It is judged against the paint under the shape itself, pixel by pixel, and at
  least half the shape has to clear it (`HIDE_CONTRAST.share`); texture is taken between
  neighboring pixels. The first cut judged against the average of the square round the
  shape: where a pale patch met dark paint that average was a middling color under
  neither, so a cream shape laid on the pale passed while a gold one, far easier to see,
  was refused -- and the spread about that average called a clean edge busy. The
  difference is taken in CIE Lab with hue counting for half, because in
  textured paint a shape is picked out by being lighter or darker -- the first cut
  measured plain RGB with a 0.45 floor, and a gold shape on yellow paint passed it while
  being all but invisible. A color that cannot clear the floor even at full strength
  cannot be shared. The floor marks *impossible*, not *easy*: a first setting that asked
  for a comfortably visible shape blocked hides that were only hard, and hard is allowed. Until the setter chooses a color, the shape takes the paint's own
  color there, pushed lighter or darker just far enough to clear it; **Auto** in the
  color row goes back to that after a color has been picked. The numbers were
  set by eye on the served paintings, not measured against play. A link is held to the
  size and opacity limits when it is opened; the contrast rule needs the painting's
  pixels, so it lives in the maker.
- **Nothing recorded; the feature is counted, the hide is not.** A friend hunt never
  touches `find-me:v1`, the backup cookie or a streak, and `hide.test.ts` fails the build
  if the hide files import any of them. The five counters under "Counting" above are the
  one exception, and they are the reason the test now checks *what* is imported from the
  tally rather than banning it outright: `countHide` and nothing else, so a later edit that
  reached for `count` -- which would write a row keyed to a puzzle day, the one thing a
  hide is not -- fails there.
- **Sharing back sends the hide, not the front door.** The result card at the end of a
  friend hunt shares the link that was opened, so the person who was sent a hide can pass
  the same hunt on rather than a link to today's puzzle.

## Play-testing

Every difficulty lever in this game was set by measurement, and measurement can only say
what a day *is*, never how it *felt*. The gap between the two is where the mistakes in
this README came from -- `size` and `company` were both plausible difficulty levers that
measured beautifully and did nothing, and the fitted-view reading called a Rousseau sky
subtle right up until somebody looked at it.

Asking people is the only thing that closes that gap, and the rotation is the wrong place
to ask. Re-tuning a shipped week to try an idea takes a recorded day back off everybody
who set a time on it, and anybody willing to be asked has already played the game and
knows where the shapes are.

So there is a bench: three paintings in `src/game/testbed.ts` that are generated, planned
and tuned exactly like a shipped week and will never be served as anybody's daily puzzle.
Bruegel's *Netherlandish Proverbs* for maximum cover, van Gogh's *Terrace of a Café at
Night* for brushwork with almost no quiet paint in it, and Holbein's *The Ambassadors* for
smooth glaze that only just offers somewhere to hide. They fail in three different
directions on purpose, because a change that helps one kind of canvas routinely hurts
another -- van Eyck's *Arnolfini Portrait* was sourced for the third slot and rated too
smooth to hold a week at all, which is on the rejected list with its numbers.

All three are on the `add-painting` skill's rejected list with reason `testbed`, and
`testbed.test.ts` fails the build if one goes missing from it. A painting people have been
asked to play repeatedly, at difficulties that were deliberately being got wrong, is spent.

### Rounds

The unit is a round, not "the bench": one question, a handful of bench days chosen to
answer it, and the fortnight it is being asked in. `/?beta` always serves whichever
round is open today, so testers keep one link and the next round is one object added to
`src/game/rounds.ts`.

That shape was chosen over a fixed set because what needs testing changes. If the end of
the week feels too hard, the round is three paintings' Saturdays with their Fridays beside
them as a control. If one *kind* of painting feels rough, it is all seven days of that one
canvas. Keep a round under about twelve hunts: a long one gets abandoned partway, and the
part that gets abandoned is the hard end, which is the part being asked about.

After each hunt a tester answers two questions, in two taps, with nothing to type. **How
hard**, one to five, is the ramp. **Was it fair** is whether the day is a puzzle at all --
a shape tuned down until it is invisible and a shape sitting in the one patch of flat sky
both take a long time, and only one of them is a good day. A single rating cannot tell
those apart, and that distinction is what most of this game's past mistakes turn out to
have been. **Giving up** is a first-class answer with a button of its own: how long
somebody hunted before deciding it was hopeless is the clearest signal a day is wrong, and
a tester with no way out of a hunt abandons the round rather than the puzzle.

Answers post one at a time, as they are given, rather than on a submit at the end -- for
the same reason rounds are kept short. Each row carries the deploy that served it, so two
rounds' answers can be compared across a change.

### What the bench cannot do

Three things, all structural rather than remembered:

- **It is not on the calendar.** `daily.ts` indexes dates into `PUZZLES`, and the bench is
  not in `PUZZLES`. `testbed.test.ts` walks 1200 real dates to prove no date reaches it.
  Bench days are served only by asking for one by name, and come back with a negative day
  index that could not be mistaken for a real one.
- **It cannot touch a player's record.** The bench writes to `find-me:testbed:v1` and
  nothing else; the game's `find-me:v1` holds the streak, the times and the banked run.
  `testbedStore.test.ts` asserts that from both sides, and `smoke-testbed.mjs` walks a
  whole round in a real browser at phone size checking the game's key is absent at the
  start, the middle and the end.
- **It is not in the tally.** A round posts review rows, never run beacons, so six hunts
  by one tester never read as six players.

The hunt itself is deliberately *not* separate. Both the game and the bench run on
`useHunt`, down to the gestures and the solve, because an opinion collected on a slightly
different game is an opinion about that game.

**A bench week may borrow a painting the rotation has finished with.** Most bench weeks are
paintings the game will never serve. A few are not: they render an asset a shipped week
also uses, under a bench id of their own (`asset` in `testbed.ts`). This is how a candidate
re-plan of a week people complained about gets in front of testers, which is otherwise
impossible — the only weeks worth re-planning are exactly the ones already served.

It rests on one fact and is protected by two mechanisms.

The fact: **the calendar only ever grows.** New weeks are appended and never inserted, and
in practice the list is extended faster than it is consumed, so a played week does not come
round again and is spent. (`daily.ts` does still index modulo the list length, so this is a
statement about how the game is run, not a guarantee the code makes. Do not lean on it for
anything but this.)

The mechanisms:

- **The id, not the asset, is what everything keys on.** `version`, storage, the calendar
  and every recorded result hang off the bench week's own id, so nothing about the shipped
  week can move. The fingerprint diff is the check: 70 shipped days, zero changed.
- **The candidate is kept off every shipped hiding place on that canvas.**
  `plan-weeks.mjs` reads `PUZZLES` at plan time and excludes them at a 320px radius
  (`shippedSpotsOn`). Without it the planner is deterministic on identical pixels and picks
  the same spots — six of seven landed within 70px of a shipped day, two of them exactly
  on one, and one beside a day of the current week that nobody had reached yet. That is two
  failures: a tester re-finding a shape they already know is measuring their memory, and a
  tester shown a day they have not played is simply spoiled. The exclusion is derived at
  plan time rather than listed in `avoid.json` on purpose — this repository is public, and
  a checked-in list of the coordinates being avoided is a checked-in list of where the
  shipped shapes are.

A borrowed week is also exempt from the rejected-list rule, which exists to stop a future
week picking up a painting testers have been walked through. A painting already in
`PUZZLES` cannot be picked up again — `add-painting` screens the rotation itself — and
listing a shipped painting as "rejected" would be a false record.

### Running a round

```bash
npm run plan -- --testbed cafe                    # re-plan a bench week
npm run camouflage -- --testbed --solve cafe      # re-tune it against the browser
npx vite-node scripts/smoke-testbed.mjs                    # walk a round at phone size
npm run fingerprint --silent > before.json        # ...and prove no shipped day moved
```

Add the round to `ROUNDS`, deploy, and hand out `/?beta`. `?beta=<id>&again=1`
re-runs a round on your own device for checking; those rows are marked `dry` and are meant
to be excluded when the answers are read.

### What rounds have found

The record of what has been asked and what came back, including the rounds that changed
nothing. A round that produced no change is worth as much here as one that did: it is the
evidence not to re-litigate the idea, and most of the levers in this README were re-tried
at least once before they were written down.

#### r1-weekend — "Is the end of the week too hard?"

Six hunts: each bench painting's Friday and then its Saturday, so the pair is its own
control. 21 answers from 4 testers, over two deploys — the second changed only the
rotation and left `testbed.ts` and `rounds.ts` untouched, so the bench days were identical
across both and the answers pool. Three of the four finished all six; the fourth gave up
on the first hunt, played two more and stopped there, which is the shape a round is
kept short to avoid.

Median search against what the rung intended (Friday 181s, Saturday 231s):

| puzzle | n | gave up | median search | intended |
|---|---|---|---|---|
| proverbs-fri | 4 | 2 | 6:23 | 181s |
| cafe-fri | 4 | 0 | 27.3s | 181s |
| ambassadors-fri | 3 | 0 | 1:00.5 | 181s |
| proverbs-sat | 4 | 0 | 21.4s | 231s |
| cafe-sat | 3 | 0 | 5:28.9 | 231s |
| ambassadors-sat | 3 | 0 | 9.3s | 231s |

`proverbs-fri` has four answers but two of them are give-ups, so its figure is the
midpoint of two finishers and is an anecdote, not a median.

**The answer to the question asked is no** — and the answer to the question that should
have been asked is more useful. The end of the week is not too hard; it is not reliably
harder *at all*. On two of the three paintings Saturday came out easier than that same
painting's Friday, and `ambassadors-sat` was solved in 9, 11 and 6 seconds against a
target of nearly four minutes.

**No `scan` change is justified by this.** The three paintings do not agree at either
rung, which is the standing test for a ramp problem against a canvas problem. Friday's
answers span 27s to 6:23 and Saturday's span 9s to 5:29 — a 35× spread inside one rung,
against a rung step of 1.3×. The ramp is trying to make a step roughly a thirtieth the
size of the noise it is being made in, so which of two adjacent days comes out harder is
close to a coin flip. Moving Saturday's `scan` would hand back every shipped Saturday and
fix none of it.

Two things fell out of it that the round was not asking about:

**The paint is not the variable; the region is.** `proverbs-fri` and `ambassadors-sat`
were tuned to the same opacity, 0.441. One drew two give-ups and a ten-minute finish, the
other was solved three times in under twelve seconds. Same paint, 40× apart. The tuner
solves every day onto its `scan` target and hits it, and the resulting hunts are 35×
apart, so `scan` is not on its own a prediction of search time.

**Busy paintings do not make hard days; they raise the ceiling on how wrong a day can go.**
Worst hunt on each canvas: proverbs 10:16 with two give-ups, cafe 10:19, ambassadors 2:02.
Every catastrophic outcome in the round — both give-ups, both ten-minute hunts, both
"unfair" flags — landed on the two textured canvases. The smooth one never got past two
minutes whatever the tuner did to it, because there is nowhere on it for a shape to be
genuinely lost. Dense paint can hide a shape completely, and `scan` does not distinguish
"well camouflaged" from "gone"; it also lets a clean geometric shape sit on chaos and pop
instantly, which is how the densest canvas in the set produced both the hardest day and
one of the easiest. So a busy painting is where a hiding place needs the most caution, in
both directions — not where the hardest days should be put.

**Closed 2026-09-07 with 30 answers from 5 testers**, all five finishing all six hunts.
Final medians: `proverbs-fri` 6:27 with three give-ups, `cafe-sat` 5:30 with two,
`ambassadors-sat` 10.6s, `proverbs-sat` 22.2s, `cafe-fri` 21.5s, `ambassadors-fri` 47.1s.
The reading above stands: the rung explains almost none of it and the painting explains
most of it.

**What it was actually measuring, found afterwards.** The two paragraphs above stop one
step short. "Busy paintings raise the ceiling on how wrong a day can go" is the right
observation with the wrong conclusion attached — the answer is not to be careful where
hiding places go on a busy canvas, it is that busyness is a *measurable difficulty term
the ramp did not have*. Pooling these six answers with eleven shipped days from the daily
tally made that testable, and it is not close: `scan` predicts observed time at a rank
correlation of −0.14, canvas busyness at +0.70. See
[Busyness](#busyness-what-the-ramp-was-missing).

Done in response, all on the bench, no shipped fingerprint moved:

- `clutter` and `dim` added to the ramp, and the tuner pointed at `scanForTime` instead of
  a flat per-rung target.
- All three bench weeks **re-tuned, deliberately not re-planned**. Re-planning would have
  moved every hiding place and thrown away the only before-and-after this round bought:
  four of these six days are the same spot and the same shape, repainted against the new
  target. The paint is the change being tested, so the paint is the only thing that moved.
- Round `r2-busyness` opened instead on **two hunts**: the Monday of the busiest painting
  the rotation has served and the Monday of a calm one, both re-planned from scratch under
  the new term. One rung, two canvases nine times apart, and nothing else varying — the
  narrowest form of the question this round raised and could not answer.

**`r2-busyness`, first three testers.** Both Mondays, no give-ups, nothing flagged unfair
— where in `r1` every give-up and both unfair flags had landed on the textured canvases.

| canvas | before | after | distance from the 45s Monday asks for |
|---|---|---|---|
| busy | 200.6s | **75.6s** | 4.5× over → 1.7× over |
| calm | 22.0s | 20.3s | 2.0× under → 2.2× under |

The gap between two Mondays on the same rung went from **9.1× to 3.7×**. On that the term
was rolled forward — see below. Three answers a day, so the medians are thin.

**The lever is weaker than the curve says, and on a calm canvas it may not work at all.**
Measuring what the `scan` change actually bought on each of the two days:

| canvas | scan | predicted | actual | implied slope |
|---|---|---|---|---|
| busy | 0.490 → 0.605 | 49s | 76s | 8.5 |
| calm | 0.481 → 0.415 | 49s | 20s | −1.2 |

`SCAN_CURVE.slope` is 12.2. On the busy canvas the lever works and the curve overstates it.
On the calm canvas a substantial move in the target produced *nothing* — 20.3s against 22.0s
before, marginally the wrong way. That is the same wall as "paint alone cannot make a hard
day on a calm painting", showing up in play rather than in the clamp. Confounded by a
re-planned hiding place, `sizeScale 0.73` and n=3, so it is a flag, not a finding.

**What was rolled out, and what was held.** The correction is two opposite changes, and only
one of them is supported. Weeks busier than the reference get a bolder shape and become
easier; calmer ones get a fainter shape and become harder. `starry` Tuesday to Sunday,
`jatte`, `hunters` and `deheem` were re-tuned — 26 days, all in the easier direction, which
is also the safer way to be wrong. `boating`, `issus` and `venice` were held: rolling out to
them means making them 1.6× to 2.2× harder (one `venice` day 4×) with a lever that had just
failed to move a calm canvas. `babel` was held as near-neutral. `mona` and `wave` are served
and off limits.

`starry`'s Monday was **not** re-tuned. It had already been played, and moving a served day
hands it back to everyone who set a time on it. The cost is that its Monday is now harder
than its Tuesday; `MONDAY_LEFT_AS_SERVED` in `week.test.ts` names it and asserts the ramp
from Tuesday. It is the served day that is out of line, so every day still ahead of a player
climbs properly.

Two tests moved with it. The week ramp is now asserted on the **time** each day is priced at
rather than on `scan`: those used to be the same statement, and since the ramp gained a
dimness term the same reading buys a different hunt on dark paint than on light, so a week
can climb correctly in time while its scan numbers wander. Two shipped weeks do exactly
that, and asserting the proxy would have failed them for being right. And `BEFORE_BUSYNESS`
in `age.test.ts` lost the three weeks that have been corrected — they are held to the band
like anything new now.

Still open, and named rather than fixed:

- The bench is planned by older tooling than the rotation it stands in for. Re-planning it
  is still worth doing, but not while it is the control for `r2-busyness`.
- `cafe-sat` is the new model's worst miss — priced at 92 seconds, played at 330 — and is
  deliberately left out of `r2-busyness`, because the correction would push a day that is
  already too hard harder still. Whatever makes that hiding place hard is not on the
  canvas-level reading.
- **Does the scan lever move a calm canvas at all?** The one measurement says no, and three
  weeks are waiting on the answer. This is the next round to run, and it is a cheap one: one
  calm painting, one rung, the same hiding place tuned to two targets a long way apart. If
  the times come out the same, `scan` is not the lever on a calm canvas and no amount of
  re-tuning `boating`, `issus` or `venice` will make them harder — `sizeScale` would be.

Not proposed: any change to `difficulty.ts`. Adjacent rungs are not separable in this data,
and a within-rung spread this large is a placement finding, not a ramp finding.

### What to ask next

A round costs a fortnight and half a dozen people's goodwill, so the question is chosen
before the slice, never the other way round. Three things make a question worth a round:
the game cannot answer it by measuring, the answer would change something specific, and a
handful of people can move it — a question needing thirty testers to settle is not a
question this bench can ask.

The standing list, roughly in the order they are worth asking.

#### Does one `scan` number produce one difficulty?

The most valuable thing to ask next, because most of the ramp rests on the assumption that
it does. `r1-weekend` found two days tuned to the same opacity coming out 40× apart and a
35× spread inside a single rung, which says the tuner hits its target and the target does
not predict the hunt. That was a side finding from a round asking something else. This
would ask it directly.

**Partly answered since, and worth less than it was.** Pooling that round with the daily
tally showed most of the fan is *between* paintings and is explained by
[busyness](#busyness-what-the-ramp-was-missing), which is now a term in the ramp — so the
interesting version of this question is the one this slice was already designed for: four
hiding places on **one** canvas, where clutter is held constant by construction. What is
left over there is the residual the new term cannot explain, and two bench days say it is
still large. Ask it after `r2-busyness` reports, not instead of it.

**The slice:** one painting, one rung, four hiding places, each tuned to the same `scan`.
Four hunts is a short round, which is what allows the same painting four times over.

**What it reads is the spread, not the median.** The whole outcome is whether four days
the tuner calls identical produce four similar hunts or a 30× fan. That is a different
statistic from every other round, and it needs enough testers that a fan is distinguishable
from noise — six or more, so each day has six answers rather than three. Under about five
testers this round cannot answer its own question and should not be run.

**Pick the rung for headroom, not for interest.** Thursday or Friday: far enough up the
ramp that a day can come out much easier and still be measured, and not so far that a
tester quits before the round finishes. A Monday round cannot show a day that is too easy,
because there is no room underneath it.

Two design problems have to be solved first, and neither is optional:

- **Shape and location are confounded.** Varying both at once, four days give four
  answers to two questions and cannot separate them. If the fan turns out to be real, the
  follow-up splits it: four locations with one shape, then four shapes in one location.
  Doing the combined version first is still right — it is the cheapest way to find out
  whether there is a fan at all — but it must be written down as a first pass, or its
  result gets quoted later as evidence about shapes.
- **The same painting four times teaches the painting.** By the fourth hunt a tester knows
  its rhythm, and a fixed serving order bakes that straight into the comparison: the day
  served last would look easiest whatever it is. `rounds.ts` serves `days` in a fixed order
  to everybody, so this round needs a per-tester permutation first. It cannot be random —
  `determinism.test.ts` allows `Math.random` in `count.ts` and nowhere else — but it does
  not need to be: the tester id is already a random value minted once, so indexing it into
  a table of permutations gives a different order per tester with no new randomness. Rows
  carry their own timestamps, so the order a tester actually saw is recoverable afterwards
  either way, and the learning effect can be measured rather than only feared.

#### Does the ramp have any resolution at all?

`r1-weekend` showed adjacent rungs are not separable — Friday and Saturday differ by a
step roughly a thirtieth of the noise around it. That is not the same as the ramp doing
nothing. Serve one painting's Monday against its Sunday, skipping everything between: the
widest step the ramp can make. If those separate cleanly the ramp works and is simply
finer-grained than it can measure, which argues for fewer, wider rungs. If they do not
separate, the ramp is not what is making days hard and something else is, which is a much
larger finding and worth knowing before another lever is added to `difficulty.ts`.

#### What does "unfair" actually mean to a tester?

The fair question is the one distinction this game's past mistakes turn on, and it has so
far collected two flags total. Both landed on textured canvases and both on very long
hunts, which is consistent with "unfair" meaning nothing more than "too long". If that is
all it means, the second question is redundant and the round is buying one number for the
price of two. A round of deliberately broken days — one tuned to near-invisible, one
placed in genuinely flat paint, both slow for different reasons — would say whether
testers separate them the way the game assumes they do.

#### Does a day off its texture rung play differently?

Texture is currently outranked by the colour-variety caps: a day off its texture rung is
still solved onto its `scan` target and shipped. That is a deliberate trade recorded in
"Variety inside a week", and it has never been checked against a player. A round pairing
days on their texture rung against days well off it, all at the same `scan`, would say
whether the trade costs anything or is free.

#### Is difficulty the same on a phone?

Nothing in a review row says what it was played on, so this cannot be read out of the
answers already collected — it needs a field before it needs a round. Worth adding to the
row now so that the question is answerable later, since the cost is one field and the
alternative is discovering the confound after a round that was about something else.

Not worth asking, and here so they are not re-proposed: anything about `size`, `company`
or asset resolution as difficulty levers. All three measured well, were compensated
straight back out by the tuner, and are recorded above as mistakes. A round cannot rescue
a lever the tuner erases.

## Credits

All paintings are in the public domain, sourced from Wikimedia Commons. The `i` button in
the top bar credits every one of them by title, painter and year; the `year` field lives
beside `title` and `artist` on each week seed in `src/game/puzzles.ts`.
