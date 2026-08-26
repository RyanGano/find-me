import { describe, expect, it } from 'vitest';
import { formatCountdown, formatTime } from './format';
import { PUZZLES } from './puzzles';
import { buildShareText, speedBar } from './share';

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
    const text = buildShareText(12, PUZZLES[0], 83400, 1);
    expect(text).toContain('Find Me #12');
    expect(text).toContain('1:23.4');
    expect(text).not.toContain(PUZZLES[0].title);
    expect(text).not.toContain(String(PUZZLES[0].target.cx));
  });

  it('adds the streak only once it is worth bragging about', () => {
    expect(buildShareText(1, PUZZLES[0], 1000, 1)).not.toContain('streak');
    expect(buildShareText(1, PUZZLES[0], 1000, 4)).toContain('🔥 4 day streak');
  });
});
