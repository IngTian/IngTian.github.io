import { describe, it, expect } from 'vitest';
import { starIdentity } from '../src/lib/terrainRender';

describe('starIdentity', () => {
  it('is deterministic — a dot keeps its identity across frames and re-inits', () => {
    const a = starIdentity(1.5, -2.25);
    const b = starIdentity(1.5, -2.25);
    expect(a.phase).toBe(b.phase);
    expect(a.rate).toBe(b.rate);
    expect(a.tint).toEqual(b.tint);
  });

  it('gives neighbouring dots different phases (no synchronized pulsing)', () => {
    // The whole point of per-dot phase: if adjacent lattice points shared a phase
    // the field would blink in unison, which reads as a strobe rather than stars.
    const phases = new Set<number>();
    for (let x = -3; x <= 3; x += 0.5) {
      for (let y = -3; y <= 3; y += 0.5) {
        phases.add(starIdentity(x, y).phase);
      }
    }
    expect(phases.size).toBeGreaterThan(100);
  });

  it('keeps phase within one full turn', () => {
    for (let i = 0; i < 300; i++) {
      const { phase } = starIdentity(i * 0.37, i * -0.61);
      expect(phase).toBeGreaterThanOrEqual(0);
      expect(phase).toBeLessThanOrEqual(Math.PI * 2 + 1e-9);
    }
  });

  it('keeps twinkle rate in a slow, plausible band', () => {
    // Too fast reads as electrical flicker; too slow and it never twinkles.
    for (let i = 0; i < 300; i++) {
      const { rate } = starIdentity(i * 0.29, i * 0.53);
      expect(rate).toBeGreaterThanOrEqual(0.55);
      expect(rate).toBeLessThanOrEqual(2.05 + 1e-9);
    }
  });

  it('produces tints that are valid, bright, and never fully saturated to one channel', () => {
    for (let i = 0; i < 400; i++) {
      const { tint } = starIdentity(i * 0.41, i * -0.23);
      expect(tint).toHaveLength(3);
      for (const c of tint) {
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(1);
      }
      // A star is a bright thing: no channel triple should be dim overall.
      const maxC = Math.max(...tint);
      expect(maxC).toBeGreaterThan(0.6);
    }
  });

  it('spans the stellar temperature range — blue-white through amber', () => {
    // Sample broadly and confirm we actually get both cool (blue-dominant) and
    // warm (red-dominant) stars, not a single hue.
    let cool = 0;
    let warm = 0;
    for (let i = 0; i < 600; i++) {
      const { tint } = starIdentity(i * 0.17, i * 0.71);
      const [r, , b] = tint;
      if (b > r + 0.05) cool++;
      if (r > b + 0.05) warm++;
    }
    expect(cool).toBeGreaterThan(20);
    expect(warm).toBeGreaterThan(20);
  });

  it('never returns NaN for any lattice coordinate, including 0 and negatives', () => {
    for (const [x, y] of [[0, 0], [-5, -5], [5, -5], [-0.5, 0.5], [12.75, -9.25]]) {
      const { phase, rate, tint } = starIdentity(x, y);
      expect(Number.isFinite(phase)).toBe(true);
      expect(Number.isFinite(rate)).toBe(true);
      tint.forEach((c) => expect(Number.isFinite(c)).toBe(true));
    }
  });
});
