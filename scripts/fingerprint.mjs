/**
 * Every shipped puzzle, as JSON, so that "this change did not move anybody's day" is
 * something a diff can say rather than something a commit message claims.
 *
 * Every field a player contends with is in here, including the `version` that
 * `storage.ts` records a result against -- so an empty diff across a change means no
 * recorded time was invalidated and no finished board was handed back as playable.
 *
 *   node scripts/fingerprint.mjs > before.json
 *   ...make the change...
 *   node scripts/fingerprint.mjs | diff before.json -
 *
 * Deliberately reads `PUZZLES` and nothing else. The play-test bench is not in it,
 * because the whole point of the bench is that it is free to move.
 */
import { PUZZLES } from '../src/game/puzzles.ts';

console.log(
  JSON.stringify(
    PUZZLES.map((p) => ({
      id: p.id,
      image: p.image,
      dayOfWeek: p.dayOfWeek,
      version: p.version,
      src: p.src,
      width: p.width,
      height: p.height,
      thing: p.thing,
      emoji: p.emoji,
      target: p.target,
    })),
    null,
    1,
  ),
);
