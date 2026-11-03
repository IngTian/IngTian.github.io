// tests/marchingSquares.test.ts
// THE MARCHING-SQUARES KERNEL, extracted so there is one implementation instead of two.
//
// `descentPath.contours()` and the homepage intro's terrain isolines differ in exactly one thing: their
// bounds. They already call the SAME `field()` from lib/terrain.ts. Duplicating ~70 lines of marching
// squares for that would have been the wrong trade, so the kernel moved here and both became callers.
//
// Tested against a CLOSED-FORM field — `x² + y²`, whose level sets are circles of radius √level — because
// the point of these assertions is that the algorithm is right, and a Gaussian mixture has no answer to
// check against. `descentPath`'s own specs are what prove the extraction preserved its behaviour; this file
// proves the kernel itself.
import { describe, expect, it } from 'vitest';
import { isoRuns, isoSegments, type IsoBounds } from '../src/lib/marchingSquares';

/** Level sets are circles: fn(x, y) = r² ⇒ the contour at level L is the circle of radius √L. */
const circles = (x: number, y: number): number => x * x + y * y;
const BOX: IsoBounds = { x0: -2, y0: -2, x1: 2, y1: 2 };

describe('isoRuns', () => {
  it('returns runs whose every point lies on the requested level set', () => {
    // The whole correctness claim in one assertion. The interpolation is linear across a cell edge while
    // the true contour is curved, so the tolerance scales with cell size rather than being absolute.
    const res = 60;
    const cell = (BOX.x1 - BOX.x0) / res;
    const runs = isoRuns(circles, BOX, 1, res);
    expect(runs.length).toBeGreaterThan(0);
    for (const run of runs) {
      for (const [x, y] of run) {
        expect(circles(x, y)).toBeCloseTo(1, 1);
        // and on the circle of radius 1, to within the linear-interpolation error of one cell
        expect(Math.abs(Math.hypot(x, y) - 1)).toBeLessThan(cell);
      }
    }
  });

  it('returns continuous polylines, not disconnected stubs', () => {
    // THE ORIGINAL BUG IN THIS CODE: segments were emitted per cell and never stitched, so the contours
    // rendered as invisible 1px fragments. Every run must be a real polyline whose consecutive points are
    // adjacent, which is what a stroke can follow.
    const res = 60;
    const cell = (BOX.x1 - BOX.x0) / res;
    const runs = isoRuns(circles, BOX, 1, res);
    expect(runs.length).toBeGreaterThan(0);
    for (const run of runs) {
      expect(run.length).toBeGreaterThan(3);
      for (let k = 1; k < run.length; k++) {
        const d = Math.hypot(run[k][0] - run[k - 1][0], run[k][1] - run[k - 1][1]);
        expect(d, `run jumps ${d.toFixed(4)} between consecutive points`).toBeLessThan(cell * 2);
      }
    }
  });

  it('closes a closed contour into a single run', () => {
    // A circle fully inside the box is one loop. Two or more runs would mean the stitch gave up partway,
    // which is the failure mode that produced 32 fragments when a "faster" hashed stitch was tried.
    const runs = isoRuns(circles, BOX, 1, 60);
    expect(runs).toHaveLength(1);
  });

  it('stays inside the bounds it sampled', () => {
    for (const run of isoRuns(circles, BOX, 2, 48)) {
      for (const [x, y] of run) {
        expect(x).toBeGreaterThanOrEqual(BOX.x0 - 1e-9);
        expect(x).toBeLessThanOrEqual(BOX.x1 + 1e-9);
        expect(y).toBeGreaterThanOrEqual(BOX.y0 - 1e-9);
        expect(y).toBeLessThanOrEqual(BOX.y1 + 1e-9);
      }
    }
  });

  it('honours the bounds it is given, not a global constant', () => {
    // The reason this function takes bounds at all: the two callers differ ONLY in this argument.
    const small: IsoBounds = { x0: -0.5, y0: -0.5, x1: 0.5, y1: 0.5 };
    // the radius-1 circle is entirely outside the small box, so there is nothing to find there
    expect(isoRuns(circles, small, 1, 40)).toEqual([]);
    expect(isoRuns(circles, BOX, 1, 40).length).toBeGreaterThan(0);
  });

  it('returns [] for a level outside the field\'s range', () => {
    // x²+y² over this box spans 0..8, so 20 is above everything and -1 below everything.
    expect(isoRuns(circles, BOX, 20, 40)).toEqual([]);
    expect(isoRuns(circles, BOX, -1, 40)).toEqual([]);
  });

  it('is deterministic — which is what makes memoising it sound', () => {
    // lib/terrainContours.ts and descentPath's contoursFor() both cache these results. If this function
    // ever acquires a hidden input, those caches become wrong rather than merely stale.
    expect(isoRuns(circles, BOX, 1.5, 40)).toEqual(isoRuns(circles, BOX, 1.5, 40));
  });

  it('resolves finer at a higher res', () => {
    const coarse = isoRuns(circles, BOX, 1, 20).reduce((n, r) => n + r.length, 0);
    const fine = isoRuns(circles, BOX, 1, 80).reduce((n, r) => n + r.length, 0);
    expect(fine).toBeGreaterThan(coarse);
  });

  it('stitches correctly on ANISOTROPIC bounds, where dx and dy differ', () => {
    // `bounds` is a parameter, so this kernel is general — but the stitch tolerance was derived from the
    // x spacing alone. For `storyBounds()` (dx 0.0308, dy 0.0242) that already makes TOL 0.0369, SMALLER
    // than the cell diagonal 0.0392; bounds with dy much larger than dx would make it loose instead. It
    // happens not to bite at either shipped parameter set because true neighbours are coincident, but a
    // shared helper should not carry an axis asymmetry waiting for a third caller.
    const wide: IsoBounds = { x0: -4, y0: -0.5, x1: 4, y1: 0.5 };
    const tall: IsoBounds = { x0: -0.5, y0: -4, x1: 0.5, y1: 4 };
    for (const b of [wide, tall]) {
      const runs = isoRuns(circles, b, 0.16, 48);
      expect(runs.length, `no runs on ${JSON.stringify(b)}`).toBeGreaterThan(0);
      const dx = (b.x1 - b.x0) / 48, dy = (b.y1 - b.y0) / 48;
      const diag = Math.hypot(dx, dy);
      for (const run of runs) {
        for (let k = 1; k < run.length; k++) {
          const d = Math.hypot(run[k][0] - run[k - 1][0], run[k][1] - run[k - 1][1]);
          expect(d, `run jumps ${d.toFixed(4)} against a cell diagonal of ${diag.toFixed(4)}`)
            .toBeLessThan(diag * 2.2);
        }
      }
    }
  });

  it('finds both branches of a level set that is two separate loops', () => {
    // Marching squares must not assume one contour per level. Two bumps, two loops.
    const twoWells = (x: number, y: number): number =>
      Math.min((x - 1) ** 2 + y * y, (x + 1) ** 2 + y * y);
    const runs = isoRuns(twoWells, BOX, 0.25, 80);
    expect(runs).toHaveLength(2);
  });
});

describe('isoSegments', () => {
  // A radial bowl on a (cols+1) x (rows+1) row-major grid, the layout sampleGrid() emits. Value r²/R² in grid
  // units, so the 0.5 level set is the circle of radius R/√2 about the centre — in px, times the cell size.
  const N = 40, CELL = 10, R = 20;
  const bowl = new Float32Array((N + 1) * (N + 1));
  for (let j = 0; j <= N; j++) {
    for (let i = 0; i <= N; i++) bowl[j * (N + 1) + i] = ((i - N / 2) ** 2 + (j - N / 2) ** 2) / R ** 2;
  }

  it('emits segments whose every endpoint lies within one cell of the true circle', () => {
    const pts: [number, number][] = [];
    isoSegments(bowl, N, N, [0.5], CELL, (_li, x0, y0, x1, y1) => pts.push([x0, y0], [x1, y1]));
    expect(pts.length).toBeGreaterThan(0);
    const centre = (N / 2) * CELL, radius = (R / Math.SQRT2) * CELL;
    for (const [x, y] of pts) expect(Math.abs(Math.hypot(x - centre, y - centre) - radius)).toBeLessThan(CELL);
  });

  it('closes up with no stitch: every endpoint is shared by exactly two segments', () => {
    // What lets the drafting field stroke bare segments and still draw an unbroken line. Neighbouring cells
    // interpolate a shared edge from the same two samples, so their endpoints coincide exactly — unless a case
    // in the table names the wrong edge, which the one-cell test above is too loose to see. Level 0.51, not 0.5:
    // r² = 204 is not a sum of two squares, so no sample sits exactly ON the level (at 0.5, (18, 6) does, and a
    // crossing at a corner is legitimately shared by every cell that touches it).
    const seen = new Map<string, number>();
    const hit = (x: number, y: number) => seen.set(`${x},${y}`, (seen.get(`${x},${y}`) ?? 0) + 1);
    isoSegments(bowl, N, N, [0.51], CELL, (_li, x0, y0, x1, y1) => { hit(x0, y0); hit(x1, y1); });
    expect(seen.size).toBeGreaterThan(0);
    for (const [p, n] of seen) expect(n, `endpoint ${p}`).toBe(2);
  });

  it('runs every level in one pass, emitting exactly what each level does alone, tagged with its index', () => {
    // Levels 0.05 apart against cell ranges of up to ~0.19 near the rim, so many cells cross several levels; -1
    // sits below every sample and 3 above, so the pass must skip past the first and stop before the last.
    const levels = [-1, 0.5, 0.55, 0.6, 3];
    const together: number[][][] = levels.map(() => []);
    isoSegments(bowl, N, N, levels, CELL, (li, ...s) => together[li].push(s));
    expect(together.map((t) => t.length > 0)).toEqual([false, true, true, true, false]);
    levels.forEach((lv, k) => {
      const alone: number[][] = [];
      isoSegments(bowl, N, N, [lv], CELL, (_li, ...s) => alone.push(s));
      expect(together[k]).toEqual(alone);
    });
  });

  it('emits nothing for a constant grid', () => {
    let n = 0;
    isoSegments(new Float32Array((N + 1) * (N + 1)).fill(0.5), N, N, [0.5], CELL, () => n++);
    expect(n).toBe(0);
  });

  // The bowl reaches cases 0-4, 6-9 and 11-15; the two saddles are the cases it never reaches, so each gets its own
  // cell. Grid order is a, b / d, c. Each pair must cut off the two above-level corners, never cross the cell.
  it('splits saddle case 5 (a and c above) into the two segments that cut off a and c', () => {
    const segs: number[][] = [];
    isoSegments(new Float32Array([1, 0, 0, 1]), 1, 1, [0.5], CELL, (_li, ...s) => segs.push(s));
    expect(segs).toEqual([[0, 5, 5, 0], [10, 5, 5, 10]]);
  });

  it('splits saddle case 10 (b and d above) into the two segments that cut off b and d', () => {
    const segs: number[][] = [];
    isoSegments(new Float32Array([0, 1, 1, 0]), 1, 1, [0.5], CELL, (_li, ...s) => segs.push(s));
    expect(segs).toEqual([[5, 0, 10, 5], [5, 10, 0, 5]]);
  });
});
