import { describe, it, expect } from 'vitest';
import { humanCount } from '../src/lib/problemSize';
import { FUND } from '../src/data/desk';

// humanCount is the one export of lib/problemSize.ts. The declared-sizes block below stays here even though
// FUND lives in data/desk.ts, because what it guards is
// the same thing humanCount serves: the figures Rules.astro prints in its copy. If FUND.tickers ever dropped
// below a thousand, the page's sentence "thousands of tickers" would become false while every other test
// stayed green.

describe('humanCount', () => {
  it('groups thousands', () => {
    expect(humanCount(72_000)).toBe('72,000');
    expect(humanCount(1_500)).toBe('1,500');
  });

  it('switches to millions past a million', () => {
    expect(humanCount(1_200_000)).toBe('1.2 million');
    expect(humanCount(2_000_000)).toBe('2 million');
    expect(humanCount(45_000_000)).toBe('45 million');
  });

  it('handles small values and nonsense', () => {
    expect(humanCount(4)).toBe('4');
    expect(humanCount(NaN)).toBe('—');
    expect(humanCount(Infinity)).toBe('—');
  });

  it('renders the figures the page actually prints', () => {
    // The two calls Rules.astro makes, asserted on the real data rather than on invented inputs — a change to
    // FUND that made the copy read strangely should fail here.
    expect(humanCount(FUND.tickers)).toBe('3,000');
    expect(humanCount(FUND.constraints)).toBe('2,000');
  });
});

describe('the declared problem sizes', () => {
  // The slide claims "thousands of tickers and countless constraints" in its copy, so the declared figures
  // have to actually be in the thousands.
  it('the real problem is thousands of tickers and thousands of constraints, as claimed', () => {
    expect(FUND.tickers).toBeGreaterThanOrEqual(1000);
    expect(FUND.constraints).toBeGreaterThanOrEqual(1000);
  });

  // The $1B figure and the 8% drawdown limit reach the page as prose inside CONSTRAINTS, which is where a
  // reader meets them. A second, unread copy of a number is how two versions of the same fact end up on one
  // page, so only the read fields are declared — and this asserts that, so a new field has to come with a
  // reader.
  it('declares only the figures something actually reads', () => {
    expect(Object.keys(FUND).sort()).toEqual(['constraints', 'tickers']);
  });
});
