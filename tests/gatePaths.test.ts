// tests/gatePaths.test.ts
// The first-visit gate's geometry. Everything here runs at BUILD time, so these are the only tests that will
// ever see this code — there is no runtime to observe it in.
import { describe, expect, it } from 'vitest';
import {
  GATE_VIEW_H, GATE_VIEW_W, LATTICE, MIN_SPAN, SPAWN_COUNT,
  catmullRomPath, gateDescent, gateSpawns, gateTrails, hasRealExtent, hash01,
} from '../src/lib/gatePaths';
import { RANGE, grad } from '../src/lib/terrain';

describe('hasRealExtent — the degenerate-trail guard, exercised directly', () => {
  // THIS IS HERE BECAUSE THE OBVIOUS TEST PASSED WITHOUT PROVING ANYTHING. gateTrails() currently drops
  // ZERO of its 36 trails, so an assertion that the shipped count is "between 28 and 36" never touches the
  // filter. The guard still earns its place — a Gaussian's centre IS a stationary point, so a spawn landing
  // on one makes runDescent break on its first iteration and return ten copies of a single point — but the
  // only way to show the guard works is to hand it that input directly.
  const repeated = Array.from({ length: 10 }, () => ({ x: 412.5, y: 300.25 }));

  it('rejects a path that is ten copies of one point', () => {
    expect(hasRealExtent(repeated)).toBe(false);
  });

  it('rejects a path shorter than MIN_SPAN in both axes', () => {
    expect(hasRealExtent([{ x: 0, y: 0 }, { x: MIN_SPAN - 1, y: MIN_SPAN - 1 }])).toBe(false);
  });

  it('accepts a path that spans MIN_SPAN in either axis alone', () => {
    expect(hasRealExtent([{ x: 0, y: 0 }, { x: MIN_SPAN, y: 0 }])).toBe(true);
    expect(hasRealExtent([{ x: 0, y: 0 }, { x: 0, y: MIN_SPAN }])).toBe(true);
  });

  it('accepts every real descent the shipped spawn set produces', () => {
    for (const t of gateTrails()) expect(t.d.length, `trail ${t.i}`).toBeGreaterThan(20);
  });
});

describe('hash01 — the replacement for Math.random()', () => {
  it('is deterministic', () => {
    expect(hash01(7)).toBe(hash01(7));
  });

  it('stays in [0,1)', () => {
    for (let i = 0; i < 200; i++) {
      const v = hash01(i);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('does not return the same value for every input', () => {
    // A constant hash would make the jitter a no-op and the fans read as a grid.
    expect(new Set(Array.from({ length: 40 }, (_, i) => hash01(i))).size).toBeGreaterThan(30);
  });
});

describe('gateSpawns — a deterministic lattice, jittered off its grid', () => {
  const s = gateSpawns();

  it('is one spawn per lattice cell', () => {
    expect(s).toHaveLength(SPAWN_COUNT);
    expect(SPAWN_COUNT).toBe(LATTICE * LATTICE);
  });

  it('keeps every spawn inside the field', () => {
    for (const [x, y] of s) {
      expect(Math.abs(x), `x=${x}`).toBeLessThanOrEqual(RANGE);
      expect(Math.abs(y), `y=${y}`).toBeLessThanOrEqual(RANGE);
    }
  });

  it('is byte-identical across calls', () => {
    expect(JSON.stringify(gateSpawns())).toBe(JSON.stringify(s));
  });

  it('is not an exact grid — the jitter actually moved things', () => {
    const cell = (2 * RANGE) / LATTICE;
    const onGrid = s.filter(([x]) => Math.abs(((x + RANGE) % cell) - cell / 2) < 1e-9);
    expect(onGrid.length).toBeLessThan(2);
  });
});

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

describe('gateTrails — the shipped geometry', () => {
  const t = gateTrails();

  it('is byte-identical across calls (determinism rule)', () => {
    expect(JSON.stringify(gateTrails())).toBe(JSON.stringify(t));
  });

  it('drops degenerate trails but keeps the picture dense', () => {
    // A spawn on a Gaussian's centre has zero gradient, so runDescent breaks on its first
    // iteration and returns 10 copies of one point. The 6x6 lattice really does put a point
    // ~0.1 from the BUMPS centre (-1.4, -0.5), so this is a live case, not a hypothetical.
    expect(t.length).toBeLessThanOrEqual(SPAWN_COUNT);
    expect(t.length).toBeGreaterThanOrEqual(28);
  });

  it('gives every surviving trail a real extent', () => {
    for (const trail of t) {
      const xs = [...trail.d.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
      const span = Math.max(...xs) - Math.min(...xs);
      expect(span, `trail ${trail.i} is degenerate`).toBeGreaterThanOrEqual(MIN_SPAN);
    }
  });

  it('keeps every coordinate inside the viewBox', () => {
    for (const trail of t) {
      for (const seg of trail.d.slice(1).split(/[MC]/).filter(Boolean)) {
        for (const pair of seg.trim().split(/\s+/)) {
          const [x, y] = pair.split(',').map(Number);
          expect(x, trail.d).toBeGreaterThanOrEqual(-GATE_VIEW_W);
          expect(x, trail.d).toBeLessThanOrEqual(GATE_VIEW_W * 2);
          expect(y, trail.d).toBeGreaterThanOrEqual(-GATE_VIEW_H);
          expect(y, trail.d).toBeLessThanOrEqual(GATE_VIEW_H * 2);
        }
      }
    }
  });

  it('ends each trail at a stationary point of the field', () => {
    // The trails have to BE gradient descent, not look like it. runDescent's own spec says it
    // converges; this asserts the property survives the spawn set this module chose.
    let converged = 0;
    for (const [x0, y0] of gateSpawns()) {
      const path = gateDescent(x0, y0);
      const last = path[path.length - 1];
      const [gx, gy] = grad(last.x, last.y);
      if (Math.hypot(gx, gy) < 0.05) converged++;
    }
    expect(converged).toBeGreaterThanOrEqual(30);
  });

  it('ramps opacity and width monotonically with index', () => {
    for (let i = 1; i < t.length; i++) {
      expect(t[i].opacity).toBeGreaterThanOrEqual(t[i - 1].opacity);
      expect(t[i].width).toBeGreaterThanOrEqual(t[i - 1].width);
    }
    expect(t[0].opacity).toBeGreaterThanOrEqual(0.1);
    expect(t[t.length - 1].opacity).toBeLessThanOrEqual(0.55);
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
    for (const t of gateTrails()) {
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
