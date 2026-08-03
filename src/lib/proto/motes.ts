// Pure math for the Mountains mote field (PROTOTYPE).
//
// The motes are NOT random drift. They are advected along a CURL-NOISE field:
// taking the curl of a scalar potential gives a divergence-free vector field, so
// the flow reads as genuine streamlines and particles never bunch into blobs the
// way plain-noise advection does. That matters here for a non-decorative reason —
// this site's hero is an optimization landscape, so any particle motion on the
// page should follow real math rather than fake it.
//
// A downward bias is added at the advection site (not here) so the flow still
// DESCENDS: the page's whole metaphor.
//
// Kept side-effect free and dependency-free so it can be unit-tested like
// lib/terrain.ts and lib/justify.ts.

/** Deterministic 2D hash → [0,1). Same construction as the terrain/shader noise. */
export function hash2(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

/** Value noise with smoothstep interpolation. Continuous, so its curl is smooth. */
export function valueNoise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);

  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);

  return (a * (1 - ux) + b * ux) * (1 - uy) + (c * (1 - ux) + d * ux) * uy;
}

/** Fractal sum of value noise — 3 octaves is plenty for a flow potential. */
export function fbm(x: number, y: number, octaves = 3): number {
  let v = 0;
  let amp = 0.5;
  let px = x;
  let py = y;
  for (let i = 0; i < octaves; i++) {
    v += amp * valueNoise(px, py);
    px *= 2.03;
    py *= 2.03;
    amp *= 0.5;
  }
  return v;
}

/**
 * Curl of the fBm scalar potential: (∂ψ/∂y, −∂ψ/∂x).
 *
 * The result is divergence-free by construction (∇·curl ψ = 0 up to the
 * finite-difference error), which is exactly why the streamlines stay clean.
 * Central differences keep the error second-order.
 */
export function curl(x: number, y: number, eps = 0.08): [number, number] {
  const dPsiDy = (fbm(x, y + eps) - fbm(x, y - eps)) / (2 * eps);
  const dPsiDx = (fbm(x + eps, y) - fbm(x - eps, y)) / (2 * eps);
  return [dPsiDy, -dPsiDx];
}

/**
 * Depth gate — how present a mote may be at normalized page depth `d` (0 = the
 * luminous dawn heights, 1 = the near-black ground).
 *
 * This is the whole reason motes can belong on this site at all. On the pale
 * dawn paper a visible particle reads as dust or a dead pixel; over the dark
 * lower sky the same particle reads as a star. So presence is ~0 up top and
 * only becomes real below the fold. `start` is where they begin to exist.
 */
export function depthGate(d: number, start = 0.34): number {
  if (d <= start) return 0;
  const t = (d - start) / (1 - start);
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return c * c; // ease-in: stays quiet well past the threshold
}
