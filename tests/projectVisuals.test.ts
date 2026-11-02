// tests/projectVisuals.test.ts
// /projects' computed pictures. Each is drawn at build time from its project's OWN output, vendored with its
// provenance (src/data/vendor), and every number it prints must come from that output — the homepage's rule
// that a number in prose comes from the data it describes. These pin the drawings to their data.
import { describe, expect, it } from 'vitest';
import { projects } from '../src/data/profile';
import { visualFor } from '../src/data/projectVisuals';
import { macbootSections } from '../src/data/vendor/macbootSections';
import { offchartPositioning } from '../src/data/vendor/offchartPositioning';
import { rlBhrpWealth } from '../src/data/vendor/rlBhrpWealth';
import { witnessFacets } from '../src/data/vendor/witnessFacets';
import { expandingPercentile, shareOf } from '../src/lib/positioning';
import { facetsSvg, medianSeed, positioningSvg, sectionsSvg, wealthSvg } from '../src/lib/projectVisuals';

const unescape = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** Every <text> element's lines: its <tspan>s, or its whole content when it has none. */
function texts(svg: string): string[][] {
  return [...svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map(([, body]) => {
    const spans = [...body.matchAll(/<tspan\b[^>]*>([\s\S]*?)<\/tspan>/g)].map((m) => unescape(m[1]));
    return spans.length ? spans : [unescape(body)];
  });
}
const printed = (svg: string) => texts(svg).flat().join('\n');

const pts = (attr: string): [number, number][] =>
  attr.trim().split(/\s+/).map((p) => p.split(',').map(Number) as [number, number]);
const attrsOf = (svg: string, tag: string) =>
  [...svg.matchAll(new RegExp(`<${tag}\\b([^>]*)>`, 'g'))].map((m) => m[1]);
const attr = (attrs: string, name: string) => attrs.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] ?? '';

const wealth = (r: readonly number[]) => r.reduce((w, x) => w * (1 + x), 1);
/** Coordinates are printed to 0.1, and a value checked against a frame read back from other printed
 *  coordinates carries two roundings. */
const near = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(0.101);

const ALL = {
  wealthSvg: wealthSvg(rlBhrpWealth),
  positioningSvg: positioningSvg(offchartPositioning),
  facetsSvg: facetsSvg(witnessFacets),
  sectionsSvg: sectionsSvg(macbootSections),
};

describe('every computed picture', () => {
  for (const [name, svg] of Object.entries(ALL)) {
    describe(name, () => {
      it('is a 350x220 drawing', () => {
        expect(svg).toMatch(/^<svg\b[^>]*\bviewBox="0 0 350 220"/);
        expect(svg.endsWith('</svg>')).toBe(true);
      });

      it('colours only through CSS variables or currentColor, so it re-themes', () => {
        const paints = [...svg.matchAll(/\b(?:fill|stroke)\s*[:=]\s*"?([^;"]+)/g)].map((m) => m[1].trim());
        expect(paints.length).toBeGreaterThan(0);
        expect(paints.filter((p) => !/var\(--|^currentColor$|^none$/.test(p))).toEqual([]);
        expect(svg).not.toMatch(/#[0-9a-f]{3,8}\b/i);
      });

      it('sets its text in ink the drafting palette clears AA with (tests/draftingPalette.test.ts)', () => {
        const fill = (a: string) => attr(a, 'style').match(/fill:([^;]+)/)?.[1];
        const own = attrsOf(svg, 'text').map(fill);
        expect(own.length).toBeGreaterThan(0);
        expect(own.every(Boolean)).toBe(true);   // every <text> says its ink; none inherits one by accident
        const all = [...own, ...attrsOf(svg, 'tspan').map(fill).filter(Boolean)];
        expect(all.filter((f) => f !== 'var(--ink-1)' && f !== 'var(--ink-3)')).toEqual([]);
      });

      it('prints no CJK, and only characters the mono subset can draw', () => {
        expect(svg).not.toMatch(/[\u3000-\u9fff]/);   // the CJK block, as the brief writes it: /[U+3000-U+9FFF]/
        // the class tests/projectsListing.test.ts reads from the vendored woff2's cmap — no arrows, no emoji
        expect(printed(svg)).toMatch(/^[\x20-\x7e\xa0-\xff–—‘’“”•…\n]*$/);
      });
    });
  }
});

describe('wealthSvg (rl-bhrp)', () => {
  const svg = ALL.wealthSvg;
  const d = rlBhrpWealth;
  const months = d.dates.length + 1;   // wealth starts at 1, the month before the first return

  it('picks the median seed by rl-bhrp\'s own rule: the seed at position n/2 of the CAGR order', () => {
    // results/shared-global/summary.json in rl-bhrp records `"median_seed": 7` for this run
    expect(medianSeed(d.rlSeeds)).toBe(7);
  });

  it('draws one band (the seeds\' min to max) and three lines: median seed, BHRP, benchmark', () => {
    const bands = attrsOf(svg, 'polygon');
    const lines = attrsOf(svg, 'polyline');
    expect(bands).toHaveLength(1);
    expect(lines).toHaveLength(3);
    const band = pts(attr(bands[0], 'points'));
    expect(band).toHaveLength(2 * months);
    // drawn back to front, so the median seed is painted last, over the other two
    const [bench, bhrp, med] = lines.map((l) => pts(attr(l, 'points')));
    for (const line of [med, bhrp, bench]) expect(line).toHaveLength(months);
    expect(attr(lines[2], 'style')).toContain('--draft-hi-rgb');   // and it is the one in the seal
    // the median seed is one of the seeds, so it lies inside their band at every month (y grows downward)
    const top = band.slice(0, months), bottom = band.slice(months).reverse();
    med.forEach(([x, y], i) => {
      near(x, top[i][0]);
      expect(y).toBeGreaterThanOrEqual(top[i][1]);
      expect(y).toBeLessThanOrEqual(bottom[i][1]);
    });
    // BHRP ends below the band (it lost to every seed); the benchmark ends below BHRP
    expect(bhrp.at(-1)![1]).toBeGreaterThan(bottom.at(-1)![1]);
    expect(bench.at(-1)![1]).toBeGreaterThan(bhrp.at(-1)![1]);
  });

  it('prints no paper figure — the reproduction\'s numbers only', () => {
    // 15.2% and 1.20 are the PAPER's Table 2 (profile.ts). Checked on what is printed: the coordinates are
    // digits too, and a point at x=115.2 is not a claim.
    const text = printed(svg);
    expect(text).not.toContain('15.2');
    expect(text).not.toContain('1.20');
    expect(text).toMatch(/reproduction/i);
  });

  it('prints only numbers derived from the vendored returns', () => {
    const allowed = new Set([
      d.dates[0].slice(0, 4), d.dates.at(-1)!.slice(0, 4), String(d.rlSeeds.length),
      ...[d.rlSeeds[medianSeed(d.rlSeeds)], d.bhrp, d.benchmark].map((r) => wealth(r).toFixed(2)),
    ]);
    const nums = printed(svg).match(/\d+(?:\.\d+)?/g) ?? [];
    expect(nums.length).toBeGreaterThan(0);
    expect(nums.filter((n) => !allowed.has(n))).toEqual([]);
    // and each line's final wealth is among them
    expect(nums).toContain(wealth(d.bhrp).toFixed(2));
  });
});

describe('positioningSvg (offchart)', () => {
  const d = offchartPositioning;
  const svg = ALL.positioningSvg;
  const pct = expandingPercentile(shareOf(d.net, d.oi), 52);
  const n = d.weeks.length;

  // The deciles are rects spanning the plot, so they also give the plot's frame: the top one runs 100 -> 90,
  // the bottom one 10 -> 0. Everything below is checked against that frame, not against copied constants.
  const rects = attrsOf(svg, 'rect').filter((a) => /\bdecile\b/.test(attr(a, 'class')));
  const [topR, botR] = rects.map((a) => ({
    x: Number(attr(a, 'x')), y: Number(attr(a, 'y')), w: Number(attr(a, 'width')), h: Number(attr(a, 'height')),
  }));
  const y100 = topR.y, y0 = botR.y + botR.h;
  const yOf = (p: number) => y0 - ((y0 - y100) * p) / 100;

  it('shades the top and bottom deciles on a 0-100 scale', () => {
    expect(rects).toHaveLength(2);
    near(topR.h, yOf(90) - yOf(100));
    near(botR.y, yOf(10));
    near(botR.h, yOf(0) - yOf(10));
    expect(topR.x).toBe(botR.x);
    expect(topR.w).toBe(botR.w);
  });

  it('plots the percentile of shareOf(net, oi), with the first 51 weeks blank', () => {
    const paths = attrsOf(svg, 'path').map((a) => attr(a, 'd'));
    expect(paths).toHaveLength(1);
    expect(paths[0].match(/M/g)).toHaveLength(1);   // one unbroken run: one segment, no missing week
    const p = paths[0].trim().split(/(?=[ML])/).map((s) => s.slice(1).trim().split(/[ ,]+/).map(Number));
    expect(p).toHaveLength(n - 51);
    const step = topR.w / (n - 1);
    p.forEach(([x, y], k) => {
      near(x, topR.x + (51 + k) * step);
      near(y, yOf(pct[51 + k]!));
    });
  });

  it('is captioned as what it is: the cohort and market, CFTC data, offchart\'s method', () => {
    // one caption, set on two lines at its separator — at 10px the whole sentence is wider than the picture
    expect(texts(svg)[0].join(' · ')).toBe('Hedge funds, 10-year Treasury futures · CFTC data, offchart\'s method');
  });
});

describe('facetsSvg (witness)', () => {
  it('prints the header counts from the module, not literals', () => {
    expect(printed(ALL.facetsSvg)).toContain('52 facets');
    expect(printed(ALL.facetsSvg)).toContain('392 observations');
    const other = printed(facetsSvg({ ...witnessFacets, facets: 7, observations: 9 }));
    expect(other).toContain('7 facets');
    expect(other).toContain('9 observations');
    expect(other).not.toContain('52 facets');
  });

  it('lists the five most-observed facets in order, each with its count and confidence', () => {
    const text = printed(ALL.facetsSvg);
    const at = witnessFacets.top.map((f) => text.indexOf(f.name));
    expect(witnessFacets.top).toHaveLength(5);
    expect(at.every((i, k) => i >= 0 && (k === 0 || i > at[k - 1]))).toBe(true);
    for (const f of witnessFacets.top) {
      expect(text).toContain(`${f.observations} obs`);
      expect(text).toContain(f.confidence.toFixed(2));
    }
  });
});

describe('sectionsSvg (macboot)', () => {
  it('has one row per section of the README', () => {
    const rows = texts(ALL.sectionsSvg).filter((t) => t.length === 3);
    expect(rows).toHaveLength(macbootSections.rows.length);
    rows.forEach((r, i) => {
      expect(r[0]).toBe(`§${macbootSections.rows[i][0]}`);
      expect(r[1]).toBe(macbootSections.rows[i][1]);
    });
    const three = sectionsSvg({ rows: macbootSections.rows.slice(0, 3) });
    expect(texts(three).filter((t) => t.length === 3)).toHaveLength(3);
  });

  it('escapes the README\'s ampersands', () => {
    expect(ALL.sectionsSvg).toContain('Terminal &amp; shell');
    expect(ALL.sectionsSvg).not.toMatch(/&(?!amp;|lt;|gt;)/);
  });

  it('shortens a long "what" at an item boundary, never mid-word', () => {
    const rows = texts(ALL.sectionsSvg).filter((t) => t.length === 3);
    rows.forEach((r, i) => {
      const full = macbootSections.rows[i][2];
      if (r[2] === full) return;
      expect(r[2].endsWith('…')).toBe(true);
      expect(full.startsWith(r[2].slice(0, -1))).toBe(true);
      expect(full.slice(r[2].length - 1)).toMatch(/^, /);
    });
  });
});

describe('visualFor', () => {
  it('gives every project a picture: computed for the four with output, captures for the rest', () => {
    const kinds = Object.fromEntries(projects.map((p) => [p.slug, visualFor(p.slug).kind]));
    expect(kinds).toEqual({
      'rl-bhrp': 'svg', offchart: 'svg', 'trading-desk': 'image', witness: 'svg',
      daylogs: 'image', manifold: 'image', macboot: 'svg',
    });
  });

  it('gives manifold its still as the poster and its motion as two MP4 URLs', () => {
    const v = visualFor('manifold');
    if (v.kind !== 'image') throw new Error('manifold is a capture');
    expect(v.poster).toBeDefined();
    expect(v.motion).toEqual({ dark: '/projects/manifold-saver-dark.mp4', light: '/projects/manifold-saver-light.mp4' });
  });

  it('throws on a slug with no picture rather than rendering an empty card', () => {
    expect(() => visualFor('argmin')).toThrow();
  });
});
