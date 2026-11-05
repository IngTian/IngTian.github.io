import { describe, expect, it } from 'vitest';
import { countWords, readingMinutes, wholeParts } from '../src/lib/words';

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

// A name breaks in two at its hyphen ("RL-" / "BHRP"); a compound in lower case may, as in any prose.
describe('wholeParts', () => {
  it('puts each name, span of years, ISO date and arXiv category at the odd places, and loses nothing', () => {
    const t = 'Self-Attention on RNN-based (RL-BHRP) over 2012–2019, from 2025-08-13 [q-fin.PM], and a risk-parity rule';
    const parts = wholeParts(t);
    expect(parts.filter((_, i) => i % 2)).toEqual(['Self-Attention', 'RNN-based', 'RL-BHRP', '2012–2019', '2025-08-13', 'q-fin.PM']);
    expect(parts.join('')).toBe(t);
  });
  it('is the text alone when nothing in it is kept whole', () => {
    expect(wholeParts('a risk-parity rule')).toEqual(['a risk-parity rule']);
  });
});
