// src/lib/growth.ts
// GROWTH OF ONE UNIT, from PUBLISHED figures only.
//
// The owner's brief: "just show the pnl graph of several strategies, pick the highest one to be mine and
// highlight it with the highest pnl and the highest sharpe/sortino."
//
// WHAT MAKES THIS HONEST, because the obvious version is not. Drawing three invented equity curves and
// labelling the best one "mine" would be a fabricated performance claim — the same failure the site just
// spent two commits removing (build-time figures measured off an invented surface, printed where they
// read as career results), except worse, because a quant reader may go and check.
//
// The rescue is that the comparison the owner wants ALREADY EXISTS as published data. RL-BHRP
// (arXiv:2508.11856) reports three strategies over one out-of-sample window with cumulative return,
// CAGR, volatility, Sharpe, Sortino and max drawdown for each. So the chart draws the paper's own
// results, and every number on screen is quotable from it.
//
// WHAT IS PUBLISHED AND WHAT IS NOT. Endpoints and rates are published; the PATH BETWEEN THEM IS NOT.
// A drawn equity curve with realistic wiggles would be interpolation I invented, and those wiggles would
// be fiction dressed as a track record. So this module draws the only curve the data actually supports:
// smooth compounding at the published CAGR. Verified self-consistent — (1+CAGR)^5.5 reproduces each
// stated cumulative return to within 0.02. The chart labels itself as compounded growth, not as a
// simulated equity path, and the caption says so.
//
// Pure: no DOM, no canvas. Unit-tested (tests/growth.test.ts).

/** One strategy as the paper reports it. Every field is a published figure. */
export interface Strategy {
  /** Short name as it appears in the paper. */
  key: string;
  /** Label for the chart. */
  label: string;
  /** Cumulative return over the full window, e.g. 1.20 = +120%. */
  cumulative: number;
  /** Compound annual growth rate, e.g. 0.152. */
  cagr: number;
  /** Annualised volatility. */
  vol: number;
  sharpe: number;
  sortino: number;
  /** Max drawdown, negative. */
  maxDrawdown: number;
  /** True for the paper's own method — the one the chart highlights. */
  isMine?: boolean;
}

/** A point on a growth curve: years elapsed, and the value of one unit invested at the start. */
export interface GrowthPoint {
  t: number;
  value: number;
}

/**
 * Growth of one unit, compounded at the published CAGR.
 *
 * value(t) = (1 + cagr)^t
 *
 * This is a deliberate choice of the SMOOTHEST curve consistent with the published data, not a
 * simulated equity path. The paper does not publish a return series, so any bumpiness drawn here would
 * be invented — and an invented bump in a performance chart is a false claim, however small.
 */
export function growthCurve(s: Strategy, years: number, samples = 96): GrowthPoint[] {
  if (years <= 0 || samples < 1) return [{ t: 0, value: 1 }];
  const out: GrowthPoint[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = (years * i) / samples;
    out.push({ t, value: Math.pow(1 + s.cagr, t) });
  }
  return out;
}

/** The final value of one unit, from the published CUMULATIVE return rather than from the CAGR.
 *  Preferred for the end label: it is the figure the paper states directly. */
export function finalValue(s: Strategy): number {
  return 1 + s.cumulative;
}

/**
 * How far the CAGR-compounded curve lands from the published cumulative return.
 *
 * Exposed rather than hidden because it is the honesty check: the two are independent published
 * figures, and if they disagreed materially the chart would be drawing something the paper does not
 * say. Measured on the real data it is <= 0.02 for all three strategies.
 */
export function consistencyGap(s: Strategy, years: number): number {
  return Math.abs(Math.pow(1 + s.cagr, years) - (1 + s.cumulative));
}

/** The strategy the chart highlights: the paper's own method. Falls back to the best cumulative
 *  return so the chart still has a subject if the flag is ever dropped from the data. */
export function highlighted(strategies: readonly Strategy[]): Strategy | null {
  if (!strategies.length) return null;
  const mine = strategies.find((s) => s.isMine);
  if (mine) return mine;
  return strategies.reduce((best, s) => (s.cumulative > best.cumulative ? s : best));
}

/** Does the highlighted strategy actually lead on this metric? Used to state the claim only where the
 *  published data supports it — the site's honesty rule applied to a chart. */
export function leadsOn(
  strategies: readonly Strategy[],
  metric: 'cumulative' | 'sharpe' | 'sortino' | 'cagr',
): boolean {
  const mine = highlighted(strategies);
  if (!mine) return false;
  return strategies.every((s) => s === mine || mine[metric] >= s[metric]);
}

/** Y-axis bounds that contain every curve, with headroom for the end labels. */
export function valueBounds(
  strategies: readonly Strategy[],
  years: number,
  headroom = 0.06,
): { lo: number; hi: number } {
  let hi = 1;
  for (const s of strategies) {
    hi = Math.max(hi, Math.pow(1 + s.cagr, years), 1 + s.cumulative);
  }
  const pad = (hi - 1) * headroom;
  return { lo: 1 - pad, hi: hi + pad };
}

/** Project a growth point into a screen box. Separated from the drawing so it can be tested. */
export function project(
  p: GrowthPoint,
  years: number,
  bounds: { lo: number; hi: number },
  box: { x: number; y: number; w: number; h: number },
): [number, number] {
  const u = years > 0 ? p.t / years : 0;
  const span = bounds.hi - bounds.lo;
  const v = span > 0 ? (p.value - bounds.lo) / span : 0;
  return [box.x + u * box.w, box.y + (1 - v) * box.h];
}

/** Nice round gridline values inside the bounds — for a y-axis that reads as a chart, not a plot dump. */
export function gridValues(bounds: { lo: number; hi: number }, target = 4): number[] {
  const span = bounds.hi - bounds.lo;
  if (span <= 0) return [bounds.lo];
  const raw = span / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10;
  const out: number[] = [];
  for (let v = Math.ceil(bounds.lo / step) * step; v <= bounds.hi + 1e-9; v += step) {
    out.push(Math.round(v * 1e6) / 1e6);
  }
  return out;
}
