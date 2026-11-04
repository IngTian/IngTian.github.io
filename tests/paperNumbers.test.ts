// tests/paperNumbers.test.ts
// The figures RL-BHRP's prose quotes, pinned at the precision they print. A failure here means the paper's table,
// its window or the vendored reproduction moved under a sentence that quotes them, which is the point: the
// prose cannot be edited to follow, because it types no number.
import { describe, it, expect } from 'vitest';
import { TABLE2, PAPER } from '../src/data/papers/rl-bhrp';
import { PAPER_DATA } from '../src/data/papers';
import { rlBhrpValues } from '../src/lib/paperNumbers';
import { rlBhrpWealth } from '../src/data/vendor/rlBhrpWealth';
import { cumulative } from '../src/lib/wealth';

const v = rlBhrpValues(TABLE2, PAPER);

describe("Table 2, as the paper prints it", () => {
  it('has all 18 rows, in the paper\'s order (paper-pdf.txt, Table 2)', () => {
    expect(TABLE2.length).toBe(18);
    expect(TABLE2.map((r) => r.metric)).toEqual([
      'Periods', 'Start', 'End', 'Total Cumulative Return', 'CAGR (Geometric Ann.)', 'Annual Return (Mean×12)',
      'Annual Volatility', 'Sharpe', 'Sortino', 'Max Drawdown', 'Calmar', 'Tracking Error', 'Information Ratio',
      'Beta', 'Jensen Alpha', 'VaR 5% (period)', 'CVaR 5% (period)', 'Hit Rate (>0)',
    ]);
  });

  it('agrees with the window it is quoted over', () => {
    const at = (m: string) => TABLE2.find((r) => r.metric === m)!.values;
    expect(at('Periods')).toEqual([PAPER.months, PAPER.months, PAPER.months]);
    expect(at('Start')).toEqual([PAPER.start, PAPER.start, PAPER.start]);
    expect(at('End')).toEqual([PAPER.end, PAPER.end, PAPER.end]);
    // the benchmark's information ratio against itself is undefined; the paper prints NaN
    expect(Number.isNaN(at('Information Ratio')[2])).toBe(true);
  });
});

describe('rlBhrpValues — the paper\'s figures', () => {
  it('quotes what $1 became', () => {
    expect([v['usd.rl'], v['usd.bhrp'], v['usd.bench']]).toEqual(['$2.20', '$2.01', '$1.91']);
  });

  it('quotes the yearly edge, the t-statistic and the years it is over', () => {
    expect(v.gapPP).toBe('1.8');
    expect(v.tstat).toBe('1.6');   // information ratio x sqrt(67 / 12)
    expect(v.years).toBe('5.6');
  });

  it('quotes the trading cost per month from the turnover', () => {
    expect(v.costBpsMonth).toBe('3');   // 0.60 of the portfolio a month at 5 bps
  });

  it('prints no number with a sign or a tilde: magnitudes, at a fixed precision', () => {
    for (const [k, s] of Object.entries(v)) expect(s, k).toMatch(/^\$?\d+(?:\.\d+)?$/);
  });

  it('never rounds a comparison into a tie or a flip', () => {
    // each RL-BHRP figure the prose sets beside BHRP's must keep the sign of the unrounded difference
    const at = (m: string) => TABLE2.find((r) => r.metric === m)!.values as readonly number[];
    for (const [key, metric] of [['cagr', 'CAGR (Geometric Ann.)'], ['vol', 'Annual Volatility'], ['sharpe', 'Sharpe']]) {
      const [rl, bhrp] = at(metric);
      expect(Math.sign(Number(v[`${key}.rl`]) - Number(v[`${key}.bhrp`])), key).toBe(Math.sign(rl - bhrp));
    }
  });
});

describe('rlBhrpValues — the reproduction\'s figures, from its vendored returns', () => {
  it("quotes the median run's edge over BHRP", () => {
    expect(v.reproGap).toBe('1.1');
  });

  it('quotes the drawdowns counted from the starting $1, which Table 2 cannot', () => {
    expect(v['mdd0.bhrp']).toBe('20.53');
    expect(v['mdd0.bench']).toBe('21.93');
  });

  it("rebuilds the paper's BHRP and benchmark to the cent, which is what lets the page set them side by side", () => {
    expect(cumulative(rlBhrpWealth.bhrp).at(-1)!.toFixed(2)).toBe(v['usd.bhrp'].slice(1));
    expect(cumulative(rlBhrpWealth.benchmark).at(-1)!.toFixed(2)).toBe(v['usd.bench'].slice(1));
    expect(rlBhrpWealth.dates.length).toBe(PAPER.months);
  });
});

describe('PAPER_DATA', () => {
  it("serves RL-BHRP's values under its slug", () => {
    expect(PAPER_DATA['rl-bhrp'].values).toEqual(v);
  });
});
