import { describe, it, expect } from 'vitest';
import { field, grad, runDescent, colormap, BUMPS } from '../src/lib/terrain';

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
