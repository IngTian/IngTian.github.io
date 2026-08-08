// src/lib/podRoomRetro.ts
// The pod room in a RETROFUTURIST style — the future as imagined in 1965. A second,
// independent painter over the SAME layout and camera as the pixel-art one
// (podRoomPaint.ts); podRoom.ts stays the single source of geometry, so the DOM overlay's
// click targets are identical in both styles.
//
// WHY THIS IS A SEPARATE FILE AND NOT A FLAG: the two styles have OPPOSITE rendering
// rules. Pixel art needs integer rects, hard edges and imageSmoothingEnabled = false.
// Retrofuturism needs the reverse — curved CRT glass, chrome gradients, phosphor bloom,
// rounded bevels and real engraved type. Threading both through one painter would mean a
// conditional at every draw call.
//
// THE STYLE'S VOCABULARY, and what each element is doing:
//   - CRTs, not panels: thick cream-plastic bezels, glass curved by a barrel warp,
//     scanlines, a phosphor bloom, and a specular arc across the top-left of the glass.
//   - One CONTINUOUS console housing that the CRTs are recessed into, so the gaps between
//     screens read as thick bezel material the way a real console does.
//   - Analog instruments: needle gauges, a VU meter, seven-segment readouts, toggle banks
//     with indicator lamps. An era that showed you its state with needles and lamps.
//   - ENGRAVED TYPE. Retro consoles are covered in labels, so this style uses real text
//     (the site's JetBrains Mono) cut into the plastic — dark shadow offset one pixel
//     under a light face. The pixel style deliberately has no glyphs at all.
//   - A mainframe cabinet with reel-to-reel tape drives, and fanfold tractor-feed paper.
//   - Amber phosphor in light theme, green in dark — both authentic CRT colours, and both
//     already the site's accent tokens (ochre / emerald).

import {
  ROOM_W, ROOM_H, ROOM_CX, CEIL_BOTTOM, WALL_BOTTOM, DESK_FRONT, APRON_BOTTOM,
  FLOOR_BOTTOM, MONITORS, WINDOW, CLOCKS, RACK,
  monitorQuad, screenQuad, quadBounds,
  type MonitorPlace, type Quad,
} from './podRoom';
import { ideLines, backtestCurve, bloombergRows, type GanttBar } from './podScreens';

type Ctx = CanvasRenderingContext2D;

// ── Palette ─────────────────────────────────────────────────────────────────
// Derived from the site's tokens. The room stays a night room in both themes (this
// site's --bg never flips bright); the theme sets the phosphor colour and the plastic's
// temperature, not the time of day.

export interface RetroPal {
  void: string;
  wall: string; wallLit: string;
  /** Console plastic: three tones for the bevel to work with. */
  plastic: string; plasticLit: string; plasticDark: string;
  chrome: string; chromeHi: string; chromeLo: string;
  glass: string;          // CRT glass when dark
  phosphor: string;       // the screen colour
  phosphorDim: string;
  amber: string;          // warm indicator lamps
  teal: string;           // cool secondary instrument colour
  seal: string;           // warning lamps, the brand mark
  paper: string;
  ink: string;            // engraved label face
  inkShadow: string;      // engraved label shadow
  city: string; cityLit: string;
}

export function retroPalette(theme: 'light' | 'dark'): RetroPal {
  return theme === 'dark'
    ? {
        void: '#05070b',
        wall: '#121821', wallLit: '#1c2530',
        plastic: '#33393b', plasticLit: '#4d5457', plasticDark: '#1e2325',
        chrome: '#7d868c', chromeHi: '#b9c2c6', chromeLo: '#3a4145',
        glass: '#070d10',
        phosphor: '#66c28c', phosphorDim: '#2f6b4c',
        amber: '#d8a05a', teal: '#5fb2c9', seal: '#e0574a',
        paper: '#dce1dc', ink: '#c3ccd0', inkShadow: '#14181a',
        city: '#1b2536', cityLit: '#c9524a',
      }
    : {
        void: '#0a0806',
        wall: '#1c1712', wallLit: '#2a231a',
        plastic: '#4a4238', plasticLit: '#6b6154', plasticDark: '#2b251e',
        chrome: '#8b8478', chromeHi: '#c8c0b0', chromeLo: '#443e35',
        glass: '#0c0a07',
        phosphor: '#c8a36a', phosphorDim: '#6d5836',
        amber: '#d98a5c', teal: '#6d7689', seal: '#b23a2e',
        paper: '#efe9dd', ink: '#ded5c4', inkShadow: '#17130e',
        city: '#241a10', cityLit: '#b23a2e',
      };
}

// ── Primitives ──────────────────────────────────────────────────────────────

const MONO = (size: number, weight = '400') =>
  `${weight} ${size}px "JetBrains Mono", ui-monospace, SFMono-Regular, monospace`;

/** Deterministic pseudo-random. No Math.random(): the room repaints on hover and theme
 *  change, and fresh randomness per repaint would make every lamp and reel flicker. */
function hash(i: number): number {
  const h = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return h - Math.floor(h);
}

function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

/** A moulded plastic panel: a rounded body, a lit upper-left bevel and a dark
 *  lower-right one. The bevel is what makes the plastic look thick. */
function bevelPanel(
  ctx: Ctx, p: RetroPal, x: number, y: number, w: number, h: number,
  radius = 10, depth = 3, tone: 'plastic' | 'dark' = 'plastic',
) {
  const base = tone === 'dark' ? p.plasticDark : p.plastic;
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, tone === 'dark' ? p.plastic : p.plasticLit);
  g.addColorStop(0.5, base);
  g.addColorStop(1, p.plasticDark);
  rr(ctx, x, y, w, h, radius);
  ctx.fillStyle = g;
  ctx.fill();

  ctx.save();
  rr(ctx, x, y, w, h, radius);
  ctx.clip();
  ctx.lineWidth = depth;
  ctx.strokeStyle = p.plasticLit;
  ctx.beginPath();
  ctx.moveTo(x + 1, y + h); ctx.lineTo(x + 1, y + 1); ctx.lineTo(x + w, y + 1);
  ctx.stroke();
  ctx.strokeStyle = p.plasticDark;
  ctx.beginPath();
  ctx.moveTo(x + w - 1, y); ctx.lineTo(x + w - 1, y + h - 1); ctx.lineTo(x, y + h - 1);
  ctx.stroke();
  ctx.restore();
}

/** Brushed chrome trim: a hard specular band. Reads as metal because of the abrupt
 *  light-to-dark step in the middle, which is how brushed metal actually behaves. */
function chromeBar(ctx: Ctx, p: RetroPal, x: number, y: number, w: number, h: number, radius = 3) {
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, p.chromeLo);
  g.addColorStop(0.28, p.chromeHi);
  g.addColorStop(0.42, p.chrome);
  g.addColorStop(0.52, p.chromeHi);
  g.addColorStop(1, p.chromeLo);
  rr(ctx, x, y, w, h, radius);
  ctx.fillStyle = g;
  ctx.fill();
}

/** Type cut into the plastic: a shadow one pixel down, a light face over it. */
function engrave(
  ctx: Ctx, p: RetroPal, text: string, x: number, y: number,
  size = 11, align: CanvasTextAlign = 'left', tracking = 1.6,
) {
  ctx.save();
  ctx.font = MONO(size, '500');
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  // Canvas has no letter-spacing everywhere, so space the glyphs by hand — retro panel
  // labels are always widely tracked, and it is a big part of the read.
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width + tracking);
  const total = widths.reduce((s, w) => s + w, 0) - tracking;
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  ctx.textAlign = 'left';
  for (let i = 0; i < chars.length; i++) {
    ctx.fillStyle = p.inkShadow;
    ctx.fillText(chars[i], cx, y + 1.2);
    ctx.fillStyle = p.ink;
    ctx.fillText(chars[i], cx, y);
    cx += widths[i];
  }
  ctx.restore();
}

/** An indicator lamp: a chrome ring, a coloured dome, and a bloom when lit. */
function lamp(ctx: Ctx, p: RetroPal, cx: number, cy: number, r: number, colour: string, lit: boolean) {
  ctx.beginPath();
  ctx.arc(cx, cy, r + 1.6, 0, Math.PI * 2);
  ctx.fillStyle = p.chromeLo;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  if (lit) {
    const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r);
    g.addColorStop(0, p.paper);
    g.addColorStop(0.35, colour);
    g.addColorStop(1, colour);
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = p.plasticDark;
  }
  ctx.fill();
  if (lit) {
    ctx.save();
    ctx.globalAlpha = 0.32;
    const g2 = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 4);
    g2.addColorStop(0, colour);
    g2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g2;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/** A round needle gauge: chrome bezel, dark face, an arc of ticks, a needle, a label. */
function gauge(
  ctx: Ctx, p: RetroPal, cx: number, cy: number, r: number,
  value: number, label: string, accent: string,
) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  const bez = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  bez.addColorStop(0, p.chromeHi);
  bez.addColorStop(0.5, p.chrome);
  bez.addColorStop(1, p.chromeLo);
  ctx.fillStyle = bez;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, r - 3.5, 0, Math.PI * 2);
  ctx.fillStyle = p.plasticDark;
  ctx.fill();

  // Scale: 240 degrees of ticks, every fifth one long, and a red zone at the top end.
  const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const a = a0 + (a1 - a0) * t;
    const long = i % 5 === 0;
    const ri = r - 6, ro = r - (long ? 12 : 9);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * ri, cy + Math.sin(a) * ri);
    ctx.lineTo(cx + Math.cos(a) * ro, cy + Math.sin(a) * ro);
    ctx.lineWidth = long ? 1.8 : 1;
    ctx.strokeStyle = t > 0.82 ? p.seal : p.ink;
    ctx.stroke();
  }
  // Needle.
  const na = a0 + (a1 - a0) * Math.max(0, Math.min(1, value));
  ctx.beginPath();
  ctx.moveTo(cx - Math.cos(na) * (r * 0.16), cy - Math.sin(na) * (r * 0.16));
  ctx.lineTo(cx + Math.cos(na) * (r - 11), cy + Math.sin(na) * (r - 11));
  ctx.lineWidth = 2;
  ctx.strokeStyle = accent;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.13, 0, Math.PI * 2);
  ctx.fillStyle = p.chromeHi;
  ctx.fill();

  if (label) engrave(ctx, p, label, cx, cy + r + 9, 8, 'center', 1.2);
}

/** A VU meter: a rectangular window with an arc scale, a needle and a red zone. */
function vuMeter(ctx: Ctx, p: RetroPal, x: number, y: number, w: number, h: number, value: number, label: string) {
  bevelPanel(ctx, p, x, y, w, h, 5, 2, 'dark');
  const ix = x + 4, iy = y + 4, iw = w - 8, ih = h - 8;
  ctx.save();
  rr(ctx, ix, iy, iw, ih, 3);
  ctx.clip();
  const g = ctx.createLinearGradient(ix, iy, ix, iy + ih);
  g.addColorStop(0, p.paper);
  g.addColorStop(1, p.chrome);
  ctx.fillStyle = g;
  ctx.fillRect(ix, iy, iw, ih);

  const pcx = ix + iw / 2, pcy = iy + ih * 1.5, pr = ih * 1.25;
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const a = -Math.PI * 0.72 + Math.PI * 0.44 * (t * 2);
    ctx.beginPath();
    ctx.moveTo(pcx + Math.sin(a) * pr, pcy - Math.cos(a) * pr);
    ctx.lineTo(pcx + Math.sin(a) * (pr - (i % 3 === 0 ? 8 : 5)), pcy - Math.cos(a) * (pr - (i % 3 === 0 ? 8 : 5)));
    ctx.lineWidth = i % 3 === 0 ? 1.6 : 0.9;
    ctx.strokeStyle = t > 0.75 ? p.seal : p.inkShadow;
    ctx.stroke();
  }
  const na = -Math.PI * 0.72 + Math.PI * 0.88 * Math.max(0, Math.min(1, value));
  ctx.beginPath();
  ctx.moveTo(pcx, pcy);
  ctx.lineTo(pcx + Math.sin(na) * (pr - 4), pcy - Math.cos(na) * (pr - 4));
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = p.inkShadow;
  ctx.stroke();
  ctx.restore();
  if (label) engrave(ctx, p, label, x + w / 2, y + h + 8, 7, 'center', 1);
}

const SEG: Record<string, number[]> = {
  // a b c d e f g
  '0': [1, 1, 1, 1, 1, 1, 0], '1': [0, 1, 1, 0, 0, 0, 0], '2': [1, 1, 0, 1, 1, 0, 1],
  '3': [1, 1, 1, 1, 0, 0, 1], '4': [0, 1, 1, 0, 0, 1, 1], '5': [1, 0, 1, 1, 0, 1, 1],
  '6': [1, 0, 1, 1, 1, 1, 1], '7': [1, 1, 1, 0, 0, 0, 0], '8': [1, 1, 1, 1, 1, 1, 1],
  '9': [1, 1, 1, 1, 0, 1, 1], '-': [0, 0, 0, 0, 0, 0, 1], ' ': [0, 0, 0, 0, 0, 0, 0],
};

/** A seven-segment readout. Unlit segments stay faintly visible, the way a real one does
 *  — that ghosting is most of what makes it read as a seven-segment and not as text. */
function sevenSeg(ctx: Ctx, p: RetroPal, text: string, x: number, y: number, dh: number, colour: string) {
  const dw = dh * 0.56, gap = dh * 0.22, t = Math.max(1.6, dh * 0.13);
  let cx = x;
  for (const ch of text) {
    const s = SEG[ch] ?? SEG[' '];
    const bars: [number, number, number, number][] = [
      [cx + t, y, dw - t * 2, t],                       // a
      [cx + dw - t, y + t, t, dh / 2 - t],              // b
      [cx + dw - t, y + dh / 2, t, dh / 2 - t],         // c
      [cx + t, y + dh - t, dw - t * 2, t],              // d
      [cx, y + dh / 2, t, dh / 2 - t],                  // e
      [cx, y + t, t, dh / 2 - t],                       // f
      [cx + t, y + dh / 2 - t / 2, dw - t * 2, t],      // g
    ];
    bars.forEach((b, i) => {
      ctx.fillStyle = s[i] ? colour : p.plasticDark;
      ctx.globalAlpha = s[i] ? 1 : 0.55;
      ctx.fillRect(b[0], b[1], b[2], b[3]);
    });
    ctx.globalAlpha = 1;
    cx += dw + gap;
  }
}

/** A bank of toggle switches with lamps above them. */
function toggleBank(ctx: Ctx, p: RetroPal, x: number, y: number, count: number, seed: number, p2: RetroPal) {
  const pitch = 26;
  for (let i = 0; i < count; i++) {
    const sx = x + i * pitch;
    const on = hash(seed + i * 3.7) > 0.45;
    lamp(ctx, p, sx + 6, y, 3.2, on ? p2.amber : p2.teal, on);
    // the switch body, and a lever thrown up or down
    bevelPanel(ctx, p, sx, y + 8, 12, 20, 3, 1.5, 'dark');
    chromeBar(ctx, p, sx + 3.5, on ? y + 10 : y + 18, 5, 8, 2);
  }
}

// ── CRT ─────────────────────────────────────────────────────────────────────

/** Warp a flat screen render onto a convex CRT face.
 *
 *  Row by row: rows near the vertical centre are widest and rows toward the top and
 *  bottom pull in, which is what a barrel-distorted picture tube does. Cheap, and it is
 *  the single strongest CRT cue after the bezel. */
function barrelWarp(src: HTMLCanvasElement, curve = 0.05): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = src.width; out.height = src.height;
  const c = out.getContext('2d');
  if (!c) return src;
  const { width: w, height: h } = src;
  for (let y = 0; y < h; y++) {
    const t = (y / (h - 1)) * 2 - 1;              // -1 .. 1
    const k = 1 - curve * t * t;
    const dw = w * k;
    const dx = (w - dw) / 2;
    // The row also rises slightly toward the middle, so horizontal lines bow.
    const dy = y - curve * 6 * (1 - t * t);
    c.drawImage(src, 0, y, w, 1, dx, dy, dw, 1.35);
  }
  return out;
}

/** Blit a rectangular source into a (tilted) quad, column by column. Same technique as
 *  the pixel painter's, but with smoothing left ON — this style wants the interpolation. */
function blitQuad(ctx: Ctx, src: HTMLCanvasElement, q: Quad) {
  const [tl, tr, br, bl] = q;
  const xL = Math.round(Math.min(tl[0], bl[0])), xR = Math.round(Math.max(tr[0], br[0]));
  const span = Math.max(1, xR - xL);
  for (let x = xL; x < xR; x++) {
    const t = (x - xL) / span;
    const yTop = Math.round(tl[1] + (tr[1] - tl[1]) * t);
    const yBot = Math.round(bl[1] + (br[1] - bl[1]) * t);
    if (yBot <= yTop) continue;
    const sx = Math.min(src.width - 1, Math.floor(t * src.width));
    ctx.drawImage(src, sx, 0, 1, src.height, x, yTop, 1, yBot - yTop);
  }
}

/** A quad path, for clipping the glass. */
function quadPath(ctx: Ctx, q: Quad) {
  ctx.beginPath();
  ctx.moveTo(q[0][0], q[0][1]);
  for (let i = 1; i < 4; i++) ctx.lineTo(q[i][0], q[i][1]);
  ctx.closePath();
}

// ── Screen content, in phosphor ─────────────────────────────────────────────
// Cached per (slot, size, theme, hover) — a repaint only redraws what changed, which
// matters because this style's bloom pass is expensive.

const cache = new Map<string, HTMLCanvasElement>();

function renderCrt(
  p: RetroPal, m: MonitorPlace, w: number, h: number, o: RetroOpts,
): HTMLCanvasElement | null {
  const id = m.slot !== null ? `s${m.slot}` : `a${m.ambient}`;
  const key = `${id}|${w}x${h}|${o.theme}|${o.hoverSlot === m.slot ? 1 : 0}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const flat = document.createElement('canvas');
  flat.width = w; flat.height = h;
  const c = flat.getContext('2d');
  if (!c) return null;

  c.fillStyle = p.glass;
  c.fillRect(0, 0, w, h);
  c.save();
  if (m.slot === null) drawAmbient(c, p, m.ambient!, w, h);
  else drawDestination(c, p, m.slot, w, h, o.gantt);
  c.restore();

  // Phosphor bloom: a blurred copy of the content composited back over itself. BAKED
  // once into the cache, never animated — the project bans animating filter: blur.
  const glow = document.createElement('canvas');
  glow.width = w; glow.height = h;
  const gc = glow.getContext('2d');
  if (gc) {
    gc.filter = 'blur(4px)';
    gc.drawImage(flat, 0, 0);
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = 0.5;
    c.drawImage(glow, 0, 0);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  }

  // Scanlines, then the tube's own vignette.
  c.fillStyle = 'rgba(0,0,0,0.22)';
  for (let y = 0; y < h; y += 3) c.fillRect(0, y, w, 1.4);
  const vg = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.68);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.5)');
  c.fillStyle = vg;
  c.fillRect(0, 0, w, h);

  const warped = barrelWarp(flat, 0.055);
  if (cache.size > 48) cache.clear();
  cache.set(key, warped);
  return warped;
}

/** Text that fits, or nothing. Never a mid-word truncation — an earlier iteration of this
 *  scene shipped "from risk i" on screen because it measured nothing. */
function fitText(c: Ctx, text: string, maxW: number): string {
  if (c.measureText(text).width <= maxW) return text;
  let out = text;
  while (out.length > 1 && c.measureText(out + '…').width > maxW) out = out.slice(0, -1);
  return out.trimEnd() + '…';
}

function drawAmbient(c: Ctx, p: RetroPal, kind: 'heat' | 'tape', w: number, h: number) {
  c.font = MONO(9);
  c.textBaseline = 'top';
  if (kind === 'heat') {
    // A correlation matrix, drawn as a grid of luminance cells with a unit diagonal.
    c.fillStyle = p.phosphor;
    c.fillText(fitText(c, 'CORR', w - 12), 6, 5);
    const n = 14, pad = 6, top = 20;
    const cw = (w - pad * 2) / n, ch = (h - top - pad) / n;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const v = i === j ? 1 : hash(Math.min(i, j) * 31.7 + Math.max(i, j) * 11.3);
        c.globalAlpha = 0.16 + v * 0.8;
        c.fillStyle = v > 0.62 ? p.phosphor : p.phosphorDim;
        c.fillRect(pad + j * cw, top + i * ch, cw - 1.2, ch - 1.2);
      }
    }
    c.globalAlpha = 1;
  } else {
    // A ticker tape: rows of quotes scrolling off the right edge.
    c.fillStyle = p.phosphor;
    c.fillText('TAPE', 6, 5);
    const rows = Math.floor((h - 22) / 13);
    for (let r = 0; r < rows; r++) {
      const y = 20 + r * 13;
      const sym = ['ES', 'NQ', 'CL', 'GC', 'ZN', 'DX', '6E', 'VX'][r % 8];
      const up = hash(r * 9.7) > 0.5;
      c.fillStyle = p.phosphorDim;
      c.fillText(sym, 6, y);
      c.fillStyle = up ? p.phosphor : p.seal;
      c.fillText(up ? '▲' : '▼', 30, y);
      c.fillStyle = p.phosphor;
      c.globalAlpha = 0.85;
      c.fillText(fitText(c, (100 + hash(r * 3.1) * 900).toFixed(1), w - 52), 44, y);
      c.globalAlpha = 1;
    }
  }
}

function drawDestination(c: Ctx, p: RetroPal, slot: number, w: number, h: number, gantt: GanttBar[]) {
  c.textBaseline = 'top';
  if (slot === 0) {
    // A terminal editor. Real text: at this size ~50 monospace columns fit, which is
    // enough for the honest snippet, and a retro CRT showing actual code is the point.
    c.font = MONO(10);
    const lh = 13, pad = 8;
    const lines = ideLines();
    c.fillStyle = p.phosphorDim;
    c.fillText('ALLOC.PY', pad, 4);
    lines.forEach((ln, i) => {
      const y = 20 + i * lh;
      if (y + lh > h - 4) return;
      c.fillStyle = p.phosphorDim;
      c.fillText(String(i + 1).padStart(2, ' '), pad, y);
      let x = pad + 24 + ln.indent * 12;
      for (const t of ln.tokens) {
        const tw = c.measureText(t.text).width;
        if (x + tw > w - 6) break;
        c.fillStyle = t.kind === 'comment' ? p.phosphorDim
          : t.kind === 'str' ? p.amber
          : t.kind === 'kw' ? p.phosphor
          : p.phosphor;
        c.globalAlpha = t.kind === 'comment' ? 0.75 : 1;
        c.fillText(t.text, x, y);
        c.globalAlpha = 1;
        x += tw;
      }
    });
    // A blinking-block cursor, drawn steady (nothing animates in this scene).
    c.fillStyle = p.phosphor;
    c.fillRect(pad + 24, 20 + lines.length * lh, 6, 10);
  } else if (slot === 1) {
    // An equity curve as vector line art, with axes and a drawdown strip.
    const padL = 34, padR = 10, padT = 22, ddH = Math.round(h * 0.2), gap = 8;
    const pw = w - padL - padR, ph = h - padT - ddH - gap - 14;
    c.font = MONO(9);
    c.fillStyle = p.phosphorDim;
    c.fillText('EQUITY', 8, 4);

    c.strokeStyle = p.phosphorDim;
    c.lineWidth = 0.6;
    c.globalAlpha = 0.6;
    for (let i = 0; i <= 4; i++) {
      const y = padT + (ph / 4) * i;
      c.beginPath(); c.moveTo(padL, y); c.lineTo(padL + pw, y); c.stroke();
      c.fillStyle = p.phosphorDim;
      c.fillText(String(100 - i * 25), 6, y - 4);
    }
    c.globalAlpha = 1;

    const pts = backtestCurve(Math.max(16, Math.round(pw / 2)));
    c.strokeStyle = p.phosphor;
    c.lineWidth = 1.6;
    c.beginPath();
    pts.forEach((pt, i) => {
      const x = padL + (i / (pts.length - 1)) * pw;
      const y = padT + (1 - pt.y) * ph;
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    });
    c.stroke();

    // Drawdown, below.
    const ddY = padT + ph + gap;
    c.strokeStyle = p.phosphorDim;
    c.globalAlpha = 0.7;
    c.beginPath(); c.moveTo(padL, ddY); c.lineTo(padL + pw, ddY); c.stroke();
    c.globalAlpha = 1;
    let peak = 0;
    c.fillStyle = p.seal;
    pts.forEach((pt, i) => {
      peak = Math.max(peak, pt.y);
      const dd = peak > 0 ? (peak - pt.y) / peak : 0;
      const bh = Math.min(ddH, dd * ddH * 2.6);
      c.fillRect(padL + (i / (pts.length - 1)) * pw, ddY, Math.max(1, pw / pts.length), bh);
    });
  } else if (slot === 2) {
    // A career Gantt, with a year axis and a 'now' rule.
    const bars = gantt.slice(0, 6);
    if (!bars.length) return;
    const lo = Math.min(...bars.map((b) => b.start));
    const hi = Math.max(...bars.map((b) => b.end));
    const span = Math.max(1, hi - lo);
    c.font = MONO(9);
    c.fillStyle = p.phosphorDim;
    c.fillText('TIMELINE', 8, 4);
    const labelW = Math.min(78, w * 0.3), padT = 22, padB = 16;
    const pw = w - labelW - 12;
    const rowH = (h - padT - padB) / bars.length;
    c.globalAlpha = 0.5;
    c.strokeStyle = p.phosphorDim;
    c.lineWidth = 0.6;
    for (let yr = 0; yr <= span; yr++) {
      const x = labelW + (yr / span) * pw;
      c.beginPath(); c.moveTo(x, padT); c.lineTo(x, h - padB); c.stroke();
    }
    c.globalAlpha = 1;
    bars.forEach((b, i) => {
      const y = padT + i * rowH;
      c.fillStyle = p.phosphorDim;
      c.fillText(fitText(c, b.label, labelW - 8), 6, y + rowH / 2 - 5);
      const x0 = labelW + ((b.start - lo) / span) * pw;
      const x1 = labelW + ((b.end - lo) / span) * pw;
      const bh = Math.max(5, rowH * 0.44);
      c.fillStyle = b.kind === 'education' ? p.teal : p.phosphor;
      c.globalAlpha = 0.9;
      c.fillRect(x0, y + (rowH - bh) / 2, Math.max(3, x1 - x0), bh);
      c.globalAlpha = 1;
    });
    const nowX = labelW + ((2026 - lo) / span) * pw;
    c.strokeStyle = p.seal;
    c.setLineDash([3, 3]);
    c.beginPath(); c.moveTo(nowX, padT); c.lineTo(nowX, h - padB); c.stroke();
    c.setLineDash([]);
  } else if (slot === 3) {
    // A typeset page, on a light phosphor — a paper being written.
    c.font = MONO(9);
    c.fillStyle = p.phosphorDim;
    c.fillText('DRAFT', 8, 4);
    const pad = 14;
    c.fillStyle = p.phosphor;
    c.globalAlpha = 0.9;
    c.font = MONO(11, '600');
    c.fillText(fitText(c, 'RISK PARITY, REVISITED', w - pad * 2), pad, 20);
    c.globalAlpha = 1;
    c.font = MONO(9);
    const rows = Math.floor((h - 48) / 11);
    for (let i = 0; i < rows; i++) {
      const y = 38 + i * 11;
      if (i === 3) {
        c.fillStyle = p.amber;
        c.fillText(fitText(c, '  w* = argmin  wᵀΣw − λ 1ᵀlog w', w - pad * 2), pad, y);
        continue;
      }
      c.fillStyle = p.phosphorDim;
      const len = Math.round((w - pad * 2) * (i % 5 === 4 ? 0.6 : 0.96));
      c.globalAlpha = 0.5;
      c.fillRect(pad, y + 3, len, 1.4);
      c.globalAlpha = 1;
    }
  } else {
    // A market monitor: real tickers, values and changes.
    const rows = bloombergRows();
    c.font = MONO(9);
    c.fillStyle = p.glass;
    c.fillRect(0, 0, w, 15);
    c.fillStyle = p.amber;
    c.fillRect(0, 0, w, 15);
    c.fillStyle = p.glass;
    c.font = MONO(9, '600');
    c.fillText('MKT MONITOR', 6, 4);
    c.font = MONO(9);
    const rowH = Math.min(15, (h - 22) / Math.max(1, rows.length));
    const colL = w * 0.34, colC = w * 0.64;
    rows.forEach((r, i) => {
      const y = 19 + i * rowH;
      if (y + rowH > h - 2) return;
      c.fillStyle = p.phosphor;
      c.fillText(fitText(c, r.ticker, colL - 8), 6, y);
      c.fillStyle = p.paper;
      c.globalAlpha = 0.85;
      c.fillText(fitText(c, r.last, colC - colL - 6), colL, y);
      c.globalAlpha = 1;
      c.fillStyle = r.up ? p.phosphor : p.seal;
      c.fillText(fitText(c, r.chg, w - colC - 6), colC, y);
    });
  }
}

// ── The room ────────────────────────────────────────────────────────────────

export interface RetroOpts {
  theme: 'light' | 'dark';
  hoverSlot: number | null;
  gantt: GanttBar[];
}

/** The console housing: one continuous mass wrapping the whole monitor rig, derived from
 *  the monitors so it can never drift out of register with them. */
function housingBounds() {
  const x0 = Math.min(...MONITORS.map((m) => quadBounds(monitorQuad(m)).x));
  const x1 = Math.max(...MONITORS.map((m) => { const b = quadBounds(monitorQuad(m)); return b.x + b.w; }));
  const y0 = Math.min(...MONITORS.map((m) => quadBounds(monitorQuad(m)).y));
  return { x: x0 - 34, y: y0 - 30, w: x1 - x0 + 68, h: WALL_BOTTOM - (y0 - 30) };
}

export function paintRetroRoom(ctx: Ctx, o: RetroOpts): void {
  const p = retroPalette(o.theme);
  ctx.imageSmoothingEnabled = true;
  ctx.textBaseline = 'middle';

  // Room shell.
  ctx.fillStyle = p.wall;
  ctx.fillRect(0, 0, ROOM_W, ROOM_H);
  drawCeiling(ctx, p);
  drawWall(ctx, p);
  drawWindow(ctx, p);
  drawInstrumentColumn(ctx, p);
  drawMainframe(ctx, p);
  drawDesk(ctx, p);
  drawConsole(ctx, p, o);
  drawDeskObjects(ctx, p);
  drawFloor(ctx, p);
  drawChair(ctx, p);
  drawVignette(ctx, p);
}

function drawCeiling(ctx: Ctx, p: RetroPal) {
  const g = ctx.createLinearGradient(0, 0, 0, CEIL_BOTTOM);
  g.addColorStop(0, p.void);
  g.addColorStop(1, p.wall);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, ROOM_W, CEIL_BOTTOM);

  // Domed ceiling fixtures — the era's light was warm and pooled, not linear.
  for (let i = 0; i < 5; i++) {
    const cx = (ROOM_W / 5) * (i + 0.5);
    const cy = 56;
    chromeBar(ctx, p, cx - 8, 0, 16, 26, 4);
    ctx.beginPath();
    ctx.ellipse(cx, cy, 58, 20, 0, Math.PI, 0);
    const dg = ctx.createLinearGradient(cx, cy - 20, cx, cy);
    dg.addColorStop(0, p.chromeHi);
    dg.addColorStop(1, p.chromeLo);
    ctx.fillStyle = dg;
    ctx.fill();
    // the glowing underside, and its pool on the ceiling
    ctx.beginPath();
    ctx.ellipse(cx, cy, 52, 7, 0, 0, Math.PI * 2);
    ctx.fillStyle = p.amber;
    ctx.fill();
    ctx.save();
    ctx.globalAlpha = 0.22;
    const pg = ctx.createRadialGradient(cx, cy, 10, cx, cy, 150);
    pg.addColorStop(0, p.amber);
    pg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = pg;
    ctx.fillRect(cx - 150, cy - 40, 300, 190);
    ctx.restore();
  }
  chromeBar(ctx, p, 0, CEIL_BOTTOM - 10, ROOM_W, 10, 0);
}

function drawWall(ctx: Ctx, p: RetroPal) {
  const g = ctx.createLinearGradient(0, CEIL_BOTTOM, 0, WALL_BOTTOM);
  g.addColorStop(0, p.wall);
  g.addColorStop(0.6, p.wallLit);
  g.addColorStop(1, p.wall);
  ctx.fillStyle = g;
  ctx.fillRect(0, CEIL_BOTTOM, ROOM_W, WALL_BOTTOM - CEIL_BOTTOM);

  // Vertical batten panelling — a mid-century wall treatment, and it gives the flat
  // expanse a rhythm without competing with the console.
  ctx.save();
  ctx.globalAlpha = 0.5;
  for (let x = 0; x < ROOM_W; x += 44) {
    ctx.fillStyle = p.plasticDark;
    ctx.fillRect(x, CEIL_BOTTOM, 2, WALL_BOTTOM - CEIL_BOTTOM);
    ctx.fillStyle = p.plasticLit;
    ctx.fillRect(x + 2, CEIL_BOTTOM, 1, WALL_BOTTOM - CEIL_BOTTOM);
  }
  ctx.restore();
  // Corner falloff.
  const l = ctx.createLinearGradient(0, 0, 220, 0);
  l.addColorStop(0, 'rgba(0,0,0,0.65)');
  l.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = l;
  ctx.fillRect(0, CEIL_BOTTOM, 220, WALL_BOTTOM - CEIL_BOTTOM);
  const r = ctx.createLinearGradient(ROOM_W, 0, ROOM_W - 220, 0);
  r.addColorStop(0, 'rgba(0,0,0,0.65)');
  r.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = r;
  ctx.fillRect(ROOM_W - 220, CEIL_BOTTOM, 220, WALL_BOTTOM - CEIL_BOTTOM);
}

/** The city, through a window with rounded corners and a chunky chrome frame. */
function drawWindow(ctx: Ctx, p: RetroPal) {
  const { x, y, w, h } = WINDOW;
  ctx.save();
  rr(ctx, x, y, w, h, 26);
  ctx.clip();
  const sky = ctx.createLinearGradient(0, y, 0, y + h);
  sky.addColorStop(0, p.void);
  sky.addColorStop(1, p.city);
  ctx.fillStyle = sky;
  ctx.fillRect(x, y, w, h);

  // Skyline, two depths, with lit windows.
  for (const far of [true, false]) {
    let bx = x - 10, i = far ? 0 : 97;
    while (bx < x + w) {
      const bw = far ? 26 + hash(i * 3.1) * 30 : 42 + hash(i * 3.1) * 46;
      const bh = far ? 60 + hash(i * 5.7) * 90 : 100 + hash(i * 5.7) * 150;
      const by = y + h - bh;
      ctx.fillStyle = far ? p.city : p.wall;
      ctx.globalAlpha = far ? 0.75 : 1;
      ctx.fillRect(bx, by, bw, bh);
      ctx.globalAlpha = 1;
      if (!far) {
        ctx.fillStyle = p.chromeLo;
        ctx.fillRect(bx, by, bw, 2);
        for (let wx = bx + 6; wx < bx + bw - 6; wx += 11) {
          const colLit = hash(wx * 2.7 + i) > 0.4;
          for (let wy = by + 10; wy < y + h - 8; wy += 13) {
            if (colLit ? hash(wx * 7.3 + wy) > 0.45 : hash(wx * 7.3 + wy) > 0.88) {
              ctx.fillStyle = hash(wx + wy) > 0.85 ? p.amber : p.cityLit;
              ctx.globalAlpha = 0.9;
              ctx.fillRect(wx, wy, 5, 6);
              ctx.globalAlpha = 1;
            }
          }
        }
      }
      bx += bw + (far ? 7 : 10);
      i++;
    }
  }
  // Haze at street level.
  const haze = ctx.createLinearGradient(0, y + h - 90, 0, y + h);
  haze.addColorStop(0, 'rgba(0,0,0,0)');
  haze.addColorStop(1, p.city);
  ctx.fillStyle = haze;
  ctx.fillRect(x, y + h - 90, w, 90);
  ctx.restore();

  // Frame: chrome mullions in a cross, then a thick outer bezel.
  chromeBar(ctx, p, x + w / 2 - 4, y, 8, h, 2);
  chromeBar(ctx, p, x, y + h * 0.44, w, 8, 2);
  ctx.save();
  rr(ctx, x, y, w, h, 26);
  ctx.lineWidth = 14;
  const fg = ctx.createLinearGradient(x, y, x + w, y + h);
  fg.addColorStop(0, p.chromeHi);
  fg.addColorStop(0.5, p.chrome);
  fg.addColorStop(1, p.chromeLo);
  ctx.strokeStyle = fg;
  ctx.stroke();
  ctx.restore();
  // A sill with a lit lip.
  bevelPanel(ctx, p, x - 10, y + h - 4, w + 20, 22, 8, 3);
  engrave(ctx, p, 'EXTERIOR', x + w / 2, y + h + 8, 9, 'center');
}

/** The left instrument column: three chrome-bezel clocks over a small gauge stack. Uses
 *  the shared CLOCKS box, so both styles put their timepieces in the same place. */
function drawInstrumentColumn(ctx: Ctx, p: RetroPal) {
  const { x, y, w, h, count } = CLOCKS;
  bevelPanel(ctx, p, x - 8, y - 10, w + 16, h + 26, 12, 3);
  const cw = w / count;
  const zones = ['LDN', 'NYC', 'TYO'];
  for (let i = 0; i < count; i++) {
    const cx = x + cw * (i + 0.5);
    const cy = y + h / 2 - 2;
    const r = Math.min(cw, h) * 0.42;
    // bezel + face
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    const bg = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    bg.addColorStop(0, p.chromeHi);
    bg.addColorStop(1, p.chromeLo);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, r - 3, 0, Math.PI * 2);
    ctx.fillStyle = p.plasticDark;
    ctx.fill();
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.sin(a) * (r - 6), cy - Math.cos(a) * (r - 6));
      ctx.lineTo(cx + Math.sin(a) * (r - (k % 3 === 0 ? 11 : 9)), cy - Math.cos(a) * (r - (k % 3 === 0 ? 11 : 9)));
      ctx.lineWidth = k % 3 === 0 ? 1.8 : 0.9;
      ctx.strokeStyle = p.ink;
      ctx.stroke();
    }
    // hands, each face a different zone
    const hr = ((i * 5 + 2) / 12) * Math.PI * 2;
    const mr = ((i * 17 + 8) / 60) * Math.PI * 2;
    for (const [ang, len, wd, col] of [[hr, r * 0.5, 2.6, p.ink], [mr, r * 0.72, 1.6, p.phosphor]] as const) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.sin(ang) * len, cy - Math.cos(ang) * len);
      ctx.lineWidth = wd;
      ctx.strokeStyle = col;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, 2.6, 0, Math.PI * 2);
    ctx.fillStyle = p.chromeHi;
    ctx.fill();
    engrave(ctx, p, zones[i], cx, y + h + 6, 8, 'center', 1.2);
  }
}

/** A mainframe cabinet with reel-to-reel tape drives — peak retrofuturism, and it
 *  balances the window. Cropped by the frame edge on purpose. */
function drawMainframe(ctx: Ctx, p: RetroPal) {
  const { x, y, w, h } = RACK;
  bevelPanel(ctx, p, x - 6, y - 8, w + 40, h + 16, 14, 4);
  // Two tape decks: a glass door with two reels behind it.
  for (let d = 0; d < 2; d++) {
    const dy = y + 14 + d * 150;
    bevelPanel(ctx, p, x + 6, dy, w + 16, 128, 8, 2, 'dark');
    ctx.save();
    rr(ctx, x + 12, dy + 6, w + 4, 116, 6);
    ctx.clip();
    ctx.fillStyle = p.glass;
    ctx.fillRect(x + 12, dy + 6, w + 4, 116);
    for (let rl = 0; rl < 2; rl++) {
      const rcx = x + 42 + rl * 62, rcy = dy + 64, rad = 26;
      ctx.beginPath();
      ctx.arc(rcx, rcy, rad, 0, Math.PI * 2);
      ctx.strokeStyle = p.chrome;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(rcx, rcy, rad - 6, 0, Math.PI * 2);
      ctx.fillStyle = p.plasticDark;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(rcx, rcy, 6, 0, Math.PI * 2);
      ctx.fillStyle = p.chromeHi;
      ctx.fill();
      // three spokes
      for (let s = 0; s < 3; s++) {
        const a = (s / 3) * Math.PI * 2 + d;
        ctx.beginPath();
        ctx.moveTo(rcx + Math.cos(a) * 7, rcy + Math.sin(a) * 7);
        ctx.lineTo(rcx + Math.cos(a) * (rad - 7), rcy + Math.sin(a) * (rad - 7));
        ctx.lineWidth = 3;
        ctx.strokeStyle = p.chromeLo;
        ctx.stroke();
      }
    }
    // the tape path between the reels
    ctx.beginPath();
    ctx.moveTo(x + 42, dy + 38);
    ctx.lineTo(x + 104, dy + 38);
    ctx.strokeStyle = p.plasticDark;
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.restore();
    // a glass reflection
    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = p.paper;
    ctx.beginPath();
    ctx.moveTo(x + 12, dy + 100); ctx.lineTo(x + 70, dy + 6);
    ctx.lineTo(x + 100, dy + 6); ctx.lineTo(x + 42, dy + 100);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    engrave(ctx, p, d === 0 ? 'TAPE A' : 'TAPE B', x + 14, dy + 134, 8);
  }
  // A lamp matrix at the bottom — the cabinet showing you it is thinking.
  const ly = y + 318;
  bevelPanel(ctx, p, x + 6, ly, w + 16, 84, 8, 2, 'dark');
  for (let r = 0; r < 4; r++) {
    for (let cN = 0; cN < 6; cN++) {
      lamp(ctx, p, x + 22 + cN * 19, ly + 16 + r * 18, 4,
        hash(r * 7 + cN * 3.3) > 0.62 ? p.amber : p.teal, hash(r * 7 + cN * 3.3) > 0.5);
    }
  }
}

function drawDesk(ctx: Ctx, p: RetroPal) {
  // Top surface: a warm laminate, lighter toward the front where the light falls.
  const g = ctx.createLinearGradient(0, WALL_BOTTOM, 0, DESK_FRONT);
  g.addColorStop(0, p.plasticDark);
  g.addColorStop(0.45, p.plastic);
  g.addColorStop(1, p.plasticLit);
  ctx.fillStyle = g;
  ctx.fillRect(0, WALL_BOTTOM, ROOM_W, DESK_FRONT - WALL_BOTTOM);
  // A pooled highlight under the console.
  ctx.save();
  ctx.globalAlpha = 0.2;
  const pool = ctx.createRadialGradient(ROOM_CX, WALL_BOTTOM, 40, ROOM_CX, WALL_BOTTOM, 760);
  pool.addColorStop(0, p.phosphor);
  pool.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = pool;
  ctx.fillRect(0, WALL_BOTTOM, ROOM_W, DESK_FRONT - WALL_BOTTOM);
  ctx.restore();
  // Chrome nosing along the front edge, then the apron below it.
  chromeBar(ctx, p, 0, DESK_FRONT - 10, ROOM_W, 20, 0);
  const ag = ctx.createLinearGradient(0, DESK_FRONT + 10, 0, APRON_BOTTOM);
  ag.addColorStop(0, p.plastic);
  ag.addColorStop(1, p.void);
  ctx.fillStyle = ag;
  ctx.fillRect(0, DESK_FRONT + 10, ROOM_W, APRON_BOTTOM - DESK_FRONT - 10);
}

/** The console: one housing, CRTs recessed into it, instruments filling the plastic. */
function drawConsole(ctx: Ctx, p: RetroPal, o: RetroOpts) {
  const H = housingBounds();
  bevelPanel(ctx, p, H.x, H.y, H.w, H.h, 22, 5);
  // A chrome band across the housing's top, and one along its foot.
  chromeBar(ctx, p, H.x + 14, H.y + 10, H.w - 28, 10, 4);
  chromeBar(ctx, p, H.x + 14, WALL_BOTTOM - 22, H.w - 28, 12, 4);

  for (const m of MONITORS) drawCrt(ctx, p, m, o);

  // Instruments in the plastic between the two monitor rows.
  const rowGapY = (() => {
    const sec = MONITORS.filter((x) => x.kind === 'secondary');
    const prim = MONITORS.filter((x) => x.kind === 'primary');
    const secBot = Math.max(...sec.map((x) => { const b = quadBounds(monitorQuad(x)); return b.y + b.h; }));
    const primTop = Math.min(...prim.map((x) => quadBounds(monitorQuad(x)).y));
    return { y: secBot, h: primTop - secBot };
  })();

  if (rowGapY.h > 16) {
    const cy = rowGapY.y + rowGapY.h / 2;
    // A row of seven-segment readouts with engraved captions.
    const caps = ['P/L', 'SHARPE', 'DD', 'GROSS'];
    const vals = ['1428', '2-14', '-062', '8840'];
    for (let i = 0; i < 4; i++) {
      const bx = H.x + 60 + i * 240;
      bevelPanel(ctx, p, bx, cy - 15, 132, 30, 6, 2, 'dark');
      sevenSeg(ctx, p, vals[i], bx + 10, cy - 9, 18, i === 2 ? p.seal : p.phosphor);
      engrave(ctx, p, caps[i], bx + 138, cy, 9);
    }
    // Two lamps at the right end of the band.
    lamp(ctx, p, H.x + H.w - 74, cy - 6, 5, p.phosphor, true);
    lamp(ctx, p, H.x + H.w - 48, cy - 6, 5, p.seal, false);
    engrave(ctx, p, 'LIVE', H.x + H.w - 74, cy + 12, 7, 'center', 1);
    engrave(ctx, p, 'HALT', H.x + H.w - 48, cy + 12, 7, 'center', 1);
  }

  // NO engraved destination captions here. The HTML overlay already renders PROJECTS /
  // RESEARCH / EXPERIENCE / WRITING / MARKET REPORTS as real text over each screen — it
  // has to, so they stay selectable and screen-reader-native. Painting them a second time
  // in the canvas produced a visible double label under every primary monitor.
  // Non-destination engraving (CRT-17, TAPE A, EXTERIOR, gauge captions) is fine and is
  // what carries the retro-console feel.
}

function drawCrt(ctx: Ctx, p: RetroPal, m: MonitorPlace, o: RetroOpts) {
  const outer = monitorQuad(m);
  const glassQ = screenQuad(m);
  const hot = m.slot !== null && o.hoverSlot === m.slot;

  // The CRT well: a recess cut into the housing, so the tube sits INSIDE the console.
  const ob = quadBounds(outer);
  ctx.save();
  rr(ctx, ob.x - 10, ob.y - 10, ob.w + 20, ob.h + 20, 18);
  ctx.fillStyle = p.plasticDark;
  ctx.fill();
  ctx.restore();

  // The tube's own bezel, following the tilted quad so the perspective survives.
  quadPath(ctx, outer);
  const bez = ctx.createLinearGradient(ob.x, ob.y, ob.x, ob.y + ob.h);
  bez.addColorStop(0, p.plasticLit);
  bez.addColorStop(0.6, p.plastic);
  bez.addColorStop(1, p.plasticDark);
  ctx.fillStyle = bez;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = p.plasticDark;
  ctx.stroke();

  // Glass.
  const gb = quadBounds(glassQ);
  const edgeL = Math.abs(glassQ[3][1] - glassQ[0][1]);
  const edgeR = Math.abs(glassQ[2][1] - glassQ[1][1]);
  const src = renderCrt(p, m, Math.max(16, Math.round(gb.w)), Math.max(16, Math.round((edgeL + edgeR) / 2)), o);
  ctx.save();
  quadPath(ctx, glassQ);
  ctx.clip();
  ctx.fillStyle = p.glass;
  ctx.fill();
  if (src) blitQuad(ctx, src, glassQ);
  // Specular arc across the top-left of the tube — the cue that the glass is CURVED.
  ctx.globalAlpha = 0.11;
  const spec = ctx.createLinearGradient(gb.x, gb.y, gb.x + gb.w * 0.7, gb.y + gb.h);
  spec.addColorStop(0, p.paper);
  spec.addColorStop(0.35, 'rgba(255,255,255,0.06)');
  spec.addColorStop(0.6, 'rgba(0,0,0,0)');
  ctx.fillStyle = spec;
  ctx.fillRect(gb.x, gb.y, gb.w, gb.h);
  ctx.globalAlpha = 1;
  ctx.restore();

  // A chrome ring around the glass, catching the phosphor.
  quadPath(ctx, glassQ);
  ctx.lineWidth = 3;
  ctx.strokeStyle = hot ? p.phosphor : p.chromeLo;
  ctx.stroke();

  // Chin furniture: a brand rule, two knobs and a power lamp. HOVER is quiet — the lamp
  // lights and the glass ring picks up the phosphor. No ring, no bloom.
  const chinY = ob.y + ob.h - 9;
  engrave(ctx, p, m.kind === 'primary' ? 'CRT-17' : 'CRT-12', ob.x + 16, chinY, 7, 'left', 1);
  for (let k = 0; k < 2; k++) {
    const kx = ob.x + ob.w - 34 - k * 20;
    ctx.beginPath();
    ctx.arc(kx, chinY, 5, 0, Math.PI * 2);
    const kg = ctx.createLinearGradient(kx - 5, chinY - 5, kx + 5, chinY + 5);
    kg.addColorStop(0, p.chromeHi);
    kg.addColorStop(1, p.chromeLo);
    ctx.fillStyle = kg;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(kx, chinY);
    ctx.lineTo(kx + Math.cos(k + 1.2) * 4, chinY + Math.sin(k + 1.2) * 4);
    ctx.strokeStyle = p.plasticDark;
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
  lamp(ctx, p, ob.x + ob.w - 70, chinY, 4, hot ? p.phosphor : p.amber, true);
}

/** Desk props. These are painter-local, not shared layout: only the SCREEN rects have to
 *  agree between styles (the DOM overlay reads them), and a different art direction
 *  legitimately wants its props in different places and shapes. */
const PROPS = {
  console2: { x: 470, y: 548, w: 300, h: 66 },   // an auxiliary instrument panel
  keyboard: { x: 610, y: 604, w: 470, h: 62 },
  cow: { x: 250, y: 546, w: 108, h: 82 },
  coffee: { x: 392, y: 560, w: 62, h: 74 },
  phone: { x: 150, y: 556, w: 120, h: 76 },
  fanfold: { x: 1130, y: 552, w: 300, h: 96 },
  tower: { x: 60, y: 736, w: 168, h: 144 },
} as const;

function drawDeskObjects(ctx: Ctx, p: RetroPal) {
  // An auxiliary panel: a VU meter, two gauges and a toggle bank.
  const a = PROPS.console2;
  bevelPanel(ctx, p, a.x, a.y, a.w, a.h, 10, 3);
  chromeBar(ctx, p, a.x + 8, a.y + 5, a.w - 16, 5, 2);
  vuMeter(ctx, p, a.x + 14, a.y + 16, 96, 38, 0.72, 'FLOW');
  gauge(ctx, p, a.x + 148, a.y + 33, 24, 0.62, 'VOL', p.phosphor);
  gauge(ctx, p, a.x + 202, a.y + 33, 24, 0.38, 'RISK', p.amber);
  toggleBank(ctx, p, a.x + 236, a.y + 18, 2, 11, p);

  // A chunky keyboard with round keys — the era's keys were cylinders, not chiclets.
  const kb = PROPS.keyboard;
  bevelPanel(ctx, p, kb.x, kb.y, kb.w, kb.h, 10, 4);
  chromeBar(ctx, p, kb.x + 6, kb.y + 4, kb.w - 12, 4, 2);
  for (let r = 0; r < 4; r++) {
    const cols = 17 - (r === 3 ? 4 : 0);
    for (let cN = 0; cN < cols; cN++) {
      const kx = kb.x + 18 + cN * 25 + r * 6;
      const ky = kb.y + 16 + r * 11;
      if (kx + 18 > kb.x + kb.w - 10) continue;
      ctx.beginPath();
      ctx.ellipse(kx + 8, ky + 4, 9, 4.6, 0, 0, Math.PI * 2);
      const kg = ctx.createLinearGradient(kx, ky, kx, ky + 9);
      kg.addColorStop(0, p.plasticLit);
      kg.addColorStop(1, p.plasticDark);
      ctx.fillStyle = kg;
      ctx.fill();
      ctx.strokeStyle = p.plasticDark;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  }
  // spacebar
  bevelPanel(ctx, p, kb.x + 150, kb.y + kb.h - 14, 180, 9, 4, 1.5);

  // Desk phone: a rounded body, a handset on a chrome cradle, a rotary-style dial.
  const ph = PROPS.phone;
  bevelPanel(ctx, p, ph.x, ph.y + 22, ph.w, ph.h - 22, 12, 3);
  ctx.beginPath();
  ctx.arc(ph.x + 34, ph.y + 50, 17, 0, Math.PI * 2);
  ctx.fillStyle = p.plasticDark;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(ph.x + 34, ph.y + 50, 17, 0, Math.PI * 2);
  ctx.strokeStyle = p.chrome;
  ctx.lineWidth = 2;
  ctx.stroke();
  for (let k = 0; k < 10; k++) {
    const a2 = (k / 10) * Math.PI * 2 - 1;
    ctx.beginPath();
    ctx.arc(ph.x + 34 + Math.cos(a2) * 11, ph.y + 50 + Math.sin(a2) * 11, 2.4, 0, Math.PI * 2);
    ctx.fillStyle = p.chromeHi;
    ctx.fill();
  }
  // handset: two chrome cradle posts and a moulded bar across them
  chromeBar(ctx, p, ph.x + 62, ph.y + 30, 8, 18, 3);
  chromeBar(ctx, p, ph.x + 104, ph.y + 30, 8, 18, 3);
  bevelPanel(ctx, p, ph.x + 52, ph.y, 70, 26, 12, 3);
  bevelPanel(ctx, p, ph.x + 44, ph.y + 2, 22, 20, 9, 2);
  bevelPanel(ctx, p, ph.x + 108, ph.y + 2, 22, 20, 9, 2);
  engrave(ctx, p, 'DESK', ph.x + 10, ph.y + 68, 7);

  // Plush cow — soft, round, and out of period on purpose. Every desk has one thing that
  // is only there because its owner likes it. Drawn back to front: legs, body, patches,
  // then the head, so nearer parts occlude further ones and it reads as a solid toy.
  const c = PROPS.cow;
  const blob = (x: number, y: number, w: number, h: number, fill: string, stroke?: string) => {
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) { ctx.lineWidth = 1.4; ctx.strokeStyle = stroke; ctx.stroke(); }
  };
  const shade = p.plasticDark;
  // legs first, behind the body
  for (let i = 0; i < 4; i++) blob(c.x + 12 + i * 24, c.y + c.h - 22, 17, 24, p.paper, shade);
  // body
  blob(c.x + 2, c.y + 22, c.w - 26, c.h - 34, p.paper, shade);
  // Holstein patches, clipped to the body so they cannot spill outside its silhouette.
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(c.x + 2 + (c.w - 26) / 2, c.y + 22 + (c.h - 34) / 2, (c.w - 26) / 2, (c.h - 34) / 2, 0, 0, Math.PI * 2);
  ctx.clip();
  blob(c.x + 8, c.y + 30, 30, 22, shade);
  blob(c.x + 44, c.y + 54, 26, 16, shade);
  ctx.restore();
  // udder-side shadow, so the body has weight where it meets the desk
  ctx.save();
  ctx.globalAlpha = 0.25;
  blob(c.x + 14, c.y + c.h - 30, c.w - 50, 16, shade);
  ctx.restore();
  // ears behind the head
  blob(c.x + c.w - 46, c.y + 2, 16, 12, shade);
  blob(c.x + c.w - 14, c.y + 2, 16, 12, shade);
  // head, then face
  blob(c.x + c.w - 44, c.y, 44, 42, p.paper, shade);
  blob(c.x + c.w - 34, c.y + 22, 30, 17, p.seal, shade);          // muzzle
  ctx.fillStyle = p.void;
  blob(c.x + c.w - 30, c.y + 27, 5, 4, p.void);                   // nostrils
  blob(c.x + c.w - 17, c.y + 27, 5, 4, p.void);
  blob(c.x + c.w - 32, c.y + 11, 8, 9, p.void);                   // eyes
  blob(c.x + c.w - 16, c.y + 11, 8, 9, p.void);
  blob(c.x + c.w - 30, c.y + 12, 3, 3, p.paper);                  // catchlights
  blob(c.x + c.w - 14, c.y + 12, 3, 3, p.paper);

  // Coffee: a tapered mug with a chrome-rimmed lip and a ring handle.
  const k2 = PROPS.coffee;
  ctx.beginPath();
  ctx.moveTo(k2.x + 4, k2.y + 14);
  ctx.lineTo(k2.x + k2.w - 4, k2.y + 14);
  ctx.lineTo(k2.x + k2.w - 11, k2.y + k2.h);
  ctx.lineTo(k2.x + 11, k2.y + k2.h);
  ctx.closePath();
  const mg = ctx.createLinearGradient(k2.x, 0, k2.x + k2.w, 0);
  mg.addColorStop(0, p.plasticDark);
  mg.addColorStop(0.35, p.paper);
  mg.addColorStop(1, p.plastic);
  ctx.fillStyle = mg;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(k2.x + k2.w / 2, k2.y + 14, k2.w / 2 - 4, 7, 0, 0, Math.PI * 2);
  ctx.fillStyle = p.chromeHi;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(k2.x + k2.w / 2, k2.y + 15, k2.w / 2 - 9, 4.6, 0, 0, Math.PI * 2);
  ctx.fillStyle = p.void;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(k2.x + k2.w - 2, k2.y + 40, 12, 15, 0, -1.2, 1.2);
  ctx.lineWidth = 5;
  ctx.strokeStyle = p.paper;
  ctx.stroke();

  // Fanfold printout: continuous-form paper with tractor-feed holes, concertina-folded.
  const ff = PROPS.fanfold;
  const folds = 5, fh = ff.h / folds;
  for (let i = folds - 1; i >= 0; i--) {
    const y = ff.y + i * fh * 0.62;
    const x = ff.x + i * 9;
    const w2 = ff.w - i * 12;
    const g2 = ctx.createLinearGradient(x, y, x, y + fh);
    g2.addColorStop(0, p.paper);
    g2.addColorStop(1, p.chrome);
    ctx.fillStyle = g2;
    ctx.fillRect(x, y, w2, fh);
    ctx.strokeStyle = p.plasticDark;
    ctx.lineWidth = 0.8;
    ctx.strokeRect(x, y, w2, fh);
    // tractor holes down both margins
    ctx.fillStyle = p.plasticDark;
    for (let hx = x + 6; hx < x + w2 - 4; hx += 14) {
      ctx.beginPath(); ctx.arc(hx, y + 4, 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(hx, y + fh - 4, 1.8, 0, Math.PI * 2); ctx.fill();
    }
    if (i === 0) {
      ctx.fillStyle = p.inkShadow;
      ctx.font = MONO(7);
      ctx.textBaseline = 'top';
      for (let r = 0; r < 3; r++) {
        ctx.globalAlpha = 0.75;
        ctx.fillRect(x + 16, y + 10 + r * 5, w2 - 40 - r * 22, 1.4);
        ctx.globalAlpha = 1;
      }
    }
  }
}

function drawFloor(ctx: Ctx, p: RetroPal) {
  const g = ctx.createLinearGradient(0, APRON_BOTTOM, 0, FLOOR_BOTTOM);
  g.addColorStop(0, p.wall);
  g.addColorStop(1, p.void);
  ctx.fillStyle = g;
  ctx.fillRect(0, APRON_BOTTOM, ROOM_W, FLOOR_BOTTOM - APRON_BOTTOM);
  // Terrazzo speckle, and seams converging on the vanishing axis.
  ctx.save();
  ctx.globalAlpha = 0.18;
  for (let i = 0; i < 900; i++) {
    const x = hash(i * 1.7) * ROOM_W;
    const y = APRON_BOTTOM + hash(i * 3.3) * (FLOOR_BOTTOM - APRON_BOTTOM);
    ctx.fillStyle = i % 3 === 0 ? p.chrome : p.plasticLit;
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.restore();
  ctx.strokeStyle = p.void;
  ctx.lineWidth = 1.4;
  for (let i = 0; i <= 8; i++) {
    const xTop = (ROOM_W / 8) * i;
    const xBot = ROOM_CX + (xTop - ROOM_CX) * 1.8;
    ctx.beginPath();
    ctx.moveTo(xTop, APRON_BOTTOM);
    ctx.lineTo(xBot, FLOOR_BOTTOM);
    ctx.stroke();
  }
  // The tower under the desk.
  const t = PROPS.tower;
  bevelPanel(ctx, p, t.x, t.y, t.w, t.h, 12, 4);
  chromeBar(ctx, p, t.x + 10, t.y + 12, t.w - 20, 8, 3);
  for (let r = 0; r < 3; r++) {
    for (let cN = 0; cN < 4; cN++) {
      lamp(ctx, p, t.x + 26 + cN * 30, t.y + 44 + r * 26, 4.4,
        hash(r * 5 + cN) > 0.5 ? p.phosphor : p.amber, hash(r * 5 + cN) > 0.42);
    }
  }
  engrave(ctx, p, 'MOD 7', t.x + 14, t.y + t.h - 14, 8);
}

/** The chair back from behind — the cue that YOU are sitting here. A moulded shell with a
 *  chrome frame: the era's chair, and lighter than the pixel style's near-black mass, so
 *  it reads as a shape instead of a hole. */
function drawChair(ctx: Ctx, p: RetroPal) {
  const cx = ROOM_CX - 20, top = 690, w = 430, h = ROOM_H - top;
  const x = cx - w / 2;

  // Chrome cantilever frame, visible either side of the shell.
  chromeBar(ctx, p, x + 26, top + 60, 14, h - 60, 6);
  chromeBar(ctx, p, x + w - 40, top + 60, 14, h - 60, 6);

  // The moulded shell: a wide, softly waisted back with a rolled top edge.
  ctx.beginPath();
  ctx.moveTo(x + 40, ROOM_H);
  ctx.bezierCurveTo(x + 10, top + 96, x + 34, top + 6, x + w / 2, top + 6);
  ctx.bezierCurveTo(x + w - 34, top + 6, x + w - 10, top + 96, x + w - 40, ROOM_H);
  ctx.closePath();
  const sg = ctx.createLinearGradient(x, top, x + w, ROOM_H);
  sg.addColorStop(0, p.plasticDark);
  sg.addColorStop(0.42, p.plastic);
  sg.addColorStop(1, p.plasticDark);
  ctx.fillStyle = sg;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = p.chromeLo;
  ctx.stroke();

  // A rolled chrome lip along the top, and a horizontal seam.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + 44, top + 26);
  ctx.bezierCurveTo(x + 60, top + 8, x + w - 60, top + 8, x + w - 44, top + 26);
  ctx.lineWidth = 6;
  ctx.strokeStyle = p.chrome;
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.moveTo(x + 58, top + 92);
  ctx.bezierCurveTo(x + w / 2, top + 104, x + w / 2, top + 104, x + w - 58, top + 92);
  ctx.lineWidth = 2;
  ctx.strokeStyle = p.plasticDark;
  ctx.stroke();
  ctx.restore();

  // Armrests, sweeping forward.
  for (const side of [-1, 1] as const) {
    const ax = side < 0 ? x - 6 : x + w - 58;
    ctx.beginPath();
    ctx.moveTo(ax + (side < 0 ? 60 : 4), top + 150);
    ctx.bezierCurveTo(ax + 30, top + 130, ax + 6, top + 150, ax + (side < 0 ? 2 : 58), top + 210);
    ctx.lineWidth = 13;
    ctx.strokeStyle = p.plasticDark;
    ctx.stroke();
    ctx.lineWidth = 5;
    ctx.strokeStyle = p.chromeLo;
    ctx.stroke();
  }
}

function drawVignette(ctx: Ctx, p: RetroPal) {
  // Top and bottom fade into the page; the room has no hard edge to give itself away.
  const t = ctx.createLinearGradient(0, 0, 0, 90);
  t.addColorStop(0, p.void);
  t.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = t;
  ctx.fillRect(0, 0, ROOM_W, 90);
  const b = ctx.createLinearGradient(0, ROOM_H - 150, 0, ROOM_H);
  b.addColorStop(0, 'rgba(0,0,0,0)');
  b.addColorStop(1, p.void);
  ctx.fillStyle = b;
  ctx.fillRect(0, ROOM_H - 150, ROOM_W, 150);
  // Lens falloff at the sides.
  const l = ctx.createLinearGradient(0, 0, 150, 0);
  l.addColorStop(0, 'rgba(0,0,0,0.5)');
  l.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = l;
  ctx.fillRect(0, 0, 150, ROOM_H);
  const r = ctx.createLinearGradient(ROOM_W, 0, ROOM_W - 150, 0);
  r.addColorStop(0, 'rgba(0,0,0,0.5)');
  r.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = r;
  ctx.fillRect(ROOM_W - 150, 0, 150, ROOM_H);
}
