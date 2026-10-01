// tests/gateVariantComb.test.ts
//
// The `comb` gate variant. Like gatePaths, every line of this runs at BUILD time, so these tests are the only
// thing that will ever observe this code — there is no runtime to watch it in, and nobody can see an SVG from
// a terminal. So the assertions below are not sanity checks around a picture somebody looked at; they ARE the
// description of the picture. Each one names the defect it is standing guard over, because the brief was a
// list of measured defects in the descent version ("ur lines are horrible") and a passing suite is the only
// claim this module can make that they are gone.
//
// The shipped numbers, for whoever reads a failure here: 30 trails, worst turning angle 12.7 degrees, length
// ratio 1.003, coverage 100% x 100%, busiest cell 10.0%, zero crossings between any two strokes.
import { describe, expect, it } from 'vitest';
import { LABEL, NOTE, trails } from '../src/lib/gateVariants/comb';
import { GATE_VIEW_H, GATE_VIEW_W } from '../src/lib/gatePaths';
import { RANGE, grad } from '../src/lib/terrain';

/**
 * Every coordinate pair in a path, knots AND Bézier control points.
 *
 * Reading the control points too is deliberate rather than lazy: a cubic is contained in the convex hull of
 * its four control points, so a polyline through the control polygon turns at least as sharply as the drawn
 * curve does and reaches at least as far. Every geometric assertion below is therefore conservative — it can
 * fail on a curve that is actually fine, but it cannot pass a curve that is not. (It is also exactly how
 * tests/gatePaths.test.ts measures the shipped descent trails, so the numbers are comparable.)
 */
const coords = (d: string): Array<{ x: number; y: number }> =>
  [...d.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) }));

const T = trails();
const PTS = T.map((t) => coords(t.d));

/** Turning angle, in degrees, between consecutive chords of a polyline. 0 = straight on, 180 = a hairpin. */
function worstTurn(pts: Array<{ x: number; y: number }>): number {
  let worst = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const a = { x: pts[i].x - pts[i - 1].x, y: pts[i].y - pts[i - 1].y };
    const b = { x: pts[i + 1].x - pts[i].x, y: pts[i + 1].y - pts[i].y };
    const la = Math.hypot(a.x, a.y), lb = Math.hypot(b.x, b.y);
    // A zero-length chord has no direction, so it has no angle to contribute. Centripetal Catmull-Rom emits
    // these at a knot whose neighbours coincide; skipping them is not hiding anything.
    if (la < 1e-9 || lb < 1e-9) continue;
    const cos = Math.max(-1, Math.min(1, (a.x * b.x + a.y * b.y) / (la * lb)));
    worst = Math.max(worst, (Math.acos(cos) * 180) / Math.PI);
  }
  return worst;
}

const polylineLength = (pts: Array<{ x: number; y: number }>): number =>
  pts.reduce((sum, p, i) => (i === 0 ? 0 : sum + Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y)), 0);

describe('comb — the module contract', () => {
  it('exports a label and a one-sentence note', () => {
    // These two are what a switcher UI shows next to the variant, so an empty string is a real defect: the
    // owner is choosing between variants by looking, and the note is the only place the MATH is stated.
    expect(LABEL.length).toBeGreaterThan(3);
    expect(NOTE.length).toBeGreaterThan(40);
  });

  it('ships 24 to 48 trails, indexed 0..n-1 in draw order', () => {
    // The index is not decoration: Gate.astro keys its CSS draw-in stagger off it, so a gap or a repeat
    // would stall or double up one stroke's animation.
    expect(T.length).toBeGreaterThanOrEqual(24);
    expect(T.length).toBeLessThanOrEqual(48);
    expect(T.map((t) => t.i)).toEqual(T.map((_t, i) => i));
  });

  it('ramps opacity and width monotonically, inside the shipped bands', () => {
    for (let i = 1; i < T.length; i++) {
      expect(T[i].opacity).toBeGreaterThanOrEqual(T[i - 1].opacity);
      expect(T[i].width).toBeGreaterThanOrEqual(T[i - 1].width);
    }
    expect(T[0].opacity).toBeGreaterThanOrEqual(0.1);
    expect(T[T.length - 1].opacity).toBeLessThanOrEqual(0.55);
    expect(T[0].width).toBeGreaterThanOrEqual(0.5);
    expect(T[T.length - 1].width).toBeLessThanOrEqual(1.6);
  });

  it('is byte-identical across calls (the determinism rule)', () => {
    // The site's standing rule, stated on the Rules slide's seeded fan: "a fan that shimmered between builds
    // would undercut a slide whose whole claim is that the scale is real". There is no Math.random() in this
    // module and no hash either — the only variation between strokes is the field's.
    expect(JSON.stringify(trails())).toBe(JSON.stringify(T));
  });

  it('never emits NaN or Infinity', () => {
    // The walk divides by |perp(grad g)| every step. The whole reason TILT sits above max|grad field| is that
    // this divisor then has a positive floor; if that bound were ever lost, this is where it would surface.
    for (const t of T) expect(t.d, `trail ${t.i}`).not.toMatch(/NaN|Infinity/);
    for (const p of PTS) for (const q of p) {
      expect(Number.isFinite(q.x) && Number.isFinite(q.y)).toBe(true);
    }
  });

  it('scales to a viewBox it was not tuned at', () => {
    // The band geometry is written in terms of w and h, and `project` scales with min(w, h). A portrait
    // viewBox is the case most likely to expose a hardcoded 1200 or 800.
    const tall = trails(900, 1400);
    expect(tall).toHaveLength(T.length);
    for (const t of tall) expect(t.d).not.toMatch(/NaN|Infinity/);
    // Different viewBox, different geometry — otherwise the arguments are being ignored.
    expect(tall[0].d).not.toBe(T[0].d);
  });
});

describe('comb — the comb metrics, which are the design', () => {
  it('bounds the worst turning angle under 60 degrees', () => {
    // THE NUMBER THIS REPLACES. The descent trails measure 76.6 degrees on this same metric (and measured
    // 173.8 before catmullRomPath went centripetal). A comb cannot have corners in it, so the bar is 60 and
    // the shipped set measures 12.7 — the margin is wide on purpose, because the turning angle is the one
    // metric that a change to TILT or KNOTS moves a lot (10 knots alone takes it to 16.3).
    const worst = Math.max(...PTS.map(worstTurn));
    expect(worst, `worst turn ${worst.toFixed(1)} deg`).toBeLessThan(60);
  });

  it('keeps the longest trail within 3x the shortest', () => {
    // THE RHYTHM. The descent set runs 41px to 867px — a 21x spread, which is why a few giant swoops read as
    // the picture and the rest as lint. Here every stroke is cut at the same SCREEN arc length, so the ratio
    // is 1.003 and the residue is only where the last Euler step overshoots the cut.
    const lens = PTS.map(polylineLength);
    const ratio = Math.max(...lens) / Math.min(...lens);
    expect(ratio, `length ratio ${ratio.toFixed(2)} (${Math.min(...lens).toFixed(0)}-${Math.max(...lens).toFixed(0)}px)`)
      .toBeLessThan(3);
  });

  it('fills at least 70% of the viewBox width and 50% of its height', () => {
    // Clipped to the viewBox before measuring, so a stroke that wanders far off-frame cannot buy coverage it
    // does not deliver on screen. The shipped set measures 100% x 100%.
    const all = PTS.flat();
    const xs = all.map((p) => p.x), ys = all.map((p) => p.y);
    const w = (Math.min(GATE_VIEW_W, Math.max(...xs)) - Math.max(0, Math.min(...xs))) / GATE_VIEW_W;
    const h = (Math.min(GATE_VIEW_H, Math.max(...ys)) - Math.max(0, Math.min(...ys))) / GATE_VIEW_H;
    expect(w, `width coverage ${(w * 100).toFixed(0)}%`).toBeGreaterThanOrEqual(0.7);
    expect(h, `height coverage ${(h * 100).toFixed(0)}%`).toBeGreaterThanOrEqual(0.5);
  });

  it('puts no more than 40% of the trails through any one 20x20 cell', () => {
    // THE KNOT ASSERTION, and the reason this variant exists. On a 20x20 grid the cells are 60x40px. The
    // descent set fails this outright: its cell (6,6), where two basins project close together, holds points
    // from 20 of its 36 trails (55.6%). This set's busiest cell holds 3 of 30 (10.0%), which is about what
    // you would expect from geometry alone — a 60x40 cell is 47px deep measured across the comb's axis and
    // the strokes are 28.5px apart, so two or three of them crossing one cell is the floor, not a pile-up.
    const cells = new Map<string, Set<number>>();
    PTS.forEach((pts, i) => {
      for (const p of pts) {
        const cx = Math.floor((p.x / GATE_VIEW_W) * 20), cy = Math.floor((p.y / GATE_VIEW_H) * 20);
        if (cx < 0 || cx > 19 || cy < 0 || cy > 19) continue;  // off-frame points are not in any cell
        const key = `${cx},${cy}`;
        const seen = cells.get(key) ?? new Set<number>();
        seen.add(i);
        cells.set(key, seen);
      }
    });
    let worst = 0, where = '';
    for (const [key, seen] of cells) if (seen.size > worst) { worst = seen.size; where = key; }
    expect(worst / T.length, `cell ${where} holds ${worst}/${T.length} trails`).toBeLessThanOrEqual(0.4);
  });
});

describe('comb — the no-knot guarantee, in both halves', () => {
  // The cell test above measures the SYMPTOM. These two pin the cause, so that a future tweak to TILT or to
  // BUMPS reports which half it broke instead of just "the picture got worse".
  //
  // The lines are level sets of g = field + TILT * (n . p). If grad g never vanishes, g has no critical
  // point; a function with no critical point has no closed level sets and no level sets that meet. The
  // hypothesis is checkable numerically, and so is the conclusion.

  it('keeps grad g away from zero over the whole footprint (the hypothesis)', () => {
    // grad g = grad field + TILT * n with |n| = 1, so |grad g| >= TILT - max|grad field|. The maximum is
    // 1.8668, at (-0.82, 0.14) — on the flank of the deep valley, where a Gaussian's slope peaks at r = s.
    // TILT is 2.6, a 1.39x margin, so the floor is 0.73. This grid is deliberately finer than any sampling
    // the drawing does, so it cannot miss a spike the walk would find.
    let maxGrad = 0;
    for (let i = 0; i <= 400; i++) {
      for (let j = 0; j <= 400; j++) {
        const x = -RANGE + (2 * RANGE * i) / 400;
        const y = -RANGE + (2 * RANGE * j) / 400;
        const [gx, gy] = grad(x, y);
        maxGrad = Math.max(maxGrad, Math.hypot(gx, gy));
      }
    }
    expect(maxGrad).toBeCloseTo(1.8668, 3);
    // 2.6 is the TILT the module uses. It is not exported — a constant a test has to import to assert on is
    // a constant that gets changed to make the test pass — so this asserts the BOUND the module relies on.
    expect(maxGrad, `TILT 2.6 must stay above max|grad field| = ${maxGrad.toFixed(4)}`).toBeLessThan(2.6);
  });

  it('never doubles back along the comb axis (the conclusion, per stroke)', () => {
    // The pair test below cannot see a stroke that turns around inside ITSELF, and that is precisely the shape
    // a too-small TILT produces: once grad g can vanish, a level set may close into a loop and the stroke comes
    // back the way it went. So: project every knot onto the comb's axis (7 degrees below horizontal) and
    // require the projection to increase. It does, by 31.8px at worst between consecutive path coordinates,
    // because the axis component of perp(grad g) stays positive while TILT dominates.
    //
    // This is also the one assertion that would catch somebody lowering TILT past the bound. The module does
    // not export it — a constant a test imports is a constant that gets edited to make the test pass — so the
    // guarantee is pinned through its consequences instead.
    const cos = Math.cos((7 * Math.PI) / 180), sin = Math.sin((7 * Math.PI) / 180);
    for (const [t, pts] of PTS.entries()) {
      const along = pts.map((p) => p.x * cos + p.y * sin);
      for (let i = 1; i < along.length; i++) {
        expect(along[i], `trail ${t} doubled back at point ${i}`).toBeGreaterThan(along[i - 1]);
      }
    }
  });

  it('draws no crossing between any two strokes (the conclusion)', () => {
    // Exhaustive segment-vs-segment over all 435 pairs of trails. This is the strongest possible form of
    // "no knot": not "they are spread out" but "they never touch". It survives projection because the lines
    // are drawn on the camera's ground plane, where project() is affine — a fold (z = field) would let two
    // non-intersecting world curves cross on screen, which is exactly what the measured raster showed and
    // exactly why the lines sit on the plane.
    const side = (
      a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number },
    ): number => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    const crosses = (
      p: { x: number; y: number }, q: { x: number; y: number },
      r: { x: number; y: number }, s: { x: number; y: number },
    ): boolean => side(r, s, p) > 0 !== side(r, s, q) > 0 && side(p, q, r) > 0 !== side(p, q, s) > 0;

    const hits: string[] = [];
    for (let a = 0; a < PTS.length; a++) {
      for (let b = a + 1; b < PTS.length; b++) {
        for (let i = 1; i < PTS[a].length; i++) {
          for (let j = 1; j < PTS[b].length; j++) {
            if (crosses(PTS[a][i - 1], PTS[a][i], PTS[b][j - 1], PTS[b][j])) hits.push(`${a}x${b}`);
          }
        }
      }
    }
    expect(hits.slice(0, 8), `${hits.length} crossings`).toEqual([]);
  });
});
