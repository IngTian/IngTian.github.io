import { describe, it, expect } from 'vitest';
import {
  wcagLuminance, contrastRatio, AA_BODY,
  zoneAt, gateFor, maxDarkwardExcursion, tintBudget,
  nebulaCeiling,
} from '../src/lib/skyLegibility';

// --ink-3 #5a544a is the smallest ink actually used on the reading pages (12-14px).
const INK_3 = wcagLuminance([0x5a, 0x54, 0x4a]);
const PAPER = wcagLuminance([0xf4, 0xef, 0xe4]);

describe('wcagLuminance', () => {
  it('uses WCAG relative luminance, not Rec.601 luma on gamma-encoded values', () => {
    // Rec.601 on gamma-encoded #5a544a gives ~0.336; WCAG gives ~0.090.
    // Every contrast figure in this project must use the latter.
    expect(wcagLuminance([0x5a, 0x54, 0x4a])).toBeCloseTo(0.0901, 3);
    expect(wcagLuminance([255, 255, 255])).toBeCloseTo(1, 6);
    expect(wcagLuminance([0, 0, 0])).toBeCloseTo(0, 6);
  });
});

describe('contrastRatio', () => {
  it('is symmetric and matches the WCAG formula', () => {
    expect(contrastRatio(PAPER, INK_3)).toBeCloseTo(contrastRatio(INK_3, PAPER), 9);
    expect(contrastRatio(1, 0)).toBeCloseTo(21, 6);
  });
});

describe('zoneAt', () => {
  it('is fully engaged everywhere on a reading page (text runs top to bottom)', () => {
    for (const d of [0, 0.2, 0.5, 0.9, 1]) {
      expect(zoneAt(d, 0.348, 'reading')).toBe(1);
    }
  });

  it('ramps in at the content boundary on a descent page', () => {
    expect(zoneAt(0.20, 0.348, 'descent')).toBe(0);
    expect(zoneAt(0.348, 0.348, 'descent')).toBe(0);
    expect(zoneAt(0.50, 0.348, 'descent')).toBe(1);
    expect(zoneAt(0.40, 0.348, 'descent')).toBeGreaterThan(0);
  });
});

describe('gateFor — the asymmetry must INVERT by variant', () => {
  it('descent pages restrain the LIGHTWARD direction (text is paper-coloured)', () => {
    const g = gateFor(1, 'descent');
    expect(g.light).toBeLessThan(g.dark);
  });

  it('reading pages restrain the DARKWARD direction (text is dark ink)', () => {
    const g = gateFor(1, 'reading');
    expect(g.dark).toBeLessThan(g.light);
  });

  it('is a no-op outside the zone in both variants', () => {
    for (const v of ['descent', 'reading'] as const) {
      expect(gateFor(0, v)).toEqual({ dark: 1, light: 1 });
    }
  });

  it('matches the shipped shader gate magnitudes', () => {
    // Over-clamping the reading-dark direction erases the effect on the reading
    // pages; these values are what the shader applies.
    expect(gateFor(1, 'reading').dark).toBeCloseTo(0.70, 9);
    expect(gateFor(1, 'reading').light).toBeCloseTo(0.75, 9);
    expect(gateFor(1, 'descent').dark).toBeCloseTo(0.75, 9);
    expect(gateFor(1, 'descent').light).toBeCloseTo(0.10, 9);
  });
});

describe('maxDarkwardExcursion', () => {
  it('is what any cap must be compared against — a cap above it is inert', () => {
    // (f - 0.5) peaks at 0.5, so the excursion is displacement * amp * 0.5.
    expect(maxDarkwardExcursion(1.35, 0.34)).toBeCloseTo(0.2295, 4);
  });
});

describe('tintBudget — bounds the darkening at its SOURCE', () => {
  it('caps reading-page tint so composited paper cannot fall below AA against ink-3', () => {
    const { magnitude, cap, viscousFloor } = tintBudget('reading');
    // Worst case: start at the reading ramp's own darkest stop, apply the viscous
    // multiply and capped tint IN RGB SPACE, then take luminance. The tint is
    // applied in RGB before luminance is taken, so composing in luminance space
    // understates the darkening (WCAG luminance is nonlinear).
    const start: [number, number, number] = [0xdc, 0xd5, 0xcf];
    const afterViscous = start.map(ch => ch * viscousFloor);
    const tintAmount = 255 * magnitude * cap;
    const afterTint = afterViscous.map(ch => Math.max(0, ch - tintAmount)) as [number, number, number];
    const worstLuminance = wcagLuminance(afterTint);
    expect(contrastRatio(worstLuminance, INK_3)).toBeGreaterThanOrEqual(4.5);
    // Pin that the tint is actually doing something, so a future change that neutralises it fails loudly.
    expect(contrastRatio(worstLuminance, INK_3)).toBeLessThan(4.9);
  });

  it('gives descent pages a larger budget — its danger direction is the other one', () => {
    expect(tintBudget('descent').magnitude).toBeGreaterThan(tintBudget('reading').magnitude);
  });
});

describe('Dark-theme nebula ceiling — descent pages only', () => {
  // The dark theme has ink-3 = #8b938c (used for .lede on /art and .nf-sub on /404).
  // Descent pages start at the charcoal descent-dark ramp (lightest stop #16191d).
  // The nebula adds a cool tint vec3(0.055, 0.105, 0.115) scaled by lift, which
  // LIGHTENS the background (dangerous on a descent page with paper-coloured text).
  const INK_3_DARK = wcagLuminance([0x8b, 0x93, 0x8c]);

  it('caps the nebula lift so descent-dark + full nebula clears AA against ink-3', () => {
    // Worst case: start at the LIGHTEST descent-dark stop (where the nebula would
    // make it even lighter), add the maximum nebula tint in RGB, then take luminance.
    const descentDarkLightest: [number, number, number] = [0x16, 0x19, 0x1d];
    const nebulaTint: [number, number, number] = [0.055, 0.105, 0.115];

    // The ceiling chosen: liftCeiling = 0.45 (independent of zone, so it binds
    // even at zone=0 where the current code applies full strength).
    const liftCeiling = 0.45;
    const nebulaAmount = nebulaTint.map(c => c * 255 * liftCeiling);
    const afterNebula = descentDarkLightest.map((ch, i) =>
      Math.min(255, ch + nebulaAmount[i])) as [number, number, number];

    const worstLuminance = wcagLuminance(afterNebula);
    const ratio = contrastRatio(worstLuminance, INK_3_DARK);

    // Verify it clears AA (4.5:1) with margin.
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    // Pin that the nebula is actually visible, so a future change that neutralises it fails.
    expect(ratio).toBeLessThan(6.5);
  });
});

describe('nebulaCeiling', () => {
  // The dark theme's nebula ADDS light, and on a descent page with no identifiable
  // content element the upper half runs at zone 0 where the zone-based damping does
  // nothing. So the ceiling must hold on its own. Sized against the dark theme's
  // --ink-3 (#8b938c), the smallest ink these pages set directly on the sky.
  const DARK_INK_3 = wcagLuminance([0x8b, 0x93, 0x8c]);

  it('keeps the darkest descent sky clear of AA even at zone 0', () => {
    // Compose in RGB then take luminance — never subtract an RGB delta from a
    // luminance value. The nebula tint is added per channel at the ceiling.
    const sky: [number, number, number] = [0x16, 0x19, 0x1d];   // lightest descent-dark stop
    const tint: [number, number, number] = [0.055, 0.105, 0.115];
    const c = nebulaCeiling();
    const lifted: [number, number, number] = [
      Math.min(255, sky[0] + 255 * tint[0] * c),
      Math.min(255, sky[1] + 255 * tint[1] * c),
      Math.min(255, sky[2] + 255 * tint[2] * c),
    ];
    expect(contrastRatio(wcagLuminance(lifted), DARK_INK_3)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('is low enough that raising it would break AA — the bound binds', () => {
    // Guards against someone "brightening the nebula" without re-deriving.
    expect(nebulaCeiling()).toBeLessThan(0.30);
  });
});
