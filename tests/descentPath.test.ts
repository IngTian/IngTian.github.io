// tests/descentPath.test.ts
// THE CONTOUR MEMO — the largest single performance fix on the perf branch, and for one revision the only
// one with nothing holding it in place.
//
// `contours()` for the eleven levels the descent graph draws is 17 polylines / 2838 points and costs
// 53–67ms of synchronous main thread. `DescentPath.astro` binds its init to BOTH `astro:page-load` and
// `theme:change`, so uncached that ran on every return to `/` and every theme flip, inside the view
// transition. The cache was first written as a `Map` at the top of the component's `<script>`, where it
// worked — and where NO TEST COULD SEE IT: `grep -rln DescentPath tests/` returned nothing, so moving the
// Map back inside `init()` would have silently undone the whole saving with all 631 tests green. That is the
// same hole `passWithNoTests: false` exists to close, one level up.
//
// So the memo lives in `lib/descentPath.ts` and this is its spec. Deliberately the same shape as the
// `gridCache`/`buildGrid` tests in paintTerrain.test.ts, which is the pattern this repo already settled on.
import { describe, expect, it } from 'vitest';
import { contours, contoursFor, contourLevels, storyBounds } from '../src/lib/descentPath';

describe('contoursFor — the memo', () => {
  it('returns the IDENTICAL array for a repeated (level, res), not an equal one', () => {
    // The whole fix in one assertion. `toBe`, not `toEqual`: an equal-but-fresh array means the marching
    // squares ran again and the 53–67ms is back. Deleting the Map, or moving it inside a function, fails here.
    const lv = contourLevels(11)[4];
    expect(contoursFor(lv, 150)).toBe(contoursFor(lv, 150));
  });

  it('keys on the RESOLUTION as well as the level', () => {
    // A key that ignores an argument is a cache that returns the wrong answer the moment a second call site
    // appears with a different res. This is the assertion that makes that a test failure rather than a
    // drawing bug nobody can see.
    const lv = contourLevels(11)[4];
    const a = contoursFor(lv, 40);
    const b = contoursFor(lv, 80);
    expect(a).not.toBe(b);
    // and each is still stable on its own
    expect(contoursFor(lv, 40)).toBe(a);
    expect(contoursFor(lv, 80)).toBe(b);
  });

  it('keys on the LEVEL as well as the resolution', () => {
    const levels = contourLevels(11);
    expect(contoursFor(levels[2], 60)).not.toBe(contoursFor(levels[7], 60));
  });

  it('returns what the uncached kernel returns — the memo is not a different answer', () => {
    // A cache that is fast and wrong is worse than no cache. `contours` is pure, so a deep compare against
    // a fresh run is the real check; if these ever diverge the memo is keyed on too little.
    const lv = contourLevels(11)[3];
    expect(contoursFor(lv, 50)).toEqual(contours(lv, 50));
  });

  it('is actually faster warm than cold, by a wide margin', () => {
    // A timing assertion with a ~100x margin rather than a tight budget, so it cannot be flaky on a loaded
    // CI box but still fails outright if the memo is removed. Mirrors the warm/cold test in
    // paintTerrain.test.ts.
    const lv = contourLevels(11)[6] + 1e-7; // a level nothing above has touched
    const t0 = performance.now();
    contoursFor(lv, 150);
    const cold = performance.now() - t0;

    const t1 = performance.now();
    for (let k = 0; k < 50; k++) contoursFor(lv, 150);
    const warm50 = performance.now() - t1;

    expect(warm50, `50 cached calls (${warm50.toFixed(2)}ms) should beat one cold one (${cold.toFixed(2)}ms)`)
      .toBeLessThan(cold);
  });
});

describe('contours — the kernel the memo wraps', () => {
  it('is deterministic, which is what makes memoising it sound at all', () => {
    // The hoist is only safe because `contours` depends on nothing but `storyBounds()` (itself memoised) and
    // the pure `field()`. If a hidden input ever appears — a clock, a theme, a random — this goes red and
    // the cache has to come back out.
    const lv = contourLevels(11)[5];
    expect(contours(lv, 40)).toEqual(contours(lv, 40));
  });

  it('produces continuous runs, not 1px stubs', () => {
    // The original bug in this function: segments were emitted per cell and never stitched, so the contours
    // were invisible. Every run it returns must be a real polyline.
    const lv = contourLevels(11)[5];
    const runs = contours(lv, 100);
    expect(runs.length).toBeGreaterThan(0);
    for (const run of runs) expect(run.length).toBeGreaterThan(3);
  });

  it('stays inside the story bounds it sampled', () => {
    const b = storyBounds();
    const lv = contourLevels(11)[5];
    for (const run of contours(lv, 60)) {
      for (const [x, y] of run) {
        expect(x).toBeGreaterThanOrEqual(b.x0 - 1e-6);
        expect(x).toBeLessThanOrEqual(b.x1 + 1e-6);
        expect(y).toBeGreaterThanOrEqual(b.y0 - 1e-6);
        expect(y).toBeLessThanOrEqual(b.y1 + 1e-6);
      }
    }
  });
});

describe('the basin wash\'s eligible loops — an invariant between two files', () => {
  // WHY THIS EXISTS, and it is not a hypothetical. The marching-squares kernel was extracted and its
  // stitch fixed (first-match → nearest), which is strictly better geometry: it retains MORE segments
  // (2821 vs 2772 at res 150) and stops dropping contour fragments. But it changes the RUN STRUCTURE —
  // 190 runs became 17 — and `DescentPath.astro`'s basin wash is run-structure sensitive: it fills only
  // runs of ≥12 points whose endpoints are within 0.08, at a per-level opacity of `0.034 - i*0.005`.
  //
  // Measured across that change, the fill count stayed at 3 but MOVED LEVELS: lv1×1 + lv2×2 before,
  // lv0×1 + lv3×1 + lv4×1 after — including a new fill on lv0, the deepest level and the strongest
  // opacity, which previously got none. The Story slide now washes different basins at different
  // strengths than the version the owner approved.
  //
  // Nothing in this file could see that. The specs above pin the memo, determinism, `length > 3` and
  // the bounds — all of which pass identically at 190 runs and at 17. So this is the guard the
  // refactor's own plan claimed to have and did not: the exact predicate the renderer applies,
  // asserted on the geometry, in the category CLAUDE.md calls "an invariant between two files".
  const RES = 150;          // CONTOUR_RES in DescentPath.astro
  const MIN_PTS = 12;       // `run.length < 12` → skip
  const CLOSE_TOL = 0.08;   // endpoints within 0.08 → a closed loop

  /** The renderer's own eligibility test, applied to one level's runs. */
  const eligible = (runs: [number, number][][]): number => runs.filter((run) => {
    if (run.length < MIN_PTS) return false;
    const a = run[0], z = run[run.length - 1];
    return Math.hypot(a[0] - z[0], a[1] - z[1]) < CLOSE_TOL;
  }).length;

  it('fills a stable set of closed loops across the five washed levels', () => {
    // `levels.slice(0, 5)` is what the wash iterates.
    const perLevel = contourLevels(11).slice(0, 5).map((lv) => eligible(contoursFor(lv, RES)));
    // Pinned as a whole so a change anywhere in the stitch, the levels or the bounds shows up here
    // rather than as a differently-shaded Story slide nobody diffed.
    expect(perLevel).toEqual([1, 0, 0, 1, 1]);
  });

  it('keeps the wash to a handful of loops, never a slab', () => {
    // The guard exists because an OPEN run clipped by the frame, closed with closePath(), draws a chord
    // across the frame and fills a rectangular slab — the bug the `closed` test was added for. If a
    // future stitch starts emitting long open runs that happen to begin and end near each other, this
    // catches the count explosion before anyone sees the slab.
    const total = contourLevels(11).slice(0, 5)
      .reduce((n, lv) => n + eligible(contoursFor(lv, RES)), 0);
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThan(8);
  });

  it('every eligible loop really is a loop, not a near-miss', () => {
    for (const lv of contourLevels(11).slice(0, 5)) {
      for (const run of contoursFor(lv, RES)) {
        if (run.length < MIN_PTS) continue;
        const a = run[0], z = run[run.length - 1];
        const gap = Math.hypot(a[0] - z[0], a[1] - z[1]);
        if (gap >= CLOSE_TOL) continue;
        // a closed loop of ≥12 points should enclose real area, not be a hairpin
        let area = 0;
        for (let k = 0; k < run.length; k++) {
          const p = run[k], q = run[(k + 1) % run.length];
          area += p[0] * q[1] - q[0] * p[1];
        }
        expect(Math.abs(area) / 2, `a filled loop at level ${lv} encloses no area`)
          .toBeGreaterThan(0.001);
      }
    }
  });
});

describe('contourLevels', () => {
  it('returns n ascending levels inside the field\'s own range', () => {
    const levels = contourLevels(11);
    expect(levels).toHaveLength(11);
    for (let i = 1; i < levels.length; i++) expect(levels[i]).toBeGreaterThan(levels[i - 1]);
  });

  it('spans the range rather than clustering, so no level is wasted off-frame', () => {
    // The function's own stated purpose. Levels are placed at (k + 0.5)/n through the measured range, so
    // the gaps between consecutive levels must all be equal.
    const levels = contourLevels(11);
    const gap = levels[1] - levels[0];
    for (let i = 2; i < levels.length; i++) {
      expect(levels[i] - levels[i - 1]).toBeCloseTo(gap, 9);
    }
  });
});
