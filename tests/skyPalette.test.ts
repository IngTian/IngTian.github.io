import { describe, it, expect } from 'vitest';
import { rampFor, luminanceRange } from '../src/lib/skyPalette';
import { wcagLuminance, contrastRatio, AA_BODY } from '../src/lib/skyLegibility';

const hexToRgb = (h: string): [number, number, number] => [
  parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16),
];

describe('rampFor — variant selection', () => {
  it('gives descent and reading DIFFERENT ramps (inverting the choice must fail)', () => {
    expect(rampFor('descent', 'light')).not.toEqual(rampFor('reading', 'light'));
    expect(rampFor('descent', 'dark')).not.toEqual(rampFor('reading', 'dark'));
  });

  it('descent sinks to near-black; reading never does', () => {
    const descentEnd = wcagLuminance(hexToRgb(rampFor('descent', 'light').at(-1)![1]));
    const readingEnd = wcagLuminance(hexToRgb(rampFor('reading', 'light').at(-1)![1]));
    expect(descentEnd).toBeLessThan(0.1);
    expect(readingEnd).toBeGreaterThan(0.6);
  });

  it('every reading-light stop clears AA against --ink-3 unmodified', () => {
    // The reading ramp exists so dark ink stays legible top-to-bottom. If a raw
    // stop already fails, no downstream guard can save it.
    const ink3 = wcagLuminance([0x5a, 0x54, 0x4a]);
    for (const [, hex] of rampFor('reading', 'light')) {
      expect(contrastRatio(wcagLuminance(hexToRgb(hex)), ink3)).toBeGreaterThanOrEqual(AA_BODY);
    }
  });

  it('stops are ordered and span the full 0-1 range in every combination', () => {
    for (const v of ['descent', 'reading'] as const) {
      for (const t of ['light', 'dark'] as const) {
        const stops = rampFor(v, t);
        expect(stops[0][0]).toBe(0);
        expect(stops.at(-1)![0]).toBe(1);
        for (let i = 1; i < stops.length; i++) {
          expect(stops[i][0]).toBeGreaterThan(stops[i - 1][0]);
        }
      }
    }
  });
});

describe('luminanceRange — why the two variants need different mechanisms', () => {
  it('shows the reading ramp is far flatter, so displacement alone cannot show on it', () => {
    const d = luminanceRange(rampFor('descent', 'light'));
    const r = luminanceRange(rampFor('reading', 'light'));
    expect(d.span).toBeGreaterThan(0.85);
    expect(r.span).toBeLessThan(0.20);
    expect(d.span / r.span).toBeGreaterThan(4.4);
  });

  it('shows the dark descent ramp is also flat — hence its additive nebula', () => {
    expect(luminanceRange(rampFor('descent', 'dark')).span).toBeLessThan(0.01);
  });
});
