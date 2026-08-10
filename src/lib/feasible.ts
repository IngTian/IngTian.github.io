// src/lib/feasible.ts
// THE FEASIBLE SET, AS ACTUAL LINEAR ALGEBRA.
//
// The owner: "for a feasible set, it can be animated in linear algebra right".
//
// Right, and that is what makes this buildable where "abstract shapes" would have been the sixth rejected
// showpiece. A portfolio constraint is a LINEAR INEQUALITY a·w <= b, which is a half-space. The set of legal
// portfolios is the intersection of all of them — a convex polytope. So "the rules collapse the space" is not
// a metaphor to illustrate: it is a computation. Add a half-space, clip the polytope, measure what is left.
//
// THE GEOMETRY. Three assets with a budget constraint (w1+w2+w3 = 1) and no shorting (wi >= 0) give the
// standard 2-simplex — a triangle. Every further constraint cuts it with a straight line. Drawn in barycentric
// coordinates the triangle is equilateral and undistorted, so the areas the animation shows are the real
// relative areas, not a projection artefact.
//
// WHAT IS HONEST AND WHAT IS SCALED. Three assets cannot carry a real mandate's 5% single-name cap (three
// names at 5% sum to 15%, which is infeasible against a budget of 100%). So the bounds here are loosened to
// fit a three-asset illustration, and the SLIDE SAYS SO. What carries over exactly is the shape of the
// argument: each rule removes a slab of the space, they compound, and the survivors are a small convex
// remainder. The count is what scales — 2,000 constraints in 3,000 dimensions, not five in two.
//
// Pure: no DOM. Deterministic. Unit-tested in tests/feasible.test.ts.

/** A point in the 2D drawing plane (barycentric projection of the simplex). */
export interface P2 {
  x: number;
  y: number;
}

/** A linear constraint on three weights: a1*w1 + a2*w2 + a3*w3 <= b. */
export interface Constraint {
  /** Short label for the animation. */
  label: string;
  /** Why it exists, in one clause — the part that makes it a rule rather than a line. */
  why: string;
  a: [number, number, number];
  b: number;
}

/** The three assets the illustration uses. Named, so the constraints read as real rules. */
export const ASSETS = ['NVDA', 'BAC', 'Gold'] as const;

const SQRT3_2 = Math.sqrt(3) / 2;

/** Simplex vertex positions in the drawing plane: an equilateral triangle, so areas are undistorted. */
export const SIMPLEX: P2[] = [
  { x: 0, y: 0 },          // w = (1,0,0) — all NVDA
  { x: 1, y: 0 },          // w = (0,1,0) — all BAC
  { x: 0.5, y: SQRT3_2 },  // w = (0,0,1) — all Gold
];

/** Weights -> drawing plane. */
export function toPlane(w: readonly [number, number, number]): P2 {
  return { x: w[1] + 0.5 * w[2], y: w[2] * SQRT3_2 };
}

/** Drawing plane -> weights. The inverse of toPlane, so a clipped vertex can be read back as a portfolio. */
export function toWeights(p: P2): [number, number, number] {
  const w3 = p.y / SQRT3_2;
  const w2 = p.x - 0.5 * w3;
  const w1 = 1 - w2 - w3;
  return [w1, w2, w3];
}

/**
 * A constraint as a half-plane in the drawing plane: n·p <= c.
 *
 * Substituting w1 = 1 - x - y/sqrt(3), w2 = x - y/sqrt(3), w3 = 2y/sqrt(3) into a·w <= b gives a linear
 * inequality in (x, y). Derived rather than fitted, so a new constraint needs no hand-tuned line.
 */
export function toHalfPlane(c: Constraint): { nx: number; ny: number; cc: number } {
  const [a1, a2, a3] = c.a;
  // w1 = 1 - x - y/sqrt(3);  w2 = x - y/sqrt(3);  w3 = 2y/sqrt(3)
  const invS3 = 1 / Math.sqrt(3);
  const nx = -a1 + a2;
  const ny = -a1 * invS3 - a2 * invS3 + a3 * 2 * invS3;
  const cc = c.b - a1;
  return { nx, ny, cc };
}

/** Signed slack of a point against a constraint: <= 0 means satisfied. */
export function slack(p: P2, c: Constraint): number {
  const h = toHalfPlane(c);
  return h.nx * p.x + h.ny * p.y - h.cc;
}

/**
 * Clip a convex polygon by a half-plane (Sutherland–Hodgman).
 *
 * Textbook, and chosen because it is exact for convex input and cannot produce a self-intersecting result —
 * which matters when the OUTPUT AREA is the number the slide quotes. A clipper that occasionally produced a
 * bow-tie would report a meaningless area and nobody would notice by looking.
 */
export function clip(poly: readonly P2[], c: Constraint): P2[] {
  if (poly.length === 0) return [];
  const out: P2[] = [];
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i];
    const next = poly[(i + 1) % poly.length];
    const sCur = slack(cur, c);
    const sNext = slack(next, c);
    const inCur = sCur <= 1e-12;
    const inNext = sNext <= 1e-12;

    if (inCur) out.push(cur);
    if (inCur !== inNext) {
      // The edge crosses the boundary: add the exact crossing point.
      const t = sCur / (sCur - sNext);
      out.push({ x: cur.x + (next.x - cur.x) * t, y: cur.y + (next.y - cur.y) * t });
    }
  }
  return dedupe(out);
}

/** Drop points that coincide, which clipping can produce at a vertex touch. */
function dedupe(poly: readonly P2[]): P2[] {
  const out: P2[] = [];
  for (const p of poly) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(last.x - p.x, last.y - p.y) > 1e-9) out.push(p);
  }
  if (out.length > 1) {
    const first = out[0];
    const last = out[out.length - 1];
    if (Math.hypot(first.x - last.x, first.y - last.y) < 1e-9) out.pop();
  }
  return out;
}

/** Shoelace area, always non-negative. */
export function area(poly: readonly P2[]): number {
  if (poly.length < 3) return 0;
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}

/** Centroid, for placing a label inside whatever is left. */
export function centroid(poly: readonly P2[]): P2 {
  if (!poly.length) return { x: 0.5, y: SQRT3_2 / 3 };
  let x = 0;
  let y = 0;
  for (const p of poly) {
    x += p.x;
    y += p.y;
  }
  return { x: x / poly.length, y: y / poly.length };
}

/**
 * THE CONSTRAINTS, in the order the animation applies them.
 *
 * Each is a genuine rule of the kind a real mandate carries, written as a linear inequality. The bounds are
 * loosened for three assets (see the file header) and the slide says so; the KIND of each rule, and the fact
 * that it removes a slab of the space, is exact.
 */
export const CONSTRAINTS: Constraint[] = [
  {
    label: 'No name above 45%',
    why: 'One position must not be able to end the fund.',
    a: [1, 0, 0],
    b: 0.45,
  },
  {
    label: 'Risk budget',
    why: 'A linear proxy for variance: the risky names cost more of the budget than the safe one.',
    a: [0.55, 0.30, 0.08],
    b: 0.30,
  },
  {
    // Tightened from 12% to 20%: at 12% this rule removed barely 1% of the space (46.7% -> 45.5%), which made
    // it look like decoration in the animation even though it is a real rule. A constraint worth drawing has
    // to visibly bite, and 20% is the more realistic floor anyway.
    label: 'Hold some insurance',
    why: 'A floor on the defensive asset, so a bad week cannot take everything.',
    a: [0, 0, -1],
    b: -0.20,
  },
  {
    label: 'Turnover band',
    why: 'You are already at 30% NVDA; moving further than 20% in one step costs more than it is worth.',
    a: [-1, 0, 0],
    b: -0.10,
  },
  {
    // Tightened from 50% to 35%: the point of the last step is that the survivors are a SLIVER, and at 50%
    // the sequence ended with a quarter of the space still legal — a weak punchline for "most of what you
    // want is forbidden".
    label: 'Financials cap',
    why: 'Sector limit, so one macro call cannot dominate the book.',
    a: [0, 1, 0],
    b: 0.35,
  },
];

/**
 * THE SLAB constraint `n` removes — what was legal before it and is not legal after.
 *
 * This is the piece the slide was missing. Its copy says "every rule is a straight line through the space of
 * legal portfolios; each one removes a slab", and the drawing showed only the survivor: the reader saw a shape
 * get smaller without ever seeing the cut that did it, so the sentence was doing work the picture should do.
 *
 * Computed as the complement, by clipping the previous polygon with the constraint FLIPPED. Negating `a` and
 * `b` turns `a·w <= b` into `a·w >= b`, and the intersection of the old region with that is exactly the part
 * the rule deletes. Done this way the slab cannot disagree with the survivor — they are clipped from the same
 * polygon by the same routine, so `area(slab) + area(survivor) === area(before)` holds by construction, and
 * the test asserts it.
 */
export function removedBy(n: number): P2[] {
  if (n < 1 || n > CONSTRAINTS.length) return [];
  const before = feasibleAfter(n - 1);
  const c = CONSTRAINTS[n - 1];
  const flipped: Constraint = {
    ...c,
    a: [-c.a[0], -c.a[1], -c.a[2]],
    b: -c.b,
  };
  return clip(before, flipped);
}

/** The polytope after applying the first `n` constraints to the simplex. */
export function feasibleAfter(n: number): P2[] {
  let poly: P2[] = [...SIMPLEX];
  for (let i = 0; i < Math.min(n, CONSTRAINTS.length); i++) {
    poly = clip(poly, CONSTRAINTS[i]);
  }
  return poly;
}

/** Area remaining after each step, as a fraction of the unconstrained simplex — the number the slide quotes. */
export function areaSeries(): number[] {
  const full = area(SIMPLEX);
  const out: number[] = [];
  for (let n = 0; n <= CONSTRAINTS.length; n++) {
    out.push(full > 0 ? area(feasibleAfter(n)) / full : 0);
  }
  return out;
}

/** Does a portfolio satisfy the first `n` constraints? Used by tests and by the label logic. */
export function satisfies(w: readonly [number, number, number], n: number): boolean {
  const p = toPlane(w);
  for (let i = 0; i < Math.min(n, CONSTRAINTS.length); i++) {
    if (slack(p, CONSTRAINTS[i]) > 1e-9) return false;
  }
  return true;
}

/** The line a constraint draws across the drawing plane, clipped to the simplex — for showing the cut itself
 *  rather than only its effect. Returns null when the line misses the triangle entirely. */
export function cutLine(c: Constraint): [P2, P2] | null {
  const h = toHalfPlane(c);
  const pts: P2[] = [];
  for (let i = 0; i < SIMPLEX.length; i++) {
    const a = SIMPLEX[i];
    const b = SIMPLEX[(i + 1) % SIMPLEX.length];
    const sa = h.nx * a.x + h.ny * a.y - h.cc;
    const sb = h.nx * b.x + h.ny * b.y - h.cc;
    if ((sa <= 0 && sb > 0) || (sa > 0 && sb <= 0)) {
      const t = sa / (sa - sb);
      pts.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return pts.length >= 2 ? [pts[0], pts[1]] : null;
}
