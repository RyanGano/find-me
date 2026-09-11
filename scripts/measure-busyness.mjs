/**
 * Measure how much work each painting is to scan, and how dark the paint is at each
 * hiding place -- and write both into the puzzle files.
 *
 *   npm run busyness              # report every week and day
 *   npm run busyness -- --write   # ...and write the numbers into the source
 *   npm run busyness -- --testbed --write
 *
 * These are properties of the painting and the spot, not of the paint the tuner solves,
 * so they are measured once when a week is planned and re-read for free thereafter. They
 * are not part of a day's `version` -- see `fingerprint` in build.ts -- so writing them
 * hands nobody's finished board back.
 *
 * Needs nothing running: it reads the generated assets directly.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { RAMP, CANVAS_REFERENCE } from '../src/game/difficulty.ts';
import { clutterOf, dimnessOf } from './lib/busy.mjs';

const args = process.argv.slice(2);
const FILE = args.includes('--testbed') ? 'src/game/testbed.ts' : 'src/game/puzzles.ts';
const write = args.includes('--write');
const only = args.filter((a) => !a.startsWith('-'));

const DAY_LINE =
  /\{ shape: '([\w-]+)', cx: (\d+), cy: (\d+), size: (\d+), angle: (-?\d+), fill: '(#[0-9a-f]+)', opacity: ([\d.]+), blend: '(\w+)', blur: ([\d.]+), ratio: ([\d.]+), scan: ([\d.]+)(?:, dim: ([\d.]+))?(?:, cover: ([\d.]+), base: '(#[0-9a-f]+)')? \},/g;

let source = readFileSync(FILE, 'utf8');
const weeks = /image: '(\w+)',([\s\S]*?)days: \[([\s\S]*?)\n    \],/g;
let match;
const found = [];
while ((match = weeks.exec(source))) {
  found.push({
    image: match[1],
    // A bench week may render a painting it is not named after; see `asset` in testbed.ts.
    asset: match[2].match(/asset: '(\w+)',/)?.[1] ?? match[1],
    body: match[3],
    whole: match[0],
  });
}

console.log('painting      clutter   dim by day');
for (const week of found) {
  if (only.length && !only.includes(week.image)) continue;
  const clutter = await clutterOf(week.asset);
  const dims = [];
  let out = week.body;
  let day = 0;
  for (const m of week.body.matchAll(DAY_LINE)) {
    const dim = await dimnessOf(week.asset, +m[2], +m[3], +m[4]);
    dims.push(dim);
    const rounded = Math.round(dim * 1000) / 1000;
    // Group 12 is the optional `dim` this may be re-measuring. Groups 1-11, and the
    // `cover` after `dim`, are the fields the planner and the tuner own; nothing here
    // touches them. The tuner always writes `dim` before `cover`, so a line without a
    // `dim` has no `cover` either.
    const fixed = m[12]
      ? m[0].replace(/, dim: [\d.]+/, `, dim: ${rounded}`)
      : m[0].replace(/ \},$/, `, dim: ${rounded} },`);
    out = out.replace(m[0], fixed);
    day++;
  }
  console.log(
    '  ' + week.image.padEnd(12) +
      clutter.toFixed(3).padStart(6) +
      (clutter > CANVAS_REFERENCE.clutter ? '  busier ' : '  calmer ') +
      'than the reference   ' +
      dims.map((d, i) => RAMP[i].key + ' ' + d.toFixed(2)).join('  '),
  );

  if (write) {
    let block = week.whole.replace(week.body, out);
    block = /clutter: [\d.]+,/.test(block)
      ? block.replace(/clutter: [\d.]+,/, `clutter: ${Math.round(clutter * 1000) / 1000},`)
      : block.replace(/(\n    days: \[)/, `\n    clutter: ${Math.round(clutter * 1000) / 1000},$1`);
    source = source.replace(week.whole, block);
  }
}

if (write) {
  writeFileSync(FILE, source);
  console.log('\nwrote ' + FILE);
}
