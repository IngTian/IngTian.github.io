import { describe, it, expect } from 'vitest';
import {
  TOY_ASSETS, PERIOD_RETURNS, PERIOD_YEARS, feasible, turnover, runRule,
  realisedVol, maxDrawdown, finalValue, type Rule,
} from '../src/lib/multiperiod';
import { RULES } from '../src/data/rules';

describe('the declared return table', () => {
  it('has one column per asset in every period', () => {
    for (const [i, row] of PERIOD_RETURNS.entries()) {
      expect(row.length, `period ${i}`).toBe(TOY_ASSETS.length);
    }
  });

  it('is deterministic — the same table every read', () => {
    expect(PERIOD_RETURNS).toEqual(PERIOD_RETURNS.map((r) => [...r]));
  });

  // The table is hand-authored to be legible as a story rather than as noise. These assertions pin the
  // moments the slide relies on: if someone edits the table, the narrative claims must still hold.
  it('contains a real equity drawdown where bonds hold up', () => {
    const eq = TOY_ASSETS.findIndex((a) => a.key === 'equities');
    const bd = TOY_ASSETS.findIndex((a) => a.key === 'bonds');
    const worst = PERIOD_RETURNS.reduce((w, r, i) => (r[eq] < PERIOD_RETURNS[w][eq] ? i : w), 0);
    expect(PERIOD_RETURNS[worst][eq]).toBeLessThan(-0.1);
    expect(PERIOD_RETURNS[worst][bd]).toBeGreaterThan(0);
  });

  it('cash never loses money', () => {
    const cash = TOY_ASSETS.findIndex((a) => a.key === 'cash');
    for (const row of PERIOD_RETURNS) expect(row[cash]).toBeGreaterThanOrEqual(0);
  });
});

describe('feasible — the budget and no-shorting constraints', () => {
  it('sums to one', () => {
    expect(feasible([1, 1, 2, 0]).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
  });

  it('clips negatives (no shorting)', () => {
    const w = feasible([-1, 2, 0, 0]);
    for (const x of w) expect(x).toBeGreaterThanOrEqual(0);
    expect(w[0]).toBe(0);
  });

  it('falls back to cash when nothing is investable, rather than dividing by zero', () => {
    const w = feasible([0, 0, 0, 0]);
    expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    expect(w[w.length - 1]).toBe(1);
  });

  it('leaves an already-feasible vector alone', () => {
    expect(feasible([0.25, 0.25, 0.25, 0.25])).toEqual([0.25, 0.25, 0.25, 0.25]);
  });
});

describe('turnover', () => {
  it('is zero when nothing changes', () => {
    expect(turnover([0.5, 0.5], [0.5, 0.5])).toBe(0);
  });

  it('is the L1 distance', () => {
    expect(turnover([1, 0], [0, 1])).toBeCloseTo(2, 12);
  });

  it('handles vectors of different lengths', () => {
    expect(turnover([1], [0, 1])).toBeCloseTo(2, 12);
  });
});

describe('runRule — the multi-period mechanic', () => {
  const buyHold: Rule = {
    key: 'bh', label: 'Buy and hold', gloss: '',
    weights: (_p, prev) => (prev.some((x) => x > 0) ? [...prev] : [1, 0, 0, 0]),
  };
  const allCash: Rule = {
    key: 'cash', label: 'Cash', gloss: '',
    weights: () => [0, 0, 0, 1],
  };

  it('starts at one unit, before any return', () => {
    const path = runRule(allCash, PERIOD_RETURNS, 0);
    expect(path[0].value).toBeCloseTo(1, 12);
  });

  it('produces a point per period plus a closing point', () => {
    expect(runRule(allCash).length).toBe(PERIOD_RETURNS.length + 1);
  });

  it('advances time by PERIOD_YEARS each period', () => {
    const path = runRule(allCash);
    expect(path[1].t - path[0].t).toBeCloseTo(PERIOD_YEARS, 12);
  });

  it('always holds a feasible weight vector', () => {
    for (const rule of RULES) {
      for (const p of runRule(rule)) {
        expect(p.weights.reduce((a, b) => a + b, 0), rule.key).toBeCloseTo(1, 9);
        for (const w of p.weights) expect(w).toBeGreaterThanOrEqual(0);
      }
    }
  });

  // THE POINT OF THE MODULE: trading costs money, so a rule that churns pays for it. If this did not
  // hold, the multi-period story would be decoration.
  it('charges turnover, so the same rule ends lower with costs than without', () => {
    const churn: Rule = {
      key: 'churn', label: 'Churn', gloss: '',
      // Rotate the whole portfolio between two assets every period.
      weights: (p) => (p % 2 === 0 ? [1, 0, 0, 0] : [0, 1, 0, 0]),
    };
    const free = finalValue(runRule(churn, PERIOD_RETURNS, 0));
    const costly = finalValue(runRule(churn, PERIOD_RETURNS, 0.01));
    expect(costly).toBeLessThan(free);
  });

  it('charges nothing to a rule that never trades after establishing its position', () => {
    const withCost = finalValue(runRule(buyHold, PERIOD_RETURNS, 0.01));
    const withoutCost = finalValue(runRule(buyHold, PERIOD_RETURNS, 0));
    // Only the initial establishment is charged, so the gap is exactly that one trade.
    expect(withoutCost / withCost).toBeCloseTo(1 / (1 - 1 * 0.01), 6);
  });

  it('accumulates the cost it reports', () => {
    const path = runRule(RULES[0], PERIOD_RETURNS, 0.002);
    for (let i = 1; i < path.length; i++) {
      expect(path[i].costPaid).toBeGreaterThanOrEqual(path[i - 1].costPaid);
    }
  });

  it('all-cash compounds at the cash rate and never falls', () => {
    const path = runRule(allCash, PERIOD_RETURNS, 0);
    for (let i = 1; i < path.length; i++) {
      expect(path[i].value).toBeGreaterThanOrEqual(path[i - 1].value - 1e-12);
    }
  });
});

describe('the shipped rules', () => {
  it('each has a distinct key and a gloss', () => {
    expect(new Set(RULES.map((r) => r.key)).size).toBe(RULES.length);
    for (const r of RULES) expect(r.gloss.length, r.key).toBeGreaterThan(0);
  });

  it('exactly one is the search target', () => {
    expect(RULES.filter((r) => r.isTarget)).toHaveLength(1);
  });

  // THE SLIDE'S CLAIM, and it is deliberately NOT "the target rule has the highest curve".
  //
  // Measured in this declared world: all-equities ends at 1.347 but pays a −22.2% drawdown, while the
  // optimised rule ends at 1.257 with −0.5%. My first version of this test asserted the target ended
  // highest, and it FAILED — which is the more interesting result, because the honest lesson is exactly
  // that the highest curve is not automatically the one you want. The slide says so, and these tests pin
  // the shape of the argument rather than a flattering outcome.
  it('the target rule has the best return per unit of realised risk', () => {
    const score = (r: typeof RULES[number]) => {
      const p = runRule(r);
      const v = realisedVol(p);
      return v > 0 ? (finalValue(p) - 1) / v : Infinity;
    };
    const ranked = [...RULES].sort((a, b) => score(b) - score(a));
    expect(ranked[0].isTarget).toBe(true);
  });

  it('the target rule has the SHALLOWEST drawdown, which is the point it earns', () => {
    const target = RULES.find((r) => r.isTarget)!;
    const targetDD = maxDrawdown(runRule(target));
    for (const r of RULES) {
      if (r === target) continue;
      expect(targetDD, `${r.key}`).toBeGreaterThanOrEqual(maxDrawdown(runRule(r)));
    }
  });

  // The counterweight that keeps the slide honest: the naive rule DOES win on raw return, and the copy
  // must not pretend otherwise.
  it('a naive rule beats the target on raw return, so the copy cannot claim it wins outright', () => {
    const target = RULES.find((r) => r.isTarget)!;
    const naive = RULES.find((r) => r.key === 'all-equities')!;
    expect(finalValue(runRule(naive))).toBeGreaterThan(finalValue(runRule(target)));
  });

  it('every rule produces a finite, positive path', () => {
    for (const r of RULES) {
      for (const p of runRule(r)) {
        expect(Number.isFinite(p.value), r.key).toBe(true);
        expect(p.value, r.key).toBeGreaterThan(0);
      }
    }
  });
});

describe('path statistics', () => {
  it('realisedVol is zero for a constant-growth path', () => {
    const flat = runRule({ key: 'c', label: '', gloss: '', weights: () => [0, 0, 0, 1] }, PERIOD_RETURNS, 0);
    expect(realisedVol(flat)).toBeCloseTo(0, 6);
  });

  it('maxDrawdown is zero for a monotone path and negative when it falls', () => {
    const up = [{ period: 0, t: 0, value: 1, weights: [], costPaid: 0 },
                { period: 1, t: 1, value: 1.2, weights: [], costPaid: 0 }];
    const down = [{ period: 0, t: 0, value: 1, weights: [], costPaid: 0 },
                  { period: 1, t: 1, value: 0.8, weights: [], costPaid: 0 }];
    expect(maxDrawdown(up)).toBe(0);
    expect(maxDrawdown(down)).toBeCloseTo(-0.2, 9);
  });

  it('realisedVol degrades safely on a short path', () => {
    expect(realisedVol([])).toBe(0);
  });
});
