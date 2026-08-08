// src/lib/podRoom.ts
// The pod room's LAYOUT and PALETTE — pure data, no canvas. The drawing lives in
// podRoomPaint.ts so this half stays unit-testable.
//
// WHY THESE NUMBERS ARE A MODULE AND NOT LITERALS IN THE PAINTER:
// the monitor rectangles are load-bearing twice — the painter draws the monitors from
// them AND the DOM overlay positions its real <a>/<button> links from them. If the two
// can disagree, the click targets drift off the painted screens silently. One source,
// two consumers.

/** Buffer size. Every coordinate in the painter is a literal pixel in this buffer, and
 *  CSS scales the whole thing up with image-rendering: pixelated.
 *
 *  WHY 800x440 AND NOT SMALLER: the first pass used 480x280, which was too coarse to
 *  hold a stacked monitor rig, extruded volume and a ceiling at once — detail collapsed
 *  into mush. This is still genuine low-res pixel art (at a 1600px viewport each buffer
 *  pixel paints as a crisp 2x2 block) but it has room for the detail a trading floor
 *  needs. Going much past this and the pixels stop reading as pixels. */
export const ROOM_W = 800;
export const ROOM_H = 440;

/** Horizontal centre — the one-point vanishing axis. Objects left of it show their
 *  RIGHT side face, objects right of it show their LEFT, which is what sells volume. */
export const ROOM_CX = ROOM_W / 2;

// ── Vertical bands ──────────────────────────────────────────────────────────
// The room is read top to bottom as: ceiling, back wall, desk, floor. Each band's
// boundary is named so the painter never guesses a y.

export const CEIL_TOP_VOID = 8;    // pure void, so the room's top melts into the page
export const CEIL_BOTTOM = 58;     // ceiling meets the back wall
export const WALL_BOTTOM = 268;    // back wall meets the desk's back edge
export const DESK_FRONT = 336;     // front edge of the desk's top surface
export const APRON_BOTTOM = 362;   // bottom of the desk's front apron (its thickness)
export const FLOOR_BOTTOM = 440;   // = ROOM_H

// ── The monitor rig ─────────────────────────────────────────────────────────
// A real quant desk stacks monitors on an arm rig rather than standing them in a row:
// three big primaries at eye level, a secondary row above. Seven screens total — five
// are destinations, two are ambient (a heatmap and a ticker tape) purely so the wall
// reads as a working desk rather than exactly-as-many-monitors-as-there-are-links.

export const MONITOR_COUNT = 5;   // interactive destinations

export interface MonitorPlace {
  /** Destination slot 0-4, or null for an ambient screen with no link. */
  slot: number | null;
  kind: 'primary' | 'secondary';
  /** Ambient screen content, only when slot is null. */
  ambient?: 'heat' | 'tape';
  x: number; y: number; w: number; h: number; bezel: number;
}

const PRIMARY = { w: 178, h: 108, gap: 8, y: 150, bezel: 6 };
const SECONDARY = { w: 132, h: 72, gap: 8, y: 70, bezel: 5 };

/** The rig's horizontal span. Deliberately NOT centred in the room: a tall window takes
 *  the left third, a server rack the right edge, and the asymmetry is what stops the
 *  scene looking like a symmetrical stage set. The rig must clear the window, or the
 *  city — the one thing that places the room somewhere — ends up a sliver behind it. */
const RIG_X = 218;
const RIG_W = 566;

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

/** The rig's own frame: the two posts and the two cross-bars the monitors hang off.
 *  Derived from the monitor rows rather than hardcoded in the painter, so moving the rig
 *  can never leave its posts behind. */
export function rigFrame() {
  const prim = MONITORS.filter((m) => m.kind === 'primary');
  const sec = MONITORS.filter((m) => m.kind === 'secondary');
  const left = Math.min(...MONITORS.map((m) => m.x));
  const right = Math.max(...MONITORS.map((m) => m.x + m.w));
  const primTop = Math.min(...prim.map((m) => m.y));
  const secTop = Math.min(...sec.map((m) => m.y));
  const secBottom = Math.max(...sec.map((m) => m.y + m.h));
  return {
    left, right,
    /** Posts sit just inside the rig's outer edge. */
    postW: 8,
    postL: left + 22,
    postR: right - 30,
    /** Lower bar carries the primaries; upper bar carries the secondary row. */
    barLowY: primTop - 12,
    barHighY: secTop - 10,
    /** The vertical run between the two bars. */
    braceTop: secTop - 10,
    braceBottom: secBottom + 8,
  };
}

/** Every screen on the rig, in paint order (back row first). */
export const MONITORS: MonitorPlace[] = [
  // Secondary row: ambient, Writing, Market reports, ambient — the two ambient screens
  // sit on the OUTSIDE so the interactive pair stays near the centre of attention.
  ...row(4, SECONDARY, 'secondary').map((m, i) => {
    const assign: (Pick<MonitorPlace, 'slot'> & { ambient?: 'heat' | 'tape' })[] = [
      { slot: null, ambient: 'heat' },
      { slot: 3 },
      { slot: 4 },
      { slot: null, ambient: 'tape' },
    ];
    return { ...m, ...assign[i] };
  }),
  // Primary row: the three big destinations at eye level.
  ...row(3, PRIMARY, 'primary').map((m, i) => ({ ...m, slot: i })),
];

/** Screen interiors as FRACTIONS of the buffer, for the DOM overlay. Interactive
 *  screens only — the ambient two get no link because they go nowhere. */
export function roomScreens(): {
  slot: number; left: number; top: number; width: number; height: number;
}[] {
  return MONITORS
    .filter((m): m is MonitorPlace & { slot: number } => m.slot !== null)
    .map((m) => ({
      slot: m.slot,
      left: ((m.x + m.bezel) / ROOM_W) * 100,
      top: ((m.y + m.bezel) / ROOM_H) * 100,
      width: ((m.w - m.bezel * 2) / ROOM_W) * 100,
      height: ((m.h - m.bezel * 2) / ROOM_H) * 100,
    }))
    .sort((a, b) => a.slot - b.slot);
}

/** Signed side-face depth for a box centred at cx: negative means the RIGHT face is
 *  visible (the box sits left of the vanishing axis), positive means the LEFT face is.
 *  Magnitude grows with distance from the axis — that is one-point perspective. */
export function sideDepth(cx: number, scale = 30, max = 7): number {
  const d = Math.round((cx - ROOM_CX) / scale);
  return Math.max(-max, Math.min(max, d));
}

// ── The left wall column, and the right rack ────────────────────────────────

export const CLOCKS = { x: 18, y: 74, w: 168, h: 32, count: 3 } as const;
export const WINDOW = { x: 18, y: 116, w: 168, h: 146 } as const;
/** Cropped by the right frame edge on purpose — a room continues past what you can see,
 *  and a fully-visible object centred in its own margin reads as a stage prop. */
export const RACK = { x: 748, y: 62, w: 68, h: 206 } as const;

// ── Desk objects ────────────────────────────────────────────────────────────
// Positions in buffer px on the desk's top surface (y 268..336). Everything the owner
// asked for by name: a fanned paper stack, a coffee cup, a plush cow, keyboard + mouse.

export const DESK_OBJECTS = {
  cow: { x: 130, y: 276, w: 58, h: 40 },
  coffee: { x: 200, y: 282, w: 32, h: 40 },
  keyboard: { x: 280, y: 296, w: 260, h: 34 },
  mouse: { x: 556, y: 300, w: 30, h: 28 },
  papers: { x: 610, y: 276, w: 130, h: 44 },
  tower: { x: 40, y: 352, w: 80, h: 78 },       // on the floor, under the desk
  chair: { x: 290, y: 336, w: 220, h: 104 },
} as const;

// ── Palette ─────────────────────────────────────────────────────────────────
// A tight ramp per theme. The room is a NIGHT room in BOTH themes: this site's --bg
// never flips bright, so the theme changes the room's temperature and accent, not the
// time of day. Light = warm amber tungsten; dark = cold blue phosphor.

export interface RoomPal {
  void: string;      // deepest shadow, and the tone the page fades into
  wallDark: string;
  wall: string;
  wallLit: string;   // wall catching screen light
  line: string;      // outlines — the line work does more than the fills
  lineHi: string;    // lit edges and highlights
  glass: string;     // window glass behind the city
  city: string;
  cityHi: string;
  cityLit: string;   // lit windows in the city
  cityLitHi: string;
  deskTop: string;
  deskSide: string;  // the desk's apron and side returns (in shadow)
  deskLip: string;   // the lit near edge
  monFront: string;  // monitor bezel, front face
  monSide: string;   // monitor bezel, side face (darker — it turns away from the light)
  monTop: string;    // monitor bezel, top face (lighter)
  screenBg: string;
  metal: string;     // rig posts, rack chassis
  metalDark: string;
  accent: string;    // ochre (light) / emerald (dark)
  seal: string;      // the brand mark, in both themes
  paper: string;
  dim: string;
}

export function roomPalette(theme: 'light' | 'dark'): RoomPal {
  return theme === 'dark'
    ? {
        void: '#070a10', wallDark: '#0d121c', wall: '#151c2a', wallLit: '#1e293c',
        line: '#3a5675', lineHi: '#5d84ad', glass: '#101a2e',
        city: '#17223b', cityHi: '#22314f', cityLit: '#c9524a', cityLitHi: '#e88b72',
        deskTop: '#1a2431', deskSide: '#101822', deskLip: '#3d5570',
        monFront: '#111823', monSide: '#0a0f17', monTop: '#26344a',
        screenBg: '#070d13', metal: '#2b3a4d', metalDark: '#141d28',
        accent: '#66c28c', seal: '#e0574a', paper: '#dce1dc', dim: '#7f8b93',
      }
    : {
        void: '#0a0806', wallDark: '#13100b', wall: '#1e1812', wallLit: '#2c2319',
        line: '#5f4b36', lineHi: '#8d7355', glass: '#171108',
        city: '#231a0f', cityHi: '#332515', cityLit: '#b23a2e', cityLitHi: '#d98a5c',
        deskTop: '#241c14', deskSide: '#15100b', deskLip: '#6b5540',
        monFront: '#171208', monSide: '#0d0a06', monTop: '#33291c',
        screenBg: '#0b0907', metal: '#3a2f22', metalDark: '#1a1410',
        accent: '#c8a36a', seal: '#b23a2e', paper: '#efe9dd', dim: '#8a7f6e',
      };
}
