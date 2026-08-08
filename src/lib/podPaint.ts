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
    roomBg: dark ? 'rgb(14,16,20)' : 'rgb(18,17,15)',   // opaque background
    wall: dark ? '#1a1e24' : '#2b2824',
    bench: dark ? '#28313a' : '#3d362e',
    benchLip: dark ? '#3f4a56' : '#5a4f42',
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

/** Snap coordinate to a 3px grid for pixel-art crispness */
const snap = (v: number) => Math.round(v / 3) * 3;

const path = (ctx: CanvasRenderingContext2D, q: PodQuad, o: PaintOpts, snapCoords = false) => {
  ctx.beginPath();
  q.corners.forEach((c, i) => {
    let [x, y] = podProject(c[0], c[1], c[2], o.W, o.H);
    if (snapCoords) { x = snap(x); y = snap(y); }
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

  // Paint the room background FIRST — the pod owns its background now
  ctx.fillStyle = c.roomBg;
  ctx.fillRect(0, 0, o.W, o.H);

  // Pixel-art treatment: disable smoothing for geometry, crisp blocky edges
  ctx.imageSmoothingEnabled = false;

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
  // Solid wall with a subtle dot texture on top (pixel-art treatment)
  path(ctx, q, o, true);  // snap to grid
  ctx.fillStyle = c.wall;
  ctx.fill();

  // Light dot texture on top for surface interest
  const pts = q.corners.map((corner) => podProject(corner[0], corner[1], corner[2], o.W, o.H));
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const y0 = Math.min(...ys), y1 = Math.max(...ys);

  const spacing = 16 * o.dpr;
  const [r, g, b] = c.paper.match(/[\da-f]{2}/gi)!.map(h => parseInt(h, 16));

  for (let y = Math.max(0, y0); y < Math.min(o.H, y1); y += spacing) {
    for (let x = Math.max(0, x0); x < Math.min(o.W, x1); x += spacing) {
      const jx = ((Math.sin(x * 0.7 + y * 1.1) * 0.5 + 0.5) - 0.5) * spacing * 0.3;
      const jy = ((Math.sin(x * 1.3 + y * 0.9) * 0.5 + 0.5) - 0.5) * spacing * 0.3;
      const alpha = 0.08 * (0.7 + dotJitter(x, y) * 0.3);
      const radius = 1.0 * o.dpr;

      ctx.beginPath();
      ctx.arc(x + jx, y + jy, radius, 0, 2 * Math.PI);
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
      ctx.fill();
    }
  }
}

function paintBench(ctx: CanvasRenderingContext2D, q: PodQuad, o: PaintOpts, c: Pal) {
  // Solid bench with screen spill gradient + a lit front lip
  const pts = q.corners.map((k) => podProject(k[0], k[1], k[2], o.W, o.H));
  const snapped = pts.map(p => [snap(p[0]), snap(p[1])] as [number, number]);
  const yTop = Math.min(...snapped.map(p => p[1]));
  const yBot = Math.max(...snapped.map(p => p[1]));

  // Main bench surface with vertical gradient (screen spill)
  ctx.beginPath();
  snapped.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
  });
  ctx.closePath();
  const g = ctx.createLinearGradient(0, yTop, 0, yBot);
  g.addColorStop(0, c.bench);       // brighter at back (screen spill)
  g.addColorStop(0.8, c.bench);
  g.addColorStop(1, c.benchEdge);   // slightly dimmer at front
  ctx.fillStyle = g;
  ctx.fill();

  // Lit front lip: a 3px band along the front edge
  const front0 = snapped[0], front1 = snapped[1];
  const lipDepth = 3;
  ctx.beginPath();
  ctx.moveTo(front0[0], front0[1]);
  ctx.lineTo(front1[0], front1[1]);
  ctx.lineTo(front1[0], front1[1] - lipDepth);
  ctx.lineTo(front0[0], front0[1] - lipDepth);
  ctx.closePath();
  ctx.fillStyle = c.benchLip;
  ctx.fill();

  // Subtle dot texture on top
  const x0 = Math.min(...snapped.map(p => p[0])), x1 = Math.max(...snapped.map(p => p[0]));
  const spacing = 14 * o.dpr;
  const [dr, dg, db] = c.paper.match(/[\da-f]{2}/gi)!.map(h => parseInt(h, 16));

  for (let y = Math.max(0, yTop); y < Math.min(o.H, yBot); y += spacing) {
    for (let x = Math.max(0, x0); x < Math.min(o.W, x1); x += spacing) {
      const jx = ((Math.sin(x * 0.7 + y * 1.1) * 0.5 + 0.5) - 0.5) * spacing * 0.3;
      const jy = ((Math.sin(x * 1.3 + y * 0.9) * 0.5 + 0.5) - 0.5) * spacing * 0.3;
      const spillT = 1 - (y - yTop) / (yBot - yTop);
      const alpha = (0.06 + spillT * 0.04) * (0.7 + dotJitter(x, y) * 0.3);
      const radius = 0.9 * o.dpr;

      ctx.beginPath();
      ctx.arc(x + jx, y + jy, radius, 0, 2 * Math.PI);
      ctx.fillStyle = `rgba(${dr},${dg},${db},${alpha.toFixed(3)})`;
      ctx.fill();
    }
  }
}

function paintMonitor(ctx: CanvasRenderingContext2D, q: PodQuad, o: PaintOpts, c: Pal) {
  const b = screenBox(q, o);
  const bx = snap(b.x), by = snap(b.y);
  const meta = SCREEN_CONTENT.find((s) => s.slot === q.slot)!;
  const hot = o.hoverSlot === q.slot;

  // Pixel-art bezel: hard 3px frame with a lighter top edge, darker bottom
  const bezelW = 3;
  ctx.fillStyle = c.bezel;
  ctx.fillRect(bx - bezelW, by - bezelW, b.w + bezelW * 2, b.h + bezelW * 2);
  // top edge lighter (lit by screens)
  ctx.fillStyle = c.benchLip;
  ctx.fillRect(bx - bezelW, by - bezelW, b.w + bezelW * 2, 2);
  // bottom edge darker (shadow)
  ctx.fillStyle = c.bezel;
  ctx.fillRect(bx - bezelW, by + b.h + bezelW - 2, b.w + bezelW * 2, 2);

  // screen
  ctx.fillStyle = c.screenBg;
  ctx.fillRect(bx, by, b.w, b.h);

  // Re-enable smoothing for screen content (text must stay readable)
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.beginPath();
  ctx.rect(bx, by, b.w, b.h);
  ctx.clip();
  const pad = Math.max(4, b.w * 0.05);
  const inner = { x: bx + pad, y: by + pad, w: b.w - pad * 2, h: b.h - pad * 2 };
  if (meta.kind === 'ide') paintIde(ctx, inner, o, c);
  if (meta.kind === 'backtest') paintBacktest(ctx, inner, o, c);
  if (meta.kind === 'gantt') paintGantt(ctx, inner, o, c);
  if (meta.kind === 'latex') paintLatex(ctx, inner, o, c);
  if (meta.kind === 'bloomberg') paintBloomberg(ctx, inner, o, c);
  ctx.restore();
  ctx.imageSmoothingEnabled = false;  // back to pixel-art for geometry

  // hover/focus: lift the glow
  if (hot) {
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx - 1, by - 1, b.w + 2, b.h + 2);
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
  const fs = Math.max(3.2, r.h / (rows.length + 2.5));
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
    ctx.fillText(row.last, r.x + r.w * 0.32, y);
    ctx.fillStyle = row.up ? c.accent : c.seal;
    const chgX = r.x + r.w * 0.58;
    // Verify the widest row fits inside the screen
    const chgW = ctx.measureText(row.chg).width;
    if (chgX + chgW > r.x + r.w - 2) {
      // shouldn't happen with shortened values, but guard anyway
      ctx.fillText(row.chg.slice(0, -1), chgX, y);
    } else {
      ctx.fillText(row.chg, chgX, y);
    }
  });
}

function paintDeskObject(ctx: CanvasRenderingContext2D, q: PodQuad, o: PaintOpts, c: Pal) {
  // Pixel-art blocks: flat filled silhouettes with a lighter top face
  path(ctx, q, o, true);  // snap to grid
  const fills: Record<string, string> = {
    keyboard: 'rgba(239,233,221,0.16)',
    mouse: 'rgba(239,233,221,0.18)',
    coffee: 'rgba(239,233,221,0.24)',
    papers: 'rgba(239,233,221,0.34)',
    cow: 'rgba(239,233,221,0.30)',
  };
  ctx.fillStyle = fills[q.id] ?? 'rgba(239,233,221,0.18)';
  ctx.fill();

  // Top face lighter (caught light from screens)
  const pts = q.corners.map((k) => podProject(k[0], k[1], k[2], o.W, o.H));
  const snapped = pts.map(p => [snap(p[0]), snap(p[1])] as [number, number]);
  const yTop = Math.min(...snapped.map(p => p[1]));
  ctx.beginPath();
  ctx.moveTo(snapped[0][0], yTop);
  ctx.lineTo(snapped[1][0], yTop);
  ctx.lineTo(snapped[1][0], yTop + 1);
  ctx.lineTo(snapped[0][0], yTop + 1);
  ctx.closePath();
  ctx.fillStyle = 'rgba(239,233,221,0.10)';
  ctx.fill();

  if (q.id === 'papers') {
    // fanned edges: a body of work, not a heap
    const [ox, oy] = snapped[0];
    ctx.strokeStyle = 'rgba(239,233,221,0.38)';
    ctx.lineWidth = 0.8;
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(ox + i * 3, oy - i * 2);
      ctx.lineTo(ox + i * 3 + 24, oy - i * 2 - 4);
      ctx.stroke();
    }
  }
}
