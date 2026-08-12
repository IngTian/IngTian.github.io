// tests/capability.test.ts
// Breadth statistics shown on a page are claims about a real person, so they are tested against
// KNOWN CLOSED FORMS rather than against whatever the code currently returns. If HHI or entropy
// drifts, that is a red test, not a visual surprise.

import { describe, it, expect } from 'vitest';
import { concentration, profileConcentration, dimensionDepth } from '../src/lib/capability';
import { SIGNAL_WEIGHTS } from '../src/data/signalWeights';
import { loadings } from '../src/lib/factorModel';

describe('concentration — checked against closed forms', () => {
  it('gives HHI = 1/n and breadth = 1 for a perfectly even profile', () => {
    const c = concentration([1, 1, 1, 1]);
    expect(c.hhi).toBeCloseTo(0.25, 12);
    expect(c.effectiveN).toBeCloseTo(4, 12);
    expect(c.entropyBits).toBeCloseTo(2, 12);     // log2(4)
    expect(c.breadth).toBeCloseTo(1, 12);
  });

  it('gives HHI = 1 and breadth = 0 when all evidence sits on one dimension', () => {
    const c = concentration([1, 0, 0, 0]);
    expect(c.hhi).toBeCloseTo(1, 12);
    expect(c.effectiveN).toBeCloseTo(1, 12);
    expect(c.entropyBits).toBeCloseTo(0, 12);
    expect(c.breadth).toBeCloseTo(0, 12);
    expect(c.covered).toBe(1);
  });

  it('is scale invariant — shares, not magnitudes', () => {
    const a = concentration([2, 1, 1]);
    const b = concentration([20, 10, 10]);
    expect(a.hhi).toBeCloseTo(b.hhi, 12);
    expect(a.entropyBits).toBeCloseTo(b.entropyBits, 12);
  });

  it('counts zero dimensions in the total but not in the entropy', () => {
    // A dimension with no evidence is INFORMATION ("nothing published here yet"). Dropping it
    // would inflate breadth, which is the flattering direction and therefore the wrong one.
    const c = concentration([1, 1, 0, 0]);
    expect(c.total).toBe(4);
    expect(c.covered).toBe(2);
    expect(c.entropyBits).toBeCloseTo(1, 12);          // log2(2)
    expect(c.breadth).toBeCloseTo(1 / 2, 12);          // 1 / log2(4)
  });

  it('handles an all-zero profile without dividing by zero', () => {
    const c = concentration([0, 0, 0]);
    expect(Number.isFinite(c.hhi)).toBe(true);
    expect(c.effectiveN).toBe(0);
    expect(c.covered).toBe(0);
  });

  it('ranks a concentrated profile as narrower than a spread one', () => {
    const narrow = concentration([0.8, 0.1, 0.1]);
    const wide = concentration([0.4, 0.3, 0.3]);
    expect(narrow.hhi).toBeGreaterThan(wide.hhi);
    expect(narrow.effectiveN).toBeLessThan(wide.effectiveN);
    expect(narrow.breadth).toBeLessThan(wide.breadth);
  });
});

describe('the live profile', () => {
  const p = profileConcentration(SIGNAL_WEIGHTS.signals);

  it('has six dimensions, two of them empty today', () => {
    expect(p.total).toBe(6);
    expect(p.covered).toBe(4);
  });

  it('reports an effective number below the dimension count', () => {
    // The number that refuses to flatter: six dimensions exist, but the evidence does not
    // support six equally. If this ever equalled 6 the profile would be perfectly even, which
    // for a real person would be the suspicious result.
    expect(p.effectiveN).toBeGreaterThan(1);
    expect(p.effectiveN).toBeLessThan(p.total);
  });

  it('keeps HHI between 1/n and 1', () => {
    expect(p.hhi).toBeGreaterThanOrEqual(1 / p.total - 1e-12);
    expect(p.hhi).toBeLessThanOrEqual(1);
  });

  it('keeps breadth on a 0..1 scale', () => {
    expect(p.breadth).toBeGreaterThan(0);
    expect(p.breadth).toBeLessThan(1);
  });

  it('is deterministic', () => {
    const a = profileConcentration(SIGNAL_WEIGHTS.signals);
    const b = profileConcentration(SIGNAL_WEIGHTS.signals);
    expect(a.hhi).toBe(b.hhi);
    expect(a.entropyBits).toBe(b.entropyBits);
  });
});

describe('dimensionDepth — volume and quality are different axes', () => {
  const ls = loadings(SIGNAL_WEIGHTS.signals);
  const depth = dimensionDepth(SIGNAL_WEIGHTS.signals, ls);

  it('returns one row per dimension', () => {
    expect(depth).toHaveLength(ls.length);
  });

  it('separates share from mean score', () => {
    // The distinction the fan alone hid. Experience has the largest share because it has the
    // most items, while its mean evidence score is low; Research has fewer items at a higher
    // mean. A picture showing only share implied volume and quality were the same thing.
    const exp = depth.find((d) => d.key === 'experience')!;
    const res = depth.find((d) => d.key === 'research')!;
    expect(exp.share).toBeGreaterThan(res.share);
    expect(res.meanScore).toBeGreaterThan(exp.meanScore);
  });

  it('gives an empty dimension zero depth rather than NaN', () => {
    for (const d of depth.filter((x) => x.count === 0)) {
      expect(d.meanScore).toBe(0);
      expect(d.peakScore).toBe(0);
      expect(d.share).toBe(0);
    }
  });

  it('never reports a mean above the peak', () => {
    for (const d of depth) expect(d.meanScore).toBeLessThanOrEqual(d.peakScore);
  });

  it('keeps every mean inside the rubric scale', () => {
    for (const d of depth) {
      expect(d.meanScore).toBeGreaterThanOrEqual(0);
      expect(d.meanScore).toBeLessThanOrEqual(5);
    }
  });
});
