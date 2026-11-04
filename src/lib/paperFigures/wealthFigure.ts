// src/lib/paperFigures/wealthFigure.ts
// RL-BHRP's Figure 2, the growth of $1 in the second author's reproduction, and its miniature for the /research
// index card: HTML strings drawn at build time from REPRO (data/papers/rl-bhrp.ts). Marks carry classes and the
// page's CSS colours them, so one drawing re-themes with the sheet. Pure.
//
// What the markup promises the page's CSS and script:
// - two drawings of one figure, svg.wide and svg.narrow, for the CSS to swap at the phone breakpoint. Each carries
//   its frame on data-g ("W x0 x1 y0 y1 lo hi"): month i is at x0 + (x1 - x0) * i / (points - 1), and a value v
//   at y1 - (y1 - y0) * (v - lo) / (hi - lo).
// - g.f-draw, a mask over the data and under the grid, filled with the sheet's ground (--sheet-ground; --paper is
//   the dark theme's TEXT colour). It is hidden in the markup, so nothing waits on a script: the draw shows it,
//   slides g.f-mask right by its data-d, and hides it again. It is clipped to where it lies at rest, so the slide
//   never paints outside the drawing, whatever the svg's overflow.
// - g.f-labels, the end labels; g.f-read, the readout's hairline and dots at the origin, unshown (opacity 0).
// - .f-plot, the readout's target: the three series it reads on data-rl, data-bhrp and data-bench (4 dp; point 0
//   is the start, point i the month-end data-dates[i - 1]), its legend .f-tip and a live region.
import { linearScale, niceDomain, nudgeLabels } from '../wealth';

export interface WealthSeries {
  dates: readonly string[];   // the month-ends; every series has one point more, the start
  runs: number;               // how many runs `rl` is the median of, and `lo`/`hi` the band of
  rl: readonly number[];
  lo: readonly number[];
  hi: readonly number[];
  bhrp: readonly number[];
  bench: readonly number[];
}

interface Frame { W: number; H: number; x0: number; x1: number; y0: number; y1: number }
// x1 leaves room right of the plot for the end labels, which have to end inside W when set in Georgia
// (--font-display, the widest face its stack names); tests/paperFigures.test.ts measures them.
const WIDE = { W: 612, H: 330, x0: 34, x1: 512, y0: 30, y1: 296, fs: 12.5 };
const NARROW = { W: 350, H: 262, x0: 28, x1: 260, y0: 26, y1: 234, fs: 11 };
const MINI: Frame = { W: 320, H: 200, x0: 10, x1: 310, y0: 14, y1: 186 };

const EDGE = 18;      // the mask's soft leading edge
const MID = 0.35;     // a line of figures is centred about 0.35em above its baseline
const GROUND = 'var(--sheet-ground)';

const r1 = (n: number) => String(Math.round(n * 10) / 10);
const final = <T>(s: readonly T[]) => s[s.length - 1];
const month = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleString('en', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** The frame every drawing of `d` shares: a twentieth of the data's range clear above and below it, out to the
 *  next 0.05, with grid lines at the multiples of 0.5 inside. */
function domain(d: WealthSeries) {
  const all = [d.lo, d.hi, d.rl, d.bhrp, d.bench].flat();
  const lo = Math.min(...all), hi = Math.max(...all), air = (hi - lo) / 20;
  const f = niceDomain(lo - air, hi + air, 0.05);
  return { lo: f.lo, hi: f.hi, grid: niceDomain(f.lo, f.hi, 0.5).ticks.filter((t) => t >= f.lo && t <= f.hi) };
}

/** The band, the three lines and the mask, then the grid over them, so only the data draws in. */
function series(d: WealthSeries, f: Frame, dom: ReturnType<typeof domain>, mask: { id: string; top: number; bottom: number }) {
  const x = linearScale(0, d.rl.length - 1, f.x0, f.x1), y = linearScale(dom.lo, dom.hi, f.y1, f.y0);
  const pts = (s: readonly number[]) => s.map((v, i) => `${r1(x(i))},${r1(y(v))}`);
  const line = (cls: string, s: readonly number[]) => `<polyline class="${cls}" fill="none" points="${pts(s).join(' ')}"/>`;
  const h = mask.bottom - mask.top, w = f.x1 - f.x0 + 6;
  // The slide carries the mask a plot's width past x1, out of the drawing and over whatever sits beside the figure
  // once its svg overflows; the clip ends the mask where it ends at rest, so sliding can only uncover.
  const svg = `<polygon class="f-band" points="${[...pts(d.hi), ...pts(d.lo).reverse()].join(' ')}"/>`
    + line('f-bench', d.bench) + line('f-bhrp', d.bhrp) + line('f-rl', d.rl)
    + `<g class="f-draw" aria-hidden="true" visibility="hidden" clip-path="url(#${mask.id}-clip)">`
    + `<defs><linearGradient id="${mask.id}"><stop offset="0" style="stop-color:${GROUND};stop-opacity:0"/><stop offset="1" style="stop-color:${GROUND}"/></linearGradient>`
    + `<clipPath id="${mask.id}-clip"><rect x="0" y="${mask.top}" width="${f.x0 + w}" height="${h}"/></clipPath></defs>`
    + `<g class="f-mask" data-d="${w + EDGE}">`
    + `<rect x="${f.x0 - EDGE}" y="${mask.top}" width="${EDGE}" height="${h}" fill="url(#${mask.id})"/>`
    + `<rect x="${f.x0}" y="${mask.top}" width="${w}" height="${h}" style="fill:${GROUND}"/></g></g>`
    + dom.grid.map((v) => `<line class="f-grid${v === 1 ? ' f-one' : ''}" x1="${f.x0}" x2="${f.x1}" y1="${r1(y(v))}" y2="${r1(y(v))}"/>`).join('');
  return { x, y, svg };
}

function drawing(d: WealthSeries, f: typeof WIDE, cls: string, dom: ReturnType<typeof domain>, label: string): string {
  const { x, y, svg } = series(d, f, dom, { id: `fm-${cls}`, top: f.y0 - 4, bottom: f.y1 - 1 });
  // the first point is the start of the first month, so a year begins at the point after a December's month-end
  const years = d.dates.flatMap((date, k) => (date.endsWith('-12-31') ? [{ i: k + 1, year: Number(date.slice(0, 4)) + 1 }] : []));
  const ends = [
    { v: final(d.rl), name: 'RL-BHRP', cls: ' f-lab-rl' },
    { v: final(d.bhrp), name: 'BHRP', cls: '' },
    { v: final(d.bench), name: 'Benchmark', cls: '' },
  ];
  const at = nudgeLabels(ends.map((e) => y(e.v) + f.fs * MID), f.fs + 3);
  // "reproduction" sits on the line above RL-BHRP's label, which is clear only while that label is the top one
  if (Math.min(...at) !== at[0]) throw new Error("wealthFigure: RL-BHRP's end label is not the top one, so its qualifier would sit on another");
  const tx = f.x1 + 8;
  return `<svg class="${cls}" viewBox="0 0 ${f.W} ${f.H}" role="img" aria-label="${label}" style="font-size:${f.fs}px"`
    + ` data-g="${[f.W, f.x0, f.x1, f.y0, f.y1, dom.lo, dom.hi].join(' ')}">`
    + `<line class="f-axis" x1="${f.x0}" x2="${f.x1}" y1="${f.y1}" y2="${f.y1}"/>`
    + years.map(({ i, year }) => `<line class="f-axis" x1="${r1(x(i))}" x2="${r1(x(i))}" y1="${f.y1}" y2="${f.y1 + 5}"/>`
      + `<text class="f-tick" x="${r1(x(i))}" y="${f.y1 + 7 + f.fs}" text-anchor="middle">${year}</text>`).join('')
    + svg
    + `<text class="f-ylab" x="${f.x0}" y="${f.y0 - 10}">Growth of $1</text>`
    + dom.grid.map((v) => `<text class="f-tick" x="${f.x0 - 7}" y="${r1(y(v) + f.fs * MID)}" text-anchor="end">${v.toFixed(1)}</text>`).join('')
    + `<g class="f-labels"><text class="f-qual" x="${tx}" y="${r1(at[0] - f.fs - 1)}">reproduction</text>`
    + ends.map((e, k) => `<text class="f-end" x="${tx}" y="${r1(at[k])}"><tspan class="f-name${e.cls}">${e.name}</tspan>`
      + `<tspan class="f-val" dx="5">${e.v.toFixed(2)}</tspan></text>`).join('')
    + '</g>'
    + `<g class="f-read" aria-hidden="true" opacity="0"><line class="f-hair" x1="0" x2="0" y1="${f.y0 - 4}" y2="${f.y1}"/>`
    + '<circle class="f-dot f-dot-bench" r="2.6"/><circle class="f-dot f-dot-bhrp" r="2.6"/><circle class="f-dot f-dot-rl" r="3"/></g>'
    + '</svg>';
}

/** `full` is Figure 2 itself: the figure, its readout's markup and its caption. `mini` is the series alone, no
 *  text, for the index card, which says what it is in its own caption. */
export function wealthFigure(d: WealthSeries, size: 'full' | 'mini'): string {
  const dom = domain(d);
  if (size === 'mini') {
    const f = MINI;
    return `<svg class="mini" viewBox="0 0 ${f.W} ${f.H}" aria-hidden="true" focusable="false">`
      + `${series(d, f, dom, { id: 'fm-mini', top: f.y0 - 6, bottom: f.y1 + 4 }).svg}</svg>`;
  }
  const from = month(d.dates[0]), to = month(final(d.dates));
  const label = `Growth of $1 in the second author’s reproduction, ${from} to ${to}: RL-BHRP, the month-by-month median of `
    + `${d.runs} runs, ends at $${final(d.rl).toFixed(2)}, BHRP at $${final(d.bhrp).toFixed(2)} and the benchmark at $${final(d.bench).toFixed(2)}.`;
  const data = (s: readonly number[]) => s.map((v) => Number(v.toFixed(4))).join(' ');
  return '<figure class="fig" id="figure-2">'
    + '<div class="f-plot" tabindex="0" role="group" aria-label="Plot of Figure 2. Hover, or use the left and right arrow keys, to read the three values month by month."'
    + ` data-dates="${d.dates.join(' ')}" data-rl="${data(d.rl)}" data-bhrp="${data(d.bhrp)}" data-bench="${data(d.bench)}">`
    + drawing(d, WIDE, 'wide', dom, label) + drawing(d, NARROW, 'narrow', dom, label)
    + `<div class="f-tip" aria-hidden="true"><p class="f-tip-d"></p><dl><dt class="rl">RL-BHRP <i>median of ${d.runs} runs</i></dt>`
    + '<dd data-k="rl"></dd><dt>BHRP</dt><dd data-k="bhrp"></dd><dt>Benchmark</dt><dd data-k="bench"></dd></dl></div>'
    + '<span class="sr-only" aria-live="polite"></span></div>'
    + '<figcaption><span class="fig-no">Figure 2.</span> <span class="claim">A reproduction, not the paper’s run:</span> '
    + `growth of $1, ${from} to ${to} (the last month is partial). The paper’s own curve is its Figure 1 (paper §4.1); it `
    + 'does not release the monthly series, so this figure redraws the second author’s reproduction instead. The red line is '
    + `the month-by-month median of the reproduction’s ${d.runs} training runs and the band their range: they ended between `
    + `$${final(d.lo).toFixed(2)} and $${final(d.hi).toFixed(2)}. Some of its settings were chosen after the test period had `
    + 'been seen, so it is not fresh evidence. Source: <a href="https://github.com/IngTian/rl-bhrp">IngTian/rl-bhrp</a>, '
    + '<code>results/shared-global</code>.</figcaption></figure>';
}
