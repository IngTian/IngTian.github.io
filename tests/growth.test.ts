import { describe, it, expect } from 'vitest';
import {
  growthCurve, finalValue, consistencyGap, highlighted, leadsOn, valueBounds, project, gridValues,
  type Strategy,
} from '../src/lib/growth';
import { STRATEGIES, WINDOW_YEARS } from '../src/data/track';

// The real published figures from RL-BHRP (arXiv:2508.11856), which is the whole point: this chart draws
// the paper's own out-of-sample results, not an invented equity curve. If someone edits the data to
// something unpublished, these tests are the tripwire.

describe('the published data is internally consistent', () => {
  // THE HONESTY CHECK, as a test rather than a comment. Cumulative return and CAGR are INDEPENDENT
  // published figures. The chart compounds at the CAGR, so if the two disagreed materially the curve
  // would be drawing something the paper does not claim.
  it('CAGR compounds to the stated cumulative return, for every strategy', () => {
    for (const s of STRATEGIES) {
      expect(consistencyGap(s, WINDOW_YEARS), `${s.key}`).toBeLessThan(0.05);
    }
  });

  it('every strategy carries the metrics the chart displays', () => {
    for (const s of STRATEGIES) {
      expect(s.cumulative, s.key).toBeGreaterThan(0);
      expect(s.cagr, s.key).toBeGreaterThan(0);
      expect(s.sharpe, s.key).toBeGreaterThan(0);
      expect(s.sortino, s.key).toBeGreaterThan(0);
      expect(s.maxDrawdown, s.key).toBeLessThan(0);
    }
  });

  it('exactly one strategy is the paper\'s own method', () => {
    expect(STRATEGIES.filter((s) => s.isMine)).toHaveLength(1);
  });
});

describe('the highlighted strategy genuinely leads', () => {
  // The slide states "highest return, highest Sharpe, highest Sortino". Each of those is only allowed on
  // screen if the published data supports it — so assert it here rather than trusting the copy.
  it('leads on cumulative return', () => expect(leadsOn(STRATEGIES, 'cumulative')).toBe(true));
  it('leads on CAGR', () => expect(leadsOn(STRATEGIES, 'cagr')).toBe(true));
  it('leads on Sharpe', () => expect(leadsOn(STRATEGIES, 'sharpe')).toBe(true));
  it('leads on Sortino', () => expect(leadsOn(STRATEGIES, 'sortino')).toBe(true));

  // The counter-check that keeps the slide honest: it does NOT lead on drawdown, and the copy must not
  // claim it does. If a future edit made it lead, the copy could be strengthened — but only then.
  it('does NOT lead on drawdown, so the copy must not claim risk superiority', () => {
    const mine = highlighted(STRATEGIES)!;
    const best = STRATEGIES.reduce((b, s) => (s.maxDrawdown > b.maxDrawdown ? s : b));
    expect(best.key).not.toBe(mine.key);
  });

  it('picks the flagged strategy', () => {
    expect(highlighted(STRATEGIES)!.isMine).toBe(true);
  });
});

const S = (over: Partial<Strategy> = {}): Strategy => ({
  key: 't', label: 'T', cumulative: 1, cagr: 0.1, vol: 0.15,
  sharpe: 1, sortino: 1.5, maxDrawdown: -0.2, ...over,
});

describe('growthCurve', () => {
  it('starts at one unit', () => {
    expect(growthCurve(S(), 5)[0]).toEqual({ t: 0, value: 1 });
  });

  it('compounds at the CAGR', () => {
    const c = growthCurve(S({ cagr: 0.1 }), 2, 2);
    expect(c[c.length - 1].value).toBeCloseTo(1.21, 6);   // 1.1^2
  });

  it('ends exactly at the window end', () => {
    const c = growthCurve(S(), 5.5, 40);
    expect(c[c.length - 1].t).toBeCloseTo(5.5, 9);
  });

  it('is monotonically increasing for a positive CAGR', () => {
    const c = growthCurve(S({ cagr: 0.12 }), 6, 50);
    for (let i = 1; i < c.length; i++) expect(c[i].value).toBeGreaterThan(c[i - 1].value);
  });

  it('is smooth — no invented bumps (each step is the same ratio)', () => {
    // This is the honesty property in code: the paper publishes no return series, so the curve must be
    // the smoothest one consistent with the data. Equal ratios prove nothing was fabricated.
    const c = growthCurve(S({ cagr: 0.1 }), 4, 8);
    const ratios = c.slice(1).map((p, i) => p.value / c[i].value);
    for (const r of ratios) expect(r).toBeCloseTo(ratios[0], 12);
  });

  it('returns the requested sample count', () => {
    expect(growthCurve(S(), 5, 24)).toHaveLength(25);
  });

  it('degrades safely on nonsense input', () => {
    expect(growthCurve(S(), 0)).toEqual([{ t: 0, value: 1 }]);
    expect(growthCurve(S(), -3)).toEqual([{ t: 0, value: 1 }]);
    expect(growthCurve(S(), 5, 0)).toEqual([{ t: 0, value: 1 }]);
  });
});

describe('finalValue', () => {
  it('uses the stated cumulative return, not the compounded CAGR', () => {
    expect(finalValue(S({ cumulative: 1.2, cagr: 0.9 }))).toBeCloseTo(2.2, 9);
  });
});

describe('valueBounds', () => {
  it('contains every curve', () => {
    const b = valueBounds(STRATEGIES, WINDOW_YEARS);
    for (const s of STRATEGIES) {
      expect(b.hi).toBeGreaterThanOrEqual(1 + s.cumulative);
      expect(b.hi).toBeGreaterThanOrEqual(Math.pow(1 + s.cagr, WINDOW_YEARS));
    }
  });

  it('starts at or below one unit, so the baseline is on the chart', () => {
    expect(valueBounds(STRATEGIES, WINDOW_YEARS).lo).toBeLessThanOrEqual(1);
  });

  it('handles an empty list', () => {
    const b = valueBounds([], 5);
    expect(b.hi).toBeGreaterThanOrEqual(b.lo);
  });
});

describe('project', () => {
  const box = { x: 0, y: 0, w: 100, h: 100 };
  const bounds = { lo: 1, hi: 2 };

  it('maps the start of the window to the left edge', () => {
    expect(project({ t: 0, value: 1 }, 5, bounds, box)[0]).toBe(0);
  });

  it('maps the end of the window to the right edge', () => {
    expect(project({ t: 5, value: 1 }, 5, bounds, box)[0]).toBe(100);
  });

  it('puts higher values HIGHER on screen (y grows downward)', () => {
    const low = project({ t: 0, value: 1 }, 5, bounds, box)[1];
    const high = project({ t: 0, value: 2 }, 5, bounds, box)[1];
    expect(high).toBeLessThan(low);
  });

  it('respects the box offset', () => {
    const [x, y] = project({ t: 0, value: 2 }, 5, bounds, { x: 10, y: 20, w: 100, h: 100 });
    expect(x).toBe(10);
    expect(y).toBe(20);
  });

  it('degrades safely on a zero-width window or zero span', () => {
    expect(Number.isFinite(project({ t: 0, value: 1 }, 0, bounds, box)[0])).toBe(true);
    expect(Number.isFinite(project({ t: 0, value: 1 }, 5, { lo: 1, hi: 1 }, box)[1])).toBe(true);
  });
});

describe('gridValues', () => {
  it('lands on round numbers inside the bounds', () => {
    const g = gridValues({ lo: 1, hi: 2.2 });
    expect(g.length).toBeGreaterThan(1);
    for (const v of g) {
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(2.2 + 1e-9);
    }
  });

  it('is evenly spaced', () => {
    const g = gridValues({ lo: 1, hi: 3 });
    const step = g[1] - g[0];
    for (let i = 1; i < g.length; i++) expect(g[i] - g[i - 1]).toBeCloseTo(step, 9);
  });

  it('degrades safely on a zero span', () => {
    expect(gridValues({ lo: 1, hi: 1 })).toEqual([1]);
  });
});

describe('leadsOn', () => {
  it('is false when another strategy beats the flagged one', () => {
    const list: Strategy[] = [S({ key: 'a', isMine: true, sharpe: 0.5 }), S({ key: 'b', sharpe: 0.9 })];
    expect(leadsOn(list, 'sharpe')).toBe(false);
  });

  it('is true on a tie', () => {
    const list: Strategy[] = [S({ key: 'a', isMine: true, sharpe: 0.9 }), S({ key: 'b', sharpe: 0.9 })];
    expect(leadsOn(list, 'sharpe')).toBe(true);
  });

  it('handles an empty list', () => {
    expect(leadsOn([], 'sharpe')).toBe(false);
    expect(highlighted([])).toBeNull();
  });
});
