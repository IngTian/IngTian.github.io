import { describe, expect, it } from 'vitest';

import { fitMeet, jitter, parseCubics, parseTrack, pointAt } from '../src/lib/gateComets';
import { GATE_COUNT, REF_VIEW_H, REF_VIEW_W, refFamily, refViewBox } from '../src/lib/gateRefPaths';

describe('reading the gate curves as travellable tracks', () => {
  it('pulls exactly the two cubics out of a gate d-string', () => {
    const [a, b] = parseCubics('M-380 -189C-380 -189 -312 216 152 343C616 470 684 875 684 875');
    expect(a.p0).toEqual({ x: -380, y: -189 });
    expect(a.p1).toEqual({ x: 152, y: 343 });
    // The second cubic starts where the first ends — the join. If this ever drifts, a head would teleport
    // mid-track.
    expect(b.p0).toEqual(a.p1);
    expect(b.p1).toEqual({ x: 684, y: 875 });
  });

  it('refuses a malformed string instead of drawing nonsense from it', () => {
    expect(() => parseCubics('M0 0C1 1 2 2')).toThrow(/14 finite coordinates/);
    expect(() => parseCubics('M0 0C1 1 2 2 3 3Cx y 5 5 6 6')).toThrow(/14 finite coordinates/);
  });

  it('measures an arc length that agrees with the geometry module', () => {
    // gateRefPaths computes each curve's length independently, by flattening at 64 steps per cubic. Two
    // independent flattenings of the same curve agreeing to 0.2% is the useful check here: it catches a
    // mis-parsed control point, which would still produce a plausible-looking but wrong track.
    for (const t of refFamily(1, GATE_COUNT, true)) {
      const track = parseTrack(t.d);
      // `len` is optional on Trail (gatePaths' shape predates it), so assert it is actually there rather than
      // letting an undefined silently turn the comparison into NaN < 0.002, which is false and would pass.
      expect(t.len, 'the geometry module stopped reporting an arc length').toBeTypeOf('number');
      expect(Math.abs(track.total - t.len!) / t.len!).toBeLessThan(0.002);
    }
  });

  it('parameterises by arc length: equal steps of s cover equal distance', () => {
    const track = parseTrack(refFamily(1, GATE_COUNT, true)[0].d);
    const step = track.total / 40;
    const d: number[] = [];
    for (let k = 0; k < 40; k++) {
      const a = pointAt(track, k * step);
      const b = pointAt(track, (k + 1) * step);
      d.push(Math.hypot(b.x - a.x, b.y - a.y));
    }
    // This is the property the whole effect rests on. Parameterise by t instead of by arc length and a head
    // races through the curve's flat stretches and crawls through its bends, which reads as a speed glitch
    // rather than as a moving object.
    const lo = Math.min(...d), hi = Math.max(...d);
    expect(hi / lo, 'travel speed is uneven along the track').toBeLessThan(1.05);
  });

  it('clamps at both ends and starts where the curve starts', () => {
    const track = parseTrack(refFamily(1, GATE_COUNT, true)[3].d);
    expect(pointAt(track, -500)).toEqual(track.pts[0]);
    expect(pointAt(track, track.total + 500)).toEqual(track.pts[track.pts.length - 1]);
    expect(track.cum[0]).toBe(0);
    for (let i = 1; i < track.cum.length; i++) expect(track.cum[i]).toBeGreaterThanOrEqual(track.cum[i - 1]);
  });

  it('has no duplicated point at the join, which would make pointAt interpolate 0/0', () => {
    const track = parseTrack(refFamily(1, GATE_COUNT, true)[5].d, 30);
    for (let i = 1; i < track.pts.length; i++) {
      const seg = Math.hypot(track.pts[i].x - track.pts[i - 1].x, track.pts[i].y - track.pts[i - 1].y);
      expect(seg, `zero-length segment at ${i}`).toBeGreaterThan(0);
    }
  });
});

describe('the meet fit, which must agree with what the SVG renderer did', () => {
  const vb = refViewBox().split(/\s+/).map(Number) as [number, number, number, number];

  it('centres the viewBox and scales by the tighter axis', () => {
    // 1990x1040 is the owner's own window, and 2.107x is the zoom measured against his reference screenshot.
    const { scale, dx, dy } = fitMeet(vb, 1990, 1040);
    expect(scale).toBeCloseTo(2.107, 2);
    // The viewBox origin is negative (it was widened about its centre), so the offset has to undo that too.
    expect(dx).toBeCloseTo((1990 - vb[2] * scale) / 2 - vb[0] * scale, 6);
    expect(dy).toBeCloseTo((1040 - vb[3] * scale) / 2 - vb[1] * scale, 6);
  });

  it('maps the viewBox centre to the element centre at any aspect', () => {
    for (const [w, h] of [[1990, 1040], [900, 1600], [1440, 900], [640, 480]]) {
      const { scale, dx, dy } = fitMeet(vb, w, h);
      const cx = vb[0] + vb[2] / 2;
      const cy = vb[1] + vb[3] / 2;
      expect(cx * scale + dx).toBeCloseTo(w / 2, 6);
      expect(cy * scale + dy).toBeCloseTo(h / 2, 6);
    }
  });

  it('agrees with the source viewBox when the zoom is 1', () => {
    const { scale } = fitMeet([0, 0, REF_VIEW_W, REF_VIEW_H], 1200, 800);
    expect(scale).toBeCloseTo(Math.min(1200 / REF_VIEW_W, 800 / REF_VIEW_H), 6);
  });
});

describe('deterministic jitter', () => {
  it('is in [0,1) and stable across calls', () => {
    for (let i = 0; i < 200; i++) {
      const v = jitter(i);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      expect(jitter(i)).toBe(v);
    }
  });

  it('spreads, so heads do not set off together', () => {
    const v = Array.from({ length: 48 }, (_, i) => jitter(i));
    // Eight buckets, 48 samples: a generator that clumps would leave buckets empty, and empty buckets here
    // mean a cluster of heads moving in lockstep — the aligned-front defect, in a new costume.
    const buckets = new Set(v.map((x) => Math.floor(x * 8)));
    expect(buckets.size).toBeGreaterThanOrEqual(7);
  });

  it('salt gives an independent stream, so speed does not correlate with phase', () => {
    const a = Array.from({ length: 48 }, (_, i) => jitter(i, 1));
    const b = Array.from({ length: 48 }, (_, i) => jitter(i, 7));
    const mean = (x: number[]) => x.reduce((s, v) => s + v, 0) / x.length;
    const ma = mean(a), mb = mean(b);
    let cov = 0, va = 0, vb2 = 0;
    for (let i = 0; i < a.length; i++) {
      cov += (a[i] - ma) * (b[i] - mb);
      va += (a[i] - ma) ** 2;
      vb2 += (b[i] - mb) ** 2;
    }
    expect(Math.abs(cov / Math.sqrt(va * vb2))).toBeLessThan(0.4);
  });
});
