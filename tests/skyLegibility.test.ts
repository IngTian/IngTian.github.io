import { describe, it, expect } from 'vitest';
import {
  wcagLuminance, contrastRatio, AA_BODY,
  zoneAt, gateFor, maxDarkwardExcursion, tintBudget,
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
