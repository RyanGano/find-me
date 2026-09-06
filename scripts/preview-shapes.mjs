/**
 * Look at every shape in the registry at once: the badge the player is shown, the size
 * it actually hides at, what it looks like turned, and how it reads laid over paint --
 * next to the emoji it will carry into the share text.
 *
 *   npm run preview:shapes                 # .scratch/shapes.html, open it in a browser
 *   npm run preview:shapes -- out.html
 *
 * A shape earns its place by being recognisable as a silhouette at the sizes below and
 * by pairing with an emoji a player would name the same way. Neither of those can be
 * judged from a path string, which is what this is for. It reads the registry, so a
 * shape added to shapes.ts appears here with no further work.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { SHAPES } from '../src/game/shapes.ts';
import { RAMP } from '../src/game/difficulty.ts';

const out = process.argv[2] ?? '.scratch/shapes.html';

/** The size the badge is drawn at, and roughly what a shape covers once framed. */
const BADGE = 72;
/** A shape at the fitted view is a speck: this is about what Sunday looks like. */
const SPECK = 18;
/** The paintings the samples are laid over, to judge a silhouette against real texture. */
const GROUNDS = ['mona', 'jatte', 'hunters'];

function svg(def, size, angle = 0, fill = '#111') {
  return (
    `<svg width="${size}" height="${size}" viewBox="0 0 100 100" ` +
    `style="transform:rotate(${angle}deg)">` +
    `<path d="${def.path}" fill="${fill}" fill-rule="${def.fillRule ?? 'evenodd'}"/></svg>`
  );
}

/** The furthest a shape can be turned before it looks like itself again. */
function halfPeriod(def) {
  return 180 / def.symmetry;
}

/** The last day of the week this shape can hold, given how far it can be turned. */
function lastDay(def) {
  const rungs = RAMP.filter((r) => halfPeriod(def) >= r.angle + 2);
  return rungs.length ? rungs[rungs.length - 1].label : 'no day -- it cannot turn far enough';
}

const rows = Object.entries(SHAPES)
  .map(([key, def], i) => {
    const turn = Math.round(halfPeriod(def) * 0.7);
    const ground = GROUNDS[i % GROUNDS.length];
    return `
    <tr>
      <td class="emoji">${def.emoji}</td>
      <td>
        <div class="key">${key}</div>
        <div class="meta">${def.label}</div>
        <div class="meta">${def.symmetry}-fold &middot; up to ${halfPeriod(def).toFixed(0)}&deg; of work</div>
        <div class="meta">latest day: ${lastDay(def)}</div>
      </td>
      <td>${svg(def, BADGE)}</td>
      <td>${svg(def, BADGE, turn)}<div class="meta">${turn}&deg;</div></td>
      <td>${svg(def, SPECK)}</td>
      <td class="ground" style="background-image:url(../public/puzzles/${ground}.jpg)">
        <span class="over">${svg(def, BADGE, 0, 'rgba(250,248,240,0.72)')}</span>
        <span class="over">${svg(def, SPECK, turn, 'rgba(250,248,240,0.72)')}</span>
      </td>
      <td class="share">Find Me #128 ${def.emoji}<br/>2:41 &middot; age 34</td>
    </tr>`;
  })
  .join('');

const html = `<!doctype html>
<meta charset="utf-8"/>
<title>Find Me shapes</title>
<style>
  body { font: 14px system-ui, sans-serif; margin: 24px; color: #1a1a1a; background: #faf8f4; }
  h1 { font-size: 20px; }
  p.lede { max-width: 60ch; color: #555; }
  table { border-collapse: collapse; }
  th { text-align: left; font-weight: 600; color: #555; padding: 6px 14px; font-size: 12px; }
  td { padding: 10px 14px; border-top: 1px solid #e2ddd4; vertical-align: middle; }
  .emoji { font-size: 34px; }
  .key { font-weight: 600; }
  .meta { color: #666; font-size: 12px; }
  .ground { background-size: cover; background-position: center; }
  .over { display: inline-block; vertical-align: middle; margin-right: 10px; }
  .share { font-family: ui-monospace, monospace; font-size: 12px; color: #333; white-space: nowrap; }
  svg { display: block; }
</style>
<h1>Find Me shapes &mdash; ${Object.keys(SHAPES).length} in the registry</h1>
<p class="lede">Each shape at badge size, turned as far as a hard day would ask, and as the
speck it is when the whole painting is on screen &mdash; then laid over paint, and with the
share line it produces. A shape belongs in the set only if the silhouette is unmistakable in
the speck column and the emoji names the same thing.</p>
<table>
  <tr><th>emoji</th><th>shape</th><th>badge</th><th>turned</th><th>speck</th><th>over paint</th><th>share</th></tr>
  ${rows}
</table>
`;

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`${Object.keys(SHAPES).length} shapes -> ${out}`);
