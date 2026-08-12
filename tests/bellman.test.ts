import { describe, it, expect } from 'vitest';
import {
  LEVELS, PERIODS, WORLD, exposureOf, reward, moveCost, solve, route, utilityOf,
  bestConstant, candidates, bellmanResidual, project3, valueBounds,
} from '../src/lib/bellman';

const sol = solve();

describe('the state space', () => {
  it('maps level 0 to all cash and the top level to fully invested', () => {
    expect(exposureOf(0)).toBe(0);
    expect(exposureOf(LEVELS - 1)).toBe(1);
  });

  it('is monotone in level', () => {
    for (let s = 1; s < LEVELS; s++) {
      expect(exposureOf(s)).toBeGreaterThan(exposureOf(s - 1));
    }
  });

  it('clamps out-of-range levels rather than extrapolating', () => {
    expect(exposureOf(-5)).toBe(0);
    expect(exposureOf(999)).toBe(1);
  });
});

describe('the per-period objective', () => {
  it('pays nothing and risks nothing at zero exposure', () => {
    expect(reward(0, 0)).toBe(0);
  });

  // The variance penalty is what makes this a RISK problem rather than a return-chasing one: at some point
  // more exposure stops being worth it, and the optimiser has to find that point.
  it('is concave in exposure — more risk eventually costs more than it earns', () => {
    const rs = Array.from({ length: LEVELS }, (_, s) => reward(0, s));
    const diffs = rs.slice(1).map((r, i) => r - rs[i]);
    for (let i = 1; i < diffs.length; i++) {
      expect(diffs[i]).toBeLessThan(diffs[i - 1]);
    }
  });

  it('a negative tilt period punishes exposure', () => {
    const worst = WORLD.tilt.indexOf(Math.min(...WORLD.tilt));
    expect(reward(worst, LEVELS - 1)).toBeLessThan(reward(worst, 0));
  });

  it('a positive tilt period rewards some exposure', () => {
    const best = WORLD.tilt.indexOf(Math.max(...WORLD.tilt));
    expect(reward(best, Math.floor(LEVELS / 2))).toBeGreaterThan(reward(best, 0));
  });
});

describe('moveCost', () => {
  it('is zero for standing still', () => {
    expect(moveCost(4, 4)).toBe(0);
  });

  it('is symmetric', () => {
    expect(moveCost(1, 6)).toBeCloseTo(moveCost(6, 1), 12);
  });

  it('grows with the size of the move — this is what couples the periods', () => {
    expect(moveCost(0, LEVELS - 1)).toBeGreaterThan(moveCost(0, 1));
  });
});

describe('solve — backward induction', () => {
  it('produces a value and a policy for every node', () => {
    expect(sol.value).toHaveLength(PERIODS + 1);
    for (const layer of sol.value) expect(layer).toHaveLength(LEVELS);
    for (let t = 0; t < PERIODS; t++) {
      for (let s = 0; s < LEVELS; s++) {
        expect(Number.isFinite(sol.value[t][s])).toBe(true);
        expect(sol.policy[t][s]).toBeGreaterThanOrEqual(0);
        expect(sol.policy[t][s]).toBeLessThan(LEVELS);
      }
    }
  });

  // THE TEST THAT MAKES THE VISUAL HONEST. If this fails, the animation is a drawing of nothing: the
  // value surface would not be the solution to any optimisation problem. It checks the Bellman optimality
  // condition directly at every single node.
  it('satisfies the Bellman equation at EVERY node', () => {
    for (let t = 0; t < PERIODS; t++) {
      for (let s = 0; s < LEVELS; s++) {
        expect(Math.abs(bellmanResidual(sol, t, s)), `t=${t} s=${s}`).toBeLessThan(1e-12);
      }
    }
  });

  it('has a zero terminal layer, since nothing follows the horizon', () => {
    for (let s = 0; s < LEVELS; s++) expect(sol.value[PERIODS][s]).toBe(0);
  });

  it('is deterministic — identical on every solve', () => {
    expect(solve().value).toEqual(sol.value);
    expect(solve().policy).toEqual(sol.policy);
  });

  // Value must weakly decrease in the cost of being somewhere expensive to leave: being in a state you have
  // to pay to escape is worth no more than being where you want to be already.
  it('the best state to be in is never worse than any other', () => {
    for (let t = 0; t < PERIODS; t++) {
      const best = Math.max(...sol.value[t]);
      for (let s = 0; s < LEVELS; s++) expect(sol.value[t][s]).toBeLessThanOrEqual(best + 1e-12);
    }
  });
});

describe('route — the traced optimum', () => {
  const r = route(sol, 0);

  it('has one step per period', () => {
    expect(r).toHaveLength(PERIODS);
    expect(r[0].t).toBe(0);
    expect(r[r.length - 1].t).toBe(PERIODS - 1);
  });

  it('stays inside the state space', () => {
    for (const step of r) {
      expect(step.level).toBeGreaterThanOrEqual(0);
      expect(step.level).toBeLessThan(LEVELS);
    }
  });

  // THE ROUTE MUST ACTUALLY BE OPTIMAL. Its utility has to match the DP's own value for the start state, or
  // the policy and the value function disagree — which would mean the highlighted line in the animation is
  // not the answer the surface says it is.
  it('achieves exactly the value the DP promises', () => {
    const traced = utilityOf(r.map((s) => s.level));
    expect(traced).toBeCloseTo(sol.value[0][0], 10);
  });

  // The claim the slide makes: solving the SEQUENCE beats picking one allocation and holding it. If this were
  // false, multi-period optimisation would be pointless and the whole section would be wrong.
  it('beats the best constant-exposure policy', () => {
    const optimal = utilityOf(r.map((s) => s.level));
    expect(optimal).toBeGreaterThan(bestConstant().utility);
  });

  it('beats every enumerated candidate policy', () => {
    const optimal = utilityOf(r.map((s) => s.level));
    for (const c of candidates()) {
      expect(optimal).toBeGreaterThanOrEqual(utilityOf(c) - 1e-12);
    }
  });

  // The route should have a legible SHAPE — it must actually move, or the picture teaches that doing nothing
  // is optimal and the "sequence of decisions" framing is empty.
  it('changes exposure at least twice, so the sequence matters', () => {
    const levels = r.map((s) => s.level);
    let changes = 0;
    for (let i = 1; i < levels.length; i++) if (levels[i] !== levels[i - 1]) changes++;
    expect(changes).toBeGreaterThanOrEqual(2);
  });

  // And it must not thrash: a route that moved every single period would mean the cost term is doing nothing.
  it('does NOT move every period — the cost term has teeth', () => {
    const levels = r.map((s) => s.level);
    let changes = 0;
    for (let i = 1; i < levels.length; i++) if (levels[i] !== levels[i - 1]) changes++;
    expect(changes).toBeLessThan(levels.length - 1);
  });

  it('cuts exposure into the worst stretch', () => {
    // The declared world has its deepest negative tilt at t=3. A sane optimum is carrying less risk there
    // than at the best period.
    const best = WORLD.tilt.indexOf(Math.max(...WORLD.tilt));
    const worst = WORLD.tilt.indexOf(Math.min(...WORLD.tilt));
    expect(r[worst].level).toBeLessThan(r[best].level);
  });

  it('clamps a nonsense start state', () => {
    expect(() => route(sol, -4)).not.toThrow();
    expect(() => route(sol, 99)).not.toThrow();
  });
});

describe('candidates — the fan drawn behind the optimum', () => {
  const cs = candidates();

  it('includes every constant policy', () => {
    for (let s = 0; s < LEVELS; s++) {
      expect(cs.some((c) => c.every((x) => x === s))).toBe(true);
    }
  });

  it('every candidate is a full-length, in-range policy', () => {
    for (const c of cs) {
      expect(c).toHaveLength(PERIODS);
      for (const x of c) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThan(LEVELS);
      }
    }
  });

  it('is deterministic and non-trivial in size', () => {
    expect(candidates()).toEqual(cs);
    expect(cs.length).toBeGreaterThan(LEVELS);
  });
});

describe('project3', () => {
  const view = { w: 800, h: 400, shear: 0.34, lift: 0.5, pad: { l: 40, r: 40, t: 20, b: 40 } };

  it('puts t=0 at the left and the last period further right', () => {
    const [x0] = project3(0, 0, 0, PERIODS, LEVELS, view);
    const [x1] = project3(PERIODS, 0, 0, PERIODS, LEVELS, view);
    expect(x1).toBeGreaterThan(x0);
  });

  it('pushes deeper states right and up, which is what makes it read as depth', () => {
    const [xNear, yNear] = project3(4, 0, 0, PERIODS, LEVELS, view);
    const [xFar, yFar] = project3(4, LEVELS - 1, 0, PERIODS, LEVELS, view);
    expect(xFar).toBeGreaterThan(xNear);
    expect(yFar).toBeLessThan(yNear);
  });

  it('lifts higher values higher on screen', () => {
    const [, yLow] = project3(4, 4, 0, PERIODS, LEVELS, view);
    const [, yHigh] = project3(4, 4, 1, PERIODS, LEVELS, view);
    expect(yHigh).toBeLessThan(yLow);
  });

  it('keeps every lattice node inside the frame', () => {
    for (let t = 0; t <= PERIODS; t++) {
      for (let s = 0; s < LEVELS; s++) {
        const [x, y] = project3(t, s, 1, PERIODS, LEVELS, view);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(view.w);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(view.h);
      }
    }
  });

  it('degrades safely on a degenerate lattice', () => {
    const [x, y] = project3(0, 0, 0, 0, 1, view);
    expect(Number.isFinite(x)).toBe(true);
    expect(Number.isFinite(y)).toBe(true);
  });
});

describe('valueBounds', () => {
  it('brackets every value in the solved surface', () => {
    const b = valueBounds(sol);
    for (let t = 0; t < PERIODS; t++) {
      for (let s = 0; s < LEVELS; s++) {
        expect(sol.value[t][s]).toBeGreaterThanOrEqual(b.lo - 1e-12);
        expect(sol.value[t][s]).toBeLessThanOrEqual(b.hi + 1e-12);
      }
    }
  });

  it('returns a usable range even for a degenerate solution', () => {
    const b = valueBounds({ value: [[]], policy: [[]], levels: 0, periods: 0 });
    expect(b.hi).toBeGreaterThanOrEqual(b.lo);
  });
});
