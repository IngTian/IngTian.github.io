import { describe, expect, it } from 'vitest';

import { TERRAIN_LIGHT, TERRAIN_TERMINAL } from '../src/lib/terrain';
import { TERRAIN_CONFIG_DEFAULTS, terrainConfig, terrainPalette } from '../src/lib/terrainRender';

/**
 * THE GATE LANDS ITS CAMERA ON THE HERO'S FRAME, which only reads as one continuous object if both painters
 * produce identical pixels at the handover. This selection used to be a private `themePalette()` inside
 * TerrainHero; the gate could only have restated it, and a restated palette that drifts turns a continuation
 * back into the visible cross-fade the whole redesign exists to remove.
 *
 * So this is a two-places-must-agree seam, and these are the assertions that keep it one.
 */

describe('the terrain palette, shared by the hero and the gate', () => {
  it('gives each theme its own ramp, darkness and dot scale', () => {
    const light = terrainPalette(false);
    const dark = terrainPalette(true);

    expect(light.ramp).toBe(TERRAIN_LIGHT);
    expect(dark.ramp).toBe(TERRAIN_TERMINAL);
    // `darkness` is not cosmetic: it blends the directional-light value/gain in the renderer so the relief
    // reads on both the pale and the dark sky. 0 and 1 are the ends the renderer is written against.
    expect(light.darkness).toBe(0);
    expect(dark.darkness).toBe(1);
    // Dark carries a slightly larger dot because its dots read as a fainter starfield on the void.
    expect(dark.dotScale).toBeGreaterThan(light.dotScale);
  });

  it('gives each theme a full walker trio, in range', () => {
    for (const dark of [false, true]) {
      const { walker } = terrainPalette(dark);
      for (const key of ['glow', 'settled', 'trail'] as const) {
        const c = walker[key];
        expect(c, `${key} is not an rgb triple`).toHaveLength(3);
        for (const ch of c) {
          expect(ch).toBeGreaterThanOrEqual(0);
          expect(ch).toBeLessThanOrEqual(255);
        }
      }
      // The trail must recede against the head, or a descent reads as a uniform streak rather than as a
      // moving point that leaves something behind.
      const lum = (c: readonly number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      expect(lum(walker.trail), 'the trail is not darker than the glow').toBeLessThan(lum(walker.glow));
    }
  });

  it('builds a config that is the baked defaults plus only the theme-dependent fields', () => {
    for (const dark of [false, true]) {
      const cfg = terrainConfig(dark);
      // Everything NOT theme-dependent must come through untouched — in particular `zoom`, which is the camera
      // the gate tweens toward. If a config assembled a different zoom, the gate would land on the wrong frame.
      //
      // `dotScale` is excluded because it IS theme-owned: the palette deliberately overrides the baked 1 (dark
      // 1.18, light 1.08). The first version of this loop iterated every default and failed on exactly that,
      // which is the test being wrong rather than the code — but worth keeping the exclusion explicit, so the
      // list of fields a theme is allowed to touch is written down somewhere.
      const themeOwned = new Set(['ramp', 'darkness', 'dotScale', 'starfield']);
      for (const [k, v] of Object.entries(TERRAIN_CONFIG_DEFAULTS)) {
        if (themeOwned.has(k)) continue;
        expect(cfg[k as keyof typeof cfg], `${k} drifted from the baked default`).toEqual(v);
      }
      const p = terrainPalette(dark);
      expect(cfg.ramp).toBe(p.ramp);
      expect(cfg.darkness).toBe(p.darkness);
      expect(cfg.dotScale).toBe(p.dotScale);
      // The starfield is a dark-theme-only reading of the same dots.
      expect(cfg.starfield).toBe(dark);
    }
  });

  it('exposes the camera the gate has to land on', () => {
    // THE HANDOVER'S TARGET, stated once. The gate tweens its own zoom to this value; if these ever diverge the
    // gate's last frame and the hero's first frame are different pictures and the seam becomes visible.
    expect(TERRAIN_CONFIG_DEFAULTS.zoom).toBeGreaterThan(0);
    expect(terrainConfig(false).zoom).toBe(TERRAIN_CONFIG_DEFAULTS.zoom);
    expect(terrainConfig(true).zoom).toBe(TERRAIN_CONFIG_DEFAULTS.zoom);
  });
});
