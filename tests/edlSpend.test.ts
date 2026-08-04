import { describe, it, expect } from 'vitest';
import {
  edlSpend, EDL_VALUE_FLOOR, EDL_ALPHA_FLOOR_LIGHT,
  colormap, luminance01, TERRAIN_LIGHT, TERRAIN_TERMINAL,
} from '../src/lib/terrain';

// Guards for the fix to "the light-theme terrain dots blend into the fluid sky".
//
// The bug was not palette-depth or dot weight: it was that Eye-Dome Lighting spent
// its whole shade on ALPHA. Fading a dot moves it toward the BACKDROP, so on the
// dark theme's near-black sky that darkens (correct) while on the light theme's
// pale sky it LIGHTENS (inverted) — the ridge dots EDL most wants to shade were
// bleaching into the sky instead. edlSpend() splits the shade into a value factor
// and an alpha factor by theme; these specs pin the properties that make that safe.

const SKY_LIGHT = 0.875;  // measured mean hero backdrop luminance, light theme
const VOID_DARK = 0.070;  // ditto, dark theme

/** luminance of a dot composited over a backdrop at a given alpha */
const over = (dotL: number, alpha: number, bgL: number) => dotL * alpha + bgL * (1 - alpha);

describe('edlSpend — how the EDL shade is spent per theme', () => {
  it('is EXACTLY the shipped alpha expression at darkness = 1 (dark theme cannot regress)', () => {
    // The dark theme is shipped and approved; this fix must not touch a single bit
    // of it. Bit-for-bit, not toBeCloseTo — that is the whole point of the guard.
    // (This caught a real float bug: the a + (b-a)*d lerp form gave 0.19999999999999996
    // instead of 0.20 at d = 1, so edlSpend uses the exact a*(1-d) + b*d mix form.)
    for (const alphaFloor of [0.20, 0.35, 0.5]) {
      for (const shade of [0, 0.13, 0.25, 0.5, 0.87, 1]) {
        const s = edlSpend(shade, 1, alphaFloor);
        expect(s.value).toBe(1); // no value shading in dark theme
        expect(s.alpha).toBe(alphaFloor + (1 - alphaFloor) * shade);
      }
    }
  });

  it('an unshaded dot (shade = 1) is untouched in BOTH themes', () => {
    for (const darkness of [0, 0.5, 1]) {
      const s = edlSpend(1, darkness, 0.20);
      expect(s.value).toBeCloseTo(1, 12);
      expect(s.alpha).toBeCloseTo(1, 12);
    }
  });

  it('LIGHT theme: an EDL-shadowed dot gets DARKER, not more transparent', () => {
    // The inverted-cue fix, stated as a property.
    const shadowed = edlSpend(0, 0, 0.20);
    const unshaded = edlSpend(1, 0, 0.20);
    expect(shadowed.value).toBeLessThan(unshaded.value);   // value carries the cue
    expect(shadowed.value).toBeCloseTo(EDL_VALUE_FLOOR, 12);
    // alpha still recedes a little (the far field dissolves into the sky) but it is
    // no longer the mechanism — it must stay far above the dark theme's floor.
    expect(shadowed.alpha).toBeCloseTo(EDL_ALPHA_FLOOR_LIGHT, 12);
    expect(shadowed.alpha).toBeGreaterThan(0.5);
  });

  it('LIGHT theme: shading a dot moves it AWAY from the pale sky (the actual bug)', () => {
    // Composite a mid-value dot over the real measured sky and shade it. Under the
    // old alpha-only spend the shaded dot ended up LIGHTER than the unshaded one,
    // i.e. closer to the sky — the shape cue ran backwards. It must now go darker.
    const dotL = luminance01(colormap(0.6, TERRAIN_LIGHT));

    const shadedNew = edlSpend(0.05, 0, 0.20);
    const unshadedNew = edlSpend(1, 0, 0.20);
    const shadedL = over(dotL * shadedNew.value, shadedNew.alpha, SKY_LIGHT);
    const unshadedL = over(dotL * unshadedNew.value, unshadedNew.alpha, SKY_LIGHT);
    expect(shadedL).toBeLessThan(unshadedL);

    // and the OLD behaviour is what it must beat: alpha-only would lighten it.
    const oldShadedL = over(dotL, 0.20 + 0.80 * 0.05, SKY_LIGHT);
    expect(oldShadedL).toBeGreaterThan(unshadedL);           // the inversion, reproduced
    expect(SKY_LIGHT - shadedL).toBeGreaterThan(SKY_LIGHT - oldShadedL); // now separated
  });

  it('DARK theme: shading still moves a dot away from the near-black void', () => {
    // The same property must hold in dark — where alpha already achieved it.
    const dotL = luminance01(colormap(0.6, TERRAIN_TERMINAL));
    const shaded = edlSpend(0.05, 1, 0.20);
    const unshaded = edlSpend(1, 1, 0.20);
    const shadedL = over(dotL * shaded.value, shaded.alpha, VOID_DARK);
    const unshadedL = over(dotL * unshaded.value, unshaded.alpha, VOID_DARK);
    expect(shadedL).toBeLessThan(unshadedL);  // goes dark = an eye-dome shadow
  });

  it('is monotonic in shade and clamps out-of-range input', () => {
    let prevV = -1, prevA = -1;
    for (let sh = 0; sh <= 1.0001; sh += 0.05) {
      const s = edlSpend(sh, 0, 0.20);
      expect(s.value).toBeGreaterThanOrEqual(prevV);
      expect(s.alpha).toBeGreaterThanOrEqual(prevA);
      prevV = s.value; prevA = s.alpha;
    }
    // out-of-range shade/darkness must not produce factors outside [floor, 1]
    for (const [sh, d] of [[-3, 0], [4, 0], [-3, 1], [4, 1], [0.5, -2], [0.5, 9]]) {
      const s = edlSpend(sh, d, 0.20);
      expect(s.value).toBeGreaterThanOrEqual(EDL_VALUE_FLOOR - 1e-12);
      expect(s.value).toBeLessThanOrEqual(1 + 1e-12);
      expect(s.alpha).toBeGreaterThan(0);
      expect(s.alpha).toBeLessThanOrEqual(1 + 1e-12);
    }
  });

  it('crosses over continuously between the themes (no jump at the theme blend)', () => {
    // darkness is a continuous blend, so a half-way theme must sit between the two.
    const mid = edlSpend(0.2, 0.5, 0.20);
    const light = edlSpend(0.2, 0, 0.20);
    const dark = edlSpend(0.2, 1, 0.20);
    expect(mid.value).toBeGreaterThan(light.value);
    expect(mid.value).toBeLessThan(dark.value);
    expect(mid.alpha).toBeLessThan(light.alpha);
    expect(mid.alpha).toBeGreaterThan(dark.alpha);
  });
});

// NOTE: the two specs that used to live here guarded a DEEPENED TERRAIN_LIGHT ramp
// which has been reverted. They are removed rather than relaxed, deliberately:
//   · the iso-luminance guard swept hn 0..1 and required range > 0.15, but the
//     renderer never exceeds hn ~0.80 — over the envelope actually rendered the
//     range was 0.1477, so the guard only ever passed on values that never paint.
//     A test that is green outside its operating range is worse than no test.
//   · the monotonic-darkening guard asserted a screen relationship the render does
//     not have: composited on paper at EDL shade 0.5 the ridge measures L 0.680 vs
//     the valley's 0.526 — LIGHTER — because terrainRender's base alpha ramp
//     0.30+(1-hn)*0.45 more than cancels any colormap value ramp. The ramp change
//     was reverted for exactly this reason; edlSpend() carries the separation win.
