// src/lib/podGeometry.ts
// Geometry for the quant pod — the from-the-seat isometric camera and the pod's
// object layout. Pure: no canvas, no DOM, so it can be unit-tested like terrain.ts.
//
// WHY A SEPARATE CAMERA FROM terrain.ts:
// terrain.project bakes YAW 32deg / TILT 53deg, tuned for looking DOWN at a
// landscape. Fed a desk it rotates the bench diagonally — verified: front-left
// corner lands at screen y=769 while front-right lands at y=372, which reads as a
// tilted table rather than a desk you are sitting at. The pod needs yaw REMOVED
// (you face the monitor wall square-on) and a gentle downward tilt. The maths shape
// is deliberately identical to terrain's — one rotation, uniform scale, depth
// returned for painter's-order sorting — so this is a sibling, not a fork.

/** Downward tilt of the pod camera, in degrees. At 18deg in a 1600x900 frame the
 *  bench front edge lands at y=653, its back edge at y=463, the monitor bottoms at
 *  y=362 and their tops at y=41: bench across the bottom, screens filling the top.
 *  Lower values flatten toward a straight-on elevation; higher values start looking
 *  down at the desk and lose the "sitting at it" read. */
export const POD_TILT_DEG = 18;

const T = (POD_TILT_DEG * Math.PI) / 180;
const cosT = Math.cos(T);
const sinT = Math.sin(T);

/** Horizon line as a fraction of frame height. 0.68 pushes the bench down so its
 *  front edge lands near the canvas bottom, using the full height. */
const HORIZON = 0.68;

/**
 * Project a pod-space point to screen space.
 *
 * Pod space: x = left/right across the bench, y = depth away from the viewer
 * (negative = toward the viewer, i.e. the near desk edge), z = height above the
 * bench surface.
 *
 * @returns [screenX, screenY, depth] — depth LARGER means FURTHER away, so paint
 *          in descending depth order (far first) for correct occlusion.
 */
export function podProject(
  x: number, y: number, z: number, W: number, H: number, zoom = 1,
): [number, number, number] {
  const up = y * sinT + z * cosT;      // screen-up: depth and height both raise
  const depth = y * cosT - z * sinT;   // away from viewer
  const sc = Math.min(W, H) * 0.34 * zoom;
  return [W * 0.5 + x * sc, H * HORIZON - up * sc, depth];
}

// ── The pod's contents, as data ─────────────────────────────────────────────
// Pod space: x across the bench, y depth (negative = toward the viewer), z height.
// The bench surface is z = 0. Everything is a quad (4 corners) except where a
// simple silhouette needs more; the painter treats any corner list as a polygon.

export type PodQuadId =
  | 'bench' | 'wall' | 'monitor'
  | 'keyboard' | 'mouse' | 'coffee' | 'papers' | 'cow' | 'journal';

export interface PodQuad {
  id: PodQuadId;
  /** 0-based monitor index, only on `monitor` quads. */
  slot?: number;
  /** Corners in pod space, in polygon order. */
  corners: [number, number, number][];
}

export const MONITOR_SLOTS = 5;

/** Monitor wall geometry. Five screens in a row at the back of the bench, with a
 *  small bezel gap so the drifting sky shows through between them. */
const WALL_Y = 1.0;          // depth of the wall plane
const SCREEN_Z0 = 0.42;      // bottom of the screens, above the bench clutter
const SCREEN_Z1 = 1.38;      // top
const SCREEN_W = 0.62;       // width of one screen in pod units
const SCREEN_GAP = 0.07;     // gap between screens — the sky shows through here

function monitorQuad(slot: number): PodQuad {
  const total = MONITOR_SLOTS * SCREEN_W + (MONITOR_SLOTS - 1) * SCREEN_GAP;
  const x0 = -total / 2 + slot * (SCREEN_W + SCREEN_GAP);
  const x1 = x0 + SCREEN_W;
  return {
    id: 'monitor', slot,
    corners: [
      [x0, WALL_Y, SCREEN_Z1], [x1, WALL_Y, SCREEN_Z1],
      [x1, WALL_Y, SCREEN_Z0], [x0, WALL_Y, SCREEN_Z0],
    ],
  };
}

/** A rectangle lying FLAT on the bench (z = height above the surface). */
function flat(id: PodQuadId, x0: number, x1: number, y0: number, y1: number, z = 0.001): PodQuad {
  return { id, corners: [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]] };
}

/** A box standing on the bench, as its front face (the painter adds shading). */
function upright(id: PodQuadId, x0: number, x1: number, y: number, z0: number, z1: number): PodQuad {
  return { id, corners: [[x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0]] };
}

export const POD_LAYOUT: PodQuad[] = [
  // the wall plane behind the monitors (dark, so screens read as lit)
  { id: 'wall', corners: [[-2.4, WALL_Y + 0.02, 1.9], [2.4, WALL_Y + 0.02, 1.9], [2.4, WALL_Y + 0.02, 0], [-2.4, WALL_Y + 0.02, 0]] },
  // the bench surface — front edge extended toward viewer so it fills the frame
  { id: 'bench', corners: [[-2.2, -1.35, 0], [2.2, -1.35, 0], [2.0, WALL_Y, 0], [-2.0, WALL_Y, 0]] },
  ...Array.from({ length: MONITOR_SLOTS }, (_, i) => monitorQuad(i)),
  // desk objects, front to back. Keyboard/mouse nearest — they are what make the
  // scene read as FROM THE SEAT rather than a view of a desk.
  flat('keyboard', -0.75, 0.75, -0.98, -0.62),
  flat('mouse', 0.95, 1.20, -0.92, -0.70),
  upright('coffee', -1.45, -1.18, -0.55, 0, 0.20),
  flat('papers', 0.62, 1.55, -0.42, 0.22),
  upright('cow', 1.36, 1.66, 0.34, 0, 0.26),
];

/** Paint order: far to near, so nearer objects occlude further ones. */
export function sortByDepth(quads: PodQuad[], W: number, H: number, zoom = 1): PodQuad[] {
  const depth = (q: PodQuad) =>
    q.corners.reduce((s, c) => s + podProject(c[0], c[1], c[2], W, H, zoom)[2], 0) / q.corners.length;
  return [...quads].sort((a, b) => depth(b) - depth(a));
}

/** Screen bounding boxes as PERCENTAGES of the frame, for positioning the DOM
 *  overlay links. Percentages (not px) so the overlay needs no JS on resize. */
export function screenRects(W: number, H: number, zoom = 1): {
  slot: number; left: number; top: number; width: number; height: number;
}[] {
  return POD_LAYOUT.filter((q) => q.id === 'monitor').map((q) => {
    const pts = q.corners.map((c) => podProject(c[0], c[1], c[2], W, H, zoom));
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const left = Math.min(...xs), right = Math.max(...xs);
    const top = Math.min(...ys), bottom = Math.max(...ys);
    return {
      slot: q.slot as number,
      left: (left / W) * 100, top: (top / H) * 100,
      width: ((right - left) / W) * 100, height: ((bottom - top) / H) * 100,
    };
  }).sort((a, b) => a.left - b.left);
}
