// tests/terrainContours.test.ts
// THE TERRAIN'S ISOLINES, which the homepage intro strokes onto a flat plane before the surface rises.
//
// Same `field()` the hero's dots are painted from, so the lines and the dots describe one surface — that
// is the whole point of the intro's design, and it is why these contours are computed from the terrain
// field rather than being drawn.
//
// The memo assertions matter as much as the geometry ones: the intro computes these once at ~10ms and
// then strokes them every frame for 3.6 seconds. Without the memo that is 10ms per frame.
import { describe, expect, it } from 'vitest';
import {
  INTRO_CONTOUR_LEVELS, INTRO_CONTOUR_RES,
  terrainLevels, terrainContoursFor, introContours,
} from '../src/lib/terrainContours';
import { field, RANGE } from '../src/lib/terrain';

describe('terrainLevels', () => {
  it('returns n ascending levels', () => {
    const lv = terrainLevels(INTRO_CONTOUR_LEVELS);
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
    for (const l of terrainLevels(INTRO_CONTOUR_LEVELS)) {
      expect(l).toBeGreaterThan(lo);
      expect(l).toBeLessThan(hi);
    }
  });

  it('spaces levels evenly', () => {
    // Placed at (k + 0.5) / n through the measured range, the same scheme descentPath.contourLevels uses.
    const lv = terrainLevels(INTRO_CONTOUR_LEVELS);
    const gap = lv[1] - lv[0];
    for (let i = 2; i < lv.length; i++) expect(lv[i] - lv[i - 1]).toBeCloseTo(gap, 9);
  });

  it('defaults to the shipped level count', () => {
    expect(terrainLevels()).toHaveLength(INTRO_CONTOUR_LEVELS);
  });
});

describe('terrainContoursFor — the memo', () => {
  it('returns the IDENTICAL array for a repeated (level, res), not an equal one', () => {
    // toBe, not toEqual. Deleting the memo fails here, and the intro goes from one 10ms computation to
    // one per frame.
    const lv = terrainLevels()[4];
    expect(terrainContoursFor(lv, 40)).toBe(terrainContoursFor(lv, 40));
  });

  it('keys on the RESOLUTION as well as the level', () => {
    // A key that ignores an argument returns the wrong answer the moment a second call site appears.
    const lv = terrainLevels()[4];
    const a = terrainContoursFor(lv, 30);
    const b = terrainContoursFor(lv, 60);
    expect(a).not.toBe(b);
    expect(terrainContoursFor(lv, 30)).toBe(a);
    expect(terrainContoursFor(lv, 60)).toBe(b);
  });

  it('keys on the LEVEL as well as the resolution', () => {
    const lv = terrainLevels();
    expect(terrainContoursFor(lv[2], 30)).not.toBe(terrainContoursFor(lv[6], 30));
  });

  it('produces continuous polylines inside RANGE', () => {
    for (const run of terrainContoursFor(terrainLevels()[4], 40)) {
      expect(run.length).toBeGreaterThan(3);
      for (const [x, y] of run) {
        expect(Math.abs(x)).toBeLessThanOrEqual(RANGE + 1e-9);
        expect(Math.abs(y)).toBeLessThanOrEqual(RANGE + 1e-9);
      }
    }
  });

  it('puts every point on its level, to within a cell', () => {
    const res = 40;
    const cell = (2 * RANGE) / res;
    const lv = terrainLevels()[5];
    for (const run of terrainContoursFor(lv, res)) {
      for (const [x, y] of run) {
        // the field's gradient magnitude is O(1) here, so a cell of error in position is a cell of
        // error in value
        expect(Math.abs(field(x, y) - lv)).toBeLessThan(cell * 2);
      }
    }
  });
});

describe('introContours', () => {
  it('returns one entry per level, each a non-empty run list', () => {
    const all = introContours();
    expect(all).toHaveLength(INTRO_CONTOUR_LEVELS);
    for (const runs of all) expect(runs.length).toBeGreaterThan(0);
  });

  it('is memoised through terrainContoursFor', () => {
    const a = introContours();
    const b = introContours();
    // same inner arrays, because each level's runs come from the memo
    for (let i = 0; i < a.length; i++) expect(a[i]).toBe(b[i]);
  });

  it('costs under 40ms cold at the shipped parameters', () => {
    // Measured 10.0ms median for 9 levels at res 74 on node 24. This ceiling is deliberately loose
    // enough not to flake on a loaded CI box, and still tight enough to fail if someone raises res to
    // descentPath's 150, which measured 47ms.
    const lv = terrainLevels(INTRO_CONTOUR_LEVELS);
    const t0 = performance.now();
    // offset the levels so nothing above has warmed the memo for these exact keys
    for (const l of lv) terrainContoursFor(l + 1e-7, INTRO_CONTOUR_RES);
    const ms = performance.now() - t0;
    expect(ms, `cold contour build took ${ms.toFixed(1)}ms`).toBeLessThan(40);
  });

  it('ships 9 levels at res 74 — the measured parameters', () => {
    // Pinned because they are a perf decision, not a taste one: res 110 measured 21ms and res 150, 47ms.
    expect(INTRO_CONTOUR_LEVELS).toBe(9);
    expect(INTRO_CONTOUR_RES).toBe(74);
  });
});
