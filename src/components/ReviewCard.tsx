import { useState } from 'react';
import { formatTime } from '../game/format';

interface Props {
  /** 1-based position in the round, and how many there are. */
  step: number;
  of: number;
  /** How long the hunt took, or how long they searched before giving up. */
  ms: number;
  gaveUp: boolean;
  thing: string;
  onSubmit(hard: number, fair: 1 | -1): void;
}

/**
 * The whole of what a tester is asked, which is two taps and a third to move on.
 *
 * Two questions rather than one, because they come apart and the pair is what tuning
 * actually needs. "How hard" is the ramp: a Saturday that everybody rates 2 is a
 * Saturday in the wrong place, and the number says which way to move it. "Was it fair"
 * is whether the day is a puzzle at all -- a shape tuned down until it is invisible and
 * a shape sitting in the one patch of flat sky both take a long time, and only one of
 * them is a good puzzle. A single rating cannot tell those apart, and it is the
 * distinction most of the game's past mistakes have turned out to be.
 *
 * Nothing is typed and nothing is optional. A free-text box gets left empty on a phone
 * and a default answer is worse than no answer, since it is indistinguishable from one
 * somebody meant.
 */
const RUNGS = [
  { value: 1, label: 'far too easy' },
  { value: 2, label: 'a bit easy' },
  { value: 3, label: 'about right' },
  { value: 4, label: 'a bit hard' },
  { value: 5, label: 'far too hard' },
];

export function ReviewCard({ step, of, ms, gaveUp, thing, onSubmit }: Props) {
  const [hard, setHard] = useState<number | null>(gaveUp ? 5 : null);
  const [fair, setFair] = useState<1 | -1 | null>(null);

  const ready = hard !== null && fair !== null;

  return (
    <div className="howto review" role="dialog" aria-label="How was that one?">
      <p className="review-step">
        {step} of {of}
      </p>
      {gaveUp ? (
        <h2>
          Gave up after {formatTime(ms)} — that counts, and it is worth knowing.
        </h2>
      ) : (
        <h2>
          Found the {thing} in {formatTime(ms)}.
        </h2>
      )}

      <p className="review-q" id="review-hard">
        How hard was it?
      </p>
      <div className="review-scale" role="group" aria-labelledby="review-hard">
        {RUNGS.map((rung) => (
          <button
            key={rung.value}
            type="button"
            className={`review-rung${hard === rung.value ? ' is-on' : ''}`}
            onClick={() => setHard(rung.value)}
            aria-pressed={hard === rung.value}
          >
            <span className="review-rung-n">{rung.value}</span>
            <span className="review-rung-l">{rung.label}</span>
          </button>
        ))}
      </div>

      <p className="review-q" id="review-fair">
        Did it feel fair?
      </p>
      <p className="review-hint">
        Fair means it was findable and you would have got there. Unfair means invisible,
        or in a place nobody would think to look.
      </p>
      <div className="review-fair" role="group" aria-labelledby="review-fair">
        <button
          type="button"
          className={`btn review-thumb${fair === 1 ? ' is-on' : ''}`}
          onClick={() => setFair(1)}
          aria-pressed={fair === 1}
        >
          👍 fair
        </button>
        <button
          type="button"
          className={`btn review-thumb${fair === -1 ? ' is-off' : ''}`}
          onClick={() => setFair(-1)}
          aria-pressed={fair === -1}
        >
          👎 not fair
        </button>
      </div>

      <button
        type="button"
        className="btn btn-primary review-next"
        disabled={!ready}
        onClick={() => ready && onSubmit(hard, fair)}
      >
        {step === of ? 'Finish' : 'Next puzzle'}
      </button>
    </div>
  );
}
