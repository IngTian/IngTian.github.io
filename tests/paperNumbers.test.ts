// tests/paperNumbers.test.ts
// The figures RL-BHRP's prose quotes, pinned at the precision they print. A failure here means the paper's table,
// its window or the vendored reproduction moved under a sentence that quotes them, which is the point: the
// prose cannot be edited to follow, because it types no number.
import { describe, it, expect } from 'vitest';
import { TABLE2, PAPER, REPRO, REPRO_NOTES, paperValue } from '../src/data/papers/rl-bhrp';
import { PAPER_DATA } from '../src/data/papers';
import { rlBhrpWealth } from '../src/data/vendor/rlBhrpWealth';
import { cumulative, maxDrawdownFromStart } from '../src/lib/wealth';

const v = PAPER_DATA['rl-bhrp'].values;

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

describe('VALUES — the paper\'s figures', () => {
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

  it('prints no number with a sign or a tilde: magnitudes at a fixed precision, or dates', () => {
    const date = /^(?:\d{4}-\d{2}-\d{2}|(?:\d{1,2} )?[A-Z][a-z]+ \d{4})$/;
    for (const [k, s] of Object.entries(v)) expect(s, k).toMatch(new RegExp(`^\\$?\\d+(?:\\.\\d+)?$|${date.source}`));
  });

  it('quotes the window, the training years and how many monthly decisions they hold', () => {
    expect([v.start, v.end, v.dataEndIso]).toEqual(['2020-02-29', '2025-08-31', '2025-08-13']);
    expect([v.startMonth, v.endMonth, v.dataEnd]).toEqual(['February 2020', 'August 2025', '13 August 2025']);
    expect([v.startYear, v.endYear, v.trainFrom, v.trainTo]).toEqual(['2020', '2025', '2012', '2019']);
    expect(v.decisions).toBe('96');   // eight years of month-ends
  });

  it('counts the sector map: 48 stocks in 11 sectors of 2 to 10, IT the largest', () => {
    expect([v.universe, v.sectors, v.sectorMin, v.sectorMax, v.itStocks]).toEqual(['48', '11', '2', '10', '10']);
    // equal risk per stock gives IT 10 of the 48 shares, equal risk per sector 1 of the 11
    expect([v.itShareStocks, v.itShareSectors]).toEqual(['21', '9']);
  });

  it('quotes the cost per dollar and per month as percentages, and per year in points', () => {
    expect([v.costPct, v.costPctMonth, v.costPPYear]).toEqual(['0.05', '0.03', '0.36']);
  });

  it("quotes Table 2's BHRP CAGR as printed, for the erratum it corrects", () => {
    expect(v['tableCagr.bhrp']).toBe('0.133563');
    expect(v['cagr.bhrp']).toBe('13.36');
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

describe('VALUES — the reproduction\'s figures, from its vendored returns', () => {
  it("quotes the median line's edge over BHRP", () => {
    expect(v.reproGap).toBe('1.1');
  });

  it('quotes the drawdowns counted from the starting $1, which Table 2 cannot', () => {
    expect(v['mdd0.bhrp']).toBe('20.53');
    expect(v['mdd0.bench']).toBe('21.93');
    // RL-BHRP's own: the median line's, and the runs' shallowest and deepest
    expect([v['mdd0.rl'], v['mdd0.runsLo'], v['mdd0.runsHi']]).toEqual(['20.45', '19.95', '20.83']);
  });

  // The prose says the median line falls less than BHRP's, and that its runs fall either side of BHRP's.
  it('keeps the order the drawdown sentence states, unrounded and printed', () => {
    const fall = (w: readonly number[]) => -maxDrawdownFromStart(w);
    const runs = rlBhrpWealth.rlSeeds.map((r) => fall(cumulative(r))), bhrp = fall(REPRO.bhrp);
    expect(fall(REPRO.rl)).toBeLessThan(bhrp);
    expect(Math.min(...runs)).toBeLessThan(bhrp);
    expect(Math.max(...runs)).toBeGreaterThan(bhrp);
    expect(Number(v['mdd0.rl'])).toBeLessThan(Number(v['mdd0.bhrp']));
    expect(Number(v['mdd0.runsLo'])).toBeLessThan(Number(v['mdd0.bhrp']));
    expect(Number(v['mdd0.runsHi'])).toBeGreaterThan(Number(v['mdd0.bhrp']));
  });

  it("quotes its diagnostics from the vendored summary: turnover, BHRP's share in its top 15 and its cost", () => {
    expect([v.reproTurnover, v.reproTurnoverBhrp, v.reproTop15Bhrp]).toEqual(['0.14', '0.014', '51']);
    expect(v.reproCostPPYearBhrp).toBe('0.008');   // 0.014 a month at 5 bps, a year
    // the caption says the run with the median growth trades "about a quarter as much as the paper's"
    const share = REPRO_NOTES.turnover.rl / PAPER.turnover;
    expect(share).toBeGreaterThan(0.2);
    expect(share).toBeLessThan(0.3);
  });

  it('quotes both readings of the penalty, which barely differ, without rounding them into a tie', () => {
    expect([v.reproCagrGlobal, v.reproCagrSector]).toEqual(['14.55', '14.54']);
    const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(REPRO_NOTES.cagr.global).toHaveLength(REPRO.runs);
    expect(Math.sign(mean(REPRO_NOTES.cagr.global) - mean(REPRO_NOTES.cagr.sector))).toBe(1);
  });

  it("rebuilds the paper's BHRP and benchmark to the cent, which is what lets the page set them side by side", () => {
    expect(cumulative(rlBhrpWealth.bhrp).at(-1)!.toFixed(2)).toBe(v['usd.bhrp'].slice(1));
    expect(cumulative(rlBhrpWealth.benchmark).at(-1)!.toFixed(2)).toBe(v['usd.bench'].slice(1));
    expect(rlBhrpWealth.dates.length).toBe(PAPER.months);
  });
});

describe('paperValue and the homepage line', () => {
  it('throws on a key VALUES does not have, as an unknown :v fails the build', () => {
    expect(paperValue('usd.rl')).toBe(v['usd.rl']);
    expect(() => paperValue('usd.rll')).toThrow('unknown value "usd.rll" for rl-bhrp');
  });

  it("prints the appendix line from Table 2 over the paper's window", () => {
    expect(PAPER_DATA['rl-bhrp'].line).toBe('$1 → $2.20, Feb 2020 – Aug 2025 · Sharpe 0.90 vs 0.85 BHRP');
  });
});
