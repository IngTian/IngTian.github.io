import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { justifyRows } from '../src/lib/justify';

/**
 * /art's `sizes` hints describe a layout its stylesheet decides: the rows' height (`--row-h`, which the rows script
 * hands to justifyRows), the mat's height cap and the calligraphy's. Each hint is built from constants in the page's
 * frontmatter (matSizes(), rowSizes(), calSizes(); the arithmetic is beside them), so each constant is held here to
 * the CSS it mirrors, and each hint is swept over the layout: the worst rendered / hinted width is at most 1, so a
 * hint can only ever cost bytes, never sharpness. Read as TEXT: the page is a component and cannot be imported.
 */

const artPage = readFileSync(new URL('../src/pages/art.astro', import.meta.url), 'utf8');
const frontmatter = artPage.split(/^---$/m)[1] ?? '';
const css = (/^<style>([\s\S]*?)^<\/style>/m.exec(artPage)?.[1] ?? '').replace(/\/\*[\s\S]*?\*\//g, '');

/** A frontmatter constant, `NAME = 123`. */
const constant = (name: string): number | undefined => {
  const m = new RegExp(`\\b${name}\\s*=\\s*(\\d+)`).exec(frontmatter);
  return m ? Number(m[1]) : undefined;
};
/** A frontmatter array of numbers, `NAME = [1, 2]`. */
const list = (name: string): number[] | undefined =>
  new RegExp(`\\b${name}\\s*=\\s*\\[([^\\]]*)\\]`).exec(frontmatter)?.[1].split(',').map(Number);

/** The stylesheet by top-level `@media` block: '' is everything outside one, else the block's query. */
const scopes = new Map<string, string>([['', '']]);
for (let i = 0; i < css.length;) {
  const at = css.indexOf('@media', i);
  scopes.set('', scopes.get('') + css.slice(i, at < 0 ? css.length : at));
  if (at < 0) break;
  const open = css.indexOf('{', at);
  let j = open;
  for (let depth = 0; j < css.length; j++) if (css[j] === '{') depth++; else if (css[j] === '}' && --depth === 0) break;
  const query = css.slice(at + '@media'.length, open).trim();
  scopes.set(query, (scopes.get(query) ?? '') + css.slice(open + 1, j));
  i = j + 1;
}
const PHONE = '(max-width: 640px)';
const STACKED = '(max-width: 900px)';

/** A declaration of the rule whose whole selector is `sel`, in one scope: never the first match in the file. */
const decl = (scope: string, sel: string, prop: string): string | undefined => {
  const esc = sel.replace(/[.()[\]*+?^$|\\:]/g, '\\$&');
  const body = new RegExp(`(?:^|\\})\\s*${esc}\\s*\\{([^}]*)\\}`).exec(scopes.get(scope) ?? '')?.[1];
  return body && new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`).exec(body)?.[1].trim();
};
const num = (v?: string): number | undefined => (v && /^\d+(\.\d+)?(px)?$/.test(v) ? parseFloat(v) : undefined);
/** `min(62vh, 560px)` as its two arms, [0.62, 560]. */
const vhCap = (v?: string): [number, number] | undefined => {
  const m = /^min\(\s*(\d+(?:\.\d+)?)vh\s*,\s*(\d+(?:\.\d+)?)px\s*\)$/.exec(v ?? '');
  return m ? [Number(m[1]) / 100, Number(m[2])] : undefined;
};

const C = {
  ROW_H: constant('ROW_H'), ROW_H_PHONE: constant('ROW_H_PHONE'), ROW_W: constant('ROW_W'),
  MAT_H: constant('MAT_H'), MAT_W: constant('MAT_W'),
  MAT_H_STACKED: constant('MAT_H_STACKED'), MAT_W_STACKED: constant('MAT_W_STACKED'),
  MAT_H_PHONE: constant('MAT_H_PHONE'), MAT_W_PHONE: constant('MAT_W_PHONE'),
  CAL_MAX_H: constant('CAL_MAX_H'),
};
const S = {
  rowH: num(decl('', '.rows', '--row-h')), rowPad: num(decl('', '.rows', '--pad')), rowGap: num(decl('', '.rows', 'column-gap')),
  rowHPhone: num(decl(PHONE, '.rows', '--row-h')), rowPadPhone: num(decl(PHONE, '.rows', '--pad')),
  rowGapPhone: num(decl(PHONE, '.rows', 'column-gap')),
  openingGap: num(decl('', '.opening', 'gap')),
  mat: vhCap(decl('', '.mat', 'height')), matPad: num(decl('', '.mat', 'padding')),
  matStacked: vhCap(decl(STACKED, '.mat', 'height')), matPadStacked: num(decl(STACKED, '.mat', 'padding')),
  matPhone: vhCap(decl(PHONE, '.mat', 'height')), matPadPhone: num(decl(PHONE, '.mat', 'padding')),
  cal: vhCap(decl('', '.cal :global(img)', 'max-height')), objPadPhone: num(decl(PHONE, '.obj-mat', 'padding')),
  calInsetPhone: num(/calc\(100vw - (\d+)px\)/.exec(frontmatter)?.[1]),
};

// The column the sweeps lay out in: .art-wrap's `max-width: 1240px` and `padding: 0 clamp(22px, 5vw, 72px)`
// (border-box), and .opening's `minmax(0, 1fr) minmax(0, 1.15fr)`, whose second column holds the mat. The first
// test holds each to the stylesheet.
const COLUMN = 1240;
const side = (vw: number): number => Math.min(72, Math.max(22, 0.05 * vw));
const content = (vw: number): number => Math.min(COLUMN, vw) - 2 * side(vw);
const MAT_SHARE = 1.15 / 2.15;

const range = (from: number, to: number, step = 1): number[] =>
  [...Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step), to];
// The ratios the photographs ship (9:16, 3:4, 1807:2400 and their transposes), repeated, rather than read from
// src/assets, so adding a photograph cannot fail this; the mat also holds the stele (1727x3422) and the poem
// (1080x1440).
const PHOTO_ARS = [0.5625, 0.75, 1807 / 2400, 2400 / 1807, 4 / 3, 16 / 9];
const REPEATED = Array.from({ length: 42 }, (_, i) => PHOTO_ARS[i % PHOTO_ARS.length]);
const CAL_ARS = [1727 / 3422, 1080 / 1440];
const MAT_ARS = [...PHOTO_ARS, ...CAL_ARS];
const VH = range(500, 2200, 11);
/** The column's widest, 1116px at vw = 1240 (side 62), not at the 1240 cap's far side. */
const PEAK = Math.max(...range(320, 3000).map(content));

describe("/art's `sizes` hints", () => {
  it('finds every constant and every rule they mirror', () => {
    // If any of these stops matching, every sweep below would run on undefined and pass or fail for no reason.
    for (const [k, v] of Object.entries({ ...C, ...S })) expect(v, `${k} in src/pages/art.astro`).toBeDefined();
    expect(decl('', '.art-wrap', 'max-width'), '.art-wrap max-width').toBe(`${COLUMN}px`);
    expect(decl('', '.art-wrap', 'padding'), '.art-wrap padding').toBe('0 clamp(22px, 5vw, 72px)');
    expect(decl('', '.opening', 'grid-template-columns'), '.opening columns').toBe('minmax(0, 1fr) minmax(0, 1.15fr)');
  });

  it('holds each constant to the CSS it mirrors', () => {
    // If one fails, the constant and the stylesheet have drifted: change both, in the same commit.
    expect(C.ROW_H, ".rows' --row-h").toBe(S.rowH);
    expect(C.ROW_H_PHONE, ".rows' --row-h at 640px").toBe(S.rowHPhone);
    expect(C.CAL_MAX_H, ".cal img's max-height, its px arm").toBe(S.cal![1]);
    // the mat's image box is its height cap less its padding, above and below (border-box)
    expect(C.MAT_H, ".mat's height cap less 2 x its padding").toBe(S.mat![1] - 2 * S.matPad!);
    expect(C.MAT_H_STACKED, 'the same at 900px').toBe(S.matStacked![1] - 2 * S.matPadStacked!);
    expect(C.MAT_H_PHONE, 'the same at 640px').toBe(S.matPhone![1] - 2 * S.matPadPhone!);
    // The width caps, from the column at its widest (PEAK) and at each block's own widest. The sweeps below cannot
    // see ROW_W: no shipped ratio is wide enough (3.84:1 at 280px) for a tile to reach it.
    expect(C.ROW_W, 'the widest column less 2 x the tile pad').toBe(PEAK - 2 * S.rowPad!);
    expect(C.MAT_W, "the mat's widest column less 2 x its padding")
      .toBe(Math.ceil((PEAK - S.openingGap!) * MAT_SHARE - 2 * S.matPad!));
    expect(C.MAT_W_STACKED, 'the column at 900px less 2 x the padding').toBe(content(900) - 2 * S.matPadStacked!);
    expect(C.MAT_W_PHONE, 'the column at 640px less 2 x the padding').toBe(content(640) - 2 * S.matPadPhone!);
  });

  it('ships each kind of work in its own widths, on the mat too, and states them once', () => {
    // 1200 stays for the calligraphy: a DPR-3 phone at ~346 CSS px asks for ~1038 device px of the stele. No native
    // width, ever: the stele's 1727w was a 1342 KB webp on the LCP image.
    expect(list('PHOTO_WIDTHS')).toEqual([300, 600, 900]);
    expect(list('CAL_WIDTHS')).toEqual([480, 900, 1200]);
    expect(artPage).not.toContain('widths={[');
  });

  it("never under-declares a photograph in the rows, the last row included", () => {
    // The rows script calls justifyRows(ars, W - 2 x pad, --row-h, gap + 2 x pad), and a tile's image is ar x h.
    const { ROW_H, ROW_W, ROW_H_PHONE } = C as Record<keyof typeof C, number>;
    const sweep = (Ws: number[], target: number, pad: number, gap: number, hint: (ar: number) => number): number => {
      let worst = 0;
      for (const W of Ws) for (const row of justifyRows(REPEATED, W - 2 * pad, target, gap + 2 * pad)) {
        for (const i of row.indices) worst = Math.max(worst, (REPEATED[i] * row.height) / hint(REPEATED[i]));
      }
      return worst;
    };
    const desktop = sweep(range(260, PEAK, 7), ROW_H, S.rowPad!, S.rowGap!, (ar) => Math.min(Math.ceil(ar * ROW_H), ROW_W));
    const phone = sweep(range(content(320), content(640)), ROW_H_PHONE, S.rowPadPhone!, S.rowGapPhone!,
      (ar) => Math.ceil(ar * ROW_H_PHONE));
    expect(desktop, 'desktop').toBeLessThanOrEqual(1);
    expect(phone, 'phone').toBeLessThanOrEqual(1);
  });

  it('never under-declares a work on the mat, at any viewport or window height', () => {
    // The image is whole inside the mat's padding: at most its column wide and its height cap tall.
    const c = C as Record<keyof typeof C, number>;
    const sweep = (
      vws: number[], colOf: (vw: number) => number, [f, cap]: [number, number], pad: number, h: number, w: number,
    ): number => {
      let worst = 0;
      for (const ar of MAT_ARS) {
        const hint = Math.min(Math.ceil(ar * h), w);
        for (const vw of vws) for (const vh of VH) {
          worst = Math.max(worst, Math.min(colOf(vw) - 2 * pad, ar * (Math.min(f * vh, cap) - 2 * pad)) / hint);
        }
      }
      return worst;
    };
    const desktopCol = (vw: number): number => (content(vw) - S.openingGap!) * MAT_SHARE;
    expect(sweep(range(901, 3000, 7), desktopCol, S.mat!, S.matPad!, c.MAT_H, c.MAT_W), 'desktop').toBeLessThanOrEqual(1);
    expect(sweep(range(641, 900), content, S.matStacked!, S.matPadStacked!, c.MAT_H_STACKED, c.MAT_W_STACKED), 'stacked')
      .toBeLessThanOrEqual(1);
    expect(sweep(range(320, 640), content, S.matPhone!, S.matPadPhone!, c.MAT_H_PHONE, c.MAT_W_PHONE), 'phone')
      .toBeLessThanOrEqual(1);
  });

  it('never under-declares a calligraphy block, at any viewport or window height', () => {
    // Height-capped, so at most ar x CAL_MAX_H wide in any container; on a phone, the column less the block's mat.
    const [f, cap] = S.cal!;
    let worst = 0;
    for (const ar of CAL_ARS) {
      const hint = Math.ceil(ar * C.CAL_MAX_H!);
      for (let vh = 560; vh <= 2160; vh += 11) for (let container = 300; container <= 3000; container += 13) {
        worst = Math.max(worst, Math.min(container, Math.min(f * vh, cap) * ar) / hint);
      }
    }
    expect(worst, 'desktop').toBeLessThanOrEqual(1);
    for (const vw of range(320, 640)) {
      expect(content(vw) - 2 * S.objPadPhone!, `phone at ${vw}px`).toBeLessThanOrEqual(vw - S.calInsetPhone!);
    }
  });
});
