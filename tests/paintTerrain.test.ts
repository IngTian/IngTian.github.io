import { describe, it, expect } from 'vitest';
import { buildGrid, paintTerrain, TERRAIN_CONFIG_DEFAULTS, starIdentity } from '../src/lib/terrainRender';
import { TERRAIN_LIGHT, TERRAIN_TERMINAL } from '../src/lib/terrain';

/** Minimal 2D-context recorder: paintTerrain only needs arc/fill/fillStyle/clearRect. */
function recordingCtx() {
  const calls: Array<{ r: number; fill: string }> = [];
  let pending = 0;
  return {
    calls,
    ctx: {
      clearRect() {},
      beginPath() {},
      arc(_x: number, _y: number, r: number) { pending = r; },
      set fillStyle(v: string) { calls.push({ r: pending, fill: v }); },
      get fillStyle() { return ''; },
      fill() {},
    } as unknown as CanvasRenderingContext2D,
  };
}

describe('paintTerrain', () => {
  const grid = buildGrid();

  it('paints dots for both themes without throwing', () => {
    for (const [ramp, darkness] of [[TERRAIN_LIGHT, 0], [TERRAIN_TERMINAL, 1]] as const) {
      const { ctx, calls } = recordingCtx();
      paintTerrain(ctx, grid, { ...TERRAIN_CONFIG_DEFAULTS, ramp, darkness, dotScale: 1 },
        1440, 900, 1, 0, 0);
      expect(calls.length).toBeGreaterThan(200);
      for (const c of calls) {
        expect(Number.isFinite(c.r)).toBe(true);
        expect(c.r).toBeGreaterThan(0);
        expect(c.fill).toMatch(/^rgba\(/);
      }
    }
  });

  it('applies the starfield ONLY when configured (light theme must be unaffected)', () => {
    const paint = (starfield: boolean) => {
      const { ctx, calls } = recordingCtx();
      paintTerrain(ctx, grid, { ...TERRAIN_CONFIG_DEFAULTS, ramp: TERRAIN_LIGHT, darkness: 0, dotScale: 1, starfield },
        1440, 900, 1, 0, 0);
      return calls.map((c) => c.fill).join('|');
    };
    expect(paint(false)).toBe(paint(false));       // deterministic
    expect(paint(true)).not.toBe(paint(false));    // the flag must actually do something
  });

  it('is deterministic for a fixed time — no hidden Math.random', () => {
    const once = () => {
      const { ctx, calls } = recordingCtx();
      paintTerrain(ctx, grid, { ...TERRAIN_CONFIG_DEFAULTS, ramp: TERRAIN_LIGHT, darkness: 0, dotScale: 1 },
        1440, 900, 1, 1.5, 0.04);
      return calls.map((c) => `${c.r.toFixed(3)}:${c.fill}`).join('|');
    };
    expect(once()).toBe(once());
  });
});
