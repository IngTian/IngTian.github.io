// tests/projectVisuals.test.ts
// /projects' computed pictures. Each is drawn at build time from its project's OWN output, vendored with its
// provenance (src/data/vendor), and every number it prints must come from that output — the homepage's rule
// that a number in prose comes from the data it describes. These pin the drawings to their data.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { projects } from '../src/data/profile';
import { visualFor } from '../src/data/projectVisuals';
import { macbootSections } from '../src/data/vendor/macbootSections';
import { offchartPositioning } from '../src/data/vendor/offchartPositioning';
import { rlBhrpWealth } from '../src/data/vendor/rlBhrpWealth';
import { witnessFacets } from '../src/data/vendor/witnessFacets';
import { GALLERY_ORDER } from '../src/lib/galleryLayout';
import { expandingPercentile, shareOf } from '../src/lib/positioning';
import { facetsSvg, medianSeed, positioningSvg, sectionsSvg, wealthSvg } from '../src/lib/projectVisuals';

const unescape = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');

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

interface Box { what: string; x0: number; x1: number; y0: number; y1: number }
const size = (attrs: string) => Number(attr(attrs, 'style').match(/font-size:([\d.]+)px/)?.[1] ?? NaN);
/** Every run of text as a box, by JetBrains Mono's metrics: 0.6em advance, 1.02em ascent, 0.3em descent. */
function textBoxes(svg: string): Box[] {
  const out: Box[] = [];
  for (const [, a, body] of svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)) {
    const spans = [...body.matchAll(/<tspan\b([^>]*)>([\s\S]*?)<\/tspan>/g)].map(([, sa, s]) => ({ a: sa, s }));
    const anchor = attr(a, 'text-anchor') || 'start';
    let x = Number(attr(a, 'x')), y = Number(attr(a, 'y'));
    for (const p of spans.length ? spans : [{ a, s: body }]) {
      if (attr(p.a, 'x')) x = Number(attr(p.a, 'x'));
      if (attr(p.a, 'y')) y = Number(attr(p.a, 'y'));
      const s = size(p.a) || size(a), str = unescape(p.s), w = str.length * 0.6 * s;
      const x0 = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x;
      out.push({ what: `text "${str}"`, x0, x1: x0 + w, y0: y - 1.02 * s, y1: y + 0.3 * s });
      x = x0 + w;
    }
  }
  return out;
}
/** Every mark that is not text, as a box: rects, lines, circles, and each vertex of a polyline, polygon or path. */
function markBoxes(svg: string): Box[] {
  const n = (a: string, k: string) => Number(attr(a, k));
  const pt = (what: string) => ([x, y]: number[]): Box => ({ what, x0: x, x1: x, y0: y, y1: y });
  return [
    ...attrsOf(svg, 'rect').map((a) => ({ what: 'rect', x0: n(a, 'x'), x1: n(a, 'x') + n(a, 'width'), y0: n(a, 'y'), y1: n(a, 'y') + n(a, 'height') })),
    ...attrsOf(svg, 'line').map((a) => ({ what: 'line', x0: Math.min(n(a, 'x1'), n(a, 'x2')), x1: Math.max(n(a, 'x1'), n(a, 'x2')), y0: Math.min(n(a, 'y1'), n(a, 'y2')), y1: Math.max(n(a, 'y1'), n(a, 'y2')) })),
    ...attrsOf(svg, 'circle').map((a) => ({ what: 'circle', x0: n(a, 'cx') - n(a, 'r'), x1: n(a, 'cx') + n(a, 'r'), y0: n(a, 'cy') - n(a, 'r'), y1: n(a, 'cy') + n(a, 'r') })),
    ...['polyline', 'polygon'].flatMap((t) => attrsOf(svg, t).flatMap((a) => pts(attr(a, 'points')).map(pt(t)))),
    ...attrsOf(svg, 'path').flatMap((a) => (attr(a, 'd').match(/-?[\d.]+/g) ?? []).map(Number)
      .flatMap((v, i, all) => (i % 2 ? [] : [[v, all[i + 1]]])).map(pt('path'))),
  ];
}
const overlaps = (a: Box, z: Omit<Box, 'what'>) => a.x0 < z.x1 && a.x1 > z.x0 && a.y0 < z.y1 && a.y1 > z.y0;
const numbers = (s: string) => new Set(s.match(/\d+(?:\.\d+)?/g) ?? []);
const label = (svg: string) => unescape(svg.match(/^<svg\b[^>]*\baria-label="([^"]*)"/)?.[1] ?? '');

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

      it('is framed to fit, never to fill: no container crops it, so everything inside the viewBox is seen', () => {
        // A workshop thumb is 170px tall at any width from 300px (1.75:1 to 3.6:1); `slice` there cut text off.
        const root = svg.match(/^<svg\b[^>]*>/)![0];
        expect(attr(root, 'preserveAspectRatio') || 'xMidYMid meet').toMatch(/^x\w+Y\w+ meet$/);
        // the ground is the svg's own background, so the room `meet` leaves around the drawing is the same tone
        expect(attr(root, 'style')).toContain('background:var(--draft-ph)');
        const out = textBoxes(svg).filter((b) => b.x0 < 8 || b.x1 > 342 || b.y0 < 8 || b.y1 > 212);
        expect(out.map((b) => b.what)).toEqual([]);
      });

      it('is an image named by its own figures, so they reach a screen reader', () => {
        const root = svg.match(/^<svg\b[^>]*>/)![0];
        expect(attr(root, 'role')).toBe('img');
        expect(root).not.toMatch(/aria-hidden/);
        expect(label(svg).length).toBeGreaterThan(40);
        // every number the picture prints is in its name, which is built from the same values
        const named = numbers(label(svg));
        expect([...numbers(printed(svg))].filter((n) => !named.has(n))).toEqual([]);
      });

      it('colours only through CSS variables or currentColor, so it re-themes', () => {
        const paints = [...svg.matchAll(/\b(?:fill|stroke|background)\s*[:=]\s*"?([^;"]+)/g)].map((m) => m[1].trim());
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

      it('prints no CJK text, and only characters the mono subset can draw', () => {
        // the CJK block, /[U+3000-U+9FFF]/: these pictures are drawn from TEXT the site sets, so the text rule holds
        // (a capture of a work is a picture, and keeps what it shows; see CLAUDE.md, The concept)
        expect(svg).not.toMatch(/[\u3000-\u9fff]/);
        // the class tests/projectsListing.test.ts reads from the vendored woff2's cmap — no arrows, no emoji
        expect(printed(svg)).toMatch(/^[\x20-\x7e\xa0-\xff–—‘’“”•…\n]*$/);
      });
    });
  }
});

describe('the gallery\'s name tag covers nothing', () => {
  // The tag over a gallery card's bottom-left (the mockup's `.shot .tag`): 10px in from the card's left and bottom,
  // 10.5px mono in capitals with .1em tracking, 4px 7px of padding. JetBrains Mono advances 0.6em, and its normal
  // line height is 1.32em (ascent 1020 + descent 300 per 1000), which Chrome rounds to whole px. Checked once in
  // headless Chrome against the real tag: 65.45x22.00px for RL-BHRP, 72.81x22.00px for OFFCHART, as modelled.
  const TAG = { inset: 10, size: 10.5, tracking: 0.1, padX: 7, padY: 4, lineHeight: 1.32 };
  // A gallery card is 330x220, or 240x160 on a phone, with a 1px border; Tailwind's preflight makes it border-box.
  const CARDS = [[330, 220], [240, 160]] as const;
  // The computed pictures among the gallery's six (macboot is a workshop card only), read from the gallery's own
  // order so a card added to it is held to the tag rule too.
  const GALLERY_SVGS = GALLERY_ORDER.filter((s) => visualFor(s).kind === 'svg');
  it('finds the three computed pictures in the gallery', () => {
    expect(GALLERY_SVGS).toEqual(['rl-bhrp', 'offchart', 'witness']);
  });

  /** The tag's box in the picture's own units: the svg fills the card inside its border, framed by `meet`. */
  function tagZone(name: string, [w, h]: readonly [number, number]) {
    const iw = w - 2, ih = h - 2;
    const s = Math.min(iw / 350, ih / 220), ox = (iw - 350 * s) / 2, oy = (ih - 220 * s) / 2;
    const tw = name.length * TAG.size * (0.6 + TAG.tracking) + 2 * TAG.padX;
    const th = Math.round(TAG.size * TAG.lineHeight) + 2 * TAG.padY;
    return { x0: (TAG.inset - ox) / s, x1: (TAG.inset + tw - ox) / s, y0: (ih - TAG.inset - th - oy) / s, y1: (ih - TAG.inset - oy) / s };
  }

  for (const slug of GALLERY_SVGS) {
    it(`${slug}: no word or mark of its picture sits under its tag, on either card size`, () => {
      const v = visualFor(slug);
      if (v.kind !== 'svg') throw new Error(`${slug} is a computed picture`);
      for (const card of CARDS) {
        const z = tagZone(slug, card);
        expect(z.y0).toBeLessThan(200);   // the zone is real: the band the old year labels sat in
        const under = [...textBoxes(v.svg), ...markBoxes(v.svg)].filter((b) => overlaps(b, z));
        expect(under.map((b) => `${card.join('x')}: ${b.what}`)).toEqual([]);
      }
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

  it('names its latest reading, the dot a sighted reader sees at the right end', () => {
    expect(label(svg)).toContain(`Latest, ${d.weeks.at(-1)}: percentile ${Math.round(pct.at(-1)!)}.`);
    expect(label(svg)).toContain('Hedge funds, 10-year Treasury futures');
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

  it('names each facet in words a screen reader can say, with its count and confidence', () => {
    for (const f of witnessFacets.top) {
      expect(label(ALL.facetsSvg)).toContain(
        `${f.name.replace(/_/g, ' ')}, ${f.observations} observations, confidence ${f.confidence.toFixed(2)}`);
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

  it('names every section in full, though the picture shortens the third column', () => {
    for (const [sec, category, what] of macbootSections.rows) {
      expect(label(ALL.sectionsSvg)).toContain(`§${sec} ${category}: ${what}`);
    }
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

  it('gives manifold a still per theme, each its own video\'s first frame, and its motion as two MP4 URLs', () => {
    const v = visualFor('manifold');
    if (v.kind !== 'image') throw new Error('manifold is a capture');
    expect(v.motion).toEqual({ dark: '/projects/manifold-saver-dark.mp4', light: '/projects/manifold-saver-light.mp4' });
    // A light still, so the light theme never shows a dark poster that turns light when the motion swaps in.
    expect(JSON.stringify(v.dark)).toContain('manifold-saver-dark.png');
    expect(JSON.stringify(v.light)).toContain('manifold-saver-light.png');
    // Each still is the size of its video's frame (PNG IHDR against the MP4's track header): the repo's 600x376
    // thumbnail, which read "Lorem Ipsum", could not pass.
    for (const t of ['dark', 'light']) {
      const png = readFileSync(new URL(`../src/assets/projects/manifold-saver-${t}.png`, import.meta.url));
      const mp4 = readFileSync(new URL(`../public/projects/manifold-saver-${t}.mp4`, import.meta.url));
      const box = mp4.indexOf('tkhd') - 4, end = box + mp4.readUInt32BE(box);
      expect([png.readUInt32BE(16), png.readUInt32BE(20)])
        .toEqual([mp4.readUInt32BE(end - 8) / 65536, mp4.readUInt32BE(end - 4) / 65536]);
    }
  });

  it('gives every capture a text alternative', () => {
    for (const p of projects) {
      const v = visualFor(p.slug);
      if (v.kind === 'image') expect(v.alt).toMatch(new RegExp(`^${p.slug}\\b.{30,}`));
    }
  });

  it('throws on a slug with no picture rather than rendering an empty card', () => {
    expect(() => visualFor('argmin')).toThrow();
  });
});
