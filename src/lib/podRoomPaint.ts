// src/lib/podRoomPaint.ts
// Paints the pod room into its low-res buffer. The ONLY file here that touches canvas
// APIs; the layout and palette are pure data in podRoom.ts.
//
// THE THREE THINGS THAT MAKE THIS READ AS A TRADING FLOOR AND NOT A BEDROOM:
//
// 1. VOLUME. Every object is extruded: a front face, a side face (dark, turned away
//    from the light) and a top face (lit). The side a box shows depends on which side of
//    the room's vanishing axis it sits on — that is one-point perspective, and it is
//    what the previous flat-rectangle version was missing.
// 2. A CEILING. The room is closed at the top, so it is an interior you are inside
//    rather than a wall floating in the page. Its dark band is also what lets the
//    descent's sky end cleanly against the room.
// 3. A RIG, not a row. Monitors stack on posts — three big primaries at eye level, four
//    smaller above — the way a real multi-monitor desk is actually built.
//
// Screens show ICONIC content: token-length bars, an equity curve, career spans, a
// paper's shape, market rows. Never readable prose. Fitting legible text into a screen
// this size is what produced every clipping bug in the previous implementation, and the
// real words live in HTML labels over the canvas where they stay selectable.

import {
  ROOM_W, ROOM_H, ROOM_CX, CEIL_TOP_VOID, CEIL_BOTTOM, WALL_BOTTOM, DESK_FRONT,
  APRON_BOTTOM, FLOOR_BOTTOM, MONITORS, CLOCKS, WINDOW, RACK, DESK_OBJECTS, rigFrame,
  sideDepth, roomPalette, type RoomPal, type MonitorPlace,
} from './podRoom';
import { ideLines, backtestCurve, bloombergRows, type GanttBar } from './podScreens';

type Ctx = CanvasRenderingContext2D;

// ── Primitives. Integer rects only — that IS the aesthetic. ──────────────────

const px = (ctx: Ctx, x: number, y: number, w: number, h: number, c: string) => {
  if (w <= 0 || h <= 0) return;
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};

/** 1px outline just inside the box — the line work that makes objects read. */
const outline = (ctx: Ctx, x: number, y: number, w: number, h: number, c: string) => {
  px(ctx, x, y, w, 1, c); px(ctx, x, y + h - 1, w, 1, c);
  px(ctx, x, y, 1, h, c); px(ctx, x + w - 1, y, 1, h, c);
};

/** Ordered (Bayer) dither: a gradient without blending, which is how pixel art shades.
 *  level 0..16 sets density. */
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
function dither(ctx: Ctx, x: number, y: number, w: number, h: number, c: string, level: number) {
  if (w <= 0 || h <= 0 || level <= 0) return;
  ctx.fillStyle = c;
  const x0 = Math.round(x), y0 = Math.round(y), w0 = Math.round(w), h0 = Math.round(h);
  for (let j = 0; j < h0; j++) {
    const rowB = BAYER[(y0 + j) & 3];
    for (let i = 0; i < w0; i++) if (rowB[(x0 + i) & 3] < level) ctx.fillRect(x0 + i, y0 + j, 1, 1);
  }
}

/** A vertical dithered ramp between two levels — used for wall falloff and glow pools. */
function ramp(ctx: Ctx, x: number, y: number, w: number, h: number, c: string, from: number, to: number) {
  const steps = Math.max(1, Math.round(h / 4));
  for (let s = 0; s < steps; s++) {
    const t = s / Math.max(1, steps - 1);
    dither(ctx, x, y + (h * s) / steps, w, Math.ceil(h / steps), c, Math.round(from + (to - from) * t));
  }
}

/**
 * An extruded box: front face, one side face, one top face.
 *
 * The side face is drawn on whichever side faces the viewer given the box's position
 * relative to the room's vanishing axis, and it SLANTS — its far edge is inset
 * vertically — so the box recedes instead of looking like two glued rectangles.
 */
function box(
  ctx: Ctx, p: RoomPal, x: number, y: number, w: number, h: number,
  depth: number, faces: { front: string; side: string; top: string },
  opts: { line?: string; lit?: boolean } = {},
) {
  const d = sideDepth(x + w / 2, 26, Math.max(3, depth));
  const dz = Math.max(2, Math.round(depth * 0.55));   // vertical rise of the top face
  const lineC = opts.line ?? p.line;

  // Top face: a parallelogram, offset toward the vanishing point.
  ctx.fillStyle = faces.top;
  for (let i = 0; i < dz; i++) {
    const t = i / Math.max(1, dz);
    const off = Math.round(d * t);
    ctx.fillRect(Math.round(x + off), Math.round(y - dz + i), Math.round(w), 1);
  }

  // Side face: on the far side from the axis, slanting up toward the vanishing point.
  const sideW = Math.abs(d);
  if (sideW > 0) {
    ctx.fillStyle = faces.side;
    const sx = d < 0 ? x + w : x - sideW;      // left of axis -> right face, and vice versa
    for (let i = 0; i < sideW; i++) {
      const t = (i + 1) / sideW;
      const rise = Math.round(dz * t);
      const col = d < 0 ? sx + i : sx + (sideW - 1 - i);
      ctx.fillRect(Math.round(col), Math.round(y - rise), 1, Math.round(h + rise));
    }
  }

  // Front face last, so it occludes the extrusion cleanly.
  px(ctx, x, y, w, h, faces.front);
  outline(ctx, x, y, w, h, lineC);
  // Lit top edge of the front face — the single strongest volume cue.
  if (opts.lit !== false) px(ctx, x + 1, y, w - 2, 1, p.lineHi);
}

/** Deterministic pseudo-random in [0,1). No Math.random(): the room repaints on hover
 *  and theme change, and fresh randomness per repaint would make the city flicker. */
function hash(i: number): number {
  const h = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return h - Math.floor(h);
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

/** A closed ceiling with recessed troffers and a cable tray. Its dark upper band is
 *  where the descent's sky lands, so the room has no hard top edge. */
function drawCeiling(ctx: Ctx, p: RoomPal) {
  px(ctx, 0, 0, ROOM_W, CEIL_BOTTOM, p.wallDark);
  px(ctx, 0, 0, ROOM_W, CEIL_TOP_VOID, p.void);
  ramp(ctx, 0, CEIL_TOP_VOID, ROOM_W, 22, p.void, 12, 2);

  // Perspective: ceiling seams converge toward the vanishing axis.
  for (let i = 0; i <= 8; i++) {
    const xTop = Math.round((ROOM_W / 8) * i);
    const xBot = Math.round(ROOM_CX + (xTop - ROOM_CX) * 1.35);
    const span = CEIL_BOTTOM - CEIL_TOP_VOID;
    for (let s = 0; s < span; s++) {
      const t = s / span;
      px(ctx, xTop + (xBot - xTop) * t, CEIL_TOP_VOID + s, 1, 1, p.wallDark);
    }
  }

  // One row of recessed troffers, set INTO the ceiling plane: a dark housing, a lit
  // panel inside it, and spill below. A trading floor is lit by rows of these, and they
  // are the cue that this is an office and not a bedroom. They must read as recessed —
  // floating bright bars look like a bug, which is what a first pass here looked like.
  const lw = 96, gap = 28, count = 5;
  const x0 = Math.round((ROOM_W - (count * lw + (count - 1) * gap)) / 2);
  for (let i = 0; i < count; i++) {
    const x = x0 + i * (lw + gap), cy = 26, ch = 12;
    // housing, with a visible lip so the panel sits inside it
    px(ctx, x - 2, cy - 2, lw + 4, ch + 4, p.metalDark);
    outline(ctx, x - 2, cy - 2, lw + 4, ch + 4, p.line);
    px(ctx, x, cy, lw, ch, p.void);
    // the lit panel — brightest at its centre, dithered out to the ends
    px(ctx, x + 2, cy + 3, lw - 4, ch - 6, p.lineHi);
    dither(ctx, x + 2, cy + 3, lw - 4, ch - 6, p.cityLitHi, 9);
    px(ctx, x + Math.round(lw * 0.25), cy + 4, Math.round(lw * 0.5), ch - 8, p.cityLitHi);
    // spill onto the ceiling below the fitting
    ramp(ctx, x - 8, cy + ch + 2, lw + 16, 18, p.wallLit, 7, 0);
  }

  // Cable tray running the width, just under the ceiling.
  px(ctx, 0, CEIL_BOTTOM - 8, ROOM_W, 5, p.metalDark);
  px(ctx, 0, CEIL_BOTTOM - 8, ROOM_W, 1, p.line);
  for (let x = 6; x < ROOM_W; x += 26) px(ctx, x, CEIL_BOTTOM - 7, 2, 3, p.line);
  px(ctx, 0, CEIL_BOTTOM - 3, ROOM_W, 3, p.wallDark);
  px(ctx, 0, CEIL_BOTTOM - 1, ROOM_W, 1, p.line);
}

function drawBackWall(ctx: Ctx, p: RoomPal) {
  px(ctx, 0, CEIL_BOTTOM, ROOM_W, WALL_BOTTOM - CEIL_BOTTOM, p.wall);
  // Falloff into the corners: the room is lit by its screens, so edges die.
  ramp(ctx, 0, CEIL_BOTTOM, 70, WALL_BOTTOM - CEIL_BOTTOM, p.wallDark, 13, 4);
  ramp(ctx, ROOM_W - 70, CEIL_BOTTOM, 70, WALL_BOTTOM - CEIL_BOTTOM, p.wallDark, 13, 4);
  // Screen spill behind the rig.
  dither(ctx, 130, 96, 560, 190, p.wallLit, 5);
  dither(ctx, 170, 130, 470, 150, p.wallLit, 4);
  // Faint acoustic-panel grid, so a big flat wall is not dead.
  for (let x = 0; x < ROOM_W; x += 48) px(ctx, x, CEIL_BOTTOM, 1, WALL_BOTTOM - CEIL_BOTTOM, p.wallDark);
  for (let y = CEIL_BOTTOM; y < WALL_BOTTOM; y += 48) px(ctx, 0, y, ROOM_W, 1, p.wallDark);
}

/** The city through mullioned glass — the brightest thing besides the screens, and what
 *  places the room somewhere. Tall and narrow on the left, so the composition is
 *  asymmetric rather than a symmetrical stage set. */
function drawWindow(ctx: Ctx, p: RoomPal) {
  const { x, y, w, h } = WINDOW;
  px(ctx, x, y, w, h, p.glass);
  const ix = x + 4, iy = y + 4, iw = w - 8, ih = h - 8;

  // Skyline: blocks marching across, nearer ones lighter, lit windows on a 5px pitch.
  let bx = ix, i = 0;
  while (bx < ix + iw) {
    const bw = 12 + Math.floor(hash(i * 3.1) * 18);
    const bh = 40 + Math.floor(hash(i * 5.7) * 88);
    const near = hash(i * 2.3) > 0.5;
    const by = iy + ih - bh;
    const cw = Math.min(bw, ix + iw - bx);
    px(ctx, bx, by, cw, bh, near ? p.cityHi : p.city);
    px(ctx, bx, by, cw, 1, p.line);
    // an aerial on some roofs
    if (hash(i * 8.9) > 0.7) px(ctx, bx + Math.round(cw / 2), by - 6, 1, 6, p.line);
    for (let wy = by + 4; wy < iy + ih - 3; wy += 5) {
      for (let wx = bx + 3; wx < bx + cw - 3; wx += 5) {
        const r = hash(wx * 7.3 + wy * 13.9 + i);
        if (r > 0.58) px(ctx, wx, wy, 2, 3, r > 0.9 ? p.cityLitHi : p.cityLit);
      }
    }
    bx += bw; i++;
  }
  // Haze at the base, so the skyline sits in air.
  ramp(ctx, ix, iy + ih - 26, iw, 26, p.glass, 2, 12);

  // Mullions — this is what makes it read as a window and not a picture.
  for (const my of [iy + Math.round(ih * 0.3), iy + Math.round(ih * 0.62)]) px(ctx, ix, my, iw, 2, p.line);
  px(ctx, x + Math.round(w * 0.5) - 1, iy, 2, ih, p.line);

  // Frame, with a lit sill — a reveal, so the wall has thickness at the opening.
  outline(ctx, x, y, w, h, p.line);
  outline(ctx, x + 2, y + 2, w - 4, h - 4, p.wallDark);
  px(ctx, x, y + h - 5, w + 6, 5, p.metal);
  px(ctx, x, y + h - 5, w + 6, 1, p.lineHi);
  px(ctx, x + w, y, 4, h - 5, p.wallDark);
}

/** Three wall clocks — LDN / NYC / TYO. A trading-floor signature in one small object. */
function drawClocks(ctx: Ctx, p: RoomPal) {
  const { x, y, w, h, count } = CLOCKS;
  const cw = Math.floor((w - (count - 1) * 6) / count);
  for (let i = 0; i < count; i++) {
    const cx = x + i * (cw + 6);
    px(ctx, cx, y, cw, h, p.metalDark);
    outline(ctx, cx, y, cw, h, p.line);
    px(ctx, cx + 1, y + 1, cw - 2, 1, p.lineHi);
    // face + two hands, each clock at a different hour (three time zones)
    const fx = cx + 3, fy = y + 4, fw = cw - 6, fh = h - 8;
    px(ctx, fx, fy, fw, fh, p.screenBg);
    const mx = fx + Math.round(fw / 2), my = fy + Math.round(fh / 2);
    px(ctx, mx, my - 4, 1, 5, p.accent);
    px(ctx, mx, my, 3 + i, 1, p.paper);
    px(ctx, mx - 1, my - 1, 2, 2, p.lineHi);
  }
}

/** A server rack on the right: blinking status LEDs and vents. Balances the window. */
function drawRack(ctx: Ctx, p: RoomPal) {
  const { x, y, w, h } = RACK;
  box(ctx, p, x, y, w, h, 8, { front: p.metalDark, side: p.void, top: p.metal });
  for (let i = 0; i < 12; i++) {
    const uy = y + 6 + i * 16;
    if (uy + 12 > y + h - 4) break;
    px(ctx, x + 4, uy, w - 8, 12, p.metal);
    outline(ctx, x + 4, uy, w - 8, 12, p.line);
    // vent slots
    for (let k = 0; k < 5; k++) px(ctx, x + 8 + k * 6, uy + 3, 3, 6, p.metalDark);
    // status LEDs — deterministic, so they do not flicker between repaints
    const r = hash(i * 17.3);
    px(ctx, x + w - 12, uy + 3, 2, 2, r > 0.35 ? p.accent : p.metalDark);
    px(ctx, x + w - 12, uy + 7, 2, 2, r > 0.8 ? p.seal : p.metalDark);
  }
  dither(ctx, x - 10, y, 10, h, p.wallDark, 8);
}

/** The desk: a top surface with visible thickness, an apron, and the lit near edge that
 *  is what makes a plane read as a surface at all. */
function drawDesk(ctx: Ctx, p: RoomPal) {
  // Top surface. Trapezoid: wider at the front, so it recedes.
  const backInset = 34;
  const span = DESK_FRONT - WALL_BOTTOM;
  for (let i = 0; i < span; i++) {
    const t = i / span;
    const inset = Math.round(backInset * (1 - t));
    px(ctx, inset, WALL_BOTTOM + i, ROOM_W - inset * 2, 1, p.deskTop);
  }
  // Screen glow pooling on the surface, strongest right under the rig.
  ramp(ctx, 60, WALL_BOTTOM, ROOM_W - 120, 34, p.wallLit, 9, 1);
  dither(ctx, 150, WALL_BOTTOM, 500, 16, p.deskLip, 4);
  // Wood grain, so a large flat area is not dead.
  dither(ctx, 8, WALL_BOTTOM + 6, ROOM_W - 16, span - 6, p.wallDark, 2);
  // The back seam where the desk meets the wall.
  px(ctx, backInset, WALL_BOTTOM, ROOM_W - backInset * 2, 1, p.line);

  // Front apron — the desk's thickness. Without this the desk is a painted line, and
  // without a hard dark base the chair and floor merge into it.
  px(ctx, 0, DESK_FRONT, ROOM_W, APRON_BOTTOM - DESK_FRONT, p.deskSide);
  px(ctx, 0, DESK_FRONT, ROOM_W, 3, p.deskLip);     // the lit near edge — the top of the mass
  px(ctx, 0, DESK_FRONT, ROOM_W, 1, p.lineHi);
  // The apron falls off downward, then ends on two hard dark rows: that shadow line is
  // what separates desk from floor and stops the chair merging into it.
  ramp(ctx, 0, DESK_FRONT + 3, ROOM_W, APRON_BOTTOM - DESK_FRONT - 5, p.void, 2, 12);
  px(ctx, 0, APRON_BOTTOM - 2, ROOM_W, 2, p.void);
  // A kick rail below the apron, receding — the desk has legs, not a floating slab.
  for (const legX of [96, ROOM_W - 130]) {
    px(ctx, legX, APRON_BOTTOM, 26, 42, p.void);
    px(ctx, legX, APRON_BOTTOM, 26, 1, p.line);
  }
  // Cable pass-through grommets, and a modesty panel behind.
  for (const gx of [236, 560]) {
    px(ctx, gx, WALL_BOTTOM + 6, 26, 5, p.void);
    outline(ctx, gx, WALL_BOTTOM + 6, 26, 5, p.line);
  }
}

/** The monitor rig: posts rising off the desk, primaries at eye level, secondaries
 *  stacked above. Bezels are extruded so the screens sit IN something. */
function drawRig(ctx: Ctx, p: RoomPal, o: RoomOpts) {
  const r = rigFrame();

  // Two uprights running from the desk up past the secondary row, with feet.
  for (const postX of [r.postL, r.postR]) {
    px(ctx, postX, r.braceTop, r.postW, WALL_BOTTOM - r.braceTop, p.metalDark);
    px(ctx, postX, r.braceTop, 2, WALL_BOTTOM - r.braceTop, p.metal);   // lit edge
    px(ctx, postX - 11, WALL_BOTTOM - 5, r.postW + 22, 5, p.metalDark); // foot
    px(ctx, postX - 11, WALL_BOTTOM - 5, r.postW + 22, 1, p.line);
  }
  // The two cross-bars the monitors hang off.
  for (const barY of [r.barLowY, r.barHighY]) {
    px(ctx, r.postL - 8, barY, r.postR - r.postL + r.postW + 16, 6, p.metalDark);
    px(ctx, r.postL - 8, barY, r.postR - r.postL + r.postW + 16, 1, p.metal);
  }

  for (const m of MONITORS) drawMonitor(ctx, p, m, o);
}

function drawMonitor(ctx: Ctx, p: RoomPal, m: MonitorPlace, o: RoomOpts) {
  const hot = m.slot !== null && o.hoverSlot === m.slot;
  const d = m.kind === 'primary' ? 9 : 6;

  // Arm from the rig bar to the back of the monitor.
  const armY = m.y + Math.round(m.h / 2);
  const toward = m.x + m.w / 2 < ROOM_CX ? 1 : -1;
  px(ctx, m.x + m.w / 2 - 2, armY, 4, 8, p.metalDark);
  void toward;

  // Extruded bezel.
  box(ctx, p, m.x, m.y, m.w, m.h, d,
    { front: p.monFront, side: p.monSide, top: p.monTop });

  // Screen interior, inset by the bezel.
  const s = { x: m.x + m.bezel, y: m.y + m.bezel, w: m.w - m.bezel * 2, h: m.h - m.bezel * 2 };
  px(ctx, s.x, s.y, s.w, s.h, p.screenBg);
  // Inner bezel shadow, so the glass sits below the frame.
  px(ctx, s.x, s.y, s.w, 1, p.void);
  px(ctx, s.x, s.y, 1, s.h, p.void);

  if (m.slot !== null) drawScreen(ctx, p, m.slot, s, o.gantt);
  else drawAmbient(ctx, p, m.ambient!, s);

  // Glass sheen: a faint diagonal, the pixel-art way to say "this is glass".
  for (let i = 0; i < s.h; i += 2) {
    const gx = s.x + Math.round((i / s.h) * s.w * 0.5);
    px(ctx, gx, s.y + i, 2, 1, p.wallLit);
  }

  if (hot) {
    outline(ctx, m.x - 2, m.y - 2, m.w + 4, m.h + 4, p.accent);
    dither(ctx, m.x - 8, m.y - 8, m.w + 16, m.h + 16, p.accent, 3);
  }
}

/** Ambient screens: no link, no label — they exist so the wall reads as a working desk
 *  rather than exactly-as-many-monitors-as-there-are-destinations. */
function drawAmbient(
  ctx: Ctx, p: RoomPal, kind: 'heat' | 'tape',
  s: { x: number; y: number; w: number; h: number },
) {
  if (kind === 'heat') {
    // A correlation heatmap: the most recognisable quant screen there is.
    const cell = 6;
    const cols = Math.floor((s.w - 4) / cell), rows = Math.floor((s.h - 4) / cell);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const v = hash(r * 31.7 + c * 11.3);
        const onDiag = r === c;
        const col = onDiag ? p.paper : v > 0.72 ? p.accent : v > 0.45 ? p.dim : p.seal;
        px(ctx, s.x + 2 + c * cell, s.y + 2 + r * cell, cell - 1, cell - 1, col);
        if (!onDiag && v < 0.72 && v > 0.45) dither(ctx, s.x + 2 + c * cell, s.y + 2 + r * cell, cell - 1, cell - 1, p.screenBg, 8);
      }
    }
  } else {
    // A ticker tape: rows of scrolling stubs, alternating up/down.
    for (let r = 0; r < Math.floor((s.h - 4) / 7); r++) {
      const y = s.y + 3 + r * 7;
      let x = s.x + 2 + Math.round(hash(r * 5.1) * 8);
      while (x < s.x + s.w - 6) {
        const w = 6 + Math.floor(hash(x * 3.3 + r) * 10);
        px(ctx, x, y, Math.min(w, s.x + s.w - 3 - x), 3, hash(x * 9.7 + r) > 0.5 ? p.accent : p.seal);
        x += w + 4;
      }
    }
  }
}

/** Destination screens, ICONIC: recognisable at a glance, no readable prose. */
function drawScreen(
  ctx: Ctx, p: RoomPal, slot: number,
  s: { x: number; y: number; w: number; h: number }, gantt: GanttBar[],
) {
  if (slot === 0) {
    // IDE: real token lengths and kinds from the honest snippet, as coloured bars —
    // the SHAPE of code, which is what you actually recognise from across a room.
    const lines = ideLines();
    px(ctx, s.x, s.y, 10, s.h, p.void);
    const lh = Math.max(6, Math.floor((s.h - 6) / Math.max(1, lines.length)));
    lines.forEach((ln, i) => {
      const y = s.y + 4 + i * lh;
      if (y + 3 > s.y + s.h - 2) return;
      px(ctx, s.x + 3, y + 1, 4, 2, p.dim);                    // line number stub
      let x = s.x + 14 + ln.indent * 7;
      for (const t of ln.tokens) {
        const w = Math.max(2, Math.round(t.text.length * 2.1));
        if (x + w > s.x + s.w - 3) break;
        const c = t.kind === 'kw' ? p.accent : t.kind === 'str' ? p.seal
          : t.kind === 'num' ? p.lineHi : t.kind === 'comment' ? p.dim : p.paper;
        px(ctx, x, y, w, 3, c);
        x += w + 3;
      }
    });
    // A cursor block, so it reads as an editor with focus.
    px(ctx, s.x + 14, s.y + 4 + lines.length * lh, 4, 4, p.accent);
  } else if (slot === 1) {
    // Backtest: axes, grid, the seeded equity curve with its drawdowns, and a fill.
    for (let i = 1; i < 4; i++) px(ctx, s.x + 12, s.y + Math.round((s.h / 4) * i), s.w - 16, 1, p.wallDark);
    px(ctx, s.x + 10, s.y + 2, 1, s.h - 12, p.dim);            // y axis
    px(ctx, s.x + 10, s.y + s.h - 10, s.w - 14, 1, p.dim);     // x axis
    const plotW = s.w - 16, plotH = s.h - 16;
    const pts = backtestCurve(plotW);
    let prevY = -1;
    pts.forEach((pt, i) => {
      const x = s.x + 12 + i;
      const y = s.y + 4 + Math.round((1 - pt.y) * plotH);
      if (prevY >= 0 && Math.abs(y - prevY) > 1) {
        const lo = Math.min(y, prevY), hi = Math.max(y, prevY);
        px(ctx, x, lo, 2, hi - lo, p.accent);                  // join steep moves
      }
      px(ctx, x, y, 2, 2, p.accent);
      dither(ctx, x, y + 2, 1, s.y + s.h - 10 - y, p.accent, 3);
    });
    prevY = -1;
  } else if (slot === 2) {
    // Gantt: real career spans. Education reads lighter, roles take the accent.
    const bars = gantt.slice(0, 6);
    if (!bars.length) return;
    const lo = Math.min(...bars.map((b) => b.start));
    const hi = Math.max(...bars.map((b) => b.end));
    const span = Math.max(1, hi - lo);
    const rowH = Math.max(8, Math.floor((s.h - 8) / Math.max(1, bars.length)));
    // year gridlines
    for (let yr = 0; yr <= span; yr++) {
      const gx = s.x + 34 + Math.round((yr / span) * (s.w - 40));
      dither(ctx, gx, s.y + 2, 1, s.h - 6, p.wallLit, 8);
    }
    bars.forEach((b, i) => {
      const y = s.y + 5 + i * rowH;
      if (y + 4 > s.y + s.h - 2) return;
      px(ctx, s.x + 3, y + 1, 26, 3, p.dim);                   // label stub
      const x0 = s.x + 34 + Math.round(((b.start - lo) / span) * (s.w - 40));
      const x1 = s.x + 34 + Math.round(((b.end - lo) / span) * (s.w - 40));
      const w = Math.max(3, x1 - x0);
      px(ctx, x0, y, w, 5, b.kind === 'education' ? p.lineHi : p.accent);
      px(ctx, x0, y, w, 1, p.paper);
    });
  } else if (slot === 3) {
    // LaTeX: a page — title, two columns of rules, one centred display equation.
    px(ctx, s.x + 2, s.y + 2, s.w - 4, s.h - 4, p.wallDark);   // the page itself
    const cx = s.x + s.w / 2;
    px(ctx, cx - 26, s.y + 6, 52, 3, p.paper);                 // title
    px(ctx, cx - 14, s.y + 12, 28, 2, p.dim);                  // byline
    const widths = [56, 60, 52, 58, 0, 46, 58, 54, 40];
    widths.forEach((w, i) => {
      const y = s.y + 20 + i * 5;
      if (y + 2 > s.y + s.h - 3) return;
      if (w === 0) { px(ctx, cx - 22, y, 44, 3, p.accent); return; }   // the equation
      px(ctx, s.x + 6, y, Math.min(w, s.w - 12), 2, p.dim);
    });
  } else {
    // Market panel: header band, then rows of ticker / last / change.
    const rows = bloombergRows();
    px(ctx, s.x, s.y, s.w, 7, p.accent);
    px(ctx, s.x + 1, s.y + 1, s.w - 2, 5, p.screenBg);
    px(ctx, s.x + 3, s.y + 3, 26, 2, p.accent);
    const rowH = Math.max(6, Math.floor((s.h - 10) / Math.max(1, rows.length)));
    rows.forEach((r, i) => {
      const y = s.y + 9 + i * rowH;
      if (y + 3 > s.y + s.h - 2) return;
      px(ctx, s.x + 3, y, 14, 3, p.accent);                    // ticker
      px(ctx, s.x + 21, y, 24, 3, p.paper);                    // last
      px(ctx, s.x + 49, y, 16, 3, r.up ? p.accent : p.seal);   // change
      // a tiny sparkline at the right edge
      for (let k = 0; k < 8; k++) {
        const sh = 1 + Math.round(hash(i * 7.7 + k) * 3);
        px(ctx, s.x + 69 + k * 2, y + 3 - sh, 1, sh, r.up ? p.accent : p.seal);
      }
    });
  }
}

function drawDeskObjects(ctx: Ctx, p: RoomPal) {
  const O = DESK_OBJECTS;

  // Plush cow: extruded body, head, legs, ears, patches. Blocky and cute.
  const c = O.cow;
  box(ctx, p, c.x, c.y + 12, c.w, c.h - 16, 7, { front: p.paper, side: p.dim, top: p.paper });
  box(ctx, p, c.x + c.w - 20, c.y, 20, 18, 5, { front: p.paper, side: p.dim, top: p.paper });
  px(ctx, c.x + c.w - 23, c.y + 1, 4, 4, p.line);                 // ears
  px(ctx, c.x + c.w - 1, c.y + 1, 4, 4, p.line);
  px(ctx, c.x + c.w - 15, c.y + 7, 3, 3, p.void);                 // eyes
  px(ctx, c.x + c.w - 7, c.y + 7, 3, 3, p.void);
  px(ctx, c.x + c.w - 16, c.y + 13, 12, 4, p.cityLit);            // muzzle
  px(ctx, c.x + 8, c.y + 18, 13, 8, p.wallDark);                  // patches
  px(ctx, c.x + 26, c.y + 26, 11, 6, p.wallDark);
  for (let i = 0; i < 3; i++) {
    px(ctx, c.x + 6 + i * 16, c.y + c.h - 5, 6, 6, p.paper);
    outline(ctx, c.x + 6 + i * 16, c.y + c.h - 5, 6, 6, p.line);
  }

  // Coffee: a TAPERED mug — narrower at the base — with an elliptical rim, a dark
  // surface of coffee inside it, a handle and two steam pixels. The taper and the rim
  // are what make it a cup; drawn as a plain box it read as a grey brick.
  const k = O.coffee;
  const bodyTop = k.y + 8, bodyH = k.h - 10;
  for (let i = 0; i < bodyH; i++) {
    const t = i / bodyH;
    const inset = Math.round(3 * t);                              // taper toward the base
    px(ctx, k.x + inset, bodyTop + i, k.w - inset * 2, 1, p.paper);
    px(ctx, k.x + inset, bodyTop + i, 1, 1, p.line);              // outline both sides
    px(ctx, k.x + k.w - inset - 1, bodyTop + i, 1, 1, p.line);
  }
  px(ctx, k.x + 2, k.y + bodyH + 6, k.w - 4, 2, p.line);          // base
  // Handle: a ring, drawn as three sides so it reads as a loop with a hole.
  px(ctx, k.x + k.w - 1, k.y + 15, 8, 2, p.paper);
  px(ctx, k.x + k.w + 5, k.y + 15, 2, 11, p.paper);
  px(ctx, k.x + k.w - 1, k.y + 24, 8, 2, p.paper);
  outline(ctx, k.x + k.w - 1, k.y + 15, 9, 11, p.line);
  // Rim: an ellipse implied by two rows, with the coffee sunk inside it.
  px(ctx, k.x + 2, k.y + 4, k.w - 4, 5, p.lineHi);
  px(ctx, k.x, k.y + 6, k.w, 2, p.lineHi);
  outline(ctx, k.x, k.y + 4, k.w, 6, p.line);
  px(ctx, k.x + 4, k.y + 6, k.w - 8, 3, p.void);                  // the coffee itself
  px(ctx, k.x + 6, k.y + 6, k.w - 12, 1, p.wallDark);             // a highlight on it
  px(ctx, k.x + 9, k.y - 6, 2, 6, p.dim);                         // steam
  px(ctx, k.x + 19, k.y - 12, 2, 7, p.dim);

  // Keyboard: a wedge with a real key grid. The grid is the whole read.
  const kb = O.keyboard;
  box(ctx, p, kb.x, kb.y, kb.w, kb.h, 9, { front: p.wallLit, side: p.deskSide, top: p.metal });
  for (let r = 0; r < 5; r++) {
    for (let cN = 0; cN < 24; cN++) {
      const x = kb.x + 6 + cN * 10 + r * 2, y = kb.y + 4 + r * 6;
      if (x + 8 > kb.x + kb.w - 4) continue;
      px(ctx, x, y, 8, 4, p.metalDark);
      px(ctx, x, y, 8, 1, p.line);
    }
  }
  px(ctx, kb.x + 6, kb.y + kb.h - 5, kb.w - 12, 3, p.metalDark);   // spacebar row

  // Mouse: body, seam, scroll wheel.
  const ms = O.mouse;
  box(ctx, p, ms.x, ms.y, ms.w, ms.h, 6, { front: p.wallLit, side: p.deskSide, top: p.metal });
  px(ctx, ms.x + Math.round(ms.w / 2) - 1, ms.y + 3, 3, 9, p.line);
  px(ctx, ms.x + 3, ms.y + 14, ms.w - 6, 1, p.line);

  // Fanned papers: offset sheets, each with a lit top edge. A body of work.
  const pp = O.papers;
  for (let i = 6; i >= 0; i--) {
    const x = pp.x + i * 5, y = pp.y + i * 3, w = pp.w - i * 4, h = 22;
    px(ctx, x, y, w, h, p.paper);
    outline(ctx, x, y, w, h, p.line);
    px(ctx, x + 1, y, w - 2, 1, p.lineHi);
    if (i === 0) {   // the top sheet carries rules and a formula
      for (let r = 0; r < 5; r++) px(ctx, x + 6, y + 4 + r * 3, w - 12 - r * 6, 1, p.dim);
      px(ctx, x + 6, y + 17, 30, 3, p.accent);
    }
  }
}

function drawFloor(ctx: Ctx, p: RoomPal) {
  px(ctx, 0, APRON_BOTTOM, ROOM_W, FLOOR_BOTTOM - APRON_BOTTOM, p.wallDark);
  // Light pooling out from under the desk.
  ramp(ctx, 0, APRON_BOTTOM, ROOM_W, 40, p.wall, 8, 0);
  dither(ctx, 120, APRON_BOTTOM, 560, 22, p.wallLit, 4);
  // Board seams converging toward the vanishing axis — enough to read as a floor.
  for (let i = 0; i <= 10; i++) {
    const xTop = Math.round((ROOM_W / 10) * i);
    const xBot = Math.round(ROOM_CX + (xTop - ROOM_CX) * 1.7);
    const span = FLOOR_BOTTOM - APRON_BOTTOM;
    for (let s = 0; s < span; s++) {
      const t = s / span;
      px(ctx, xTop + (xBot - xTop) * t, APRON_BOTTOM + s, 1, 1, p.void);
    }
  }
  // A cable snaking down from the desk to the tower.
  for (let i = 0; i < 34; i++) {
    px(ctx, 108 + Math.round(Math.sin(i * 0.4) * 6), APRON_BOTTOM + i, 2, 1, p.void);
  }
}

/** A workstation tower under the desk, with a lit power LED. */
function drawTower(ctx: Ctx, p: RoomPal) {
  const t = DESK_OBJECTS.tower;
  box(ctx, p, t.x, t.y, t.w, t.h, 10, { front: p.metalDark, side: p.void, top: p.metal });
  for (let i = 0; i < 3; i++) px(ctx, t.x + 8, t.y + 8 + i * 8, t.w - 16, 3, p.void);   // vents
  px(ctx, t.x + t.w - 16, t.y + 8, 4, 4, p.accent);                                     // power LED
  px(ctx, t.x + 8, t.y + t.h - 22, t.w - 16, 14, p.void);                               // intake grille
  for (let i = 0; i < 6; i++) px(ctx, t.x + 10 + i * 9, t.y + t.h - 20, 4, 10, p.metalDark);
}

/** The chair back, seen from behind — the strongest cue that YOU are sitting here.
 *  Darkest value in the room, with a rim light so it separates from the floor. */
function drawChair(ctx: Ctx, p: RoomPal) {
  const c = DESK_OBJECTS.chair;
  const x = c.x, top = c.y, w = c.w, bot = ROOM_H;

  // Back panel with rounded shoulders, drawn row by row so the curve steps in pixels.
  for (let y = top; y < bot; y++) {
    const t = Math.min(1, (y - top) / 40);
    const inset = Math.round(18 * (1 - t) * (1 - t));
    px(ctx, x + inset, y, w - inset * 2, 1, p.void);
  }
  // Rim light along the top curve and both sides.
  for (let y = top; y < top + 40; y++) {
    const t = (y - top) / 40;
    const inset = Math.round(18 * (1 - t) * (1 - t));
    px(ctx, x + inset, y, 1, 1, p.line);
    px(ctx, x + w - inset - 1, y, 1, 1, p.line);
  }
  px(ctx, x + 18, top, w - 36, 1, p.line);
  px(ctx, x, top + 40, 1, bot - top - 40, p.line);
  px(ctx, x + w - 1, top + 40, 1, bot - top - 40, p.line);
  // Lumbar seam and a headrest gap, so it is a chair and not a slab.
  px(ctx, x + 24, top + 34, w - 48, 2, p.line);
  px(ctx, x + 30, top + 76, w - 60, 1, p.line);
  dither(ctx, x + 4, top + 6, w - 8, 26, p.wallDark, 3);
  // Armrests, extruded toward the viewer.
  for (const ax of [x - 26, x + w - 4]) {
    px(ctx, ax, top + 62, 30, 9, p.void);
    px(ctx, ax, top + 62, 30, 1, p.line);
    px(ctx, ax + (ax < ROOM_CX ? 0 : 26), top + 71, 4, 12, p.void);
  }
}

/** Corner falloff, plus the top and bottom bands that dissolve into the page so the
 *  room has no hard edge to give itself away. */
function drawVignette(ctx: Ctx, p: RoomPal) {
  ramp(ctx, 0, 0, ROOM_W, 20, p.void, 16, 3);
  ramp(ctx, 0, ROOM_H - 46, ROOM_W, 46, p.void, 2, 16);
  px(ctx, 0, ROOM_H - 6, ROOM_W, 6, p.void);
  ramp(ctx, 0, 0, 46, ROOM_H, p.void, 10, 2);
  ramp(ctx, ROOM_W - 46, 0, 46, ROOM_H, p.void, 10, 2);
}
