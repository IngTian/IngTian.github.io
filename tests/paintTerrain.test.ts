import { describe, it, expect } from 'vitest';
import { buildGrid, paintTerrain, TERRAIN_CONFIG_DEFAULTS } from '../src/lib/terrainRender';
import { TERRAIN_LIGHT, TERRAIN_TERMINAL } from '../src/lib/terrain';
import { wcagLuminance } from '../src/lib/skyLegibility';

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

  it('paints dots for both themes with theme separation and value structure', () => {
    // Parse rgba string to [r, g, b, a]
    const parse = (fill: string): [number, number, number, number] => {
      const m = fill.match(/^rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/);
      if (!m) throw new Error(`bad rgba: ${fill}`);
      return [+m[1], +m[2], +m[3], +m[4]];
    };

    const lightResult = (() => {
      const { ctx, calls } = recordingCtx();
      paintTerrain(ctx, grid, { ...TERRAIN_CONFIG_DEFAULTS, ramp: TERRAIN_LIGHT, darkness: 0, dotScale: 1 },
        1440, 900, 1, 0, 0);
      return calls;
    })();

    const darkResult = (() => {
      const { ctx, calls } = recordingCtx();
      paintTerrain(ctx, grid, { ...TERRAIN_CONFIG_DEFAULTS, ramp: TERRAIN_TERMINAL, darkness: 1, dotScale: 1 },
        1440, 900, 1, 0, 0);
      return calls;
    })();

    // Basic structure
    expect(lightResult.length).toBeGreaterThan(200);
    expect(darkResult.length).toBeGreaterThan(200);
    for (const c of [...lightResult, ...darkResult]) {
      expect(Number.isFinite(c.r)).toBe(true);
      expect(c.r).toBeGreaterThan(0);
      expect(c.fill).toMatch(/^rgba\(/);
    }

    // (a) THEME SEPARATION — each theme must render at its own level
    const lightMeans = { r: 0, g: 0, b: 0 };
    for (const c of lightResult) {
      const [r, g, b] = parse(c.fill);
      lightMeans.r += r; lightMeans.g += g; lightMeans.b += b;
    }
    lightMeans.r /= lightResult.length;
    lightMeans.g /= lightResult.length;
    lightMeans.b /= lightResult.length;

    const darkMeans = { r: 0, g: 0, b: 0 };
    for (const c of darkResult) {
      const [r, g, b] = parse(c.fill);
      darkMeans.r += r; darkMeans.g += g; darkMeans.b += b;
    }
    darkMeans.r /= darkResult.length;
    darkMeans.g /= darkResult.length;
    darkMeans.b /= darkResult.length;

    // The light terrain is dark ink on pale paper; the dark terrain is bright
    // ice on a near-black sky. Pinning each theme's own level — rather than
    // the gap between them — is what catches the two ramps being swapped.
    expect(lightMeans.r).toBeLessThan(85);
    expect(lightMeans.g).toBeLessThan(80);
    expect(lightMeans.b).toBeLessThan(80);
    expect(darkMeans.r).toBeGreaterThan(180);
    expect(darkMeans.g).toBeGreaterThan(215);
    expect(darkMeans.b).toBeGreaterThan(200);

    // (b) ELEVATION READS AS VALUE — the light ramp must carry luminance spread across elevation
    const lightLums: number[] = [];
    for (const c of lightResult) {
      const [r, g, b] = parse(c.fill);
      lightLums.push(wcagLuminance([r, g, b]));
    }
    const spread = Math.max(...lightLums) - Math.min(...lightLums);
    // Catches a revert to main's iso-luminant ramp (which would collapse this
    // spread). Does NOT catch an inverted EDL spend: the colormap alone delivers
    // more spread (0.253) than the full pipeline with EDL (0.116), because EDL
    // darkens receding dots and compresses the range rather than expanding it.
    expect(spread).toBeGreaterThan(0.10);
  });

  it('starfield flag takes effect and output is otherwise deterministic', () => {
    // The starfield flag gates stellar tinting; when set, output must differ. When unset, output is stable.
    const paint = (starfield: boolean) => {
      const { ctx, calls } = recordingCtx();
      paintTerrain(ctx, grid, { ...TERRAIN_CONFIG_DEFAULTS, ramp: TERRAIN_LIGHT, darkness: 0, dotScale: 1, starfield },
        1440, 900, 1, 0, 0);
      return calls.map((c) => c.fill).join('|');
    };
    expect(paint(false)).toBe(paint(false));       // deterministic when flag is off
    expect(paint(true)).not.toBe(paint(false));    // the flag must actually change output
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
