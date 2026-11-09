import { describe, it, expect } from 'vitest';
import {
  wcagLuminance, contrastRatio, GATES, AA_BODY, NEBULA, NEBULA_CEILING,
} from '../src/lib/skyLegibility';

// --ink-3 #5a544a, the light theme's smallest ink (12-14px).
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

describe('GATES — the asymmetry', () => {
  it('restrains the LIGHTWARD direction (text is paper-coloured)', () => {
    expect(GATES.light).toBeLessThan(GATES.dark);
  });

  it('matches the shipped shader gate magnitudes', () => {
    expect(GATES.dark).toBeCloseTo(0.75, 9);
    expect(GATES.light).toBeCloseTo(0.10, 9);
  });
});

describe('NEBULA_CEILING', () => {
  // The dark theme's nebula ADDS light, and on a descent page with no identifiable
  // content element the upper half runs at zone 0 where the zone-based damping does
  // nothing. So the ceiling must hold on its own. Sized against the dark theme's
  // --ink-3 (#8b938c), the smallest ink these pages set directly on the sky.
  const DARK_INK_3 = wcagLuminance([0x8b, 0x93, 0x8c]);

  it('keeps the darkest descent sky clear of AA even at zone 0', () => {
    // Compose in RGB then take luminance — never subtract an RGB delta from a
    // luminance value. The nebula tint is added per channel at the ceiling.
    const sky: [number, number, number] = [0x16, 0x19, 0x1d];   // lightest descent-dark stop
    const tint = NEBULA;
    const c = NEBULA_CEILING;
    const lifted: [number, number, number] = [
      Math.min(255, sky[0] + 255 * tint[0] * c),
      Math.min(255, sky[1] + 255 * tint[1] * c),
      Math.min(255, sky[2] + 255 * tint[2] * c),
    ];
    expect(contrastRatio(wcagLuminance(lifted), DARK_INK_3)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('is low enough that raising it would break AA — the bound binds', () => {
    // Guards against someone "brightening the nebula" without re-deriving.
    expect(NEBULA_CEILING).toBeLessThan(0.30);
  });
});
