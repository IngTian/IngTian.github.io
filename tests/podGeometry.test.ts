// tests/podGeometry.test.ts
import { describe, it, expect } from 'vitest';
import { podProject, POD_TILT_DEG } from '../src/lib/podGeometry';

const W = 1600, H = 900;

describe('podProject — the from-the-seat camera', () => {
  it('has no yaw: the bench edge is LEVEL across the frame', () => {
    // The defining property of sitting at a desk (vs looking down at a table):
    // two points at the same depth and height must land at the same screen y.
    const [lx, ly] = podProject(-2, -1, 0, W, H);
    const [rx, ry] = podProject(2, -1, 0, W, H);
    expect(ly).toBeCloseTo(ry, 6);
    expect(rx).toBeGreaterThan(lx);
  });

  it('puts the bench BELOW the monitors on screen', () => {
    const [, benchY] = podProject(0, -1, 0, W, H);       // near desk edge
    const [, screenBottomY] = podProject(0, 1, 0.35, W, H);
    const [, screenTopY] = podProject(0, 1, 1.45, W, H);
    expect(benchY).toBeGreaterThan(screenBottomY);        // larger y = lower
    expect(screenBottomY).toBeGreaterThan(screenTopY);
  });

  it('returns depth that increases with distance, for painter sorting', () => {
    const near = podProject(0, -1, 0, W, H)[2];
    const far = podProject(0, 1, 0, W, H)[2];
    expect(far).toBeGreaterThan(near);
  });

  it('height reduces depth (a tall object leans toward the viewer)', () => {
    const flat = podProject(0, 1, 0, W, H)[2];
    const tall = podProject(0, 1, 1.4, W, H)[2];
    expect(tall).toBeLessThan(flat);
  });

  it('is a uniform scale: zoom never distorts aspect', () => {
    const [x1, y1] = podProject(1, 0.5, 0.3, W, H, 1);
    const [x2, y2] = podProject(1, 0.5, 0.3, W, H, 2);
    const cx = W * 0.5;
    expect((x2 - cx) / (x1 - cx)).toBeCloseTo(2, 6);
    // y offsets from the horizon scale by the same factor
    const [, y0a] = podProject(0, 0, 0, W, H, 1);
    const [, y0b] = podProject(0, 0, 0, W, H, 2);
    expect((y2 - y0b) / (y1 - y0a)).toBeCloseTo(2, 6);
  });

  it('uses an 18 degree tilt', () => {
    expect(POD_TILT_DEG).toBe(18);
  });
});
