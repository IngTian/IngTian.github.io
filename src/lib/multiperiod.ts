// src/lib/multiperiod.ts
// MULTI-PERIOD, MADE VISIBLE — the part the earlier slides asserted and never showed.
//
// The owner: "my job is to find the best curve systematically under thousands of constraints and for
// thousands of tickers in multi period settings. also seems like we didnt bake in multi period at all for
// the examples."
//
// Correct, and it was the real gap: the previous slide described multi-period allocation in prose while its
// example was a one-shot choice between four fixed mixes. This module makes the sequence the subject — a
// strategy here is a RULE that produces a weight vector every period, and the chart shows the value path
// that rule produces, net of what its own trading costs.
//
// WHAT IS AND IS NOT REAL HERE. These are ILLUSTRATIVE asset-class characteristics (rounded, textbook
// shaped) and a DECLARED return sequence — the point is to demonstrate a mechanism, exactly like a
// textbook's worked example, and the slide says so on its face.
//
// The distinction the site holds, and the reason it is stated in a source comment rather than assumed:
// inventing numbers to TEACH a method is legitimate; inventing numbers that read as the owner's RESULTS is
// not. Nothing here is attributed to him. The paths belong to four named rules in a declared toy world, and
// the slide's own copy points out that the naive rule wins on raw return — a flattering fiction would not
// do that.
//
// Deterministic: the return sequence is a fixed table, so every repaint is identical (the project bans
// Math.random() at paint time).

/** An asset class in the toy world. */
export interface ToyAsset {
  key: string;
  label: string;
  /** Illustrative expected annual return. */
  mu: number;
  /** Illustrative annual volatility. */
  sigma: number;
}

export const TOY_ASSETS: ToyAsset[] = [
  { key: 'equities',    label: 'Equities',    mu: 0.08, sigma: 0.16 },
  { key: 'bonds',       label: 'Bonds',       mu: 0.03, sigma: 0.05 },
  { key: 'commodities', label: 'Commodities', mu: 0.04, sigma: 0.20 },
  { key: 'cash',        label: 'Cash',        mu: 0.02, sigma: 0.00 },
];

/**
 * A DECLARED sequence of period returns, one row per period, one column per asset (in TOY_ASSETS order).
 *
 * Hand-authored rather than generated, for two reasons. It is deterministic, so the chart never shimmers
 * between repaints. And it is legible as a STORY: an early risk-on stretch, a sharp equity drawdown in
 * period 4 where bonds hold, a commodity spike, then a recovery. Those are the moments that make the
 * difference between strategies visible — a random walk would mostly show noise.
 *
 * Twelve periods, read as half-years over six years.
 */
export const PERIOD_RETURNS: number[][] = [
  //  equities  bonds  commodities  cash
  [ 0.09,  0.02,  0.03, 0.01],
  [ 0.07,  0.01,  0.06, 0.01],
  [ 0.05,  0.02, -0.02, 0.01],
  [-0.19,  0.04, -0.06, 0.01],   // the drawdown: bonds are the ballast
  [-0.04,  0.03,  0.02, 0.01],
  [ 0.12,  0.00,  0.14, 0.01],   // commodity spike
  [ 0.08,  0.01,  0.05, 0.01],
  [ 0.03,  0.02, -0.03, 0.01],
  [-0.07,  0.03, -0.01, 0.01],
  [ 0.11,  0.01,  0.04, 0.01],
  [ 0.06,  0.02,  0.02, 0.01],
  [ 0.04,  0.02,  0.01, 0.01],
];

/** Half-years, so twelve periods is six years. */
export const PERIOD_YEARS = 0.5;

/** A strategy is a RULE: given the period index and the weights it currently holds, what does it want? */
export interface Rule {
  key: string;
  label: string;
  /** One line on what the rule does — shown beside its curve. */
  gloss: string;
  /** True for the rule the search is looking for (not a claim of authorship — see the slide copy). */
  isTarget?: boolean;
  /** Target weights for this period. Receives the period index and the previous weights. */
  weights(period: number, prev: readonly number[]): number[];
}

/** Normalise to sum 1, clipping negatives — the budget constraint and the no-shorting constraint, which
 *  are the two every rule here must respect. */
export function feasible(w: readonly number[]): number[] {
  const clipped = w.map((x) => Math.max(0, x));
  const total = clipped.reduce((a, b) => a + b, 0);
  if (total <= 0) return clipped.map((_, i) => (i === clipped.length - 1 ? 1 : 0));
  return clipped.map((x) => x / total);
}

/** Turnover between two weight vectors — the L1 distance, which is what a trading cost is charged on. */
export function turnover(a: readonly number[], b: readonly number[]): number {
  let s = 0;
  for (let i = 0; i < Math.max(a.length, b.length); i++) s += Math.abs((a[i] ?? 0) - (b[i] ?? 0));
  return s;
}

export interface PathPoint {
  /** Period index, 0 = start. */
  period: number;
  /** Years elapsed. */
  t: number;
  /** Value of one unit. */
  value: number;
  /** Weights held going INTO this period. */
  weights: number[];
  /** Cumulative cost paid to trading so far. */
  costPaid: number;
}

/**
 * Run a rule through the declared return sequence and return its value path.
 *
 * THE MULTI-PERIOD MECHANIC, which is the whole point of the module: each period the rule states target
 * weights, the portfolio pays `cost` per unit of turnover to get there, and then earns that period's
 * return on the weights it actually holds. A rule that chases the best asset every period pays for the
 * privilege; a rule that never trades drifts away from its own intent. Both failures are visible in the
 * resulting curve, which is what makes the sequence worth drawing rather than describing.
 *
 * @param cost linear transaction cost per unit of turnover (0.002 = 20bp each way)
 */
export function runRule(rule: Rule, returns: readonly number[][] = PERIOD_RETURNS, cost = 0.002): PathPoint[] {
  const n = TOY_ASSETS.length;
  let value = 1;
  let held: number[] = new Array(n).fill(0);
  let costPaid = 0;
  const out: PathPoint[] = [];

  for (let p = 0; p < returns.length; p++) {
    const want = feasible(rule.weights(p, held));
    // First period is establishing the position, not rebalancing: charge it, but it is not "churn".
    const tno = turnover(held, want);
    const fee = tno * cost;
    value *= 1 - fee;
    costPaid += fee;
    held = want;

    out.push({ period: p, t: p * PERIOD_YEARS, value, weights: [...held], costPaid });

    // Earn the period's return on what is held.
    let growth = 0;
    for (let i = 0; i < n; i++) growth += held[i] * (returns[p][i] ?? 0);
    value *= 1 + growth;
  }

  // Closing point, after the last period's return.
  out.push({
    period: returns.length,
    t: returns.length * PERIOD_YEARS,
    value,
    weights: [...held],
    costPaid,
  });
  return out;
}

/** Realised annualised volatility of a path's period-over-period returns. */
export function realisedVol(path: readonly PathPoint[]): number {
  if (path.length < 3) return 0;
  const rets: number[] = [];
  for (let i = 1; i < path.length; i++) rets.push(path[i].value / path[i - 1].value - 1);
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const varSum = rets.reduce((a, r) => a + (r - mean) ** 2, 0) / (rets.length - 1);
  return Math.sqrt(varSum / PERIOD_YEARS);
}

/** Worst peak-to-trough fall along a path, as a negative fraction. */
export function maxDrawdown(path: readonly PathPoint[]): number {
  let peak = -Infinity;
  let worst = 0;
  for (const p of path) {
    peak = Math.max(peak, p.value);
    worst = Math.min(worst, p.value / peak - 1);
  }
  return worst;
}

/** Final value of one unit. */
export function finalValue(path: readonly PathPoint[]): number {
  return path.length ? path[path.length - 1].value : 1;
}
