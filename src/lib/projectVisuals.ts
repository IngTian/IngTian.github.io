// src/lib/projectVisuals.ts
// THE COMPUTED PICTURES on /projects — for the four projects whose picture is their own output rather than a
// screenshot, drawn at build time from data vendored with its provenance (src/data/vendor, written by
// tools/vendor-projects.mjs). Each returns an SVG string, 350x220, coloured ONLY through CSS variables, so one
// drawing re-themes with the page (the drafting palette in tokens.css) and is never CSS-inverted.
//
// Rules the drawings keep, each pinned by tests/projectVisuals.test.ts:
// - numbers come only from the vendored data, never the paper's Table 2 (data/papers/rl-bhrp.ts);
// - text is --ink-1/--ink-3 on --draft-ph, in the mono subset;
// - `meet`, never `slice` (workshop thumbs run 1.75:1 to 3.6:1);
// - the gallery's three draw nothing below FLOOR;
// - each svg is role=img with an aria-label built from its printed values.
// Pure: returns markup, touches no DOM.
import type { macbootSections } from '../data/vendor/macbootSections';
import type { offchartPositioning } from '../data/vendor/offchartPositioning';
import type { rlBhrpWealth } from '../data/vendor/rlBhrpWealth';
import type { witnessFacets } from '../data/vendor/witnessFacets';
import { expandingPercentile, shareOf } from './positioning';
import { band, cumulative, linearScale, nudgeLabels, pointwiseMedian } from './wealth';

const INK = 'var(--ink-1)', DIM = 'var(--ink-3)';
const line = (a: number) => `rgba(var(--draft-line-rgb),${a})`;
const hi = (a?: number) => (a === undefined ? 'rgb(var(--draft-hi-rgb))' : `rgba(var(--draft-hi-rgb),${a})`);

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const r1 = (n: number) => String(Math.round(n * 10) / 10);
const pts = (xy: readonly [number, number][]) => xy.map(([x, y]) => `${r1(x)},${r1(y)}`).join(' ');

/** The lowest y a gallery picture draws at. The gallery's name tag covers the band below it at the left — from
 *  y≈179 on the 240x160 phone card, ≈192 on the 330x220 one, out to x≈122 for an 8-letter name; the test derives
 *  that footprint from the tag's CSS and holds every mark and word of the three clear of it. */
const FLOOR = 176;

function svg(label: string, body: string): string {
  return `<svg viewBox="0 0 350 220" role="img" aria-label="${esc(label)}"`
    + ` style="font-family:var(--font-mono);background:var(--draft-ph)">${body}</svg>`;
}

interface TextStyle { fill?: string; size?: number; anchor?: 'end' | 'middle' }
const tspan = (x: number, y: number | null, s: string, { fill = INK, size = 10 }: TextStyle = {}) =>
  `<tspan x="${r1(x)}"${y === null ? '' : ` y="${r1(y)}"`} style="fill:${fill};font-size:${size}px">${esc(s)}</tspan>`;
const text = (x: number, y: number, s: string, { fill = INK, size = 10, anchor }: TextStyle = {}) =>
  `<text x="${r1(x)}" y="${r1(y)}"${anchor ? ` text-anchor="${anchor}"` : ''} style="fill:${fill};font-size:${size}px">${esc(s)}</text>`;

// ── rl-bhrp ─────────────────────────────────────────────────────────────────────────────────────────────────

/** The out-of-sample wealth curve of rl-bhrp's committed REPRODUCTION run: the RL runs as a min-max band, their
 *  month-by-month median (lib/wealth.ts's rule for any page that draws this run), BHRP and the benchmark, each
 *  labelled with its final wealth. */
export function wealthSvg(d: typeof rlBhrpWealth): string {
  const runs = d.rlSeeds.map(cumulative);
  const med = pointwiseMedian(runs), { lo: bottom, hi: top } = band(runs);
  const bhrp = cumulative(d.bhrp), bench = cumulative(d.benchmark);
  const all = [...runs, bhrp, bench].flat();
  const wMin = Math.min(...all), wMax = Math.max(...all), pad = (wMax - wMin) * 0.04;
  const X0 = 16, X1 = 250, Y0 = 56, Y1 = FLOOR - 18;
  const x = linearScale(0, med.length - 1, X0, X1), y = linearScale(wMin - pad, wMax + pad, Y1, Y0);
  const curve = (w: readonly number[]) => w.map((v, i) => [x(i), y(v)] as [number, number]);

  // End labels at each line's final wealth, nudged apart where two would overlap.
  const ends = [{ w: med.at(-1)!, name: 'RL-BHRP' }, { w: bhrp.at(-1)!, name: 'BHRP' }, { w: bench.at(-1)!, name: 'benchmark' }];
  const endY = nudgeLabels(ends.map((l) => y(l.w) + 3), 11);

  // The x labels are the years of the returns' own dates; wealth starts at 1 the month before the first of them.
  const yr = (s: string) => s.slice(0, 4);
  const finals = runs.map((s) => s.at(-1)!);
  const label = `Out-of-sample wealth of rl-bhrp's reproduction run, ${yr(d.dates[0])} to ${yr(d.dates.at(-1)!)}, `
    + `from a start of 1: RL-BHRP, the month-by-month median of ${d.rlSeeds.length} runs, ends at ${med.at(-1)!.toFixed(2)}, `
    + `BHRP at ${bhrp.at(-1)!.toFixed(2)} and the benchmark at ${bench.at(-1)!.toFixed(2)}; `
    + `the runs end between ${Math.min(...finals).toFixed(2)} and ${Math.max(...finals).toFixed(2)}.`;
  return svg(label, [
    text(16, 28, 'Out-of-sample wealth · reproduction run'),
    text(16, 42, `RL-BHRP: median of ${d.rlSeeds.length} runs, shaded min to max`, { fill: DIM, size: 9 }),
    `<line x1="${X0}" x2="${X1}" y1="${r1(y(1))}" y2="${r1(y(1))}" style="stroke:${line(0.3)}" stroke-dasharray="2 3"/>`,
    `<polygon points="${pts([...curve(top), ...curve(bottom).reverse()])}" style="fill:${hi(0.18)}"/>`,
    `<polyline points="${pts(curve(bench))}" style="fill:none;stroke:${line(0.5)}" stroke-width="1.2" stroke-dasharray="3 2"/>`,
    `<polyline points="${pts(curve(bhrp))}" style="fill:none;stroke:${line(0.85)}" stroke-width="1.2"/>`,
    `<polyline points="${pts(curve(med))}" style="fill:none;stroke:${hi()}" stroke-width="1.6"/>`,
    ...ends.map((l, i) => `<text style="fill:${INK};font-size:9px">${tspan(256, endY[i], l.w.toFixed(2), { size: 9 })}`
      + `${tspan(282, null, l.name, { fill: DIM, size: 9 })}</text>`),
    text(X0, FLOOR - 4, yr(d.dates[0]), { fill: DIM, size: 9 }),
    text(X1, FLOOR - 4, yr(d.dates.at(-1)!), { fill: DIM, size: 9, anchor: 'end' }),
  ].join(''));
}

// ── offchart ────────────────────────────────────────────────────────────────────────────────────────────────

/** offchart's reading of one cohort: its net position as a share of open interest, ranked by an expanding
 *  percentile over the whole series, blank for the first year (minHistory 52). Top and bottom deciles shaded. */
export function positioningSvg(d: typeof offchartPositioning): string {
  const pct = expandingPercentile(shareOf(d.net, d.oi), 52);
  const X0 = 16, X1 = 334, Y0 = 54, Y1 = FLOOR - 18;
  const x = (i: number) => X0 + ((X1 - X0) * i) / (d.weeks.length - 1);
  const y = (p: number) => Y1 - ((Y1 - Y0) * p) / 100;
  let path = '', gap = true, end: [number, number] | null = null, last = -1;
  for (let i = 0; i < pct.length; i++) {
    const p = pct[i];
    if (p === null) { gap = true; continue; }
    path += `${gap ? 'M' : 'L'}${r1(x(i))} ${r1(y(p))}`;
    gap = false;
    end = [x(i), y(p)];
    last = i;
  }
  const decile = (from: number, fill: string) =>
    `<rect class="decile" x="${X0}" y="${r1(y(from))}" width="${X1 - X0}" height="${r1(y(from - 10) - y(from))}" style="fill:${fill}"/>`;
  const y0 = d.weeks[0].slice(0, 4), y1 = d.weeks.at(-1)!.slice(0, 4);
  const label = `${d.cohort}, ${d.market}: net position as a share of open interest, ranked as a percentile `
    + `(0–100) of its own history, weekly from ${y0} to ${y1}, the first year blank, the top and bottom deciles `
    + 'shaded. CFTC data, offchart\'s method.'
    + (last < 0 ? '' : ` Latest, ${d.weeks[last]}: percentile ${Math.round(pct[last]!)}.`);

  return svg(label, [
    // one caption, on two lines at its separator: at 10px the sentence is wider than the picture
    `<text style="fill:${INK};font-size:10px">${tspan(16, 28, `${d.cohort}, ${d.market}`)}${tspan(16, 42, 'CFTC data, offchart\'s method', { fill: DIM, size: 9 })}</text>`,
    decile(100, hi(0.1)),
    decile(10, line(0.08)),
    `<line x1="${X0}" x2="${X1}" y1="${r1(y(50))}" y2="${r1(y(50))}" style="stroke:${line(0.2)}" stroke-dasharray="2 3"/>`,
    `<path d="${path}" style="fill:none;stroke:${hi()}" stroke-width="1.1" stroke-linejoin="round"/>`,
    end ? `<circle cx="${r1(end[0])}" cy="${r1(end[1])}" r="2.2" style="fill:${hi()}"/>` : '',
    text(X0, FLOOR - 4, y0, { fill: DIM, size: 9 }),
    text(175, FLOOR - 4, 'percentile, 0–100 · deciles shaded', { fill: DIM, size: 9, anchor: 'middle' }),
    text(X1, FLOOR - 4, y1, { fill: DIM, size: 9, anchor: 'end' }),
  ].join(''));
}

// ── witness ─────────────────────────────────────────────────────────────────────────────────────────────────

/** An excerpt of witness's committed example output: its header line, then the most-observed facets with their
 *  observation counts (as bars) and confidence. */
export function facetsSvg(d: typeof witnessFacets): string {
  const most = Math.max(...d.top.map((f) => f.observations));
  // rows from y=66, the last bar (5 to 8 under its row's baseline) ending on FLOOR
  const step = Math.min(28, (FLOOR - 8 - 66) / Math.max(1, d.top.length - 1));
  const label = `${d.facets} facets distilled from ${d.observations} observations, in witness's example output. `
    + `The most observed: ${d.top.map((f) => `${f.name.replace(/_/g, ' ')}, ${f.observations} observations, `
      + `confidence ${f.confidence.toFixed(2)}`).join('; ')}.`;
  return svg(label, [
    text(16, 28, `${d.facets} facets distilled from ${d.observations} observations`),
    text(16, 42, 'facets.md, most observed first', { fill: DIM, size: 9 }),
    ...d.top.flatMap((f, i) => {
      const y = 66 + i * step;
      return [
        text(16, y, f.name),
        text(334, y, `${f.observations} obs · ${f.confidence.toFixed(2)}`, { fill: DIM, size: 9, anchor: 'end' }),
        `<rect x="16" y="${r1(y + 5)}" width="318" height="3" style="fill:${line(0.1)}"/>`,
        `<rect x="16" y="${r1(y + 5)}" width="${r1((318 * f.observations) / most)}" height="3" style="fill:${hi(0.6)}"/>`,
      ];
    }),
  ].join(''));
}

// ── macboot ─────────────────────────────────────────────────────────────────────────────────────────────────

/** `s` cut to `max` characters at a ", " item boundary, with an ellipsis — whole items or nothing. */
function fit(s: string, max: number): string {
  if (s.length <= max) return s;
  const items = s.split(', ');
  let out = items[0];
  for (const it of items.slice(1)) {
    if (`${out}, ${it}`.length + 1 > max) break;
    out += `, ${it}`;
  }
  return out.length + 1 <= max ? `${out}…` : `${s.slice(0, max - 1)}…`;
}

/** A real excerpt of macboot's README: its table of sections, one row each. The third column is shortened at
 *  an item boundary to the 33 characters of 9px mono (5.4 units each) the picture has room for. */
export function sectionsSvg(d: typeof macbootSections): string {
  const { rows } = d;
  const step = rows.length > 1 ? Math.min(16, (190 - 62) / (rows.length - 1)) : 0;
  const label = `macboot's README, its table of sections, §${rows[0][0]} to §${rows.at(-1)![0]}: `
    + `${rows.map(([sec, category, what]) => `§${sec} ${category}: ${what}`).join('; ')}.`;
  return svg(label, [
    text(16, 28, 'macboot / README.md', { size: 10.5 }),
    text(16, 42, `the table of sections, §${rows[0][0]} to §${rows.at(-1)![0]}`, { fill: DIM, size: 9 }),
    ...rows.map(([sec, category, what], i) => `<text style="fill:${INK};font-size:9px">`
      + tspan(16, 62 + i * step, `§${sec}`, { fill: DIM, size: 9 })
      + tspan(34, null, category, { size: 9 })
      + tspan(154, null, fit(what, 33), { fill: DIM, size: 9 })
      + '</text>'),
  ].join(''));
}
