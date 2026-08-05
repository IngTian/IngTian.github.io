import { describe, it } from 'vitest';
import { paintTerrain as paintBranch, buildGrid as buildBranch, TERRAIN_CONFIG_DEFAULTS as CFG_B } from '../src/lib/terrainRender';
import { TERRAIN_LIGHT as LIGHT_B, TERRAIN_TERMINAL as TERM_B } from '../src/lib/terrain';
import { paintTerrain as paintMain, buildGrid as buildMain, TERRAIN_CONFIG_DEFAULTS as CFG_M } from './_mainref/terrainRender';
import { TERRAIN_LIGHT as LIGHT_M, TERRAIN_TERMINAL as TERM_M } from './_mainref/terrain';

type Rec = { r: number; a: number; lum: number; rgb: [number, number, number] };

function mockCtx() {
  const recs: Rec[] = [];
  let pend = 0;
  const ctx: any = {
    beginPath() {},
    arc(_x: number, _y: number, r: number) { pend = r; },
    set fillStyle(v: string) {
      const m = /rgba\((\d+),(\d+),(\d+),([\d.]+)\)/.exec(v)!;
      const [r, g, b, a] = [+m[1], +m[2], +m[3], +m[4]];
      // sRGB relative luminance in 0..1 (gamma-decoded), matching lib/luminance01-ish
      const lin = (c: number) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
      const lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
      recs.push({ r: pend, a, lum, rgb: [r, g, b] });
    },
    fill() {},
  };
  return { ctx, recs };
}

function measure(which: 'main' | 'branch', dotScale: number, dark = false) {
  const W = 1440 * 2, H = 900 * 2, DPR = 2;
  const { ctx, recs } = mockCtx();
  if (which === 'main') {
    const cfg: any = { ...CFG_M, ramp: dark ? TERM_M : LIGHT_M, darkness: dark ? 1 : 0, dotScale };
    paintMain(ctx, buildMain(cfg.edlParams), cfg, W, H, DPR, 0, 0);
  } else {
    const cfg: any = { ...CFG_B, ramp: dark ? TERM_B : LIGHT_B, darkness: dark ? 1 : 0, dotScale, starfield: dark };
    paintBranch(ctx, buildBranch(cfg.edlParams), cfg, W, H, DPR, 0, 0);
  }
  const ink = recs.reduce((s, d) => s + d.a * d.r * d.r, 0);
  const wl = recs.reduce((s, d) => s + d.a * d.r * d.r * d.lum, 0) / ink;
  const meanLum = recs.reduce((s, d) => s + d.lum, 0) / recs.length;
  return { n: recs.length, ink, inkWeightedLum: wl, meanLum, recs };
}

describe('ink probe', () => {
  it('reports', () => {
    const m = measure('main', 1.15);
    console.log('MAIN light dotScale1.15: n=%d ink=%s wLum=%s meanLum=%s', m.n, m.ink.toFixed(1), m.inkWeightedLum.toFixed(4), m.meanLum.toFixed(4));
    for (const ds of [1.08, 1.05, 1.0, 0.96, 0.955, 0.95]) {
      const b = measure('branch', ds);
      console.log('BRANCH light dotScale%s: n=%d ink=%s ratio=%s wLum=%s meanLum=%s',
        ds, b.n, b.ink.toFixed(1), (b.ink / m.ink).toFixed(4), b.inkWeightedLum.toFixed(4), b.meanLum.toFixed(4));
    }
    // dark parity check (bit-for-bit claim is separate, but record)
    const dm = measure('main', 1.18, true), db = measure('branch', 1.18, true);
    console.log('DARK main ink=%s branch ink=%s', dm.ink.toFixed(2), db.ink.toFixed(2));
  });
});
