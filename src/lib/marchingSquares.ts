// src/lib/marchingSquares.ts
//
// ONE MARCHING-SQUARES IMPLEMENTATION, TWO CALLERS.
//
// `descentPath.contours()` drew isolines of the career field within `storyBounds()`; the homepage intro
// needs isolines of the terrain field within `RANGE`. Those two differ in exactly ONE thing — their bounds.
// They already call the same `field()` from lib/terrain.ts. So rather than duplicate ~70 lines of
// marching squares for a difference of four numbers, the kernel lives here and both are callers.
//
// Net effect is LESS total code, and `descentPath`'s existing specs are what prove the extraction
// preserved its behaviour — that test run is the real guard on this refactor, not this file's own spec.
//
// Pure, with no module state. The callers memoise (see `contoursFor` in descentPath.ts and
// `terrainContoursFor` in terrainContours.ts); caching here would mean one cache keyed by a function
// reference, which is the kind of key that silently stops matching.

/** A sampling rectangle in world space. Matches the shape `storyBounds()` returns. */
export interface IsoBounds { x0: number; y0: number; x1: number; y1: number }

/**
 * Contour polylines of `fn` at `level`, as world-space point runs.
 *
 * Marching squares proper — segments are collected per cell and then STITCHED into continuous runs. The
 * stitch is what makes the result strokeable: an earlier version of this code emitted the per-cell
 * segments directly and its contours rendered as invisible 1px stubs.
 *
 * `res` is the cell count per axis, so cost is O(res²) in field evaluations. Runs shorter than four points
 * are dropped as noise.
 *
 * **THE STITCH IS DELIBERATELY NAIVE — O(n²) — AND MUST STAY THAT WAY.** A hashed endpoint-bucketing
 * stitch was written and measured against it at the intro's parameters (9 levels, res 74): it came out
 * **slower** (10.9ms vs 10.0ms median) *and wrong*, fragmenting 13 polylines into 32, because at this
 * segment count the hash buckets cost more than the scan they replace and the float-keyed buckets miss
 * endpoints the distance test catches. Do not redo that experiment.
 */
export function isoRuns(
  fn: (x: number, y: number) => number,
  bounds: IsoBounds,
  level: number,
  res: number,
): [number, number][][] {
  const runs: [number, number][][] = [];
  const dx = (bounds.x1 - bounds.x0) / res;
  const dy = (bounds.y1 - bounds.y0) / res;

  // Collect line segments per cell, then stitch them into runs by matching endpoints.
  const segs: [[number, number], [number, number]][] = [];
  const interp = (
    xa: number, ya: number, va: number, xb: number, yb: number, vb: number,
  ): [number, number] => {
    const t = (level - va) / (vb - va);
    return [xa + (xb - xa) * t, ya + (yb - ya) * t];
  };

  for (let i = 0; i < res; i++) {
    for (let j = 0; j < res; j++) {
      const x0 = bounds.x0 + i * dx, y0 = bounds.y0 + j * dy;
      const x1 = x0 + dx, y1 = y0 + dy;
      const v00 = fn(x0, y0), v10 = fn(x1, y0), v11 = fn(x1, y1), v01 = fn(x0, y1);
      // Which corners are above the level: standard marching-squares case index.
      const code = (v00 > level ? 1 : 0) | (v10 > level ? 2 : 0) | (v11 > level ? 4 : 0) | (v01 > level ? 8 : 0);
      if (code === 0 || code === 15) continue;
      const bottom = () => interp(x0, y0, v00, x1, y0, v10);
      const right = () => interp(x1, y0, v10, x1, y1, v11);
      const top = () => interp(x1, y1, v11, x0, y1, v01);
      const left = () => interp(x0, y1, v01, x0, y0, v00);
      const push = (a: [number, number], c: [number, number]) => segs.push([a, c]);
      switch (code) {
        case 1: case 14: push(left(), bottom()); break;
        case 2: case 13: push(bottom(), right()); break;
        case 3: case 12: push(left(), right()); break;
        case 4: case 11: push(right(), top()); break;
        case 5: push(left(), top()); push(bottom(), right()); break;
        case 6: case 9: push(bottom(), top()); break;
        case 7: case 8: push(left(), top()); break;
        case 10: push(left(), bottom()); push(right(), top()); break;
      }
    }
  }

  // ── Stitch: extend a run by its NEAREST unused neighbour, from either end ──────────────────────
  //
  // TAKING THE *NEAREST* CANDIDATE RATHER THAN THE FIRST ONE WITHIN THE THRESHOLD IS A BUG FIX, and it
  // is worth knowing why, because the broken version looked completely reasonable.
  //
  // Adjacent cells compute the crossing on their shared edge from the same two corner values, so true
  // neighbours are coincident to floating-point noise — a measured nearest-neighbour gap of 0.000000
  // across every endpoint of a test circle. The tolerance, meanwhile, is `dx * 1.2`. So at a given tip
  // there can be many segments "near" it, and the old code attached the FIRST one the scan happened to
  // reach, which at a 0.0667 cell size could be a segment further along the curve. The genuine neighbour
  // was then orphaned, and since runs shorter than four points are discarded as noise, those orphans
  // were DROPPED — not merely mis-ordered.
  //
  // Measured on a plain circle at res 60: the old stitch returned runs of [50, 7, 63, 3, 2, 2, 2, 3],
  // i.e. three kept pieces of one closed loop and four fragments thrown away — visible gaps in a line
  // that should be continuous. Nearest-first returns a single run of 124 points, as it should.
  //
  // The tolerance stays at `dx * 1.2` so a field with genuinely gappy crossings still stitches; what
  // changed is only WHICH candidate inside it wins. And the naive O(n²) scan stays — see the note on
  // this function: the hashed alternative measured slower and fragmented worse.
  const used = new Array(segs.length).fill(false);
  const TOL = dx * 1.2;
  const d2 = (a: [number, number], c: [number, number]) => (a[0] - c[0]) ** 2 + (a[1] - c[1]) ** 2;

  for (let s = 0; s < segs.length; s++) {
    if (used[s]) continue;
    used[s] = true;
    const run: [number, number][] = [segs[s][0], segs[s][1]];

    for (;;) {
      let bestK = -1, bestD = TOL * TOL, atHead = false, flip = false;
      const head = run[0], tail = run[run.length - 1];
      for (let k = 0; k < segs.length; k++) {
        if (used[k]) continue;
        const [a, c] = segs[k];
        // four ways to attach segment k: either of its ends to either end of the run
        const dta = d2(tail, a); if (dta < bestD) { bestD = dta; bestK = k; atHead = false; flip = false; }
        const dtc = d2(tail, c); if (dtc < bestD) { bestD = dtc; bestK = k; atHead = false; flip = true; }
        const dhc = d2(head, c); if (dhc < bestD) { bestD = dhc; bestK = k; atHead = true; flip = false; }
        const dha = d2(head, a); if (dha < bestD) { bestD = dha; bestK = k; atHead = true; flip = true; }
      }
      if (bestK < 0) break;
      const [a, c] = segs[bestK];
      used[bestK] = true;
      if (atHead) run.unshift(flip ? c : a);
      else run.push(flip ? a : c);
    }

    if (run.length > 3) runs.push(run);
  }
  return runs;
}
