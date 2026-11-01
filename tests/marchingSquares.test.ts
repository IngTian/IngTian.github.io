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
import { isoRuns, type IsoBounds } from '../src/lib/marchingSquares';

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

  it('finds both branches of a level set that is two separate loops', () => {
    // Marching squares must not assume one contour per level. Two bumps, two loops.
    const twoWells = (x: number, y: number): number =>
      Math.min((x - 1) ** 2 + y * y, (x + 1) ** 2 + y * y);
    const runs = isoRuns(twoWells, BOX, 0.25, 80);
    expect(runs).toHaveLength(2);
  });
});
