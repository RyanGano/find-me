---
name: start-testbed-round
description: Put a new play-testing round in front of testers on the /?testbed link — pick the question, choose which bench days answer it, set the window, ship it and confirm it is live. Use when the user asks to "start a testbed round", "set up a play-test", "get people to test X", "run a round on Saturday", "test the new difficulty on real people", or has just made a change they want tried before it reaches the game. Chooses the slice from the question rather than from habit, refuses to let a round touch the rotation, and proves no shipped puzzle moved before anything is deployed.
---

# Start a play-testing round

A round is one question, a handful of bench days that answer it, and the fortnight it is
asked in. `/?testbed` serves whichever round is open, so the link never changes and the
work is `src/game/rounds.ts` plus a deploy.

Read the **Play-testing** section of `README.md` first. It says why the bench exists and
what it structurally cannot do; this skill is how a round gets from a worry to a link.

## Rule 0 — the person asking may be one of the testers

Six answers is a small sample and the person who asked for the round is often one of the
six. **Never say where anything is hidden** — not coordinates, not "in the sky", not
which object, not which quarter of the canvas. Not for the bench and not for the
rotation, and not in the commit message either, which is read months later.

You can freely report: which puzzle ids are in the round, the measured numbers
(`scan`, `ratio`, texture, solved times), what the ramp intended, and everything about
whether the round is correctly built.

If a round needs a bench week re-planned, run the tools and report that they succeeded —
never paste the planner's placement table, which names every spot.

## 1. Get the question first

A round is built from its question, and a round without one collects numbers nobody can
act on. Ask, if it is not already clear:

> What are you worried about, and what would change your mind?

The question decides the shape. Three that come up, and what each is:

| Worry | Slice | Why |
|---|---|---|
| One rung feels wrong | that rung on all three paintings, **plus the rung before it** | The neighbour is the control. "Saturday is hard" means nothing without the Friday it is supposed to be harder than. |
| One *kind* of painting feels rough | all seven days of that one canvas | The ramp is fine and the canvas is not, so you need the whole shape of its week. |
| A change you just made | whatever the change was supposed to move, plus one rung it was not | The rung that should not have moved is what tells you the change was surgical. |

Anything else, ask rather than guess.

## 2. Choose the days

They come from `src/game/testbed.ts` — `proverbs`, `cafe`, `ambassadors` — and the ids
are `<image>-<rung>`, rungs being `mon tue wed thu fri sat sun`.

- **Cap it at about twelve, and prefer six.** A long round is abandoned partway, and what
  gets abandoned is the hard end, which is nearly always the part being asked about.
- **Order painting-major** (`proverbs-fri`, `proverbs-sat`, then the next canvas). A real
  week is one canvas, so keeping a painting together is the honest test; jumping between
  canvases every hunt tests something the game never does.
- **Put the control immediately before its subject**, so the tester answers the pair
  while the first is still fresh.
- Every painting, unless the question is about one canvas. A round on one canvas answers
  only about that canvas.

## 3. Check the change under test is actually in the build

If the round exists to try something new, that something must be committed and about to
deploy, or the round measures today's game and says so in every row. Confirm:

- The change is in the working tree and the suite is green.
- `npm run fingerprint --silent` against a saved baseline is **empty** — see step 6. A
  change meant for the bench that has moved a shipped puzzle is a bug, not a round.

If the change is only ever meant for the bench, it belongs behind the bench's own data
(re-plan and re-tune the bench week), never behind a branch in `useHunt` — the hunt is
shared on purpose and a bench that plays differently measures itself.

## 4. Write the round

Append to `ROUNDS` in `src/game/rounds.ts`:

```ts
{
  id: 'r2-cafe-week',
  opens: '2026-10-05',
  closes: '2026-10-19',
  asks: 'Does this painting stay fair all week?',
  note: 'Seven hunts on one canvas, Monday through Sunday...',
  days: ['cafe-mon', 'cafe-tue', ...],
}
```

- `id`: `r<n>-<what it is about>`. It is the key every answer is filed under and cannot
  be changed once answers exist.
- `opens`/`closes` are inclusive local dates and **must not overlap another round** —
  `rounds.test.ts` fails on that, because the link would silently serve the older one.
  Close the current round first if it is still open.
- `asks` is the tester's question, not yours: "Is the end of the week too hard?", not
  "validate the scan target at rung 6".
- `note` says what they are about to do and how long it takes. Say that giving up is
  useful; testers try to be polite and will grind rather than press it.

## 5. Check it as a tester would

```bash
npm test
npm run build && npx vite preview --port 4173 &
node scripts/smoke-testbed.mjs
```

Then walk it yourself in a browser at `/?testbed=<id>&again=1` — `again` clears this
device's record so it can be re-run, and marks the rows `dry` so they are excluded from
the results. Check the intro reads well and the first board loads.

**Do not walk it without `again`.** A plain run consumes your one go at the round on that
device and files real answers under your tester id.

## 6. Prove the rotation did not move

```bash
npm run fingerprint --silent | diff before.json -
```

Empty. Always, for a round — a round is bench data and a `rounds.ts` entry, and neither
can touch `PUZZLES`. If it is not empty, something in the change under test reached the
shipped weeks; stop and find out what, because a moved fingerprint hands a finished day
back to every player who solved it.

Take the baseline **before** starting work: `npm run fingerprint --silent > before.json`.

## 7. Ship it and confirm

Commit and push to `main`; CI deploys to Pages. Then load `/?testbed` on the live site and
confirm the round that comes back is the one you just wrote — a wrong window is invisible
locally on the day you write it and obvious to a tester a week later.

## 8. Hand it over

Give the user the link and a sentence they can forward:

> findme.ryangano.com/?testbed — six puzzles, about fifteen minutes, on paintings that
> are not in the game. Say how each one felt; there is a give-up button and using it
> helps. You can stop and come back, and it will not touch your streak.

Say plainly:

- Which days are in the round and in what order.
- That a tester gets **one** go per device, so they should not start it on a phone they
  are about to hand to somebody else.
- **Do not deploy again while the round is open** unless you mean to. Every deploy stamps
  a new build id on the answers that follow, and the results reader will flag a round
  whose answers span more than one — which is correct, but it is work to untangle. If you
  must ship something unrelated, note the date so the results can be read either side.

## Things that bite

- **`?testbed` alone always wins.** `?testbed=<id>` is for checking a round outside its
  window; testers get the bare link. Handing out the `=<id>` form works but marks nothing
  dry and will confuse the next round.
- **A closed round is not deleted.** Leave it in `ROUNDS` — the answers are filed under
  its id and the file is the only record of what was asked.
- **Re-planning a bench week changes its puzzle fingerprints**, which is fine for the
  bench and means testers who played it before will see genuinely different puzzles. It
  does not affect a device's "already answered" record, which is keyed by round and
  puzzle id, so a re-planned day in a *new* round is answerable again.
