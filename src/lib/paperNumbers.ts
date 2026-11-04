// src/lib/paperNumbers.ts
// The figures RL-BHRP's prose quotes, as the strings it prints. The paper's come from its Table 2 and stated
// window, the reproduction's from the series its figures draw (all three in data/papers/rl-bhrp.ts). Every value
// is a magnitude at a fixed precision, so a sentence supplies its own words ("a fall of", "about") and never a
// figure. Pure.
import type { TABLE2, PAPER, REPRO } from '../data/papers/rl-bhrp';
import { cagr, maxDrawdownFromStart } from './wealth';

const COLUMNS = ['rl', 'bhrp', 'bench'] as const;
const pct = (x: number) => (x * 100).toFixed(2);
const usd = (wealth: number) => `$${wealth.toFixed(2)}`;

/** Keys are `<measure>.<column>` (columns rl, bhrp, bench) or a bare name for a single figure. */
export function rlBhrpValues(t: typeof TABLE2, p: typeof PAPER, repro: typeof REPRO): Record<string, string> {
  const row = (metric: string): readonly number[] => {
    const r = t.find((x) => x.metric === metric);
    if (!r || r.values.some((x) => typeof x !== 'number')) throw new Error(`Table 2 has no numeric "${metric}" row`);
    return r.values as readonly number[];
  };
  const v: Record<string, string> = {};
  const each = (key: string, metric: string, fmt: (x: number) => string) =>
    row(metric).forEach((x, i) => { v[`${key}.${COLUMNS[i]}`] = fmt(x); });

  const tot = row('Total Cumulative Return'), cg = row('CAGR (Geometric Ann.)');
  const years = p.months / 12;
  each('usd', 'Total Cumulative Return', (x) => usd(1 + x));
  v['wealth.rl'] = (1 + tot[0]).toFixed(4);                        // the base of the CAGR worked example
  each('cagr', 'CAGR (Geometric Ann.)', pct);
  each('vol', 'Annual Volatility', pct);
  each('mdd', 'Max Drawdown', (x) => pct(-x));                     // a fall, from the first month-end
  each('sharpe', 'Sharpe', (x) => x.toFixed(2));
  each('calmar', 'Calmar', (x) => x.toFixed(2));
  v['ir.rl'] = row('Information Ratio')[0].toFixed(2);
  v['beta.rl'] = row('Beta')[0].toFixed(2);
  v.gapPP = ((cg[0] - cg[1]) * 100).toFixed(1);                     // percentage points a year over BHRP
  v['gapPP.bench'] = ((cg[0] - cg[2]) * 100).toFixed(1);
  v.years = years.toFixed(1);
  // t of the gap to the benchmark with roughly independent months: information ratio x sqrt(years)
  v.tstat = (row('Information Ratio')[0] * Math.sqrt(years)).toFixed(1);
  // one standard error of an annual Sharpe ratio from iid monthly returns (Lo, 2002): sqrt((1 + SR_m^2 / 2) / T),
  // annualised by sqrt(12)
  const srMonthly = row('Sharpe')[0] / Math.sqrt(12);
  v.sharpeSE = (Math.sqrt((1 + srMonthly ** 2 / 2) / p.months) * Math.sqrt(12)).toFixed(1);

  v.months = String(p.months);
  v.universe = String(p.universe);
  v.sectors = String(p.sectors);
  v.costBps = String(p.costBps);
  v.turnover = p.turnover.toFixed(2);
  v.turnoverPct = String(Math.round(p.turnover * 100));
  v.turnoverP95 = p.turnoverP95.toFixed(2);
  v.costBpsMonth = (p.turnover * p.costBps).toFixed(0);
  v.costPPYear = ((p.turnover * p.costBps * 12) / 100).toFixed(2);
  v['top15.mean'] = p.top15.mean.toFixed(2);
  v['top15.lo'] = p.top15.lo.toFixed(2);
  v['top15.hi'] = p.top15.hi.toFixed(2);
  v.top15Equal = String(Math.round((15 / p.universe) * 100));      // % that any 15 hold at equal weights

  // The reproduction: the month-by-month median of its runs (the red line), the band's ends (the lowest and the
  // highest run's), BHRP and the benchmark.
  const { rl, lo, hi, bhrp, bench, dates } = repro, months = dates.length;
  v.reproRuns = String(repro.runs);
  v.reproEnd = usd(rl.at(-1)!);
  v.reproLo = usd(lo.at(-1)!);
  v.reproHi = usd(hi.at(-1)!);
  v.reproGap = ((cagr(rl.at(-1)! - 1, months) - cagr(bhrp.at(-1)! - 1, months)) * 100).toFixed(1);
  v['mdd0.bhrp'] = pct(-maxDrawdownFromStart(bhrp));
  v['mdd0.bench'] = pct(-maxDrawdownFromStart(bench));
  return v;
}
