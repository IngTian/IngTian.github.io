// src/lib/podPaint.ts
// The ONLY file that touches canvas APIs. Geometry comes from podGeometry, content
// from podScreens; this module just draws. Kept separate so the maths stays
// unit-testable and the drawing stays reviewable by eye.

import { POD_LAYOUT, sortByDepth, podProject, type PodQuad } from './podGeometry';
import {
  SCREEN_CONTENT, ideLines, backtestCurve, latexLines, bloombergRows, type GanttBar,
} from './podScreens';

export type PodStyle = 'pixel' | 'constr' | 'real' | 'dots';

export interface PaintOpts {
  W: number; H: number; dpr: number;
  style: PodStyle;
  theme: 'light' | 'dark';
  /** seconds since mount; drives only the cursor blink and ticker, never layout */
  tSec: number;
  hoverSlot: number | null;
  gantt: GanttBar[];
}

/** Palette, resolved from the theme. Values mirror tokens.css — the canvas is
 *  JS-painted so it cannot inherit CSS custom properties. */
function palette(theme: 'light' | 'dark') {
  const dark = theme === 'dark';
  return {
    wall: dark ? '#0a0c0f' : '#14120f',
    bench: dark ? '#151a1d' : '#241f19',
    benchEdge: dark ? '#20272b' : '#332c23',
    bezel: dark ? '#05070a' : '#0d0b09',
    screenBg: dark ? '#080b0d' : '#0b0d0f',
    accent: dark ? '#66c28c' : '#c8a36a',   // --ochre per theme
    ink: dark ? '#dce1dc' : '#efe9dd',
    dim: dark ? 'rgba(220,225,220,0.42)' : 'rgba(239,233,221,0.42)',
    seal: dark ? '#e0574a' : '#b23a2e',
    indigo: dark ? '#5fb2c9' : '#6d7689',
    paper: dark ? '#dfe3df' : '#efe9dd',
  };
}

/** Deterministic per-dot jitter in [0,1), hashed from the dot's lattice position.
 *  NOT Math.random(): the pod repaints on hover, theme change and resize, and a
 *  fresh random per repaint makes the whole scene shimmer when the pointer merely
 *  crosses a monitor — and it would stop screenshots reproducing. */
function dotJitter(x: number, y: number): number {
  const h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return h - Math.floor(h);
}

const path = (ctx: CanvasRenderingContext2D, q: PodQuad, o: PaintOpts) => {
  ctx.beginPath();
  q.corners.forEach((c, i) => {
    const [x, y] = podProject(c[0], c[1], c[2], o.W, o.H);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.closePath();
};

/** Screen rect in device px, for clipping and laying out screen content. */
function screenBox(q: PodQuad, o: PaintOpts) {
  const pts = q.corners.map((c) => podProject(c[0], c[1], c[2], o.W, o.H));
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

export function paintPod(ctx: CanvasRenderingContext2D, o: PaintOpts): void {
  const c = palette(o.theme);
  ctx.save();
  ctx.scale(o.dpr, o.dpr);
  ctx.clearRect(0, 0, o.W, o.H);

  for (const q of sortByDepth(POD_LAYOUT, o.W, o.H)) {
    if (q.id === 'wall') { paintWall(ctx, q, o, c); continue; }
    if (q.id === 'bench') { paintBench(ctx, q, o, c); continue; }
    if (q.id === 'monitor') { paintMonitor(ctx, q, o, c); continue; }
    paintDeskObject(ctx, q, o, c);
  }
  ctx.restore();
}

type Pal = ReturnType<typeof palette>;

function paintWall(ctx: CanvasRenderingContext2D, q: PodQuad, o: PaintOpts, c: Pal) {
  // The wall is deliberately near-black: DARK surroundings are what make the lit
  // screens read as lit. It is not a background, it is the lighting design.
  if (o.style === 'dots') {
    // Dot field — must be visible but subdued.
    const pts = q.corners.map((corner) => podProject(corner[0], corner[1], corner[2], o.W, o.H));
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    const y0 = Math.min(...ys), y1 = Math.max(...ys);

    const spacing = 14 * o.dpr; // denser so it's perceivable
    const baseAlpha = 0.18;     // visible against the page
    // Parse the palette wall color instead of hardcoding
    const [r, g, b] = c.wall.match(/[\da-f]{2}/gi)!.map(h => parseInt(h, 16));

    for (let y = Math.max(0, y0); y < Math.min(o.H, y1); y += spacing) {
      for (let x = Math.max(0, x0); x < Math.min(o.W, x1); x += spacing) {
        // tiny jitter so the grid doesn't alias
        const jx = ((Math.sin(x * 0.7 + y * 1.1) * 0.5 + 0.5) - 0.5) * spacing * 0.4;
        const jy = ((Math.sin(x * 1.3 + y * 0.9) * 0.5 + 0.5) - 0.5) * spacing * 0.4;
        const alpha = baseAlpha * (0.7 + dotJitter(x, y) * 0.3);
        const radius = 1.1 * o.dpr;

        ctx.beginPath();
        ctx.arc(x + jx, y + jy, radius, 0, 2 * Math.PI);
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
        ctx.fill();
      }
    }
  } else {
    path(ctx, q, o);
    ctx.fillStyle = c.wall;
    ctx.fill();
  }
}

function paintBench(ctx: CanvasRenderingContext2D, q: PodQuad, o: PaintOpts, c: Pal) {
  if (o.style === 'dots') {
    // Denser dot field, brighter toward the back where the monitors spill light onto it.
    const pts = q.corners.map((corner) => podProject(corner[0], corner[1], corner[2], o.W, o.H));
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    const y0 = Math.min(...ys), y1 = Math.max(...ys);

    const spacing = 8 * o.dpr; // denser than the wall, clearly visible
    const yTop = y0, yBot = y1;
    // Parse bench color from palette
    const [r, g, b] = c.bench.match(/[\da-f]{2}/gi)!.map(h => parseInt(h, 16));

    for (let y = Math.max(0, y0); y < Math.min(o.H, y1); y += spacing) {
      for (let x = Math.max(0, x0); x < Math.min(o.W, x1); x += spacing) {
        const jx = ((Math.sin(x * 0.7 + y * 1.1) * 0.5 + 0.5) - 0.5) * spacing * 0.4;
        const jy = ((Math.sin(x * 1.3 + y * 0.9) * 0.5 + 0.5) - 0.5) * spacing * 0.4;

        // Screen spill: brighter at the top (back of the bench)
        const spillT = 1 - (y - yTop) / (yBot - yTop);
        const alpha = (0.24 + spillT * 0.32) * (0.7 + dotJitter(x, y) * 0.3);
        const radius = 1.2 * o.dpr;

        ctx.beginPath();
        ctx.arc(x + jx, y + jy, radius, 0, 2 * Math.PI);
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
        ctx.fill();
      }
    }
  } else {
    path(ctx, q, o);
    // Screen spill: a vertical gradient, brightest at the back where the monitors are.
    const pts = q.corners.map((k) => podProject(k[0], k[1], k[2], o.W, o.H));
    const yTop = Math.min(...pts.map((p) => p[1]));
    const yBot = Math.max(...pts.map((p) => p[1]));
    const g = ctx.createLinearGradient(0, yTop, 0, yBot);
    g.addColorStop(0, c.benchEdge);
    g.addColorStop(1, c.bench);
    ctx.fillStyle = g;
    ctx.fill();
  }
}

function paintMonitor(ctx: CanvasRenderingContext2D, q: PodQuad, o: PaintOpts, c: Pal) {
  const b = screenBox(q, o);
  const meta = SCREEN_CONTENT.find((s) => s.slot === q.slot)!;
  const hot = o.hoverSlot === q.slot;

  // bezel with depth: darker base + lighter top edge
  const bezelW = 3;
  ctx.fillStyle = c.bezel;
  ctx.fillRect(b.x - bezelW, b.y - bezelW, b.w + bezelW * 2, b.h + bezelW * 2);
  // top edge lighter to read as a ridge
  ctx.fillStyle = c.benchEdge;
  ctx.fillRect(b.x - bezelW, b.y - bezelW, b.w + bezelW * 2, 1.5);
  // screen
  ctx.fillStyle = c.screenBg;
  ctx.fillRect(b.x, b.y, b.w, b.h);

  ctx.save();
  ctx.beginPath();
  ctx.rect(b.x, b.y, b.w, b.h);
  ctx.clip();
  const pad = Math.max(4, b.w * 0.05);
  const inner = { x: b.x + pad, y: b.y + pad, w: b.w - pad * 2, h: b.h - pad * 2 };
  if (meta.kind === 'ide') paintIde(ctx, inner, o, c);
  if (meta.kind === 'backtest') paintBacktest(ctx, inner, o, c);
  if (meta.kind === 'gantt') paintGantt(ctx, inner, o, c);
  if (meta.kind === 'latex') paintLatex(ctx, inner, o, c);
  if (meta.kind === 'bloomberg') paintBloomberg(ctx, inner, o, c);
  ctx.restore();

  // hover/focus: lift the glow. Same state the DOM control drives, so the visual
  // and the focus state are one state.
  if (hot) {
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(b.x - 1, b.y - 1, b.w + 2, b.h + 2);
  }
}

function mono(ctx: CanvasRenderingContext2D, px: number) {
  ctx.font = `${px}px "JetBrains Mono", ui-monospace, monospace`;
  ctx.textBaseline = 'top';
}

function paintIde(ctx: CanvasRenderingContext2D, r: { x: number; y: number; w: number; h: number }, o: PaintOpts, c: Pal) {
  const lines = ideLines();
  const fs = Math.max(4, r.h / (lines.length + 2));
  mono(ctx, fs);
  const gutter = fs * 2.2;
  ctx.fillStyle = 'rgba(239,233,221,0.10)';
  ctx.fillRect(r.x, r.y, gutter, r.h);
  lines.forEach((ln, i) => {
    const y = r.y + i * fs * 1.35;
    ctx.fillStyle = c.dim;
    ctx.fillText(String(i + 1).padStart(2, ' '), r.x + 2, y);
    let x = r.x + gutter + ln.indent * fs * 1.6;
    for (const t of ln.tokens) {
      ctx.fillStyle = t.kind === 'kw' ? c.accent
        : t.kind === 'fn' ? c.ink
        : t.kind === 'str' ? c.seal
        : t.kind === 'num' ? c.indigo
        : t.kind === 'comment' ? c.dim
        : 'rgba(239,233,221,0.78)';
      ctx.fillText(t.text, x, y);
      x += ctx.measureText(t.text).width;
    }
  });
}

function paintBacktest(ctx: CanvasRenderingContext2D, r: { x: number; y: number; w: number; h: number }, o: PaintOpts, c: Pal) {
  const pts = backtestCurve(72);
  // baseline grid
  ctx.strokeStyle = 'rgba(239,233,221,0.09)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 3; i++) {
    const y = r.y + (r.h / 3) * i;
    ctx.beginPath(); ctx.moveTo(r.x, y); ctx.lineTo(r.x + r.w, y); ctx.stroke();
  }
  ctx.strokeStyle = c.accent;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  pts.forEach((p, i) => {
    const x = r.x + p.x * r.w, y = r.y + (1 - p.y) * r.h;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
  // fill under the curve, very faint
  ctx.lineTo(r.x + r.w, r.y + r.h); ctx.lineTo(r.x, r.y + r.h); ctx.closePath();
  ctx.fillStyle = o.theme === 'dark' ? 'rgba(102,194,140,0.10)' : 'rgba(200,163,106,0.10)';
  ctx.fill();
}

function paintGantt(ctx: CanvasRenderingContext2D, r: { x: number; y: number; w: number; h: number }, o: PaintOpts, c: Pal) {
  const bars = o.gantt;
  if (!bars.length) return;
  const lo = Math.min(...bars.map((b) => b.start));
  const hi = Math.max(...bars.map((b) => b.end));
  const span = Math.max(1, hi - lo);   // never divide by zero: a single-year Gantt
                                       // would otherwise NaN out and blank the screen
  const rowH = r.h / bars.length;
  const fs = Math.max(3.5, rowH * 0.42);
  mono(ctx, fs);
  bars.forEach((b, i) => {
    const y = r.y + i * rowH + rowH * 0.22;
    const x0 = r.x + ((b.start - lo) / span) * r.w;
    const x1 = r.x + ((b.end - lo) / span) * r.w;
    ctx.fillStyle = b.kind === 'education' ? c.indigo : c.accent;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(x0, y, Math.max(2, x1 - x0), rowH * 0.34);
    ctx.globalAlpha = 1;
    ctx.fillStyle = c.dim;
    ctx.fillText(b.label, r.x + 1, y + rowH * 0.40);
  });
}

function paintLatex(ctx: CanvasRenderingContext2D, r: { x: number; y: number; w: number; h: number }, o: PaintOpts, c: Pal) {
  const lines = latexLines();
  const fs = Math.max(3.5, r.h / (lines.length + 3));
  lines.forEach((ln, i) => {
    const y = r.y + i * fs * 1.6;
    if (ln.kind === 'math') {
      ctx.font = `italic ${fs * 1.05}px "Fraunces", Georgia, serif`;
      ctx.fillStyle = c.ink;
      ctx.textAlign = 'center';
      ctx.fillText(ln.text, r.x + r.w / 2, y);
      ctx.textAlign = 'left';
    } else {
      ctx.font = `${ln.kind === 'head' ? 'bold ' : ''}${fs}px "Fraunces", Georgia, serif`;
      ctx.textBaseline = 'top';
      ctx.fillStyle = ln.kind === 'head' ? c.ink : o.theme === 'dark' ? 'rgba(220,225,220,0.66)' : 'rgba(239,233,221,0.66)';
      // Truncate if too wide
      const maxW = r.w - 4;
      let text = ln.text;
      let measured = ctx.measureText(text).width;
      if (measured > maxW && ln.kind === 'head') {
        // Scale down the heading to fit
        const scale = maxW / measured;
        ctx.font = `${ln.kind === 'head' ? 'bold ' : ''}${fs * scale}px "Fraunces", Georgia, serif`;
      }
      ctx.fillText(text, r.x + 2, y);
    }
  });
}

function paintBloomberg(ctx: CanvasRenderingContext2D, r: { x: number; y: number; w: number; h: number }, o: PaintOpts, c: Pal) {
  const rows = bloombergRows();
  const fs = Math.max(3.5, r.h / (rows.length + 2));
  mono(ctx, fs);
  // header band — the panel tell
  ctx.fillStyle = o.theme === 'dark' ? 'rgba(102,194,140,0.18)' : 'rgba(200,163,106,0.18)';
  ctx.fillRect(r.x, r.y, r.w, fs * 1.3);
  ctx.fillStyle = c.accent;
  ctx.fillText('MKT MONITOR', r.x + 2, r.y + fs * 0.15);
  rows.forEach((row, i) => {
    const y = r.y + fs * 1.7 + i * fs * 1.25;
    ctx.fillStyle = c.accent;
    ctx.fillText(row.ticker, r.x + 2, y);
    ctx.fillStyle = o.theme === 'dark' ? 'rgba(220,225,220,0.72)' : 'rgba(239,233,221,0.72)';
    ctx.fillText(row.last, r.x + r.w * 0.36, y);
    ctx.fillStyle = row.up ? c.accent : c.seal;
    ctx.fillText(row.chg, r.x + r.w * 0.64, y);
  });
}

function paintDeskObject(ctx: CanvasRenderingContext2D, q: PodQuad, o: PaintOpts, c: Pal) {
  if (o.style === 'dots') {
    // Desk objects as dot fields — visible texture on the bench.
    const pts = q.corners.map((corner) => podProject(corner[0], corner[1], corner[2], o.W, o.H));
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    const y0 = Math.min(...ys), y1 = Math.max(...ys);

    const spacing = 6 * o.dpr;
    // Parse paper color from palette for theme consistency
    const [pr, pg, pb] = c.paper.match(/[\da-f]{2}/gi)!.map(h => parseInt(h, 16));
    const fills: Record<string, { r: number; g: number; b: number; alpha: number }> = {
      keyboard: { r: pr, g: pg, b: pb, alpha: 0.22 },
      mouse: { r: pr, g: pg, b: pb, alpha: 0.24 },
      coffee: { r: pr, g: pg, b: pb, alpha: 0.30 },
      papers: { r: pr, g: pg, b: pb, alpha: 0.42 },
      cow: { r: pr, g: pg, b: pb, alpha: 0.36 },
    };
    const fill = fills[q.id] ?? { r: pr, g: pg, b: pb, alpha: 0.22 };

    for (let y = Math.max(0, y0); y < Math.min(o.H, y1); y += spacing) {
      for (let x = Math.max(0, x0); x < Math.min(o.W, x1); x += spacing) {
        const jx = ((Math.sin(x * 0.7 + y * 1.1) * 0.5 + 0.5) - 0.5) * spacing * 0.4;
        const jy = ((Math.sin(x * 1.3 + y * 0.9) * 0.5 + 0.5) - 0.5) * spacing * 0.4;
        const alpha = fill.alpha * (0.7 + dotJitter(x, y) * 0.3);
        const radius = 1.0 * o.dpr;

        ctx.beginPath();
        ctx.arc(x + jx, y + jy, radius, 0, 2 * Math.PI);
        ctx.fillStyle = `rgba(${fill.r},${fill.g},${fill.b},${alpha.toFixed(3)})`;
        ctx.fill();
      }
    }

    if (q.id === 'papers') {
      // fanned edges: a body of work, not a heap
      const [ox, oy] = podProject(q.corners[0][0], q.corners[0][1], q.corners[0][2], o.W, o.H);
      ctx.strokeStyle = 'rgba(239,233,221,0.34)';
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(ox + i * 2.5, oy - i * 1.6);
        ctx.lineTo(ox + i * 2.5 + 26, oy - i * 1.6 - 5);
        ctx.stroke();
      }
    }
  } else {
    path(ctx, q, o);
    // Desk objects are lit ONLY by screen spill — they are texture, never focal.
    const fills: Record<string, string> = {
      keyboard: 'rgba(239,233,221,0.13)',
      mouse: 'rgba(239,233,221,0.15)',
      coffee: 'rgba(239,233,221,0.20)',
      papers: 'rgba(239,233,221,0.30)',
      cow: 'rgba(239,233,221,0.26)',
    };
    ctx.fillStyle = fills[q.id] ?? 'rgba(239,233,221,0.15)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(239,233,221,0.22)';
    ctx.lineWidth = 0.6;
    ctx.stroke();

    if (q.id === 'papers') {
      // fanned edges: a body of work, not a heap
      const [ox, oy] = podProject(q.corners[0][0], q.corners[0][1], q.corners[0][2], o.W, o.H);
      ctx.strokeStyle = 'rgba(239,233,221,0.34)';
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(ox + i * 2.5, oy - i * 1.6);
        ctx.lineTo(ox + i * 2.5 + 26, oy - i * 1.6 - 5);
        ctx.stroke();
      }
    }
  }
}
