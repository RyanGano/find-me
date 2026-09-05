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
npm run images               # .source-images/ -> public/puzzles/ at 2600px wide
npm run plan                 # pick every week's hiding places, shapes, angles
npm run plan -- mona         # one painting
npm run rate -- public/puzzles/*.jpg       # can a painting hold a week at all
npm run camouflage           # report every day against its difficulty rung
npm run camouflage -- --solve              # solve each day's paint, rewrite puzzles.ts
npm run preview:week -- mona               # seven rows of three, to look at the ramp
node scripts/diag-camouflage.mjs mona '[{}]' out.jpg   # one hiding place at match zoom
node scripts/diag-size.mjs                 # badge vs shape geometry check
node scripts/diag-badge.mjs               # badge colour vs the shape as painted
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
binary-searches each day's opacity in a real browser against the rung's `scan` target,
then rewrites the day lines in `puzzles.ts` in place. Those lines are machine-written —
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
week of identical badges cannot be fixed later. See "Variety inside a week" in README.md
before touching any of it.

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

`src/App.tsx` wires all of this together and owns the run state machine (blur/pause,
clock, resume, solve, result card).

## Working in this repo

- Practice runs, for testing: `?puzzle=starry-wed` or `?day=3`. They are not recorded and
  do not affect a streak.
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
  the browser has solved it goes in `scripts/avoid.json` — that is what it is for.
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
