import { describe, expect, it } from 'vitest';
import { formatCountdown, formatTime } from './format';
import { PUZZLES } from './puzzles';
import { PAR_AGE, SPREAD } from './age';
import type { RunMetrics } from './metrics';
import {
  buildAgeDataText,
  buildGaveUpText,
  buildShareText,
  huntTrace,
  speedBar,
  tallyLine,
} from './share';

describe('tallyLine', () => {
  it('says the share who found it and the typical time, to the second', () => {
    expect(tallyLine({ played: 40, solved: 17, medianMs: 160400 })).toBe(
      '43% of players found it today · typically in 2:40',
    );
  });

  it('drops the minutes under one', () => {
    expect(tallyLine({ played: 5, solved: 5, medianMs: 42000 })).toBe(
      '100% of players found it today · typically in 42s',
    );
  });
});

describe('formatTime', () => {
  it('shows sub-minute times in seconds', () => {
    expect(formatTime(0)).toBe('0.0s');
    expect(formatTime(9460)).toBe('9.5s');
    expect(formatTime(59940)).toBe('59.9s');
  });

  it('rolls up to the next minute rather than showing 60 seconds', () => {
    expect(formatTime(59960)).toBe('1:00.0');
  });

  it('shows longer times as m:ss.t', () => {
    expect(formatTime(60000)).toBe('1:00.0');
    expect(formatTime(83400)).toBe('1:23.4');
    expect(formatTime(605000)).toBe('10:05.0');
  });

  it('clamps negatives to zero', () => {
    expect(formatTime(-5)).toBe('0.0s');
  });
});

describe('formatCountdown', () => {
  it('renders hh:mm:ss', () => {
    expect(formatCountdown(0)).toBe('00:00:00');
    expect(formatCountdown(3661000)).toBe('01:01:01');
  });
});

describe('speedBar', () => {
  it('fills more blocks the faster the solve', () => {
    expect(speedBar(5000)).toBe('🟩🟩🟩🟩🟩');
    expect(speedBar(20000)).toBe('🟩🟩🟩🟩⬜');
    expect(speedBar(45000)).toBe('🟩🟩🟩⬜⬜');
    expect(speedBar(90000)).toBe('🟩🟩⬜⬜⬜');
    expect(speedBar(300000)).toBe('🟩⬜⬜⬜⬜');
  });
});

describe('buildShareText', () => {
  it('names the day and time without revealing the painting or the spot', () => {
    const text = buildShareText(12, PUZZLES[0], 83400, 1, 41);
    expect(text).toContain('Find Me #12');
    expect(text).toContain('1:23.4');
    expect(text).not.toContain(PUZZLES[0].title);
    expect(text).not.toContain(String(PUZZLES[0].target.cx));
  });

  it('puts the age directly under the time, above the streak', () => {
    const lines = buildShareText(12, PUZZLES[0], 83400, 4, 41).split('\n');
    expect(lines[1]).toContain('1:23.4');
    expect(lines[2]).toBe('Your Find Me Age: 41');
    expect(lines[3]).toContain('streak');
  });

  it('leaves the age out when there is none to show', () => {
    expect(buildShareText(12, PUZZLES[0], 83400, 1, null)).not.toContain('Find Me Age');
  });

  it('adds the streak only once it is worth bragging about', () => {
    expect(buildShareText(1, PUZZLES[0], 1000, 1, 20)).not.toContain('streak');
    expect(buildShareText(1, PUZZLES[0], 1000, 4, 20)).toContain('🔥 4 day streak');
  });
});

describe('huntTrace', () => {
  const base: RunMetrics = {
    searchMs: 1,
    adjustMs: 1,
    passes: 2,
    overshoots: 0,
    reversals: 0,
    idleMs: 0,
  };

  it('turns the run into a line of emoji, in order', () => {
    expect(huntTrace({ ...base, trace: 'vvpvppf' })).toBe('🔍🔍🟨🔍🟨🟨🟩');
    expect(huntTrace({ ...base, trace: 'vg' })).toBe('🔍🏳️');
  });

  it('draws no time from a trace kept by the first version', () => {
    // `s` was a slice of search time; the clock says that now.
    expect(huntTrace({ ...base, trace: 'sspsf' })).toBe('🟨🟩');
  });

  it('is empty for a run with no trace', () => {
    expect(huntTrace(base)).toBe('');
    expect(huntTrace(null)).toBe('');
  });

  it('puts the trace on the line with the time, in place of the speed bar', () => {
    const lines = buildShareText(12, PUZZLES[0], 102000, 1, 41, { ...base, trace: 'vvpf' })
      .split('\n');
    expect(lines[1]).toBe('🔍🔍🟨🟩  1:42.0');
    expect(lines[1]).not.toContain('⬜');
  });

  it('shares a run without a trace exactly as before', () => {
    expect(buildShareText(12, PUZZLES[0], 83400, 4, 41, base)).toBe(
      buildShareText(12, PUZZLES[0], 83400, 4, 41),
    );
  });

  it('ends a give-up in the flag, still with no speed bar and no age', () => {
    const text = buildGaveUpText(12, PUZZLES[0], 240000, { ...base, trace: 'vvpvg' });
    expect(text.split('\n')[1]).toMatch(/^🔍🔍🟨🔍🏳️ {2}Didn't find it/);
    expect(text).not.toContain('🟩');
    expect(text).not.toContain('Find Me Age');
  });
});

describe('buildGaveUpText', () => {
  it('names the day and says plainly that it was not found', () => {
    const text = buildGaveUpText(12, PUZZLES[0], 240000);
    expect(text).toContain('Find Me #12');
    expect(text).toContain(PUZZLES[0].emoji);
    expect(text.toLowerCase()).toContain("didn't find it");
  });

  it('gives it no speed bar and no age: a give-up is not a score', () => {
    const text = buildGaveUpText(12, PUZZLES[0], 240000);
    expect(text).not.toContain('🟩');
    expect(text).not.toContain('⬜');
    expect(text).not.toContain('Find Me Age');
    expect(text).not.toContain('streak');
  });

  it('still gives nothing away about the painting or the spot', () => {
    const text = buildGaveUpText(12, PUZZLES[0], 240000);
    expect(text).not.toContain(PUZZLES[0].title);
    expect(text).not.toContain(String(PUZZLES[0].target.cx));
  });

  it('sends them back to the game', () => {
    expect(buildGaveUpText(12, PUZZLES[0], 240000)).toContain('findme.ryangano.com');
  });
});

describe('buildAgeDataText', () => {
  const puzzle = PUZZLES[0];
  const metrics: RunMetrics = {
    searchMs: 18200,
    adjustMs: 6300,
    passes: 1,
    overshoots: 2,
    reversals: 1,
    idleMs: 1400,
  };

  it('carries everything a retune needs, and nothing about the hiding place', () => {
    const text = buildAgeDataText(7, puzzle, 24500, 33, metrics, false);
    expect(text).toContain(`puzzle: ${puzzle.id}`);
    expect(text).toContain('time: 24.5s');
    expect(text).toContain(`read: 33 (par ${PAR_AGE}, spread ${SPREAD})`);
    expect(text).toContain('search: 18.2s');
    expect(text).toContain('adjust: 6.3s');
    expect(text).toContain('passes: 1');
    expect(text).toContain('overshoots: 2');
    expect(text).toContain('reversals: 1');
    expect(text).toContain('idle: 1.4s');
    // The hiding place is the one thing a tester must not be able to paste around.
    expect(text).not.toContain(String(puzzle.target.cx));
    expect(text).not.toContain(String(puzzle.target.cy));
  });

  it('records the scale it was read on, so the run survives the next retune', () => {
    // Two tunings have already moved under runs that were only ever written down as an
    // age. A reading is par + spread * L, so keeping both recovers L afterwards.
    const text = buildAgeDataText(7, puzzle, 24500, 33, metrics, false);
    expect(text).toContain(`par ${PAR_AGE}`);
    expect(text).toContain(`spread ${SPREAD}`);
  });

  it('opens with a blank for the one thing the game cannot know', () => {
    expect(buildAgeDataText(7, puzzle, 24500, 33, metrics, false).split('\n')[1]).toBe(
      'real age: ',
    );
  });

  it('marks a practice run, which is not comparable with a real one', () => {
    expect(buildAgeDataText(7, puzzle, 24500, 33, metrics, true)).toContain('(practice)');
    expect(buildAgeDataText(7, puzzle, 24500, 33, metrics, false)).not.toContain(
      '(practice)',
    );
  });

  it('says so when a run was read on the clock alone', () => {
    const text = buildAgeDataText(7, puzzle, 24500, 33, null, false);
    expect(text).toContain('metrics: none');
    expect(text).not.toContain('passes:');
  });
});
