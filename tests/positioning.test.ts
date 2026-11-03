// tests/positioning.test.ts
// offchart's positioning method, ported: a cohort's net position as a share of open interest, ranked by an
// expanding (look-ahead-free) percentile. The cases are offchart's own definitions, worked by hand.
import { describe, expect, it } from 'vitest';
import { offchartPositioning } from '../src/data/vendor/offchartPositioning';
import { expandingPercentile, shareOf } from '../src/lib/positioning';

const dp2 = (xs: (number | null)[]) => xs.map((x) => (x === null ? null : Math.round(x * 100) / 100));

describe('expandingPercentile', () => {
  it('ranks each value against every non-NaN value up to and including it, ties counted', () => {
    // index 3: the second 2 is ranked against {3, 1, 2, 2} — three are <= 2, so 75, and the tie counts the
    // EARLIER 2. The NaN is blank and is not counted in anything after it.
    expect(dp2(expandingPercentile([3, 1, 2, 2, NaN, 5]))).toEqual([100, 50, 66.67, 75, null, 100]);
  });

  it('is blank until minHistory values have been seen, so the warm-up ships no 100th percentile', () => {
    expect(expandingPercentile([1, 2, 3], 2)).toEqual([null, 100, 100]);
  });

  it('never looks ahead: appending a value changes no earlier rank', () => {
    const v = [4, 9, 1, 7, 7, 2];
    expect(expandingPercentile([...v, -100]).slice(0, v.length)).toEqual(expandingPercentile(v));
  });
});

describe('shareOf', () => {
  it('is 100 * net / oi', () => {
    expect(shareOf([5, -30], [200, 120])).toEqual([2.5, -25]);
  });

  it('is NaN where open interest is not positive, rather than Infinity', () => {
    expect(shareOf([5], [0])).toEqual([NaN]);
    expect(shareOf([5], [-10])).toEqual([NaN]);
  });

  it('refuses series of different lengths instead of misaligning them', () => {
    expect(() => shareOf([1, 2], [3])).toThrow();
  });
});

describe('the vendored series', () => {
  const d = offchartPositioning;

  it('is aligned, weekly-ordered and fully priced', () => {
    expect(d.net).toHaveLength(d.weeks.length);
    expect(d.oi).toHaveLength(d.weeks.length);
    expect(d.weeks.every((w, i) => i === 0 || w > d.weeks[i - 1])).toBe(true);
    expect(d.oi.every((x) => x > 0)).toBe(true);
  });

  it('is pinned to the 10-year note from the start of the TFF series', () => {
    expect(d.weeks[0]).toBe('2006-06-13');
    expect(d.weeks.length).toBeGreaterThanOrEqual(1064);
  });

  it('has a percentile for every week after the first 51', () => {
    const p = expandingPercentile(shareOf(d.net, d.oi), 52);
    expect(p.slice(0, 51).every((x) => x === null)).toBe(true);
    expect(p.slice(51).every((x) => x !== null && x > 0 && x <= 100)).toBe(true);
  });
});
