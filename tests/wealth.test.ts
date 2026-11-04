import { describe, expect, it } from 'vitest';
import {
  band, cagr, cumulative, linearScale, maxDrawdownFromStart, niceDomain, nudgeLabels, pointwiseMedian,
} from '../src/lib/wealth';

describe('cumulative', () => {
  it('compounds from 1, one more point than there are returns', () => {
    expect(cumulative([0.1, -0.5])).toEqual([1, 1.1, 0.55]);
    expect(cumulative([])).toEqual([1]);
  });
});

describe('pointwiseMedian', () => {
  it('takes the median at each index, so it is no single series\' path', () => {
    expect(pointwiseMedian([[1, 3], [2, 1], [3, 2]])).toEqual([2, 2]);
  });
  it('averages the middle two of an even count', () => {
    expect(pointwiseMedian([[1], [2], [3], [10]])).toEqual([2.5]);
  });
});

describe('band', () => {
  it('is the min and the max at each index', () => {
    expect(band([[1, 3], [2, 1], [3, 2]])).toEqual({ lo: [1, 1], hi: [3, 3] });
  });
});

describe('maxDrawdownFromStart', () => {
  it('is the deepest fall from a running peak, as a negative fraction', () => {
    expect(maxDrawdownFromStart([1, 1.2, 0.9, 1.3])).toBeCloseTo(-0.25, 12);
  });
  it('counts the first point as a peak, so a fall straight from the start is a drawdown', () => {
    expect(maxDrawdownFromStart([1, 0.8, 1.1])).toBeCloseTo(-0.2, 12);
  });
  it('is 0 for a series that never falls', () => {
    expect(maxDrawdownFromStart([1, 1.1, 1.2])).toBe(0);
  });
});

describe('cagr', () => {
  it('annualises a total return over months: Table 2\'s RL-BHRP row', () => {
    expect(Math.abs(cagr(1.199612, 67) - 0.151637)).toBeLessThan(1e-6);
  });
});

describe('linearScale', () => {
  it('maps the domain\'s ends to the range\'s, and is linear between', () => {
    const y = linearScale(0, 10, 100, 0);   // an svg y axis: up is smaller
    expect(y(0)).toBe(100);
    expect(y(10)).toBe(0);
    expect(y(2.5)).toBe(75);
  });
});

describe('niceDomain', () => {
  it('is the smallest span on multiples of the step that contains both ends', () => {
    const d = niceDomain(0.78, 2.17, 0.5);
    expect(d.lo).toBeLessThanOrEqual(0.78);
    expect(d.hi).toBeGreaterThanOrEqual(2.17);
    expect(d.lo).toBeGreaterThan(0.78 - 0.5);
    expect(d.hi).toBeLessThan(2.17 + 0.5);
    expect(d.ticks[0]).toBe(d.lo);
    expect(d.ticks.at(-1)).toBe(d.hi);
    for (const t of d.ticks) expect(Number.isInteger(t / 0.5)).toBe(true);
    expect(d.ticks).toEqual([0.5, 1, 1.5, 2, 2.5]);
  });
  it('prints clean ticks for a step with no exact binary form', () => {
    expect(niceDomain(0.31, 0.58, 0.1).ticks).toEqual([0.3, 0.4, 0.5, 0.6]);
  });
  it('adds no step when an end is itself a multiple (0.3 / 0.1 is 2.9999999999999996)', () => {
    expect(niceDomain(0.3, 0.7, 0.1).ticks).toEqual([0.3, 0.4, 0.5, 0.6, 0.7]);
    expect(niceDomain(1, 2, 0.5).ticks).toEqual([1, 1.5, 2]);
  });
});

describe('nudgeLabels', () => {
  it('pushes crowded labels apart by at least the gap, keeping their order', () => {
    expect(nudgeLabels([100, 101, 140], 12)).toEqual([100, 112, 140]);
  });
  it('returns them in the order given, whatever order they sit in', () => {
    const ys = [140, 101, 100];
    const out = nudgeLabels(ys, 12);
    expect(out).toEqual([140, 112, 100]);
    expect(ys).toEqual([140, 101, 100]);   // the input is not touched
  });
});
