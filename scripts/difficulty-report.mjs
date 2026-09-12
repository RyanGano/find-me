/**
 * How each week in the rotation is likely to feel, for a person to judge.
 *
 *   npm run difficulty
 *
 * Never a pass or a fail, and deliberately not in the test suite. A player wants to feel
 * they accomplished something without feeling it was too hard, and a few easy weeks in the
 * mix can be exactly right -- so whether a week is too easy, too hard or flat is a decision,
 * not a defect. Run this after adding a painting, re-tuning a week or changing the ramp,
 * read the table, and decide.
 *
 * Every time is the model's price for the day (`expectedSearchMs`), not a measured play
 * time. It prints no positions, so it is safe to read about a week you still mean to play.
 */
import { expectedSearchMs } from '../src/game/age.ts';
import { dayIndex, EPOCH, weekday } from '../src/game/daily.ts';
import { CANVAS_RANGE, RAMP, scanForTime } from '../src/game/difficulty.ts';
import { IMAGES, PUZZLES } from '../src/game/puzzles.ts';

/** A really busy painting: The Proverbs on the bench. See Rule 4 of the add-painting skill. */
const BUSY = 0.649;
/** Weeks from one busy painting to the next, at the least. */
const BUSY_GAP = 5;
/** A solved opacity this low has, once, been a shape that was not there at the match. */
const FAINT = 0.15;
/** The bottom of the scan range `expectedSearchMs` is fitted on; a rung asking below it is clamped. */
const SCAN_FLOOR = 0.3;

/** Things already decided about a day, so the table does not re-raise them without context. */
const NOTES = {
  'jatte-sun': 'measures easy at its 16px size, but played cold it went over a minute; the reading is untrustworthy that small',
  'starry-mon': 'left as served when the busyness term arrived, so it prices harder than the Tuesday after it',
};

const current = Math.floor((dayIndex(new Date()) + weekday(EPOCH)) / 7);
const rungTotal = RAMP.reduce((s, r) => s + r.seconds, 0);
const cell = (n) => String(Math.round(n)).padStart(5);

console.log(`target seconds          ${RAMP.map((r) => cell(r.seconds)).join('')}\n`);
console.log(`  #  week          clutter ${RAMP.map((r) => cell(0).replace('0', ' ').slice(0, 2) + r.key).join('')}  of ramp  notes`);

let lastBusy;
for (const [w, image] of IMAGES.entries()) {
  const week = PUZZLES.filter((p) => p.image === image.id);
  const clutter = week[0].clutter;
  const priced = week.map((p) => expectedSearchMs(p.target.scan ?? RAMP[p.dayOfWeek].scan, p.clutter, p.target.dim) / 1000);
  const share = priced.reduce((s, t) => s + t, 0) / rungTotal;

  const notes = [];
  if (w < current) notes.push('served');
  if (w === current) notes.push('this week');
  if (clutter < CANVAS_RANGE.clutter[0]) notes.push(`calmer than the model was fitted on (${CANVAS_RANGE.clutter[0]})`);
  if (clutter > CANVAS_RANGE.clutter[1]) notes.push(`busier than the model was fitted on (${CANVAS_RANGE.clutter[1]})`);
  if (clutter >= BUSY) {
    notes.push(lastBusy !== undefined && w - lastBusy < BUSY_GAP ? `busy, only ${w - lastBusy} weeks after the last busy one` : 'busy');
    lastBusy = w;
  }
  const floored = week.filter((p) => scanForTime(RAMP[p.dayOfWeek].seconds, p.clutter, p.target.dim) <= SCAN_FLOOR + 1e-9);
  if (floored.length > 1) notes.push(`${floored.length} days cannot be made as hard as their rung`);
  if (Math.min(...priced.slice(1)) < priced[0]) notes.push('a later day prices quicker than Monday');
  if (priced[3] <= priced[0]) notes.push('Thursday no harder than Monday');
  if (priced[6] <= priced[3]) notes.push('Sunday no harder than Thursday');
  const faint = week.filter((p) => p.target.opacity < FAINT).map((p) => RAMP[p.dayOfWeek].key);
  if (faint.length) notes.push(`look at ${faint.join(', ')} by eye (opacity under ${FAINT})`);
  for (const p of week) if (NOTES[p.id]) notes.push(`${RAMP[p.dayOfWeek].key}: ${NOTES[p.id]}`);

  console.log(
    `${String(w).padStart(3)}  ${image.id.padEnd(12)}  ${clutter.toFixed(3)} ${priced.map(cell).join('')}  ${`${Math.round(share * 100)}%`.padStart(7)}  ${notes.join('; ')}`,
  );
}
