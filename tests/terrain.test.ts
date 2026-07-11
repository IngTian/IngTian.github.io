import { describe, it, expect } from 'vitest';
import {
  field, grad, runDescent, colormap, BUMPS, RANGE, STEP,
  normal, projectRaw, project, computeEDL, lightDir, litColor, luminance01,
} from '../src/lib/terrain';

describe('terrain math', () => {
  it('field is a finite number and reflects the bumps', () => {
    expect(Number.isFinite(field(0, 0))).toBe(true);
    // a deep valley bump sits at (-1.4,-0.5): field there should be clearly negative
    expect(field(-1.4, -0.5)).toBeLessThan(0);
  });

  it('grad matches a finite-difference of field', () => {
    const [gx, gy] = grad(0.5, -0.3);
    const h = 1e-4;
    const fx = (field(0.5 + h, -0.3) - field(0.5 - h, -0.3)) / (2 * h);
    const fy = (field(0.5, -0.3 + h) - field(0.5, -0.3 - h)) / (2 * h);
    expect(gx).toBeCloseTo(fx, 3);
    expect(gy).toBeCloseTo(fy, 3);
  });

  it('runDescent returns 10 iterates and lands at a local minimum', () => {
    const pts = runDescent(-2.0, 1.6);
    expect(pts.length).toBe(10);
    const last = pts[pts.length - 1];
    const [gx, gy] = grad(last.x, last.y);
    // gradient norm near zero at the settled point
    expect(Math.hypot(gx, gy)).toBeLessThan(0.05);
    // variance/height decreased over the descent
    expect(field(last.x, last.y)).toBeLessThan(field(pts[0].x, pts[0].y));
  });

  it('colormap endpoints: valley warm-ochre-ish, hilltop indigo-ish', () => {
    const lo = colormap(0); // valley
    const hi = colormap(1); // hilltop
    expect(lo[0]).toBeGreaterThan(lo[2]); // warm: R > B at the valley
    expect(hi[2]).toBeGreaterThan(hi[0] - 40); // cooler/bluer at the top
    for (const c of [...lo, ...hi]) { expect(c).toBeGreaterThanOrEqual(0); expect(c).toBeLessThanOrEqual(255); }
  });

  it('BUMPS has both valleys (negative a) and hills (positive a)', () => {
    expect(BUMPS.some(b => b.a < 0)).toBe(true);
    expect(BUMPS.some(b => b.a > 0)).toBe(true);
  });
});

describe('terrain shape-reading (EDL + lighting)', () => {
  // Build the same grid the renderer uses, once, for the EDL tests.
  const grid: Array<{ x: number; y: number }> = [];
  for (let x = -RANGE; x <= RANGE; x += STEP) for (let y = -RANGE; y <= RANGE; y += STEP) grid.push({ x, y });

  it('normal is a unit vector with a positive up (z) component', () => {
    for (const [x, y] of [[0, 0], [-1.4, -0.5], [1.0, -0.6], [2, 2]] as const) {
      const [nx, ny, nz] = normal(x, y);
      expect(Math.hypot(nx, ny, nz)).toBeCloseTo(1, 6);
      expect(nz).toBeGreaterThan(0); // z = field(x,y) is a height field → normal points up
    }
  });

  it('normal matches the surface: flatter ground → more vertical normal', () => {
    // Far corner (2.5,2.5) is nearly flat (bumps decay); near a bump center the
    // slope is steeper, so its normal tilts further from vertical.
    const flatNz = normal(2.5, 2.5)[2];
    const steepNz = normal(-0.9, 0.0)[2]; // flank between the deep valley and the hill
    expect(flatNz).toBeGreaterThan(steepNz);
  });

  it('projectRaw is the pre-scale/pre-offset core of project (zoom & size independent)', () => {
    const raw = projectRaw(0.7, -0.4, field(0.7, -0.4));
    // project = W/2 + ix*sc, Hh*0.46 - uy*sc, with sc = min(W,Hh)*0.34*zoom
    const W = 1200, Hh = 800, zoom = 0.85;
    const sc = Math.min(W, Hh) * 0.34 * zoom;
    const [sx, sy, depth] = project(0.7, -0.4, field(0.7, -0.4), W, Hh, zoom);
    expect(sx).toBeCloseTo(W * 0.5 + raw.ix * sc, 6);
    expect(sy).toBeCloseTo(Hh * 0.46 - raw.uy * sc, 6);
    expect(depth).toBeCloseTo(raw.depth, 6); // depth is zoom-independent
  });

  it('computeEDL returns a shade in [0,1] per dot, with spread (not all unshaded)', () => {
    const edl = computeEDL(grid);
    expect(edl.length).toBe(grid.length);
    for (const s of edl) { expect(s).toBeGreaterThanOrEqual(0); expect(s).toBeLessThanOrEqual(1); }
    const min = Math.min(...edl), max = Math.max(...edl);
    expect(max).toBeGreaterThan(0.9);  // some dots essentially unshaded
    expect(min).toBeLessThan(0.6);     // some dots clearly shaded → real relief
  });

  it('lightDir is a unit vector aimed high overhead (large +z)', () => {
    const [lx, ly, lz] = lightDir();
    expect(Math.hypot(lx, ly, lz)).toBeCloseTo(1, 6);
    expect(lz).toBeGreaterThan(0.9); // ~74° altitude → mostly straight down the +z axis
  });

  it('litColor: lit side (N·L=1) is brighter than shadow side (N·L=-1) in the light theme', () => {
    const base: [number, number, number] = [120, 112, 96];
    const litSum = litColor(base, 1, 0).reduce((a, b) => a + b, 0);
    const shadowSum = litColor(base, -1, 0).reduce((a, b) => a + b, 0);
    expect(litSum).toBeGreaterThan(shadowSum);
  });

  it('litColor: warm/cool tint pushes the lit side warmer (R−B up) than the shadow side', () => {
    const base: [number, number, number] = [128, 128, 128];
    const lit = litColor(base, 1, 0);
    const shadow = litColor(base, -1, 0);
    expect(lit[0] - lit[2]).toBeGreaterThan(shadow[0] - shadow[2]);
  });

  it('luminance01: white→1, black→0, ordered by brightness', () => {
    expect(luminance01([255, 255, 255])).toBeCloseTo(1, 6);
    expect(luminance01([0, 0, 0])).toBeCloseTo(0, 6);
    expect(luminance01([200, 200, 200])).toBeGreaterThan(luminance01([40, 40, 40]));
  });
});
