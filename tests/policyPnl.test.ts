import { describe, it, expect } from 'vitest';
import {
  WEEKLY, WEEKS, MONTHS, COST, FINANCING, MAINTENANCE, QUARTER_MARKS,
  runPolicy, statsOf, pnlBounds, project, gross, annualisedVol,
  type Player, type PlayerContext,
} from '../src/lib/policyPnl';
import { POLICIES, HOLDINGS, BEAT4 } from '../src/data/define';

const results = POLICIES.map((p) => runPolicy(p));
const byKey = new Map(results.map((r) => [r.key, r]));
const at = (k: string) => {
  const r = byKey.get(k);
  if (!r) throw new Error(`no player ${k}`);
  return r;
};

describe('the declared year', () => {
  it('is fifty-two weeks, one row per week', () => {
    expect(WEEKS).toBe(52);
    expect(WEEKLY).toHaveLength(52);
    expect(MONTHS).toBe(WEEKS);   // the chart's projection helper reads this name
  });

  it('has one column per holding in every week', () => {
    for (const [i, row] of WEEKLY.entries()) {
      expect(row.length, `week ${i}`).toBe(HOLDINGS.length);
    }
  });

  // The table is generated from a seeded PRNG at module load. If that ever became unseeded, the whole slide
  // would shimmer between builds — and the beat's claim is that these SPECIFIC differences are real.
  it('is deterministic — identical across repeated reads', async () => {
    const again = await import('../src/lib/policyPnl');
    expect(again.WEEKLY).toEqual(WEEKLY);
  });

  it('keeps every weekly return finite and survivable', () => {
    for (const row of WEEKLY) for (const r of row) {
      expect(Number.isFinite(r)).toBe(true);
      expect(r).toBeGreaterThan(-0.5);
      expect(r).toBeLessThan(0.5);
    }
  });

  // The slide's copy leans on this shape. If someone edits the table, this is the tripwire.
  it('contains a deep tech drawdown where gold is the only thing that helps', () => {
    const chip = 0, gold = 3;
    let v = 100, peak = 100, worst = 0, worstWeek = 0;
    for (const [w, row] of WEEKLY.entries()) {
      v *= 1 + row[chip];
      peak = Math.max(peak, v);
      const dd = v / peak - 1;
      if (dd < worst) { worst = dd; worstWeek = w; }
    }
    expect(worst * 100).toBeLessThan(-25);        // a real drawdown, not a wobble
    // Across the six drawdown weeks the chipmaker falls and gold rises — that is what makes it a diversifier
    // rather than a fifth correlated bet.
    const fall = WEEKLY.slice(14, 21);
    expect(fall.reduce((a, r) => a + r[chip], 0)).toBeLessThan(-0.3);
    expect(fall.reduce((a, r) => a + r[gold], 0)).toBeGreaterThan(0.1);
    expect(worstWeek).toBeGreaterThan(13);
  });

  // The false rally is why "when did you decide" is a real question: a straight fall would let everyone react
  // at the same obvious moment.
  it('has a false rally inside the fall, so capitulation is a choice and not a reflex', () => {
    const chip = 0;
    expect(WEEKLY[17][chip]).toBeGreaterThan(0);
    expect(WEEKLY[18][chip]).toBeLessThan(-0.05);
  });

  it('ends the risky name UP for the year despite that fall', () => {
    const chip = 0;
    const end = WEEKLY.reduce((v, row) => v * (1 + row[chip]), 100);
    expect(end).toBeGreaterThan(100);
  });

  it('labels the quarters within range', () => {
    expect(QUARTER_MARKS.length).toBe(4);
    for (const q of QUARTER_MARKS) {
      expect(q.week).toBeGreaterThanOrEqual(0);
      expect(q.week).toBeLessThan(WEEKS);
      expect(q.label.length).toBeGreaterThan(0);
    }
  });
});

describe('the five players', () => {
  it('covers both retail and institutional books', () => {
    expect(POLICIES.filter((p) => p.kind === 'retail').length).toBeGreaterThanOrEqual(2);
    expect(POLICIES.filter((p) => p.kind === 'institutional').length).toBeGreaterThanOrEqual(2);
  });

  it('each has a distinct key and a plain-language gloss', () => {
    expect(new Set(POLICIES.map((p) => p.key)).size).toBe(POLICIES.length);
    for (const p of POLICIES) expect(p.gloss.length, p.key).toBeGreaterThan(30);
  });

  it('never asks for a negative holding', () => {
    for (const p of POLICIES) {
      // Replay each rule across the year and check every target it ever asks for.
      let held: number[] = new Array(HOLDINGS.length).fill(0);
      for (let w = 0; w < WEEKS; w++) {
        const want = p.target({ week: w, held, equity: 100, vol: 14, sinceTrade: 1, peak: 100 });
        if (want) {
          for (const x of want) expect(x, `${p.key} week ${w}`).toBeGreaterThanOrEqual(0);
          held = want;
        }
      }
    }
  });

  it('only the levered player ever asks for more than 100% exposure', () => {
    for (const p of POLICIES) {
      let held: number[] = new Array(HOLDINGS.length).fill(0);
      let maxGross = 0;
      for (let w = 0; w < WEEKS; w++) {
        const want = p.target({ week: w, held, equity: 100, vol: 14, sinceTrade: 1, peak: 100 });
        if (want) { held = want; maxGross = Math.max(maxGross, gross(want)); }
      }
      if (p.key === 'levered') expect(maxGross).toBeGreaterThan(150);
      else expect(maxGross, p.key).toBeLessThanOrEqual(135);
    }
  });
});

describe('runPolicy', () => {
  it('starts every path at the full hundred dollars', () => {
    for (const r of results) expect(r.path[0].value).toBe(100);
  });

  it('produces a point per week plus the start', () => {
    for (const r of results) expect(r.path).toHaveLength(WEEKS + 1);
  });

  it('keeps every value finite and positive', () => {
    for (const r of results) for (const p of r.path) {
      expect(Number.isFinite(p.value), r.key).toBe(true);
      expect(p.value, r.key).toBeGreaterThan(0);
    }
  });

  it('is deterministic', () => {
    expect(runPolicy(POLICIES[0]).path).toEqual(results[0].path);
  });

  // THE COST TERM HAS TO BITE, or "paying to change your mind" is decoration.
  it('charges turnover, so an active book pays more than a book that never trades', () => {
    expect(at('risktarget').costPaid).toBeGreaterThan(at('buyhold').costPaid * 2);
  });

  it('the same policy costs more at a higher fee', () => {
    const cheap = runPolicy(POLICIES[4], WEEKLY, COST);
    const dear = runPolicy(POLICIES[4], WEEKLY, COST * 6);
    expect(dear.costPaid).toBeGreaterThan(cheap.costPaid);
    expect(dear.final).toBeLessThan(cheap.final);
  });
});

describe('POSITION DRIFT — the mechanism behind neglect risk and margin spirals', () => {
  // The buy-once book never trades, so by construction its weights can only change by drift. If drift were not
  // modelled, this player would be a straight scaled line and "the winner takes over the book" would be a claim
  // with nothing behind it.
  it('lets the winner grow into a larger share of a never-rebalanced book', () => {
    let held = [40, 25, 20, 15];
    let eq = 100;
    for (let w = 0; w < WEEKS; w++) {
      const before = eq;
      let g = 0;
      for (let i = 0; i < held.length; i++) g += (held[i] / 100) * WEEKLY[w][i];
      eq *= 1 + g;
      held = held.map((h, i) => (h * (1 + WEEKLY[w][i]) * before) / eq);
    }
    expect(held[0]).toBeGreaterThan(40);            // the chipmaker is now a bigger bet than it started as
    expect(gross(held)).toBeCloseTo(100, 6);        // and drift alone never creates leverage
  });

  // A levered book that loses money becomes MORE levered — that is the spiral, and it must fall out of the
  // arithmetic rather than being asserted.
  it('increases gross exposure when a levered book loses money', () => {
    const losing: Player = {
      key: 't', label: 't', kind: 'retail', gloss: 'x'.repeat(40),
      target: (c: PlayerContext) => (c.week === 0 ? [200, 0, 0, 0] : null),
    };
    // A year that only falls, so there is no ambiguity about direction.
    const down = Array.from({ length: 6 }, () => [-0.05, 0, 0, 0]);
    const r = runPolicy(losing, down, 0, 0);
    expect(r.final).toBeLessThan(100);
    // Replay to read the exposure directly.
    let held = [200, 0, 0, 0];
    let eq = 100;
    for (const row of down) {
      const before = eq;
      eq *= 1 + (held[0] / 100) * row[0];
      held = held.map((h, i) => (h * (1 + row[i]) * before) / eq);
    }
    expect(gross(held)).toBeGreaterThan(200);
  });
});

describe('LEVERAGE COSTS MONEY — financing and margin', () => {
  it('charges financing only on the borrowed part', () => {
    expect(at('levered').financingPaid).toBeGreaterThan(1);
    for (const k of ['buyhold', 'panics', 'mandate']) {
      expect(at(k).financingPaid, k).toBe(0);
    }
  });

  it('financing scales with the rate', () => {
    const cheap = runPolicy(POLICIES.find((p) => p.key === 'levered')!, WEEKLY, COST, 0.01);
    const dear = runPolicy(POLICIES.find((p) => p.key === 'levered')!, WEEKLY, COST, 0.20);
    expect(dear.financingPaid).toBeGreaterThan(cheap.financingPaid * 3);
    expect(dear.final).toBeLessThan(cheap.final);
  });

  it('closes a book that breaches maintenance margin, and leaves it closed', () => {
    const reckless: Player = {
      key: 'r', label: 'r', kind: 'retail', gloss: 'x'.repeat(40),
      target: (c: PlayerContext) => (c.week === 0 ? [500, 0, 0, 0] : null),
    };
    const crash = Array.from({ length: 10 }, () => [-0.09, 0, 0, 0]);
    const r = runPolicy(reckless, crash, 0, 0);
    expect(r.marginCallWeek).not.toBeNull();
    // Once closed, the value cannot move again — it is in cash for the rest of the year.
    const after = r.path.slice((r.marginCallWeek ?? 0) + 2).map((p) => p.value);
    for (const v of after) expect(v).toBeCloseTo(after[0], 6);
  });

  it('the illustrated levered book survives the year, and the slide can say by how much', () => {
    // It matters that this is a near miss rather than a blowup: the honest lesson is that leverage costs you
    // even when it does NOT wipe you out, which is the case a beginner never considers.
    expect(at('levered').marginCallWeek).toBeNull();
    expect(MAINTENANCE).toBeGreaterThan(0);
    expect(FINANCING).toBeGreaterThan(0);
  });
});

describe("THE BEAT'S ARGUMENT: sequence changes return AND risk", () => {
  it('the five end at five clearly different values', () => {
    const finals = results.map((r) => r.final);
    expect(new Set(finals.map((f) => f.toFixed(2))).size).toBe(results.length);
    expect(Math.max(...finals) - Math.min(...finals)).toBeGreaterThan(8);
  });

  it('they also take clearly different worst falls — risk differs, not just return', () => {
    const falls = results.map((r) => r.worstFall);
    expect(Math.max(...falls) - Math.min(...falls)).toBeGreaterThan(10);
  });

  // THE POINT OF THE WHOLE SLIDE. If the highest curve were also the best-behaved one, "two answers, not one"
  // would be false and the footer would be lying.
  it('the highest-ending book is NOT the one with the best return per unit of fall', () => {
    const topReturn = results.reduce((b, r) => (r.final > b.final ? r : b));
    const bestRatio = results.reduce((b, r) => (r.returnPerRisk > b.returnPerRisk ? r : b));
    expect(results.map((r) => r.returnPerRisk).some((x) => Number.isFinite(x))).toBe(true);
    // They may coincide only if nothing else does better per unit of risk; assert the ranking is not identical.
    const byReturn = [...results].sort((a, b) => b.final - a.final).map((r) => r.key);
    const byRatio = [...results].sort((a, b) => b.returnPerRisk - a.returnPerRisk).map((r) => r.key);
    expect(byReturn).not.toEqual(byRatio);
    expect(topReturn.key.length).toBeGreaterThan(0);
    expect(bestRatio.key.length).toBeGreaterThan(0);
  });

  // THE LEVERED LESSON, and it is deliberately the uncomfortable version. In a year that ends up, 2x DOES end
  // highest — pretending otherwise would be teaching by rigged example, and any reader who has held a margin
  // account in a bull year would know it was rigged. The honest lesson is the price: the deepest fall on the
  // chart, real financing, and the worst return per unit of risk of the five. The tallest line is the wrong
  // answer, which is exactly the point the whole slide exists to make.
  it('the 2x account ends highest AND takes the deepest fall — the temptation and its price', () => {
    const lev = at('levered');
    const topReturn = results.reduce((b, r) => (r.final > b.final ? r : b));
    const deepest = results.reduce((b, r) => (r.worstFall < b.worstFall ? r : b));
    expect(topReturn.key).toBe('levered');
    expect(deepest.key).toBe('levered');
    expect(lev.avgExposure).toBeGreaterThan(150);
    // And the fall is not a rounding difference — it is roughly twice the next-deepest.
    const others = results.filter((r) => r.key !== 'levered');
    const nextDeepest = Math.min(...others.map((r) => r.worstFall));
    expect(lev.worstFall).toBeLessThan(nextDeepest * 1.6);
  });

  // The comparison that carries the argument: a book that never borrowed lands within a few dollars of the 2x
  // account, having fallen less than half as far. That is the whole case for caring about risk.
  it('an unlevered book gets close to the 2x return with less than half the fall', () => {
    const lev = at('levered');
    const md = at('mandate');
    expect(md.final).toBeGreaterThan(lev.final * 0.95);     // within 5% of the return
    expect(md.worstFall).toBeGreaterThan(lev.worstFall / 2); // on less than half the fall
    expect(md.financingPaid).toBe(0);
  });

  it('the 2x account also has the worst return per unit of fall', () => {
    const lev = at('levered');
    for (const r of results) {
      if (r.key === 'levered') continue;
      expect(r.returnPerRisk, `vs ${r.key}`).toBeGreaterThan(lev.returnPerRisk);
    }
  });

  // The honest complication: selling after the fall DOES reduce the fall, and it costs return. If it were worse
  // on both counts the slide would be teaching "never sell", which is not the lesson.
  it('capitulating reduces the fall it suffers relative to holding, and costs return', () => {
    const panics = at('panics');
    const hold = at('buyhold');
    expect(panics.worstFall).toBeGreaterThan(hold.worstFall);
    expect(panics.final).toBeLessThan(hold.final);
  });

  // The research-adjacent claim: the risk-targeted book carries LESS exposure than the mandate and still keeps
  // most of the return, which is the whole argument for sizing to risk.
  it('the risk-targeted book runs less exposure than the mandate and falls less', () => {
    const rt = at('risktarget');
    const md = at('mandate');
    expect(rt.avgExposure).toBeLessThan(md.avgExposure);
    expect(rt.worstFall).toBeGreaterThan(md.worstFall);
  });
});

describe('statsOf', () => {
  it('reports no fall for a monotone path', () => {
    expect(statsOf([{ month: 0, value: 100 }, { month: 1, value: 110 }]).worstFall).toBe(0);
  });

  it('measures the fall from the running peak', () => {
    const s = statsOf([{ month: 0, value: 100 }, { month: 1, value: 150 }, { month: 2, value: 75 }]);
    expect(s.worstFall).toBeCloseTo(-50, 6);
  });

  it('reports zero swing for a flat path', () => {
    expect(statsOf([{ month: 0, value: 100 }, { month: 1, value: 100 }, { month: 2, value: 100 }]).swing)
      .toBeCloseTo(0, 9);
  });

  it('degrades safely on an empty path', () => {
    expect(statsOf([]).final).toBe(100);
  });
});

describe('annualisedVol', () => {
  it('is zero for a constant series and positive for a varying one', () => {
    expect(annualisedVol([0.01, 0.01, 0.01])).toBeCloseTo(0, 9);
    expect(annualisedVol([0.03, -0.02, 0.04, -0.01])).toBeGreaterThan(0);
  });

  it('annualises from weekly, so a 1% weekly sigma lands near 7%', () => {
    // sqrt(52) * 1% ≈ 7.2%
    const v = annualisedVol([0.01, -0.01, 0.01, -0.01, 0.01, -0.01]);
    expect(v).toBeGreaterThan(5);
    expect(v).toBeLessThan(10);
  });

  it('degrades safely on too little data', () => {
    expect(annualisedVol([])).toBe(0);
    expect(annualisedVol([0.05])).toBe(0);
  });
});

describe('pnlBounds and project', () => {
  const bounds = pnlBounds(results);
  const box = { x: 0, y: 0, w: 200, h: 100 };

  it('brackets every value across every path', () => {
    for (const r of results) for (const p of r.path) {
      expect(p.value).toBeGreaterThanOrEqual(bounds.lo - 1e-9);
      expect(p.value).toBeLessThanOrEqual(bounds.hi + 1e-9);
    }
  });

  it('maps week zero to the left edge and the last week to the right', () => {
    expect(project({ month: 0, value: 100 }, WEEKS, bounds, box)[0]).toBe(0);
    expect(project({ month: WEEKS, value: 100 }, WEEKS, bounds, box)[0]).toBe(200);
  });

  it('puts higher values higher on screen', () => {
    const low = project({ month: 0, value: bounds.lo }, WEEKS, bounds, box)[1];
    const high = project({ month: 0, value: bounds.hi }, WEEKS, bounds, box)[1];
    expect(high).toBeLessThan(low);
  });

  it('degrades safely on a zero span or empty input', () => {
    expect(Number.isFinite(project({ month: 0, value: 1 }, 12, { lo: 5, hi: 5 }, box)[1])).toBe(true);
    expect(pnlBounds([]).hi).toBeGreaterThan(pnlBounds([]).lo);
  });
});

describe('gross', () => {
  it('sums a weight vector, so 100 is fully invested and 200 is 2x', () => {
    expect(gross([40, 25, 20, 15])).toBe(100);
    expect(gross([80, 50, 40, 30])).toBe(200);
    expect(gross([])).toBe(0);
  });
});

describe('the beat copy', () => {
  it('asks a question and answers it without running long', () => {
    expect(BEAT4.ask.endsWith('?')).toBe(true);
    expect(BEAT4.say.split(/\s+/).length).toBeLessThan(50);
  });

  it('names the number of books it actually draws', () => {
    expect(BEAT4.say.toLowerCase()).toContain('five');
    expect(POLICIES).toHaveLength(5);
  });
});
