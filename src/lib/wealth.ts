// src/lib/wealth.ts
// Growth-of-$1 arithmetic, the shape of a prepared series and chart scaffolding for every picture of a wealth run
// (lib/paperFigures/wealthFigure.ts draws the paper page's, lib/projectVisuals.ts /projects' one), so a run drawn on
// two pages shows one line and one set of numbers. Pure.

/** A reproduction's runs as every picture of them reads them, each series as wealth from 1 (data/papers/rl-bhrp.ts
 *  REPRO prepares RL-BHRP's): the runs' month-by-month median and their band, BHRP and the benchmark. */
export interface WealthSeries {
  dates: readonly string[];   // the month-ends; every series has one point more, the start
  dataEnd: string;            // the last day of data: the last month runs from its month-end to here
  runs: number;               // how many runs `rl` is the median of, and `lo`/`hi` the band of
  rl: readonly number[];
  lo: readonly number[];
  hi: readonly number[];
  bhrp: readonly number[];
  bench: readonly number[];
}

/** Wealth from 1, period by period: one more point than there are returns. */
export function cumulative(returns: readonly number[]): number[] {
  const w = [1];
  for (const r of returns) w.push(w[w.length - 1] * (1 + r));
  return w;
}

const column = (series: readonly (readonly number[])[], i: number) => series.map((s) => s[i]);

/** The median at each index across equal-length series (the mean of the middle two for an even count). It is no
 *  single series' path, and it selects nothing by outcome: picking one run by where it ended would choose the line
 *  by its test-period result. */
export function pointwiseMedian(series: readonly (readonly number[])[]): number[] {
  return series[0].map((_, i) => {
    const v = column(series, i).sort((a, b) => a - b), m = v.length >> 1;
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  });
}

/** The min and the max at each index across equal-length series. */
export function band(series: readonly (readonly number[])[]): { lo: number[]; hi: number[] } {
  return {
    lo: series[0].map((_, i) => Math.min(...column(series, i))),
    hi: series[0].map((_, i) => Math.max(...column(series, i))),
  };
}

/** The deepest fall from a running peak, as a negative fraction (0 if it never falls), with the first point as
 *  the first peak: for wealth from 1, a fall straight from the start counts. */
export function maxDrawdownFromStart(wealth: readonly number[]): number {
  let peak = wealth[0], dd = 0;
  for (const v of wealth) {
    peak = Math.max(peak, v);
    dd = Math.min(dd, v / peak - 1);
  }
  return dd;
}

/** Compound annual growth of a total return (1.2 = +120%) earned over `months` months. */
export function cagr(totalReturn: number, months: number): number {
  return (1 + totalReturn) ** (12 / months) - 1;
}

/** The linear map taking d0 to r0 and d1 to r1. */
export function linearScale(d0: number, d1: number, r0: number, r1: number): (v: number) => number {
  return (v) => r0 + ((r1 - r0) * (v - d0)) / (d1 - d0);
}

/** The smallest span on multiples of `step` that contains [lo, hi], with every multiple in it as a tick. */
export function niceDomain(lo: number, hi: number, step: number): { lo: number; hi: number; ticks: number[] } {
  // 3 * 0.1 is 0.30000000000000004; twelve significant digits is far below any printed precision
  const v = (k: number) => Number((k * step).toPrecision(12));
  // and 0.3 / 0.1 is 2.9999999999999996, so the division alone can add a step an end did not need
  let k0 = Math.floor(lo / step), k1 = Math.ceil(hi / step);
  if (v(k0 + 1) <= lo) k0++;
  if (v(k1 - 1) >= hi) k1--;
  const ticks = Array.from({ length: k1 - k0 + 1 }, (_, k) => v(k0 + k));
  return { lo: ticks[0], hi: ticks[ticks.length - 1], ticks };
}

/** Label positions pushed apart until neighbours are at least `gap` apart: each moves only away from the one
 *  above it (toward larger values), so their order holds. Returned in the order given. */
export function nudgeLabels(ys: readonly number[], gap: number): number[] {
  const out = [...ys];
  const order = ys.map((_, i) => i).sort((a, b) => ys[a] - ys[b]);
  for (let k = 1; k < order.length; k++) out[order[k]] = Math.max(out[order[k]], out[order[k - 1]] + gap);
  return out;
}
