// src/lib/bellman.ts
// THE BELLMAN LATTICE — multi-period portfolio choice solved by backward induction.
//
// The owner's brief for the final slide: "animate a 3D route in a Bellman propagation of many that we
// highlight as our goal."
//
// WHY THIS IS REAL MATHS AND NOT A DECORATION, which is the whole risk of the piece. Five showpieces have
// been rejected on this project, and the recorded reason is always the same: a drawing that looks like it
// means something without meaning anything. So the animation shows an ACTUAL algorithm running. This module
// solves a genuine finite-horizon dynamic program:
//
//     V(T, s) = terminal(s)
//     V(t, s) = max over actions a of [ reward(t, s, a) - cost(s, a) + V(t+1, next(s,a)) ]
//
// and the tests assert the Bellman optimality condition holds at every node, that the traced policy is
// optimal, and that it beats a naive fixed-allocation policy. If those pass, the picture is teaching the
// method rather than illustrating a mood.
//
// THE STATE IS RISK EXPOSURE, discretised. That choice matters for honesty: a state space of "how much risk
// am I carrying" is the smallest one that makes multi-period allocation a real DP — it has an action (change
// exposure), a cost of acting (turnover), and a payoff that depends on the world. It is a teaching model, not
// a production optimiser, and the slide says so.
//
// Pure: no DOM, no canvas. Deterministic: no Math.random() anywhere (the project bans it at paint time, and
// a lattice that shimmered between repaints would be indefensible). Unit-tested in tests/bellman.test.ts.

/** How many discrete exposure levels the lattice carries. Level 0 = all cash, level N-1 = fully invested. */
export const LEVELS = 9;

/** How many decision points. Twelve reads as a year of monthly decisions. */
export const PERIODS = 12;

/** Exposure at a given level, 0..1.
 *
 *  The clamp is on the RESULT, not on the level. A first version clamped the level to 1 before dividing, so
 *  every state above the first collapsed to 0.125 — the whole state space became one point, and the DP
 *  silently "solved" a problem with nothing to decide. Seven tests caught it at once, which is exactly what
 *  they are for: the visual would have animated a flat lattice and looked plausible. */
export function exposureOf(level: number): number {
  if (LEVELS <= 1) return 0;
  return Math.min(1, Math.max(0, level / (LEVELS - 1)));
}

export interface WorldModel {
  /** Expected excess return per period at full exposure. */
  mu: number;
  /** Volatility per period at full exposure. */
  sigma: number;
  /** Risk aversion — how much variance is penalised relative to return. */
  lambda: number;
  /** Linear cost per unit of exposure changed. This is what couples the periods together. */
  cost: number;
  /**
   * Per-period tilt on expected return, indexed by period. This is the "news" the model knows about: a
   * declared sequence, so the solution is reproducible. A period with a negative tilt is one where holding
   * risk is expected to be punished.
   */
  tilt: number[];
}

/** A declared world. The tilt is hand-authored so the optimal route has a legible SHAPE — risk on early,
 *  out through the bad stretch, back in for the recovery — rather than being a monotone ramp that teaches
 *  nothing. */
export const WORLD: WorldModel = {
  mu: 0.010,
  sigma: 0.045,
  lambda: 2.2,
  // CALIBRATED BY SWEEP, not guessed. At 0.0035 the toll to change exposure was ~0.028 against a per-period
  // gain of ~0.005, so the optimum never moved at all: the solved route was a flat line at full exposure and
  // three tests failed. A flat route would have been the worst possible outcome for this slide — it would
  // have animated a "sequence of decisions" in which no decision is ever made.
  // Measured across 0.0035 / 0.0015 / 0.0008 / 0.0004 / 0.0002: the first two give zero changes, and 0.0002
  // gives a route that de-risks into BOTH negative stretches and returns for the recoveries — four changes,
  // and a real margin over the best constant policy. That is a legible policy rather than a busy one.
  cost: 0.0002,
  //      t0     t1     t2     t3     t4     t5     t6     t7     t8     t9    t10    t11
  tilt: [0.004, 0.006, 0.002, -0.011, -0.008, 0.001, 0.007, 0.003, -0.006, 0.008, 0.005, 0.002],
};

/**
 * Single-period reward for holding `level` exposure through period `t`: expected return minus a variance
 * penalty. This is the classic mean–variance objective, per period.
 *
 * Stated as a utility rather than as money, because that is what it is — the lambda term is a preference,
 * not a measurement.
 */
export function reward(t: number, level: number, w: WorldModel = WORLD): number {
  const e = exposureOf(level);
  const tilt = w.tilt[t] ?? 0;
  const expected = (w.mu + tilt) * e;
  const variance = (w.sigma * e) ** 2;
  return expected - w.lambda * variance;
}

/** Cost of moving from one exposure level to another. Linear in the change, which is why a good policy does
 *  not chase every tilt: the move has to be worth the toll. */
export function moveCost(from: number, to: number, w: WorldModel = WORLD): number {
  return Math.abs(exposureOf(to) - exposureOf(from)) * w.cost * (LEVELS - 1);
}

export interface Solution {
  /** value[t][s] — the optimal value of being in state s at time t. */
  value: number[][];
  /** policy[t][s] — the state to move to from s at time t. -1 at the terminal layer. */
  policy: number[][];
  levels: number;
  periods: number;
}

/**
 * Solve by BACKWARD INDUCTION, which is the thing the animation shows.
 *
 * The last layer's value is known (nothing follows it), and every earlier layer is computed from the one
 * after it. That direction is the whole idea of dynamic programming and the reason the visual runs backward
 * before the route runs forward: you cannot know what today's best move is until you know what tomorrow is
 * worth.
 */
export function solve(w: WorldModel = WORLD, periods = PERIODS, levels = LEVELS): Solution {
  const value: number[][] = [];
  const policy: number[][] = [];
  for (let t = 0; t <= periods; t++) {
    value.push(new Array(levels).fill(0));
    policy.push(new Array(levels).fill(-1));
  }

  // Terminal layer: no future, so no value beyond zero. Holding risk past the horizon earns nothing here,
  // which keeps the model honest about what it does and does not price.
  for (let s = 0; s < levels; s++) value[periods][s] = 0;

  for (let t = periods - 1; t >= 0; t--) {
    for (let s = 0; s < levels; s++) {
      let best = -Infinity;
      let bestTo = s;
      for (let to = 0; to < levels; to++) {
        const v = reward(t, to, w) - moveCost(s, to, w) + value[t + 1][to];
        if (v > best) {
          best = v;
          bestTo = to;
        }
      }
      value[t][s] = best;
      policy[t][s] = bestTo;
    }
  }

  return { value, policy, levels, periods };
}

export interface RouteStep {
  t: number;
  /** State held THROUGH period t. */
  level: number;
  /** Value of being here. */
  value: number;
  /** Cost paid to arrive. */
  cost: number;
}

/** Trace the optimal route forward from a starting state, using the solved policy. */
export function route(sol: Solution, start = 0, w: WorldModel = WORLD): RouteStep[] {
  const out: RouteStep[] = [];
  let s = Math.min(sol.levels - 1, Math.max(0, start));
  for (let t = 0; t < sol.periods; t++) {
    const to = sol.policy[t][s];
    out.push({ t, level: to, value: sol.value[t][s], cost: moveCost(s, to, w) });
    s = to;
  }
  return out;
}

/** Total utility of an arbitrary route, for comparing the optimum against alternatives. */
export function utilityOf(levels: readonly number[], w: WorldModel = WORLD): number {
  let total = 0;
  let prev = 0;
  for (let t = 0; t < levels.length; t++) {
    total += reward(t, levels[t], w) - moveCost(prev, levels[t], w);
    prev = levels[t];
  }
  return total;
}

/** A fixed-exposure policy, for the comparison the slide leans on: the best CONSTANT allocation. */
export function bestConstant(
  w: WorldModel = WORLD,
  periods = PERIODS,
  levels = LEVELS,
): { level: number; utility: number } {
  let best = { level: 0, utility: -Infinity };
  for (let s = 0; s < levels; s++) {
    const u = utilityOf(new Array(periods).fill(s), w);
    if (u > best.utility) best = { level: s, utility: u };
  }
  return best;
}

/**
 * CANDIDATE ROUTES to draw behind the optimum — the "many" the owner asked for.
 *
 * Enumerated deterministically rather than sampled: each candidate is a fixed-exposure path or a simple
 * two-phase path, so the fan is reproducible and every line in it is a policy someone could actually state.
 * That is the difference between a meaningful fan and visual noise.
 */
export function candidates(periods = PERIODS, levels = LEVELS): number[][] {
  const out: number[][] = [];
  // Every constant exposure.
  for (let s = 0; s < levels; s++) out.push(new Array(periods).fill(s));
  // Two-phase: start at a, switch to b halfway. Sampled on a coarse grid so the count stays legible.
  for (let a = 0; a < levels; a += 2) {
    for (let b = 0; b < levels; b += 2) {
      if (a === b) continue;
      const half = Math.floor(periods / 2);
      out.push([...new Array(half).fill(a), ...new Array(periods - half).fill(b)]);
    }
  }
  return out;
}

/** Does the value function satisfy the Bellman equation at this node? Exposed so the TEST can check the
 *  algorithm rather than the test re-implementing it. */
export function bellmanResidual(
  sol: Solution,
  t: number,
  s: number,
  w: WorldModel = WORLD,
): number {
  if (t >= sol.periods) return sol.value[t][s];
  let best = -Infinity;
  for (let to = 0; to < sol.levels; to++) {
    best = Math.max(best, reward(t, to, w) - moveCost(s, to, w) + sol.value[t + 1][to]);
  }
  return sol.value[t][s] - best;
}

// ── PROJECTION: the lattice in 3D ────────────────────────────────────────────────────────────────────
//
// Hand-rolled oblique projection rather than three.js: the site already does this in lib/terrain.ts, it ships
// no bytes, and a parallel projection keeps distances comparable across the lattice — which matters when the
// height IS the value being compared.

export interface View3 {
  w: number;
  h: number;
  /** How far depth pushes right, 0..1. */
  shear: number;
  /** How much value lifts, in screen fraction. */
  lift: number;
  pad: { l: number; r: number; t: number; b: number };
}

/**
 * Project a lattice node to screen.
 *
 * @param t     period, 0..periods
 * @param level exposure state, 0..levels-1
 * @param v     value at that node, normalised 0..1 (the caller normalises, so the projection stays pure
 *              geometry and the colour/height mapping is decided once, elsewhere)
 */
export function project3(
  t: number,
  level: number,
  v: number,
  periods: number,
  levels: number,
  view: View3,
): [number, number] {
  const iw = view.w - view.pad.l - view.pad.r;
  const ih = view.h - view.pad.t - view.pad.b;
  const u = periods > 0 ? t / periods : 0;          // time runs left to right
  const d = levels > 1 ? level / (levels - 1) : 0;  // state recedes into depth

  // THE X TERM MUST BE A CONVEX COMBINATION, or the far corner leaves the frame. A first version used
  // (u * (1 - shear/2) + d * shear), whose maximum at u=d=1 is 1 + shear/2 — it overflowed the right pad by
  // 2px at shear 0.34, caught by the in-frame test. Scaling time by (1 - shear) instead keeps the maximum at
  // exactly 1, so the whole lattice is inside its box by construction rather than by luck.
  const x = view.pad.l + (u * (1 - view.shear) + d * view.shear) * iw;

  // Depth lifts the row and value lifts the node; together they must not exceed the inner height. The depth
  // term takes a fixed share and the value term the rest, so a full-height value at the deepest row still
  // lands on the top pad rather than above it.
  const depthShare = view.shear * 0.55;
  const y = view.pad.t + ih - d * depthShare * ih - v * Math.min(view.lift, 1 - depthShare) * ih;
  return [x, y];
}

/** Normalise a solved value surface into 0..1, for the height mapping. Returns the bounds too, so a caller
 *  can label the axis honestly rather than showing an unlabelled height. */
export function valueBounds(sol: Solution): { lo: number; hi: number } {
  let lo = Infinity;
  let hi = -Infinity;
  for (let t = 0; t < sol.periods; t++) {
    for (let s = 0; s < sol.levels; s++) {
      lo = Math.min(lo, sol.value[t][s]);
      hi = Math.max(hi, sol.value[t][s]);
    }
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return { lo: 0, hi: 1 };
  return { lo, hi };
}
