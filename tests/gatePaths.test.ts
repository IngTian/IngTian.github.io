// tests/gatePaths.test.ts
// The first-visit gate's geometry. Everything here runs at BUILD time, so these are the only tests that will
// ever see this code — there is no runtime to observe it in.
import { describe, expect, it } from 'vitest';
import { catmullRomPath } from '../src/lib/gatePaths';
import { trails } from '../src/lib/gateLines';

describe('catmullRomPath', () => {
  it('emits one cubic per segment after the initial move', () => {
    const d = catmullRomPath([{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 0 }]);
    expect(d.startsWith('M0,0')).toBe(true);
    expect(d.match(/C/g)).toHaveLength(2);
  });

  it('returns an empty string for no points, and a bare move for one', () => {
    expect(catmullRomPath([])).toBe('');
    expect(catmullRomPath([{ x: 3, y: 4 }])).toBe('M3,4');
  });
});

describe('catmullRomPath — centripetal, because uniform cusps on uneven points', () => {
  // THE MEASUREMENT THAT PUT THIS HERE. Gradient descent moves fast on a steep slope and crawls near a
  // minimum, and runDescent downsamples by INDEX rather than arc length, so one trail's 10 points were
  // measured at a 412.8x segment-length ratio with a worst chord turn of 138.6 degrees. Uniform
  // Catmull-Rom overshoots above roughly 5x, which is what drew the visible spikes and the knot where
  // trails converge. Centripetal parameterization (alpha = 0.5) provably cannot cusp or self-intersect.
  const ctrlXs = (d: string): number[] =>
    [...d.matchAll(/[MC]([-\d.,\s]+)/g)]
      .flatMap((m) => m[1].trim().split(/\s+/))
      .map((pair) => Number(pair.split(',')[0]));

  it('does not send control points backwards on a monotone path with one tiny segment', () => {
    // x is strictly increasing, with a 200:1 spacing jump — the exact shape of a descent trail.
    //
    // THE TOLERANCE IS 1px AND THAT NUMBER IS MEASURED, not chosen to make this pass. Uniform Catmull-Rom
    // on this input threw a control point 66px backwards (200 -> 233.5 -> 167.7), which is the cusp.
    // Centripetal leaves a 0.35px wiggle (200.7 -> 200.3), which cannot be seen at all — output coordinates
    // are rounded to 0.1px. 1px sits two orders of magnitude below the defect and three times above the
    // residue, so it separates the two cleanly instead of splitting hairs between them.
    const pts = [{ x: 0, y: 0 }, { x: 200, y: 40 }, { x: 201, y: 41 }, { x: 400, y: 0 }];
    const xs = ctrlXs(catmullRomPath(pts));
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i], `control x went backwards at ${i}: ${xs.join(' ')}`).toBeGreaterThanOrEqual(xs[i - 1] - 1);
    }
  });

  it('keeps the drawn curve inside a sane envelope of its control polygon', () => {
    const pts = [{ x: 0, y: 0 }, { x: 200, y: 40 }, { x: 201, y: 41 }, { x: 400, y: 0 }];
    const d = catmullRomPath(pts);
    const ys = [...d.matchAll(/,(-?\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
    // Uniform CR on this input throws a control point far outside [0, 41]; centripetal stays close.
    expect(Math.max(...ys)).toBeLessThan(60);
    expect(Math.min(...ys)).toBeGreaterThan(-20);
  });

  it('still emits one cubic per segment', () => {
    const d = catmullRomPath([{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 0 }]);
    expect(d.match(/C/g)).toHaveLength(2);
  });

  it('tolerates coincident points without producing NaN', () => {
    // Near a minimum two samples can be identical; a distance-weighted scheme divides by that distance.
    const d = catmullRomPath([{ x: 5, y: 5 }, { x: 5, y: 5 }, { x: 60, y: 20 }, { x: 60, y: 20 }]);
    expect(d).not.toMatch(/NaN|Infinity/);
  });

  it('bounds the turning angle of the real shipped trails', () => {
    // The end-to-end property: no trail may contain a hairpin. 138.6 degrees was the measured worst
    // before centripetal; a smooth descent curve should stay well under 90.
    let worst = 0;
    for (const t of trails()) {
      const pts = [...t.d.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)]
        .map((m) => ({ x: Number(m[1]), y: Number(m[2]) }));
      for (let i = 1; i < pts.length - 1; i++) {
        const a = { x: pts[i].x - pts[i - 1].x, y: pts[i].y - pts[i - 1].y };
        const b = { x: pts[i + 1].x - pts[i].x, y: pts[i + 1].y - pts[i].y };
        const la = Math.hypot(a.x, a.y), lb = Math.hypot(b.x, b.y);
        if (la < 1e-9 || lb < 1e-9) continue;
        const cos = Math.max(-1, Math.min(1, (a.x * b.x + a.y * b.y) / (la * lb)));
        worst = Math.max(worst, (Math.acos(cos) * 180) / Math.PI);
      }
    }
    expect(worst, `worst turn ${worst.toFixed(1)} deg`).toBeLessThan(100);
  });
});
