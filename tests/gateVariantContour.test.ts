// tests/gateVariantContour.test.ts
//
// THE GATE'S CONTOUR VARIANT. Like gatePaths.test.ts, these are the ONLY tests this code will ever get:
// everything in src/lib/gateVariants runs at build time and ships as static SVG markup, so there is no
// runtime to observe it in and no browser that will ever execute it.
//
// WHAT THESE TESTS ARE ACTUALLY FOR, which is unusual enough to say plainly: the picture cannot be looked at
// from here. The owner's verdict on the first version of the gate was "ur lines are horrible", and the three
// defects behind that verdict were each a measurable number — a 173.8-degree hairpin from uniform Catmull-Rom
// over 412.8x-uneven points, 36 trails piling into the field's 3 minima, and a 22x spread in trail length.
// So the numbers below are not incidental invariants over a design that was judged by eye. They ARE the
// judgement, standing in for an eye that cannot see the output: "combed" minus "tangled", expressed as four
// measurements (turn angle, length ratio, coverage, busiest-cell share). If one of them regresses the picture
// is horrible again, whatever the diff looked like.
import { describe, expect, it } from 'vitest';
import { GATE_VIEW_H, GATE_VIEW_W, type Pt } from '../src/lib/gatePaths';
import { LABEL, NOTE, isoCurves, trails } from '../src/lib/gateVariants/contour';
import { RANGE, field } from '../src/lib/terrain';

/** Every coordinate pair in a path, Bézier control points included. */
const coords = (d: string): Pt[] =>
  [...d.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) }));

/**
 * The KNOTS of a path — the sampled points the curve was built from, without the control points.
 *
 * catmullRomPath emits `M p0` then one `C c1 c2 p` per segment, so the knots are index 0 and then every
 * third coordinate. The distinction matters for the curvature test, which measures both: the knot polyline is
 * "the polyline implied by the points", and the full coordinate list is what gatePaths.test.ts measures. The
 * second is the looser of the two here (a centripetal control point sits ~1/3 of a chord along the tangent,
 * so it cuts corners rather than adding them), but it is the one that would catch a Catmull-Rom overshoot, so
 * both are asserted.
 */
const knots = (d: string): Pt[] => {
  const all = coords(d);
  const out = all.slice(0, 1);
  for (let i = 3; i < all.length; i += 3) out.push(all[i]);
  return out;
};

const worstTurnDeg = (pts: readonly Pt[]): number => {
  let worst = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const ax = pts[i].x - pts[i - 1].x, ay = pts[i].y - pts[i - 1].y;
    const bx = pts[i + 1].x - pts[i].x, by = pts[i + 1].y - pts[i].y;
    const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
    if (la < 1e-9 || lb < 1e-9) continue;
    const cos = Math.max(-1, Math.min(1, (ax * bx + ay * by) / (la * lb)));
    worst = Math.max(worst, (Math.acos(cos) * 180) / Math.PI);
  }
  return worst;
};

const arcLength = (pts: readonly Pt[]): number => {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return s;
};

const T = trails();

describe('contour variant — the metadata a switcher needs', () => {
  it('ships a label and a one-sentence note saying what the lines are', () => {
    expect(LABEL.length).toBeGreaterThan(0);
    expect(LABEL.length).toBeLessThan(24);           // a switcher chip, not a sentence
    expect(NOTE).toMatch(/level set/i);
  });

  it('numbers the trails 0..n-1 in draw order', () => {
    // The gate's CSS stagger keys off `i`, so a gap or a repeat silently desynchronises the animation.
    expect(T.map((t) => t.i)).toEqual(T.map((_t, i) => i));
  });
});

describe('contour variant — these really are level sets of field()', () => {
  // THE ONE CLAIM THAT MATTERS MATHEMATICALLY, and the reason the knot is gone. Level sets of a function
  // cannot cross: f = a and f = b with a != b share no point, and one level's components are disjoint. That
  // is a theorem, so it holds without tuning — unlike the descent version, where convergence into three
  // minima was inherent and no smoothing could have removed it.
  //
  // It has to be checked in WORLD space, before projection, which is why isoCurves is exported: trails()
  // returns screen coordinates and this camera is not cheaply invertible (screen y mixes world y with
  // field(x, y) itself).
  const level = -0.3;
  const curves = isoCurves(level);

  it('puts every vertex on the requested iso-height, to the grid error', () => {
    // Marching squares places a vertex by LINEAR interpolation along a cell edge, so field() at that vertex
    // differs from the level by the field's curvature over one cell: O(h^2) with h = 2*RANGE/256 = 0.0203,
    // and |f''| of this Gaussian mixture is order 1-3. Measured worst deviation at this level is 7.9e-5, so
    // 2e-3 is a bound that would still catch a real error (a wrong edge, a wrong interpolation sign) by more
    // than an order of magnitude while never tripping on the method's own error.
    let worst = 0;
    for (const c of curves) for (const p of c) worst = Math.max(worst, Math.abs(field(p.x, p.y) - level));
    expect(worst, `worst |field - level| = ${worst.toExponential(2)}`).toBeLessThan(2e-3);
  });

  it('chains the segments instead of returning a pile of 2-point fragments', () => {
    // THE CLASSIC MARCHING-SQUARES MISTAKE, and it is invisible in the output type: unchained output is
    // hundreds of disconnected 2-point segments which draw as static rather than as contours. A chained
    // level set of a smooth field on a 256 grid is hundreds of points long, so the mean length is the tell:
    // at level -0.3 this is exactly 2 components, of 540 and 282 points (mean 411). Unchained it would be
    // ~411 components of 2.
    const mean = curves.reduce((s, c) => s + c.length, 0) / curves.length;
    expect(curves.length, 'no curves at all').toBeGreaterThan(0);
    expect(curves.length, `${curves.length} fragments — looks unchained`).toBeLessThan(20);
    expect(mean, `mean chain length ${mean.toFixed(1)}`).toBeGreaterThan(50);
  });

  it('keeps every world vertex inside the RANGE square it was sampled over', () => {
    for (const c of curves) for (const p of c) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(RANGE);
      expect(Math.abs(p.y)).toBeLessThanOrEqual(RANGE);
    }
  });
});

describe('contour variant — determinism, because the site forbids a picture that shimmers', () => {
  it('is byte-identical across calls', () => {
    // Same rule as the Rules slide's seeded fan and gatePaths' hash01: a build-time image that differs
    // between two builds of identical content is a defect, not a flourish. Nothing here touches
    // Math.random(); the only ordering risk is Map iteration, which is insertion order, which is the i/j
    // grid scan.
    expect(JSON.stringify(trails())).toBe(JSON.stringify(T));
  });

  it('is byte-identical at a different viewBox too', () => {
    expect(JSON.stringify(trails(600, 400))).toBe(JSON.stringify(trails(600, 400)));
  });

  it('emits no NaN or Infinity', () => {
    // Three real division-by-zero sites feed this: the marching-squares edge interpolation (b - a), the
    // arc-length resampler (segment length), and catmullRomPath's centripetal knot spacing. All three are
    // guarded; this is the end-to-end proof that none leaked.
    for (const t of T) expect(t.d, `trail ${t.i}`).not.toMatch(/NaN|Infinity/);
  });
});

describe('contour variant — the comb metrics', () => {
  it('ships 24 to 48 strokes', () => {
    // Measured: 38, from 8 iso-levels. Too few reads as a sparse scratch, too many as hatching.
    expect(T.length).toBeGreaterThanOrEqual(24);
    expect(T.length).toBeLessThanOrEqual(48);
  });

  it('bounds the turning angle well under a hairpin — on the knots AND on the control points', () => {
    // THE DEFECT THIS REPLACES: 173.8 degrees, from uniform Catmull-Rom over points whose spacing varied
    // 412.8x within one trail. Centripetal parameterisation brought the descent version to 76.6; this one
    // measures 32.3 on the knots and 19.3 including control points, because a level set of a smooth field
    // has no reason to bend sharply except where it squeezes past a saddle — and MAX_TURN drops those four
    // strokes (they measured 44, 47, 49, 54 against a next-worst of 32, a clean gap).
    //
    // BE HONEST ABOUT WHAT SETS THIS NUMBER: the angle between two chords of length s on a curve of radius r
    // is about s/r, so the module's 16px resample step is a multiplier on everything measured here. The same
    // geometry sampled at 30px reports 71.1. The scale-free restatement is that the tightest bend in the
    // shipped set has a radius of ~29px in a 1200x800 frame, which is a gentle curve.
    let worstKnots = 0, worstAll = 0;
    for (const t of T) {
      worstKnots = Math.max(worstKnots, worstTurnDeg(knots(t.d)));
      worstAll = Math.max(worstAll, worstTurnDeg(coords(t.d)));
    }
    expect(worstKnots, `worst knot turn ${worstKnots.toFixed(1)} deg`).toBeLessThan(60);
    expect(worstAll, `worst turn incl. control points ${worstAll.toFixed(1)} deg`).toBeLessThan(60);
  });

  it('keeps the longest stroke under 3x the shortest', () => {
    // THE DEFECT THIS REPLACES: 22x (40px to 865px), which is why a few giant swoops dominated tiny stubs.
    // Here: 1.70 (256px to 436px). Two mechanisms, and the second one needs declaring —
    //   * MIN_RUN drops fragments under 205px as noise, which sets the floor;
    //   * a run longer than ~1.5x TARGET is CUT into several strokes, which sets the ceiling.
    // Cutting could be pure metric-gaming: three pieces re-joined seamlessly still read as one 900px line
    // while measuring as three 300px ones. It is not, because the module trims 16px off each side of every
    // break, so the pieces are genuinely separate strokes with real whitespace between them — the number
    // measured here is the number a reader sees. That is a deliberate design choice (a topo map breaks its
    // contours), not a free pass, and it is the one place this variant composes rather than reports.
    const lens = T.map((t) => arcLength(knots(t.d))).sort((a, b) => a - b);
    const ratio = lens[lens.length - 1] / lens[0];
    expect(ratio, `length ratio ${ratio.toFixed(2)} (${lens[0].toFixed(0)}..${lens[lens.length - 1].toFixed(0)}px)`)
      .toBeLessThan(3.0);
  });

  it('fills the frame rather than clustering', () => {
    // Measured 1.00 x 0.94 of the viewBox. Clustering is the failure this catches: a level-selection change
    // that picked only levels near one Gaussian would still pass every other metric here while drawing a
    // blob in one corner.
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const t of T) for (const p of coords(t.d)) {
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x);
      y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
    }
    expect((x1 - x0) / GATE_VIEW_W, `width coverage ${((x1 - x0) / GATE_VIEW_W).toFixed(3)}`)
      .toBeGreaterThanOrEqual(0.70);
    expect((y1 - y0) / GATE_VIEW_H, `height coverage ${((y1 - y0) / GATE_VIEW_H).toFixed(3)}`)
      .toBeGreaterThanOrEqual(0.50);
  });

  it('has no knot — no 20x20 cell holds points from more than 40% of the strokes', () => {
    // THE ASSERTION THAT IS THE POINT OF THE EXERCISE. The descent version failed it structurally: every
    // run on this field ends at one of 3 minima, so 36 trails terminated inside 3 cells and the middle of
    // the frame was a crossing at every angle. Measured here: the busiest 60x40px cell holds points from 6
    // of 38 strokes, a share of 0.158 against the 0.40 bar.
    const cells = new Map<string, Set<number>>();
    for (const t of T) for (const p of coords(t.d)) {
      const cx = Math.min(19, Math.max(0, Math.floor((p.x / GATE_VIEW_W) * 20)));
      const cy = Math.min(19, Math.max(0, Math.floor((p.y / GATE_VIEW_H) * 20)));
      const key = `${cx},${cy}`;
      const seen = cells.get(key);
      if (seen) seen.add(t.i); else cells.set(key, new Set([t.i]));
    }
    let worst = 0, where = '';
    for (const [key, seen] of cells) if (seen.size > worst) { worst = seen.size; where = key; }
    expect(worst / T.length, `cell ${where} holds ${worst}/${T.length} strokes`).toBeLessThan(0.40);
  });

  it('stays inside the viewBox', () => {
    // DEFECT 3's OTHER HALF. The gate's SVG uses preserveAspectRatio="xMidYMid slice", so a stroke with
    // coordinates outside the 1200x800 box does not get scaled down — it gets cropped, which draws as a line
    // leaving the frame and re-entering from nowhere. 19 of the descent version's 36 trails did that. The
    // module clips to the box in screen space, so this is 0 by construction, and that construction is what
    // this pins.
    for (const t of T) for (const p of coords(t.d)) {
      expect(p.x, `trail ${t.i} x`).toBeGreaterThanOrEqual(0);
      expect(p.x, `trail ${t.i} x`).toBeLessThanOrEqual(GATE_VIEW_W);
      expect(p.y, `trail ${t.i} y`).toBeGreaterThanOrEqual(0);
      expect(p.y, `trail ${t.i} y`).toBeLessThanOrEqual(GATE_VIEW_H);
    }
  });

  it('clips to the viewBox it was ASKED for, not to the default', () => {
    // The w/h parameters flow into project() AND into the clip, and it would be easy to wire one and not the
    // other — the symptom would be a gate that looks right at 1200x800 and loses half its strokes anywhere
    // else.
    for (const t of trails(600, 400)) for (const p of coords(t.d)) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(600);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(400);
    }
  });
});

describe('contour variant — crossings, measured honestly', () => {
  // THE WEAKNESS, PINNED RATHER THAN HIDDEN. "Level sets cannot cross" is a statement about the WORLD, and
  // what ships is a PROJECTION of the world through the hero's tilted camera — which is not injective. Where
  // the surface folds toward the viewer, a far contour passes behind a near ridge and the two overlap on
  // screen. Measured: 35 crossings among 38 strokes, and every one of them is a DIFFERENT pair crossing
  // exactly once. That is the signature of occlusion, not of a tangle: a tangle is two curves weaving
  // repeatedly through each other, and the busiest-cell metric above (0.158) says nothing piles up anywhere.
  //
  // This is not fixed, and fixing it would mean hidden-surface removal against a depth buffer — which the
  // hero's own terrain does not do either (it paints every dot, occluded or not), so a contour map that
  // overlaps where the surface folds is consistent with what it dissolves into.
  const seg = (d: string): Array<[Pt, Pt]> => {
    const k = knots(d);
    const out: Array<[Pt, Pt]> = [];
    for (let i = 1; i < k.length; i++) out.push([k[i - 1], k[i]]);
    return out;
  };
  const side = (a: Pt, b: Pt, c: Pt): number => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const crosses = (p: Pt, p2: Pt, q: Pt, q2: Pt): boolean =>
    side(p, p2, q) > 0 !== side(p, p2, q2) > 0 && side(q, q2, p) > 0 !== side(q, q2, p2) > 0;

  it('crosses only as occlusion does: at most once per pair of strokes', () => {
    const segs = T.map((t) => seg(t.d));
    let total = 0;
    const pairs = new Set<string>();
    for (let a = 0; a < segs.length; a++) {
      for (let b = a + 1; b < segs.length; b++) {
        for (const s1 of segs[a]) for (const s2 of segs[b]) {
          if (crosses(s1[0], s1[1], s2[0], s2[1])) { total++; pairs.add(`${a}x${b}`); }
        }
      }
    }
    expect(total, `${total} crossings over ${pairs.size} pairs — a pair weaving means a tangle`)
      .toBe(pairs.size);
    // A loose ceiling, not the measured 35: this is here so a change that turns the picture back into a mesh
    // goes red, without pinning a number that honest re-tuning would move.
    expect(total).toBeLessThan(T.length * 2);
  });
});

describe('contour variant — the opacity and width envelopes', () => {
  it('stays inside the gate\'s ramps', () => {
    for (const t of T) {
      expect(t.opacity).toBeGreaterThanOrEqual(0.10);
      expect(t.opacity).toBeLessThanOrEqual(0.55);
      expect(t.width).toBeGreaterThanOrEqual(0.5);
      expect(t.width).toBeLessThanOrEqual(1.6);
    }
  });

  it('ramps by iso-height, so strokes cut from one contour share a weight', () => {
    // gatePaths ramps PER TRAIL because each of its trails is a whole curve. Here several strokes are pieces
    // of one ring, and a per-stroke ramp would put a visible brightness step in the middle of a contour — so
    // the ramp is keyed to the level. Non-decreasing (not strictly increasing) is therefore the right
    // assertion, and the repeats are the feature.
    for (let i = 1; i < T.length; i++) {
      expect(T[i].opacity).toBeGreaterThanOrEqual(T[i - 1].opacity);
      expect(T[i].width).toBeGreaterThanOrEqual(T[i - 1].width);
    }
    expect(new Set(T.map((t) => t.opacity)).size, 'every stroke has its own opacity — not keyed to the level')
      .toBeLessThan(T.length);
  });
});
