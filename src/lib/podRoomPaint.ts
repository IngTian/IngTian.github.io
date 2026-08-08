// src/lib/podRoomPaint.ts
// Paints the pod room into its buffer. The ONLY file here that touches canvas APIs; the
// layout, camera maths and palette are pure data in podRoom.ts.
//
// WHAT MAKES THIS READ AS A TRADING FLOOR RATHER THAN A DIAGRAM:
//
// 1. NOTHING IS STRAIGHT-ON. Monitors yaw inward toward the viewer and tilt back a few
//    degrees, so each one is a QUAD, not a rectangle. A straight-on rectangle can never
//    look like an object — the tilted shade is the whole 3D read.
// 2. SCREEN CONTENT IS TEXTURE-MAPPED. Content renders into an offscreen buffer at its
//    own resolution, then blits into the tilted quad column by column with per-column
//    vertical scaling. That is perspective, cheaply, and it keeps content authoring
//    rectangular — the alternative (drawing every line pre-skewed) is unmaintainable.
// 3. VOLUME EVERYWHERE. Objects are extruded with a front, a side (dark, turned away) and
//    a top (lit) face, and which side shows depends on which side of the room's vanishing
//    axis the object sits on.
//
// Screens show DENSE, LEGIBLE-AT-A-GLANCE content: a real editor with a minimap, an
// equity curve with tick-marked axes, a Gantt, a paper, a market panel. They do not show
// readable prose — the labels are HTML over the canvas, where they stay selectable.

import {
  ROOM_W, ROOM_H, ROOM_CX, CEIL_TOP_VOID, CEIL_BOTTOM, WALL_BOTTOM, DESK_FRONT,
  APRON_BOTTOM, FLOOR_BOTTOM, MONITORS, CLOCKS, WINDOW, RACK, DESK_OBJECTS, rigFrame,
  monitorQuad, screenQuad, quadBounds, sideDepth, roomPalette,
  type RoomPal, type MonitorPlace, type Quad,
} from './podRoom';
import { ideLines, backtestCurve, bloombergRows, type GanttBar } from './podScreens';

type Ctx = CanvasRenderingContext2D;

// ── Primitives ──────────────────────────────────────────────────────────────

const px = (ctx: Ctx, x: number, y: number, w: number, h: number, c: string) => {
  if (w <= 0 || h <= 0) return;
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};

const outline = (ctx: Ctx, x: number, y: number, w: number, h: number, c: string) => {
  px(ctx, x, y, w, 1, c); px(ctx, x, y + h - 1, w, 1, c);
  px(ctx, x, y, 1, h, c); px(ctx, x + w - 1, y, 1, h, c);
};

/** Ordered (Bayer) dither: shading without blending, which is how pixel art shades.
 *  level 0..16 sets density.
 *
 *  Implemented with a CACHED 4x4 pattern rather than per-pixel fillRect: at 1600x880 a
 *  per-pixel loop over a full-width band costs hundreds of thousands of calls per
 *  repaint, and the room repaints on every hover. */
const patCache = new Map<string, CanvasPattern | null>();
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

function ditherPattern(ctx: Ctx, c: string, level: number): CanvasPattern | null {
  const key = `${c}|${level}`;
  const hit = patCache.get(key);
  if (hit !== undefined) return hit;
  const cv = document.createElement('canvas');
  cv.width = 4; cv.height = 4;
  const c2 = cv.getContext('2d');
  let pat: CanvasPattern | null = null;
  if (c2) {
    c2.fillStyle = c;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      if (BAYER[y][x] < level) c2.fillRect(x, y, 1, 1);
    }
    pat = ctx.createPattern(cv, 'repeat');
  }
  patCache.set(key, pat);
  return pat;
}

function dither(ctx: Ctx, x: number, y: number, w: number, h: number, c: string, level: number) {
  if (w <= 0 || h <= 0 || level <= 0) return;
  const pat = ditherPattern(ctx, c, Math.min(16, Math.round(level)));
  if (!pat) return;
  ctx.fillStyle = pat;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** A vertical dithered ramp between two levels — wall falloff, glow pools, haze. */
function ramp(ctx: Ctx, x: number, y: number, w: number, h: number, c: string, from: number, to: number) {
  const steps = Math.max(1, Math.min(24, Math.round(h / 8)));
  for (let s = 0; s < steps; s++) {
    const t = s / Math.max(1, steps - 1);
    dither(ctx, x, y + (h * s) / steps, w, Math.ceil(h / steps) + 1, c, Math.round(from + (to - from) * t));
  }
}

/** Scanline-fill a quad. Pixel-art fills must land on integer rows, so this walks rows
 *  and fills one integer span each — no antialiased polygon edges. */
function fillQuad(ctx: Ctx, q: Quad, c: string) {
  const ys = q.map((p) => p[1]);
  const y0 = Math.round(Math.min(...ys)), y1 = Math.round(Math.max(...ys));
  ctx.fillStyle = c;
  for (let y = y0; y <= y1; y++) {
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < 4; i++) {
      const [ax, ay] = q[i], [bx, by] = q[(i + 1) % 4];
      if ((y >= ay && y <= by) || (y >= by && y <= ay)) {
        const t = Math.abs(by - ay) < 1e-6 ? 0 : (y - ay) / (by - ay);
        const x = ax + (bx - ax) * t;
        if (x < lo) lo = x; if (x > hi) hi = x;
      }
    }
    if (lo <= hi) ctx.fillRect(Math.round(lo), y, Math.max(1, Math.round(hi - lo)), 1);
  }
}

/** Stroke a quad's outline, 1px, integer. */
function strokeQuad(ctx: Ctx, q: Quad, c: string) {
  ctx.fillStyle = c;
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = q[i], [bx, by] = q[(i + 1) % 4];
    const steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
    for (let s = 0; s <= steps; s++) {
      const t = steps === 0 ? 0 : s / steps;
      ctx.fillRect(Math.round(ax + (bx - ax) * t), Math.round(ay + (by - ay) * t), 1, 1);
    }
  }
}

/**
 * Blit a rectangular source into a quad, column strip by column strip.
 *
 * The quad is a trapezoid (its left and right edges differ in height), which no affine
 * transform can produce — so this maps it the way pixel-art engines do: for each 1px
 * destination column, interpolate that column's top and bottom edge and scale the
 * matching source column into it. With smoothing off, the result stays crisp.
 */
function blitQuad(ctx: Ctx, src: HTMLCanvasElement, q: Quad) {
  const [tl, tr, br, bl] = q;
  const xL = Math.round(Math.min(tl[0], bl[0])), xR = Math.round(Math.max(tr[0], br[0]));
  const span = Math.max(1, xR - xL);
  for (let x = xL; x < xR; x++) {
    const t = (x - xL) / span;
    const top = tl[1] + (tr[1] - tl[1]) * t;
    const bot = bl[1] + (br[1] - bl[1]) * t;
    const h = bot - top;
    if (h <= 0) continue;
    // Source column advances in exact step with the destination column, and both the
    // top and the height are rounded CONSISTENTLY (round the edges, not the span) —
    // rounding the height independently accumulates a per-column error that reads as the
    // content sagging in the middle of the screen.
    const sx = Math.min(src.width - 1, Math.floor(t * src.width));
    const yTop = Math.round(top);
    const yBot = Math.round(bot);
    ctx.drawImage(src, sx, 0, 1, src.height, x, yTop, 1, Math.max(1, yBot - yTop));
  }
}

/** Deterministic pseudo-random in [0,1). No Math.random(): the room repaints on hover and
 *  theme change, and fresh randomness per repaint would make the city flicker. */
function hash(i: number): number {
  const h = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return h - Math.floor(h);
}

/** An extruded box: front face, one slanted side face, one lit top face. */
function box(
  ctx: Ctx, p: RoomPal, x: number, y: number, w: number, h: number,
  depth: number, faces: { front: string; side: string; top: string },
  opts: { line?: string; lit?: boolean } = {},
) {
  const d = sideDepth(x + w / 2, 46, Math.max(4, depth));
  const dz = Math.max(3, Math.round(depth * 0.6));
  const lineC = opts.line ?? p.line;

  ctx.fillStyle = faces.top;
  for (let i = 0; i < dz; i++) {
    const off = Math.round(d * (i / Math.max(1, dz)));
    ctx.fillRect(Math.round(x + off), Math.round(y - dz + i), Math.round(w), 1);
  }
  const sideW = Math.abs(d);
  if (sideW > 0) {
    ctx.fillStyle = faces.side;
    const sx = d < 0 ? x + w : x - sideW;
    for (let i = 0; i < sideW; i++) {
      const t = (i + 1) / sideW;
      const rise = Math.round(dz * t);
      const col = d < 0 ? sx + i : sx + (sideW - 1 - i);
      ctx.fillRect(Math.round(col), Math.round(y - rise), 1, Math.round(h + rise));
    }
  }
  px(ctx, x, y, w, h, faces.front);
  outline(ctx, x, y, w, h, lineC);
  if (opts.lit !== false) px(ctx, x + 1, y, w - 2, 1, p.lineHi);
}

// ── Entry point ─────────────────────────────────────────────────────────────

export interface RoomOpts {
  theme: 'light' | 'dark';
  hoverSlot: number | null;
  gantt: GanttBar[];
}

export function paintRoom(ctx: Ctx, o: RoomOpts): void {
  const p = roomPalette(o.theme);
  ctx.imageSmoothingEnabled = false;
  px(ctx, 0, 0, ROOM_W, ROOM_H, p.wall);

  drawCeiling(ctx, p);
  drawBackWall(ctx, p);
  drawWindow(ctx, p);
  drawClocks(ctx, p);
  drawRack(ctx, p);
  drawDesk(ctx, p);
  drawRig(ctx, p, o);
  drawDeskObjects(ctx, p);
  drawFloor(ctx, p);
  drawTower(ctx, p);
  drawChair(ctx, p);
  drawVignette(ctx, p);
}

function drawCeiling(ctx: Ctx, p: RoomPal) {
  px(ctx, 0, 0, ROOM_W, CEIL_BOTTOM, p.wallDark);
  px(ctx, 0, 0, ROOM_W, CEIL_TOP_VOID, p.void);
  ramp(ctx, 0, CEIL_TOP_VOID, ROOM_W, 44, p.void, 13, 2);

  // Seams converging on the vanishing axis.
  for (let i = 0; i <= 10; i++) {
    const xTop = Math.round((ROOM_W / 10) * i);
    const xBot = Math.round(ROOM_CX + (xTop - ROOM_CX) * 1.32);
    const span = CEIL_BOTTOM - CEIL_TOP_VOID;
    ctx.fillStyle = p.wallDark;
    for (let s = 0; s < span; s++) {
      const t = s / span;
      ctx.fillRect(Math.round(xTop + (xBot - xTop) * t), CEIL_TOP_VOID + s, 2, 1);
    }
  }

  // Recessed troffers: a housing, a lit panel set inside it, spill below. They must read
  // as recessed — floating bright bars look like a rendering bug.
  const lw = 196, gap = 56, count = 5;
  const x0 = Math.round((ROOM_W - (count * lw + (count - 1) * gap)) / 2);
  for (let i = 0; i < count; i++) {
    const x = x0 + i * (lw + gap), cy = 52, ch = 24;
    px(ctx, x - 4, cy - 4, lw + 8, ch + 8, p.metalDark);
    outline(ctx, x - 4, cy - 4, lw + 8, ch + 8, p.line);
    px(ctx, x, cy, lw, ch, p.void);
    px(ctx, x + 4, cy + 5, lw - 8, ch - 10, p.lineHi);
    dither(ctx, x + 4, cy + 5, lw - 8, ch - 10, p.cityLitHi, 9);
    px(ctx, x + Math.round(lw * 0.22), cy + 7, Math.round(lw * 0.56), ch - 14, p.cityLitHi);
    // the diffuser's ribs
    for (let k = 0; k < 8; k++) px(ctx, x + 8 + k * Math.round((lw - 16) / 8), cy + 5, 1, ch - 10, p.metalDark);
    ramp(ctx, x - 16, cy + ch + 4, lw + 32, 34, p.wallLit, 7, 0);
  }

  // Cable tray under the ceiling.
  px(ctx, 0, CEIL_BOTTOM - 18, ROOM_W, 11, p.metalDark);
  px(ctx, 0, CEIL_BOTTOM - 18, ROOM_W, 1, p.line);
  for (let x = 12; x < ROOM_W; x += 54) px(ctx, x, CEIL_BOTTOM - 16, 4, 7, p.line);
  px(ctx, 0, CEIL_BOTTOM - 7, ROOM_W, 7, p.wallDark);
  px(ctx, 0, CEIL_BOTTOM - 1, ROOM_W, 1, p.line);
}

function drawBackWall(ctx: Ctx, p: RoomPal) {
  px(ctx, 0, CEIL_BOTTOM, ROOM_W, WALL_BOTTOM - CEIL_BOTTOM, p.wall);
  ramp(ctx, 0, CEIL_BOTTOM, 150, WALL_BOTTOM - CEIL_BOTTOM, p.wallDark, 13, 3);
  ramp(ctx, ROOM_W - 150, CEIL_BOTTOM, 150, WALL_BOTTOM - CEIL_BOTTOM, p.wallDark, 13, 3);
  // Screen spill behind the rig.
  dither(ctx, 300, 190, 1060, 360, p.wallLit, 5);
  dither(ctx, 380, 250, 900, 280, p.wallLit, 3);
  // Acoustic panel grid.
  for (let x = 0; x < ROOM_W; x += 96) px(ctx, x, CEIL_BOTTOM, 2, WALL_BOTTOM - CEIL_BOTTOM, p.wallDark);
  for (let y = CEIL_BOTTOM; y < WALL_BOTTOM; y += 96) px(ctx, 0, y, ROOM_W, 2, p.wallDark);
}

/** The city through mullioned glass — the brightest thing besides the screens, and what
 *  places the room somewhere. Two skyline depths, because one reads completely flat. */
function drawWindow(ctx: Ctx, p: RoomPal) {
  const { x, y, w, h } = WINDOW;
  px(ctx, x, y, w, h, p.glass);
  const ix = x + 8, iy = y + 8, iw = w - 16, ih = h - 16;
  ramp(ctx, ix, iy, iw, Math.round(ih * 0.55), p.city, 0, 5);

  for (const layer of [0, 1] as const) {
    const far = layer === 0;
    let bx = ix - 12, i = layer * 97;
    while (bx < ix + iw) {
      const bw = far ? 18 + Math.floor(hash(i * 3.1) * 22) : 30 + Math.floor(hash(i * 3.1) * 38);
      const bh = far ? 50 + Math.floor(hash(i * 5.7) * 86) : 86 + Math.floor(hash(i * 5.7) * 160);
      const by = iy + ih - bh;
      const x0 = Math.max(ix, bx);
      const cw = Math.min(bx + bw, ix + iw) - x0;
      if (cw <= 0) { bx += bw + (far ? 6 : 9); i++; continue; }

      px(ctx, x0, by, cw, bh, far ? p.city : p.cityHi);
      px(ctx, x0, by, cw, 2, far ? p.city : p.line);
      if (far) dither(ctx, x0, by, cw, bh, p.glass, 6);

      if (!far) {
        // A setback storey — what makes a skyline read as architecture, not bar charts.
        if (hash(i * 6.3) > 0.55 && cw > 22) {
          const sw = Math.round(cw * 0.56), sh = 20 + Math.floor(hash(i * 4.1) * 34);
          const sx = x0 + Math.round((cw - sw) / 2);
          px(ctx, sx, by - sh, sw, sh, p.cityHi);
          px(ctx, sx, by - sh, sw, 2, p.line);
        }
        const rf = hash(i * 8.9);
        if (rf > 0.76 && cw > 20) {                    // water tower
          const tx = x0 + Math.round(cw / 2) - 7;
          px(ctx, tx, by - 16, 14, 11, p.cityHi);
          outline(ctx, tx, by - 16, 14, 11, p.line);
          px(ctx, tx + 2, by - 5, 2, 5, p.line);
          px(ctx, tx + 10, by - 5, 2, 5, p.line);
        } else if (rf > 0.6) {                          // aerial with a beacon
          px(ctx, x0 + Math.round(cw / 2), by - 20, 2, 20, p.line);
          px(ctx, x0 + Math.round(cw / 2) - 1, by - 22, 4, 4, p.cityLitHi);
        }
        // Lit windows in vertical runs, so floors read as floors.
        for (let wx = x0 + 5; wx < x0 + cw - 5; wx += 9) {
          const colLit = hash(wx * 2.7 + i) > 0.34;
          for (let wy = by + 9; wy < iy + ih - 6; wy += 10) {
            const r = hash(wx * 7.3 + wy * 13.9 + i);
            if (colLit ? r > 0.42 : r > 0.86) {
              px(ctx, wx, wy, 4, 5, r > 0.92 ? p.cityLitHi : p.cityLit);
            }
          }
        }
      }
      bx += bw + (far ? 6 : 9); i++;
    }
  }
  ramp(ctx, ix, iy + ih - 56, iw, 56, p.glass, 1, 13);
  for (const gx of [ix + 34, ix + 140, ix + 236]) dither(ctx, gx, iy + ih - 24, 20, 20, p.cityLitHi, 3);

  // Mullions, frame, and a lit sill with a reveal — so the wall has thickness.
  for (const my of [iy + Math.round(ih * 0.3), iy + Math.round(ih * 0.62)]) px(ctx, ix, my, iw, 4, p.line);
  px(ctx, x + Math.round(w * 0.5) - 2, iy, 4, ih, p.line);
  outline(ctx, x, y, w, h, p.line);
  outline(ctx, x + 3, y + 3, w - 6, h - 6, p.wallDark);
  px(ctx, x, y + h - 10, w + 14, 10, p.metal);
  px(ctx, x, y + h - 10, w + 14, 2, p.lineHi);
  px(ctx, x + w, y, 8, h - 10, p.wallDark);
}

/** Three wall clocks — a trading-floor signature in one small object. */
function drawClocks(ctx: Ctx, p: RoomPal) {
  const { x, y, w, h, count } = CLOCKS;
  const cw = Math.floor((w - (count - 1) * 14) / count);
  for (let i = 0; i < count; i++) {
    const cx = x + i * (cw + 14);
    box(ctx, p, cx, y, cw, h, 7, { front: p.metalDark, side: p.void, top: p.metal });
    const fx = cx + 7, fy = y + 9, fw = cw - 14, fh = h - 18;
    px(ctx, fx, fy, fw, fh, p.screenBg);
    outline(ctx, fx, fy, fw, fh, p.line);
    // tick marks
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      const rx = fw * 0.42, ry = fh * 0.42;
      px(ctx, fx + fw / 2 + Math.sin(a) * rx, fy + fh / 2 - Math.cos(a) * ry, 2, 2, p.dim);
    }
    // hands, each clock a different hour (three time zones)
    const mx = fx + fw / 2, my = fy + fh / 2;
    const ha = ((i * 5 + 2) / 12) * Math.PI * 2;
    px(ctx, mx, my - fh * 0.3, 2, fh * 0.3, p.accent);
    for (let s = 0; s < fw * 0.3; s++) {
      px(ctx, mx + Math.sin(ha) * s, my - Math.cos(ha) * s, 2, 2, p.paper);
    }
    px(ctx, mx - 2, my - 2, 4, 4, p.lineHi);
    // A city label under each — three short rules, not readable text at this size.
    px(ctx, cx + 10, y + h - 7, cw - 20, 3, p.dim);
  }
}

/** A server rack: vented units with status LEDs. Balances the window. */
function drawRack(ctx: Ctx, p: RoomPal) {
  const { x, y, w, h } = RACK;
  box(ctx, p, x, y, w, h, 16, { front: p.metalDark, side: p.void, top: p.metal });
  for (let i = 0; i < 14; i++) {
    const uy = y + 12 + i * 29;
    if (uy + 22 > y + h - 8) break;
    px(ctx, x + 8, uy, w - 16, 22, p.metal);
    outline(ctx, x + 8, uy, w - 16, 22, p.line);
    for (let k = 0; k < 6; k++) px(ctx, x + 16 + k * 11, uy + 6, 6, 11, p.metalDark);
    const r = hash(i * 17.3);
    px(ctx, x + w - 24, uy + 5, 5, 5, r > 0.35 ? p.accent : p.metalDark);
    px(ctx, x + w - 24, uy + 13, 5, 5, r > 0.8 ? p.seal : p.metalDark);
  }
  dither(ctx, x - 22, y, 22, h, p.wallDark, 8);
}

function drawDesk(ctx: Ctx, p: RoomPal) {
  // Top surface: a trapezoid, wider at the front so it recedes.
  const backInset = 74;
  const span = DESK_FRONT - WALL_BOTTOM;
  ctx.fillStyle = p.deskTop;
  for (let i = 0; i < span; i++) {
    const t = i / span;
    const inset = Math.round(backInset * (1 - t));
    ctx.fillRect(inset, WALL_BOTTOM + i, ROOM_W - inset * 2, 1);
  }
  ramp(ctx, 130, WALL_BOTTOM, ROOM_W - 260, 74, p.wallLit, 9, 1);
  dither(ctx, 320, WALL_BOTTOM, 980, 34, p.deskLip, 4);
  dither(ctx, 16, WALL_BOTTOM + 12, ROOM_W - 32, span - 12, p.wallDark, 2);
  px(ctx, backInset, WALL_BOTTOM, ROOM_W - backInset * 2, 2, p.line);

  // Cable grommets.
  for (const gx of [470, 1120]) {
    px(ctx, gx, WALL_BOTTOM + 14, 54, 11, p.void);
    outline(ctx, gx, WALL_BOTTOM + 14, 54, 11, p.line);
    px(ctx, gx + 2, WALL_BOTTOM + 15, 50, 2, p.metalDark);
  }

  // Front apron: the desk's thickness, ending on a hard dark base so the chair and floor
  // do not merge into it.
  px(ctx, 0, DESK_FRONT, ROOM_W, APRON_BOTTOM - DESK_FRONT, p.deskSide);
  px(ctx, 0, DESK_FRONT, ROOM_W, 6, p.deskLip);
  px(ctx, 0, DESK_FRONT, ROOM_W, 2, p.lineHi);
  ramp(ctx, 0, DESK_FRONT + 6, ROOM_W, APRON_BOTTOM - DESK_FRONT - 10, p.void, 2, 12);
  px(ctx, 0, APRON_BOTTOM - 4, ROOM_W, 4, p.void);
  for (const legX of [196, ROOM_W - 260]) {
    px(ctx, legX, APRON_BOTTOM, 54, 88, p.void);
    px(ctx, legX, APRON_BOTTOM, 54, 2, p.line);
  }
}

/** The rig: posts, cross-bars, and each monitor on its own articulated arm. */
function drawRig(ctx: Ctx, p: RoomPal, o: RoomOpts) {
  const r = rigFrame();

  for (const postX of [r.postL, r.postR]) {
    px(ctx, postX, r.braceTop, r.postW, WALL_BOTTOM - r.braceTop, p.metalDark);
    px(ctx, postX, r.braceTop, 4, WALL_BOTTOM - r.braceTop, p.metal);
    px(ctx, postX - 24, WALL_BOTTOM - 12, r.postW + 48, 12, p.metalDark);
    px(ctx, postX - 24, WALL_BOTTOM - 12, r.postW + 48, 2, p.line);
  }
  for (const barY of [r.barLowY, r.barHighY]) {
    px(ctx, r.postL - 18, barY, r.postR - r.postL + r.postW + 36, 13, p.metalDark);
    px(ctx, r.postL - 18, barY, r.postR - r.postL + r.postW + 36, 2, p.metal);
  }

  // Arms BEHIND every monitor, then the monitors themselves — the owner's note 3.
  for (const m of MONITORS) drawArm(ctx, p, m, r);
  for (const m of MONITORS) drawMonitor(ctx, p, m, o);
}

/** A VESA arm: a horizontal reach from the rig post to the monitor, an elbow, and the
 *  mount plate behind the panel. Drawn before the monitor so the panel occludes it. */
function drawArm(ctx: Ctx, p: RoomPal, m: MonitorPlace, r: ReturnType<typeof rigFrame>) {
  const q = monitorQuad(m);
  const b = quadBounds(q);
  const cx = Math.round(b.x + b.w / 2);
  const cy = Math.round(b.y + b.h * 0.42);
  const barY = m.kind === 'primary' ? r.barLowY : r.barHighY;

  // Vertical drop from the bar down to the arm's elbow.
  px(ctx, cx - 5, barY + 8, 10, cy - barY - 8, p.metalDark);
  px(ctx, cx - 5, barY + 8, 3, cy - barY - 8, p.metal);
  // The elbow joint.
  px(ctx, cx - 11, cy - 8, 22, 18, p.metalDark);
  outline(ctx, cx - 11, cy - 8, 22, 18, p.line);
  px(ctx, cx - 4, cy - 2, 8, 8, p.metal);
  // Mount plate behind the panel, visible either side of it because the panel is yawed.
  px(ctx, cx - 30, cy - 22, 60, 46, p.monBack);
  outline(ctx, cx - 30, cy - 22, 60, 46, p.line);
}

function drawMonitor(ctx: Ctx, p: RoomPal, m: MonitorPlace, o: RoomOpts) {
  const hot = m.slot !== null && o.hoverSlot === m.slot;
  const q = monitorQuad(m);
  const sq = screenQuad(m);
  const [tl, tr, br, bl] = q;

  // The exposed TOP face — the monitor is tilted back, so we see the top of its shell.
  // This single strip is the strongest tilt cue in the whole scene.
  const topDepth = Math.round(m.h * 0.055);
  const topFace: Quad = [
    [tl[0] + 3, tl[1] - topDepth], [tr[0] - 3, tr[1] - topDepth], [tr[0], tr[1]], [tl[0], tl[1]],
  ];
  fillQuad(ctx, topFace, p.monTop);
  strokeQuad(ctx, topFace, p.line);

  // The shell, then a 1px inner shadow so the glass sits below the frame.
  fillQuad(ctx, q, p.monFront);
  strokeQuad(ctx, q, p.line);
  // Lit upper edge of the front face.
  ctx.fillStyle = p.lineHi;
  {
    const steps = Math.abs(tr[0] - tl[0]);
    for (let s = 0; s <= steps; s++) {
      const t = steps === 0 ? 0 : s / steps;
      ctx.fillRect(Math.round(tl[0] + (tr[0] - tl[0]) * t), Math.round(tl[1] + (tr[1] - tl[1]) * t) + 1, 1, 2);
    }
  }

  // Screen: content renders rectangular into an offscreen buffer, then maps into the
  // tilted quad. See blitQuad — this is why content code stays readable.
  //
  // The source is sized to the trapezoid's UNWRAPPED dimensions — its width, and the
  // MEAN of its two vertical edge heights — not to its bounding box. The bounding box is
  // taller than any single column, so sizing to it squashes every column by a different
  // amount and the content visibly bows in the middle.
  const sb = quadBounds(sq);
  const edgeL = Math.abs(sq[3][1] - sq[0][1]);
  const edgeR = Math.abs(sq[2][1] - sq[1][1]);
  const srcH = Math.max(8, Math.round((edgeL + edgeR) / 2));
  const src = renderScreen(p, m, Math.max(8, Math.round(sb.w)), srcH, o);
  if (src) blitQuad(ctx, src, sq);
  strokeQuad(ctx, sq, p.void);

  // A chin bar with a status LED and a brand rule, below the glass.
  const chinY = Math.round(Math.max(bl[1], br[1])) - Math.round(m.bezel * 0.8);
  const chinX = Math.round(Math.min(bl[0], tl[0])) + 14;
  px(ctx, chinX, chinY, 26, 3, p.dim);
  px(ctx, Math.round(Math.max(br[0], tr[0])) - 22, chinY, 5, 4, hot ? p.accent : p.dim);

  // HOVER: quiet. A 2px accent underline along the chin and a slightly brighter panel —
  // no outline ring, no glow bloom. The loud version read as an error state.
  if (hot) {
    ctx.fillStyle = p.accent;
    const steps = Math.abs(br[0] - bl[0]);
    for (let s = 0; s <= steps; s++) {
      const t = steps === 0 ? 0 : s / steps;
      ctx.fillRect(
        Math.round(bl[0] + (br[0] - bl[0]) * t),
        Math.round(bl[1] + (br[1] - bl[1]) * t) - 2, 1, 2,
      );
    }
    dither(ctx, sb.x, sb.y, sb.w, sb.h, p.accent, 1);
  }
}

// ── Screen content, rendered rectangular into an offscreen buffer ────────────
// Cached per (slot, size, theme, hover): a repaint only redraws what changed, which is
// what keeps a 1600x880 room cheap enough to repaint on hover.

const screenCache = new Map<string, HTMLCanvasElement>();

function renderScreen(
  p: RoomPal, m: MonitorPlace, w: number, h: number, o: RoomOpts,
): HTMLCanvasElement | null {
  const id = m.slot !== null ? `s${m.slot}` : `a${m.ambient}`;
  const key = `${id}|${w}x${h}|${o.theme}|${o.hoverSlot === m.slot ? 1 : 0}`;
  const hit = screenCache.get(key);
  if (hit) return hit;

  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d');
  if (!c) return null;
  c.imageSmoothingEnabled = false;
  c.fillStyle = p.screenBg;
  c.fillRect(0, 0, w, h);

  if (m.slot === null) drawAmbient(c, p, m.ambient!, w, h);
  else drawDestination(c, p, m.slot, w, h, o.gantt);

  // Scanlines and a corner falloff: the two cheap cues that say "this is a screen".
  c.fillStyle = 'rgba(0,0,0,0.16)';
  for (let y = 1; y < h; y += 3) c.fillRect(0, y, w, 1);
  const g = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.32, w / 2, h / 2, Math.max(w, h) * 0.72);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.34)');
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);

  if (screenCache.size > 64) screenCache.clear();
  screenCache.set(key, cv);
  return cv;
}

function drawAmbient(c: Ctx, p: RoomPal, kind: 'heat' | 'tape', w: number, h: number) {
  if (kind === 'heat') {
    // A correlation matrix: the most recognisable quant screen there is. Symmetric, with
    // a unit diagonal — a random grid would read as noise to anyone who knows one.
    const n = 16;
    const cw = Math.floor((w - 20) / n), ch = Math.floor((h - 26) / n);
    const v = (i: number, j: number) => hash(Math.min(i, j) * 31.7 + Math.max(i, j) * 11.3);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const x = 14 + j * cw, y = 20 + i * ch;
        if (i === j) { c.fillStyle = p.paper; }
        else {
          const val = v(i, j);
          c.fillStyle = val > 0.72 ? p.accent : val > 0.42 ? p.dim : p.seal;
        }
        c.fillRect(x, y, cw - 1, ch - 1);
        if (i !== j) {
          const val = v(i, j);
          if (val > 0.42 && val <= 0.72) {
            c.fillStyle = p.screenBg;
            for (let yy = 0; yy < ch - 1; yy += 2) c.fillRect(x, y + yy, cw - 1, 1);
          }
        }
      }
    }
    c.fillStyle = p.accent;
    c.fillRect(14, 8, 84, 4);
    c.fillStyle = p.dim;
    for (let i = 0; i < n; i++) c.fillRect(4, 20 + i * ch + 1, 7, 2);
  } else {
    // A ticker tape: rows of quote stubs, alternating up/down, with a header band.
    c.fillStyle = p.accent;
    c.fillRect(0, 0, w, 5);
    for (let r = 0; r < Math.floor((h - 12) / 15); r++) {
      const y = 12 + r * 15;
      let x = 6 + Math.round(hash(r * 5.1) * 14);
      while (x < w - 14) {
        const bw = 14 + Math.floor(hash(x * 3.3 + r) * 22);
        const up = hash(x * 9.7 + r) > 0.5;
        c.fillStyle = p.dim;
        c.fillRect(x, y, Math.min(bw, w - 8 - x), 3);
        c.fillStyle = up ? p.accent : p.seal;
        c.fillRect(x, y + 5, Math.min(Math.round(bw * 0.6), w - 8 - x), 4);
        x += bw + 12;
      }
    }
  }
}

function drawDestination(c: Ctx, p: RoomPal, slot: number, w: number, h: number, gantt: GanttBar[]) {
  if (slot === 0) drawIdeScreen(c, p, w, h);
  else if (slot === 1) drawBacktestScreen(c, p, w, h);
  else if (slot === 2) drawGanttScreen(c, p, w, h, gantt);
  else if (slot === 3) drawPaperScreen(c, p, w, h);
  else drawMarketScreen(c, p, w, h);
}

/** An editor: tab bar, gutter, syntax-coloured token runs, a minimap, a status bar. At
 *  this resolution the token runs are fine enough to read as code rather than as bars. */
function drawIdeScreen(c: Ctx, p: RoomPal, w: number, h: number) {
  const tabH = 14, statusH = 11;
  c.fillStyle = p.void; c.fillRect(0, 0, w, tabH);
  c.fillStyle = p.wallLit; c.fillRect(6, 2, 78, tabH - 2);
  c.fillStyle = p.accent; c.fillRect(6, 2, 78, 2);
  c.fillStyle = p.dim; c.fillRect(12, 6, 54, 3);
  c.fillStyle = p.wallDark; c.fillRect(90, 2, 66, tabH - 2);
  c.fillStyle = p.dim; c.fillRect(96, 6, 44, 3);

  const gutter = 26, minimap = 34;
  c.fillStyle = p.void; c.fillRect(0, tabH, gutter, h - tabH - statusH);
  const lines = ideLines();
  const lh = Math.max(9, Math.floor((h - tabH - statusH - 8) / Math.max(1, lines.length)));
  const bodyW = w - gutter - minimap - 6;

  lines.forEach((ln, i) => {
    const y = tabH + 5 + i * lh;
    if (y + 4 > h - statusH) return;
    c.fillStyle = p.dim; c.fillRect(6, y + 1, 12, 3);          // line number
    let x = gutter + 4 + ln.indent * 12;
    for (const t of ln.tokens) {
      const tw = Math.max(3, Math.round(t.text.length * 3.4));
      if (x + tw > gutter + bodyW) break;
      c.fillStyle = t.kind === 'kw' ? p.accent : t.kind === 'str' ? p.seal
        : t.kind === 'num' ? p.lineHi : t.kind === 'comment' ? p.dim : p.paper;
      c.fillRect(x, y, tw, 4);
      x += tw + 5;
    }
    // The minimap: the same lines at a fraction of the width. A real editor tell.
    c.fillStyle = p.wallLit;
    c.fillRect(w - minimap + 2 + ln.indent * 2, tabH + 4 + i * 4, Math.max(2, Math.round(ln.tokens.length * 4)), 2);
  });
  c.fillStyle = p.wallDark; c.fillRect(w - minimap, tabH, 1, h - tabH - statusH);

  // Cursor, and a selection highlight two lines above it.
  c.fillStyle = p.accent;
  c.fillRect(gutter + 4, tabH + 5 + lines.length * lh, 6, 5);

  // Status bar: branch, position, a couple of segments.
  c.fillStyle = p.void; c.fillRect(0, h - statusH, w, statusH);
  c.fillStyle = p.accent; c.fillRect(0, h - statusH, 54, statusH);
  c.fillStyle = p.screenBg; c.fillRect(6, h - statusH + 4, 40, 3);
  c.fillStyle = p.dim;
  c.fillRect(62, h - statusH + 4, 30, 3);
  c.fillRect(w - 78, h - statusH + 4, 24, 3);
  c.fillRect(w - 44, h - statusH + 4, 34, 3);
}

/** An equity curve with tick-marked axes, a drawdown panel and a legend. */
function drawBacktestScreen(c: Ctx, p: RoomPal, w: number, h: number) {
  const padL = 30, padR = 10, padT = 20, ddH = Math.round(h * 0.24), gap = 10;
  const plotW = w - padL - padR;
  const plotH = h - padT - ddH - gap - 14;

  c.fillStyle = p.accent; c.fillRect(padL, 6, 70, 4);          // title rule
  c.fillStyle = p.dim; c.fillRect(padL + 78, 6, 40, 3);

  // Grid + ticks.
  for (let i = 0; i <= 4; i++) {
    const y = padT + Math.round((plotH / 4) * i);
    c.fillStyle = p.wallDark; c.fillRect(padL, y, plotW, 1);
    c.fillStyle = p.dim; c.fillRect(padL - 8, y, 6, 1);
    c.fillRect(6, y - 1, 16, 3);                                // y label stub
  }
  for (let i = 0; i <= 6; i++) {
    const x = padL + Math.round((plotW / 6) * i);
    c.fillStyle = p.wallDark; c.fillRect(x, padT, 1, plotH);
  }

  const pts = backtestCurve(plotW);
  // Fill under the curve, then the curve itself 2px thick.
  c.fillStyle = p.accent;
  const px2 = (x: number, y: number, ww: number, hh: number) => c.fillRect(x, y, ww, hh);
  let prevY = -1;
  pts.forEach((pt, i) => {
    const x = padL + i;
    const y = padT + Math.round((1 - pt.y) * plotH);
    if (prevY >= 0 && Math.abs(y - prevY) > 1) {
      px2(x, Math.min(y, prevY), 2, Math.abs(y - prevY));
    }
    px2(x, y, 2, 2);
    prevY = y;
  });
  // Dithered fill below the line, so the area reads without hiding the grid.
  c.save();
  c.beginPath();
  pts.forEach((pt, i) => {
    const x = padL + i, y = padT + Math.round((1 - pt.y) * plotH);
    if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
  });
  c.lineTo(padL + plotW, padT + plotH); c.lineTo(padL, padT + plotH); c.closePath();
  c.clip();
  c.fillStyle = p.accent;
  for (let y = padT; y < padT + plotH; y += 2) c.fillRect(padL, y, plotW, 1);
  c.globalAlpha = 1;
  c.restore();

  // Drawdown panel below — underwater curve, the second chart every backtest has.
  const ddY = padT + plotH + gap;
  c.fillStyle = p.wallDark; c.fillRect(padL, ddY, plotW, ddH);
  let peak = 0;
  c.fillStyle = p.seal;
  pts.forEach((pt, i) => {
    peak = Math.max(peak, pt.y);
    const dd = peak > 0 ? (peak - pt.y) / peak : 0;
    const barH = Math.max(1, Math.round(dd * ddH * 2.4));
    c.fillRect(padL + i, ddY, 1, Math.min(ddH, barH));
  });
  c.fillStyle = p.dim; c.fillRect(padL, ddY, plotW, 1);

  // Legend chips.
  c.fillStyle = p.accent; c.fillRect(padL, h - 9, 8, 4);
  c.fillStyle = p.dim; c.fillRect(padL + 12, h - 8, 36, 3);
  c.fillStyle = p.seal; c.fillRect(padL + 58, h - 9, 8, 4);
  c.fillStyle = p.dim; c.fillRect(padL + 70, h - 8, 30, 3);
}

/** A career Gantt: year axis, row labels, spans, and a "now" marker. */
function drawGanttScreen(c: Ctx, p: RoomPal, w: number, h: number, gantt: GanttBar[]) {
  const bars = gantt.slice(0, 6);
  if (!bars.length) return;
  const lo = Math.min(...bars.map((b) => b.start));
  const hi = Math.max(...bars.map((b) => b.end));
  const span = Math.max(1, hi - lo);
  const labelW = 62, padT = 22, padB = 14;
  const plotW = w - labelW - 12;
  const rowH = Math.floor((h - padT - padB) / bars.length);

  c.fillStyle = p.accent; c.fillRect(10, 6, 58, 4);
  // Year gridlines and axis labels.
  for (let yr = 0; yr <= span; yr++) {
    const x = labelW + Math.round((yr / span) * plotW);
    c.fillStyle = p.wallDark; c.fillRect(x, padT, 1, h - padT - padB);
    if (yr % 2 === 0) { c.fillStyle = p.dim; c.fillRect(x - 7, h - padB + 3, 15, 3); }
  }
  bars.forEach((b, i) => {
    const y = padT + i * rowH;
    c.fillStyle = p.dim;
    c.fillRect(6, y + Math.round(rowH / 2) - 2, 48 - (i % 3) * 8, 3);      // label stub
    const x0 = labelW + Math.round(((b.start - lo) / span) * plotW);
    const x1 = labelW + Math.round(((b.end - lo) / span) * plotW);
    const bw = Math.max(4, x1 - x0), bh = Math.max(6, Math.round(rowH * 0.5));
    const by = y + Math.round((rowH - bh) / 2);
    c.fillStyle = b.kind === 'education' ? p.lineHi : p.accent;
    c.fillRect(x0, by, bw, bh);
    c.fillStyle = p.paper; c.fillRect(x0, by, bw, 1);                       // lit top edge
    c.fillStyle = p.void; c.fillRect(x0, by + bh - 1, bw, 1);
  });
  // "Now" marker.
  const nowX = labelW + Math.round(((2026 - lo) / span) * plotW);
  c.fillStyle = p.seal;
  for (let y = padT; y < h - padB; y += 4) c.fillRect(nowX, y, 2, 2);
}

/** A LaTeX page: title, abstract, two columns, a display equation, a figure box. */
function drawPaperScreen(c: Ctx, p: RoomPal, w: number, h: number) {
  c.fillStyle = p.wallLit; c.fillRect(0, 0, w, h);
  const pad = 12, colGap = 10;
  const colW = Math.floor((w - pad * 2 - colGap) / 2);
  const cx = w / 2;

  c.fillStyle = p.paper; c.fillRect(cx - 56, 10, 112, 4);            // title
  c.fillRect(cx - 34, 18, 68, 3);
  c.fillStyle = p.dim; c.fillRect(cx - 24, 26, 48, 2);               // authors

  let y = 38;
  // Abstract, indented both sides.
  for (let i = 0; i < 3; i++) { c.fillStyle = p.dim; c.fillRect(pad + 16, y, w - pad * 2 - 32, 2); y += 5; }
  y += 6;

  // Two columns of rules, with a centred display equation in the left column.
  for (const col of [0, 1]) {
    const x = pad + col * (colW + colGap);
    let cy = y;
    const rows = 14;
    for (let i = 0; i < rows; i++) {
      if (cy + 3 > h - 10) break;
      if (col === 0 && i === 5) {
        c.fillStyle = p.accent; c.fillRect(x + Math.round(colW * 0.16), cy + 1, Math.round(colW * 0.68), 4);
        cy += 10; continue;
      }
      if (col === 1 && i === 3) {
        // a figure box with a tiny plot in it
        c.fillStyle = p.screenBg; c.fillRect(x, cy, colW, 30);
        c.fillStyle = p.wallDark; c.fillRect(x + 1, cy + 1, colW - 2, 28);
        c.fillStyle = p.accent;
        for (let k = 0; k < colW - 8; k++) {
          c.fillRect(x + 4 + k, cy + 24 - Math.round(hash(k * 0.9) * 16), 1, 2);
        }
        cy += 34; continue;
      }
      c.fillStyle = p.dim;
      c.fillRect(x, cy, i % 5 === 4 ? Math.round(colW * 0.62) : colW, 2);
      cy += 5;
    }
  }
}

/** A market panel: header, columns of ticker / last / change, sparklines, a footer. */
function drawMarketScreen(c: Ctx, p: RoomPal, w: number, h: number) {
  const rows = bloombergRows();
  const headH = 14, footH = 10;
  c.fillStyle = p.accent; c.fillRect(0, 0, w, headH);
  c.fillStyle = p.screenBg; c.fillRect(1, 1, w - 2, headH - 2);
  c.fillStyle = p.accent; c.fillRect(6, 5, 62, 4);
  c.fillStyle = p.dim; c.fillRect(w - 46, 5, 40, 3);

  // Column rules.
  const colT = 8, colL = Math.round(w * 0.30), colC = Math.round(w * 0.55), colS = Math.round(w * 0.76);
  c.fillStyle = p.wallDark;
  c.fillRect(colL - 6, headH, 1, h - headH - footH);
  c.fillRect(colC - 6, headH, 1, h - headH - footH);
  c.fillRect(colS - 6, headH, 1, h - headH - footH);

  const rowH = Math.max(11, Math.floor((h - headH - footH - 4) / Math.max(1, rows.length)));
  rows.forEach((r, i) => {
    const y = headH + 4 + i * rowH;
    if (y + 5 > h - footH) return;
    if (i % 2 === 1) { c.fillStyle = p.wallDark; c.fillRect(0, y - 2, w, rowH); }
    c.fillStyle = p.accent; c.fillRect(colT, y, 26, 4);                     // ticker
    c.fillStyle = p.paper; c.fillRect(colL, y, 40, 4);                      // last
    c.fillStyle = r.up ? p.accent : p.seal; c.fillRect(colC, y, 30, 4);     // change
    // an up/down arrow, as three pixels
    c.fillRect(colC + 34, r.up ? y : y + 3, 3, 2);
    c.fillRect(colC + 32, r.up ? y + 2 : y + 1, 7, 2);
    // sparkline
    for (let k = 0; k < 12; k++) {
      const sh = 1 + Math.round(hash(i * 7.7 + k) * 5);
      c.fillRect(colS + k * 3, y + 5 - sh, 2, sh);
    }
  });
  c.fillStyle = p.void; c.fillRect(0, h - footH, w, footH);
  c.fillStyle = p.dim; c.fillRect(6, h - footH + 3, 46, 3);
  c.fillStyle = p.accent; c.fillRect(w - 32, h - footH + 3, 26, 3);
}

// ── Desk objects ────────────────────────────────────────────────────────────

function drawDeskObjects(ctx: Ctx, p: RoomPal) {
  const O = DESK_OBJECTS;

  // Desk phone — a trading-floor object, and it fills the left corner.
  const ph = O.phone;
  box(ctx, p, ph.x, ph.y + 16, ph.w, ph.h - 16, 12, { front: p.metalDark, side: p.void, top: p.metal });
  for (let r = 0; r < 3; r++) for (let c2 = 0; c2 < 3; c2++) {
    px(ctx, ph.x + 10 + c2 * 15, ph.y + 28 + r * 10, 9, 6, p.metal);
  }
  px(ctx, ph.x - 5, ph.y, ph.w + 10, 18, p.metalDark);
  outline(ctx, ph.x - 5, ph.y, ph.w + 10, 18, p.line);
  px(ctx, ph.x - 3, ph.y + 2, ph.w + 6, 2, p.lineHi);
  px(ctx, ph.x + 6, ph.y + 8, ph.w - 12, 6, p.void);

  // Plush cow.
  const c = O.cow;
  box(ctx, p, c.x, c.y + 24, c.w, c.h - 32, 14, { front: p.paper, side: p.dim, top: p.paper });
  box(ctx, p, c.x + c.w - 40, c.y, 40, 36, 10, { front: p.paper, side: p.dim, top: p.paper });
  px(ctx, c.x + c.w - 46, c.y + 2, 8, 9, p.line);                 // ears
  px(ctx, c.x + c.w - 2, c.y + 2, 8, 9, p.line);
  px(ctx, c.x + c.w - 30, c.y + 14, 6, 6, p.void);                // eyes
  px(ctx, c.x + c.w - 14, c.y + 14, 6, 6, p.void);
  px(ctx, c.x + c.w - 32, c.y + 26, 24, 8, p.cityLit);            // muzzle
  px(ctx, c.x + c.w - 26, c.y + 28, 4, 3, p.void);                // nostrils
  px(ctx, c.x + c.w - 18, c.y + 28, 4, 3, p.void);
  px(ctx, c.x + 16, c.y + 34, 26, 16, p.wallDark);                // patches
  px(ctx, c.x + 52, c.y + 50, 22, 12, p.wallDark);
  for (let i = 0; i < 3; i++) {
    px(ctx, c.x + 12 + i * 32, c.y + c.h - 10, 12, 12, p.paper);
    outline(ctx, c.x + 12 + i * 32, c.y + c.h - 10, 12, 12, p.line);
  }

  // Coffee: a tapered mug with an elliptical rim and a ring handle. Drawn as a plain box
  // it read as a grey brick, which is why the taper and rim are explicit.
  const k = O.coffee;
  const bodyTop = k.y + 16, bodyH = k.h - 20;
  for (let i = 0; i < bodyH; i++) {
    const inset = Math.round(6 * (i / bodyH));
    px(ctx, k.x + inset, bodyTop + i, k.w - inset * 2, 1, p.paper);
    px(ctx, k.x + inset, bodyTop + i, 2, 1, p.line);
    px(ctx, k.x + k.w - inset - 2, bodyTop + i, 2, 1, p.line);
  }
  px(ctx, k.x + 5, k.y + bodyH + 13, k.w - 10, 3, p.line);
  px(ctx, k.x + k.w - 2, k.y + 30, 16, 4, p.paper);               // handle ring
  px(ctx, k.x + k.w + 10, k.y + 30, 4, 22, p.paper);
  px(ctx, k.x + k.w - 2, k.y + 48, 16, 4, p.paper);
  outline(ctx, k.x + k.w - 2, k.y + 30, 18, 22, p.line);
  px(ctx, k.x + 4, k.y + 8, k.w - 8, 10, p.lineHi);               // rim
  px(ctx, k.x, k.y + 12, k.w, 4, p.lineHi);
  outline(ctx, k.x, k.y + 8, k.w, 12, p.line);
  px(ctx, k.x + 8, k.y + 12, k.w - 16, 6, p.void);                // the coffee
  px(ctx, k.x + 12, k.y + 13, k.w - 26, 2, p.wallDark);
  px(ctx, k.x + 18, k.y - 12, 3, 12, p.dim);                      // steam
  px(ctx, k.x + 38, k.y - 24, 3, 14, p.dim);

  // Legal pad and pen.
  const nb = O.notebook;
  box(ctx, p, nb.x, nb.y, nb.w, nb.h, 9, { front: p.paper, side: p.dim, top: p.paper });
  for (let r = 0; r < 7; r++) px(ctx, nb.x + 10, nb.y + 14 + r * 7, nb.w - 24, 2, p.dim);
  px(ctx, nb.x + 10, nb.y + 7, 42, 4, p.accent);
  px(ctx, nb.x, nb.y, nb.w, 6, p.seal);
  const pn = O.pen;
  px(ctx, pn.x, pn.y, pn.w, pn.h - 5, p.void);
  px(ctx, pn.x, pn.y, pn.w, 2, p.lineHi);
  px(ctx, pn.x + pn.w, pn.y + 2, 10, 3, p.metal);

  // Keyboard: a wedge with a real key grid.
  const kb = O.keyboard;
  box(ctx, p, kb.x, kb.y, kb.w, kb.h, 18, { front: p.wallLit, side: p.deskSide, top: p.metal });
  for (let r = 0; r < 5; r++) {
    for (let cN = 0; cN < 24; cN++) {
      const x = kb.x + 12 + cN * 20 + r * 4, y = kb.y + 8 + r * 11;
      if (x + 16 > kb.x + kb.w - 8) continue;
      px(ctx, x, y, 16, 8, p.metalDark);
      px(ctx, x, y, 16, 2, p.line);
      px(ctx, x + 1, y + 7, 14, 1, p.void);
    }
  }
  px(ctx, kb.x + 140, kb.y + kb.h - 10, 200, 7, p.metalDark);     // spacebar
  px(ctx, kb.x + 140, kb.y + kb.h - 10, 200, 2, p.line);

  // Mousepad, then the mouse on it.
  const mp = O.mousepad;
  px(ctx, mp.x, mp.y, mp.w, mp.h, p.deskSide);
  outline(ctx, mp.x, mp.y, mp.w, mp.h, p.line);
  dither(ctx, mp.x + 2, mp.y + 2, mp.w - 4, mp.h - 4, p.wallLit, 3);
  const ms = O.mouse;
  box(ctx, p, ms.x, ms.y, ms.w, ms.h, 12, { front: p.wallLit, side: p.deskSide, top: p.metal });
  px(ctx, ms.x + Math.round(ms.w / 2) - 2, ms.y + 6, 5, 18, p.line);
  px(ctx, ms.x + 6, ms.y + 28, ms.w - 12, 2, p.line);

  // Fanned papers: offset sheets, each with a lit top edge. A body of work.
  const pp = O.papers;
  for (let i = 7; i >= 0; i--) {
    const x = pp.x + i * 9, y = pp.y + i * 5, ww = pp.w - i * 7, hh = 44;
    px(ctx, x, y, ww, hh, p.paper);
    outline(ctx, x, y, ww, hh, p.line);
    px(ctx, x + 2, y, ww - 4, 2, p.lineHi);
    if (i === 0) {
      for (let r = 0; r < 6; r++) px(ctx, x + 12, y + 8 + r * 5, ww - 24 - r * 10, 2, p.dim);
      px(ctx, x + 12, y + 36, 58, 5, p.accent);
    }
  }
}

function drawFloor(ctx: Ctx, p: RoomPal) {
  px(ctx, 0, APRON_BOTTOM, ROOM_W, FLOOR_BOTTOM - APRON_BOTTOM, p.wallDark);
  ramp(ctx, 0, APRON_BOTTOM, ROOM_W, 84, p.wall, 8, 0);
  dither(ctx, 250, APRON_BOTTOM, 1100, 46, p.wallLit, 4);
  // Board seams converging on the vanishing axis.
  ctx.fillStyle = p.void;
  for (let i = 0; i <= 12; i++) {
    const xTop = Math.round((ROOM_W / 12) * i);
    const xBot = Math.round(ROOM_CX + (xTop - ROOM_CX) * 1.7);
    const span = FLOOR_BOTTOM - APRON_BOTTOM;
    for (let s = 0; s < span; s++) {
      const t = s / span;
      ctx.fillRect(Math.round(xTop + (xBot - xTop) * t), APRON_BOTTOM + s, 2, 1);
    }
  }
  // A cable snaking down to the tower.
  ctx.fillStyle = p.void;
  for (let i = 0; i < 70; i++) ctx.fillRect(212 + Math.round(Math.sin(i * 0.22) * 14), APRON_BOTTOM + i, 4, 1);
}

function drawTower(ctx: Ctx, p: RoomPal) {
  const t = DESK_OBJECTS.tower;
  box(ctx, p, t.x, t.y, t.w, t.h, 22, { front: p.metalDark, side: p.void, top: p.metal });
  for (let i = 0; i < 3; i++) px(ctx, t.x + 16, t.y + 16 + i * 16, t.w - 32, 6, p.void);
  px(ctx, t.x + t.w - 32, t.y + 16, 8, 8, p.accent);
  px(ctx, t.x + 16, t.y + t.h - 44, t.w - 32, 28, p.void);
  for (let i = 0; i < 6; i++) px(ctx, t.x + 20 + i * 18, t.y + t.h - 40, 8, 20, p.metalDark);
}

/** The chair back from behind — the strongest cue that YOU are the one sitting here.
 *  Darkest mass in the room, so it needs an outline and a rim light or it becomes a
 *  featureless blob. Built as a real task chair: a separate headrest, a waisted
 *  backrest, mesh ribs, and armrests on posts. */
function drawChair(ctx: Ctx, p: RoomPal) {
  const c = DESK_OBJECTS.chair;
  const x = c.x, top = c.y, w = c.w, bot = ROOM_H;
  const cxm = x + w / 2;

  const hrW = Math.round(w * 0.46), hrH = 54;
  const hrX = Math.round(cxm - hrW / 2);
  for (let y = 0; y < hrH; y++) {
    const inset = Math.round(15 * (1 - y / hrH) ** 1.6);
    px(ctx, hrX + inset, top + y, hrW - inset * 2, 1, p.void);
    px(ctx, hrX + inset, top + y, 2, 1, p.line);
    px(ctx, hrX + hrW - inset - 2, top + y, 2, 1, p.line);
  }
  px(ctx, hrX + 15, top, hrW - 30, 2, p.line);
  dither(ctx, hrX + 8, top + 6, hrW - 16, 28, p.wallDark, 4);

  const backTop = top + hrH + 18;
  for (const postX of [cxm - 46, cxm + 34]) {
    px(ctx, postX, top + hrH, 12, 20, p.void);
    px(ctx, postX, top + hrH, 2, 20, p.line);
  }

  const lumbarY = backTop + 62;
  for (let y = backTop; y < bot; y++) {
    const t = (y - backTop) / Math.max(1, lumbarY - backTop);
    const waist = t < 1 ? Math.round(30 * Math.sin(t * Math.PI * 0.5)) : Math.round(30 - 22 * Math.min(1, t - 1));
    const shoulder = y < backTop + 34 ? Math.round(22 * (1 - (y - backTop) / 34) ** 1.5) : 0;
    const inset = waist + shoulder;
    px(ctx, x + inset, y, w - inset * 2, 1, p.void);
    px(ctx, x + inset, y, 2, 1, p.line);
    px(ctx, x + w - inset - 2, y, 2, 1, p.line);
  }
  px(ctx, x + 50, backTop, w - 100, 2, p.line);
  for (let i = 0; i < 10; i++) {
    const y = backTop + 16 + i * 18;
    if (y > bot - 8) break;
    const fade = 1 - Math.abs(i - 3) / 7;
    dither(ctx, x + 46, y, w - 92, 6, p.wallDark, Math.max(2, Math.round(6 * fade)));
  }
  px(ctx, x + 38, lumbarY - 10, w - 76, 16, p.void);
  px(ctx, x + 38, lumbarY - 10, w - 76, 2, p.line);
  px(ctx, x + 38, lumbarY + 4, w - 76, 2, p.line);

  for (const side of [-1, 1] as const) {
    const ax = side < 0 ? x - 46 : x + w - 16;
    const armY = backTop + 84;
    px(ctx, ax, armY, 62, 16, p.void);
    px(ctx, ax, armY, 62, 2, p.line);
    px(ctx, ax + (side < 0 ? 6 : 44), armY + 16, 12, 42, p.void);
    px(ctx, ax + (side < 0 ? 6 : 44), armY + 16, 2, 42, p.line);
  }
}

function drawVignette(ctx: Ctx, p: RoomPal) {
  ramp(ctx, 0, 0, ROOM_W, 44, p.void, 16, 3);
  ramp(ctx, 0, ROOM_H - 96, ROOM_W, 96, p.void, 2, 16);
  px(ctx, 0, ROOM_H - 12, ROOM_W, 12, p.void);
  ramp(ctx, 0, 0, 92, ROOM_H, p.void, 10, 2);
  ramp(ctx, ROOM_W - 92, 0, 92, ROOM_H, p.void, 10, 2);
}
