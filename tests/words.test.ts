import { describe, expect, it } from 'vitest';
import { countWords, readingMinutes } from '../src/lib/words';

describe('countWords', () => {
  it('counts tokens with a letter or digit in them, so a price counts and a dash does not', () => {
    expect(countWords('$1 grew to $2.20 — fast')).toBe(5);
  });
  it('is 0 for nothing but space', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('  \n\t ')).toBe(0);
  });
});

describe('readingMinutes', () => {
  it('rounds words over 230 a minute', () => {
    expect(readingMinutes(4520)).toBe(20);
    expect(readingMinutes(4520, 452)).toBe(10);
  });
  it('is never under a minute', () => {
    expect(readingMinutes(10)).toBe(1);
    expect(readingMinutes(0)).toBe(1);
  });
});
