// src/lib/podRoom.ts
// The pod as a ROOM, drawn as genuine pixel art.
//
// WHY THIS REPLACES podPaint/podGeometry:
// The first attempt projected a desk isometrically at full resolution and "snapped
// to a 3px grid". That is an imitation of pixel art, and it read as an abstract
// diagram rather than a place. Real pixel art is LOW RESOLUTION: every pixel is
// placed on purpose in a small buffer, then the whole buffer is scaled up with hard
// edges (CSS image-rendering: pixelated). So this module paints a fixed 480x280
// buffer in integer coordinates and lets CSS blow it up.
//
// The four things that make the reference art read, and that the isometric slab
// lacked:
//   1. It is a ROOM — window, walls, floor, shelf, chair — not a desk in a void.
//   2. Low internal resolution, so detail is chunky and deliberate.
//   3. Every object is OUTLINED in a lighter tone of its own colour. The line work
//      does more work than the fills.
//   4. Depth reads as value bands: city -> window -> wall -> monitors -> desk ->
//      chair, each a distinct lightness.
//
// Screens show ICONIC content — a curve, bars, coloured token lengths — never
// readable prose. Trying to fit legible text into a 60px-wide screen is what
// produced every clipping bug, and the words are meaningless on a landing page
// anyway. The real labels are HTML over the canvas, which is also what makes them
// selectable and screen-reader-native.

import { ideLines, backtestCurve, bloombergRows, type GanttBar } from './podScreens';

/** Buffer size. Fixed, so every coordinate in this file is a literal pixel and the
 *  art can be authored rather than computed. CSS scales it up. */
export const ROOM_W = 480;
export const ROOM_H = 280;

export const MONITOR_COUNT = 5;

/** Monitor array metrics in buffer pixels. Five monitors centred across the desk:
 *  5*66 + 4*6 = 354 wide, leaving 63px of desk either side. */
const MON = { x0: 63, w: 66, gap: 6, y0: 97, h: 53, bezel: 3 } as const;

/** Vertical bands of the composition, in buffer pixels. */
const WALL_BOTTOM = 152;   // back wall meets the desk
const DESK_FRONT = 204;    // front edge of the desk top
const LIP_BOTTOM = 210;    // bottom of the lit front lip
const FLOOR_BOTTOM = 252;  // floor fades to dark below this

/** Screen interiors as FRACTIONS of the buffer, so the DOM overlay can position
 *  itself in percentages and needs no JS on resize. Single source of truth: the
 *  painter reads the same numbers. */
export function roomScreens(): {
  slot: number; left: number; top: number; width: number; height: number;
}[] {
  const w = MON.w - MON.bezel * 2;
  const h = MON.h - MON.bezel * 2;
  return Array.from({ length: MONITOR_COUNT }, (_, i) => {
    const x = MON.x0 + i * (MON.w + MON.gap) + MON.bezel;
    const y = MON.y0 + MON.bezel;
    return {
      slot: i,
      left: (x / ROOM_W) * 100,
      top: (y / ROOM_H) * 100,
      width: (w / ROOM_W) * 100,
      height: (h / ROOM_H) * 100,
    };
  });
}

/** Screen interior in buffer pixels (painter-side companion to roomScreens). */
function screenBox(slot: number) {
  return {
    x: MON.x0 + slot * (MON.w + MON.gap) + MON.bezel,
    y: MON.y0 + MON.bezel,
    w: MON.w - MON.bezel * 2,
    h: MON.h - MON.bezel * 2,
  };
}

// ── Palette ─────────────────────────────────────────────────────────────────
// A tight ramp per theme. The room is a NIGHT room in both themes because the
// descent arrives dark either way (--bg never flips bright); the theme changes the
// temperature and the accent, not the time of day. Values are drawn from the site's
// tokens: ochre/seal/indigo in light, emerald/seal/cyan in dark.

export interface RoomPal {
  void: string;      // deepest shadow, and the band the page fades into
  wallDark: string;  // wall in shadow
  wall: string;      // wall base
  wallLit: string;   // wall catching screen light
  line: string;      // outlines
  lineHi: string;    // lit outlines / highlights
  glass: string;     // window glass behind the city
  city: string;      // building mass
  cityHi: string;    // nearer building mass
  cityLit: string;   // lit windows in the city
  cityLitHi: string; // the brightest window lights
  deskTop: string;
  deskLip: string;
  screenBg: string;
  accent: string;    // ochre (light) / emerald (dark)
  seal: string;
  paper: string;
  dim: string;
}

export function roomPalette(theme: 'light' | 'dark'): RoomPal {
  return theme === 'dark'
    ? {
        void: '#080b11', wallDark: '#0e131d', wall: '#161d2b', wallLit: '#1f2a3d',
        line: '#3a5675', lineHi: '#5d84ad', glass: '#111a2e',
        city: '#18233c', cityHi: '#22314f', cityLit: '#c9524a', cityLitHi: '#e88b72',
        deskTop: '#1b2533', deskLip: '#3d5570',
        screenBg: '#080e14', accent: '#66c28c', seal: '#e0574a',
        paper: '#dce1dc', dim: '#7f8b93',
      }
    : {
        void: '#0b0907', wallDark: '#14100c', wall: '#1f1913', wallLit: '#2d241a',
        line: '#5f4b36', lineHi: '#8d7355', glass: '#181209',
        city: '#241a10', cityHi: '#332515', cityLit: '#b23a2e', cityLitHi: '#d98a5c',
        deskTop: '#251d15', deskLip: '#6b5540',
        screenBg: '#0c0a08', accent: '#c8a36a', seal: '#b23a2e',
        paper: '#efe9dd', dim: '#8a7f6e',
      };
}

// ── Primitives. Everything is an integer rect; that IS the aesthetic. ────────

type Ctx = CanvasRenderingContext2D;

const px = (ctx: Ctx, x: number, y: number, w: number, h: number, c: string) => {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), Math.max(0, Math.round(w)), Math.max(0, Math.round(h)));
};

/** 1px outline just inside the given box — the line work that makes objects read. */
const outline = (ctx: Ctx, x: number, y: number, w: number, h: number, c: string) => {
  px(ctx, x, y, w, 1, c);
  px(ctx, x, y + h - 1, w, 1, c);
  px(ctx, x, y, 1, h, c);
  px(ctx, x + w - 1, y, 1, h, c);
};

/** Ordered (Bayer) dither — the pixel-art way to get a gradient without blending.
 *  level 0..16 sets density. */
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
function dither(ctx: Ctx, x: number, y: number, w: number, h: number, c: string, level: number) {
  ctx.fillStyle = c;
  const x0 = Math.round(x), y0 = Math.round(y);
  for (let j = 0; j < h; j++) {
    const row = BAYER[(y0 + j) & 3];
    for (let i = 0; i < w; i++) {
      if (row[(x0 + i) & 3] < level) ctx.fillRect(x0 + i, y0 + j, 1, 1);
    }
  }
}

/** Deterministic pseudo-random in [0,1) from an integer. No Math.random(): the room
 *  repaints on hover and theme change, and a fresh random per repaint would make the
 *  whole city flicker. */
function hash(i: number): number {
  const h = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return h - Math.floor(h);
}

/** A trapezoid drawn row by row, so its edges step in whole pixels. */
function trapezoid(
  ctx: Ctx, yTop: number, yBot: number,
  xTopL: number, xTopR: number, xBotL: number, xBotR: number, c: string,
) {
  ctx.fillStyle = c;
  const span = Math.max(1, yBot - yTop);
  for (let y = yTop; y < yBot; y++) {
    const t = (y - yTop) / span;
    const l = Math.round(xTopL + (xBotL - xTopL) * t);
    const r = Math.round(xTopR + (xBotR - xTopR) * t);
    ctx.fillRect(l, y, Math.max(1, r - l), 1);
  }
}

// ── The room ────────────────────────────────────────────────────────────────

export interface RoomOpts {
  theme: 'light' | 'dark';
  hoverSlot: number | null;
  gantt: GanttBar[];
}

export function paintRoom(ctx: Ctx, o: RoomOpts): void {
  const p = roomPalette(o.theme);
  ctx.imageSmoothingEnabled = false;

  px(ctx, 0, 0, ROOM_W, ROOM_H, p.wall);

  drawBackWall(ctx, p);
  drawWindow(ctx, p, 15, 12, 185, 80);
  drawWallDressing(ctx, p);
  drawShelf(ctx, p, 300, 12, 162, 80);
  drawPendant(ctx, p, 232);
  drawDesk(ctx, p);
  drawMonitors(ctx, p, o);
  drawDeskObjects(ctx, p);
  drawFloor(ctx, p);
  drawChair(ctx, p);
  drawVignette(ctx, p);
}

function drawBackWall(ctx: Ctx, p: RoomPal) {
  px(ctx, 0, 0, ROOM_W, WALL_BOTTOM, p.wall);
  // Corner shading: the room is lit by the screens, so the edges fall away.
  dither(ctx, 0, 0, 44, WALL_BOTTOM, p.wallDark, 11);
  dither(ctx, ROOM_W - 40, 0, 40, WALL_BOTTOM, p.wallDark, 11);
  dither(ctx, 0, 0, ROOM_W, 14, p.wallDark, 8);
  // Screen spill on the wall behind the monitor array.
  dither(ctx, MON.x0 - 14, MON.y0 - 16, MON.w * 5 + MON.gap * 4 + 28, 30, p.wallLit, 6);
  // Skirting where the wall meets the desk line.
  px(ctx, 0, WALL_BOTTOM - 2, ROOM_W, 2, p.wallDark);
}

/** The window: a city seen through mullioned glass. The brightest thing in the room
 *  besides the screens, and what makes the room feel like it is somewhere. */
function drawWindow(ctx: Ctx, p: RoomPal, x: number, y: number, w: number, h: number) {
  px(ctx, x, y, w, h, p.glass);

  const ix = x + 3, iy = y + 3, iw = w - 6, ih = h - 6;

  // Skyline: blocks marching across, nearer ones lighter, each with lit windows.
  let bx = ix;
  let i = 0;
  while (bx < ix + iw) {
    const bw = 9 + Math.floor(hash(i * 3.1) * 13);
    const bh = 18 + Math.floor(hash(i * 5.7) * 44);
    const near = hash(i * 2.3) > 0.55;
    const by = iy + ih - bh;
    const cw = Math.min(bw, ix + iw - bx);
    px(ctx, bx, by, cw, bh, near ? p.cityHi : p.city);
    // roof line
    px(ctx, bx, by, cw, 1, p.line);

    // Lit windows on a 4px pitch — the cyberpunk glow.
    for (let wy = by + 3; wy < iy + ih - 2; wy += 4) {
      for (let wx = bx + 2; wx < bx + cw - 2; wx += 4) {
        const r = hash(wx * 7.3 + wy * 13.9 + i);
        if (r > 0.62) {
          px(ctx, wx, wy, 2, 2, r > 0.9 ? p.cityLitHi : p.cityLit);
        }
      }
    }
    bx += bw;
    i++;
  }

  // Haze at the base of the city, so the skyline sits in air.
  dither(ctx, ix, iy + ih - 10, iw, 10, p.glass, 7);

  // Mullions over the glass — this is what makes it read as a WINDOW.
  const mull = [Math.round(x + w * 0.34), Math.round(x + w * 0.67)];
  for (const mx of mull) px(ctx, mx, iy, 2, ih, p.line);
  px(ctx, ix, Math.round(y + h * 0.46), iw, 2, p.line);

  // Frame, and a lit inner sill.
  outline(ctx, x, y, w, h, p.line);
  outline(ctx, x + 1, y + 1, w - 2, h - 2, p.wallDark);
  px(ctx, x, y + h - 3, w, 3, p.line);
  px(ctx, x + 1, y + h - 3, w - 2, 1, p.lineHi);
}

/** Two framed pictures and a wall vent in the band between window and shelf —
 *  density is what separates a room from a stage set. */
function drawWallDressing(ctx: Ctx, p: RoomPal) {
  // Vent, echoing the reference's AC unit.
  const vx = 210, vy = 16, vw = 34, vh = 18;
  px(ctx, vx, vy, vw, vh, p.wallDark);
  outline(ctx, vx, vy, vw, vh, p.line);
  for (let i = 0; i < 5; i++) px(ctx, vx + 3, vy + 3 + i * 3, vw - 6, 1, p.line);

  // Framed print — a mountain, the site's one recurring motif.
  const fx = 208, fy = 42, fw = 38, fh = 30;
  px(ctx, fx, fy, fw, fh, p.wallDark);
  outline(ctx, fx, fy, fw, fh, p.line);
  px(ctx, fx + 2, fy + 2, fw - 4, fh - 4, p.glass);
  // peaks
  for (let i = 0; i < 3; i++) {
    const pkx = fx + 6 + i * 9, pky = fy + 22 - i * 3;
    for (let k = 0; k < 8; k++) px(ctx, pkx + k, pky - Math.min(k, 8 - k), 1, fy + fh - 3 - (pky - Math.min(k, 8 - k)), p.line);
  }
  px(ctx, fx + 2, fy + fh - 4, fw - 4, 2, p.lineHi);

  // Small square print
  const sx = 256, sy = 46, s = 22;
  px(ctx, sx, sy, s, s, p.wallDark);
  outline(ctx, sx, sy, s, s, p.line);
  px(ctx, sx + 2, sy + 2, s - 4, s - 4, p.glass);
  px(ctx, sx + 8, sy + 7, 6, 6, p.cityLit);       // a small red sun
  px(ctx, sx + 3, sy + s - 6, s - 6, 1, p.line);
}

/** Shelving with objects: mugs, books, a plant, a plate. Clutter reads as lived-in. */
function drawShelf(ctx: Ctx, p: RoomPal, x: number, y: number, w: number, h: number) {
  // uprights + shelves
  px(ctx, x, y, 2, h, p.line);
  px(ctx, x + w - 2, y, 2, h, p.line);
  const rows = [y + 2, y + Math.round(h * 0.42), y + h - 2];
  for (const ry of rows) {
    px(ctx, x, ry, w, 2, p.line);
    px(ctx, x + 1, ry, w - 2, 1, p.lineHi);
  }

  const shelfA = rows[0] + 2, shelfB = rows[1] + 2;

  // Top shelf: books leaning, a plate on edge.
  let bx = x + 6;
  for (let i = 0; i < 6; i++) {
    const bh = 14 + Math.floor(hash(i * 9.1) * 8);
    const bw = 3 + Math.floor(hash(i * 4.7) * 3);
    const yb = rows[1] - bh;
    px(ctx, bx, yb, bw, bh, i % 2 ? p.wallLit : p.city);
    outline(ctx, bx, yb, bw, bh, p.line);
    bx += bw + 1;
  }
  // plate on edge
  const plx = x + 46, ply = rows[1] - 20;
  outline(ctx, plx, ply, 18, 18, p.line);
  outline(ctx, plx + 3, ply + 3, 12, 12, p.wallLit);

  // A potted plant, drooping — the one soft silhouette in a room of boxes.
  const px0 = x + 78;
  px(ctx, px0, rows[1] - 9, 12, 9, p.wallLit);
  outline(ctx, px0, rows[1] - 9, 12, 9, p.line);
  for (let i = 0; i < 5; i++) {
    const lx = px0 + 1 + i * 2, ll = 5 + Math.floor(hash(i * 21.3) * 7);
    px(ctx, lx, rows[1] - 9 - ll, 1, ll, p.line);
    px(ctx, lx - (i % 2 ? 1 : 0), rows[1] - 9 - ll, 2, 1, p.lineHi);
  }

  // Bottom shelf: two mugs and a stack of paper.
  for (let i = 0; i < 2; i++) {
    const mx = x + 10 + i * 20, my = rows[2] - 11;
    px(ctx, mx, my, 10, 11, p.wallLit);
    outline(ctx, mx, my, 10, 11, p.line);
    px(ctx, mx + 1, my, 8, 1, p.lineHi);
    px(ctx, mx + 10, my + 3, 2, 4, p.line);   // handle
  }
  const stx = x + 60, sty = rows[2] - 8;
  for (let i = 0; i < 4; i++) px(ctx, stx + i, sty + i * 2, 34 - i * 2, 2, i % 2 ? p.paper : p.dim);

  void shelfA; void shelfB;
}

/** A pendant lamp with a warm pool of light — the reference's hanging lamps are a
 *  big part of why that room feels occupied. */
function drawPendant(ctx: Ctx, p: RoomPal, cx: number) {
  px(ctx, cx, 0, 1, 8, p.line);
  px(ctx, cx - 5, 8, 11, 5, p.wallDark);
  outline(ctx, cx - 5, 8, 11, 5, p.line);
  px(ctx, cx - 3, 12, 7, 1, p.cityLitHi);
  // light falls off downward
  for (let i = 0; i < 5; i++) {
    dither(ctx, cx - 6 - i * 3, 13 + i * 4, 13 + i * 6, 4, p.cityLitHi, 4 - Math.min(3, i));
  }
}

function drawDesk(ctx: Ctx, p: RoomPal) {
  // Top surface: wider at the front, so it reads as receding.
  trapezoid(ctx, WALL_BOTTOM, DESK_FRONT, 24, ROOM_W - 24, 2, ROOM_W - 2, p.deskTop);
  // Screen glow pooling on the surface under the monitors.
  dither(ctx, 40, WALL_BOTTOM, ROOM_W - 80, 26, p.wallLit, 7);
  dither(ctx, 70, WALL_BOTTOM, 340, 14, p.deskLip, 4);
  // Grain, so a big flat area is not dead.
  dither(ctx, 4, WALL_BOTTOM + 4, ROOM_W - 8, DESK_FRONT - WALL_BOTTOM - 4, p.wallDark, 3);
  // The back seam where desk meets wall.
  px(ctx, 24, WALL_BOTTOM, ROOM_W - 48, 1, p.line);
  // The lit front lip — a plane only reads as a surface once its near edge catches light.
  trapezoid(ctx, DESK_FRONT, LIP_BOTTOM, 2, ROOM_W - 2, 0, ROOM_W, p.deskLip);
  px(ctx, 0, DESK_FRONT, ROOM_W, 1, p.lineHi);
  px(ctx, 0, LIP_BOTTOM - 1, ROOM_W, 1, p.void);
}

function drawMonitors(ctx: Ctx, p: RoomPal, o: RoomOpts) {
  for (let slot = 0; slot < MONITOR_COUNT; slot++) {
    const mx = MON.x0 + slot * (MON.w + MON.gap);
    const hot = o.hoverSlot === slot;

    // Stand, behind the monitor body.
    px(ctx, mx + MON.w / 2 - 3, MON.y0 + MON.h, 6, 5, p.wallDark);
    px(ctx, mx + MON.w / 2 - 9, MON.y0 + MON.h + 5, 18, 2, p.line);

    // Bezel: dark body, lit top edge, dark bottom edge. The ridge is the read.
    px(ctx, mx, MON.y0, MON.w, MON.h, p.wallDark);
    outline(ctx, mx, MON.y0, MON.w, MON.h, p.line);
    px(ctx, mx + 1, MON.y0 + 1, MON.w - 2, 1, p.lineHi);

    const s = screenBox(slot);
    px(ctx, s.x, s.y, s.w, s.h, p.screenBg);
    drawScreen(ctx, p, slot, s, o.gantt);

    if (hot) {
      outline(ctx, mx - 1, MON.y0 - 1, MON.w + 2, MON.h + 2, p.accent);
      dither(ctx, mx - 5, MON.y0 - 4, MON.w + 10, MON.h + 10, p.accent, 3);
    }
  }
}

/** Screen content, iconic. Recognisable at a glance, no readable prose. */
function drawScreen(
  ctx: Ctx, p: RoomPal, slot: number,
  s: { x: number; y: number; w: number; h: number }, gantt: GanttBar[],
) {
  if (slot === 0) {
    // IDE: real token lengths and kinds from the honest code snippet, rendered as
    // coloured bars. The SHAPE of code, which is what you actually recognise.
    const lines = ideLines().slice(0, 11);
    px(ctx, s.x, s.y, 4, s.h, p.wallDark);
    lines.forEach((ln, i) => {
      const y = s.y + 2 + i * 4;
      if (y > s.y + s.h - 3) return;
      px(ctx, s.x + 1, y + 1, 2, 1, p.dim);
      let x = s.x + 6 + ln.indent * 3;
      for (const t of ln.tokens) {
        const w = Math.max(1, Math.round(t.text.length * 0.9));
        if (x + w > s.x + s.w - 1) break;
        const c = t.kind === 'kw' ? p.accent
          : t.kind === 'str' ? p.seal
          : t.kind === 'num' ? p.lineHi
          : t.kind === 'comment' ? p.dim
          : p.paper;
        px(ctx, x, y + 1, w, 2, c);
        x += w + 1;
      }
    });
  } else if (slot === 1) {
    // Backtest: grid + the seeded equity curve, with its drawdowns visible.
    for (let i = 1; i < 4; i++) px(ctx, s.x + 1, s.y + Math.round((s.h / 4) * i), s.w - 2, 1, p.wallDark);
    const pts = backtestCurve(s.w - 4);
    let prevY = -1;
    pts.forEach((pt, i) => {
      const x = s.x + 2 + i;
      const y = s.y + 2 + Math.round((1 - pt.y) * (s.h - 6));
      px(ctx, x, y, 1, 2, p.accent);
      // join steep moves so the line never breaks
      if (prevY >= 0 && Math.abs(y - prevY) > 1) {
        const lo = Math.min(y, prevY), hi = Math.max(y, prevY);
        px(ctx, x, lo, 1, hi - lo, p.accent);
      }
      prevY = y;
      dither(ctx, x, y + 2, 1, s.y + s.h - 2 - (y + 2), p.accent, 3);
    });
  } else if (slot === 2) {
    // Gantt: real career spans as bars. Education indigo-ish, roles accent.
    const bars = gantt.slice(0, 6);
    if (!bars.length) return;
    const lo = Math.min(...bars.map((b) => b.start));
    const hi = Math.max(...bars.map((b) => b.end));
    const span = Math.max(1, hi - lo);
    bars.forEach((b, i) => {
      const y = s.y + 3 + i * 7;
      if (y > s.y + s.h - 4) return;
      px(ctx, s.x + 2, y, 10, 2, p.dim);                       // label stub
      const x0 = s.x + 14 + Math.round(((b.start - lo) / span) * (s.w - 18));
      const x1 = s.x + 14 + Math.round(((b.end - lo) / span) * (s.w - 18));
      px(ctx, x0, y, Math.max(2, x1 - x0), 3, b.kind === 'education' ? p.lineHi : p.accent);
    });
  } else if (slot === 3) {
    // LaTeX: a page of centred prose with one display equation. Reads as a paper.
    const cx = s.x + s.w / 2;
    px(ctx, cx - 12, s.y + 4, 24, 2, p.paper);                 // title
    const widths = [40, 44, 38, 0, 26, 42, 40, 34];
    widths.forEach((w, i) => {
      const y = s.y + 11 + i * 4;
      if (y > s.y + s.h - 3) return;
      if (w === 0) return;
      if (i === 4) {                                            // the equation, centred
        px(ctx, cx - w / 2, y, w, 3, p.accent);
        return;
      }
      px(ctx, s.x + 4, y, Math.min(w, s.w - 8), 2, p.dim);
    });
  } else {
    // Market panel: header band, then rows of ticker stub + value + change.
    const rows = bloombergRows().slice(0, 8);
    px(ctx, s.x, s.y, s.w, 5, p.accent);
    px(ctx, s.x + 1, s.y + 1, s.w - 2, 3, p.screenBg);
    px(ctx, s.x + 2, s.y + 2, 18, 1, p.accent);
    rows.forEach((r, i) => {
      const y = s.y + 7 + i * 5;
      if (y > s.y + s.h - 3) return;
      px(ctx, s.x + 2, y, 11, 2, p.accent);                    // ticker
      px(ctx, s.x + 16, y, 20, 2, p.paper);                    // last
      px(ctx, s.x + 40, y, 14, 2, r.up ? p.accent : p.seal);   // change
    });
  }
}

function drawDeskObjects(ctx: Ctx, p: RoomPal) {
  // Keyboard: a key grid. The grid is what makes it a keyboard and not a slab.
  const kx = 152, ky = 170, kw = 152, kh = 26;
  trapezoid(ctx, ky, ky + kh, kx + 6, kx + kw - 6, kx, kx + kw, p.wallLit);
  outline(ctx, kx, ky, kw, kh, p.line);
  px(ctx, kx + 4, ky + 1, kw - 8, 1, p.lineHi);
  for (let r = 0; r < 4; r++) {
    for (let cN = 0; cN < 17; cN++) {
      const x = kx + 8 + cN * 8 + r, y = ky + 4 + r * 5;
      if (x + 6 > kx + kw - 4) continue;
      px(ctx, x, y, 6, 3, p.wallDark);
      px(ctx, x, y, 6, 1, p.line);
    }
  }
  // Mouse: body, seam, scroll wheel.
  const mx = 318, my = 172, mw = 16, mh = 22;
  px(ctx, mx + 1, my, mw - 2, mh, p.wallLit);
  px(ctx, mx, my + 3, mw, mh - 6, p.wallLit);
  outline(ctx, mx + 1, my, mw - 2, mh, p.line);
  px(ctx, mx + Math.round(mw / 2) - 1, my + 2, 2, 7, p.line);   // wheel
  px(ctx, mx + 2, my + 10, mw - 4, 1, p.line);                  // seam

  // Coffee: cup with a rim and a handle, plus two steam pixels.
  const cx = 104, cy = 158, cw = 17, ch = 22;
  px(ctx, cx, cy + 3, cw, ch - 3, p.paper);
  outline(ctx, cx, cy + 3, cw, ch - 3, p.line);
  px(ctx, cx + 1, cy + 1, cw - 2, 4, p.lineHi);                 // rim ellipse, flattened
  px(ctx, cx + 3, cy + 2, cw - 6, 2, p.wallDark);               // the coffee
  px(ctx, cx + cw, cy + 8, 3, 7, p.paper);                      // handle
  px(ctx, cx + cw + 1, cy + 9, 1, 5, p.wallDark);
  px(ctx, cx + 5, cy - 4, 1, 3, p.dim);
  px(ctx, cx + 10, cy - 7, 1, 4, p.dim);

  // Fanned papers: offset sheet edges, each lit on top. A body of work, not a slab.
  const ppx = 352, ppy = 160;
  for (let i = 5; i >= 0; i--) {
    const x = ppx + i * 3, y = ppy + i * 2, w = 52 - i * 2, h = 16;
    px(ctx, x, y, w, h, p.paper);
    outline(ctx, x, y, w, h, p.line);
    px(ctx, x + 1, y, w - 2, 1, p.lineHi);
    if (i === 0) {   // top sheet carries a few text rules and a formula
      for (let k = 0; k < 4; k++) px(ctx, x + 4, y + 3 + k * 3, w - 8 - k * 4, 1, p.dim);
      px(ctx, x + 4, y + 12, 14, 2, p.accent);
    }
  }

  // Plush cow: body, head, legs, ears, patches. Blocky and cute, not detailed.
  const wx = 62, wy = 150, ww = 30, wh = 20;
  px(ctx, wx + 2, wy + 4, ww - 4, wh - 8, p.paper);            // body
  outline(ctx, wx + 2, wy + 4, ww - 4, wh - 8, p.line);
  px(ctx, wx + ww - 10, wy, 10, 9, p.paper);                    // head
  outline(ctx, wx + ww - 10, wy, 10, 9, p.line);
  px(ctx, wx + ww - 11, wy + 1, 2, 2, p.line);                  // ears
  px(ctx, wx + ww, wy + 1, 2, 2, p.line);
  px(ctx, wx + ww - 8, wy + 4, 1, 1, p.wallDark);               // eyes
  px(ctx, wx + ww - 4, wy + 4, 1, 1, p.wallDark);
  px(ctx, wx + ww - 8, wy + 7, 6, 2, p.cityLit);                // muzzle
  px(ctx, wx + 5, wy + 7, 6, 4, p.wallDark);                    // patches
  px(ctx, wx + 14, wy + 10, 5, 3, p.wallDark);
  for (let i = 0; i < 3; i++) px(ctx, wx + 4 + i * 8, wy + wh - 4, 3, 4, p.paper);
  for (let i = 0; i < 3; i++) outline(ctx, wx + 4 + i * 8, wy + wh - 4, 3, 4, p.line);
}

function drawFloor(ctx: Ctx, p: RoomPal) {
  px(ctx, 0, LIP_BOTTOM, ROOM_W, ROOM_H - LIP_BOTTOM, p.wallDark);
  // Light pooling out from under the desk.
  dither(ctx, 0, LIP_BOTTOM, ROOM_W, 22, p.wall, 6);
  dither(ctx, 60, LIP_BOTTOM, 360, 14, p.wallLit, 4);
  // Board seams, converging slightly — enough perspective to read as a floor.
  for (let i = 0; i < 7; i++) {
    const x = Math.round(ROOM_W * (i / 6));
    const drift = Math.round((x - ROOM_W / 2) * 0.10);
    for (let y = LIP_BOTTOM; y < FLOOR_BOTTOM; y++) {
      const t = (y - LIP_BOTTOM) / (FLOOR_BOTTOM - LIP_BOTTOM);
      px(ctx, x + Math.round(drift * t), y, 1, 1, p.void);
    }
  }
}

/** The chair back, seen from behind — the strongest cue that YOU are the one sitting
 *  here. Foreground silhouette, darkest value in the room. */
function drawChair(ctx: Ctx, p: RoomPal) {
  const cx = 240, w = 116, top = 196, bot = ROOM_H;
  const x = cx - w / 2;
  // back panel with rounded shoulders
  for (let y = top; y < bot; y++) {
    const t = (y - top) / 26;
    const inset = y < top + 26 ? Math.round(10 * (1 - t) * (1 - t)) : 0;
    px(ctx, x + inset, y, w - inset * 2, 1, p.void);
  }
  // rim light along the top and left, so it separates from the floor
  for (let i = 0; i < w; i++) {
    const t = i / w;
    const inset = Math.round(10 * (1 - Math.min(1, t * 2)) ** 2);
    void inset;
  }
  px(ctx, x + 10, top, w - 20, 1, p.line);
  px(ctx, x + 6, top + 1, 4, 1, p.line);
  px(ctx, x + w - 10, top + 1, 4, 1, p.line);
  px(ctx, x, top + 26, 1, bot - top - 26, p.line);
  px(ctx, x + w - 1, top + 26, 1, bot - top - 26, p.line);
  // a seam and headrest gap
  px(ctx, x + 14, top + 22, w - 28, 1, p.line);
  dither(ctx, x + 2, top + 4, w - 4, 18, p.wallDark, 3);
  // armrests
  px(ctx, x - 16, top + 40, 18, 5, p.void);
  px(ctx, x - 16, top + 40, 18, 1, p.line);
  px(ctx, x + w - 2, top + 40, 18, 5, p.void);
  px(ctx, x + w - 2, top + 40, 18, 1, p.line);
}

/** Corner falloff, and the bottom band that dissolves into the page so the room has
 *  no hard bottom edge to give itself away. */
function drawVignette(ctx: Ctx, p: RoomPal) {
  dither(ctx, 0, FLOOR_BOTTOM, ROOM_W, ROOM_H - FLOOR_BOTTOM, p.void, 10);
  px(ctx, 0, ROOM_H - 8, ROOM_W, 8, p.void);
  dither(ctx, 0, 0, 26, ROOM_H, p.void, 7);
  dither(ctx, ROOM_W - 26, 0, 26, ROOM_H, p.void, 7);
}
