---
name: read-testbed-results
description: Read what play-testers said about a round, work out what it means against the ramp the game intended, and decide what — if anything — to change. Use when the user asks to "read the testbed results", "what did the testers say", "check the play-test", "did the round tell us anything", or wants to act on a round that has finished. Separates a ramp that is wrong from a day that is broken, refuses to read a sample too small to mean anything, and makes the cost of re-tuning shipped weeks an explicit decision rather than a side effect.
---

# Read a play-testing round

A round produces two numbers per hunt and one bit: how long it took, how hard it felt,
and whether it felt fair. Turning those into a change is the whole job, and most of the
job is refusing to over-read six answers.

Read the **Play-testing** and **Difficulty** sections of `README.md` first. The README is
the record of which levers have already been tried and found not to work; a round that
appears to recommend one of them is almost certainly being over-read.

## Rule 0 — the person asking may have been one of the testers

**Never say where anything is hidden**, on the bench or in the rotation — not
coordinates, not which object, not which quarter of the canvas. If acting on the results
means re-planning a week, run the tools and report that they succeeded; never paste the
planner's placement table. This holds in the commit message too.

Numbers are always safe to report: times, ratings, give-ups, `scan`, `ratio`, texture.

## 1. Get the answers

The reader is outside the repo, with everything else about where rows are kept:

```bash
cd local/stats
node reviews.mjs --rounds        # which rounds have answers
node reviews.mjs                 # the most recent round
node reviews.mjs r1-weekend      # a named one
node reviews.mjs --json          # the rows, for anything the table does not show
```

It prints, per puzzle: how many answered, how many gave up, median run, **median search**,
median difficulty, and how many called it unfair. Then the same by rung across paintings.

## 2. Decide whether it says anything at all

Do this before reading the numbers, not after. It is the step that gets skipped.

- **Fewer than three answers on a puzzle is an anecdote.** Report it as one. Do not
  average two numbers and call it a median.
- **Fewer than three testers is one person's taste**, however many puzzles they did.
- **Check the finish line.** The reader says how many testers answered everything. If most
  stopped partway, the hard end is under-sampled — and the hard end is usually the
  question, so the round may have failed to ask it.
- **Check the deploy line.** Answers spanning more than one build are not automatically
  spoiled — every release changes the stamp — but go and look at what shipped in between
  before pooling them.
- **Ratings are ordinal.** A median of 4 is meaningful; a mean of 3.67 is not. The reader
  gives medians on purpose.

If the round does not clear this, say so plainly and recommend re-running it rather than
squeezing a conclusion out of it. A round is cheap; a ramp change made on four answers is
not.

## 3. Compare against what the ramp intended

The comparison is **median search**, not median run. `expectedSearchMs` in
`src/game/age.ts` maps a rung's `scan` to a hunting time and says nothing about the
sizing and squaring up that follows; comparing a whole run against it overstates every
day. What each rung is aiming at:

| rung | scan | intended search |
|---|---|---|
| mon | 0.494 | 45s |
| tue | 0.458 | 70s |
| wed | 0.429 | 100s |
| thu | 0.401 | 140s |
| fri | 0.380 | 181s |
| sat | 0.360 | 231s |
| sun | 0.341 | 291s |

That table is a copy and copies rot. Print the live one, which is derived from
`difficulty.ts` and `age.ts` themselves:

```bash
npm run rungs
```

Two things to hold on to. The scale is steep — 0.36 is nearly four minutes and 0.494 is
forty-five seconds — so a rung is moved in hundredths, not tenths. And these are
*expected* times for a median player: a factor of two either way on six testers is inside
the noise, and testers are unusually motivated people who have been told to hunt.

## 4. Read the two questions separately — that is why there are two

The pairing is the whole point. Time alone cannot tell these apart:

| Time | Fair? | What it is | What to do |
|---|---|---|---|
| Long, rated hard | fair | The rung is genuinely too hard | Move the rung's `scan` — see step 5 |
| Long, rated hard | **unfair** | That *day* is broken, not the ramp | Re-plan and re-tune that day. Do **not** move the ramp |
| Long | fair, rated "about right" | Working as intended | Nothing |
| Short, rated easy | fair | The rung is too easy | Move `scan` the other way |
| Mixed within one rung | — | It is the canvas, not the rung | See step 5 |

**Give-ups are the strongest signal in the set** and outrank the ratings. Somebody who
hunted four minutes and quit did not rate the day at all, and a puzzle with give-ups is
telling you something the ratings from the people who finished cannot.

**"Unfair" is about the placement or the paint, never the ramp.** A shape tuned down until
it is invisible and a shape sitting in the one patch of flat sky both take forever, and
neither is fixed by making Saturday easier. The fix is `npm run plan -- --testbed <image>`
and `npm run camouflage -- --testbed --solve <image>`, then another round.

## 5. Tell a rung problem from a canvas problem

Look at the by-rung block against the per-puzzle rows.

- **All three paintings agree** at a rung → the rung is wrong. That is a `scan` change in
  `src/game/difficulty.ts`, and it moves *every* week.
- **One painting is the outlier** → the canvas is wrong, not the ramp. That is `sizeScale`
  or a re-plan of that painting, and it moves nothing else. The README records that
  `jatte` needed exactly this.
- Never fix a one-canvas problem by moving the ramp. It is the mistake that produced one
  ramp and two different games, which the `scan` comment in `difficulty.ts` is a record of.

Before proposing any lever, check the README: `size`, `company` and the asset resolution
were each tried as difficulty levers and each was compensated straight back out by the
tuner. If the round seems to recommend one of them, it is being over-read.

## 6. Say what re-tuning would cost, before doing it

This is the step that must not be silent. Changing a rung's `scan` and re-tuning the
shipped weeks rewrites every day's opacity, which changes its `version` fingerprint,
which **hands that day back as playable to every player who already solved it**. Their
recorded time still counts towards played, best and streak — but the board they finished
opens again as a fresh puzzle.

**Default to future weeks only.** A change to how hiding places are chosen — and usually a
ramp change too — should land on the weeks a player will meet *after* the current calendar
week ends, and leave the current week and everything already served alone. That costs
nothing and hands nobody's board back. The boundary is the week containing today, not today
itself; work out which index that is rather than assuming — the current week is
`Math.floor((dayIndex(now) + weekday(EPOCH)) / 7)` in `daily.ts` terms, and everything after
it is fair game. See "Which weeks may be changed" in CLAUDE.md.

Re-planning the whole rotation is a different proposition and needs the paragraph below.
Where a change cannot be expressed as future-weeks-only — a `scan` rung applies to every
week by definition — say so explicitly, because that is the case where the cost is real.

So:

1. Take a baseline first: `npm run fingerprint --silent > before.json`.
2. Say out loud how many shipped days a proposed change would move, and that it hands
   those days back. It is the user's call, not yours.
3. Prefer proving it on the bench first — change the lever, re-tune **only** the bench
   (`npm run camouflage -- --testbed --solve`), and run a confirming round. The bench
   exists so that a ramp change reaches the rotation once, already tested.
4. If the change does go to the rotation, `diff` the fingerprint afterwards and report
   exactly which days moved. A non-empty diff here is expected and deliberate — it is the
   one time it is — so it has to be stated rather than noticed later. Check the list of
   moved days against the weeks you meant to move: if the current week or an already-served
   one is in it, that is a mistake, not a side effect.

## 7. Write down what was learned

The README is this project's memory of why its numbers are what they are, including the
ideas that failed. A round that produced no change is worth recording as much as one that
did — it is the evidence the next person needs in order not to re-litigate it.

Add a short entry to the **Play-testing** section: the round id, how many testers, what
was asked, what came back, and what was decided. Numbers, no hiding places.

## Finishing

Report:

- What the round asked, and whether the sample can answer it.
- The numbers against what the ramp intended, per rung and per canvas.
- What you conclude, separating "the ramp is wrong" from "that day is broken" from "not
  enough data".
- What you changed, what it would cost if applied to the rotation, and the fingerprint
  diff if anything shipped moved.

If the honest answer is "this round did not tell us much", say that. It is a useful
result and the round was cheap.
