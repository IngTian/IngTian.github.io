// src/lib/podRoom.ts
// The pod room's LAYOUT, CAMERA and PALETTE — pure data and pure maths, no canvas. The
// drawing lives in podRoomPaint.ts so this half stays unit-testable.
//
// WHY THE MONITOR RECTANGLES LIVE HERE: they are load-bearing twice — the painter draws
// the monitors from them AND the DOM overlay positions its real <a>/<button> links from
// them. If the two can disagree, the click targets drift off the painted screens with no
// visible symptom. One source, two consumers.

/** Buffer size. Every coordinate in the painter is a literal pixel in this buffer.
 *
 *  WHY THIS BIG: 480x280 was too coarse to hold a stacked rig, extruded volume and a
 *  ceiling at once, and 800x440 still left the screen contents mushy. At 1600x880 a
 *  monitor's screen is ~330x190 buffer px, which is enough for a code editor with 20
 *  legible lines, tick-marked axes and a minimap.
 *
 *  This is still the pixel-art aesthetic, but the style now comes from flat shading,
 *  hard 1px edges and ordered dithering rather than from being upscaled — which is
 *  exactly the trade the owner asked for ("higher res... I'm not saying keep extra low
 *  res"). Paint cost stays independent of viewport size, and dithering is done with
 *  cached 4x4 patterns rather than per-pixel fills so a repaint stays cheap at this size. */
export const ROOM_W = 1600;
export const ROOM_H = 880;

/** Horizontal centre — the one-point vanishing axis. Objects left of it show their RIGHT
 *  side face, objects right of it show their LEFT, and monitors yaw inward toward it. */
export const ROOM_CX = ROOM_W / 2;

/** Eye height, as a fraction of the buffer. The horizon: things above it show their
 *  under-side, things below show their top. The desk sits just below it, so you read the
 *  desk surface from slightly above — the from-the-seat view. */
export const HORIZON_Y = 300;

// ── Vertical bands ──────────────────────────────────────────────────────────

export const CEIL_TOP_VOID = 16;   // pure void, so the room's top melts into the page
export const CEIL_BOTTOM = 118;    // ceiling meets the back wall
export const WALL_BOTTOM = 536;    // back wall meets the desk's back edge
export const DESK_FRONT = 672;     // front edge of the desk's top surface
export const APRON_BOTTOM = 724;   // bottom of the desk's front apron (its thickness)
export const FLOOR_BOTTOM = 880;   // = ROOM_H

// ── The monitor rig ─────────────────────────────────────────────────────────
// A real quant desk stacks monitors on an arm rig: big primaries at eye level, a
// secondary row above. Seven screens — five are destinations, two are ambient (a
// correlation heatmap and a ticker tape) so the wall reads as a working desk rather than
// exactly-as-many-monitors-as-there-are-links.

export const MONITOR_COUNT = 5;   // interactive destinations

export interface MonitorPlace {
  /** Destination slot 0-4, or null for an ambient screen with no link. */
  slot: number | null;
  kind: 'primary' | 'secondary';
  ambient?: 'heat' | 'tape';
  /** Straight-on bounds, BEFORE yaw and tilt. The quad maths derives from these. */
  x: number; y: number; w: number; h: number; bezel: number;
}

const PRIMARY = { w: 356, h: 216, gap: 16, y: 300, bezel: 12 };
const SECONDARY = { w: 264, h: 144, gap: 16, y: 140, bezel: 10 };

/** The rig's span. Deliberately NOT centred: a tall window takes the left column and a
 *  server rack the right edge. It must clear both, or the city — the one thing that
 *  places the room somewhere — ends up a sliver hidden behind a monitor. */
const RIG_X = 356;
const RIG_W = 1130;

function row(
  count: number, spec: { w: number; h: number; gap: number; y: number; bezel: number },
  kind: 'primary' | 'secondary',
): Omit<MonitorPlace, 'slot' | 'ambient'>[] {
  const total = count * spec.w + (count - 1) * spec.gap;
  const x0 = RIG_X + Math.round((RIG_W - total) / 2);
  return Array.from({ length: count }, (_, i) => ({
    kind, x: x0 + i * (spec.w + spec.gap), y: spec.y,
    w: spec.w, h: spec.h, bezel: spec.bezel,
  }));
}

export const MONITORS: MonitorPlace[] = [
  // Secondary row: ambient outside, the two "coming" destinations inside.
  ...row(4, SECONDARY, 'secondary').map((m, i) => {
    const assign: { slot: number | null; ambient?: 'heat' | 'tape' }[] = [
      { slot: null, ambient: 'heat' }, { slot: 3 }, { slot: 4 }, { slot: null, ambient: 'tape' },
    ];
    return { ...m, ...assign[i] };
  }),
  // Primary row: the three big destinations at eye level.
  ...row(3, PRIMARY, 'primary').map((m, i) => ({ ...m, slot: i })),
];

// ── Tilt and yaw: the camera maths that makes a monitor look like an object ──
// A straight-on rectangle can never read as 3D. Real desk monitors do two things: they
// YAW inward toward the person (a shallow arc) and they TILT the screen back a few
// degrees. Both are what the owner meant by "tilting the shade gives it a 3D feel".

/** Max inward yaw at the ends of the rig, in degrees. */
export const YAW_MAX_DEG = 13;
/** Backward tilt of every screen, in degrees. Uniform — they are all set the same way. */
export const TILT_DEG = 6;

export type Quad = [number, number][];   // 4 points: TL, TR, BR, BL

/**
 * The quad a monitor's outer bezel occupies once yawed and tilted.
 *
 * Yaw: the edge FURTHER from the room's centre is nearer the viewer, so it is taller and
 * the near/far edges differ in height — that vertical difference is the whole 3D read.
 * Tilt: the top edge leans away, so it sits slightly lower and inset; the top face this
 * exposes is drawn separately by the painter.
 */
export function monitorQuad(m: MonitorPlace): Quad {
  const cx = m.x + m.w / 2;
  // -1 at the left end of the rig, +1 at the right end.
  const yawT = Math.max(-1, Math.min(1, (cx - ROOM_CX) / (ROOM_W * 0.36)));
  const yawRad = (YAW_MAX_DEG * Math.PI / 180) * yawT;

  // Half the height difference between the near and far vertical edges.
  const e = Math.round(m.h * 0.5 * Math.abs(Math.sin(yawRad)) * 0.85);
  // Yaw also foreshortens the width a little.
  const wq = Math.round(m.w * (0.965 + 0.035 * Math.cos(yawRad)));
  const x0 = Math.round(cx - wq / 2), x1 = x0 + wq;

  // Backward tilt: the top edge drops and the screen loses a little apparent height.
  const tiltDrop = Math.round(m.h * Math.sin((TILT_DEG * Math.PI) / 180));

  // yawT < 0 → the monitor is left of centre → its LEFT edge is the near, taller one.
  const leftNear = yawT < 0;
  const yTopL = m.y + tiltDrop + (leftNear ? -e : e);
  const yTopR = m.y + tiltDrop + (leftNear ? e : -e);
  const yBotL = m.y + m.h + (leftNear ? e : -e);
  const yBotR = m.y + m.h + (leftNear ? -e : e);

  return [[x0, yTopL], [x1, yTopR], [x1, yBotR], [x0, yBotL]];
}

/** The screen's own quad: the monitor quad inset by its bezel, edge-wise. */
export function screenQuad(m: MonitorPlace): Quad {
  const q = monitorQuad(m);
  const b = m.bezel;
  // Inset along both axes. The bezel is uniform in the monitor's own plane, so on screen
  // the top/bottom insets follow each edge's own vertical direction.
  const [tl, tr, br, bl] = q;
  const lerp = (a: [number, number], c: [number, number], t: number): [number, number] =>
    [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t];
  const tIn = b / Math.max(1, Math.hypot(bl[0] - tl[0], bl[1] - tl[1]));
  const sIn = b / Math.max(1, Math.hypot(tr[0] - tl[0], tr[1] - tl[1]));
  const tlI = lerp(lerp(tl, bl, tIn), lerp(tr, br, tIn), sIn);
  const trI = lerp(lerp(tr, br, tIn), lerp(tl, bl, tIn), sIn);
  const brI = lerp(lerp(br, tr, tIn), lerp(bl, tl, tIn), sIn);
  const blI = lerp(lerp(bl, tl, tIn), lerp(br, tr, tIn), sIn);
  return [tlI, trI, brI, blI];
}

/** Axis-aligned bounding box of a quad, in buffer px. */
export function quadBounds(q: Quad): { x: number; y: number; w: number; h: number } {
  const xs = q.map((c) => c[0]), ys = q.map((c) => c[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** Screen boxes as FRACTIONS of the buffer, for the DOM overlay. The hit area is each
 *  tilted screen's bounding box — a rectangle over a quad, which is right for a click
 *  target and keeps the overlay pure CSS with no JS on resize. */
export function roomScreens(): {
  slot: number; left: number; top: number; width: number; height: number;
}[] {
  return MONITORS
    .filter((m): m is MonitorPlace & { slot: number } => m.slot !== null)
    .map((m) => {
      const b = quadBounds(screenQuad(m));
      return {
        slot: m.slot,
        left: (b.x / ROOM_W) * 100, top: (b.y / ROOM_H) * 100,
        width: (b.w / ROOM_W) * 100, height: (b.h / ROOM_H) * 100,
      };
    })
    .sort((a, b) => a.slot - b.slot);
}

/** The rig's frame: posts and cross-bars, derived from the monitor rows so moving the rig
 *  can never leave its posts behind (hardcoded posts did exactly that once). */
export function rigFrame() {
  const prim = MONITORS.filter((m) => m.kind === 'primary');
  const sec = MONITORS.filter((m) => m.kind === 'secondary');
  const left = Math.min(...MONITORS.map((m) => m.x));
  const right = Math.max(...MONITORS.map((m) => m.x + m.w));
  return {
    left, right,
    postW: 16,
    postL: left + 44,
    postR: right - 60,
    barLowY: Math.min(...prim.map((m) => m.y)) - 26,
    barHighY: Math.min(...sec.map((m) => m.y)) - 22,
    braceTop: Math.min(...sec.map((m) => m.y)) - 22,
    braceBottom: Math.max(...sec.map((m) => m.y + m.h)) + 16,
  };
}

/** Signed side-face depth for a box centred at cx: negative means the RIGHT face shows,
 *  positive the LEFT. Magnitude grows with distance from the axis — one-point
 *  perspective, and what makes desk objects read as solid. */
export function sideDepth(cx: number, scale = 52, max = 14): number {
  const d = Math.round((cx - ROOM_CX) / scale);
  return Math.max(-max, Math.min(max, d));
}

// ── Fixtures ────────────────────────────────────────────────────────────────

export const CLOCKS = { x: 36, y: 148, w: 300, h: 64, count: 3 } as const;
export const WINDOW = { x: 36, y: 232, w: 300, h: 292 } as const;
/** Cropped by the right frame edge on purpose — a room continues past what you can see,
 *  and a fully-visible object centred in its own margin reads as a stage prop. */
export const RACK = { x: 1496, y: 124, w: 136, h: 412 } as const;

export const DESK_OBJECTS = {
  phone: { x: 168, y: 572, w: 68, h: 60 },
  cow: { x: 244, y: 548, w: 112, h: 80 },
  coffee: { x: 380, y: 560, w: 60, h: 80 },
  notebook: { x: 468, y: 576, w: 124, h: 68 },
  pen: { x: 492, y: 564, w: 68, h: 12 },
  keyboard: { x: 612, y: 592, w: 508, h: 68 },
  mousepad: { x: 1132, y: 588, w: 104, h: 80 },
  mouse: { x: 1152, y: 600, w: 60, h: 56 },
  papers: { x: 1260, y: 548, w: 248, h: 88 },
  tower: { x: 68, y: 732, w: 156, h: 148 },
  chair: { x: 572, y: 688, w: 456, h: 192 },
} as const;

// ── Palette ─────────────────────────────────────────────────────────────────
// The room is a NIGHT room in BOTH themes: this site's --bg never flips bright, so the
// theme changes temperature and accent, not time of day. Light = warm amber tungsten;
// dark = cold blue phosphor.

export interface RoomPal {
  void: string; wallDark: string; wall: string; wallLit: string;
  line: string; lineHi: string;
  glass: string; city: string; cityHi: string; cityLit: string; cityLitHi: string;
  deskTop: string; deskSide: string; deskLip: string;
  monFront: string; monSide: string; monTop: string; monBack: string;
  screenBg: string; metal: string; metalDark: string;
  accent: string; seal: string; paper: string; dim: string;
}

export function roomPalette(theme: 'light' | 'dark'): RoomPal {
  return theme === 'dark'
    ? {
        void: '#070a10', wallDark: '#0d121c', wall: '#151c2a', wallLit: '#1e293c',
        line: '#3a5675', lineHi: '#5d84ad', glass: '#101a2e',
        city: '#17223b', cityHi: '#22314f', cityLit: '#c9524a', cityLitHi: '#e88b72',
        deskTop: '#1a2431', deskSide: '#101822', deskLip: '#3d5570',
        monFront: '#111823', monSide: '#0a0f17', monTop: '#26344a', monBack: '#0c1119',
        screenBg: '#070d13', metal: '#2b3a4d', metalDark: '#141d28',
        accent: '#66c28c', seal: '#e0574a', paper: '#dce1dc', dim: '#7f8b93',
      }
    : {
        void: '#0a0806', wallDark: '#13100b', wall: '#1e1812', wallLit: '#2c2319',
        line: '#5f4b36', lineHi: '#8d7355', glass: '#171108',
        city: '#231a0f', cityHi: '#332515', cityLit: '#b23a2e', cityLitHi: '#d98a5c',
        deskTop: '#241c14', deskSide: '#15100b', deskLip: '#6b5540',
        monFront: '#171208', monSide: '#0d0a06', monTop: '#33291c', monBack: '#100c07',
        screenBg: '#0b0907', metal: '#3a2f22', metalDark: '#1a1410',
        accent: '#c8a36a', seal: '#b23a2e', paper: '#efe9dd', dim: '#8a7f6e',
      };
}
