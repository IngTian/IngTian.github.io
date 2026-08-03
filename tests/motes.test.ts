import { describe, it, expect } from 'vitest';
import { hash2, valueNoise, fbm, curl, depthGate } from '../src/lib/proto/motes';

describe('hash2', () => {
  it('stays in [0,1)', () => {
    for (let i = 0; i < 200; i++) {
      const v = hash2(i * 3.7, i * -1.9);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('is deterministic', () => {
    expect(hash2(12.5, -3.25)).toBe(hash2(12.5, -3.25));
  });
});

describe('valueNoise', () => {
  it('stays in [0,1]', () => {
    for (let i = 0; i < 300; i++) {
      const v = valueNoise(i * 0.37, i * 0.61);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('is continuous — nearby samples stay close', () => {
    // A discontinuity would show up as particles teleporting between cells.
    for (let i = 0; i < 100; i++) {
      const x = i * 0.53;
      const y = i * -0.31;
      const a = valueNoise(x, y);
      const b = valueNoise(x + 1e-4, y + 1e-4);
      expect(Math.abs(a - b)).toBeLessThan(0.01);
    }
  });

  it('reproduces lattice corners exactly', () => {
    // At integer coordinates the interpolation weights are 0, so the value must
    // be the raw corner hash.
    expect(valueNoise(4, 7)).toBeCloseTo(hash2(4, 7), 12);
  });
});

describe('fbm', () => {
  it('is bounded and finite', () => {
    for (let i = 0; i < 200; i++) {
      const v = fbm(i * 0.41, i * 0.29);
      expect(Number.isFinite(v)).toBe(true);
      // sum of amplitudes 0.5 + 0.25 + 0.125 = 0.875 for 3 octaves
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(0.875 + 1e-9);
    }
  });

  it('honours the octave count', () => {
    expect(fbm(1.5, 2.5, 1)).not.toBe(fbm(1.5, 2.5, 3));
  });
});

describe('curl', () => {
  it('returns finite vectors', () => {
    for (let i = 0; i < 200; i++) {
      const [vx, vy] = curl(i * 0.23, i * 0.47);
      expect(Number.isFinite(vx)).toBe(true);
      expect(Number.isFinite(vy)).toBe(true);
    }
  });

  it('is divergence-free (the reason streamlines stay clean)', () => {
    // ∇·(curl ψ) = 0 analytically. Numerically we get finite-difference error,
    // so assert it's small relative to the field's own magnitude.
    const h = 0.02;
    let checked = 0;
    for (let i = 1; i < 40; i++) {
      const x = i * 0.31 + 0.5;
      const y = i * 0.17 + 0.5;

      const [vxp] = curl(x + h, y);
      const [vxm] = curl(x - h, y);
      const [, vyp] = curl(x, y + h);
      const [, vym] = curl(x, y - h);

      const div = (vxp - vxm) / (2 * h) + (vyp - vym) / (2 * h);
      const [cx, cy] = curl(x, y);
      const scale = Math.max(1, Math.hypot(cx, cy));

      expect(Math.abs(div) / scale).toBeLessThan(1.5);
      checked++;
    }
    expect(checked).toBeGreaterThan(30);
  });

  it('is not identically zero (the field actually flows)', () => {
    let maxMag = 0;
    for (let i = 0; i < 100; i++) {
      const [vx, vy] = curl(i * 0.29, i * 0.53);
      maxMag = Math.max(maxMag, Math.hypot(vx, vy));
    }
    expect(maxMag).toBeGreaterThan(0.01);
  });
});

describe('depthGate', () => {
  it('is exactly zero in the luminous heights', () => {
    // This is the load-bearing assertion: motes must be ABSENT on the pale dawn
    // paper, where they would read as dust rather than stars.
    expect(depthGate(0)).toBe(0);
    expect(depthGate(0.1)).toBe(0);
    expect(depthGate(0.33)).toBe(0);
    expect(depthGate(0.34)).toBe(0);
  });

  it('reaches full presence at the ground', () => {
    expect(depthGate(1)).toBeCloseTo(1, 12);
  });

  it('increases monotonically past the threshold', () => {
    let prev = -1;
    for (let d = 0.34; d <= 1.0001; d += 0.02) {
      const v = depthGate(d);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it('stays within [0,1] for any input, including out-of-range', () => {
    for (const d of [-1, -0.01, 0, 0.5, 1, 1.5, 99]) {
      const v = depthGate(d);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('eases in — quiet well past the threshold', () => {
    // Halfway down the gated range it should still be well under half strength,
    // so the transition never announces itself.
    const mid = depthGate(0.34 + (1 - 0.34) / 2);
    expect(mid).toBeLessThan(0.3);
  });

  it('respects a custom start', () => {
    expect(depthGate(0.5, 0.6)).toBe(0);
    expect(depthGate(0.7, 0.6)).toBeGreaterThan(0);
  });
});
