// tests/terrainContours.test.ts
// THE TERRAIN'S ISOLINES, which the homepage intro strokes onto a flat plane before the surface rises.
//
// Same `field()` the hero's dots are painted from, so the lines and the dots describe one surface — that
// is the whole point of the intro's design, and it is why these contours are computed from the terrain
// field rather than being drawn.
//
// The memo assertions matter as much as the geometry ones: the intro computes these once at ~10ms and
// then strokes them every frame for 5.2 seconds. Without the memo that is 10ms per frame.
import { describe, expect, it } from 'vitest';
import {
  INTRO_CONTOUR_LEVELS, INTRO_CONTOUR_RES, terrainLevels, introContours,
} from '../src/lib/terrainContours';
import { field, RANGE } from '../src/lib/terrain';
import { isoRuns } from '../src/lib/marchingSquares';

describe('terrainLevels', () => {
  it('returns one ascending level per shipped level count', () => {
    const lv = terrainLevels();
    expect(lv).toHaveLength(INTRO_CONTOUR_LEVELS);
    for (let i = 1; i < lv.length; i++) expect(lv[i]).toBeGreaterThan(lv[i - 1]);
  });

  it('keeps every level inside the field\'s own range, so none is wasted off-frame', () => {
    // A level above the field's max or below its min produces no isoline at all — a silently blank pass.
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i <= 60; i++) {
      for (let j = 0; j <= 60; j++) {
        const z = field(-RANGE + (2 * RANGE * i) / 60, -RANGE + (2 * RANGE * j) / 60);
        if (z < lo) lo = z;
        if (z > hi) hi = z;
      }
    }
    for (const l of terrainLevels()) {
      expect(l).toBeGreaterThan(lo);
      expect(l).toBeLessThan(hi);
    }
  });

  it('spaces levels evenly', () => {
    // Placed at (k + 0.5) / n through the measured range, the same scheme descentPath.contourLevels uses.
    const lv = terrainLevels();
    const gap = lv[1] - lv[0];
    for (let i = 2; i < lv.length; i++) expect(lv[i] - lv[i - 1]).toBeCloseTo(gap, 9);
  });

  it('returns the IDENTICAL array each call — it is shared and read-only by contract', () => {
    expect(terrainLevels()).toBe(terrainLevels());
  });
});

describe('introContours', () => {
  it('returns one entry per level, each a non-empty run list', () => {
    const all = introContours();
    expect(all).toHaveLength(INTRO_CONTOUR_LEVELS);
    for (const runs of all) expect(runs.length).toBeGreaterThan(0);
  });

  it('is memoised — the IDENTICAL arrays, not equal ones', () => {
    // toBe, not toEqual. Deleting the memo fails here, and the intro goes from one 10ms computation to
    // one per frame for 5.2 seconds.
    const a = introContours();
    const b = introContours();
    expect(a).toBe(b);
    for (let i = 0; i < a.length; i++) expect(a[i]).toBe(b[i]);
  });

  it('produces continuous polylines inside RANGE', () => {
    for (const runs of introContours()) {
      for (const run of runs) {
        expect(run.length).toBeGreaterThan(3);
        for (const [x, y] of run) {
          expect(Math.abs(x)).toBeLessThanOrEqual(RANGE + 1e-9);
          expect(Math.abs(y)).toBeLessThanOrEqual(RANGE + 1e-9);
        }
      }
    }
  });

  it('puts every point on its own level, to within a cell', () => {
    const cell = (2 * RANGE) / INTRO_CONTOUR_RES;
    const lv = terrainLevels();
    introContours().forEach((runs, i) => {
      for (const run of runs) {
        for (const [x, y] of run) {
          // the field's gradient magnitude is O(1) here, so a cell of error in position is a cell of
          // error in value
          expect(Math.abs(field(x, y) - lv[i])).toBeLessThan(cell * 2);
        }
      }
    });
  });

  it('costs under 40ms to build at the shipped parameters', () => {
    // MEASURED THROUGH THE UNCACHED KERNEL, which is the only way to time this honestly — and getting
    // that wrong twice is why the reasoning is written down.
    //
    // The first version called `terrainContoursFor(l + 1e-7, res)` with the comment "offset the levels so
    // nothing above has warmed the memo for these exact keys". The key was `level.toFixed(4)`, and 1e-7
    // does not survive four decimals: 9 of 9 offset keys hashed identically to the warm ones, so it timed
    // nine Map hits and passed at ~0ms. The ceiling guarding the intro's first frame guarded nothing.
    //
    // The obvious fix — `vi.resetModules()` plus a dynamic import, for genuinely empty caches — measured
    // **44.9ms** and went red. That number is real but it is not production's: re-importing re-evaluates
    // `terrain.ts` too, so `field` is a brand-new function with no JIT feedback. On a real first open the
    // hero has already painted its static frame, which runs `field` tens of thousands of times, so the
    // contour build happens on an optimised `field`. The browser figure is 10.6ms, measured on the
    // intro's actual first frame. Cold CACHE, warm JIT — model both, or the budget describes nothing
    // that ships.
    //
    // So: call the kernel `introContours` calls, at the shipped parameters, after the tests above have
    // warmed the field. No cache to defeat and nothing to go vacuous. Loose enough not to flake on a
    // loaded CI box, tight enough to fail if someone raises the resolution toward descentPath's 150,
    // which measured 47.1ms.
    const bounds = { x0: -RANGE, y0: -RANGE, x1: RANGE, y1: RANGE };
    const t0 = performance.now();
    let points = 0;
    for (const l of terrainLevels()) {
      for (const run of isoRuns(field, bounds, l, INTRO_CONTOUR_RES)) points += run.length;
    }
    const ms = performance.now() - t0;
    expect(ms, `contour build took ${ms.toFixed(1)}ms`).toBeLessThan(40);
    // And prove it did the work: ~1245 points across 13 runs at the shipped parameters. A kernel that
    // silently returned nothing would otherwise time at 0ms and pass.
    expect(points, 'the build produced almost no geometry — did isoRuns stop finding runs?')
      .toBeGreaterThan(800);
  });

  it('ships 9 levels at res 74 — the measured parameters', () => {
    // Pinned because they are a perf decision, not a taste one: res 110 measured 21ms and res 150, 47ms.
    expect(INTRO_CONTOUR_LEVELS).toBe(9);
    expect(INTRO_CONTOUR_RES).toBe(74);
  });
});
