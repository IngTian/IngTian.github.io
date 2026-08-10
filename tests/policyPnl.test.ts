import { describe, it, expect } from 'vitest';
import {
  MONTHLY, MONTHS, COST, runPolicy, statsOf, pnlBounds, project, type Policy,
} from '../src/lib/policyPnl';
import { POLICIES, HOLDINGS, BEAT4 } from '../src/data/define';

const results = POLICIES.map((p) => runPolicy(p));
const byKey = new Map(results.map((r) => [r.key, r]));

describe('the declared year', () => {
  it('has one column per holding in every month', () => {
    for (const [i, row] of MONTHLY.entries()) {
      expect(row.length, `month ${i}`).toBe(HOLDINGS.length);
    }
  });

  it('is twelve months', () => {
    expect(MONTHS).toBe(12);
  });

  it('is deterministic — the same table on every read', () => {
    expect(MONTHLY).toEqual(MONTHLY.map((r) => [...r]));
  });

  // The year is hand-authored to be legible as a STORY rather than as noise, and the slide's copy leans on
  // that shape: a drawdown where only gold helps. If someone edits the table, this is the tripwire.
  it('contains a real tech drawdown where gold is the only thing that helps', () => {
    const chip = 0, gold = 3;
    const worst = MONTHLY.reduce((w, r, i) => (r[chip] < MONTHLY[w][chip] ? i : w), 0);
    expect(MONTHLY[worst][chip]).toBeLessThan(-0.1);
    expect(MONTHLY[worst][gold]).toBeGreaterThan(0);
  });
});

describe('the four policies', () => {
  it('each has a weight vector for every month', () => {
    for (const p of POLICIES) {
      expect(p.weights.length, p.key).toBe(MONTHS);
      for (const row of p.weights) expect(row.length, p.key).toBe(HOLDINGS.length);
    }
  });

  it('every split allocates the whole hundred', () => {
    for (const p of POLICIES) {
      for (const [m, row] of p.weights.entries()) {
        const sum = row.reduce((a, b) => a + b, 0);
        expect(sum, `${p.key} month ${m}`).toBeCloseTo(100, 6);
      }
    }
  });

  it('nobody holds a negative amount', () => {
    for (const p of POLICIES) for (const row of p.weights) for (const w of row) {
      expect(w).toBeGreaterThanOrEqual(0);
    }
  });

  it('each has a distinct key and a plain-language gloss', () => {
    expect(new Set(POLICIES.map((p) => p.key)).size).toBe(POLICIES.length);
    for (const p of POLICIES) expect(p.gloss.length, p.key).toBeGreaterThan(20);
  });
});

describe('runPolicy', () => {
  it('starts every path at the full hundred dollars', () => {
    for (const r of results) expect(r.path[0].value).toBe(100);
  });

  it('produces a point per month plus the start', () => {
    for (const r of results) expect(r.path).toHaveLength(MONTHS + 1);
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

  // THE COST TERM HAS TO BITE, or "paying to change your mind" is decoration. The chaser reshuffles most, so
  // it must pay most — by a clear margin over the one that never trades.
  it('charges turnover, so the chaser pays far more than the sitter', () => {
    expect(byKey.get('chases')!.costPaid).toBeGreaterThan(byKey.get('never')!.costPaid * 3);
  });

  it('the same policy costs more at a higher fee', () => {
    const cheap = runPolicy(POLICIES[2], MONTHLY, COST);
    const dear = runPolicy(POLICIES[2], MONTHLY, COST * 4);
    expect(dear.costPaid).toBeGreaterThan(cheap.costPaid);
    expect(dear.final).toBeLessThan(cheap.final);
  });
});

describe('THE BEAT\'S ARGUMENT: sequence changes return AND risk', () => {
  // This is what the beat exists to show, and both halves must be true or the copy overstates it.
  it('the four end at four clearly different values', () => {
    const finals = results.map((r) => r.final);
    expect(new Set(finals.map((f) => f.toFixed(2))).size).toBe(results.length);
    expect(Math.max(...finals) - Math.min(...finals)).toBeGreaterThan(8);
  });

  it('they also take clearly different worst falls — risk differs, not just return', () => {
    const falls = results.map((r) => r.worstFall);
    expect(Math.max(...falls) - Math.min(...falls)).toBeGreaterThan(4);
  });

  it('the measured policy ends highest AND falls least, which is the point being made', () => {
    const measured = byKey.get('measured')!;
    for (const r of results) {
      if (r.key === 'measured') continue;
      expect(measured.final, `vs ${r.key}`).toBeGreaterThan(r.final);
      expect(measured.worstFall, `vs ${r.key}`).toBeGreaterThan(r.worstFall);
    }
  });

  it('the chaser is punished on both counts, which is why chasing is a lesson', () => {
    const chases = byKey.get('chases')!;
    const never = byKey.get('never')!;
    expect(chases.final).toBeLessThan(never.final);
    expect(chases.worstFall).toBeLessThan(never.worstFall);
  });

  // The honest complication: panicking reduces the FALL but costs return. If it were worse on both counts the
  // slide would be teaching "never sell", which is not the lesson.
  it('panicking does reduce the fall, even though it costs return', () => {
    const panics = byKey.get('panics')!;
    const never = byKey.get('never')!;
    expect(panics.worstFall).toBeGreaterThan(never.worstFall);
    expect(panics.final).toBeLessThan(never.final);
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

describe('pnlBounds and project', () => {
  const bounds = pnlBounds(results);
  const box = { x: 0, y: 0, w: 200, h: 100 };

  it('brackets every value across every path', () => {
    for (const r of results) for (const p of r.path) {
      expect(p.value).toBeGreaterThanOrEqual(bounds.lo - 1e-9);
      expect(p.value).toBeLessThanOrEqual(bounds.hi + 1e-9);
    }
  });

  it('maps month zero to the left edge and the last month to the right', () => {
    expect(project({ month: 0, value: 100 }, MONTHS, bounds, box)[0]).toBe(0);
    expect(project({ month: MONTHS, value: 100 }, MONTHS, bounds, box)[0]).toBe(200);
  });

  it('puts higher values higher on screen', () => {
    const low = project({ month: 0, value: bounds.lo }, MONTHS, bounds, box)[1];
    const high = project({ month: 0, value: bounds.hi }, MONTHS, bounds, box)[1];
    expect(high).toBeLessThan(low);
  });

  it('degrades safely on a zero span or empty input', () => {
    expect(Number.isFinite(project({ month: 0, value: 1 }, 12, { lo: 5, hi: 5 }, box)[1])).toBe(true);
    expect(pnlBounds([]).hi).toBeGreaterThan(pnlBounds([]).lo);
  });
});

describe('the beat copy', () => {
  it('asks a question and answers it without running long', () => {
    expect(BEAT4.ask.endsWith('?')).toBe(true);
    expect(BEAT4.say.split(/\s+/).length).toBeLessThan(45);
  });
});
