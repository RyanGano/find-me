/**
 * End-to-end smoke test for the play-test bench, driven at phone size because that is
 * where it will actually be used and where the day-by-day URLs it replaces were hardest
 * to work with.
 *
 * It walks a whole round the way a tester does -- intro, hunt, review, next -- and
 * checks the four things the bench promises: that it is quick with nothing to type, that
 * a round survives the tab being closed, that a device cannot answer the same round
 * twice, and that none of it touches the daily game's storage.
 *
 * The hunt itself is not re-verified here. It is the same `useHunt` the daily game runs
 * on, and `smoke.mjs` solves a real board through real events to prove it.
 *
 * Usage: node scripts/smoke-testbed.mjs [url] [outDir]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = process.argv[2] ?? 'http://localhost:4173/';
const OUT = process.argv[3] ?? '.scratch/shots-testbed';
mkdirSync(OUT, { recursive: true });

const CHANNELS = ['chrome', 'msedge', undefined];
const failures = [];

function check(name, ok, detail = '') {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` -- ${detail}` : ''}`);
  if (!ok) failures.push(name);
}

async function launch() {
  let last;
  for (const channel of CHANNELS) {
    try {
      return await chromium.launch({ channel, args: ['--force-device-scale-factor=1'] });
    } catch (err) {
      last = err;
    }
  }
  throw last;
}

const browser = await launch();
const errors = [];

// A phone, and a context of its own so the storage checks below mean something.
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 3,
});
const page = await context.newPage();
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

const storage = () =>
  page.evaluate(() => ({
    keys: Object.keys(localStorage),
    bench: localStorage.getItem('find-me:testbed:v1'),
    game: localStorage.getItem('find-me:v1'),
  }));

/**
 * Give up, and check what that is supposed to do: stop the clock for good, and put the
 * shape somewhere the tester can actually look at it. Returns the frozen clock.
 */
async function quit(expectReveal = true) {
  const before = await page.evaluate(() => {
    const m = new DOMMatrix(getComputedStyle(document.querySelector('.stage-canvas')).transform);
    return Math.hypot(m.a, m.b);
  });
  await page.locator('.testbed-giveup').click();
  await page.waitForSelector('.reveal-note');
  const frozen = (await page.textContent('.clock')).trim();

  if (expectReveal) {
    const after = await page.evaluate(() => {
      const stage = document.querySelector('.stage').getBoundingClientRect();
      const m = new DOMMatrix(getComputedStyle(document.querySelector('.stage-canvas')).transform);
      const el = document.querySelector('.stage-target');
      const svg = el.querySelector('svg');
      const size = Number(svg.getAttribute('width'));
      const box = el.getBoundingClientRect();
      const ref = document.querySelector('.reference-well svg');
      return {
        scale: Math.hypot(m.a, m.b),
        rot: Math.atan2(m.b, m.a),
        // How far the hidden shape's centre is from the middle of the stage, in pixels.
        off: Math.hypot(
          box.left + box.width / 2 - (stage.left + stage.width / 2),
          box.top + box.height / 2 - (stage.top + stage.height / 2),
        ),
        onScreenSize: size * Math.hypot(m.a, m.b),
        wantSize: Number(ref.getAttribute('width')),
      };
    });
    check('giving up zooms in towards the shape', after.scale > before, `${before.toFixed(4)} -> ${after.scale.toFixed(4)}`);
    check('and centres it on the stage', after.off < 30, `${after.off.toFixed(0)}px off centre`);
    check(
      'at close to the size it needs to be, but not on it',
      after.onScreenSize > after.wantSize * 0.5 && after.onScreenSize < after.wantSize * 0.95,
      `${after.onScreenSize.toFixed(0)}px vs ${after.wantSize}px wanted`,
    );
    check('the puzzle is not solved out from under them', (await page.$('.reference.is-solved')) === null);

    // The clock must be stopped, not merely paused: a paused board blurs the painting,
    // which is the one thing that would stop them judging what they are looking at.
    await page.waitForTimeout(700);
    check('the clock stays stopped', (await page.textContent('.clock')).trim() === frozen, frozen);
    check('the painting is not blurred while they look', (await page.$('.stage-viewport.is-blurred')) === null);
    check('there is no way to restart the run', (await page.$('.btn-pause')) === null);
    await page.screenshot({ path: `${OUT}/3-reveal.png` });
  }

  await page.locator('.testbed-rate').click();
  return frozen;
}

/** Answer the review card that is up: a difficulty rung, a thumb, then move on. */
async function review(hard, fair) {
  await page.waitForSelector('.review');
  const next = page.locator('.review-next');
  check('next is refused until both questions are answered', await next.isDisabled());
  await page.locator('.review-rung').nth(hard - 1).click();
  check('one answer is still not enough', await next.isDisabled());
  await page.locator(fair > 0 ? '.review-thumb.btn >> nth=0' : '.review-thumb.btn >> nth=1').click();
  check('next opens once both are answered', await next.isEnabled());
  await next.click();
}

console.log('\n== the round, on a phone ==');

await page.goto(`${URL}?testbed`, { waitUntil: 'networkidle' });
await page.waitForSelector('.testbed-card');
await page.waitForTimeout(350);
await page.screenshot({ path: `${OUT}/1-intro.png` });

const asks = (await page.textContent('.testbed-card h2')).trim();
check('the round says what it is asking', asks.length > 10, asks);
// The tester id is minted on landing, because it is what a resumed round is keyed by
// and the round can be resumed from the intro. What matters is that it is the only
// thing written, and that no answer exists before anybody has answered anything.
{
  const before = await storage();
  check('only the bench key exists before the round starts', before.keys.join(',') === 'find-me:testbed:v1');
  check('and it holds no answers yet', !before.bench.includes('hard'));
  check('the daily game is untouched on the way in', before.game === null);
}

await page.getByRole('button', { name: 'Start' }).click();
await page.waitForSelector('.stage-image');
await page.waitForFunction(() => {
  const img = document.querySelector('.stage-image');
  return img && img.complete && img.naturalWidth > 0;
});
await page.screenshot({ path: `${OUT}/2-board.png` });

check('the board opens on the first hunt', (await page.textContent('.title-day')).trim() === '1/6');
check('the painting is blurred until the tester moves', (await page.$('.stage-viewport.is-blurred')) !== null);
check('the clock is held before the first move', (await page.textContent('.clock')).trim() === 'ready');
check('there is a way out of a hunt', (await page.$('.testbed-giveup')) !== null);

// A real move, to show the hunt is live and the clock is the game's own clock.
await page.mouse.move(195, 480);
await page.mouse.wheel(0, -240);
await page.waitForTimeout(250);
check('the blur lifts on the first move', (await page.$('.stage-viewport.is-blurred')) === null);
check('the clock runs on the first move', (await page.textContent('.clock')).trim() !== 'ready');

const frozen = await quit();
await page.waitForSelector('.review');
await page.waitForTimeout(350);
await page.screenshot({ path: `${OUT}/3-review.png` });
check('giving up is an answer, not a dead end', (await page.textContent('.review-step')).trim() === '1 of 6');
check('the review reports the time they gave up at', (await page.textContent('.review h2')).includes(frozen));

await review(5, -1);
await page.waitForSelector('.stage-image');
check('answering moves on to the next hunt', (await page.textContent('.title-day')).trim() === '2/6');

const afterOne = await storage();
check('the answer is kept on the device', afterOne.bench !== null && afterOne.bench.includes('hard'));
check('the daily game has not been written to', afterOne.game === null);
check('nothing but the bench key exists', afterOne.keys.join(',') === 'find-me:testbed:v1');

// ------------------------------------------------------------------- coming back later

await page.goto(`${URL}?testbed`, { waitUntil: 'networkidle' });
await page.waitForSelector('.stage-image');
check(
  'closing the tab and coming back resumes where the tester left off',
  (await page.textContent('.title-day')).trim() === '2/6',
);
check('and does not ask them to start over', (await page.$('.testbed-card')) === null);

// ------------------------------------------------------------------- finishing a round

// Step 2 has not been touched, so its clock still reads `ready`. Somebody who looks at a
// painting, decides straight away they will never find it and presses the button is the
// person most likely to press it at all -- and it used to do nothing whatsoever.
check('the hunt is untouched before this one', (await page.textContent('.clock')).trim() === 'ready');
await page.locator('.testbed-giveup').click();
await page.waitForSelector('.reveal-note');
check('giving up without ever moving still reveals and moves on', true);
check('and unblurs the painting so they can look', (await page.$('.stage-viewport.is-blurred')) === null);
await page.locator('.testbed-rate').click();
await review(3, 1);
await page.waitForSelector('.stage-image');

for (let i = 3; i <= 6; i++) {
  await quit(false);
  await review(3, 1);
  if (i < 6) await page.waitForSelector('.stage-image');
}

await page.waitForSelector('.testbed-card');
await page.screenshot({ path: `${OUT}/4-finished.png` });
check('the round ends on a thank-you', (await page.textContent('.testbed-card h2')).includes('thank you'));
check('every hunt is listed back', (await page.locator('.testbed-summary li').count()) === 6);

await page.goto(`${URL}?testbed`, { waitUntil: 'networkidle' });
await page.waitForSelector('.testbed-card');
check(
  'the same device cannot answer the round a second time',
  (await page.$('.stage-image')) === null && (await page.locator('.testbed-summary li').count()) === 6,
);

const atEnd = await storage();
check('the daily game was never touched, start to finish', atEnd.game === null);
check('and nothing else was written either', atEnd.keys.join(',') === 'find-me:testbed:v1');

// --------------------------------------------------------------- a round nobody is on

await page.goto(`${URL}?testbed=no-such-round`, { waitUntil: 'networkidle' });
await page.waitForSelector('.testbed-card');
const unknown = await page.textContent('.testbed-card h2');
check('an unknown round falls back to the open one, or says there is none', unknown.length > 0, unknown.trim());

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
console.log(failures.length ? `\n${failures.length} check(s) failed` : '\nall checks passed');
process.exit(failures.length ? 1 : 0);
