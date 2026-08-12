// src/lib/sensitivity.ts
// LEARNING YOUR OWN GEOMETRY — the second half of the owner's framing, made measurable.
//
// His words: "as we explore the field we are also measuring and have a better understanding of our
// own geometry (our sensitivity and preferences). We finally figure out our preferences. So
// engineering is a small hill where we are good at, but our true potential lies in mathematics and
// structured thinking and research. That's what leads us to quant. Also, we prefer more direct
// feedback loops."
//
// This is not a metaphor that needs illustrating — it is a statement about CURVATURE, and curvature
// is computable. At any point on a surface the Hessian's eigenvectors give the principal
// directions and its eigenvalues give how sharply the surface bends along each. So:
//
//   · "engineering is a small hill where we are good at" = a shallow basin. Comfortable, and its
//     own curvature says how little room is left: a stiff, tightly-curved bowl has nowhere to go.
//   · "our true potential lies in mathematics" = the direction of steepest available descent that
//     a local method CANNOT follow from inside the basin. It is invisible until probed.
//   · "we prefer more direct feedback loops" = gradient MAGNITUDE. A steep region gives strong
//     signal per step; a flat one gives almost none. That is the honest reading of "direct
//     feedback", and it is a number, not a mood.
//
// Everything here is derived from terrain.ts's field by finite differences. No fitted preferences,
// no invented parameters. The claim the page makes is only ever "here is the local geometry", and
// the interpretation stays in the prose where the reader can disagree with it.

import { field, grad } from './terrain';

/** Second derivatives at a point, by central difference. */
export function hessian(x: number, y: number, h = 1e-3): [number, number, number] {
  const f0 = field(x, y);
  const fxx = (field(x + h, y) - 2 * f0 + field(x - h, y)) / (h * h);
  const fyy = (field(x, y + h) - 2 * f0 + field(x, y - h)) / (h * h);
  const fxy =
    (field(x + h, y + h) - field(x + h, y - h) - field(x - h, y + h) + field(x - h, y - h)) /
    (4 * h * h);
  return [fxx, fyy, fxy];
}

export interface Curvature {
  /** Eigenvalues of the Hessian, k1 <= k2. Positive = bowl, negative = ridge. */
  k1: number;
  k2: number;
  /** Unit eigenvector for k1 — the SOFTEST direction, where the surface bends least. */
  soft: [number, number];
  /** Unit eigenvector for k2 — the stiffest direction. */
  stiff: [number, number];
  /** k2 / k1 when both are positive: how elongated the bowl is. 1 = round. */
  anisotropy: number;
  /** |gradient| — how much signal a step gives you here. The "feedback loop" number. */
  signal: number;
}

/**
 * Principal curvatures and directions at a point.
 *
 * Closed form for a symmetric 2x2, so there is no iterative solver to misconverge:
 *   k = (fxx + fyy)/2 +- sqrt( ((fxx - fyy)/2)^2 + fxy^2 )
 */
export function curvature(x: number, y: number): Curvature {
  const [fxx, fyy, fxy] = hessian(x, y);
  const mean = (fxx + fyy) / 2;
  const diff = (fxx - fyy) / 2;
  const root = Math.sqrt(diff * diff + fxy * fxy);
  const k2 = mean + root;
  const k1 = mean - root;

  // Eigenvector for k1. When fxy is ~0 the matrix is already diagonal and the axes are the
  // eigenvectors — handling that separately avoids a 0/0.
  let soft: [number, number];
  if (Math.abs(fxy) > 1e-9) {
    const vx = fxy;
    const vy = k1 - fxx;
    const n = Math.hypot(vx, vy) || 1;
    soft = [vx / n, vy / n];
  } else {
    soft = fxx <= fyy ? [1, 0] : [0, 1];
  }
  const stiff: [number, number] = [-soft[1], soft[0]];
  const [gx, gy] = grad(x, y);

  return {
    k1, k2, soft, stiff,
    anisotropy: k1 > 1e-6 ? k2 / k1 : Infinity,
    signal: Math.hypot(gx, gy),
  };
}

/**
 * The escape direction: which way out of a basin leads somewhere deeper.
 *
 * A local method cannot find this — that is the whole point, and it is why the career story needed
 * a deliberate climb rather than an algorithm. Computed by probing a ring of directions, walking a
 * short way UP each one to clear the rim, then letting a plain descent run from there and keeping
 * whichever probe settles lowest. Honest about being a global search: it is what a person does when
 * they go and try something, not what gradient descent does.
 */
export function escapeDirection(
  x: number, y: number,
  opts: { probes?: number; climbs?: number[]; steps?: number; lr?: number } = {},
): {
  dir: [number, number]; angleDeg: number; climb: number;
  reachedDepth: number; startDepth: number; improvement: number; improved: boolean;
} {
  // The probe must CLEAR THE RIM, and one fixed climb distance does not. At climb = 1.35 every
  // probe fell straight back into the same basin and the function reported improvement 0.0000 —
  // i.e. it would have claimed the escape does not exist. The barrier peak sits ~2.0 away along the
  // line to the deep basin, so sweep the distance rather than guessing a single value.
  const { probes = 72, climbs = [1.35, 1.8, 2.2, 2.6, 3.0], steps = 1200, lr = 0.02 } = opts;
  const startDepth = field(x, y);
  let best = { dir: [0, 0] as [number, number], depth: startDepth, angleDeg: 0, climb: 0 };

  for (const climb of climbs) {
    for (let i = 0; i < probes; i++) {
      const a = (i / probes) * Math.PI * 2;
      const dx = Math.cos(a), dy = Math.sin(a);
      let px = x + dx * climb;
      let py = y + dy * climb;
      for (let s = 0; s < steps; s++) {
        const [gx, gy] = grad(px, py);
        px -= lr * gx;
        py -= lr * gy;
      }
      const d = field(px, py);
      if (d < best.depth - 1e-9) {
        best = { dir: [dx, dy], depth: d, angleDeg: (a * 180) / Math.PI, climb };
      }
    }
  }
  return {
    dir: best.dir,
    angleDeg: best.angleDeg,
    climb: best.climb,
    reachedDepth: best.depth,
    startDepth,
    improvement: startDepth - best.depth,
    improved: best.depth < startDepth - 1e-9,
  };
}

/** A reading of the local geometry at one waypoint, for the page to show alongside its prose. */
export interface GeometryReading {
  label: string;
  x: number;
  y: number;
  /** Height here. */
  depth: number;
  curvature: Curvature;
  /** True when this point sits in a basin (both curvatures positive). */
  inBasin: boolean;
}

export function readGeometry(label: string, x: number, y: number): GeometryReading {
  const c = curvature(x, y);
  return {
    label, x, y,
    depth: field(x, y),
    curvature: c,
    inBasin: c.k1 > 0 && c.k2 > 0,
  };
}
