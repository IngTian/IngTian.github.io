// src/lib/policyPnl.ts
// BEAT 4 — different sequences of decisions, different returns AND different risk.
//
// The owner: "in the last you might want to add one more, different portfolio, different decisions in time,
// yield completely different returns and risks (now you may show pnl graphs)."
//
// This is the beat that closes the definition. Beats 1–3 establish what a portfolio is, that choosing the
// split matters, and that you choose repeatedly. What is still missing is the consequence of the SEQUENCE:
// that two people holding the same four things, reacting differently over the same year, do not merely end at
// different numbers — they take different amounts of punishment on the way. Return and risk are two separate
// outcomes of one decision process, and this is where a reader meets that idea.
//
// WHY BOTH NUMBERS MATTER, and why the slide reports both: a path that ends higher after falling by half is
// not obviously better than one that ends lower having barely wobbled. That distinction is the entire reason
// portfolio optimisation is not "pick the highest return", and it sets up the Sharpe/drawdown vocabulary the
// later slides use. So each policy gets a curve (the return) and a worst-fall figure (the risk).
//
// DETERMINISTIC. A declared month-by-month return table, not a simulation — the project bans Math.random() at
// paint time, and a PnL fan that shimmered between repaints would be indefensible on a slide whose whole
// argument is that these specific differences are real.
//
// Pure: no DOM. Unit-tested in tests/policyPnl.test.ts.

/** Monthly returns for the four holdings, in HOLDINGS order (chipmaker, phone maker, bank, gold).
 *
 *  Hand-authored to be legible as a YEAR rather than as noise: a strong start, a sharp tech drawdown in month
 *  four where gold holds, a choppy middle, and a recovery. Those are the moments that make different policies
 *  visibly diverge — a random walk would mostly show four similar squiggles. */
export const MONTHLY: number[][] = [
  //  chip    phone   bank    gold
  [ 0.075,  0.041,  0.022,  0.006],
  [ 0.052,  0.028, -0.004,  0.011],
  [ 0.031,  0.019,  0.026, -0.008],
  [-0.183, -0.062,  0.014,  0.048],   // the drawdown: gold is the only thing that helps
  [-0.048, -0.021, -0.032,  0.027],
  [ 0.064,  0.033,  0.041, -0.014],
  [ 0.088,  0.036,  0.019, -0.006],
  [ 0.024,  0.012, -0.021,  0.009],
  [-0.071, -0.034,  0.008,  0.031],
  [ 0.096,  0.044,  0.036, -0.011],
  [ 0.045,  0.026,  0.017,  0.004],
  [ 0.028,  0.015,  0.012,  0.007],
];

export const MONTHS = MONTHLY.length;

/**
 * A policy is a SEQUENCE of splits — one weight vector per month.
 *
 * Expressed as a full schedule rather than as a rule, because this slide is defining the idea rather than
 * solving it: the reader needs to see that a sequence of decisions is a thing you can hold in your hand and
 * compare. The optimising comes on slide 3.
 */
export interface Policy {
  key: string;
  label: string;
  /** One line on what this person is doing, in plain language. */
  gloss: string;
  /** weights[month][holding], each row summing to 100. */
  weights: number[][];
}

/** Cost paid per unit of turnover, so changing your mind is not free. */
export const COST = 0.0015;

export interface PnlPoint {
  month: number;
  /** Value of the starting $100. */
  value: number;
}

export interface PolicyResult {
  key: string;
  label: string;
  gloss: string;
  path: PnlPoint[];
  final: number;
  /** Worst peak-to-trough fall along the path, as a negative percentage. */
  worstFall: number;
  /** Annualised volatility of monthly returns, as a percentage. */
  swing: number;
  /** Total turnover cost paid, in dollars of the starting 100. */
  costPaid: number;
}

function l1(a: readonly number[], b: readonly number[]): number {
  let s = 0;
  for (let i = 0; i < Math.max(a.length, b.length); i++) s += Math.abs((a[i] ?? 0) - (b[i] ?? 0));
  return s;
}

/**
 * Run one policy through the declared year.
 *
 * Each month: pay for whatever changed since last month, then earn that month's return on what is held. The
 * cost term is why a policy that reshuffles constantly can end below one that sat still, which is the honest
 * complication a reader should meet early.
 */
export function runPolicy(p: Policy, monthly: readonly number[][] = MONTHLY, cost = COST): PolicyResult {
  let value = 100;
  let held: number[] = new Array(monthly[0]?.length ?? 0).fill(0);
  let costPaid = 0;
  const path: PnlPoint[] = [{ month: 0, value }];

  for (let m = 0; m < monthly.length; m++) {
    const want = p.weights[Math.min(m, p.weights.length - 1)] ?? held;
    const fee = (l1(held, want) / 100) * cost * value;
    value -= fee;
    costPaid += fee;
    held = [...want];

    let growth = 0;
    for (let i = 0; i < held.length; i++) growth += (held[i] / 100) * (monthly[m][i] ?? 0);
    value *= 1 + growth;
    path.push({ month: m + 1, value });
  }

  return { key: p.key, label: p.label, gloss: p.gloss, path, costPaid, ...statsOf(path) };
}

/** Final value, worst fall and swing from a value path. */
export function statsOf(path: readonly PnlPoint[]): { final: number; worstFall: number; swing: number } {
  const vals = path.map((p) => p.value);
  let peak = -Infinity;
  let worst = 0;
  for (const v of vals) {
    peak = Math.max(peak, v);
    worst = Math.min(worst, v / peak - 1);
  }
  const rets: number[] = [];
  for (let i = 1; i < vals.length; i++) rets.push(vals[i] / vals[i - 1] - 1);
  const mean = rets.length ? rets.reduce((a, b) => a + b, 0) / rets.length : 0;
  const variance = rets.length > 1
    ? rets.reduce((a, r) => a + (r - mean) ** 2, 0) / (rets.length - 1)
    : 0;
  return {
    final: vals[vals.length - 1] ?? 100,
    worstFall: worst * 100,
    swing: Math.sqrt(variance) * Math.sqrt(12) * 100,
  };
}

/** Bounds across a set of paths, for one shared vertical scale — without which the curves cannot be compared. */
export function pnlBounds(results: readonly PolicyResult[]): { lo: number; hi: number } {
  let lo = Infinity;
  let hi = -Infinity;
  for (const r of results) {
    for (const p of r.path) {
      lo = Math.min(lo, p.value);
      hi = Math.max(hi, p.value);
    }
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return { lo: 90, hi: 110 };
  return { lo, hi };
}

/** Project a point onto a screen box. Separated so it can be tested. */
export function project(
  p: PnlPoint,
  months: number,
  bounds: { lo: number; hi: number },
  box: { x: number; y: number; w: number; h: number },
): [number, number] {
  const u = months > 0 ? p.month / months : 0;
  const span = bounds.hi - bounds.lo;
  const v = span > 0 ? (p.value - bounds.lo) / span : 0.5;
  return [box.x + u * box.w, box.y + (1 - v) * box.h];
}
