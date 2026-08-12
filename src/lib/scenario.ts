// src/lib/scenario.ts
// ONE INVENTED YEAR, TRADED MANY WAYS — the engine behind the concrete example.
//
// The owner's brief: "let's say you have AAPL, NVDA, META, BOA, XAUUSD, WTIOIL, etc. imagine that you have
// news now and then, and you pick initial portfolio weights, during news, during the 1 year horizon, you
// shifted positions (just like every trader), you probably resulted in a turbulent portfolio pnl (this you
// can show lots of pnl curves and sequentially highlight a few indicating where the user may stand)."
//
// WHAT IS INVENTED, STATED PLAINLY AND ON THE SLIDE TOO. The tickers are real names; the prices, the news
// and every path are MADE UP. This is a worked example, the way a textbook invents a market to show a
// mechanism — it is not a backtest, and nothing here is attributed to anyone's track record. The slide
// carries that sentence in the copy, not just in this comment, because real tickers make invented numbers
// look more authoritative than they are.
//
// DETERMINISTIC BY CONSTRUCTION. A seeded PRNG (mulberry32), so the fan is identical on every build and
// every repaint — the project bans Math.random() at paint time, and a shimmering fan of forty curves would
// be the worst possible violation of it. Same seed, same picture, forever.
//
// Pure: no DOM, no canvas. Unit-tested (tests/scenario.test.ts).

/** Deterministic PRNG. Small, fast, and good enough for illustrative dispersion. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal from a uniform generator (Box–Muller, one draw per call). */
export function gauss(rand: () => number): number {
  // Guard the log against exactly zero, which would return -Infinity.
  const u = Math.max(1e-12, rand());
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export interface Instrument {
  ticker: string;
  name: string;
  /** Glyph key into data/tickerGlyphs. */
  glyph: string;
  /** Illustrative annual drift. */
  drift: number;
  /** Illustrative annual volatility. */
  vol: number;
}

/** A news event: when it lands, what it says, and how each instrument reacts. */
export interface NewsEvent {
  /** Period index (weeks). */
  week: number;
  headline: string;
  /** One-off return shock per ticker, applied in that week on top of the usual move. */
  shock: Record<string, number>;
}

export interface World {
  /** returns[week][instrumentIndex] */
  returns: number[][];
  weeks: number;
  /** Weeks that carry news, for marking the axis. */
  newsWeeks: number[];
}

/** Weeks per year — the horizon the owner asked for is one year. */
export const WEEKS = 52;
const PER_YEAR = 52;

/**
 * Build the invented year: a base random walk per instrument plus the declared news shocks.
 *
 * The news is what makes the example teachable — a pure random walk would show dispersion without a
 * REASON for it, and the whole point is that traders differ in how they react to the same headlines.
 */
export function buildWorld(
  instruments: readonly Instrument[],
  news: readonly NewsEvent[],
  seed = 20260809,
): World {
  const rand = mulberry32(seed);
  const returns: number[][] = [];
  const byWeek = new Map<number, NewsEvent>();
  for (const e of news) byWeek.set(e.week, e);

  for (let w = 0; w < WEEKS; w++) {
    const row: number[] = [];
    const ev = byWeek.get(w);
    for (const inst of instruments) {
      const mu = inst.drift / PER_YEAR;
      const sd = inst.vol / Math.sqrt(PER_YEAR);
      let r = mu + sd * gauss(rand);
      if (ev) r += ev.shock[inst.ticker] ?? 0;
      row.push(r);
    }
    returns.push(row);
  }
  return { returns, weeks: WEEKS, newsWeeks: news.map((e) => e.week).sort((a, b) => a - b) };
}

/**
 * A discretionary trader, described by three dials.
 *
 * These are not personality types for colour — each dial is a documented behavioural tendency, and
 * together they span the ways people actually respond to a headline. That is what produces a fan rather
 * than a bundle: same world, same news, different reflexes.
 */
export interface Trader {
  id: number;
  /** How hard it piles into whatever just moved on news. Signed: >0 chases the move, <0 fades it. */
  chase: number;
  /** How hard it de-risks after a loss. 0 = never flinches, 1 = cuts most of the position. */
  cut: number;
  /** How quickly it drifts back toward its original plan. 0 = never, 1 = immediately. */
  revert: number;
  /** How concentrated the initial book is. 0 = equal weight, 1 = piled into one name. */
  concentration: number;
  /** Which name it favours when concentrated. */
  favourite: number;
}

/**
 * A deterministic population spanning the dial space.
 *
 * FOUR DIALS, NOT THREE, and the fourth is the one that matters. A first version varied only reaction
 * style and produced a spread of 1.15 to 1.23 — a bundle, not a fan — because everybody started from the
 * same equal-weight book and the reactions could only ever cost money. Real desks differ FIRST in what they
 * own: one is piled into NVDA, another spread across six names. That is where dispersion actually comes
 * from, and `chase` is signed now so some traders fade a move rather than all chasing it.
 */
export function makeTraders(count: number, seed = 424242): Trader[] {
  const rand = mulberry32(seed);
  const out: Trader[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      id: i,
      chase: (rand() - 0.35) * 1.7,          // mostly chasers, some faders
      cut: rand(),
      revert: 0.02 + rand() * 0.25,
      concentration: rand() ** 0.8,          // biased toward concentrated books
      favourite: Math.floor(rand() * 6),
    });
  }
  return out;
}

export interface PathStats {
  /** Value of one unit at each week, index 0 = 1. */
  values: number[];
  final: number;
  /** Annualised volatility of weekly returns. */
  vol: number;
  /** Annualised Sharpe, excess over the declared cash rate. */
  sharpe: number;
  /** Worst peak-to-trough fall, negative. */
  maxDrawdown: number;
  /** Total turnover paid, as a fraction of capital. */
  costPaid: number;
}

/** Risk-free used for Sharpe. Declared rather than assumed silently. */
export const CASH_RATE = 0.04;

/** Sum to one, no shorting — the two constraints every path here respects. */
function normalise(w: readonly number[]): number[] {
  const c = w.map((x) => Math.max(0, x));
  const s = c.reduce((a, b) => a + b, 0);
  return s > 0 ? c.map((x) => x / s) : c.map(() => 1 / c.length);
}

function l1(a: readonly number[], b: readonly number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s;
}

/**
 * Run one discretionary trader through the world.
 *
 * The loop IS the multi-period problem in miniature: every week the trader restates its weights, pays for
 * the change, and then lives with the result — and next week's decision starts from wherever this one left
 * it. Nobody here is solving anything; they are reacting, which is the point of the slide.
 */
export function runTrader(
  t: Trader,
  world: World,
  instruments: readonly Instrument[],
  news: readonly NewsEvent[],
  cost = 0.0015,
): PathStats {
  const n = instruments.length;

  // THE INITIAL BOOK, which is where most of the dispersion is born. A concentrated trader puts the bulk of
  // its capital in one name; a diversified one spreads it. Same year, very different outcome — before any
  // news is even read.
  const plan: number[] = new Array(n).fill((1 - t.concentration) / n);
  plan[t.favourite % n] += t.concentration;
  const planN = normalise(plan);

  let w = [...planN];
  let value = 1;
  let peak = 1;
  let costPaid = 0;
  // Cash held aside when de-risking. Without this, "cutting" just re-normalised back to fully invested,
  // so a cautious trader was indistinguishable from a passive one — measured: identical 1.231 finals and
  // zero cost. Cash is what makes flinching actually change the outcome.
  let cash = 0;
  const values: number[] = [1];
  const byWeek = new Map<number, NewsEvent>();
  for (const e of news) byWeek.set(e.week, e);

  for (let k = 0; k < world.weeks; k++) {
    let want = [...w];

    // React to last week's news — traders act AFTER they read it, never before.
    const ev = byWeek.get(k - 1);
    if (ev) {
      for (let i = 0; i < n; i++) {
        const s = ev.shock[instruments[i].ticker] ?? 0;
        // A positive `chase` piles into whatever moved; a negative one fades it. Both are real reflexes,
        // and having both is what makes this a fan rather than a herd.
        want[i] = Math.max(0, want[i] * (1 + t.chase * s * 6));
      }
      want = normalise(want);
    }

    // De-risk after a fall: move part of the book INTO CASH, which is what actually reduces exposure.
    const dd = value / peak - 1;
    if (dd < -0.03 && t.cut > 0.15) {
      const flee = Math.min(0.8, t.cut * Math.min(1, -dd * 5));
      const moved = flee * (1 - cash);
      cash += moved;
    } else if (cash > 0) {
      // Re-risk gradually as the fall repairs — nobody stays in cash forever.
      cash = Math.max(0, cash - t.revert * 0.5);
    }

    // Drift back toward the original plan.
    for (let i = 0; i < n; i++) want[i] += (planN[i] - want[i]) * t.revert;
    const target = normalise(want);

    // Turnover is charged on the INVESTED part only — moving to cash is itself a trade.
    const fee = (l1(w, target) * (1 - cash) + Math.abs(cash - (1 - (1 - cash)))) * cost;
    value *= 1 - fee;
    costPaid += fee;
    w = target;

    let g = 0;
    for (let i = 0; i < n; i++) g += w[i] * world.returns[k][i];
    // Cash earns the declared rate; the rest earns the market.
    value *= 1 + (1 - cash) * g + cash * (CASH_RATE / PER_YEAR);
    peak = Math.max(peak, value);
    values.push(value);
  }

  return { values, ...statsOf(values), costPaid };
}

/**
 * The SYSTEMATIC comparison: risk-weighted, rebalanced on a schedule, with a hard de-risk band.
 *
 * Included because the slide's argument needs a counterexample, and it is deliberately NOT presented as
 * anyone's track record — it is the same invented world, run by a rule instead of a reflex, to show that
 * the dispersion above is a property of the DECIDING, not of the market. The slide says exactly that.
 */
export function runSystematic(
  world: World,
  instruments: readonly Instrument[],
  cost = 0.0015,
  ddBand = 0.06,
): PathStats {
  const n = instruments.length;
  // Inverse-vol base: no single name allowed to dominate the outcome.
  const base = normalise(instruments.map((i) => (i.vol > 0 ? 1 / i.vol : 0)));
  let w = [...base];
  let value = 1;
  let peak = 1;
  let costPaid = 0;
  const values: number[] = [1];

  for (let k = 0; k < world.weeks; k++) {
    let target = [...base];

    // The drawdown constraint, as a rule rather than a panic: scale risk down smoothly as the fall
    // deepens, and restore it as the fall repairs. This is the "controlled drawdown" the job is about.
    const dd = value / peak - 1;
    if (dd < -ddBand * 0.5) {
      const scale = Math.max(0.35, 1 - (-dd - ddBand * 0.5) / ddBand);
      target = target.map((x) => x * scale);
    }
    target = normalise(target);

    // Only trade when the drift is worth the cost — a no-trade band, which is the cheapest correct
    // answer to "every change costs money".
    if (l1(w, target) > 0.08) {
      const fee = l1(w, target) * cost;
      value *= 1 - fee;
      costPaid += fee;
      w = target;
    }

    let g = 0;
    for (let i = 0; i < n; i++) g += w[i] * world.returns[k][i];
    value *= 1 + g;
    peak = Math.max(peak, value);
    values.push(value);
  }

  return { values, ...statsOf(values), costPaid };
}

/** Sharpe, vol, drawdown and final value from a value path. */
export function statsOf(values: readonly number[]): Omit<PathStats, 'values' | 'costPaid'> {
  const rets: number[] = [];
  for (let i = 1; i < values.length; i++) rets.push(values[i] / values[i - 1] - 1);
  const mean = rets.length ? rets.reduce((a, b) => a + b, 0) / rets.length : 0;
  const variance = rets.length > 1
    ? rets.reduce((a, r) => a + (r - mean) ** 2, 0) / (rets.length - 1)
    : 0;
  const sdWeekly = Math.sqrt(variance);
  const vol = sdWeekly * Math.sqrt(PER_YEAR);
  const annualReturn = mean * PER_YEAR;
  // Sharpe measures CONSISTENCY — return per unit of swing. It is not a drawdown measure; that is
  // maxDrawdown below, and the two disagree often enough that the slide reports both.
  const sharpe = vol > 0 ? (annualReturn - CASH_RATE) / vol : 0;

  let peak = -Infinity;
  let worst = 0;
  for (const v of values) {
    peak = Math.max(peak, v);
    worst = Math.min(worst, v / peak - 1);
  }

  return { final: values[values.length - 1] ?? 1, vol, sharpe, maxDrawdown: worst };
}

/** The spread of outcomes across a population — the number that makes the slide's point. */
export function dispersion(paths: readonly PathStats[]): {
  best: number; worst: number; median: number; spread: number;
  worstDrawdown: number; medianSharpe: number;
} {
  if (!paths.length) {
    return { best: 1, worst: 1, median: 1, spread: 0, worstDrawdown: 0, medianSharpe: 0 };
  }
  const finals = paths.map((p) => p.final).sort((a, b) => a - b);
  const sharpes = paths.map((p) => p.sharpe).sort((a, b) => a - b);
  const mid = Math.floor(finals.length / 2);
  return {
    best: finals[finals.length - 1],
    worst: finals[0],
    median: finals[mid],
    spread: finals[finals.length - 1] - finals[0],
    worstDrawdown: Math.min(...paths.map((p) => p.maxDrawdown)),
    medianSharpe: sharpes[mid],
  };
}

/** Pick the paths worth naming: the best, the median and the worst of the population.
 *  Returned with their index so a caller can highlight the same curve it labels. */
export function landmarks(paths: readonly PathStats[]): { label: string; index: number }[] {
  if (!paths.length) return [];
  const order = paths.map((p, i) => ({ i, f: p.final })).sort((a, b) => a.f - b.f);
  const mid = order[Math.floor(order.length / 2)];
  return [
    { label: 'the lucky one', index: order[order.length - 1].i },
    { label: 'the middle', index: mid.i },
    { label: 'the unlucky one', index: order[0].i },
  ];
}
