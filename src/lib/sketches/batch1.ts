// src/lib/sketches/batch1.ts
// FIRST BATCH of showpiece candidates. Each is a still frame, judged in one look, at the cost of
// one function. Most are expected to die — that is the point of the harness.
//
// Every sketch here is trying to answer ONE question: what makes a stranger want to touch this?
// Not "what states his credentials" — that framing was rejected as self-advertisement. The
// candidates deliberately explore DIFFERENT mechanisms so the batch is informative even if every
// individual frame fails:
//
//   A  the path      — his own words: a descent stuck in a local min, escaping
//   B  the voice     — 42 written photo notes, the only material with a voice in it
//   C  the ledger    — 173 artefacts as a dense field, no claim attached
//   D  the question  — withholding, so curiosity has somewhere to go
//   E  the section   — time as depth, strata below the descent's ground
//
// The five rejected attempts and the open questions are in the commit history.

// FRAME, PAL and `poly` came off this import list when noUnusedLocals went on (see tsconfig.json).
// None of the five sketches below referenced any of them, and none should: a sketch is handed its
// size and its palette on SketchCtx — `{ w, h, pal, data }` — and pages/proto-sketches.astro is what
// feeds FRAME and PAL in, so reaching past the context to the module constants would let a sketch
// disagree with the frame it is actually being rendered at. Every sketch below reads `pal` off the
// context — it appears on 38 of this file's non-comment lines — while FRAME.w and FRAME.h were read
// zero times. (That first figure was written as "33 times" and was simply wrong, which is the argument
// for counting a thing with grep or not quoting a count at all: a tally in a comment is stale the next
// time anyone edits the file, and this one was stale on arrival.)
//
// `poly` is the different case and worth a grep before anyone "tidies" kit.ts: it is still exported
// from ./kit and, after this edit, has NO caller anywhere in src. That is exported dead code, which
// noUnusedLocals cannot see (an export is a public API to the compiler). Left alone on purpose —
// kit.ts is the shared toolkit for future batches, not this batch's private helpers.
import {
  type Sketch, type SketchCtx,
  svg, line, path, dot, label, prose, wrap, rnd, f2,
} from './kit';
import { field, RANGE } from '../terrain';

// ── A · THE PATH ────────────────────────────────────────────────────────────
// His framing, drawn literally: contours of the real loss field, the declared career path across
// it, the local basin it sat in and the deeper one it left for. The hook is the ANOMALY — a path
// that goes UP before it goes down, which is visibly wrong for a descent and makes you ask why.

const pathSketch: Sketch = {
  id: 'path',
  title: 'The path that went uphill',
  pitch: 'Contours of a real loss surface, with a career drawn across it — and one segment that climbs.',
  hook: 'A descent that goes UP in the middle is visibly wrong. You want to know what happened there.',
  cannotShow: 'On the page the walker would animate along the path and stall in the basin before escaping; the still frame cannot show the stalling, which is the emotional beat.',
  draw({ w, h, pal, data }: SketchCtx) {
    const parts: string[] = [];
    const cx = w * 0.5, cy = h * 0.52;
    const scale = Math.min(w, h) * 0.30;
    const toScreen = (x: number, y: number): [number, number] => [cx + x * scale, cy - y * scale];

    // Contour lines by marching a coarse grid: cheap, and it reads as a survey map rather than a
    // rendered surface — deliberately NOT a second terrain render.
    const LEVELS = [-0.85, -0.7, -0.55, -0.4, -0.25, -0.1, 0.05, 0.2];
    const N = 130;
    for (const [li, lv] of LEVELS.entries()) {
      const segs: string[] = [];
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          const x0 = -RANGE + (2 * RANGE * i) / N, y0 = -RANGE + (2 * RANGE * j) / N;
          const x1 = -RANGE + (2 * RANGE * (i + 1)) / N, y1 = -RANGE + (2 * RANGE * (j + 1)) / N;
          const a = field(x0, y0), b = field(x1, y0), c = field(x0, y1);
          // horizontal crossing
          if ((a - lv) * (b - lv) < 0) {
            const t = (lv - a) / (b - a);
            const [sx, sy] = toScreen(x0 + (x1 - x0) * t, y0);
            segs.push(`M${f2(sx)} ${f2(sy)}h1`);
          }
          // vertical crossing
          if ((a - lv) * (c - lv) < 0) {
            const t = (lv - a) / (c - a);
            const [sx, sy] = toScreen(x0, y0 + (y1 - y0) * t);
            segs.push(`M${f2(sx)} ${f2(sy)}h1`);
          }
        }
      }
      const strength = 0.10 + (LEVELS.length - li) / LEVELS.length * 0.22;
      parts.push(`<path d="${segs.join('')}" stroke="${pal.ink5}" stroke-width="1.6" ` +
        `opacity="${f2(strength)}" fill="none" stroke-linecap="round"/>`);
    }

    // The two basins, marked as survey points rather than as objects.
    for (const [b, tag] of [[data.facts.localBasin, 'local min'], [data.facts.globalBasin, 'global min']] as const) {
      const [bx, by] = toScreen(b.x, b.y);
      parts.push(dot(bx, by, 4, pal.ink4));
      parts.push(`<circle cx="${f2(bx)}" cy="${f2(by)}" r="16" stroke="${pal.ink4}" stroke-width="1" fill="none" opacity="0.5"/>`);
      parts.push(label(bx, by + 34, `${tag}  f = ${b.depth.toFixed(3)}`, { size: 13, fill: pal.ink4, anchor: 'middle' }));
    }

    // The declared path. Ochre while descending, SEAL where it climbs — the anomaly is the hook,
    // so it gets the one saturated colour on the site.
    const pts = data.waypoints.map((wp) => toScreen(wp.x, wp.y));
    for (let i = 1; i < pts.length; i++) {
      const prev = data.waypoints[i - 1], curr = data.waypoints[i];
      const climbing = field(curr.x, curr.y) > field(prev.x, prev.y);
      parts.push(path([pts[i - 1], pts[i]], climbing ? pal.seal : pal.ochre, climbing ? 3.4 : 2.2,
        climbing ? '' : 'opacity="0.85"'));
    }
    data.waypoints.forEach((wp, i) => {
      const [px, py] = pts[i];
      const isBasin = wp.phase === 'basin';
      parts.push(dot(px, py, isBasin ? 6.5 : 4.5, isBasin ? pal.seal : pal.paper));
      const right = wp.x < 0.4;
      parts.push(label(px + (right ? 16 : -16), py + 5, wp.label,
        { size: 14, fill: pal.ink2, anchor: right ? 'start' : 'end' }));
    });

    // One caption, stating the measured fact rather than the metaphor.
    parts.push(label(w * 0.5, h - 46,
      `a plain descent cannot leave the local basin · escaping costs a ${data.facts.climbRequired.toFixed(2)} climb`,
      { size: 15, fill: pal.ink4, anchor: 'middle' }));

    return svg(parts.join(''), 'Contour map of a loss surface with a career path crossing a barrier between two basins');
  },
};

// ── B · THE VOICE ───────────────────────────────────────────────────────────
// 42 written photo notes as the subject. No statistics, no claim about him — just sentences, laid
// out as a field you read into. The hook is one sentence good enough to make you ask who wrote it.

const voiceSketch: Sketch = {
  id: 'voice',
  title: 'Forty-two sentences',
  pitch: 'The written note from every photograph, arranged as a field of text — the work speaking for itself.',
  hook: '"Foam carves temporary calligraphy into the granite edge, then erases it." You want to know who writes like that.',
  cannotShow: 'On the page each sentence would pair with its photograph on hover, so text becomes image. The still frame shows only half the pair.',
  draw({ w, h, pal, data }: SketchCtx) {
    const parts: string[] = [];
    const cols = 3;
    const colW = (w - 220) / cols;
    const per = Math.ceil(data.photos.length / cols);

    // Two sentences are pulled out large — the frame needs a focal point, and one great sentence
    // does more work than 42 small ones.
    const featured = data.photos.filter((p) =>
      p.note.includes('calligraphy') || p.note.includes('red canoe')).slice(0, 2);

    let y0 = 118;
    featured.forEach((p, i) => {
      const lines = wrap(p.note, 52);
      lines.forEach((ln, k) => {
        parts.push(prose(110, y0 + k * 44, ln, { size: 34, fill: i === 0 ? pal.paper : pal.ink2, italic: true }));
      });
      y0 += lines.length * 44 + 30;
    });
    parts.push(line(110, y0 + 6, w - 110, y0 + 6, `rgba(${pal.hair}, 0.25)`, 1));

    // The remaining sentences, small, in three columns — density from real text.
    const rest = data.photos.filter((p) => !featured.includes(p));
    rest.forEach((p, i) => {
      const col = Math.floor(i / per);
      const row = i % per;
      const x = 110 + col * colW;
      const y = y0 + 52 + row * 26;
      if (y > h - 70) return;
      const short = p.note.length > 58 ? p.note.slice(0, 56).trimEnd() + '…' : p.note;
      parts.push(label(x, y, short, { size: 12.5, fill: pal.ink4, track: 0.01 }));
    });

    parts.push(label(110, h - 34, `42 photographs · 42 notes · one hand`, { size: 14, fill: pal.ochre }));
    return svg(parts.join(''), 'Forty-two written photograph notes arranged as a field of text');
  },
};

// ── C · THE LEDGER ──────────────────────────────────────────────────────────
// All 173 artefacts as one dense field, each a mark sized by evidence and placed by year. No claim
// attached — the reader draws the conclusion. The least self-regarding option, and the answer to
// "it reads empty": 173 marks cannot read empty.

const ledgerSketch: Sketch = {
  id: 'ledger',
  title: 'Everything, counted',
  pitch: 'One mark per artefact — 173 of them — placed by year and kind, sized by how checkable it is.',
  hook: 'It is obviously a lot, and obviously ordered. You start looking for the shape of it.',
  cannotShow: 'Hover would name each mark and its evidence clause; the still frame is the shape without the detail.',
  draw({ w, h, pal, data }: SketchCtx) {
    const parts: string[] = [];
    const left = 200, right = w - 120, top = 150, bot = h - 130;
    const y0 = 2019, y1 = 2028;
    const xFor = (year: number) => left + ((year - y0) / (y1 - y0)) * (right - left);

    // Year axis — the one real continuous dimension in the corpus.
    for (let y = y0; y <= y1; y++) {
      const x = xFor(y);
      parts.push(line(x, top, x, bot, `rgba(${pal.hair}, 0.14)`, 1));
      parts.push(label(x, bot + 30, String(y), { size: 13, fill: pal.ink4, anchor: 'middle' }));
    }

    // Rows: one per kind, sized by how many items it holds. Photographs get the most room because
    // they ARE the most numerous — the row heights are the census.
    const rows: { name: string; n: number; year: (i: number) => number; score: number }[] = [
      { name: 'photographs', n: data.photos.length, year: (i) => 2021 + (i % 5) + rnd(i) * 0.8, score: 2 },
      { name: 'photo notes', n: data.photos.length, year: (i) => 2021 + (i % 5) + rnd(i * 3.1) * 0.8, score: 2 },
      { name: 'roles + degrees', n: data.timeline.length, year: (i) => 2019 + i, score: 2 },
      { name: 'equations', n: 9, year: (i) => 2025 + rnd(i * 7) * 1.5, score: 3 },
      { name: 'paper metrics', n: 11, year: (i) => 2025 + rnd(i * 5) * 0.6, score: 4 },
      { name: 'research interests', n: data.interests.length, year: (i) => 2026 + rnd(i) * 1.2, score: 1 },
      { name: 'awards', n: data.awards.length, year: (i) => 2020 + i, score: 2 },
      { name: 'projects', n: data.projects.length, year: (i) => 2026 + i * 0.4, score: 2 },
      { name: 'calligraphy', n: 2, year: (i) => 2024 + i * 0.5, score: 2 },
      { name: 'publications', n: data.publications.length, year: (i) => 2023 + i * 2, score: 4 },
    ];
    const totalN = rows.reduce((s, r) => s + r.n, 0);
    let cursor = top;
    for (const row of rows) {
      const band = ((bot - top) * row.n) / totalN;
      const midY = cursor + band / 2;
      parts.push(label(left - 24, midY + 5, row.name, { size: 13, fill: pal.ink3, anchor: 'end' }));
      parts.push(label(left - 24, midY + 22, String(row.n), { size: 11, fill: pal.ink5, anchor: 'end' }));
      for (let i = 0; i < row.n; i++) {
        const x = xFor(Math.min(y1 - 0.1, row.year(i)));
        const jitter = (rnd(i * 11 + row.n) - 0.5) * Math.min(band * 0.7, 22);
        const r = 2.2 + row.score * 0.9;
        const strong = row.score >= 4;
        parts.push(dot(x, midY + jitter, r, strong ? pal.ochre : pal.ink4,
          `opacity="${strong ? 0.95 : 0.55}"`));
      }
      cursor += band;
    }

    parts.push(label(left, 96, '173 artefacts', { size: 22, fill: pal.paper, track: 0.14, upper: true }));
    parts.push(label(left, h - 56, 'size = how checkable it is · nothing here is a claim', { size: 14, fill: pal.ink4 }));
    return svg(parts.join(''), 'All 173 artefacts as marks placed by year and kind');
  },
};

// ── D · THE QUESTION ────────────────────────────────────────────────────────
// Deliberate withholding. A field of blanks with one thing revealed — the curiosity mechanism is
// absence, not display. Tests whether restraint beats density; the site's own aesthetic says it
// might, and it is the cheapest thing here to build.

const questionSketch: Sketch = {
  id: 'question',
  title: 'Mostly still hidden',
  pitch: 'A grid of unlabelled marks, one of them opened. Everything else waits to be touched.',
  hook: 'Exactly one thing is legible and 172 are not. The asymmetry is the invitation.',
  cannotShow: 'The whole idea IS the interaction — the frame can only show the resting state, so judge the resting state, not the concept.',
  draw({ w, h, pal, data }: SketchCtx) {
    const parts: string[] = [];
    const cols = 20, rows = 9;
    const gx = (w - 520) / cols, gy = (h - 300) / rows;
    const ox = 130, oy = 190;
    const openIdx = 84;

    for (let i = 0; i < cols * rows; i++) {
      const c = i % cols, r = Math.floor(i / cols);
      const x = ox + c * gx, y = oy + r * gy;
      if (i === openIdx) continue;
      // A closed mark: a short tick, angle varied deterministically. Reads as "something is here"
      // without saying what.
      const a = rnd(i * 3.7) * Math.PI;
      const len = 7 + rnd(i * 5.1) * 5;
      parts.push(line(x - Math.cos(a) * len, y - Math.sin(a) * len,
        x + Math.cos(a) * len, y + Math.sin(a) * len,
        pal.ink5, 1.4, `opacity="${f2(0.22 + rnd(i * 2.3) * 0.3)}"`));
    }

    // The one open mark: a real photo note, set as prose, with its own frame.
    const open = data.photos[7];
    const ox2 = ox + (openIdx % cols) * gx, oy2 = oy + Math.floor(openIdx / cols) * gy;
    parts.push(dot(ox2, oy2, 5, pal.seal));
    const bx = ox2 + 40, by = oy2 - 60;
    parts.push(`<rect x="${f2(bx)}" y="${f2(by)}" width="560" height="132" rx="2" ` +
      `fill="rgba(0,0,0,0.28)" stroke="rgba(${pal.hair}, 0.3)" stroke-width="1"/>`);
    parts.push(line(ox2 + 6, oy2, bx, by + 66, pal.seal, 1.2, 'opacity="0.6"'));
    parts.push(label(bx + 26, by + 34, open.title, { size: 13, fill: pal.ochre, track: 0.16, upper: true }));
    wrap(open.note, 46).forEach((ln, k) => {
      parts.push(prose(bx + 26, by + 68 + k * 28, ln, { size: 19, fill: pal.paper, italic: true }));
    });

    parts.push(label(w * 0.5, h - 60, '172 more', { size: 15, fill: pal.ink4, anchor: 'middle', track: 0.3, upper: true }));
    return svg(parts.join(''), 'A grid of closed marks with one opened, showing a photograph note');
  },
};

// ── E · THE SECTION ─────────────────────────────────────────────────────────
// Time as depth: the descent reaches ground, so keep going. Strata, with each year's artefacts
// embedded in its layer. Continuity with the descent is literal — down is still down.

const sectionSketch: Sketch = {
  id: 'section',
  title: 'Below the ground',
  pitch: 'The descent does not stop at the ground: it cuts into strata, one layer per year, artefacts embedded where they fell.',
  hook: 'It looks like a core sample of a person. You want to know what is in the deepest layer.',
  cannotShow: 'Scroll would drive the excavation downward, layer by layer; a still frame shows the whole section at once, which is the ending rather than the experience.',
  draw({ w, h, pal, data }: SketchCtx) {
    const parts: string[] = [];
    const years = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027];
    const left = 220, right = w - 220;
    const top = 120, bot = h - 90;
    const bandH = (bot - top) / years.length;

    years.forEach((yr, i) => {
      const y = top + i * bandH;
      // The stratum: a band whose tone deepens with depth, so down reads as older/deeper.
      const t = i / (years.length - 1);
      parts.push(`<rect x="${f2(left)}" y="${f2(y)}" width="${f2(right - left)}" height="${f2(bandH)}" ` +
        `fill="${pal.ink1}" opacity="${f2(0.10 + t * 0.30)}"/>`);
      parts.push(line(left, y, right, y, `rgba(${pal.hair}, 0.22)`, 1));
      parts.push(label(left - 26, y + bandH / 2 + 5, String(yr), { size: 15, fill: pal.ink3, anchor: 'end' }));

      // Artefacts embedded in this layer: roles that overlap the year, plus photos and equations
      // scattered deterministically. Inclusions in rock.
      const roles = data.timeline.filter((tl) => tl.period.includes(String(yr)) ||
        tl.period.includes(String(yr).slice(2)));
      roles.forEach((role, k) => {
        const x = left + 60 + k * 300;
        parts.push(`<rect x="${f2(x)}" y="${f2(y + bandH * 0.28)}" width="16" height="${f2(bandH * 0.44)}" ` +
          `rx="1" fill="${pal.ochre}" opacity="0.8"/>`);
        parts.push(label(x + 26, y + bandH / 2 + 5, role.title.split('·')[1]?.trim() ?? role.title,
          { size: 13, fill: pal.ink2 }));
      });
      // grains: small marks for the corpus items of that era
      for (let k = 0; k < 26; k++) {
        const x = left + 40 + rnd(i * 31 + k) * (right - left - 80);
        const yy = y + 6 + rnd(i * 17 + k) * (bandH - 12);
        parts.push(dot(x, yy, 1.2 + rnd(k * 3) * 1.6, pal.ink4, `opacity="${f2(0.2 + rnd(k) * 0.3)}"`));
      }
    });

    parts.push(label(left, 90, 'a section through nine years', { size: 15, fill: pal.ink4, track: 0.18, upper: true }));
    return svg(parts.join(''), 'A geological section with one stratum per year and artefacts embedded in each');
  },
};

export const BATCH1: Sketch[] = [pathSketch, voiceSketch, ledgerSketch, questionSketch, sectionSketch];
