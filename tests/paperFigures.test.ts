// tests/paperFigures.test.ts
// RL-BHRP's two figures and the index card's miniature, as the strings the build inlines. Figure 2 is drawn from
// the reproduction's series (REPRO): its frame is derived from them, its labels never collide, the mask that
// draws it is the sheet's ground in either theme, and its name says every value it prints. Figure 1 sets its
// maths as MathML.
import { describe, expect, it } from 'vitest';
import { PAPER_DATA } from '../src/data/papers';
import { REPRO } from '../src/data/papers/rl-bhrp';
import { rlBhrpWealth } from '../src/data/vendor/rlBhrpWealth';
import { pipelineFigure } from '../src/lib/paperFigures/pipelineFigure';
import { wealthFigure, type WealthSeries } from '../src/lib/paperFigures/wealthFigure';
import { band, cumulative, pointwiseMedian } from '../src/lib/wealth';

const full = wealthFigure(REPRO, 'full'), mini = wealthFigure(REPRO, 'mini'), pipe = pipelineFigure();

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

describe('REPRO, the series the reproduction is drawn from', () => {
  it('is the month-by-month median of the runs, their band, BHRP and the benchmark, from $1', () => {
    const runs = rlBhrpWealth.rlSeeds.map(cumulative);
    expect(REPRO.runs).toBe(rlBhrpWealth.rlSeeds.length);
    expect(REPRO.rl).toEqual(pointwiseMedian(runs));
    expect({ lo: REPRO.lo, hi: REPRO.hi }).toEqual(band(runs));
    expect(REPRO.bhrp).toEqual(cumulative(rlBhrpWealth.bhrp));
    expect(REPRO.bench).toEqual(cumulative(rlBhrpWealth.benchmark));
    expect(REPRO.dates).toEqual(rlBhrpWealth.dates);
    for (const s of [REPRO.rl, REPRO.lo, REPRO.hi, REPRO.bhrp, REPRO.bench]) expect(s.length).toBe(REPRO.dates.length + 1);
  });
});

describe('Figure 2, the growth of $1', () => {
  it('has a wide and a narrow drawing, each with its frame on data-g', () => {
    expect(svgs(full).map((s) => attr(open(s), 'class'))).toEqual(['wide', 'narrow']);
  });

  for (const [name, d] of [['the reproduction', REPRO], ['a run far outside it', stretched]] as const) {
    it(`frames every point of ${name}: the domain is derived, and every mark is inside the plot`, () => {
      const lo = Math.min(...values(d)), hi = Math.max(...values(d));
      for (const svg of svgs(wealthFigure(d, 'full'))) {
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
      for (const svg of svgs(wealthFigure(d, 'full'))) {
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
    for (const svg of [...svgs(full), ...svgs(mini)]) expect(svg).toMatch(/<g class="f-draw" aria-hidden="true" visibility="hidden">/);
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

  it('carries the readout\'s three series on data-*, to 4 dp, one point more than there are months', () => {
    const plot = full.match(/<div class="f-plot"[^>]*>/)![0];
    expect(attr(plot, 'data-dates')).toBe(REPRO.dates.join(' '));
    for (const k of ['rl', 'bhrp', 'bench'] as const) {
      const got = attr(plot, `data-${k}`)!.split(' ').map(Number);
      expect(got).toEqual(REPRO[k].map((v) => Number(v.toFixed(4))));
    }
    expect(full).not.toContain('<script');
  });

  it("says in its caption that it is the second author's reproduction, its red line the median of the runs", () => {
    const caption = full.match(/<figcaption[\s\S]*?<\/figcaption>/)![0];
    expect(caption).toContain('the second author’s reproduction');
    expect(caption).toContain(`The red line is the month-by-month median of the reproduction’s ${REPRO.runs} training runs`);
    expect(caption).toContain('they ended between $2.10 and $2.17');
    expect(full).toContain(`median of ${REPRO.runs} runs`);   // the readout's legend
    expect(REPRO.runs).toBe(10);
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

  it("is wired as the paper specifies: BHRP takes Σ and feeds nothing; the policy's state is dashed", () => {
    for (const art of pipe.match(/<div class="pp-art (?:wide|narrow)"[\s\S]*?<\/svg>/g)!) {
      expect(art.match(/<path class="p-arrow[^"]*"/g)).toHaveLength(6);
      expect(art.match(/<path class="p-arrow p-dash"/g)).toHaveLength(1);
    }
    for (const word of ['Bayesian layer', 'Policy', 'Reward', 'PPO update', 'BHRP', 'the comparator']) {
      expect(outsideMath.split(`>${word}<`).length - 1, word).toBe(2);
    }
    expect(pipe).toMatch(/<figcaption id="pipe-cap">/);
    expect(pipe.match(/role="img" aria-labelledby="pipe-cap"/g)).toHaveLength(2);
  });
});

describe('both figures', () => {
  for (const [name, html] of [['Figure 2', full], ['the miniature', mini], ['Figure 1', pipe]] as const) {
    it(`${name} prints no CJK and never says "published"`, () => {
      expect(html).not.toMatch(/[\u3000-\u9fff]/);   // the CJK block
      expect(html).not.toMatch(/published/i);
    });
  }

  it("are RL-BHRP's, registered under its slug: the two figures and the card's miniature", () => {
    expect(PAPER_DATA['rl-bhrp'].figures).toEqual({ wealth: full, pipeline: pipe });
    expect(PAPER_DATA['rl-bhrp'].thumb).toBe(mini);
  });
});
