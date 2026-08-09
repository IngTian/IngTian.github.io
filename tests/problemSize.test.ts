import { describe, it, expect } from 'vitest';
import {
  singlePeriodVars, multiPeriodVars, scaleFactor, humanCount, log10Combinations,
} from '../src/lib/problemSize';
// The declared sizes moved into data/desk.ts alongside the rest of the concrete example, so the toy
// problem is now the six instruments over 52 weeks and the real one is the fund's own figures.
import { FUND, INSTRUMENTS } from '../src/data/desk';

const TOY = { assets: INSTRUMENTS.length, periods: 52 };
const REAL = { tickers: FUND.tickers, periods: FUND.periods };

describe('singlePeriodVars / multiPeriodVars', () => {
  it('single period is one weight per holding', () => {
    expect(singlePeriodVars(4)).toBe(4);
  });

  // THE NUMBER THE SLIDE LEANS ON: multi-period is not the same problem repeated, it is a bigger problem.
  it('multi period multiplies holdings by periods', () => {
    expect(multiPeriodVars(4, 12)).toBe(48);
    expect(multiPeriodVars(3000, 24)).toBe(72_000);
  });

  it('degrades safely on nonsense', () => {
    expect(multiPeriodVars(-5, 10)).toBe(0);
    expect(multiPeriodVars(10, -5)).toBe(0);
    expect(singlePeriodVars(-1)).toBe(0);
  });

  it('floors fractional inputs rather than producing a fractional count of decisions', () => {
    expect(multiPeriodVars(4.9, 2.9)).toBe(8);
  });
});

describe('scaleFactor', () => {
  it('reports how much larger the real problem is than the example', () => {
    // Derived rather than hardcoded: the declared sizes live in data/desk.ts and a change there should not
    // silently break an assertion about arithmetic that is still correct.
    const expected = (REAL.tickers * REAL.periods) / (TOY.assets * TOY.periods);
    expect(scaleFactor(TOY, REAL)).toBeCloseTo(expected, 9);
  });

  it('the real problem is orders of magnitude larger, which is the slide\'s point', () => {
    expect(scaleFactor(TOY, REAL)).toBeGreaterThan(100);
  });

  it('is zero rather than Infinity when the toy problem is empty', () => {
    expect(scaleFactor({ assets: 0, periods: 0 }, REAL)).toBe(0);
  });
});

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
});

describe('log10Combinations', () => {
  it('matches known small values', () => {
    // C(10,5) = 252 -> log10 ≈ 2.401
    expect(log10Combinations(10, 5)).toBeCloseTo(Math.log10(252), 6);
    // C(52,5) = 2,598,960
    expect(log10Combinations(52, 5)).toBeCloseTo(Math.log10(2_598_960), 6);
  });

  // The reason this returns a magnitude rather than a value: the count of corner portfolios for a real
  // universe does not fit in a double. That fact IS the argument the slide makes.
  it('stays finite where the raw combination would overflow', () => {
    const m = log10Combinations(3000, 100);
    expect(Number.isFinite(m)).toBe(true);
    expect(m).toBeGreaterThan(100);          // more than 10^100 corners
  });

  it('is symmetric in k and n-k', () => {
    expect(log10Combinations(50, 20)).toBeCloseTo(log10Combinations(50, 30), 9);
  });

  it('degrades safely at the edges', () => {
    expect(log10Combinations(0, 0)).toBe(0);
    expect(log10Combinations(10, 0)).toBe(0);
    expect(log10Combinations(10, 11)).toBe(0);
    expect(log10Combinations(10, 10)).toBeCloseTo(0, 9);  // C(10,10) = 1, log10 = 0
  });
});

describe('the declared problem sizes', () => {
  // The slide claims "thousands of tickers and countless constraints" in its copy, so the declared figures
  // have to actually be in the thousands.
  it('the real problem is thousands of tickers and thousands of constraints, as claimed', () => {
    expect(FUND.tickers).toBeGreaterThanOrEqual(1000);
    expect(FUND.constraints).toBeGreaterThanOrEqual(1000);
    expect(FUND.periods).toBeGreaterThan(1);
  });

  it('the drawdown limit is a real bound, not decoration', () => {
    expect(FUND.drawdownLimit).toBeGreaterThan(0);
    expect(FUND.drawdownLimit).toBeLessThan(0.25);
  });

  it('the toy problem is small enough to teach with', () => {
    expect(TOY.assets).toBeLessThanOrEqual(6);
  });
});
