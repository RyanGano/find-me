# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Secrets and paths

Nothing about where the tally is stored, how to reach it, or any endpoint, host, database
or path may ever be checked in. The `/local` folder is gitignored and everything in it —
including its own README, `local/api` and `local/stats` — is secret: never copy its
contents into tracked files, and never mention it, or anything learned from it, in a
commit message, PR body, code comment or test fixture. The tally endpoint reaches the
build only through the `VITE_COUNT_URL` env var, supplied by a repository variable in CI.
`src/game/count.ts` reads it and does nothing when it is empty.

## Never write down where a shape hides

The game is the fun of finding it, and this repository is public. No tracked file — this
one, README.md, a skill, a code comment, a commit message, a PR body, a test fixture —
may ever say **where** a shipped day hides, or give anything a player could narrow the
search with: the object a shape sits on, the region of the canvas, "the only red thing in
the picture", or a table of per-day measurements that is the same hint in numbers.

Describe a failure by what went wrong, not by where. Where a concrete example genuinely
cannot be dropped, use a painting that was rejected and never shipped (see
`.claude/skills/add-painting/rejected.json`) or a bench painting from `testbed.ts`, which
will never be in the rotation. Weeks already served are **not** an exception: the calendar
indexes `PUZZLES` modulo its length, so every week comes round again.

Specifics belong in the tools, which print and draw exactly where everything is and write
to the gitignored `.scratch/`: `npm run plan`, `npm run camouflage`, `npm run preview:week`,
`scripts/diag-camouflage.mjs`. The person who asks for a week should still be able to play
it.

## Which weeks may be changed

A change to how hiding places are chosen applies to **future weeks only** — every week a
player will meet *after* the current calendar week ends. The current week and every week
already served are off limits, because re-planning a week moves every hiding place in it,
changes each day's `version`, and hands a finished board back as playable to everyone who
has already played it.

The boundary is the week containing today, not today itself: finish out the current
Monday-to-Sunday painting untouched and start from the next Monday's. `daily.ts` maps the
calendar onto `PUZZLES` in blocks of seven, so the current week index is
`Math.floor((dayIndex(now) + weekday(EPOCH)) / 7)` and everything after it is fair game.
Work it out rather than assuming — do not guess from the array order.

When a rule is added that older weeks cannot meet, exempt them by name in a list of
*exemptions* (as `BEFORE_PROMINENCE` in `variety.test.ts` does) rather than listing the
weeks held to it, so that a painting added later is caught by default.

## Commands

```bash
npm install
npm run dev                  # vite dev server
npm test                     # vitest run (unit tests)
npm run test:watch
npm test -- src/game/week.test.ts          # a single file
npm test -- -t "name of the test"          # a single test by name
npm run lint                 # oxlint
npm run build                # tsc -b + vite build into dist/
```

Content tooling (all drive a real browser or sharp, and rewrite source):

```bash
npm run images -- venice     # .source-images/ -> public/puzzles/ at 2600px wide (one painting)
npm run images               # ...all of them; only safe if every source scan is the shipped one
npm run plan                 # pick every week's hiding places, shapes, angles
npm run plan -- mona         # one painting
npm run rate -- public/puzzles/*.jpg       # can a painting hold a week at all
npm run camouflage           # report every day against its difficulty rung
npm run camouflage -- --solve              # solve each day's paint, rewrite puzzles.ts
npm run preview:week -- mona               # seven rows of three, to look at the ramp
node scripts/diag-camouflage.mjs mona '[{}]' out.jpg   # one hiding place at match zoom
node scripts/diag-size.mjs                 # badge vs shape geometry check
node scripts/diag-badge.mjs               # badge colour vs the shape as painted
npm run fingerprint --silent              # every shipped puzzle as JSON, to diff across a change
npm run rungs                             # the ramp, and what each rung costs on a calm vs busy canvas
npm run busyness                          # measure every painting's clutter and every day's dimness
npm run busyness -- --write               # ...and write them into the puzzle files
npm run preview:shapes                    # every shape, at play sizes, with its share emoji
```

The play-test bench (`src/game/testbed.ts`) is driven by the same tools behind a flag:

```bash
npm run images -- proverbs                 # bench assets are generated the same way
npm run plan -- --testbed cafe
npm run camouflage -- --testbed --solve cafe
node scripts/smoke-testbed.mjs             # walk a whole round at phone size
```

Browser smoke test (Playwright against a real Chrome/Edge, no download):

```bash
npm run build && npx vite preview --port 4173 &
node scripts/smoke.mjs
```

Deployment is CI only: pushing to `main` runs lint, tests and build, then publishes
`dist/` to GitHub Pages.

## Architecture

**One transform is the whole game.** `src/game/transform.ts` maps image space to screen
space (`screen = R(rot) * scale * p + (x, y)`); every input — pinch, twist, wheel, key,
alt-drag — is folded in as a scale/rotation about a pivot plus a pan, composed by
`compose()` and clamped by `constrainPan()`. `src/hooks/useGestures.ts` turns raw
pointer/wheel/Safari-gesture/keyboard events into those deltas. `src/game/match.ts`
compares the resulting transform against the target and produces the single piece of
running feedback (badge amber when near, green on a match).

**Puzzles are data, not painted pixels.** The shapes are never baked into the JPEGs.
`src/game/puzzles.ts` declares, per day, where a shape sits in the generated asset's
pixel space plus size, angle, fill, opacity, blur and blend; the app renders it over the
image layer, so the ground truth *is* the render. `src/game/shapes.ts` holds the paths
and each shape's rotational symmetry, which `match.ts` uses to wrap the angle error.

**Difficulty is measured, not chosen.** One painting runs Monday–Sunday and gets harder
each day. `src/game/difficulty.ts` is the ramp and the authority on what each rung means;
`scripts/plan-weeks.mjs` picks hiding places, and `scripts/tune-camouflage.mjs`
binary-searches each day's opacity in a real browser against the rung's target, then
rewrites the day lines in `puzzles.ts` in place.

A rung is a **time**, not a contrast, and the scan reading that buys that time is not the
same on every painting. `clutter` (how much of a canvas carries detail at the scale of the
shape) and `dim` (how dark the paint is at the hiding place) shift it, via `scanForTime`
-- because a busy or dark painting is already supplying difficulty the rung did not ask
for. Both are measured by `npm run busyness` and written into the puzzle files; neither is
part of a day's `version`. `scanForTime` and `expectedSearchMs` in `age.ts` are exact
inverses and `busyness.test.ts` holds them to it. Read "Busyness" in README.md before
touching any of it: the term existed once, was removed for a circular reason, and the
shipped weeks paid for it. Those lines are machine-written —
one dense line per day; hand edits are fine but must stay on one line.

**A week is seven different things.** `src/game/palette.ts` names the colour of a hiding
place from a closed, deliberately coarse list, and a week must hide in at least four of
them with no colour used more than twice — and a colour reused only in a different texture
of paint. `plan-weeks.mjs` chooses the whole week under those caps (a backtracking search,
not day-by-day greed) and refuses a painting that cannot offer four colours;
`variety.test.ts` holds the shipped file to it. The rule is measured on the **paint**, not
on the badge the player sees, because the tuner rewrites every day's fill and opacity
afterwards and a rule it can move is a rule the planner cannot plan against. Texture is
outranked by this: a day off its texture rung is still solved onto its scan target, and a
week of identical badges cannot be fixed later. Which day gets which of those colours is a
second rule: `MIN_PROMINENCE` in `palette.ts` is a floor per day on how much of the canvas
shares the hiding place's colour, rising from nothing on Monday to 0.6 on Sunday, so the
rare paint is spent on the gentle days and the crowded paint is kept for the days that ask
for a real hunt. It is measured on the paint itself and not on the nine colour names, which
are too coarse for it -- `sand` covers pale cream and dark brown alike. The two weeks that
were already behind the calendar when the rule arrived are exempt and named in
`BEFORE_PROMINENCE` in `variety.test.ts`; the list is of exemptions, not of weeks held to
the rule, so a painting added later is caught by default. See "Variety inside a week" and "Prominence
across a week" in README.md before touching any of it.

**Determinism is a hard constraint.** Which painting, which day, where, how big, what
angle, what colour — all fixed and identical for every player, rolling over at the
player's own local midnight (`src/game/daily.ts`). `determinism.test.ts` fails the build
if `Math.random` or crypto randomness ever appears under `src/`; `daily.test.ts` walks
400 real dates to catch a ramp that has drifted out of step with the calendar;
`week.test.ts` asserts the ramp's rules rather than its numbers; `symmetry.test.ts`
derives each shape's true rotational order from rasterised pixels rather than trusting
the declared number.

**Results are versioned by puzzle definition.** Each `Puzzle` carries a `version`
fingerprint of everything defining the challenge. `src/game/storage.ts` records a result
with the version it was set on, so re-hiding, resizing or recolouring a shape hands the
day back as playable instead of showing a stale finished board — while old times still
count towards played, best and streak. Title/artist edits do not trip it.

**Run shape, not just the clock.** `src/game/metrics.ts` collects how a run was played
(search vs. approach time, near-misses, dither, freezes) as plain numbers so a run
interrupted mid-hunt can be banked to storage and resumed; `src/game/age.ts` scores those
against the day's own difficulty rung to produce the "Find Me Age".

**Counting is anonymous by construction.** `src/game/count.ts` posts at most three
beacons per run keyed by a random id minted when the clock starts and forgotten when the
run ends — no account, no cookie, nothing that outlives a run. It fails silently and is a
no-op without `VITE_COUNT_URL`. Practice runs are never counted.

**One hunt, two callers.** `src/hooks/useHunt.ts` is the run state machine -- blur/pause,
clock, gestures, match, solve, banking -- and knows nothing about storage or reporting; it
calls back at three moments (the clock starting, the solve, the page going away mid-run).
`src/App.tsx` turns those into a recorded result, a streak and a tally beacon.
`src/Testbed.tsx` turns them into a play-test review. Anything that would change how a
hunt plays belongs in the hook, so that the bench and the game cannot drift apart.

**Nothing is tuned on a shipped week.** `src/game/testbed.ts` holds three paintings that
will never be in the rotation, planned and tuned by the same tools; `src/game/rounds.ts`
declares which bench days a round of testers is asked to play and when, and `/?beta`
serves whichever round is open. The bench cannot reach the calendar, a player's storage or
the tally, and `testbed.test.ts`, `testbedStore.test.ts` and `scripts/smoke-testbed.mjs`
each hold one of those. See "Play-testing" in README.md before changing any of it.

`src/App.tsx` wires the daily game together: the calendar, storage, the streak, the result
card and the panels.

## Working in this repo

- Practice runs, for testing: `?puzzle=starry-wed` or `?day=3`. They are not recorded and
  do not affect a streak. `?puzzle=` also serves a bench day (`?puzzle=cafe-fri`), which is
  how the browser tools drive the bench through the real page.
- Changing anything a player already has: `npm run fingerprint --silent > before.json`
  before the change and `diff` after. An empty diff means no recorded time was invalidated
  and no finished board was handed back as playable. Every change that is not meant to move
  the shipped puzzles should produce one.
- Trying out a change on real people: the `start-testbed-round` skill takes it from a
  worry to a live link, and `read-testbed-results` reads what came back against the ramp
  the round was testing. Never re-plan or re-tune the current week or a week already served
  to try an idea -- that takes the day back off everyone who has already played it. The
  bench exists so that is never necessary. Rolling a settled improvement forward into the
  weeks after this one is a different thing and is fine; see "Which weeks may be changed".
- `.source-images/` is staging for the painting currently being added, not a library. Only
  `resize-images.mjs` ever reads it; once the 2600px asset is committed the scan is dead
  weight, so delete it. What replaces it is the record: `source` on each week seed names
  the Commons file page, and `SOURCE_SCANS` in `assets.test.ts` names its pixel size, with
  the test deriving the asset's height from the two so a regeneration off a different crop
  fails the build instead of silently moving a week's hiding places. Everything a browser
  tool renders (week sheets, diag frames, smoke shots) is throwaway: write it to
  `.scratch/`, which is gitignored and is what the tools default to.
- Adding or moving a puzzle: see "Adding a puzzle" in [README.md](README.md). Judge
  camouflage only from `diag-camouflage.mjs` (the real page at the winning framing) or
  `preview:week`, never from a composited preview.
- Adding a whole new painting and its week: the `add-painting` skill walks the screening,
  planning, tuning and verification end to end. Three hard gates, all applied before any
  work is done: the candidate is not in `.claude/skills/add-painting/rejected.json` (every
  painting turned down is recorded there, with why); no nudity, including depicted
  statuary; and it does not repeat the painter or extend a run of the genre at the tail of
  the rotation. New weeks are always appended, never inserted — `daily.ts` indexes the
  calendar into `PUZZLES`, so reordering moves every painting after it.
- Changing where a day hides means re-planning and re-tuning that week, then re-running
  the suite: `npm run plan -- <image>`, `npm run build`, `npx vite preview --port 4173 &`,
  `npm run camouflage -- --solve <image>`. A spot that only reveals itself as unusable once
  the browser has solved it goes in `scripts/avoid.json` — that is what it is for. Look at
  `npm run preview:week` afterwards: re-planning moves the whole week, not only the day you
  meant to move, and a day that lands where the tuner has to run its fill to the extreme
  shows up there as a shape you cannot see even when framed.
- Each week declares a `genre`, and [src/game/curation.test.ts](src/game/curation.test.ts)
  holds the running order to it: no painter twice running, no genre three times running,
  no painter over a third of the rotation. Fix a failure by choosing a different painting,
  not by reordering weeks players have already been served.
- The site is served at the root of the custom domain in `public/CNAME`
  (https://findme.ryangano.com). `base` in [vite.config.ts](vite.config.ts) is `/`, and
  `SITE_URL` in [src/game/share.ts](src/game/share.ts) and the local URLs in the
  `scripts/` browser tools must stay in step with it.
- The README is the long-form record of *why* the numbers are what they are, including
  the approaches that were tried and failed. Read the relevant section before changing a
  difficulty lever, a tolerance, or the feedback rules — most of the obvious ideas have
  already been tried and are documented there as mistakes.
