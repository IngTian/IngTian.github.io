import { describe, it, expect } from 'vitest';
import { buildGrid, paintTerrain, TERRAIN_CONFIG_DEFAULTS } from '../src/lib/terrainRender';
import { TERRAIN_LIGHT, TERRAIN_TERMINAL, EDL_DEFAULTS } from '../src/lib/terrain';
import { wcagLuminance } from '../src/lib/skyLegibility';

/** Minimal 2D-context recorder: paintTerrain only needs arc/fill/fillStyle/clearRect.
 *  Records POSITION as well as radius, because the `lift` tests below assert where dots land. */
function recordingCtx() {
  const calls: Array<{ x: number; y: number; r: number; fill: string }> = [];
  let pending = { x: 0, y: 0, r: 0 };
  return {
    calls,
    ctx: {
      clearRect() {},
      beginPath() {},
      arc(x: number, y: number, r: number) { pending = { x, y, r }; },
      set fillStyle(v: string) { calls.push({ ...pending, fill: v }); },
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

describe('paintTerrain — the intro\'s elevation lift', () => {
  const grid = buildGrid();
  const cfg = { ...TERRAIN_CONFIG_DEFAULTS, ramp: TERRAIN_LIGHT, darkness: 0, dotScale: 1 };

  /** Paint one frame and return the recorded dot calls. Omitting `lift` exercises the default. */
  const paint = (lift?: number) => {
    const { ctx, calls } = recordingCtx();
    if (lift === undefined) paintTerrain(ctx, grid, cfg, 1440, 900, 1, 0, 0);
    else paintTerrain(ctx, grid, cfg, 1440, 900, 1, 0, 0, lift);
    return calls;
  };

  it('defaults lift to 1, so every existing caller is unaffected', () => {
    // The whole reason the parameter is optional. TerrainHero, the proto route and every pre-existing
    // test in this file call paintTerrain with eight arguments; none may change behaviour.
    const implicit = paint();
    const explicit = paint(1);
    expect(explicit.length).toBe(implicit.length);
    for (let i = 0; i < implicit.length; i++) {
      expect(explicit[i].x).toBeCloseTo(implicit[i].x, 10);
      expect(explicit[i].y).toBeCloseTo(implicit[i].y, 10);
      expect(explicit[i].fill).toBe(implicit[i].fill);
    }
  });

  it('flattens the terrain toward one plane at lift=0', () => {
    // The intro's first frame. With z = 0 everywhere the projection is affine in (x, y) alone, so the
    // relief is gone — observable as a strictly smaller spread of screen y than at full elevation.
    const flat = paint(0);
    const full = paint(1);
    const spread = (cs: typeof flat) => {
      const ys = cs.map((c) => c.y);
      return Math.max(...ys) - Math.min(...ys);
    };
    expect(flat.length).toBeGreaterThan(200);
    expect(spread(flat)).toBeLessThan(spread(full));
  });

  it('scales elevation linearly in lift', () => {
    // `project` is affine in z, so a dot's screen y at lift=0.5 must sit exactly midway between its y
    // at 0 and at 1. This is what makes the timeline's eased `lift` produce eased MOTION rather than
    // something subtly non-linear layered on top of the easing.
    //
    // ZOOMED OUT SO NOTHING IS CULLED, and that is the point of this setup rather than an arbitrary
    // choice. `paintTerrain` skips dots outside the viewport, and whether a dot is outside DEPENDS ON
    // LIFT — flattening the terrain pulls the high ground back on screen. A first version of this test
    // compared the three runs at the shipped zoom and failed on count (982 vs 956), which looked like a
    // linearity bug and was really the cull doing its job. At zoom 0.2 the whole field fits, every dot
    // is drawn at every lift, and the distributions are comparable.
    //
    // ASSERTED ON THE MEAN, because the mean is the order-independent linear statistic and dot identity
    // is not recoverable from the recorder. Per dot, screen y is `c(x,y) + field(x,y)·lift·sinT·sc` —
    // affine in lift — so the mean over all dots is affine in lift too, and a mean is unaffected by the
    // painter's depth sort. Sorted distributions are NOT: the i-th smallest y at lift 0.5 need not be
    // the midpoint of the i-th smallest at 0 and 1, because which dot is i-th changes with lift. A
    // version of this test that compared sorted arrays failed by 0.37px for exactly that reason, which
    // is a property of sorting rather than a bug in the lift.
    const wide = { ...cfg, zoom: 0.2 };
    const meanY = (lift: number) => {
      const { ctx, calls } = recordingCtx();
      paintTerrain(ctx, grid, wide, 1400, 1400, 1, 0, 0, lift);
      expect(calls.length).toBe(grid.length); // zoomed out so nothing is culled
      return calls.reduce((s, c) => s + c.y, 0) / calls.length;
    };
    const m0 = meanY(0), m1 = meanY(1);
    // the midpoint, and a quarter point, so `z * lift²` or `z + lift` cannot both pass
    expect(meanY(0.5)).toBeCloseTo((m0 + m1) / 2, 6);
    expect(meanY(0.25)).toBeCloseTo(m0 + (m1 - m0) * 0.25, 6);
    // and lift genuinely moves the terrain, so the above is not two identities
    expect(Math.abs(m1 - m0)).toBeGreaterThan(1);
  });

  it('composes with breathAmp without producing NaN', () => {
    const { ctx, calls } = recordingCtx();
    paintTerrain(ctx, grid, cfg, 1440, 900, 1, 1.7, 0.04, 0.35);
    expect(calls.length).toBeGreaterThan(200);
    for (const c of calls) {
      expect(Number.isFinite(c.x)).toBe(true);
      expect(Number.isFinite(c.y)).toBe(true);
      expect(Number.isFinite(c.r)).toBe(true);
      expect(c.fill).toMatch(/^rgba\(/);
    }
  });

  it('does not mutate the shared grid', () => {
    // buildGrid's result is memoised and shared BY CONTRACT — the file says so. A lift implemented by
    // writing back into the grid points would corrupt every other consumer, including the hero's very
    // next frame, and the corruption would compound.
    const before = grid.map((g) => ({ x: g.x, y: g.y }));
    paint(0.4);
    for (let i = 0; i < grid.length; i++) {
      expect(grid[i].x).toBe(before[i].x);
      expect(grid[i].y).toBe(before[i].y);
    }
  });
});
