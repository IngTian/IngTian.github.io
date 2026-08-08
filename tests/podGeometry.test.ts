// tests/podGeometry.test.ts
import { describe, it, expect } from 'vitest';
import {
  podProject, POD_TILT_DEG,
  POD_LAYOUT, MONITOR_SLOTS, screenRects, sortByDepth,
} from '../src/lib/podGeometry';

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

describe('POD_LAYOUT', () => {
  it('has exactly 5 monitors, numbered 0..4', () => {
    const mons = POD_LAYOUT.filter((q) => q.id === 'monitor');
    expect(mons).toHaveLength(MONITOR_SLOTS);
    expect(mons.map((m) => m.slot).sort()).toEqual([0, 1, 2, 3, 4]);
  });

  it('includes every desk object the design calls for', () => {
    const ids = new Set(POD_LAYOUT.map((q) => q.id));
    for (const want of ['bench', 'wall', 'monitor', 'keyboard', 'mouse', 'coffee', 'papers', 'cow']) {
      expect(ids.has(want as never), `missing ${want}`).toBe(true);
    }
  });

  it('every quad has at least 3 corners', () => {
    for (const q of POD_LAYOUT) expect(q.corners.length).toBeGreaterThanOrEqual(3);
  });

  it('puts desk objects at or above the bench (z >= 0) and monitors above them', () => {
    const deskZ = POD_LAYOUT.filter((q) => ['keyboard', 'mouse', 'coffee', 'papers', 'cow'].includes(q.id))
      .flatMap((q) => q.corners.map((c) => c[2]));
    for (const z of deskZ) expect(z).toBeGreaterThanOrEqual(0);
    const monZ = POD_LAYOUT.filter((q) => q.id === 'monitor').flatMap((q) => q.corners.map((c) => c[2]));
    expect(Math.min(...monZ)).toBeGreaterThan(Math.max(...deskZ));
  });

  it('keyboard and mouse are NEARER the viewer than the papers', () => {
    const nearestY = (id: string) => Math.min(
      ...POD_LAYOUT.filter((q) => q.id === id).flatMap((q) => q.corners.map((c) => c[1])),
    );
    expect(nearestY('keyboard')).toBeLessThan(nearestY('papers'));
  });
});

describe('screenRects', () => {
  it('returns one percentage rect per monitor, all inside the frame', () => {
    const rects = screenRects(1600, 900);
    expect(rects).toHaveLength(MONITOR_SLOTS);
    for (const r of rects) {
      expect(r.left).toBeGreaterThanOrEqual(0);
      expect(r.top).toBeGreaterThanOrEqual(0);
      expect(r.left + r.width).toBeLessThanOrEqual(100.001);
      expect(r.top + r.height).toBeLessThanOrEqual(100.001);
      expect(r.width).toBeGreaterThan(0);
      expect(r.height).toBeGreaterThan(0);
    }
  });

  it('is resolution independent — percentages match at any frame size', () => {
    const a = screenRects(1600, 900);
    const b = screenRects(3200, 1800);
    a.forEach((r, i) => {
      expect(r.left).toBeCloseTo(b[i].left, 6);
      expect(r.width).toBeCloseTo(b[i].width, 6);
    });
  });

  it('orders slots left to right', () => {
    const rects = screenRects(1600, 900);
    for (let i = 1; i < rects.length; i++) {
      expect(rects[i].left).toBeGreaterThanOrEqual(rects[i - 1].left - 0.001);
    }
  });
});

describe('sortByDepth', () => {
  it('paints far objects before near ones', () => {
    const sorted = sortByDepth(POD_LAYOUT, 1600, 900);
    const meanDepth = (q: { corners: [number, number, number][] }) =>
      q.corners.reduce((s, c) => s + podProject(c[0], c[1], c[2], 1600, 900)[2], 0) / q.corners.length;
    for (let i = 1; i < sorted.length; i++) {
      expect(meanDepth(sorted[i - 1])).toBeGreaterThanOrEqual(meanDepth(sorted[i]) - 1e-9);
    }
  });

  it('does not mutate the input', () => {
    const before = POD_LAYOUT.map((q) => q.id).join(',');
    sortByDepth(POD_LAYOUT, 1600, 900);
    expect(POD_LAYOUT.map((q) => q.id).join(',')).toBe(before);
  });
});
