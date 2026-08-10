// src/lib/policyPnl.ts
// BEAT 4 — different sequences of decisions, different returns AND different risk.
//
// The owner: "in the last you might want to add one more, different portfolio, different decisions in time,
// yield completely different returns and risks (now you may show pnl graphs)."
// Then: "we can have more periods, and so the pnl graph can have more granularity. maybe even you can add a
// leveraged player into this as well. think about how real retail traders and institutional traders portfolios
// do."
//
// This is the beat that closes the definition. Beats 1–3 establish what a portfolio is, that choosing the
// split matters, and that you choose repeatedly. What is still missing is the consequence of the SEQUENCE:
// that people holding the same four things, reacting differently over the same year, do not merely end at
// different numbers — they take different amounts of punishment on the way. Return and risk are two separate
// outcomes of one decision process, and this is where a reader meets that idea.
//
// ── WEEKLY, NOT MONTHLY ──────────────────────────────────────────────────────────────────────────────────
// Fifty-two periods rather than twelve, on the owner's ask for more granularity. The change is not cosmetic:
// at monthly resolution the drawdown was a single straight segment, which reads as one event rather than as
// something a person LIVES THROUGH and reacts inside. A weekly path shows the shape of a fall — the false
// rally partway down, the second leg, the slow grind back — which is what makes "when did you decide" a real
// question rather than a rhetorical one.
//
// It also makes leverage honest. A leveraged position is not a scaled line: between rebalances the exposure
// DRIFTS (a levered book that loses money gets more levered, not less), financing accrues continuously, and a
// margin call happens on a specific bad day. None of that is visible at twelve points; all of it is visible at
// fifty-two.
//
// ── HOW REAL BOOKS ACTUALLY DIFFER ───────────────────────────────────────────────────────────────────────
// The five players are drawn from how retail and institutional portfolios genuinely behave, not from strategy
// names:
//   * RETAIL, unlevered — buys once and never rebalances, so the winner quietly takes over the book. This is
//     the single most common real portfolio there is, and its risk comes from neglect rather than from action.
//   * RETAIL, reactive — sells after the fall, in the week the pain peaks. Selling low is a decision made by a
//     person, not a model, and it is why "risk" is partly behavioural.
//   * RETAIL, levered — the 2x account. Real leverage costs money to carry (financing on the borrowed part),
//     it compounds against you on the way down (drift), and it can be forcibly closed at the worst possible
//     moment (a maintenance-margin breach). This player is here because a beginner sees "2x" and thinks
//     "double the return", and the curve is a more honest answer than any sentence.
//   * INSTITUTIONAL, mandated — rebalances on a schedule to a fixed policy weight, because a mandate says to.
//     Not clever, just disciplined: it sells what rose and buys what fell whether or not it wants to.
//   * INSTITUTIONAL, risk-targeted — sizes exposure to a volatility target, so it de-risks when the market
//     gets rough and re-risks when it calms. Modest leverage when quiet, well under 1x when not. This is the
//     closest thing on the slide to what the research is actually about, and it wins on return per unit of
//     risk rather than on return.
//
// ── DETERMINISTIC ────────────────────────────────────────────────────────────────────────────────────────
// A declared weekly return table, not a simulation. The project bans Math.random() at paint time, and a PnL
// fan that shimmered between repaints would be indefensible on a slide whose whole argument is that these
// specific differences are real. The table is built once, at module load, from a seeded generator plus a
// hand-authored narrative overlay — so it is a fixed artefact, identical on every build.
//
// Pure: no DOM. Unit-tested in tests/policyPnl.test.ts.

import { mulberry32, gauss } from './scenario';

/** Weeks in the illustrated year. */
export const WEEKS = 52;

/** Kept for readers of the older API: the number of periods the chart plots. */
export const MONTHS = WEEKS;

/** Weekly labels for the four quarters, used to caption the chart's x axis. */
export const QUARTER_MARKS: { week: number; label: string }[] = [
  { week: 0, label: 'Jan' },
  { week: 13, label: 'Apr' },
  { week: 26, label: 'Jul' },
  { week: 39, label: 'Oct' },
];

/**
 * The declared year, week by week: WEEKLY[week][holding] in HOLDINGS order
 * (chipmaker, phone maker, bank, gold).
 *
 * Built from a seeded normal draw per holding (so the path has texture — a hand-typed table at 52x4 either
 * takes hours or reads as a sawtooth) plus a NARRATIVE OVERLAY that puts specific events in specific weeks.
 * The overlay is the part that matters: the beat's argument depends on there being moments where different
 * players visibly diverge, and a pure random walk mostly produces four similar squiggles.
 *
 * The year it tells: a strong first quarter, a sharp tech drawdown across weeks 14-20 where only gold helps,
 * a false rally in the middle of it, a choppy summer, a second scare in the autumn, and a recovery that
 * rewards whoever still had exposure left to recover with.
 */
function buildYear(): number[][] {
  const rand = mulberry32(0x9c04);
  // Per-holding weekly drift and volatility, chosen so the four behave like different KINDS of asset rather
  // than like four samples of one: the chipmaker is the high-beta name, gold is the diversifier that actually
  // diversifies (it rises in the weeks the others fall), the bank sits between, the phone maker is a milder
  // version of the chipmaker.
  // Calibrated against how these kinds of assets actually behave, not picked to be pretty. The chipmaker's
  // 4.5%-a-week vol and deep drawdown inside a strongly up year is the ordinary shape of a high-beta
  // semiconductor name (NVDA fell ~35% in weeks during 2020 and still ended the year up sharply) — the point is
  // that a big drawdown is NORMAL inside a good year, which is exactly why the sequence of decisions matters.
  const spec = [
    { drift: 0.0120, vol: 0.045 },  // chipmaker — the engine and the risk
    { drift: 0.0026, vol: 0.026 },  // phone maker
    { drift: 0.0016, vol: 0.021 },  // bank
    { drift: 0.0012, vol: 0.015 },  // gold
  ];

  const weeks: number[][] = [];
  for (let w = 0; w < WEEKS; w++) {
    weeks.push(spec.map((s) => s.drift + s.vol * gauss(rand)));
  }

  // THE NARRATIVE OVERLAY — added to the drawn returns, so events land in known weeks.
  // [week, chip, phone, bank, gold]
  const events: number[][] = [
    // A strong opening quarter: the chipmaker leads and everyone feels clever.
    [2,  0.032,  0.015,  0.006, -0.004],
    [6,  0.041,  0.018,  0.009, -0.006],
    [10, 0.028,  0.013,  0.010, -0.003],
    // THE DRAWDOWN. Six weeks with a FALSE RALLY at week 17 and a second leg at 18-19 — the shape that makes
    // "when did you decide" a real question. A single straight fall would let every player react at the same
    // obvious moment; a fall with a bounce in it is what actually separates the disciplined from the panicked.
    [14, -0.105, -0.044, -0.016,  0.024],
    [15, -0.124, -0.052, -0.022,  0.033],
    [16, -0.081, -0.036, -0.019,  0.027],
    // The false rally has to WIN against the drawn return underneath it, or the shape is only in the comment.
    // Measured: at +4.6% the draw's own -5.5% swallowed it and week 17 still printed red, so the bounce a
    // reacting player is supposed to be fooled by did not exist. +11.2% clears it.
    [17,  0.112,  0.043,  0.022, -0.024],   // the false rally: "it's over"
    [18, -0.118, -0.049, -0.025,  0.035],   // it was not over
    [19, -0.092, -0.038, -0.020,  0.026],
    [20, -0.047, -0.021, -0.011,  0.015],
    // The turn, and a choppy summer that punishes anyone who trades every wiggle.
    [23,  0.062,  0.027,  0.014, -0.012],
    [26,  0.044,  0.020,  0.013, -0.007],
    [29, -0.038, -0.017, -0.008,  0.012],
    [31,  0.041,  0.018,  0.010, -0.006],
    // An autumn scare: shorter and shallower, but it arrives when a levered book is already thin.
    [36, -0.068, -0.029, -0.014,  0.022],
    [37, -0.052, -0.023, -0.012,  0.017],
    // The recovery, which only helps whoever still has exposure left to recover with.
    [41,  0.069,  0.029,  0.016, -0.010],
    [44,  0.056,  0.024,  0.014, -0.008],
    [47,  0.047,  0.021,  0.013, -0.006],
    [50,  0.036,  0.016,  0.010, -0.005],
  ];
  for (const [w, ...moves] of events) {
    for (let i = 0; i < moves.length; i++) weeks[w][i] += moves[i];
  }
  return weeks;
}

export const WEEKLY: number[][] = buildYear();

/** Kept under the older name so existing readers of the module still resolve. */
export const MONTHLY = WEEKLY;

// ── COSTS AND FINANCING, at weekly resolution ────────────────────────────────────────────────────────────

/** Cost paid per unit of turnover — spread plus commission, charged on whatever changed. */
export const COST = 0.0012;

/** Annual financing rate on borrowed money. Charged weekly on the borrowed part only. */
export const FINANCING = 0.065;

/**
 * Maintenance margin: the fraction of gross exposure that must remain as equity. Below it the broker closes
 * the position rather than asking politely — which is the entire risk of a levered retail account and the one
 * thing a "2x returns" pitch never mentions.
 */
export const MAINTENANCE = 0.25;

// ── WHAT A PLAYER IS ─────────────────────────────────────────────────────────────────────────────────────

/**
 * A player is a RULE, evaluated week by week, rather than a typed schedule.
 *
 * The earlier version of this module declared 12 weight vectors per policy by hand. At 52 weeks that would be
 * 208 numbers per player and 1040 in total — unreadable, unverifiable, and impossible to keep honest. A rule
 * is also closer to the truth: real books follow policies, and the interesting differences between them are
 * differences of POLICY (when do you rebalance, what do you target, what do you do after a fall), not
 * differences of arbitrary weekly weights.
 */
export interface Player {
  key: string;
  label: string;
  /** retail or institutional — the slide groups them, because the distinction is the point. */
  kind: 'retail' | 'institutional';
  /** One line on what this person is doing, in plain language. */
  gloss: string;
  /**
   * Target book for a given week, decided from what is known at the START of that week.
   *
   * Returns weights as PERCENTAGES OF EQUITY in HOLDINGS order. They may sum to more than 100 — that is
   * leverage, and the sum is the gross exposure. Returning null means "no change this week", which is how a
   * player who rebalances rarely avoids paying to churn.
   */
  target(ctx: PlayerContext): number[] | null;
}

export interface PlayerContext {
  /** Week index, 0-based. */
  week: number;
  /** Current weights as percentages of equity, after drift. Sums to gross exposure. */
  held: readonly number[];
  /** Current equity, in dollars of the starting 100. */
  equity: number;
  /** Trailing realised volatility of the book's own weekly returns, annualised, as a percentage. */
  vol: number;
  /** Weeks since this player last changed anything. */
  sinceTrade: number;
  /** Peak equity so far, so a player can react to being underwater. */
  peak: number;
}

export interface PnlPoint {
  /** Week index. Named `month` for continuity with the chart's projection helper. */
  month: number;
  /** Value of the starting $100. */
  value: number;
}

export interface PolicyResult {
  key: string;
  label: string;
  kind: 'retail' | 'institutional';
  gloss: string;
  path: PnlPoint[];
  final: number;
  /** Worst peak-to-trough fall along the path, as a negative percentage. */
  worstFall: number;
  /** Annualised volatility of weekly returns, as a percentage. */
  swing: number;
  /** Total turnover cost paid, in dollars of the starting 100. */
  costPaid: number;
  /** Total financing paid on borrowed money, in dollars of the starting 100. */
  financingPaid: number;
  /** Average gross exposure across the year, as a percentage of equity. */
  avgExposure: number;
  /** The week a maintenance-margin breach forced the book flat, or null if it never happened. */
  marginCallWeek: number | null;
  /** Return per unit of downside: final gain divided by the worst fall. The slide's actual verdict. */
  returnPerRisk: number;
}

/** Sum of a weight vector — gross exposure when weights are percentages of equity. */
export function gross(w: readonly number[]): number {
  return w.reduce((a, b) => a + b, 0);
}

function l1(a: readonly number[], b: readonly number[]): number {
  let s = 0;
  for (let i = 0; i < Math.max(a.length, b.length); i++) s += Math.abs((a[i] ?? 0) - (b[i] ?? 0));
  return s;
}

/** Annualised volatility of a set of weekly returns, as a percentage. */
export function annualisedVol(rets: readonly number[]): number {
  if (rets.length < 2) return 0;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, r) => a + (r - mean) ** 2, 0) / (rets.length - 1);
  return Math.sqrt(variance) * Math.sqrt(52) * 100;
}

/**
 * Run one player through the declared year, week by week.
 *
 * The order inside a week is the order it happens in reality, and each step is why a different player ends
 * somewhere different:
 *   1. the player may choose a new target book (knowing only what happened before this week)
 *   2. turnover is charged on whatever changed
 *   3. financing is charged on the borrowed part
 *   4. the market moves, and the position DRIFTS — winners become a larger share, and a levered book that
 *      loses money becomes MORE levered, which is the mechanism behind every margin spiral
 *   5. if equity has fallen below maintenance margin, the book is closed — not reduced, closed
 */
export function runPolicy(
  p: Player,
  weekly: readonly number[][] = WEEKLY,
  cost = COST,
  financing = FINANCING,
): PolicyResult {
  const n = weekly[0]?.length ?? 0;
  let equity = 100;
  let held: number[] = new Array(n).fill(0);
  let costPaid = 0;
  let financingPaid = 0;
  let sinceTrade = 0;
  let peak = equity;
  let marginCallWeek: number | null = null;
  let exposureSum = 0;

  const path: PnlPoint[] = [{ month: 0, value: equity }];
  const rets: number[] = [];

  for (let w = 0; w < weekly.length; w++) {
    // 1. THE DECISION. Trailing vol over the last 8 weeks of the book's OWN returns — a risk-targeting player
    //    can only respond to volatility it has already lived through, never to next week's.
    const vol = annualisedVol(rets.slice(-8));
    const want = marginCallWeek === null
      ? p.target({ week: w, held, equity, vol, sinceTrade, peak })
      : null;                                   // a closed-out account does not get to trade any more

    if (want) {
      const turnover = l1(held, want) / 100;
      if (turnover > 1e-9) {
        const fee = turnover * cost * equity;
        equity -= fee;
        costPaid += fee;
        held = [...want];
        sinceTrade = 0;
      } else {
        sinceTrade++;
      }
    } else {
      sinceTrade++;
    }

    // 2. FINANCING on the borrowed part only — leverage is a loan, and a loan has a price. This is the term
    //    that makes a 2x book lose to a 1x book in a flat year, which no "2x" pitch ever mentions.
    // A tolerance, not `> 0`: drift recomputes weights by multiplication and division, so a fully-invested book
    // lands at 100 ± 1e-14 rather than exactly 100. Measured, the mandate book accrued 8.9e-16 of "financing"
    // it had never borrowed — harmless in dollars, but it makes "only the levered player pays financing" false,
    // and a claim the slide makes should be exactly true rather than nearly true.
    const borrowed = Math.max(0, gross(held) - 100) / 100;
    if (borrowed > 1e-9) {
      const charge = borrowed * (financing / 52) * equity;
      equity -= charge;
      financingPaid += charge;
    }

    exposureSum += gross(held);

    // 3. THE MARKET MOVES. Equity earns the weighted return; the position drifts because each holding grows at
    //    its own rate.
    const before = equity;
    let growth = 0;
    for (let i = 0; i < n; i++) growth += (held[i] / 100) * (weekly[w][i] ?? 0);
    equity *= 1 + growth;

    // DRIFT: recompute weights as percentages of the NEW equity. A holding that rose is now a bigger share,
    // and if equity fell while exposure did not, gross exposure has risen — the levered spiral, for free.
    if (equity > 1e-9) {
      const next = held.map((h, i) => (h * (1 + (weekly[w][i] ?? 0)) * before) / equity);
      held = next;
    }

    rets.push(before > 0 ? equity / before - 1 : 0);
    peak = Math.max(peak, equity);

    // 4. MARGIN. Equity as a fraction of gross exposure; below maintenance the broker closes the book.
    const g = gross(held);
    if (marginCallWeek === null && g > 100 && 100 / g < MAINTENANCE) {
      marginCallWeek = w;
      const fee = (g / 100) * cost * equity;    // closing out is not free either
      equity -= fee;
      costPaid += fee;
      held = new Array(n).fill(0);              // flat, in cash, for the rest of the year
    }

    path.push({ month: w + 1, value: equity });
  }

  const stats = statsOf(path);
  return {
    key: p.key,
    label: p.label,
    kind: p.kind,
    gloss: p.gloss,
    path,
    costPaid,
    financingPaid,
    avgExposure: weekly.length ? exposureSum / weekly.length : 0,
    marginCallWeek,
    returnPerRisk: stats.worstFall < -1e-9 ? (stats.final - 100) / -stats.worstFall : Infinity,
    ...stats,
  };
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
  for (let i = 1; i < vals.length; i++) rets.push(vals[i - 1] > 0 ? vals[i] / vals[i - 1] - 1 : 0);
  return {
    final: vals[vals.length - 1] ?? 100,
    worstFall: worst * 100,
    swing: annualisedVol(rets),
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
