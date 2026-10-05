import { describe, expect, it } from 'vitest';

import { parseTrack, visibleWindow } from '../src/lib/gateComets';
import { GATE_COUNT, refFamily, refViewBox } from '../src/lib/gateRefPaths';

/**
 * Rewritten down to the two functions the gate ships. It previously also covered `pointAt`, `fitMeet` and
 * `jitter`, which were written for a canvas comet field that was rejected — once the SVG dash came back, nothing
 * imported them but this file. A test whose only reason to exist is the export it tests is coverage theatre, so
 * they went together.
 *
 * `parseCubics` is no longer exported either; its malformed-input guard is exercised through `parseTrack`, which
 * is the only caller. Testing it directly pinned an implementation detail.
 */

const VB = refViewBox().split(/\s+/).map(Number) as [number, number, number, number];
const FAM = refFamily(1, GATE_COUNT, true);

describe('flattening a gate curve to arc length', () => {
  it('refuses a malformed d-string instead of drawing nonsense from it', () => {
    // Through parseTrack, because that is how the error can actually reach anyone.
    expect(() => parseTrack('M0 0C1 1 2 2')).toThrow(/14 finite coordinates/);
    expect(() => parseTrack('M0 0C1 1 2 2 3 3Cx y 5 5 6 6')).toThrow(/14 finite coordinates/);
  });

  it('measures an arc length that agrees with the geometry module', () => {
    // gateRefPaths computes each curve's length independently, flattening at 64 steps per cubic. Two independent
    // flattenings agreeing to 0.2% is the useful check: it catches a mis-parsed control point, which would still
    // produce a plausible-looking but wrong track.
    for (const t of FAM) {
      const track = parseTrack(t.d);
      expect(Math.abs(track.total - t.len) / t.len).toBeLessThan(0.002);
    }
  });

  it('parameterises by ARC LENGTH: equal steps of s cover equal distance', () => {
    // The property the dash rests on. Parameterise by the Bézier's t instead and the dash races through the
    // curve's flat stretches and crawls through its bends, which reads as a speed glitch rather than as motion.
    const track = parseTrack(FAM[0].d);
    const step = track.total / 40;
    const seg: number[] = [];
    for (let k = 0; k < 40; k++) {
      const p0 = pointOn(track, k * step);
      const p1 = pointOn(track, (k + 1) * step);
      seg.push(Math.hypot(p1.x - p0.x, p1.y - p0.y));
    }
    expect(Math.max(...seg) / Math.min(...seg), 'travel speed is uneven along the track').toBeLessThan(1.05);
  });

  it('is monotone in arc length and has no zero-length segment', () => {
    // A duplicated sample at the join between the two cubics would make any interpolation divide by zero.
    const track = parseTrack(FAM[5].d, 30);
    expect(track.cum[0]).toBe(0);
    for (let i = 1; i < track.pts.length; i++) {
      expect(track.cum[i]).toBeGreaterThan(track.cum[i - 1]);
    }
  });
});

describe('the on-screen arc window — the fix for "entire lines go dark immediately"', () => {
  it('returns a window strictly inside the arc, because most of each curve is off-frame', () => {
    // The measurement the whole fix rests on: only part of each curve is ever in the picture, so a dash sweeping
    // the WHOLE arc is off-screen for most of its cycle. Measured in the reference's own geometry, each stroke is
    // entirely absent for 25-59% of its cycle, mean 42%.
    for (const t of FAM) {
      const track = parseTrack(t.d);
      const { a, b } = visibleWindow(track, VB);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(track.total + 1e-6);
      expect(b, 'empty or inverted window').toBeGreaterThan(a);
      // Strictly inside at BOTH ends. If a window ever covered the whole arc, clipping travel to it would be a
      // no-op and the blank would silently come back.
      expect(a / track.total, 'the curve starts on screen, so nothing is being clipped').toBeGreaterThan(0.05);
      expect(b / track.total, 'the curve ends on screen, so nothing is being clipped').toBeLessThan(0.95);
    }
  });

  it('brackets the visible run: inside at the ends, outside just beyond them', () => {
    const track = parseTrack(FAM[12].d);
    const { a, b } = visibleWindow(track, VB);
    const inBox = (p: { x: number; y: number }) =>
      p.x >= VB[0] && p.x <= VB[0] + VB[2] && p.y >= VB[1] && p.y <= VB[1] + VB[3];
    expect(inBox(pointOn(track, a))).toBe(true);
    expect(inBox(pointOn(track, b))).toBe(true);
    expect(inBox(pointOn(track, Math.max(0, a - track.total * 0.03)))).toBe(false);
    expect(inBox(pointOn(track, Math.min(track.total, b + track.total * 0.03)))).toBe(false);
  });

  it('degrades to the whole arc rather than an empty window', () => {
    // A curve with no sampled point in the box must not come back as a zero-width window: a caller clamping
    // travel to it would pin the dash to one spot forever. Falling back to the full arc reproduces the unclipped
    // behaviour, which is merely the old defect rather than a frozen stroke.
    const track = parseTrack(FAM[0].d);
    expect(visibleWindow(track, [100000, 100000, 10, 10])).toEqual({ a: 0, b: track.total });
  });

  it('a bigger box can only widen the window', () => {
    // Why this matters: the window is computed against the viewBox at BUILD time, but `meet` letterboxes and an
    // SVG clips to its ELEMENT, so the real on-screen region is a superset. Monotonicity is what makes that
    // approximation safe in the right direction — the shipped window is always inside what is visible.
    const track = parseTrack(FAM[8].d);
    const tight = visibleWindow(track, VB);
    const loose = visibleWindow(track, [VB[0] - 200, VB[1] - 200, VB[2] + 400, VB[3] + 400]);
    expect(loose.a).toBeLessThanOrEqual(tight.a);
    expect(loose.b).toBeGreaterThanOrEqual(tight.b);
  });
});

/**
 * Local linear interpolation along a flattened track.
 *
 * `pointAt` used to be exported from gateComets for this, but the shipped gate never calls it — the SVG renderer
 * walks the path itself. Keeping a public export alive so a test can use it is backwards, so the few lines the
 * tests need live here instead.
 */
function pointOn(track: ReturnType<typeof parseTrack>, s: number): { x: number; y: number } {
  const { pts, cum, total } = track;
  if (s <= 0) return pts[0];
  if (s >= total) return pts[pts.length - 1];
  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= s) lo = mid; else hi = mid;
  }
  const span = cum[hi] - cum[lo];
  const f = span > 0 ? (s - cum[lo]) / span : 0;
  return { x: pts[lo].x + (pts[hi].x - pts[lo].x) * f, y: pts[lo].y + (pts[hi].y - pts[lo].y) * f };
}
