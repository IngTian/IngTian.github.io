// src/data/papers/rl-bhrp.ts
// RL-BHRP's own numbers (arXiv:2508.11856v1), at the paper's precision, and its reproduction's series, so every
// figure its explainer and the homepage quote is computed from them (VALUES, below) rather than typed into prose,
// and every picture drawn from them (lib/paperFigures/).
import { rlBhrpDiagnostics } from '../vendor/rlBhrpDiagnostics';
import { rlBhrpWealth } from '../vendor/rlBhrpWealth';
import { longDate, monthYear } from '../../lib/dates';
import { band, cagr, cumulative, maxDrawdownFromStart, pointwiseMedian, type WealthSeries } from '../../lib/wealth';

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

/** Table 1 of the paper, its sector map: how many of the test's stocks each GICS sector holds. */
const SECTOR_SIZES = {
  'Information Technology': 10, 'Communication Services': 4, 'Consumer Discretionary': 4, 'Consumer Staples': 5,
  Financials: 5, Energy: 2, 'Health Care': 6, Industrials: 5, Utilities: 3, 'Real Estate': 2, Materials: 2,
} as const;

/** The test window and the paper's other stated figures. `start`/`end` are the first and last month-ends of
 *  the 67 monthly periods; the last month is partial, the daily data ending at `dataEnd` (paper §4.1). `train` is
 *  the span the model was designed and trained on, in whole years (paper §4: 1 January 2012 to 1 January 2020).
 *  `universe` and `sectors` count the sector map. `costBps` is RL-BHRP's cost per dollar traded. `turnover` and
 *  `top15` are paper §4.2: the mean monthly turnover (with its 95th percentile) and the share held by the 15
 *  largest average weights (mean and range). */
export const PAPER = {
  months: 67,
  start: '2020-02-29',
  end: '2025-08-31',
  dataEnd: '2025-08-13',
  train: { from: 2012, to: 2019 },
  sectorSizes: SECTOR_SIZES,
  universe: Object.values(SECTOR_SIZES).reduce((a: number, b) => a + b, 0),
  sectors: Object.keys(SECTOR_SIZES).length,
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
  dataEnd: PAPER.dataEnd,
};

/** What the explainer quotes about the reproduction beside its series (data/vendor/rlBhrpDiagnostics.ts): the
 *  monthly turnover of BHRP and of one run, the one with the median growth (of ten, the upper middle by CAGR, as the
 *  reproduction's run.py picks its "median seed"; the vendored summary gives no other run's), BHRP's share in its 15
 *  largest weights, and each run's CAGR under both readings of the paper's penalty: centred over all the stocks
 *  (Def. 3.2.3 as written, the runs above) and within each sector (as its Alg. 1's stopping test measures the
 *  dispersion). */
export const REPRO_NOTES = {
  turnover: rlBhrpDiagnostics.turnover,
  top15: rlBhrpDiagnostics.top15,
  cagr: {
    global: runs.map((w) => cagr(w[w.length - 1] - 1, w.length - 1)),
    sector: rlBhrpDiagnostics.sectorCentred.cagr,
  },
};

// ── The figures RL-BHRP's prose quotes, as the strings it prints. The paper's come from its Table 2 and stated
// window, the reproduction's from the series its figures draw and the notes beside them. Every value is a
// magnitude at a fixed precision, or a date, so a sentence supplies its own words ("a fall of", "about") and never
// a figure. ──

const COLUMNS = ['rl', 'bhrp', 'bench'] as const;
const pct = (x: number) => (x * 100).toFixed(2);
const usd = (wealth: number) => `$${wealth.toFixed(2)}`;
const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

function values() {
  const row = (metric: string): readonly number[] => {
    const r = TABLE2.find((x) => x.metric === metric);
    if (!r || r.values.some((x) => typeof x !== 'number')) throw new Error(`Table 2 has no numeric "${metric}" row`);
    return r.values as readonly number[];
  };
  /** One Table 2 row as three values, `<key>.rl`, `<key>.bhrp` and `<key>.bench`. */
  const each = <K extends string>(key: K, metric: string, fmt: (x: number) => string) =>
    Object.fromEntries(row(metric).map((x, i) => [`${key}.${COLUMNS[i]}`, fmt(x)])) as Record<`${K}.${(typeof COLUMNS)[number]}`, string>;

  const tot = row('Total Cumulative Return'), cg = row('CAGR (Geometric Ann.)'), ir = row('Information Ratio')[0];
  const years = PAPER.months / 12;
  // one standard error of an annual Sharpe ratio from iid monthly returns (Lo, 2002): sqrt((1 + SR_m^2 / 2) / T),
  // annualised by sqrt(12)
  const srMonthly = row('Sharpe')[0] / Math.sqrt(12);
  const sizes = Object.values(PAPER.sectorSizes), it = PAPER.sectorSizes['Information Technology'];
  // The reproduction: the month-by-month median of its runs (the red line), the band's ends (the lowest and the
  // highest run's), BHRP and the benchmark.
  const { rl, lo, hi, bhrp, bench, dates } = REPRO, months = dates.length;
  // falls counted from the starting $1, the one count all three series share: RL-BHRP's as the median line's, with the
  // shallowest and the deepest run's
  const falls = runs.map((w) => -maxDrawdownFromStart(w));

  return {
    ...each('usd', 'Total Cumulative Return', (x) => usd(1 + x)),
    'wealth.rl': (1 + tot[0]).toFixed(4),                          // the base of the CAGR worked example
    ...each('cagr', 'CAGR (Geometric Ann.)', pct),
    ...each('tableCagr', 'CAGR (Geometric Ann.)', (x) => x.toFixed(6)),   // as Table 2 prints it
    ...each('vol', 'Annual Volatility', pct),
    ...each('mdd', 'Max Drawdown', (x) => pct(-x)),               // a fall, from the first month-end
    ...each('sharpe', 'Sharpe', (x) => x.toFixed(2)),
    ...each('calmar', 'Calmar', (x) => x.toFixed(2)),
    'ir.rl': ir.toFixed(2),
    'beta.rl': row('Beta')[0].toFixed(2),
    gapPP: ((cg[0] - cg[1]) * 100).toFixed(1),                       // percentage points a year over BHRP
    'gapPP.bench': ((cg[0] - cg[2]) * 100).toFixed(1),
    years: years.toFixed(1),
    // t of the gap to the benchmark with roughly independent months: information ratio x sqrt(years)
    tstat: (ir * Math.sqrt(years)).toFixed(1),
    sharpeSE: (Math.sqrt((1 + srMonthly ** 2 / 2) / PAPER.months) * Math.sqrt(12)).toFixed(1),

    months: String(PAPER.months),
    start: PAPER.start,
    end: PAPER.end,
    dataEndIso: PAPER.dataEnd,
    startMonth: monthYear(PAPER.start),
    endMonth: monthYear(PAPER.end),
    dataEnd: longDate(PAPER.dataEnd),
    startYear: PAPER.start.slice(0, 4),
    endYear: PAPER.end.slice(0, 4),
    trainFrom: String(PAPER.train.from),
    trainTo: String(PAPER.train.to),
    decisions: String((PAPER.train.to - PAPER.train.from + 1) * 12),   // a decision at each month-end of the training years

    universe: String(PAPER.universe),
    sectors: String(PAPER.sectors),
    sectorMin: String(Math.min(...sizes)),
    sectorMax: String(Math.max(...sizes)),
    itStocks: String(it),
    // the IT sector's share of the risk when every stock carries an equal share, and when every sector does
    itShareStocks: String(Math.round((it / PAPER.universe) * 100)),
    itShareSectors: String(Math.round((1 / PAPER.sectors) * 100)),

    costBps: String(PAPER.costBps),
    costPct: (PAPER.costBps / 100).toFixed(2),                           // a basis point is 0.01%
    costPctMonth: ((PAPER.turnover * PAPER.costBps) / 100).toFixed(2),   // the month's turnover at that cost
    turnover: PAPER.turnover.toFixed(2),
    turnoverPct: String(Math.round(PAPER.turnover * 100)),
    turnoverP95: PAPER.turnoverP95.toFixed(2),
    costBpsMonth: (PAPER.turnover * PAPER.costBps).toFixed(0),
    costPPYear: ((PAPER.turnover * PAPER.costBps * 12) / 100).toFixed(2),
    'top15.mean': PAPER.top15.mean.toFixed(2),
    'top15.lo': PAPER.top15.lo.toFixed(2),
    'top15.hi': PAPER.top15.hi.toFixed(2),
    top15Equal: String(Math.round((15 / PAPER.universe) * 100)),        // % that any 15 hold at equal weights

    reproRuns: String(REPRO.runs),
    reproEnd: usd(rl.at(-1)!),
    reproLo: usd(lo.at(-1)!),
    reproHi: usd(hi.at(-1)!),
    reproGap: ((cagr(rl.at(-1)! - 1, months) - cagr(bhrp.at(-1)! - 1, months)) * 100).toFixed(1),
    'mdd0.rl': pct(-maxDrawdownFromStart(rl)),
    'mdd0.runsLo': pct(Math.min(...falls)),
    'mdd0.runsHi': pct(Math.max(...falls)),
    'mdd0.bhrp': pct(-maxDrawdownFromStart(bhrp)),
    'mdd0.bench': pct(-maxDrawdownFromStart(bench)),
    // its diagnostics: the monthly turnover of the run with the median growth and of BHRP, BHRP's share in its top 15
    // and what its turnover costs a year at the paper's rate, and the mean CAGR of the runs under each reading of the penalty
    reproTurnover: REPRO_NOTES.turnover.rl.toFixed(2),
    reproTurnoverBhrp: REPRO_NOTES.turnover.bhrp.toFixed(3),
    reproTop15Bhrp: String(Math.round(REPRO_NOTES.top15.bhrp * 100)),
    reproCostPPYearBhrp: ((REPRO_NOTES.turnover.bhrp * PAPER.costBps * 12) / 100).toFixed(3),
    reproCagrGlobal: pct(mean(REPRO_NOTES.cagr.global)),
    reproCagrSector: pct(mean(REPRO_NOTES.cagr.sector)),
  };
}

/** Every figure the explainer (a `:v`) and the homepage quote. Keys are `<measure>.<column>` (columns rl, bhrp,
 *  bench) or a bare name for a single figure. */
export const VALUES = values();
/** A key of VALUES: what TypeScript may quote. */
export type ValueKey = keyof typeof VALUES;

/** One of VALUES, for the TypeScript that quotes them. The key is typed, so a typo or a renamed key is a type error;
 *  and since the build strips types without checking them, an unknown key also throws, as an unknown `:v` fails the
 *  build, rather than printing "undefined". */
export function paperValue(key: ValueKey): string {
  const v = (VALUES as Record<string, string | undefined>)[key];
  if (v === undefined) throw new Error(`unknown value "${key}" for rl-bhrp`);
  return v;
}
