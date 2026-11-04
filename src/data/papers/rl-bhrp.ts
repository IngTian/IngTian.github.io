// src/data/papers/rl-bhrp.ts
// RL-BHRP's own numbers (arXiv:2508.11856v1), at the paper's precision, and its reproduction's series, so every
// figure its explainer and the homepage quote is computed from them (lib/paperNumbers.ts) rather than typed into
// prose, and every picture drawn from them (lib/paperFigures/).
import { rlBhrpWealth } from '../vendor/rlBhrpWealth';
import type { WealthSeries } from '../../lib/paperFigures/wealthFigure';
import { band, cumulative, pointwiseMedian } from '../../lib/wealth';

/** Table 2, "Full-Period Metrics": all 18 rows in the paper's order, values as printed (6 dp). Columns are
 *  RL-BHRP | BHRP | Benchmark. The benchmark's information ratio is NaN in the paper: its tracking error
 *  against itself is zero. */
export const TABLE2: readonly {
  metric: string;
  kind: 'pct' | 'ratio' | 'count' | 'date' | 'beta';
  values: readonly [number | string, number | string, number | string];
}[] = [
  { metric: 'Periods', kind: 'count', values: [67, 67, 67] },
  { metric: 'Start', kind: 'date', values: ['2020-02-29', '2020-02-29', '2020-02-29'] },
  { metric: 'End', kind: 'date', values: ['2025-08-31', '2025-08-31', '2025-08-31'] },
  { metric: 'Total Cumulative Return', kind: 'pct', values: [1.199612, 1.013672, 0.914063] },
  { metric: 'CAGR (Geometric Ann.)', kind: 'pct', values: [0.151637, 0.133563, 0.123310] },
  { metric: 'Annual Return (Mean×12)', kind: 'pct', values: [0.157213, 0.139742, 0.131883] },
  { metric: 'Annual Volatility', kind: 'pct', values: [0.173748, 0.165164, 0.172838] },
  { metric: 'Sharpe', kind: 'ratio', values: [0.904829, 0.846076, 0.763042] },
  { metric: 'Sortino', kind: 'ratio', values: [1.648382, 1.534682, 1.368210] },
  { metric: 'Max Drawdown', kind: 'pct', values: [-0.203308, -0.191023, -0.183210] },
  { metric: 'Calmar', kind: 'ratio', values: [0.745850, 0.699201, 0.673053] },
  { metric: 'Tracking Error', kind: 'pct', values: [0.036883, 0.035790, 0.000000] },
  { metric: 'Information Ratio', kind: 'ratio', values: [0.686752, 0.219576, NaN] },
  { metric: 'Beta', kind: 'beta', values: [0.982509, 0.935146, 1.000000] },
  { metric: 'Jensen Alpha', kind: 'pct', values: [0.027636, 0.016412, 0.000000] },
  { metric: 'VaR 5% (period)', kind: 'pct', values: [-0.074066, -0.067241, -0.079989] },
  { metric: 'CVaR 5% (period)', kind: 'pct', values: [-0.102409, -0.097049, -0.103351] },
  { metric: 'Hit Rate (>0)', kind: 'pct', values: [0.641791, 0.641791, 0.626866] },
];

/** The test window and the paper's other stated figures. `start`/`end` are the first and last month-ends of
 *  the 67 monthly periods; the last month is partial, the daily data ending at `dataEnd` (paper §4.1).
 *  `costBps` is RL-BHRP's cost per dollar traded. `turnover` and `top15` are paper §4.2: the mean monthly
 *  turnover (with its 95th percentile) and the share held by the 15 largest average weights (mean and range). */
export const PAPER = {
  months: 67,
  start: '2020-02-29',
  end: '2025-08-31',
  dataEnd: '2025-08-13',
  universe: 48,
  sectors: 11,
  costBps: 5,
  turnover: 0.60,
  turnoverP95: 0.85,
  top15: { mean: 0.50, lo: 0.40, hi: 0.61 },
} as const;

const runs = rlBhrpWealth.rlSeeds.map(cumulative);

/** The second author's reproduction (data/vendor/rlBhrpWealth.ts), as its figures and its quoted numbers read it:
 *  growth of $1 from the start of the month `dates[0]` ends, then one point at each month-end. `rl` is the
 *  month-by-month median of the `runs` and `lo`/`hi` their band (lib/wealth.ts says why a median and not a run). */
export const REPRO: WealthSeries = {
  dates: rlBhrpWealth.dates,
  runs: runs.length,
  rl: pointwiseMedian(runs),
  ...band(runs),
  bhrp: cumulative(rlBhrpWealth.bhrp),
  bench: cumulative(rlBhrpWealth.benchmark),
};
