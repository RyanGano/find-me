---
name: add-painting
description: Add a new painting to Find Me and plan, tune and verify its whole Monday-to-Sunday week of puzzles. Use when the user asks to "add a painting", "add a new week", "add another artwork", "put a new painting in the rotation", or names a specific painting to add. Screens the candidate against the rejected list, for nudity, and for variety against the weeks already in the rotation; appends it to the end of the puzzle list so nobody's calendar shifts; refuses to finish until the week measures well and the suite is green; and never reveals where anything is hidden, so the person who asked for the week can still play it.
---

# Add a painting

One painting is one week: seven hiding places on the same canvas, Monday gentle through
Sunday brutal. Adding one is not a data-entry job — the hiding places are *measured* by
two browser-driven tools, and a painting that cannot span the ramp has to be rejected
rather than tuned around.

Read `CLAUDE.md` and the **Adding a puzzle** and **Difficulty** sections of `README.md`
before starting. The README is the record of which obvious ideas have already been tried
and failed; don't re-derive them.

## Rule 0 — the person you are reporting to plays this game

They asked for the week so they could hunt it themselves. Every hiding place you name is
one day of the game destroyed for them, permanently, and it cannot be given back.

So: **never say where anything ended up.** Not coordinates, not "upper-left", not "on the
melon", not "in the dark leaves behind the plate", not which object or which quarter of
the canvas. Not for the day you kept, and not for the spot you rejected either — a
retired spot still tells them where to look, and where not to.

This governs everything you write: progress notes, the final summary, the commit message,
and any file you point them at. `git log` is read months later, when the week is live.

What you *can* report freely, and should:

- verdicts and numbers — `rate` figures, each day's `scan` against its `want`, `ratio`,
  opacity, the shape and size per day;
- that a day failed and had to be moved, and *why it failed* in terms of the measurement
  ("solved to a very low opacity and was not visible at the match framing");
- anything you learned about the painting, the tools, or the ramp;
- Rule 2 findings — where nudity is on a canvas is a screening fact, and that painting is
  being rejected, not played.

Describe a failure by its measurement, never by its address.

The renders are spoilers in themselves: `preview:week` circles all seven answers, and
`diag-camouflage` centres the frame on one. You have to look at them — the eye is the
final authority in step 7 — but keep that to the minimum the judgement needs, view them
and move on, and never narrate, re-post or annotate what they show. Don't send the user
to `.source-images/week-NAME.jpg` either; it is a spoiler sheet with their whole week on
it.

## Rule 1 — check the rejected list first

`rejected.json`, next to this file, is every painting already considered and turned down.
**Read it before sourcing anything.** Sourcing, resizing and measuring a candidate is
minutes of work and a browser tuning run; re-doing it for a painting that was rejected
three months ago is pure waste, and worse, it risks quietly accepting something on a
second look that was correctly refused on the first.

If the candidate is on the list, say so, give the recorded reason, and propose something
else. A recorded rejection is only reopened if the user explicitly overrides it.

**Every rejection gets appended to that file**, whatever stage it failed at — Rule 2, the
variety check, `npm run rate`, or the planner giving up. That is what stops the list going
stale. One entry, with `title`, `artist`, `reason` from the closed set in the file's
`comment`, a `note` saying what was actually measured or seen, and `added` as an absolute
date.

## Rule 2 — no nudity

**Screen the candidate before anything else, and refuse any painting that fails.**

Look at the actual image, not at your memory of the title. Downscale it and view it, then
crop and view any region you can't read at a glance:

```bash
node -e "require('sharp')('.source-images/NAME.jpg').resize({width:1200}).jpeg().toFile('SCRATCH/NAME.jpg')"
```

Reject the painting if it contains exposed genitals, buttocks, or breasts — on a person or
on a depicted statue, at any size, anywhere on the canvas, however incidental to the
subject. Art-historical significance is not an exemption, and neither is "you'd have to
zoom in to see it": zooming in is the entire game, and the hardest days are found at the
match framing, magnified.

Two traps worth knowing about, because they are easy to miss at thumbnail size:

- **Classical and Renaissance scenes** put nude marble statuary in niches, friezes and
  background architecture — sculpture counts.
- **Bruegel-style crowded genre scenes** hide bare figures among hundreds of tiny clothed
  ones. Crop the busy quarters and look.

If the candidate fails, say so plainly, name where on the canvas, and offer alternatives.
Don't resize it, don't add it, and don't leave it in `.source-images/`.

Safe territory, if you're asked to suggest candidates: landscape, seascape, cityscape,
still life, architecture, clothed portraiture, and abstraction. Every painting must also
be **public domain** and scanned from Wikimedia Commons — the credits panel says so.

## Rule 3 — a rotation, not a run

A player meets the rotation one painting at a time over months, so what matters is not
whether a painting is good but whether it is *different from its neighbours*. Three
landscapes together is a season of the same picture; two paintings by one painter back to
back reads as the game repeating itself, even though all fourteen days differ.

Every week declares a `genre` from the closed `GENRES` list in `src/game/puzzles.ts`, and
`src/game/curation.test.ts` holds the running order to four rules:

- No painter two weeks running.
- No genre three weeks running.
- No painter holding more than a third of the rotation.
- At least four kinds of painting in play.

Check the candidate against the **tail of the list** before sourcing it — the new week
lands last, so its only neighbour is the current final week:

```bash
grep -n "image: '\|artist: '\|genre: '" src/game/puzzles.ts | tail -9
```

If the candidate shares a
painter with the final week, or would make a third consecutive week of its genre, it is
the wrong painting *for this slot* — say so and propose a contrasting one. Record it in
`rejected.json` with reason `duplicate-painter` only if it is being ruled out for good;
a painting that is merely mistimed should be suggested again later, not blacklisted.

Note that the rules constrain the order and the order is append-only, so a failure cannot
be fixed by moving weeks around (Rule 4). The fix is always a different painting.

## Rule 4 — always append, never insert

`daily.ts` maps calendar days onto `PUZZLES` by index. Inserting or reordering a week
changes which painting every future day lands on, and hands people finished boards for
puzzles they never played.

The new week goes **last** in the `WEEKS` array in `src/game/puzzles.ts`. Nothing above it
moves — not a line, not a field. `plan-weeks.mjs` also seeds its shape rotation and angles
from the week's index, so appending is what keeps the existing weeks byte-identical.

## Steps

Work through these in order. Each one can fail, and a failure means going back, not
pushing on.

### 1. Screen and source the image

Apply Rules 1, 2 and 3 in that order — rejected list, nudity, then variety against the
tail of the rotation. They are cheap and they all come before any work that costs time, so
none of them is worth deferring "until we see how it measures".

Then put the highest-resolution scan available in `.source-images/NAME.jpg`.
Pick a short lowercase `NAME` with no punctuation — it becomes the asset name, the puzzle
id prefix (`NAME-mon` … `NAME-sun`) and the `image` field.

Check the size *before* downloading — the Commons API reports it, and the best-known
version of a painting is often the one that only exists as a small scan:

```bash
curl -s -A "find-me/1.0" "https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=SEARCH+TERMS&gsrnamespace=6&gsrlimit=20&prop=imageinfo&iiprop=url|size|extmetadata&format=json"
```

Filter the results yourself for width >= 3000 and landscape orientation, and read
`extmetadata.LicenseShortName` to confirm public domain. Two things this saves:

- **Landscape beats portrait, and big beats famous.** The asset is capped at 2600px wide
  and never enlarged, so a 1768px-wide scan ships at 1768px. Washington Crossing the
  Delaware is on the rejected list for having too little ground to hide in at 2600x1666;
  a small or tall scan walks into the same failure with less canvas still.
- Searching for the celebrated version of a title can return only a 768px file while a
  different, equally good work by the same painter is on Commons at 4570px.

`.source-images/` is gitignored: the source scan is never committed, only the generated
asset in `public/puzzles/`.

### 2. Rate it before investing in it

```bash
npm run rate -- .source-images/NAME.jpg
```

The ramp needs a painting with **both** a quiet corner for Monday and busy paint for
Sunday. Anything but `ok` or `tight` is a rejection — replace the painting, don't tune
around it. `rate-painting.mjs` explains what each verdict cost the project to learn.

### 3. Generate the asset

Add `'NAME:.source-images/NAME.jpg'` to the end of the `files` list in
`scripts/resize-images.mjs`, then:

```bash
npm run images
```

Note the reported output dimensions — they go in the seed verbatim, and a test pins them.

### 4. Append the week seed

Add to the **end** of `WEEKS` in `src/game/puzzles.ts`, with placeholder days that
`npm run plan` will overwrite. Seven `days` entries are required; the planner rewrites the
block but does not create it.

```ts
  {
    image: 'NAME',
    title: 'Title As It Should Read',
    artist: 'Painter Name',
    year: 'c. 1665',
    genre: 'cityscape',
    width: 2600,
    height: 1841,
    days: [
      { shape: 'star', cx: 1300, cy: 900, size: 40, angle: 0, fill: '#808080', opacity: 1, blend: 'screen', blur: 0.5, ratio: 1, scan: 0.5 },
      // ...seven of these, one per day
    ],
  },
```

Keep each day on one line — those lines are machine-rewritten in place by both tools.

`genre` must be one of the `GENRES` in the same file. If the painting genuinely is not one
of them, widen that list — but widen it because the painting does not fit, never to dodge
a choice that would trip the variety rules.

While in the file, update the count in the `WEEKS` doc comment ("Eight paintings is
therefore eight weeks"), and the painting count in `README.md` — it states one as
"Eight paintings therefore give eight weeks -- fifty-six days", so the day count needs
advancing by seven too. Leave alone any README number that records what was *measured*
across the paintings of the day ("a floor of 1.5 measured across the eight paintings");
that is a historical result, not a count of the rotation.

### 5. Plan the hiding places

```bash
npm run plan -- NAME
```

This picks where each day hides, which shape, which angle and what colour, and writes the
seven lines. It is deterministic — the same image gives the same week every time.

If it throws `this painting cannot hold a week`, the canvas has run out of usable spots at
some rung. That's the same verdict as a bad `rate`: replace the painting.

Read the printed report. Each day's measured `texture` should be near the `want` for its
rung, and `company` should be non-zero on Monday and Sunday especially.

Re-planning re-plans the **whole week**, not the one day you were unhappy with — the
planner places the seven days together. So after any `avoid.json` change, re-tune and
re-judge all seven, and never assume a day you already approved survived unchanged. This
is only safe before the week ships; a week players have been served is frozen.

### 6. Tune the camouflage in a real browser

Needs the site running. Judge camouflage **only** from the browser tools — never from a
composited preview, a mistake this repo has already paid for once:

```bash
npm run build
npx vite preview --port 4173 &
npm run camouflage -- --solve NAME
```

`vite preview` serves `dist/`, so **every** browser tool — the tuner, `preview:week` and
`diag-camouflage` alike — measures the last build, not the working tree. Re-run
`npm run build` after each re-plan and each re-tune, before rendering anything. Skip it
and you will judge the previous week and believe it.

This binary-searches each day's opacity against its rung's `scan` target and rewrites the
seven lines with the solved `fill`, `opacity`, `ratio` and `scan`.

Then read the output, because solving is not the same as succeeding:

- **`TOO FAINT once framed even at full strength`** — broken, not hard. The player does
  everything right and there is nothing there. Move that day (`avoid.json`, below) and
  re-plan.
- **`raised to stay visible once framed`** on one or two days is normal. On most of the
  week it means the painting has nowhere to hide, and is the `TOO SMOOTH` failure arriving
  late.
- **`dimmed: it was a beacon once framed`** is usually a spot on flat paint whose local
  window took in something unrelated. Worth moving if it's Monday or Tuesday.
- **`scan` far off its `want`** on several days — the week isn't ramping.

A clean report is not proof. A day can solve to its `scan` target exactly, report a
healthy `ratio`, print no warning at all, and still be a shape that is simply not there
when you look at the match framing — the measurement is a whole-frame statistic and a
small shape on dark, busy paint can satisfy it without ever becoming visible. **A solved
opacity below about 0.15 is the tell**; treat it as a day to look at hard in step 7
rather than a day that came out easy. The one that got through this way solved to 0.144,
was invisible by eye, and came back at 0.34 with a ratio of 2.44 once it was moved.

To move a day off a bad spot, add a circle to `scripts/avoid.json` under the painting's
key (`{ "cx": ..., "cy": ..., "r": 260 }`) and re-run steps 5 and 6. That file is how every
previous bad spot in this repo was retired; follow the same pattern.

### 7. Look at it

Numbers don't catch a Monday that reads as a sticker or a Sunday that simply isn't there.
Two views, both against the real page:

```bash
npm run preview:week -- NAME                                 # seven rows of three, the whole ramp
node scripts/diag-camouflage.mjs NAME-mon '[{}]' out.jpg     # one day at both framings
```

Actually open the output images and look at them. Judge:

- **Monday** — found in seconds with the whole canvas on screen, but not the first thing
  the eye lands on.
- **Sunday** — invisible at the fitted view, unmistakable once framed.
- **The ramp** — each day plausibly harder than the one before, not a step change.

**Judge the fitted view against a control, not against your expectations.** The fitted
panel of `diag-camouflage` is a small render of a whole painting, and at that scale a
shipped, known-good Monday is invisible too. So before condemning a Monday for being too
hard, render a Monday already in the rotation the same way and compare the two — if they
read alike, the day is fine and it is the render that is unfair. The matched panel has no
such problem: what you see there is what the player gets, so it is the one to trust for
"is this shape actually present".

Write the diag output to the scratchpad rather than `.source-images/`, and see Rule 0 on
what not to say about any of these renders.

If a day fails on sight, move it via `avoid.json` and go back to step 5. The eye is the
final authority here; the measurements exist to make it repeatable.

### 8. Verify

```bash
npm run lint
npm test
npm run build
```

`assets.test.ts` pins the asset's real dimensions to the seed. `week.test.ts` asserts the
new week gets harder, takes longer to find, stays visible once framed, and opens with no
transparency. `curation.test.ts` checks the running order for repeated painters and runs
of one genre. `daily.test.ts` walks 400 dates against the longer rotation.
`determinism.test.ts` fails the build on any randomness under `src/`.

A failure here is a real finding, not a test to adjust. A `week.test.ts` failure means the
week needs re-planning; a `curation.test.ts` failure means the painting is wrong for this
slot and the order cannot be changed to accommodate it.

Then run the browser smoke test, which exercises the app end to end:

```bash
npm run build && npx vite preview --port 4173 &
node scripts/smoke.mjs
```

Finally, play the new week in the dev server via the practice URLs — `?puzzle=NAME-mon`
through `?puzzle=NAME-sun`. They aren't recorded and don't affect a streak.

`npm run lint` has two standing warnings that are not yours — an unused `searchCost` in
`plan-weeks.mjs` and a `set-state-in-effect` in `App.tsx`. Anything beyond those two is.

### 9. Commit

Commit `src/game/puzzles.ts`, `public/puzzles/NAME.jpg`, `scripts/resize-images.mjs`, any
`scripts/avoid.json` change, and the README/comment count updates. The source scan under
`.source-images/` stays out, and so does anything from `local/`.

Commit any `rejected.json` additions too — including when the whole session ended in a
rejection and no painting was added. That is the one case where it is tempting to walk
away with nothing committed, and it is exactly the case the file exists for.

## Don't

- **Don't hand-write the tuned numbers.** `fill`, `opacity`, `ratio` and `scan` are
  outputs of a measurement in a real browser. Guessing them produces a week that reads
  fine in the diff and plays badly.
- **Don't change `difficulty.ts` to make a painting fit.** The ramp is shared by every
  week; bending it to rescue one canvas silently re-tunes all the others. Reject the
  painting instead.
- **Don't touch an existing week's day lines.** Any edit to a day's shape, position, size,
  angle, fill, opacity or blend changes its `version` fingerprint and hands that day back
  as playable to everyone who has already finished it.
- **Don't judge camouflage from a `sharp` composite.** The browser applies opacity and
  `mix-blend-mode` in a different order; a shape sharp calls a whisper renders as a bright
  white snowflake.
- **Don't reorder weeks that players have already been served** to satisfy
  `curation.test.ts`. Reordering moves every painting after the one that moved, and hands
  people finished boards for puzzles they never played. Change the painting instead.
- **Don't say where a shape ended up** — in a summary, a progress note, or a commit
  message. See Rule 0. The reward for a week well built is that the person who asked for
  it still gets to play it.
- **Don't trust a clean tuner report over your own eyes.** Every day gets looked at in
  step 7, including the ones that reported perfectly.
- **Don't leave a rejection unrecorded.** An hour spent re-measuring a painting that was
  turned down last month is the exact cost `rejected.json` exists to avoid.
