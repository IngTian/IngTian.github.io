// src/lib/writingCovers.ts
// A writing piece's cover: a computed picture, never a photograph. Eight FIGURES, each named for what it draws, not
// for a topic. Seven are real maths run on seeded data (mulberry32 from lib/scenario.ts, seeded by a 32-bit FNV-1a
// hash of the slug), so the same slug draws the same picture on every build, and nothing on it means less than it
// appears to:
//   allocation  a rebalanced allocation: 3-5 weights as a stacked area, drifting with seeded returns between
//               rebalances; each rebalance's trade, the jump back to the target, in seal.
//   contours    isolines (isoLevels/isoRuns) of a Gaussian-mixture loss over a shallow bowl, and plain gradient
//               descent from a seeded start to the local minimum it reaches, in seal.
//   regression  48 draws of a correlated bivariate normal, the OLS line in seal, its 95% confidence band for the
//               mean (t quantile, n - 2 degrees of freedom) faint.
//   impact      square-root impact, cost ∝ sqrt(Q/V), in seal; fills scattered round it with noise that grows with
//               the order's size, and the ±1 sd band of that noise faint.
//   tails       a histogram of 1600 Student-t returns (3-5 degrees of freedom), the normal of the same mean and sd
//               over it, the tail beyond the empirical 5% quantile in seal, the VaR line.
//   drawdown    an equity curve (a geometric random walk with drift), its running maximum, every drawdown shaded
//               faint, the worst (peak to trough, and its depth) in seal.
//   pipeline    a layered DAG of tasks, each box as wide as its seeded duration; the critical path (the longest by
//               total duration, by dynamic programming) in seal.
// The eighth, quote, is the one picture of its KIND rather than a computation, for a collection of others' words: a
// commonplace book's page, ruled, a few lines of writing and an attribution, and a pair of opening quotation marks in
// seal. A piece gets it only by naming it.
// The contours plane is one function per seed, seen through a window of the cover's aspect, so a card and its
// banner show the same landscape and the descent stays perpendicular to the isolines.
//
// A piece names its figure in its frontmatter (`cover`, content.config.ts's enum of FIGURES); without one, figureFor
// picks a computed one by the slug's hash, so the choice is the file's and never a code change.
//
// CONTRACT for the CSS that colours it (components/writing/Cover.astro): every drawn element carries one ROLE
// class, cv-ink (main ink), cv-mid (secondary ink), cv-seal (the one accent, used sparingly: the point of the
// picture) or cv-faint (grid, band, area), and one TYPE class, cv-s (stroke only) or cv-f (fill only); a stroke
// carries fill="none" (so a missing stylesheet cannot fill it) and a stroke-width from 1.25 to 2, and nothing else
// of its own: no colour, no text, no gradients, no filters. What every stroke shares (a width that does not scale,
// round joins and caps) is the CSS's, once, rather than ~75 bytes on each of a cover's up to ~90 elements.
// Coordinates are rounded to a tenth of a unit. tests/writingCovers.test.ts holds all of it, and the weight: a
// card's or the lead's cover under 20 KB, a banner's under 30 KB.
//
// ponytail: a cover is inline SVG, as it must be to read the theme's tokens, so the index ships one per piece. At
// hundreds of pieces the index wants pagination or covers drawn lazily.
//
// Pure, no DOM.
import { mulberry32, gauss } from './scenario';
import { isoLevels, isoRuns } from './marchingSquares';

type Pt = [number, number];
type Role = 'ink' | 'mid' | 'seal' | 'faint';
interface Box { L: number; R: number; T: number; B: number }

const n1 = (v: number) => String(Math.round(v * 10) / 10);
const pts = (p: Pt[]) => p.map(([x, y]) => `${n1(x)},${n1(y)}`).join(' ');
const S = (width: number) => `fill="none" stroke-width="${width}"`;
const line = (role: Role, p: Pt[], width = 1.5) => `<polyline class="cv-${role} cv-s" points="${pts(p)}" ${S(width)}/>`;
const area = (role: Role, p: Pt[]) => `<polygon class="cv-${role} cv-f" points="${pts(p)}"/>`;
const dot = (role: Role, x: number, y: number, r: number) =>
  `<circle class="cv-${role} cv-f" cx="${n1(x)}" cy="${n1(y)}" r="${r}"/>`;
const ring = (role: Role, x: number, y: number, r: number, width = 1.25) =>
  `<circle class="cv-${role} cv-s" cx="${n1(x)}" cy="${n1(y)}" r="${r}" ${S(width)}/>`;
const rect = (role: Role, type: 's' | 'f', x: number, y: number, w: number, h: number, width = 1.5) =>
  `<rect class="cv-${role} cv-${type}" x="${n1(x)}" y="${n1(y)}" width="${n1(w)}" height="${n1(h)}"${type === 's' ? ' ' + S(width) : ''}/>`;
/** Maps [d0, d1] onto [r0, r1]. */
const lin = (d0: number, d1: number, r0: number, r1: number) => (v: number) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
/** A run's points at least `d` units apart, its ends kept. The grid is res x res over a box wider than it is tall
 *  (four times, on a banner), so an isoline carries points ~3 units apart along y that no screen shows. Thinned at
 *  3, a contours cover sheds a fifth to a quarter of its bytes, and a 3-unit chord strays about a tenth of a unit
 *  from a curve of radius 10. */
const thin = (p: Pt[], d: number): Pt[] => {
  const out: Pt[] = [p[0]];
  for (const q of p.slice(1, -1)) {
    const [x, y] = out[out.length - 1];
    if (Math.hypot(q[0] - x, q[1] - y) >= d) out.push(q);
  }
  return [...out, p[p.length - 1]];
};

/** FNV-1a, 32-bit: the slug's seed. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

type Rand = () => number;
const between = (r: Rand, a: number, b: number) => a + (b - a) * r();

// ── allocation: a rebalanced allocation drifting between rebalances ─────────────────────────────────────────
function allocation(r: Rand, b: Box): string {
  const K = 3 + Math.floor(r() * 3), T = 48, every = [8, 12, 16][Math.floor(r() * 3)];
  const raw = Array.from({ length: K }, () => between(r, 0.5, 1.5));
  const target = raw.map((v) => v / sum(raw));
  // drift apart by their means (a winner's weight grows until the rebalance sells it back), with some noise
  const mu = Array.from({ length: K }, () => 0.035 * gauss(r));
  const vol = Array.from({ length: K }, () => between(r, 0.01, 0.03));
  // One column of weights per step; a rebalance adds a second column at the same t, back on the target.
  const cols: { t: number; w: number[] }[] = [{ t: 0, w: target }];
  let w = target;
  for (let t = 1; t <= T; t++) {
    const grown = w.map((v, i) => v * Math.exp(mu[i] + vol[i] * gauss(r)));
    w = grown.map((v) => v / sum(grown));
    cols.push({ t, w });
    if (t % every === 0 && t < T) { w = target; cols.push({ t, w }); }
  }
  const X = lin(0, T, b.L, b.R), Y = lin(0, 1, b.B, b.T);
  // boundary k is the cumulative weight of the first k assets; 0 and K are the frame
  const bound = (k: number) => cols.map((c): Pt => [X(c.t), Y(sum(c.w.slice(0, k)))]);
  let out = '';
  for (let k = 0; k < K; k += 2) out += area('faint', [...bound(k), ...bound(k + 1).reverse()]);
  out += line('mid', [[b.L, b.T], [b.R, b.T]], 1.25) + line('mid', [[b.L, b.B], [b.R, b.B]], 1.25);
  for (let k = 1; k < K; k++) {
    const p = bound(k);
    let run: Pt[] = [p[0]];
    for (let i = 1; i < p.length; i++) {
      if (cols[i].t === cols[i - 1].t) { out += line('ink', run) + line('seal', [p[i - 1], p[i]], 2); run = [p[i]]; }
      else run.push(p[i]);
    }
    out += line('ink', run);
  }
  return out;
}

// ── contours: isolines of a loss, and gradient descent to a local minimum ──────────────────────────────
function contours(r: Rand, b: Box): string {
  // Wells on a row along x (one plane per seed), over a shallow bowl; the window is the cover's aspect, centred.
  const wells = Array.from({ length: 9 }, (_, i) => ({
    x: (i - 4) * 1.1 + between(r, -0.3, 0.3), y: between(r, -0.55, 0.55),
    a: between(r, 0.5, 1.1), s: between(r, 0.32, 0.55),
  }));
  const f = (x: number, y: number) =>
    0.25 * ((x / 4) ** 2 + y * y) - sum(wells.map((k) => k.a * Math.exp(-((x - k.x) ** 2 + (y - k.y) ** 2) / (2 * k.s * k.s))));
  const grad = (x: number, y: number): Pt => {
    let gx = 0.5 * x / 16, gy = 0.5 * y;
    for (const k of wells) {
      const e = (k.a * Math.exp(-((x - k.x) ** 2 + (y - k.y) ** 2) / (2 * k.s * k.s))) / (k.s * k.s);
      gx += e * (x - k.x); gy += e * (y - k.y);
    }
    return [gx, gy];
  };
  const ar = (b.R - b.L) / (b.B - b.T), yh = 1.05, xh = yh * ar;
  const bounds = { x0: -xh, y0: -yh, x1: xh, y1: yh };
  const X = lin(-xh, xh, b.L, b.R), Y = lin(-yh, yh, b.B, b.T);
  const P = ([x, y]: Pt): Pt => [X(x), Y(y)];
  // Plain gradient descent, a fixed step, until the step is negligible. The start is the first seeded point
  // whose path stays in the card's window (|x| < 1.5, |y| < 0.95) and travels far enough to read.
  const descend = (p: Pt): Pt[] => {
    const path: Pt[] = [p];
    for (let i = 0; i < 600; i++) {
      const [gx, gy] = grad(p[0], p[1]);
      p = [p[0] - 0.06 * gx, p[1] - 0.06 * gy];
      path.push(p);
      if (Math.hypot(gx, gy) * 0.06 < 1e-4) break;
    }
    return path;
  };
  let path: Pt[] = [];
  for (let tries = 0; tries < 40; tries++) {
    const cand = descend([between(r, -1.4, 1.4), (r() < 0.5 ? -1 : 1) * between(r, 0.6, 0.9)]);
    const end = cand[cand.length - 1];
    const inside = cand.every(([x, y]) => Math.abs(x) < 1.5 && Math.abs(y) < 0.95);
    if (inside && Math.hypot(end[0] - cand[0][0], end[1] - cand[0][1]) > 0.7) { path = cand; break; }
    if (!path.length && inside) path = cand;
  }
  if (!path.length) path = descend([0, 0.8]);
  const res = Math.round(56 * Math.sqrt(ar / 1.6));
  let out = '';
  for (const level of isoLevels(f, bounds, 9, 48)) {
    for (const run of isoRuns(f, bounds, level, res)) out += line('mid', thin(run.map(P), 3), 1.25);
  }
  const s = P(path[0]), e = P(path[path.length - 1]);
  return out + line('seal', path.map(P), 2) + ring('ink', s[0], s[1], 4, 1.5) + dot('seal', e[0], e[1], 4);
}

// ── regression: a correlated scatter, its OLS line, the line's 95% confidence band ─────────────────────────
function regression(r: Rand, b: Box): string {
  const n = 48, rho = (r() < 0.25 ? -1 : 1) * between(r, 0.45, 0.85);
  const xs: number[] = [], ys: number[] = [];
  for (let i = 0; i < n; i++) { const z = gauss(r); xs.push(z); ys.push(rho * z + Math.sqrt(1 - rho * rho) * gauss(r)); }
  const mx = sum(xs) / n, my = sum(ys) / n;
  const sxx = sum(xs.map((x) => (x - mx) ** 2)), sxy = sum(xs.map((x, i) => (x - mx) * (ys[i] - my)));
  const beta = sxy / sxx, alpha = my - beta * mx;
  const s = Math.sqrt(sum(xs.map((x, i) => (ys[i] - alpha - beta * x) ** 2)) / (n - 2));
  // t quantile at 0.975 with n - 2 degrees of freedom, by the Cornish-Fisher expansion about z = 1.96
  const z = 1.959964, nu = n - 2;
  const tq = z + (z ** 3 + z) / (4 * nu) + (5 * z ** 5 + 16 * z ** 3 + 3 * z) / (96 * nu * nu);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const X = lin(x0, x1, b.L, b.R), Y = lin(y0, y1, b.B, b.T);
  const grid = Array.from({ length: 41 }, (_, i) => x0 + ((x1 - x0) * i) / 40);
  const half = (x: number) => tq * s * Math.sqrt(1 / n + (x - mx) ** 2 / sxx);
  const upper = grid.map((x): Pt => [X(x), Y(alpha + beta * x + half(x))]);
  const lower = grid.map((x): Pt => [X(x), Y(alpha + beta * x - half(x))]).reverse();
  let out = area('faint', [...upper, ...lower]);
  out += xs.map((x, i) => dot('ink', X(x), Y(ys[i]), 2.4)).join('');
  return out + line('seal', [[X(x0), Y(alpha + beta * x0)], [X(x1), Y(alpha + beta * x1)]], 2);
}

// ── impact: square-root impact, and the fills it predicts on average ────────────────────────────────────
function impact(r: Rand, b: Box): string {
  // participation x = Q/V in (0, 1] of the largest order; expected cost k sqrt(x); a fill's cost carries the price's
  // own move over the order, whose sd grows with the order's length
  const k = between(r, 0.6, 1), sd = (x: number) => 0.1 + 0.12 * Math.sqrt(x);
  const X = lin(0, 1, b.L, b.R), Y = lin(-0.3, 1.35, b.B, b.T);
  const grid = Array.from({ length: 61 }, (_, i) => (i / 60) ** 2);
  const band = [...grid.map((x): Pt => [X(x), Y(k * Math.sqrt(x) + sd(x))]), ...grid.map((x): Pt => [X(x), Y(k * Math.sqrt(x) - sd(x))]).reverse()];
  let out = area('faint', band);
  out += line('mid', [[b.L, Y(0)], [b.R, Y(0)]], 1.25) + line('mid', [[b.L, b.B], [b.L, b.T]], 1.25);
  const fills = 64 + Math.floor(r() * 24), skew = between(r, 1.3, 2);
  for (let i = 0; i < fills; i++) {
    const x = 0.02 + 0.98 * r() ** skew;   // most orders are small
    out += ring('ink', X(x), Y(k * Math.sqrt(x) + sd(x) * gauss(r)), 2.6);
  }
  return out + line('seal', grid.map((x): Pt => [X(x), Y(k * Math.sqrt(x))]), 2);
}

// ── tails: fat-tailed returns, the 5% tail and its VaR ──────────────────────────────────────────────────────
function tails(r: Rand, b: Box): string {
  const N = 1600, nu = 3 + Math.floor(r() * 3);
  const xs = Array.from({ length: N }, () => {
    let chi = 0;
    for (let k = 0; k < nu; k++) chi += gauss(r) ** 2;
    return gauss(r) / Math.sqrt(chi / nu);
  });
  const sorted = [...xs].sort((a, c) => a - c);
  const varX = sorted[Math.floor(0.05 * N)];
  const mean = sum(xs) / N, sd = Math.sqrt(sum(xs.map((x) => (x - mean) ** 2)) / (N - 1));
  // the central 99%, symmetric: a t's few extreme draws would squeeze the body into a spike
  const lim = Math.max(-sorted[Math.floor(0.005 * N)], sorted[Math.ceil(0.995 * N) - 1]);
  const bins = 37, bw = (2 * lim) / bins, counts = new Array(bins).fill(0);
  for (const x of xs) { const i = Math.floor((x + lim) / bw); if (i >= 0 && i < bins) counts[i]++; }
  const normal = (x: number) => (N * bw * Math.exp(-(((x - mean) / sd) ** 2) / 2)) / (sd * Math.sqrt(2 * Math.PI));
  const top = Math.max(...counts, normal(mean)) * 1.08;
  const X = lin(-lim, lim, b.L, b.R), Y = lin(0, top, b.B, b.T);
  // the histogram's outline over [x0, x1], closed on the baseline: one shape, so adjacent bars leave no seam
  const steps = (x0: number, x1: number): Pt[] => {
    const p: Pt[] = [[X(x0), Y(0)]];
    counts.forEach((c, i) => {
      const a = Math.max(x0, -lim + i * bw), z = Math.min(x1, -lim + (i + 1) * bw);
      if (z > a) p.push([X(a), Y(c)], [X(z), Y(c)]);
    });
    return [...p, [X(x1), Y(0)]];
  };
  const curve = Array.from({ length: 121 }, (_, i): Pt => { const x = -lim + (2 * lim * i) / 120; return [X(x), Y(normal(x))]; });
  let out = area('faint', steps(varX, lim)) + area('seal', steps(-lim, varX));
  out += line('ink', steps(-lim, lim), 1.25) + line('mid', curve, 1.5) + line('mid', [[b.L, b.B], [b.R, b.B]], 1.25);
  return out + line('ink', [[X(varX), b.B], [X(varX), b.T]], 1.5);
}

// ── drawdown: an equity curve, its running maximum, its drawdowns ───────────────────────────────────────
function drawdown(r: Rand, b: Box): string {
  const T = 360, mu = between(r, 0.0006, 0.0012), sigma = between(r, 0.011, 0.017);
  const eq = [1];
  for (let t = 1; t <= T; t++) eq.push(eq[t - 1] * Math.exp(mu - (sigma * sigma) / 2 + sigma * gauss(r)));
  const peak: number[] = [];
  eq.forEach((v, t) => peak.push(Math.max(v, t ? peak[t - 1] : v)));
  let trough = 0;
  eq.forEach((v, t) => { if (1 - v / peak[t] > 1 - eq[trough] / peak[trough]) trough = t; });
  let from = trough;
  while (from > 0 && eq[from] < peak[from]) from--;
  const X = lin(0, T, b.L, b.R), Y = lin(Math.min(...eq), Math.max(...eq), b.B, b.T);
  const at = (a: number[]) => (t: number): Pt => [X(t), Y(a[t])];
  let out = '';
  // each drawdown: the area between the running maximum and the curve, from its peak until the curve regains it
  for (let t = 1; t <= T; t++) {
    if (eq[t] >= peak[t]) continue;
    const s = t - 1;
    while (t <= T && eq[t] < peak[t]) t++;
    const span = Array.from({ length: Math.min(t, T) - s + 1 }, (_, i) => s + i);
    out += area('faint', [...span.map(at(peak)), ...span.reverse().map(at(eq))]);
  }
  const all = eq.map((_, t) => t);
  out += line('mid', all.map(at(peak)), 1.25) + line('ink', all.map(at(eq)), 1.5);
  const worst = Array.from({ length: trough - from + 1 }, (_, i) => from + i);
  return out + line('seal', worst.map(at(eq)), 2) + line('seal', [at(peak)(trough), at(eq)(trough)], 2);
}

// ── pipeline: a layered DAG of tasks and its critical path ──────────────────────────────────────────────────
function pipeline(r: Rand, b: Box): string {
  const layers = 4 + Math.floor(r() * 2);
  const sizes = Array.from({ length: layers }, (_, l) => (l === 0 ? 1 + Math.floor(r() * 2) : l === layers - 1 ? 1 : 2 + Math.floor(r() * 3)));
  const nodes = sizes.map((n) => Array.from({ length: n }, () => ({ d: between(r, 0.35, 1), parents: [] as number[] })));
  for (let l = 1; l < layers; l++) {
    const prev = sizes[l - 1];
    nodes[l].forEach((nd, i) => {
      const near = Math.min(prev - 1, Math.round(((i + 0.5) / sizes[l]) * prev - 0.5));   // the parent at its height
      nd.parents.push(near);
      if (prev > 1 && r() < 0.45) nd.parents.push(Math.min(prev - 1, Math.max(0, near + (r() < 0.5 ? -1 : 1))));
      nd.parents = [...new Set(nd.parents)];
    });
    for (let p = 0; p < prev; p++) {   // every task feeds something
      if (!nodes[l].some((nd) => nd.parents.includes(p))) nodes[l][Math.min(sizes[l] - 1, Math.round(((p + 0.5) / prev) * sizes[l] - 0.5))].parents.push(p);
    }
  }
  // longest path by total duration: finish(n) = d(n) + max over parents of finish(parent)
  const finish = nodes.map((layer) => layer.map(() => 0)), via = nodes.map((layer) => layer.map(() => -1));
  nodes.forEach((layer, l) => layer.forEach((nd, i) => {
    for (const p of nd.parents) if (finish[l - 1][p] > finish[l][i]) { finish[l][i] = finish[l - 1][p]; via[l][i] = p; }
    finish[l][i] += nd.d;
  }));
  const crit = new Set<string>();
  for (let l = layers - 1, i = 0; l >= 0 && i >= 0; i = via[l][i], l--) crit.add(`${l}:${i}`);
  const colW = (b.R - b.L) / layers, maxW = Math.min(colW * 0.62, 120), bh = Math.min(18, (b.B - b.T) / 9);
  const cx = (l: number) => b.L + l * colW + (colW - maxW) / 2;
  const cy = (l: number, i: number) => b.T + ((i + 0.5) / sizes[l]) * (b.B - b.T);
  let edges = '', seal = '', boxes = '';
  nodes.forEach((layer, l) => layer.forEach((nd, i) => {
    for (const p of nd.parents) {
      // a curve per edge, never a shared bus, which would draw links that do not exist; it leaves its own row only
      // past the column's widest box, so it never crosses a box
      const x0 = cx(l - 1) + nodes[l - 1][p].d * maxW, xs = cx(l - 1) + maxW, x1 = cx(l), xm = (xs + x1) / 2;
      const y0 = cy(l - 1, p), y1 = cy(l, i);
      const d = `M${n1(x0)} ${n1(y0)}H${n1(xs)}C${n1(xm)} ${n1(y0)} ${n1(xm)} ${n1(y1)} ${n1(x1)} ${n1(y1)}`;
      if (crit.has(`${l}:${i}`) && via[l][i] === p) seal += `<path class="cv-seal cv-s" d="${d}" ${S(2)}/>`;
      else edges += `<path class="cv-mid cv-s" d="${d}" ${S(1.25)}/>`;
    }
    const on = crit.has(`${l}:${i}`);
    boxes += rect('faint', 'f', cx(l), cy(l, i) - bh / 2, nd.d * maxW, bh);
    boxes += rect(on ? 'seal' : 'ink', 's', cx(l), cy(l, i) - bh / 2, nd.d * maxW, bh, on ? 2 : 1.5);
  }));
  return edges + seal + boxes;
}

// ── quote: a commonplace book's page — the one figure that is a picture of its kind, not a computation ──────
/** One opening quotation mark, a "6": its ball at (cx, cy), radius R, and its tail rising to the upper right. */
const mark = (cx: number, cy: number, R: number): string => {
  const P = (x: number, y: number) => `${n1(cx + x * R)} ${n1(cy + y * R)}`;
  return dot('seal', cx, cy, R)
    + `<path class="cv-seal cv-f" d="M${P(-1, 0)}Q${P(-1.05, -1.9)} ${P(0.75, -2.55)}Q${P(-0.35, -1.75)} ${P(-0.1, -0.85)}Z"/>`;
};
function quote(r: Rand, b: Box): string {
  const R = Math.round(Math.min((b.B - b.T) * 0.15, (b.R - b.L) * 0.055) * 10) / 10;
  const x1 = b.L + 1.05 * R, x2 = x1 + 2.5 * R, cy = b.T + 2.6 * R;
  const gap = Math.max(14, (b.B - b.T) / 7), amp = Math.min(1.6, gap * 0.1), phase = r() * 6.28;
  let rules = '', ink = '';
  const rows: number[] = [];
  for (let y = b.T + gap * 0.9; y <= b.B + 0.01; y += gap) rows.push(y);
  rows.forEach((y, k) => {
    rules += line('faint', [[b.L, y], [b.R, y]], 1.25);
    const last = k === rows.length - 1, base = y - gap * 0.3;
    if (last) {   // the attribution: a dash and a name, right-aligned on the last rule
      const w = (b.R - b.L) * between(r, 0.14, 0.22), x0 = b.R - w;
      ink += line('mid', [[x0 - gap * 0.9, base], [x0 - gap * 0.35, base]], 1.5) + line('ink', [[x0, base], [b.R, base]], 1.5);
      return;
    }
    if (k === rows.length - 2) return;   // a blank line before it
    // a line of writing: after the marks while the rows run beside them, the full width below them; the paragraph's
    // last line short
    const x0 = base < cy + R + gap * 0.35 ? x2 + 1.7 * R : b.L;
    const x9 = x0 + (b.R - x0) * (k === rows.length - 3 ? between(r, 0.3, 0.55) : between(r, 0.72, 0.97));
    const p: Pt[] = [];
    for (let x = x0; x <= x9; x += 6) p.push([x, base - amp * Math.sin(x * 0.11 + phase + k)]);
    if (p.length > 1) ink += line('mid', p, 1.5);
  });
  return rules + ink + mark(x1, cy, R) + mark(x2, cy, R);
}

/** The figures a piece without a `cover` is given by its slug: the computed ones. */
const COMPUTED = ['allocation', 'contours', 'regression', 'impact', 'tails', 'drawdown', 'pipeline'] as const;
/** Every figure a cover can draw, each named for what it draws; content.config.ts's `cover` enum is this list.
 *  `quote` only where a piece asks for it: it is an emblem of a collection of others' words, not a computation. */
export const FIGURES = [...COMPUTED, 'quote'] as const;
export type Figure = (typeof FIGURES)[number];

/** The viewBox each surface draws a cover at (components/writing/Cover.astro's `size`): a card, the index's lead, a
 *  piece's banner. */
export const COVER_SIZES = { card: [400, 250], lead: [640, 400], banner: [1200, 360] } as const;

const DRAW: Record<Figure, (r: Rand, b: Box) => string> = { allocation, contours, regression, impact, tails, drawdown, pipeline, quote };

/** The figure a piece's cover draws: the one its frontmatter names, else a computed one picked by its slug's hash. */
export function figureFor(slug: string, cover?: Figure): Figure {
  return cover ?? COMPUTED[hash(slug) % COMPUTED.length];
}

/** A cover as an SVG string, viewBox 0 0 w h, seeded by `seed` (the slug), drawn only with the contract's classes. */
export function coverSvg(figure: Figure, seed: string, w: number, h: number): string {
  const m = Math.round(Math.min(w, h) * 0.14), mx = Math.max(m, Math.round(w * 0.07));
  const body = DRAW[figure](mulberry32(hash(seed)), { L: mx, R: w - mx, T: m, B: h - m });
  return `<svg class="cover" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${body}</svg>`;
}
