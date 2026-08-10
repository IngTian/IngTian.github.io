// src/lib/complexity.ts
// THE SIZE OF THE PROBLEM — what the Limits slide is actually about.
//
// The owner's redirect, and it reframes the whole slide: "a graph is not illustrative here. the constraints are
// complex and internally connected… essentially this slide just needs to present how complex the situation is.
// that's the whole point. the first slide let people understand what it is, the second one introduce the immense
// complexity."
//
// So the slide is not a geometry lesson. Its job is SCALE, in the order the owner named:
//   1. you run $1bn+ — your picks are constrained, and your slippage is now measurable
//   2. name a few constraints
//   3. draw the trajectories the names might take — thousands of them, a legible subset drawn
//   4. so: how do you account for a stochastic future, obey every rule, and still optimise?
//
// WHY THE PREVIOUS DRAWINGS WENT. The triangle (lib/feasible) and the path lattice (lib/pathspace) are both real
// and exact, and both answer "what is the feasible set" — a question a reader who has never been told no does
// not have. They also both shrink something, which reads as tidying up rather than as difficulty. The point is
// the opposite: the problem gets BIGGER the closer you look. Both modules are kept, unreferenced, so nothing
// verified is lost and either can come back.
//
// EVERYTHING HERE IS EITHER CITED OR COMPUTED:
//   * the 5% ownership-disclosure threshold is the real SEC 13D/G number
//   * square-root market impact is standard, and calibrated to the published anchor that trading one day's
//     volume moves the price about one daily standard deviation — so k = 1 by construction, not by taste
//   * the fund's own figures ($1bn, 3,000 names, 2,000 rules, 24 rebalances) already live in data/desk.ts
//   * the trajectories are a seeded random walk: identical on every build, because the project bans
//     Math.random() at paint time and a fan that shimmered would be indefensible
//
// Pure: no DOM. Unit-tested in tests/complexity.test.ts.

import { mulberry32, gauss } from './scenario';

// ── BEAT 1: SLIPPAGE BECOMES MEASURABLE ──────────────────────────────────────────────────────────────────

/** Half-spread paid on any trade, in basis points. */
export const SPREAD_BPS = 1.0;

/** Daily volatility of a high-beta name — about 40% a year. */
export const SIGMA_DAILY = 0.025;

/**
 * Impact coefficient. k = 1 is not a free parameter: it is fixed by the published anchor that trading 100% of a
 * day's volume moves the price by roughly one daily standard deviation. At k = 1 the model reproduces that
 * exactly, and it then agrees with the 10%-of-volume rule of thumb desks actually use (about 79bp).
 */
export const IMPACT_K = 1.0;

/** A mega-cap's daily dollar volume — the deepest, friendliest market there is. */
export const DAILY_VOLUME = 30e9;

/** Cost of moving `order` dollars, in basis points of the order. */
export function slippageBps(order: number, dailyVolume = DAILY_VOLUME): number {
  if (order <= 0) return 0;
  const participation = order / dailyVolume;
  return SPREAD_BPS / 2 + IMPACT_K * SIGMA_DAILY * Math.sqrt(participation) * 1e4;
}

/** Cost in dollars of moving `order` dollars. */
export function slippageCost(order: number, dailyVolume = DAILY_VOLUME): number {
  return (order * slippageBps(order, dailyVolume)) / 1e4;
}

export interface SizeRung {
  label: string;
  aum: number;
  /** Dollars moved when this book changes a fifth of its position. */
  order: number;
  /** Share of one day's trading that order represents. */
  participation: number;
  bps: number;
  cost: number;
}

/**
 * THE LADDER. The same decision — move a fifth of the book — priced at four sizes.
 *
 * This is beat one, and it is the only beat that makes the reader's own position legible: at $5,000 the cost
 * rounds to zero and you may do whatever you like, which is exactly why a retail reader has never met a
 * constraint. At $10bn the same decision costs millions, so you cannot simply change your mind.
 */
export function sizeLadder(fraction = 0.20): SizeRung[] {
  const rungs: { label: string; aum: number }[] = [
    { label: 'your savings', aum: 5_000 },
    { label: 'a rich family', aum: 10_000_000 },
    { label: 'a fund', aum: 1_000_000_000 },
    { label: 'a big fund', aum: 10_000_000_000 },
  ];
  return rungs.map((r) => {
    const order = r.aum * fraction;
    return {
      ...r,
      order,
      participation: order / DAILY_VOLUME,
      bps: slippageBps(order),
      cost: slippageCost(order),
    };
  });
}

// ── BEAT 3: THE TRAJECTORIES ─────────────────────────────────────────────────────────────────────────────

/** Weeks in the drawn year. */
export const TRAJ_WEEKS = 52;

/**
 * How many trajectories to draw.
 *
 * TWO MEASUREMENTS SET THIS, pulling in opposite directions.
 *
 * Legibility: rasterising the fan into the real 560x300 box and counting inked pixels, 24 paths ink 7% and read
 * as "a few lines"; 80 ink ~16%; 120 ink 20%; 240 ink 28% and individual paths stop being followable. Anything
 * from about 60 up reads as a fan too plural to count, which is what "there are way more than I can draw" needs.
 *
 * Performance: 120 paths cost 151ms of LCP and took Lighthouse from 96 to 95 — the layout of that many SVG
 * polylines, not their bytes (rounding coordinates cut 25KB from the document and changed nothing). At 80 the
 * page measures 96 and LCP 2559ms, matching the baseline exactly.
 *
 * So 80: the smallest count that still reads as a thicket, at no cost to the page.
 */
export const TRAJ_COUNT = 80;

/**
 * One possible future for one name: a seeded random walk with its own drift and volatility.
 *
 * Each trajectory draws its OWN parameters, so the fan spans behaviours rather than being one walk repeated —
 * that is what makes it read as "thousands of different names" instead of as noise around a single path.
 */
export function trajectories(count = TRAJ_COUNT, weeks = TRAJ_WEEKS, seed = 0x51a7): number[][] {
  const rand = mulberry32(seed);
  const out: number[][] = [];
  for (let i = 0; i < count; i++) {
    const drift = 0.04 + 0.22 * rand();
    const vol = 0.14 + 0.40 * rand();
    let v = 100;
    const path = [v];
    for (let w = 0; w < weeks; w++) {
      v *= 1 + drift / 52 + (vol / Math.sqrt(52)) * gauss(rand);
      path.push(v);
    }
    out.push(path);
  }
  return out;
}

/**
 * The shared vertical scale for a set of trajectories.
 *
 * CLIPPED TO A PERCENTILE RANGE, not to the extremes, and this is a measured decision. On the shipped fan the
 * full span is 30 to 376 while the 1st-to-99th percentile span is 51 to 196: one lucky path was taking 58% of
 * the vertical space and squashing the other 119 into a band. Clipping keeps the fan's SHAPE legible, which is
 * the whole job of the drawing; the handful of paths that leave the top or bottom are simply drawn outside the
 * box, which reads correctly as "and some go further than this".
 *
 * `trim` is the fraction cut from each tail. 0 gives the true extremes, for callers that want them.
 */
export function trajBounds(paths: readonly number[][], trim = 0.01): { lo: number; hi: number } {
  const all: number[] = [];
  for (const p of paths) for (const v of p) all.push(v);
  if (!all.length) return { lo: 90, hi: 110 };
  all.sort((a, b) => a - b);
  const i = Math.min(all.length - 1, Math.max(0, Math.floor(trim * (all.length - 1))));
  const lo = all[i];
  const hi = all[all.length - 1 - i];
  if (!(hi > lo)) return { lo: Math.min(...all), hi: Math.max(...all) + 1 };
  return { lo, hi };
}

/**
 * Project one trajectory to an SVG polyline.
 *
 * COORDINATES ARE ROUNDED TO WHOLE PIXELS, and every point is emitted, but the string is the thing that ships:
 * measured, the fan cost 151ms of LCP (Lighthouse perf 96 -> 95) because 120 paths x 53 points of
 * one-decimal coordinates is a lot of bytes in the document. Whole pixels cut the markup by about a fifth at a
 * drawing scale where a tenth of a pixel is invisible, and `step` lets a caller thin the points as well.
 */
export function trajPoints(
  path: readonly number[],
  bounds: { lo: number; hi: number },
  box: { x: number; y: number; w: number; h: number },
  step = 1,
): string {
  const span = bounds.hi - bounds.lo || 1;
  const out: string[] = [];
  const last = path.length - 1;
  for (let i = 0; i <= last; i += step) {
    const x = box.x + (i / last) * box.w;
    const y = box.y + (1 - (path[i] - bounds.lo) / span) * box.h;
    out.push(`${Math.round(x)},${Math.round(y)}`);
  }
  // Always land on the final point, or a thinned path would stop short of the right edge.
  if ((last % step) !== 0) {
    const y = box.y + (1 - (path[last] - bounds.lo) / span) * box.h;
    out.push(`${Math.round(box.x + box.w)},${Math.round(y)}`);
  }
  return out.join(' ');
}

// ── BEAT 4: THE SIZE OF THE QUESTION ─────────────────────────────────────────────────────────────────────

/**
 * How many numbers the fund actually has to choose: one weight per name per rebalance.
 *
 * The point of stating it is that this is the EASY part — it is merely large. The hard part is that each of
 * those numbers must be chosen without knowing the future, under rules that refer to each other.
 */
export function decisionVariables(tickers: number, periods: number): number {
  return tickers * periods;
}

/**
 * Leaves of a scenario tree with `branches` outcomes per period.
 *
 * Deliberately crude, and the slide says so: nobody models the future with a 3-way tree. It is the honest
 * lower bound on "how many futures are there", and even at three outcomes over 24 rebalances it is 2.8e11 —
 * which is the number that makes the beat land. Returns Infinity rather than overflowing silently.
 */
export function scenarioLeaves(branches: number, periods: number): number {
  if (branches <= 0 || periods < 0) return 0;
  const n = branches ** periods;
  return Number.isFinite(n) ? n : Infinity;
}

/** Order of magnitude, for copy that says "one in 10^n" rather than printing a wall of digits. */
export function magnitude(x: number): number {
  if (!Number.isFinite(x) || x <= 0) return 0;
  return Math.floor(Math.log10(x));
}

// ── BEAT 4: THE MAGNITUDE, AND WHY IT IS NOT A COUNTING PROBLEM ──────────────────────────────────────────
//
// The owner: "in the 4th panel we might need a different graph to further exemplify the complexity of it. in
// the 3rd panel you named routes for one holding, now you have 3000 plus 2000 regulations, how gigantic is
// that? what's the best way to exemplify the magnitude of difficulty there is."
//
// I probed five framings before building anything, and two of them are traps worth recording:
//
//   * COSMIC COMPARISON. "10^11 futures" sounds enormous until you compare it: grains of sand on Earth are
//     10^19, so the scenario tree is a hundred million times SMALLER than sand. Reaching for scale invites a
//     comparison you lose.
//   * BRUTE FORCE. At a billion candidates a second, 3^24 takes 282 seconds. A number a laptop can exhaust
//     over lunch is not evidence of difficulty — quoting it actively undermines the claim.
//
// So the magnitude that matters is NOT how many combinations exist. It is that the problem has three hard
// properties at once, and the third is the one no tally can show:
//   1. stochastic  — you must choose before knowing which future arrives
//   2. sequential  — today's choice constrains tomorrow's, and changing your mind costs m^1.5
//   3. COUPLED     — the rules refer to each other, so satisfying one can breach another
//
// Coupling is what a drawing can carry. 2,000 rules do not form a list of 2,000 things to check; they form a
// web with 1,999,000 pairs, any of which can conflict. That is the number, and unlike the others it grows
// quadratically in something a reader can hold.

/** Distinct pairs among n rules — every pair is a chance for one rule to conflict with another. */
export function rulePairs(n: number): number {
  if (n < 2) return 0;
  return (n * (n - 1)) / 2;
}

/**
 * A deterministic conflict web for the drawing: which rules interact with which.
 *
 * Not every pair of real rules conflicts, so a fully-connected graph would overstate it. This builds a sparse
 * symmetric adjacency on a small grid — enough edges that the web reads as tangled, few enough that a reader
 * can see it IS a web rather than a solid block. Seeded, like everything else drawn on this site.
 *
 * Returns the upper-triangle edges only, so each interaction is drawn once.
 */
export function conflictWeb(n = 28, density = 0.14, seed = 0x9e37): [number, number][] {
  const rand = mulberry32(seed);
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (rand() < density) out.push([i, j]);
    }
  }
  return out;
}

/** Position rule `i` of `n` evenly around a circle, so the web is drawn as a chord diagram. */
export function rulePoint(
  i: number,
  n: number,
  cx: number,
  cy: number,
  r: number,
): [number, number] {
  // Start at the top and go clockwise, which is how a reader expects an index around a dial to run.
  const a = -Math.PI / 2 + (i / Math.max(1, n)) * Math.PI * 2;
  return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
}
