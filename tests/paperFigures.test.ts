// tests/paperFigures.test.ts
// RL-BHRP's two figures, its Table 1 and the index card's miniature, as the strings the build inlines (each the
// drawing alone: the <figure> and its caption are the explainer's). Figure 2 is drawn from the reproduction's series
// (REPRO): its frame is derived from them, its labels never collide, the mask that draws it is the sheet's ground in
// either theme, and its name says every value it prints. Figure 1 sets its maths as MathML. Table 1 is Table 2 whole.
import { describe, expect, it } from 'vitest';
import { PAPER_DATA } from '../src/data/papers';
import { REPRO, TABLE2 } from '../src/data/papers/rl-bhrp';
import { rlBhrpWealth } from '../src/data/vendor/rlBhrpWealth';
import { FIGURE_NAME } from '../src/lib/paperMarkdown/names';
import { metricsTable } from '../src/lib/paperFigures/metricsTable';
import { pipelineFigure } from '../src/lib/paperFigures/pipelineFigure';
import { wealthFigure } from '../src/lib/paperFigures/wealthFigure';
import { readoutWhen } from '../src/lib/paperPage';
import type { WealthSeries } from '../src/lib/wealth';

// as RL-BHRP registers it: named by its :::figure, the reproduction the second author's
const AS_PLACED = { name: FIGURE_NAME, author: 'the second author' };
const full = wealthFigure(REPRO, 'full', AS_PLACED), mini = wealthFigure(REPRO, 'mini');
const pipe = pipelineFigure();
const table = metricsTable(TABLE2);

const svgs = (html: string) => [...html.matchAll(/<svg\b[\s\S]*?<\/svg>/g)].map((m) => m[0]);
const open = (svg: string) => svg.match(/^<svg\b[^>]*>/)![0];
const attr = (tag: string, name: string) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
const frame = (svg: string) => {
  const [W, x0, x1, y0, y1, lo, hi] = attr(open(svg), 'data-g')!.split(' ').map(Number);
  return { W, x0, x1, y0, y1, lo, hi };
};
const marks = (svg: string) => [...svg.matchAll(/<poly(?:line|gon)\b[^>]*\spoints="([^"]*)"/g)]
  .flatMap((m) => m[1].split(' ').map((p) => p.split(',').map(Number) as [number, number]));
const values = (d: WealthSeries) => [d.lo, d.hi, d.rl, d.bhrp, d.bench].flat();
// the same run with one month far outside the real one's range, so a fixed frame would clip it
const stretched: WealthSeries = {
  ...REPRO,
  hi: REPRO.hi.map((v, i) => (i === 30 ? 3.4 : v)),
  bench: REPRO.bench.map((v, i) => (i === 3 ? 0.3 : v)),
};
// three lines ending at one value: the end labels have to be pushed apart
const tied: WealthSeries = { ...REPRO, bhrp: REPRO.rl, bench: REPRO.rl };
// Georgia's advance widths in 2048ths of an em (macOS's Georgia.ttf, hmtx), for the glyphs the end labels use.
// The face has no kern or GPOS table, so a run's width is the sum of its advances.
const GEORGIA: Record<string, number> = {
  '-': 766, '.': 552, 0: 1257, 1: 880, 2: 1144, 3: 1130, 4: 1157, 5: 1082, 6: 1159, 7: 1029, 8: 1221, 9: 1159,
  B: 1339, H: 1669, L: 1236, P: 1249, R: 1437, a: 1032, c: 930, e: 990, h: 1192, k: 1097, m: 1804, n: 1210, r: 839,
};
const georgia = (s: string, fs: number) => [...s].reduce((w, c) => {
  if (!(c in GEORGIA)) throw new Error(`no Georgia advance for "${c}": add it from the font`);
  return w + GEORGIA[c];
}, 0) * fs / 2048;
/** Every element carrying the class `wide` or `narrow`, as tag.class.list. */
const variants = (html: string) => [...html.matchAll(/<(\w+)\b[^>]*\sclass="([^"]*)"/g)]
  .filter((m) => /\b(?:wide|narrow)\b/.test(m[2])).map((m) => [m[1], ...m[2].split(' ')].join('.'));

// That REPRO's line is the runs' median is held where it is drawn: projectVisuals.test.ts reads the median back from
// /projects' picture at every month, in a frame set by the band's extremes, against the vendored runs. Here, only
// what every drawing of it relies on.
describe('REPRO, the series the reproduction is drawn from', () => {
  it('counts every vendored run, and gives each series one point a month from $1, the median inside the band', () => {
    expect(REPRO.runs).toBe(rlBhrpWealth.rlSeeds.length);
    for (const s of [REPRO.rl, REPRO.lo, REPRO.hi, REPRO.bhrp, REPRO.bench]) {
      expect(s.length).toBe(REPRO.dates.length + 1);
      expect(s[0]).toBe(1);
    }
    REPRO.rl.forEach((w, i) => {
      expect(w).toBeGreaterThanOrEqual(REPRO.lo[i]);
      expect(w).toBeLessThanOrEqual(REPRO.hi[i]);
    });
  });
});

describe('Figure 2, the growth of $1', () => {
  it('has a wide and a narrow drawing, each with its frame on data-g', () => {
    expect(svgs(full).map((s) => attr(open(s), 'class'))).toEqual(['wide', 'narrow']);
  });

  for (const [name, d] of [['the reproduction', REPRO], ['a run far outside it', stretched]] as const) {
    it(`frames every point of ${name}: the domain is derived, and every mark is inside the plot`, () => {
      const lo = Math.min(...values(d)), hi = Math.max(...values(d));
      for (const svg of svgs(wealthFigure(d, 'full', AS_PLACED))) {
        const f = frame(svg);
        expect(f.lo).toBeLessThanOrEqual(lo);
        expect(f.hi).toBeGreaterThanOrEqual(hi);
        for (const [x, y] of marks(svg)) {
          expect(x).toBeGreaterThanOrEqual(f.x0);
          expect(x).toBeLessThanOrEqual(f.x1);
          expect(y).toBeGreaterThanOrEqual(f.y0);
          expect(y).toBeLessThanOrEqual(f.y1);
        }
      }
    });
  }

  it('draws its grid at the ticks of the domain, labelled', () => {
    for (const svg of svgs(full)) {
      const ticks = [...svg.matchAll(/<text class="f-tick"[^>]*text-anchor="end">([^<]*)</g)].map((m) => m[1]);
      expect(ticks).toEqual(['1.0', '1.5', '2.0']);
      expect(svg.match(/<line class="f-grid/g)).toHaveLength(ticks.length);
    }
  });

  for (const [name, d] of [['the reproduction', REPRO], ['three lines that end together', tied]] as const) {
    it(`keeps its end labels apart for ${name}, RL-BHRP's on top under its qualifier`, () => {
      for (const svg of svgs(wealthFigure(d, 'full', AS_PLACED))) {
        const fs = Number(open(svg).match(/font-size:([\d.]+)px/)![1]);
        const labels = [...svg.matchAll(/<text class="(f-end|f-qual)"[^>]*\sy="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g)]
          .map((m) => ({ kind: m[1], y: Number(m[2]), text: m[3] })).sort((a, b) => a.y - b.y);
        expect(labels.map((l) => l.kind)).toEqual(['f-qual', 'f-end', 'f-end', 'f-end']);
        expect(labels[1].text).toMatch(/RL-BHRP/);
        // a line of type is at most one em from its ascenders to its descenders
        for (let k = 1; k < labels.length; k++) expect(labels[k].y - labels[k - 1].y).toBeGreaterThanOrEqual(fs);
      }
    });
  }

  // "reproduction" is set on the line above RL-BHRP's label, which is clear only while that label is the top one.
  it('refuses a series whose RL-BHRP line does not end on top, rather than set its qualifier over another label', () => {
    expect(() => wealthFigure({ ...REPRO, rl: REPRO.bench, bench: REPRO.rl }, 'full', AS_PLACED)).toThrow(/not the top one/);
  });

  it('fits its end labels inside the drawing, set in Georgia, the widest face --font-display names', () => {
    for (const svg of svgs(full)) {
      const W = frame(svg).W, fs = Number(open(svg).match(/font-size:([\d.]+)px/)![1]);
      const ends = [...svg.matchAll(/<text class="f-end" x="([\d.]+)"[^>]*><tspan class="f-name[^"]*">([^<]*)<\/tspan><tspan class="f-val" dx="([\d.]+)">([^<]*)</g)];
      expect(ends).toHaveLength(3);
      for (const [, x, name, dx, v] of ends) {
        expect(Number(x) + georgia(name, fs) + Number(dx) + georgia(v, fs), `${name} ${v}`).toBeLessThanOrEqual(W);
      }
    }
  });

  it('clips the draw mask to where it lies at rest, inside the drawing, and slides it wholly out of the clip', () => {
    for (const svg of [...svgs(full), ...svgs(mini)]) {
      const W = Number(attr(open(svg), 'viewBox')!.split(' ')[2]);
      const id = attr(svg.match(/<g class="f-draw"[^>]*>/)![0], 'clip-path')!.match(/^url\(#([\w-]+)\)$/)![1];
      const box = (tag: string) => ['x', 'y', 'width', 'height'].map((k) => Number(attr(tag, k)));
      const [cx, cy, cw, ch] = box(svg.match(new RegExp(`<clipPath id="${id}"><rect\\b[^>]*>`))![0]);
      expect(cx).toBeGreaterThanOrEqual(0);
      expect(cx + cw).toBeLessThanOrEqual(W);
      const d = Number(attr(svg.match(/<g class="f-mask"[^>]*>/)![0], 'data-d'));
      const rects = [...svg.match(/<g class="f-mask"[\s\S]*?<\/g>/)![0].matchAll(/<rect\b[^>]*>/g)].map((m) => box(m[0]));
      expect(rects).toHaveLength(2);
      for (const [x, y, w, h] of rects) {
        expect([y, h]).toEqual([cy, ch]);
        expect(x + w).toBeLessThanOrEqual(cx + cw);    // at rest the mask ends inside the clip
        expect(x + d).toBeGreaterThanOrEqual(cx + cw);  // at the slide's end none of it is left inside the clip
      }
    }
  });

  it('draws in under a mask of the sheet\'s ground, never --paper (the dark theme\'s TEXT colour)', () => {
    expect(full).not.toContain('--paper');
    expect(mini).not.toContain('--paper');
    for (const svg of [...svgs(full), ...svgs(mini)]) {
      const mask = svg.match(/<g class="f-draw"[\s\S]*?<\/g>\s*<\/g>/)![0];
      const paints = [...mask.matchAll(/(?:fill|stop-color):([^;"]+)/g)].map((m) => m[1]);
      expect(paints.length).toBeGreaterThanOrEqual(3);   // the soft edge's two stops and the solid sheet
      for (const p of paints) expect(p).toBe('var(--sheet-ground)');
    }
  });

  it('waits on no script: the mask and the readout are hidden in the markup, for a script to show', () => {
    for (const svg of [...svgs(full), ...svgs(mini)]) expect(svg).toMatch(/<g class="f-draw" aria-hidden="true" visibility="hidden"[ >]/);
    for (const svg of svgs(full)) expect(svg).toMatch(/<g class="f-read" aria-hidden="true" opacity="0">/);
  });

  it('names every value it prints: its accessible name holds the three end values', () => {
    for (const svg of svgs(full)) {
      const name = attr(open(svg), 'aria-label')!;
      expect(attr(open(svg), 'role')).toBe('img');
      for (const v of ['2.13', '2.01', '1.91']) expect(name).toContain(v);
      for (const [, v] of svg.matchAll(/<tspan class="f-val"[^>]*>([^<]*)</g)) expect(name).toContain(v);
    }
  });

  it('carries the three series the readout places its dots by on data-*, to 4 dp', () => {
    const plot = full.match(/<div class="f-plot"[^>]*>/)![0];
    for (const k of ['rl', 'bhrp', 'bench'] as const) {
      const got = attr(plot, `data-${k}`)!.split(' ').map(Number);
      expect(got).toEqual(REPRO[k].map((v) => Number(v.toFixed(4))));
    }
    expect(full).not.toContain('<script');
  });

  // The readout is a pointer's, a tap's and a keyboard's. A screen reader in browse mode keeps the arrow keys for
  // itself, so the values are also a table, which browse mode reads as it reads any table, and which the readout
  // prints from, so the tip and the table cannot disagree. The band is exempt from 3:1 (WCAG 1.4.11) on the condition
  // that its values are text, and they are here: each point's lowest and highest run.
  it('gives every point as a row of a table: when it is, then each value as the readout prints it', () => {
    // hidden by its wrapper: on a table, .sr-only's 1px is only a minimum (distSmoke holds every page to that)
    const tbl = full.match(/<div class="sr-only"><table class="f-values">[\s\S]*?<\/table><\/div>/)?.[0] ?? '';
    expect(tbl, 'no table of values').not.toBe('');
    expect(tbl).toMatch(/<caption>[^<]*reproduction[^<]*<\/caption>/);
    expect([...tbl.matchAll(/<th scope="col">([^<]*)<\/th>/g)].map((m) => m[1]))
      .toEqual(['Date', `RL-BHRP, median of ${REPRO.runs} runs`, 'Lowest of the runs', 'Highest of the runs', 'BHRP', 'Benchmark']);
    const rows = [...tbl.matchAll(/<tr><th scope="row">([^<]*)<\/th>([\s\S]*?)<\/tr>/g)];
    expect(rows).toHaveLength(REPRO.rl.length);
    rows.forEach(([, when, cells], i) => {
      expect(when).toBe(readoutWhen(i, REPRO.dates, REPRO.dataEnd));
      const got = [...cells.matchAll(/<td data-k="(\w+)">([^<]*)<\/td>/g)].map((m) => [m[1], m[2]]);
      expect(got).toEqual((['rl', 'lo', 'hi', 'bhrp', 'bench'] as const).map((k) => [k, `$${REPRO[k][i].toFixed(2)}`]));
    });
    expect(rows.at(-1)![1]).toContain('where the data end');
    expect(full).toContain(`median of ${REPRO.runs} runs`);   // the readout's legend
    expect(full).toMatch(/<dd data-k="band"><\/dd>/);
    expect(REPRO.runs).toBe(10);
  });

  // The explainer numbers the figure and the record says whose the reproduction is, so the drawing is told both: the
  // same series placed as a sole author's Figure 5 says so wherever it names either.
  it("names itself and the reproduction's author as it is told", () => {
    const other = wealthFigure(REPRO, 'full', { name: 'Figure 5', author: 'its author' });
    expect(other).toContain('<caption>Figure 5’s values, month by month, in its author’s reproduction</caption>');
    expect(attr(other.match(/<div class="f-plot"[^>]*>/)![0], 'data-name')).toBe('Figure 5');
    for (const svg of svgs(other)) expect(attr(open(svg), 'aria-label')).toMatch(/^Growth of \$1 in its author’s reproduction, /);
    expect(other).not.toMatch(/second author|Figure 2/);
  });

  // Without a script the plot reads nothing, so it is no control and promises nothing: the script that makes it work
  // makes it focusable and says how it works.
  it('is a plain block in the markup: no tab stop, role or instructions until the readout starts', () => {
    const plot = full.match(/<div class="f-plot"[^>]*>/)![0];
    for (const a of ['tabindex', 'role', 'aria-label']) expect(attr(plot, a), a).toBeUndefined();
  });

  // The caption is prose, so the explainer writes it (a :::figure container); the plugin makes the <figure>.
  it('is the drawing alone: no <figure>, no caption', () => {
    expect(full).not.toMatch(/<\/?figure\b|<figcaption/);
    expect(full.startsWith('<div class="f-plot"')).toBe(true);
  });
});

describe('Figure 2\'s miniature, for the index card', () => {
  it('is the series alone: no text, hidden from assistive tech, inside its frame', () => {
    expect(svgs(mini)).toHaveLength(1);
    expect(mini).not.toContain('<text');
    expect(attr(open(mini), 'aria-hidden')).toBe('true');
    for (const name of ['f-band', 'f-bench', 'f-bhrp', 'f-rl']) expect(mini).toContain(`class="${name}"`);
    const [, , W, H] = attr(open(mini), 'viewBox')!.split(' ').map(Number);
    for (const [x, y] of marks(mini)) {
      expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(W);
      expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(H);
    }
  });
});

describe('Figure 1, the pipeline', () => {
  const outsideMath = pipe.replace(/<math\b[\s\S]*?<\/math>/g, '');

  it('sets its symbols as build-time MathML: Σ and θ are <math>, and no SVG <text> holds a Greek letter', () => {
    expect(pipe).toContain('<math');
    expect(pipe).toMatch(/<mi[^>]*>Σ<\/mi>/);
    expect(pipe).toMatch(/<mi[^>]*>θ<\/mi>/);
    expect(outsideMath).not.toMatch(/[\u0370-\u03ff]/);   // the Greek block
    expect(pipe).not.toContain('<text');
    expect(pipe).not.toContain('katex-error');
  });

  it("draws six arrows, the policy's state dashed, and names every stage, in both drawings", () => {
    for (const art of pipe.match(/<div class="pp-art (?:wide|narrow)"[\s\S]*?<\/svg>/g)!) {
      expect(art.match(/<path class="p-arrow[^"]*"/g)).toHaveLength(6);
      expect(art.match(/<path class="p-arrow p-dash"/g)).toHaveLength(1);
    }
    for (const word of ['Bayesian layer', 'Policy', 'Reward', 'PPO update', 'BHRP', 'the comparator']) {
      expect(outsideMath.split(`>${word}<`).length - 1, word).toBe(2);
    }
  });

  // Its caption, in the explainer, says everything the drawing does, and the <figure> takes its name from it, so the
  // drawings are hidden from assistive tech rather than read as a second copy of the caption.
  it('is the drawing alone, hidden from assistive tech: no <figure>, no caption', () => {
    expect(pipe).not.toMatch(/<\/?figure\b|<figcaption|role="img"|aria-labelledby/);
    expect(pipe.match(/<div class="pp-art (?:wide|narrow)" aria-hidden="true"/g)).toHaveLength(2);
  });
});

describe("Table 1, the paper's Table 2", () => {
  const rows = [...table.matchAll(/<tr\b([^>]*)><th scope="row">([\s\S]*?)<\/th>((?:<td>[\s\S]*?<\/td>){3})<\/tr>/g)];
  const cells = (r: RegExpMatchArray) => [...r[3].matchAll(/<td>([\s\S]*?)<\/td>/g)].map((m) => m[1]);
  const row = (metric: string) => rows[TABLE2.findIndex((r) => r.metric === metric)];

  it("is a booktabs table of all 18 rows, in the paper's order, under a head naming the three portfolios", () => {
    expect(table).toMatch(/^<table class="bt">/);
    expect(table).toContain('<thead><tr><th scope="col">Metric</th><th scope="col">RL-BHRP</th><th scope="col">BHRP</th>'
      + '<th scope="col">Benchmark</th></tr></thead>');
    expect(rows).toHaveLength(18);
    expect(row('Total Cumulative Return')[2]).toBe('Total cumulative return (%)');
    // the one gap: between the window's three rows and the figures
    expect(rows.map((r) => r[1])).toEqual(rows.map((_, k) => (k === 3 ? ' class="gap"' : '')));
  });

  it('prints every figure from TABLE2 at two decimals, a percentage as one, with a true minus', () => {
    expect(cells(row('Total Cumulative Return'))).toEqual(['119.96', '101.37', '91.41']);
    expect(cells(row('Max Drawdown'))).toEqual(['−20.33', '−19.10', '−18.32']);
    expect(cells(row('Sharpe'))).toEqual(['0.90', '0.85', '0.76']);
    expect(cells(row('Periods'))).toEqual(['67', '67', '67']);
    expect(table).not.toMatch(/>-\d/);   // a hyphen is not a minus
  });

  it('marks the undefined information ratio, and gives each date long and short, for the phone', () => {
    expect(cells(row('Information Ratio'))[2]).toBe('—<sup>a</sup>');
    expect(cells(row('Start'))[0]).toBe('<span class="d-iso">2020-02-29</span><span class="d-short">Feb 2020</span>');
  });

  it('colours and bolds nothing: no class on a cell, no <b> or <strong>', () => {
    expect(table).not.toMatch(/<td\b[^>]+>|<b>|<strong>/);
  });
});

describe('both figures', () => {
  for (const [name, html] of [['Figure 2', full], ['the miniature', mini], ['Figure 1', pipe], ['Table 1', table]] as const) {
    it(`${name} prints no CJK and never says "published"`, () => {
      expect(html).not.toMatch(/[\u3000-\u9fff]/);   // the CJK block
      expect(html).not.toMatch(/published/i);
    });
  }

  // The page swaps the drawings with one rule by class, `figure .narrow`: Figure 1's must hide the div that holds its
  // words, not only its svg. So the classes sit on each drawing's outermost element and nowhere else.
  it('mark their two drawings wide and narrow, on the element that holds the whole drawing', () => {
    expect(variants(full)).toEqual(['svg.wide', 'svg.narrow']);
    expect(variants(pipe)).toEqual(['div.pp-art.wide', 'div.pp-art.narrow']);
    expect(variants(mini)).toEqual([]);
  });

  // Figure 2 is registered naming itself by FIGURE_NAME, for its :::figure to number, and the reproduction by the
  // owner's place among the record's authors, as the page's "written by" line says it.
  it("are RL-BHRP's, registered under its slug: the two figures and the card's miniature", () => {
    expect(PAPER_DATA['rl-bhrp'].figures).toEqual({ wealth: full, pipeline: pipe, metrics: table });
    expect(PAPER_DATA['rl-bhrp'].thumb?.svg).toBe(mini);
    expect(PAPER_DATA['rl-bhrp'].thumb?.caption).toBe('Growth of $1 in the second author’s reproduction, not the paper’s run');
  });
});
