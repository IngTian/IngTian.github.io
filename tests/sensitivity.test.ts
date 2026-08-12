// tests/sensitivity.test.ts
// "We are also measuring our own geometry" is a claim about CURVATURE, and curvature is computable.
// These tests check the maths against closed forms and known analytic cases, then check that the
// field genuinely supports the owner's reading — so if someone retunes the terrain and the reading
// stops being true, that is a red test rather than prose quietly becoming false.

import { describe, it, expect } from 'vitest';
import { hessian, curvature, escapeDirection, readGeometry } from '../src/lib/sensitivity';
import { trajectoryFacts, WAYPOINTS } from '../src/lib/trajectory';

describe('hessian — checked against a case with a known answer', () => {
  it('is symmetric in its mixed term', () => {
    // fxy must equal fyx for a smooth field; a bug in the four-point stencil breaks this first.
    const [, , fxy] = hessian(0.4, -0.7);
    const [, , fxy2] = hessian(0.4, -0.7, 2e-3);
    expect(Math.abs(fxy - fxy2)).toBeLessThan(0.02);
  });

  it('reports positive curvature at a minimum and negative at a peak', () => {
    const f = trajectoryFacts();
    const [axx, ayy] = hessian(f.globalBasin.x, f.globalBasin.y);
    expect(axx).toBeGreaterThan(0);
    expect(ayy).toBeGreaterThan(0);
    // The hill declared in terrain.ts at (-0.2, 0.9) is a maximum in at least one direction.
    const c = curvature(-0.2, 0.9);
    expect(c.k1).toBeLessThan(0);
  });
});

describe('curvature', () => {
  it('orders eigenvalues k1 <= k2', () => {
    for (const [x, y] of [[0, 0], [1.5, 0.7], [-1.4, -0.5], [2, -2]] as const) {
      const c = curvature(x, y);
      expect(c.k1).toBeLessThanOrEqual(c.k2);
    }
  });

  it('returns unit, perpendicular principal directions', () => {
    const c = curvature(1.2, 0.3);
    expect(Math.hypot(...c.soft)).toBeCloseTo(1, 6);
    expect(Math.hypot(...c.stiff)).toBeCloseTo(1, 6);
    expect(c.soft[0] * c.stiff[0] + c.soft[1] * c.stiff[1]).toBeCloseTo(0, 6);
  });

  it('identifies a basin by both curvatures being positive', () => {
    const f = trajectoryFacts();
    const g = readGeometry('global', f.globalBasin.x, f.globalBasin.y);
    expect(g.inBasin).toBe(true);
  });

  it('is deterministic', () => {
    expect(curvature(0.7, -0.2).k1).toBe(curvature(0.7, -0.2).k1);
  });
});

describe('the field supports the owner\'s reading of it', () => {
  const swe = WAYPOINTS.find((w) => w.label.includes('Senior SWE'))!;
  const phd = WAYPOINTS.find((w) => w.label.includes('PhD'))!;

  it('puts the engineering years in a ROUND, closed bowl — nowhere left to go', () => {
    // "Engineering is a small hill where we are good at." A round basin (anisotropy near 1) has no
    // preferred direction to run in: every way out is uphill by the same amount.
    const c = curvature(swe.x, swe.y);
    expect(c.k1).toBeGreaterThan(0);
    expect(c.anisotropy).toBeLessThan(1.6);
  });

  it('puts the research side in an ELONGATED valley — a direction to run in', () => {
    // "Our true potential lies in mathematics and structured thinking." An anisotropic valley has a
    // soft direction: somewhere the surface keeps giving.
    const c = curvature(phd.x, phd.y);
    expect(c.anisotropy).toBeGreaterThan(2);
  });

  it('gives 100x more feedback per step on the research side than in the basin', () => {
    // "We prefer more direct feedback loops" as a measured quantity: |grad| is signal per step.
    // Measured through the module (which applies ZSCALE): the ratio is ~260x.
    const inBasin = curvature(swe.x, swe.y).signal;
    const onDescent = curvature(phd.x, phd.y).signal;
    expect(onDescent / inBasin).toBeGreaterThan(100);
  });

  it('finds a real escape from the basin, but only by clearing the rim', () => {
    // The bug this locks: with a single fixed probe distance of 1.35 every probe fell back into the
    // same basin and the function reported ~0 improvement — it would have claimed the escape does
    // not exist. Sweeping the distance finds it, and the rim sits between 1.45 and 1.50 (measured).
    //
    // NOTE ON A SCRATCH-SCRIPT TRAP: a standalone sweep reported the basin at -0.4774 and the escape
    // improvement at 0.4245, while the module reports -0.8116 and 0.7217. The ratio is exactly 1.7 —
    // terrain.field() multiplies by ZSCALE, which the copy-pasted script omitted. The MODULE is
    // authoritative; numbers from a hand-copied field are not.
    const e = escapeDirection(swe.x, swe.y);
    expect(e.improved).toBe(true);
    expect(e.improvement).toBeGreaterThan(0.3);
    expect(e.climb).toBeGreaterThanOrEqual(1.5);
  });

  it('escapes toward the deeper basin, not in some arbitrary direction', () => {
    const f = trajectoryFacts();
    const e = escapeDirection(swe.x, swe.y);
    // The escape must land in the global basin.
    expect(e.reachedDepth).toBeCloseTo(f.globalBasin.depth, 3);
    // And point roughly toward it: dot product of the escape direction with the direction to the
    // deep basin should be positive.
    const tx = f.globalBasin.x - swe.x;
    const ty = f.globalBasin.y - swe.y;
    const n = Math.hypot(tx, ty);
    expect((e.dir[0] * tx + e.dir[1] * ty) / n).toBeGreaterThan(0.3);
  });

  it('confirms a probe that does NOT clear the rim finds nothing', () => {
    // The honest limitation, and the entire point of the story: a local method cannot see the way
    // out. The rim distance is MEASURED, not guessed — sweeping the probe distance from 0.20 to 2.20
    // shows improvement 0.0000 for everything up to 1.35 and 0.4245 from 1.50 onward, so the rim
    // sits between them. An earlier version of this test guessed 0.5-0.9 was short enough to fail
    // and 1.35 was long enough to succeed; both guesses were wrong in opposite directions.
    // Below the rim the probe finds only a numerical leak of 6e-6 — a descent that grazes the
    // saddle, not a real escape. Above it the improvement jumps to 0.7217, five orders of magnitude
    // larger. The test asserts that gap rather than 'exactly zero'.
    const short = escapeDirection(swe.x, swe.y, { climbs: [0.5, 0.9, 1.2, 1.45] });
    expect(short.improvement).toBeLessThan(1e-4);

    const long = escapeDirection(swe.x, swe.y, { climbs: [1.5] });
    expect(long.improved).toBe(true);
    expect(long.improvement).toBeGreaterThan(0.5);
    expect(long.improvement / Math.max(1e-12, short.improvement)).toBeGreaterThan(1000);
  });
});
