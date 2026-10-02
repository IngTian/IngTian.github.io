// tests/gateRefPaths.test.ts
// Fidelity tests for the ported 21st.dev BackgroundPaths geometry. This is a TRANSCRIPTION, so the thing worth
// asserting is not that the curves are nice — it is that they are byte-for-byte what the source produces. The
// two properties below are also the two I personally got wrong while reading it, which is why they are pinned
// rather than trusted.
import { describe, expect, it } from 'vitest';
import {
  REF_COUNT, REF_POSITIONS, REF_STROKE_SCALE, REF_VIEW_H, REF_VIEW_W, refFamily, refTrails,
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

  it('scales the WIDTHS down from the source, deliberately and by a stated factor', () => {
    // THE ONE PLACE THIS PORT IS NOT A TRANSCRIPTION, so it is asserted against the source values times the
    // factor rather than against literals — otherwise retuning the factor silently turns this into a test of
    // nothing. Why it deviates: `meet` scales the 696-wide viewBox by the viewport width, which is 1.72x in a
    // ~1200px demo container but 2.87x at 2000px. The source's authored 0.5-1.55 therefore renders as a
    // hairline where it was designed and as 1.4-4.4 CSS px on a real desktop — "lines are again too thick",
    // reported twice.
    const F = refFamily(1);
    expect(F[0].width).toBeCloseTo(0.5 * REF_STROKE_SCALE, 3);
    expect(F[F.length - 1].width).toBeCloseTo(1.55 * REF_STROKE_SCALE, 3);
    expect(REF_STROKE_SCALE, 'a scale above 1 would make them thicker than the source, never the intent')
      .toBeLessThanOrEqual(1);
    for (let i = 1; i < F.length; i++) {
      expect(F[i].width).toBeGreaterThan(F[i - 1].width);
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
    // the curves read as long sweeps passing through rather than arcs that begin and end on screen.
    const ys = T.flatMap((t) => [...t.d.matchAll(/-?\d+(?=\s|$)/g)].map((m) => Number(m[0])));
    expect(Math.min(...ys)).toBeLessThan(0);
    expect(Math.max(...ys)).toBeGreaterThan(REF_VIEW_H);
  });
});
