// src/lib/marchingSquares.ts
//
// ONE STITCHED MARCHING-SQUARES KERNEL WITH TWO CALLERS, AND ONE SEGMENT-ONLY PASS WITH A THIRD.
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
//
// `isoSegments` (bottom of the file) is for a caller that cannot memoise: /projects' drafting field drifts, so its
// isolines are new on every frame — ~15 a second, 24 levels each. `isoRuns` would sample `fn` four times per
// cell per level and then stitch in O(n²); the drafting field samples ONE grid per frame, runs every level over
// it in a single pass, and strokes the bare segments into a Path2D, where hairlines read as continuous with no
// stitch at all.

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

// Edge pairs per case, edges numbered top 0, right 1, bottom 2, left 3 — the approved mockup's table, flattened
// so cases 5 and 10 (the saddles) carry two pairs. 0 and 15 have no crossing.
const SEGS: readonly (readonly number[])[] = [
  [], [3, 0], [0, 1], [3, 1], [1, 2], [3, 0, 1, 2], [0, 2], [3, 2],
  [2, 3], [0, 2], [0, 1, 2, 3], [1, 2], [1, 3], [0, 1], [0, 3], [],
];

/**
 * Isoline segments of a pre-sampled grid at every one of `levels`, in px, handed to `emit` one at a time with the
 * index of their level — no stitching.
 *
 * `grid` is (cols+1) x (rows+1) samples, row-major with stride cols+1 (what `sampleGrid` in draftingField.ts
 * returns); sample (i, j) sits at px (i * cell, j * cell). Corners of a cell are a b / d c, top row first.
 *
 * ONE PASS FOR ALL LEVELS, so `levels` must ASCEND (FIELD_LEVELS does; its spec pins the values). A level crosses
 * a cell iff min(corners) <= level < max(corners) — below the min every corner is above it (case 15), at or above
 * the max none is (case 0) — so each cell reads its four samples once and only the levels inside its range do
 * any work. A pass per level read every cell 24 times: measured on the drafting grid at 1985x1100 (Node 24,
 * median of 200 frames), 1.20 ms a frame per level against 0.28 ms in one pass, the same 5,050 segments; in
 * headless Chrome at 2000x1100 DPR 2 the page's quiet drift went from 3.98% of a core to 2.80%.
 */
export function isoSegments(
  grid: Float32Array, cols: number, rows: number, levels: readonly number[], cell: number,
  emit: (levelIndex: number, x0: number, y0: number, x1: number, y1: number) => void,
): void {
  const stride = cols + 1;
  const ex = [0, 0, 0, 0], ey = [0, 0, 0, 0];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const o = j * stride + i, a = grid[o], b = grid[o + 1], c = grid[o + stride + 1], d = grid[o + stride];
      const lo = Math.min(a, b, c, d), hi = Math.max(a, b, c, d);
      const x = i * cell, y = j * cell;
      for (let li = 0; li < levels.length; li++) {
        const level = levels[li];
        if (level >= hi) break;
        if (level < lo) continue;
        const idx = (a > level ? 1 : 0) | (b > level ? 2 : 0) | (c > level ? 4 : 0) | (d > level ? 8 : 0);
        if (idx === 0 || idx === 15) continue;   // only a NaN sample gets here (its min/max are NaN)
        // an edge the level does not cross may divide by zero here; the case table never reads it
        ex[0] = x + cell * (level - a) / (b - a); ey[0] = y;
        ex[1] = x + cell;                         ey[1] = y + cell * (level - b) / (c - b);
        ex[2] = x + cell * (level - d) / (c - d); ey[2] = y + cell;
        ex[3] = x;                                ey[3] = y + cell * (level - a) / (d - a);
        const s = SEGS[idx];
        for (let k = 0; k < s.length; k += 2) emit(li, ex[s[k]], ey[s[k]], ex[s[k + 1]], ey[s[k + 1]]);
      }
    }
  }
}
