// tests/gateRefPaths.test.ts
// Fidelity tests for the ported 21st.dev BackgroundPaths geometry. This is a TRANSCRIPTION, so the thing worth
// asserting is not that the curves are nice — it is that they are byte-for-byte what the source produces. The
// two properties below are also the two I personally got wrong while reading it, which is why they are pinned
// rather than trusted.
import { describe, expect, it } from 'vitest';
import {
  GATE_COUNT,
  REF_COUNT,
  REF_POSITIONS,
  REF_STROKE_SCALE,
  REF_VIEW_H,
  REF_VIEW_W,
  REF_WIDTH_SPREAD,
  REF_PAN_X,
  REF_ZOOM,
  refFamily,
  refTrails,
  refViewBox,
  widthWobble,
} from '../src/lib/gateRefPaths';

describe('refFamily — transcribed exactly', () => {
  it('reproduces the source d-string for i = 0', () => {
    // Hand-expanded from the original template literal at i = 0, position = 1:
    //   M-${380-0} -${189+0}C-${380-0} -${189+0} -${312-0} ${216-0} ${152-0} ${343-0}
    //   C${616-0} ${470-0} ${684-0} ${875-0} ${684-0} ${875-0}
    expect(refFamily(1)[0].d).toBe('M-380 -189C-380 -189 -312 216 152 343C616 470 684 875 684 875');
  });

  it('reproduces the source d-string for i = 1, where the sign trap lives', () => {
    // The leading minus in `M-${380 - i*5*position}` negates the WHOLE bracket. At i = 1 that is -(380-5) =
    // -375, NOT -380-5 = -385. Reading it the other way turns the family from converging into translating,
    // which is the single most important thing about this drawing.
    expect(refFamily(1)[1].d).toBe('M-375 -195C-375 -195 -307 210 147 337C611 464 679 869 679 869');
  });

  it('mirrors on position', () => {
    expect(refFamily(-1)[1].d).toBe('M-385 -195C-385 -195 -317 210 157 337C621 464 689 869 689 869');
  });

  it('CONVERGES: the left end moves right while the right end moves left', () => {
    // The property, stated as a test because prose about it has been wrong twice. As i grows the start x
    // increases and the end x decreases, so successive curves squeeze inward rather than translating.
    const F = refFamily(1);
    const startX = (d: string) => Number(/^M(-?\d+)/.exec(d)![1]);
    const endX = (d: string) => Number(/C[^C]*$/.exec(d)![0].trim().split(/\s+/).slice(-2)[0].replace('C', ''));
    for (let i = 1; i < F.length; i++) {
      expect(startX(F[i].d), `start x at ${i}`).toBeGreaterThan(startX(F[i - 1].d));
      expect(endX(F[i].d), `end x at ${i}`).toBeLessThan(endX(F[i - 1].d));
    }
  });

  it('rises by 6px per curve', () => {
    const F = refFamily(1);
    const startY = (d: string) => Number(/^M-?\d+ (-?\d+)/.exec(d)![1]);
    for (let i = 1; i < F.length; i++) {
      expect(startY(F[i].d) - startY(F[i - 1].d)).toBe(-6);
    }
  });

  it('ramps opacity 0.1 -> 1.0 and CLAMPS, because the source overshoots', () => {
    const F = refFamily(1);
    expect(F[0].opacity).toBeCloseTo(0.1, 3);
    // 0.1 + 35*0.03 = 1.15 in the source. An SVG stroke-opacity above 1 is invalid.
    expect(F[F.length - 1].opacity).toBe(1);
    for (let i = 1; i < F.length; i++) {
      expect(F[i].opacity).toBeGreaterThanOrEqual(F[i - 1].opacity);
    }
  });

  it('SMOOTHING removes the corner the source has at every join but the first', () => {
    // The source joins two cubics at (152-dx, 343-dy). The tangent arriving is (464-2dx, 127) and the tangent
    // leaving is (464, 127), so the join is only tangent-continuous at dx = 0 — every other curve has a visible
    // corner there, up to 32.8 degrees at i = 35 on the position = +1 side. That is the "i still see sharp edge
    // corners" report, and it is in the reference too.
    //
    // Read the kink straight out of the emitted d-string rather than recomputing it from the formula, so this
    // tests what actually ships.
    const kink = (d: string): number => {
      const n = d.replace(/[MC]/g, ' ').trim().split(/\s+/).map(Number);
      // M p0 | C c0 c1 join | C c2 c3 end  ->  flat list of x,y pairs
      const [, , , , c1x, c1y, jx, jy, c2x, c2y] = n;
      const inA = Math.atan2(jy - c1y, jx - c1x);
      const outA = Math.atan2(c2y - jy, c2x - jx);
      return Math.abs(((inA - outA) * 180) / Math.PI);
    };

    const raw = refFamily(1, REF_COUNT, false);
    const smooth = refFamily(1, REF_COUNT, true);
    const worstRaw = Math.max(...raw.map((t) => kink(t.d)));
    const worstSmooth = Math.max(...smooth.map((t) => kink(t.d)));

    expect(worstRaw, "the source's own corner should still be measurable in the faithful port").toBeGreaterThan(30);
    expect(worstSmooth, 'smoothing must leave the join tangent-continuous').toBeLessThan(0.5);

    // ...and it must do that WITHOUT moving the curve: same endpoints, so the family still converges the way
    // the whole drawing depends on. Reflecting one arm onto the other would have passed the test above while
    // swinging the long second cubic across the frame.
    for (let i = 0; i < raw.length; i++) {
      const ends = (d: string) => d.replace(/[MC]/g, ' ').trim().split(/\s+/).map(Number);
      const a = ends(raw[i].d), b = ends(smooth[i].d);
      expect([b[0], b[1]], `curve ${i} moved its start`).toEqual([a[0], a[1]]);
      expect([b[12], b[13]], `curve ${i} moved its end`).toEqual([a[12], a[13]]);
    }
  });

  it('a smaller count SUBSAMPLES the family rather than truncating it', () => {
    // "less lines" must not also mean a smaller, flatter drawing. Every per-curve number is indexed off i — the
    // 5i/6i offsets, the 0.1+0.03i opacity ramp, the 0.5+0.03i width ramp — so drawing the first 24 of 36 would
    // span two thirds of the spread and top out at 0.79 opacity. Spreading the indices keeps the full ramps and
    // the full footprint: the same picture, fewer strokes.
    const full = refFamily(1, REF_COUNT);
    const few = refFamily(1, GATE_COUNT);
    expect(few).toHaveLength(GATE_COUNT);
    expect(few[few.length - 1].opacity, 'the opacity ramp must still reach the top').toBe(full[full.length - 1].opacity);
    // NOT the last curve's width directly: REF_WIDTH_SPREAD wobbles each curve by index, so the 24th of 24
    // and the 36th of 36 are different curves of the ramp and legitimately differ. What must survive the
    // subsample is the ramp's REACH — the heavy end stays as heavy — so compare the top of each family with the
    // wobble's own tolerance.
    const top = (f: ReturnType<typeof refFamily>) => Math.max(...f.map((t) => t.width));
    expect(top(few) / top(full), 'the width ramp no longer reaches the top')
      .toBeGreaterThan(1 - REF_WIDTH_SPREAD);
    expect(few[0].d, 'the first curve is the same curve either way').toBe(full[0].d);

    const startY = (d: string) => Number(d.slice(1).split(/[C\s]/)[1]);
    expect(startY(few[few.length - 1].d), 'the last curve must land where the 36th does').toBeCloseTo(startY(full[full.length - 1].d), 1);
  });

  it('scales the WIDTHS down from the source, deliberately and by a stated factor', () => {
    // THE ONE PLACE THIS PORT IS NOT A TRANSCRIPTION, so it is asserted against the source values times the
    // factor rather than against literals — otherwise retuning the factor silently turns this into a test of
    // nothing. Why it deviates: `meet` scales the 696-wide viewBox by the viewport width, which is 1.72x in a
    // ~1200px demo container but 2.87x at 2000px. The source's authored 0.5-1.55 therefore renders as a
    // hairline where it was designed and as 1.4-4.4 CSS px on a real desktop — "lines are again too thick",
    // reported twice.
    const F = refFamily(1);

    // THE RAMP, with the wobble divided back out. Asserted against the source's own 0.5 and 1.55 times the
    // stated factor, so retuning REF_STROKE_SCALE by accident still fails while a deliberate change is a
    // one-line edit here.
    const ramp = (t: (typeof F)[number], idx: number) =>
      t.width / (1 + widthWobble(idx) * REF_WIDTH_SPREAD);
    expect(ramp(F[0], 0)).toBeCloseTo(0.5 * REF_STROKE_SCALE, 2);
    expect(ramp(F[F.length - 1], F.length - 1)).toBeCloseTo(1.55 * REF_STROKE_SCALE, 2);
    expect(REF_STROKE_SCALE, 'a scale above 1 would make them thicker than the source, never the intent')
      .toBeLessThanOrEqual(1);

    // NOT MONOTONE ANY MORE, AND THAT IS THE POINT. This loop used to assert every curve is wider than its
    // neighbour, which is exactly the smooth gradient the owner asked to break: "different lines may have
    // different thicknesses among them". So the assertion inverts — the ordering must be broken somewhere —
    // while the ramp's TREND, which is what carries depth, still has to hold across the family.
    let inversions = 0;
    for (let i = 1; i < F.length; i++) if (F[i].width < F[i - 1].width) inversions++;
    expect(inversions, 'the widths are still a smooth gradient; the per-curve wobble is gone').toBeGreaterThan(2);

    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const third = Math.floor(F.length / 3);
    expect(
      mean(F.slice(-third).map((t) => t.width)),
      'the ramp no longer trends upward, so the family has lost its depth',
    ).toBeGreaterThan(mean(F.slice(0, third).map((t) => t.width)) * 1.5);

    // And the wobble must stay a wobble: no curve may depart from its ramp value by more than the spread, or a
    // thin stroke could outweigh a heavy one and the ramp would stop reading as depth at all.
    for (let i = 0; i < F.length; i++) {
      const r = ramp(F[i], i);
      expect(Math.abs(F[i].width / r - 1), `curve ${i} departs from the ramp by more than the spread`)
        .toBeLessThanOrEqual(REF_WIDTH_SPREAD + 1e-6);
    }
  });
});

describe('refTrails — both families, as the component renders them', () => {
  const T = refTrails();

  it('is 72 paths: 36 per family, two families', () => {
    expect(REF_POSITIONS).toHaveLength(2);
    expect(T).toHaveLength(REF_COUNT * 2);
  });

  it('re-indexes 0..n-1 so a CSS stagger can key off i', () => {
    expect(T.map((t) => t.i)).toEqual(T.map((_t, i) => i));
  });

  it('is deterministic — the source used Math.random for timing and this does not', () => {
    // The original's per-path duration is `20 + Math.random() * 10`. The geometry never was random, and this
    // site forbids Math.random in a build-time drawing, so the port keeps the shapes and drops the jitter.
    expect(JSON.stringify(refTrails())).toBe(JSON.stringify(T));
  });

  it('keeps the source viewBox, without which the constants mean nothing', () => {
    expect([REF_VIEW_W, REF_VIEW_H]).toEqual([696, 316]);
  });

  it('runs well outside that viewBox on purpose', () => {
    // y spans -189..875 against a 316-tall box. Only the slice crossing the frame is seen, which is what makes
    // the curves read as long sweeps passing through rather than arcs that begin and end on screen. It is also
    // why the dash's travel has to be clipped — see visibleWindow.
    //
    // THIS READS ONLY THE Y COORDINATES, and that is the fix. It used to regex every number followed by
    // whitespace, x values included, so `min < 0` was satisfied by x = -555 from the mirrored family: the lower
    // bound passed no matter where the y values sat, which is precisely the condition it exists to forbid. The
    // old lookahead also skipped any number followed by `C`, so it was not reading the whole path either.
    const ys = T.flatMap((t) => {
      const n = t.d.replace(/[MC]/g, ' ').trim().split(/\s+/).map(Number);
      return n.filter((_, i) => i % 2 === 1);   // "x y" pairs, so y is every second value
    });
    expect(ys.every(Number.isFinite), 'the d-string stopped parsing as x/y pairs').toBe(true);
    expect(Math.min(...ys), 'no curve starts above the box').toBeLessThan(0);
    expect(Math.max(...ys), 'no curve ends below the box').toBeGreaterThan(REF_VIEW_H);
  });
});

describe('the zoom and the stroke scale, which are COUPLED and had no test at all', () => {
  // The owner's reference screenshot, which is the only external source of truth either number has.
  const REF_SHOT_W = 1467;
  const REF_SHOT_H = 958;
  // The window the site was measured in when the correction was derived.
  const WINDOW_W = 1990;

  /** `preserveAspectRatio="xMidYMid meet"`: fit the box inside the element, scaling by the tighter axis. */
  const meetScale = (vbW: number, vbH: number, w: number, h: number) => Math.min(w / vbW, h / vbH);

  it('puts the site at the reference screenshot\'s own apparent scale', () => {
    // The reference renders the source's 696-wide box into 1467x958, so `meet` scales it by 2.108x. Unzoomed,
    // a 1990px window scales the same box by 2.859x — the same geometry 1.357x bigger on screen, which is what
    // "zoomed out a bit compared to yours" was describing.
    const refScale = meetScale(REF_VIEW_W, REF_VIEW_H, REF_SHOT_W, REF_SHOT_H);
    const unzoomed = WINDOW_W / REF_VIEW_W;
    expect(unzoomed / refScale, 'the 1.357x discrepancy REF_ZOOM exists to cancel').toBeCloseTo(REF_ZOOM, 2);

    // And with the zoom applied, the site lands on the reference's scale.
    const vb = refViewBox().split(/\s+/).map(Number);
    expect(WINDOW_W / vb[2], 'the shipped viewBox no longer matches the reference scale').toBeCloseTo(refScale, 2);
  });

  it('widens the viewBox about its own CENTRE — the ZOOM must not slide the composition', () => {
    // Widening from the origin instead would shift every curve up and left by half the added size — the same
    // apparent scale, a different picture. That is what this guards, and it is tested at panX = 0 so the
    // deliberate pan below cannot mask an accidental slide introduced by the zoom.
    //
    // Tolerance is half a user unit, not a tenth, and that is a real finding rather than a loosened bound: the
    // viewBox is emitted rounded to one decimal (944.47 -> 944.5), so the centre lands at 348.05 against a true
    // 348. At the shipped 2.107x that is 0.1 CSS px of drift across the whole composition — far below a pixel,
    // and the alternative is emitting un-rounded coordinates to chase it.
    const [vx, vy, vw, vh] = refViewBox(REF_ZOOM, 0).split(/\s+/).map(Number);
    expect(vx + vw / 2, 'the viewBox centre moved in x').toBeCloseTo(REF_VIEW_W / 2, 0);
    expect(vy + vh / 2, 'the viewBox centre moved in y').toBeCloseTo(REF_VIEW_H / 2, 0);
    expect(vw / vh, 'the aspect changed, so `meet` will letterbox differently').toBeCloseTo(REF_VIEW_W / REF_VIEW_H, 3);
  });

  it('pans the WINDOW right, which moves the DRAWING left — and only in x', () => {
    // The owner's ask: "move the moving lines to the left a little bit." The sign is the easy thing to get
    // wrong, so it is asserted: a POSITIVE pan must INCREASE the viewBox's min-x, because moving the window
    // right over a fixed drawing shows the part further right, i.e. the drawing appears to move left.
    const [px, py, pw, ph] = refViewBox(REF_ZOOM, REF_PAN_X).split(/\s+/).map(Number);
    const [zx, zy, zw, zh] = refViewBox(REF_ZOOM, 0).split(/\s+/).map(Number);

    expect(REF_PAN_X, 'the pan is meant to be a nudge, not a recomposition').toBeLessThan(0.12);
    expect(REF_PAN_X).toBeGreaterThan(0);
    expect(px, 'a positive pan must move the window RIGHT (drawing left)').toBeGreaterThan(zx);
    // Precision 0 (within 0.5 user units), for the same reason the centring test above uses it: the viewBox
    // is emitted rounded to one decimal, so a DIFFERENCE of two separately-rounded coordinates carries up to
    // ±0.1 — measured here as 37.7 against a true 37.78. At the shipped 2.107x that is 0.2 CSS px.
    expect(px - zx, 'the shift is a fraction of the WIDTH, not a literal').toBeCloseTo(zw * REF_PAN_X, 0);

    // Nothing else may move. The pan must not touch the size, the aspect, or the vertical placement —
    // changing the size would change the apparent scale, which is REF_ZOOM's job and nothing else's.
    expect(pw, 'the pan changed the width, so it changed the apparent scale').toBeCloseTo(zw, 6);
    expect(ph, 'the pan changed the height').toBeCloseTo(zh, 6);
    expect(py, 'the pan moved the composition vertically').toBeCloseTo(zy, 6);
  });

  it('THEREFORE renders the source\'s authored widths at the reference\'s own CSS pixels', () => {
    // This is the assertion that makes the coupling explicit. REF_STROKE_SCALE is 1 — the widths are the
    // source's, unscaled — and that is only correct BECAUSE the zoom is right. Two earlier releases scaled the
    // widths (0.4, then 0.6) to compensate for a drawing that was simply too big; with the zoom fixed, scaling
    // them too would make them a third thinner than the reference. If someone retunes either dial alone, the
    // apparent widths leave the reference's band and this fails.
    const refScale = meetScale(REF_VIEW_W, REF_VIEW_H, REF_SHOT_W, REF_SHOT_H);
    const F = refFamily(1, GATE_COUNT, true);
    const vb = refViewBox().split(/\s+/).map(Number);
    const siteScale = WINDOW_W / vb[2];

    // A DELIBERATE DEPARTURE NOW, BY A STATED FACTOR. This used to assert the apparent widths land exactly on
    // the reference's 1.05-3.27 CSS px, and it failed the moment the owner asked for thinner strokes — which is
    // the test working. The comparison is kept rather than dropped, because the reference is still the anchor:
    // what is asserted is that the site renders at REF_STROKE_SCALE of the reference's weight, so the zoom and
    // the scale remain coupled and an accidental change to either still fails.
    //
    // The wobble is divided out so this measures the ramp rather than one arbitrary curve.
    const rampW = (t: (typeof F)[number], idx: number) =>
      t.width / (1 + widthWobble(idx) * REF_WIDTH_SPREAD);
    const thinnest = rampW(F[0], 0) * siteScale;
    const thickest = rampW(F[F.length - 1], F.length - 1) * siteScale;
    expect(thinnest).toBeCloseTo(0.5 * refScale * REF_STROKE_SCALE, 1);
    expect(thickest).toBeCloseTo(1.55 * refScale * REF_STROKE_SCALE, 1);
    // And stated absolutely, because a ratio alone would still pass if BOTH dials drifted together.
    expect(thinnest, 'the thin end is no longer the hairline it is meant to be').toBeGreaterThan(0.6);
    expect(thinnest).toBeLessThan(0.9);
    expect(thickest).toBeGreaterThan(2.0);
    expect(thickest).toBeLessThan(2.6);
    // AND THE WOBBLE MUST NOT PUSH THE HEAVIEST STROKE BACK UP. This is the regression that measurement caught:
    // a +30% wobble on a 0.8 scale took the maximum to 3.45px, above the 3.27 it was supposed to come down
    // from. The bound is on the widest stroke actually emitted, not on the ramp.
    const widest = Math.max(...F.map((t) => t.width)) * siteScale;
    expect(widest, 'the per-curve wobble has pushed the heaviest stroke above the old release')
      .toBeLessThan(3.0);
  });
});
