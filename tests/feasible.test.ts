import { describe, it, expect } from 'vitest';
import {
  SIMPLEX, CONSTRAINTS, toPlane, toWeights, toHalfPlane, slack, clip, area, centroid,
  feasibleAfter, areaSeries, satisfies, cutLine, type P2,
} from '../src/lib/feasible';

describe('the simplex and its coordinates', () => {
  it('is an equilateral triangle, so drawn areas are real areas', () => {
    const d = (a: P2, b: P2) => Math.hypot(a.x - b.x, a.y - b.y);
    const s1 = d(SIMPLEX[0], SIMPLEX[1]);
    const s2 = d(SIMPLEX[1], SIMPLEX[2]);
    const s3 = d(SIMPLEX[2], SIMPLEX[0]);
    expect(s2).toBeCloseTo(s1, 12);
    expect(s3).toBeCloseTo(s1, 12);
  });

  it('maps each pure portfolio to a vertex', () => {
    expect(toPlane([1, 0, 0])).toEqual(SIMPLEX[0]);
    expect(toPlane([0, 1, 0])).toEqual(SIMPLEX[1]);
    const g = toPlane([0, 0, 1]);
    expect(g.x).toBeCloseTo(SIMPLEX[2].x, 12);
    expect(g.y).toBeCloseTo(SIMPLEX[2].y, 12);
  });

  // The round trip has to hold, or a clipped vertex could not be read back as a portfolio — which is what
  // makes the drawing a picture of allocations rather than of shapes.
  it('round-trips weights through the plane', () => {
    for (const w of [[1, 0, 0], [0, 1, 0], [0, 0, 1], [1 / 3, 1 / 3, 1 / 3], [0.5, 0.2, 0.3]] as [number, number, number][]) {
      const back = toWeights(toPlane(w));
      for (let i = 0; i < 3; i++) expect(back[i]).toBeCloseTo(w[i], 12);
    }
  });

  it('every point in the triangle has weights summing to one', () => {
    for (const p of [{ x: 0.5, y: 0.2 }, { x: 0.3, y: 0.4 }, { x: 0.7, y: 0.1 }]) {
      const w = toWeights(p);
      expect(w[0] + w[1] + w[2]).toBeCloseTo(1, 12);
    }
  });
});

describe('constraints as half-planes', () => {
  // The derivation is the load-bearing part: if the substitution were wrong, every cut would be in the wrong
  // place and the picture would be confidently false. So check the half-plane against the ORIGINAL inequality
  // at many points rather than trusting the algebra.
  it('the half-plane agrees with the original inequality everywhere', () => {
    const samples: [number, number, number][] = [];
    for (let i = 0; i <= 10; i++) {
      for (let j = 0; i + j <= 10; j++) {
        samples.push([(10 - i - j) / 10, i / 10, j / 10]);
      }
    }
    for (const c of CONSTRAINTS) {
      for (const w of samples) {
        const direct = c.a[0] * w[0] + c.a[1] * w[1] + c.a[2] * w[2] - c.b;
        const viaPlane = slack(toPlane(w), c);
        expect(viaPlane, `${c.label} at ${w}`).toBeCloseTo(direct, 10);
      }
    }
  });

  it('a single-asset cap is satisfied at zero and violated at one', () => {
    const cap = CONSTRAINTS[0];   // NVDA <= 45%
    expect(slack(toPlane([0, 0.5, 0.5]), cap)).toBeLessThan(0);
    expect(slack(toPlane([1, 0, 0]), cap)).toBeGreaterThan(0);
  });
});

describe('clip — Sutherland–Hodgman', () => {
  const unit: P2[] = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
  // A constraint that cuts x <= 0.5 in plane terms: pick a·w so the half-plane is exactly that.
  // nx = -a1 + a2, so a1 = 0, a2 = 1 gives nx = 1, ny = -1/sqrt3 + 2*0/sqrt3... use a direct construction:
  const halfX: typeof CONSTRAINTS[number] = { label: 'x<=0.5', why: '', a: [0, 1, 0.5], b: 0.5 };

  it('returns the polygon unchanged when it is entirely satisfied', () => {
    const wide: typeof CONSTRAINTS[number] = { label: 'loose', why: '', a: [1, 1, 1], b: 10 };
    expect(clip(SIMPLEX, wide)).toHaveLength(3);
  });

  it('returns empty when nothing satisfies the constraint', () => {
    const impossible: typeof CONSTRAINTS[number] = { label: 'impossible', why: '', a: [1, 1, 1], b: -1 };
    expect(clip(SIMPLEX, impossible)).toHaveLength(0);
  });

  it('produces a convex polygon with a smaller area', () => {
    const cut = clip(SIMPLEX, CONSTRAINTS[0]);
    expect(cut.length).toBeGreaterThanOrEqual(3);
    expect(area(cut)).toBeLessThan(area(SIMPLEX));
    expect(area(cut)).toBeGreaterThan(0);
  });

  it('every surviving vertex satisfies the constraint', () => {
    for (const c of CONSTRAINTS) {
      for (const p of clip(SIMPLEX, c)) {
        expect(slack(p, c), c.label).toBeLessThan(1e-9);
      }
    }
  });

  it('is idempotent — clipping twice by the same constraint changes nothing', () => {
    const once = clip(SIMPLEX, CONSTRAINTS[1]);
    const twice = clip(once, CONSTRAINTS[1]);
    expect(area(twice)).toBeCloseTo(area(once), 12);
  });

  it('handles a degenerate input', () => {
    expect(clip([], CONSTRAINTS[0])).toEqual([]);
    expect(area(clip([{ x: 0, y: 0 }], CONSTRAINTS[0]))).toBe(0);
  });

  it('does not produce duplicate consecutive vertices', () => {
    for (const c of CONSTRAINTS) {
      const poly = clip(SIMPLEX, c);
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i];
        const b = poly[(i + 1) % poly.length];
        expect(Math.hypot(a.x - b.x, a.y - b.y), c.label).toBeGreaterThan(1e-9);
      }
    }
  });
});

describe('area', () => {
  it('is the shoelace area and always non-negative', () => {
    expect(area([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }])).toBeCloseTo(1, 12);
    // Reversed winding must give the same magnitude, or the "how much is left" number could go negative.
    expect(area([{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 0 }, { x: 0, y: 0 }])).toBeCloseTo(1, 12);
  });

  it('is zero for degenerate polygons', () => {
    expect(area([])).toBe(0);
    expect(area([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe(0);
  });
});

describe('the constraint sequence — what the animation shows', () => {
  const series = areaSeries();

  it('starts at the whole simplex', () => {
    expect(series[0]).toBeCloseTo(1, 12);
  });

  // THE ARGUMENT OF THE SLIDE: each rule removes space, and they compound. If any step failed to shrink the
  // set, that constraint would be decoration and should be cut from the list.
  it('every constraint removes area — none is decoration', () => {
    for (let i = 1; i < series.length; i++) {
      expect(series[i], `constraint ${i}: ${CONSTRAINTS[i - 1].label}`).toBeLessThan(series[i - 1]);
    }
  });

  it('never removes all of it — a feasible set survives', () => {
    expect(series[series.length - 1]).toBeGreaterThan(0);
  });

  it('leaves a small remainder, which is the point', () => {
    // Five rules on a triangle should leave a slice, not most of the space.
    expect(series[series.length - 1]).toBeLessThan(0.25);
  });

  it('the final polytope is a real convex region', () => {
    const poly = feasibleAfter(CONSTRAINTS.length);
    expect(poly.length).toBeGreaterThanOrEqual(3);
    expect(area(poly)).toBeGreaterThan(0);
  });

  it('every vertex of the final polytope satisfies EVERY constraint', () => {
    for (const p of feasibleAfter(CONSTRAINTS.length)) {
      for (const c of CONSTRAINTS) {
        expect(slack(p, c), c.label).toBeLessThan(1e-9);
      }
    }
  });

  it('the centroid of the final region is a genuinely feasible portfolio', () => {
    const w = toWeights(centroid(feasibleAfter(CONSTRAINTS.length)));
    expect(w[0] + w[1] + w[2]).toBeCloseTo(1, 10);
    for (const x of w) expect(x).toBeGreaterThan(-1e-9);
    expect(satisfies(w, CONSTRAINTS.length)).toBe(true);
  });

  it('is deterministic', () => {
    expect(areaSeries()).toEqual(series);
  });
});

describe('satisfies', () => {
  it('accepts a portfolio inside the final region', () => {
    const w = toWeights(centroid(feasibleAfter(CONSTRAINTS.length)));
    expect(satisfies(w, CONSTRAINTS.length)).toBe(true);
  });

  it('rejects an all-in-one-name portfolio', () => {
    expect(satisfies([1, 0, 0], CONSTRAINTS.length)).toBe(false);
  });

  it('with zero constraints, anything on the simplex passes', () => {
    expect(satisfies([1, 0, 0], 0)).toBe(true);
  });
});

describe('cutLine', () => {
  it('returns two points on the simplex boundary for a constraint that crosses it', () => {
    const line = cutLine(CONSTRAINTS[0]);
    expect(line).not.toBeNull();
    expect(line!).toHaveLength(2);
    for (const p of line!) {
      const w = toWeights(p);
      expect(w[0] + w[1] + w[2]).toBeCloseTo(1, 10);
      for (const x of w) expect(x).toBeGreaterThan(-1e-9);
    }
  });

  it('the cut line lies exactly on the constraint boundary', () => {
    for (const c of CONSTRAINTS) {
      const line = cutLine(c);
      if (!line) continue;
      for (const p of line) expect(Math.abs(slack(p, c)), c.label).toBeLessThan(1e-9);
    }
  });

  it('returns null for a constraint that misses the triangle', () => {
    expect(cutLine({ label: 'far', why: '', a: [1, 1, 1], b: 50 })).toBeNull();
  });
});
