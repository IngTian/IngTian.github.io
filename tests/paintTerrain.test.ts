import { describe, it, expect } from 'vitest';
import { buildGrid, paintTerrain, TERRAIN_CONFIG_DEFAULTS } from '../src/lib/terrainRender';
import { TERRAIN_LIGHT, TERRAIN_TERMINAL, EDL_DEFAULTS } from '../src/lib/terrain';
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

describe('buildGrid is memoised, and the memo is the point', () => {
  // The EDL precompute is a brute-force all-pairs scan: 1089 points, 1,185,921 pair checks, measured at
  // 8.1 ms cold / 2.4 ms warm median. TerrainHero called it from `initTerrain()`, which is bound to
  // `astro:page-load` AND re-fired by the theme toggle — with the same `EDL_DEFAULTS` object every time. So
  // every return to `/` and every theme flip paid 2–8 ms of blocked main thread for a byte-identical result.
  // The component's own comment claimed "built once ... never needs recompute"; the memo was never written.
  it('returns the same array for the same params', () => {
    expect(buildGrid(EDL_DEFAULTS)).toBe(buildGrid(EDL_DEFAULTS));
  });

  it('hits on an equal-but-distinct params object, because callers construct their own', () => {
    // Keyed on the VALUES, not object identity — the gate's painter passes `cfg.edlParams`, which comes from
    // a spread of the defaults and is therefore a different object with the same contents.
    const copy = { ...EDL_DEFAULTS };
    expect(copy).not.toBe(EDL_DEFAULTS);
    expect(buildGrid(copy)).toBe(buildGrid(EDL_DEFAULTS));
  });

  it('misses on different params, so the memo cannot serve a wrong grid', () => {
    const other = { ...EDL_DEFAULTS, neighborRadius: EDL_DEFAULTS.neighborRadius + 0.11 };
    const a = buildGrid(EDL_DEFAULTS);
    const b = buildGrid(other);
    expect(b).not.toBe(a);
    // Same geometry, different shade: the positions must be identical and the EDL must not be.
    expect(b.length).toBe(a.length);
    expect(b.map((p) => p.x)).toEqual(a.map((p) => p.x));
    expect(b.some((p, i) => p.edl !== a[i].edl)).toBe(true);
  });

  it('is measurably cheaper warm than cold', () => {
    // Not a wall-clock threshold — those are flaky in CI. The claim is only that a hit does not redo the
    // O(n^2) work, and the sharpest available proxy is that a hit is far faster than the first build of a
    // params set nothing has seen.
    const fresh = { ...EDL_DEFAULTS, percentile: 0.77 };
    const t0 = performance.now();
    buildGrid(fresh);
    const cold = performance.now() - t0;
    const t1 = performance.now();
    for (let i = 0; i < 50; i++) buildGrid(fresh);
    const warm50 = performance.now() - t1;
    expect(warm50).toBeLessThan(cold);
  });

  it('the shared array must be treated as read-only — stated here because nothing can enforce it', () => {
    // Two painters now hold the same grid. `paintTerrain` only reads it, which is what makes the memo safe.
    // If you ever hand the painter per-frame-transformed positions (it re-reads g.x/g.y every frame, so that
    // is a real technique), map to a COPY — mutating these objects would leak the transform into every other
    // consumer, including the hero.
    const g = buildGrid(EDL_DEFAULTS);
    expect(buildGrid(EDL_DEFAULTS)[0]).toBe(g[0]);
  });
});
