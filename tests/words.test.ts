import { describe, expect, it } from 'vitest';
import { countWords, hyphenatedParts, readingMinutes } from '../src/lib/words';

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
  });
  it('is never under a minute', () => {
    expect(readingMinutes(10)).toBe(1);
    expect(readingMinutes(0)).toBe(1);
  });
});

describe('hyphenatedParts', () => {
  it('puts the hyphenated words at the odd places, and loses nothing', () => {
    const t = 'Self-Attention on RNN-based Text (RL-BHRP) Approach';
    const parts = hyphenatedParts(t);
    expect(parts.filter((_, i) => i % 2)).toEqual(['Self-Attention', 'RNN-based', '(RL-BHRP)']);
    expect(parts.join('')).toBe(t);
  });
});
