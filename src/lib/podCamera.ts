// src/lib/podCamera.ts
// ONE camera for the whole pod room. Pure maths: no canvas, no DOM, so it is unit-tested.
//
// WHY THIS EXISTS — the measured defect it fixes:
// The previous room drew each system with its own ad-hoc depth trick, and the systems
// disagreed. Extrapolating each one's receding edges to the centre axis gave these
// vanishing points, where a coherent perspective demands they all be identical:
//
//     declared horizon in code ......  y = 300
//     floor seams ..................  y = 501
//     ceiling seams ................  y = -303
//     desk objects (box()) .........  y = 825 .. 1326, DIFFERENT FOR EVERY OBJECT
//     wall fixtures ................  y = infinity  (drawn as flat elevation)
//
// Five mutually contradictory spatial systems in one picture. The eye does that
// arithmetic and reports "the shape is off" — which is exactly what the owner said.
//
// The root cause was architectural: the old `box()` helper took a per-object `depth`
// argument and derived its side face from the object's x position, so depth was never a
// property of the ROOM — it was a per-object fudge factor.
//
// The fix: define the room as real volumes in world space and project every corner of
// every object through ONE perspective transform. Objects cannot disagree about depth
// because none of them chooses its own any more.
//
// WORLD SPACE (right-handed, units are metres so the numbers stay human):
//   x → right       (0 = the room's centre line)
//   y → up          (0 = the floor)
//   z → INTO the scene, away from the viewer (0 = the camera's film plane)
// The camera sits at (0, EYE_Y, 0) looking down +z, with a slight downward pitch so you
// read the desk surface from a seated height.

export interface Vec3 { x: number; y: number; z: number }
/** A projected point plus the depth that produced it, for painter's-order sorting. */
export interface Projected { sx: number; sy: number; depth: number; scale: number }

// ── The room, in metres ─────────────────────────────────────────────────────

/** Eye height above the floor. A seated person's eye is ~1.2 m. */
export const EYE_Y = 1.20;
/** How far the back wall is from the viewer. */
export const WALL_Z = 4.2;
/** Room half-width and ceiling height. */
export const ROOM_HALF_W = 3.6;
export const CEIL_Y = 2.7;
/** The desk: a slab the viewer is sitting at. */
export const DESK_Y = 0.74;          // standing surface height
export const DESK_Z_NEAR = 0.62;     // nearest edge, just in front of the viewer
export const DESK_Z_FAR = 2.35;      // where it meets the console
export const DESK_THICK = 0.06;

/** Focal length in "screen widths". Larger = longer lens = less dramatic convergence.
 *  1.5 is roughly a 50 mm-equivalent view: natural, not fisheye. */
const FOCAL = 1.5;
/** Downward pitch of the camera, radians. Small — you are looking level-ish, just able to
 *  see the desk surface. */
const PITCH = 0.085;

// ── Projection ──────────────────────────────────────────────────────────────

export interface CameraView {
  /** Buffer dimensions this camera projects into. */
  W: number; H: number;
  /** The single vanishing point every receding edge converges on. */
  vpx: number; vpy: number;
  project(p: Vec3): Projected;
  /** Convenience: project a world point and return only screen x/y. */
  xy(p: Vec3): [number, number];
}

/**
 * Build a camera for a given buffer size.
 *
 * Because there is exactly one projection, the vanishing point is a PROPERTY of the
 * camera rather than something each drawing routine improvises. Every edge parallel to
 * +z converges on (vpx, vpy) automatically — that is the whole point.
 */
export function makeCamera(W: number, H: number): CameraView {
  const f = FOCAL * W;
  const cosP = Math.cos(PITCH), sinP = Math.sin(PITCH);

  const project = (p: Vec3): Projected => {
    // Camera space: translate so the eye is the origin, then pitch down about x.
    const yc = p.y - EYE_Y;
    const y1 = yc * cosP + p.z * sinP;      // rotated up-axis
    const z1 = p.z * cosP - yc * sinP;      // rotated depth (always > 0 in this room)
    const z = Math.max(0.05, z1);           // never divide by ~0
    const scale = f / z;
    return { sx: W * 0.5 + p.x * scale, sy: H * 0.5 - y1 * scale, depth: z, scale };
  };

  // The vanishing point for the +z direction, derived in closed form rather than by
  // projecting a huge coordinate (which loses precision and got this wrong once).
  //
  // As z → ∞ for a line along +z: y1/z1 → sinP/cosP = tanP, so
  //     sy → H/2 - f * tanP
  // and x/z → 0, so sx → W/2. Every edge parallel to +z converges there, by construction.
  const vpy = H * 0.5 - f * (sinP / cosP);

  return {
    W, H,
    vpx: W * 0.5,
    vpy,
    project,
    xy: (p: Vec3) => { const q = project(p); return [q.sx, q.sy]; },
  };
}

// ── Boxes ───────────────────────────────────────────────────────────────────

/** An axis-aligned volume in world space. Position is its minimum corner. */
export interface Box3 {
  x: number; y: number; z: number;
  w: number; h: number; d: number;
}

export type Face = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom';
/** A face as four projected screen points, plus the depth to sort it by. */
export interface FaceQuad {
  face: Face;
  pts: [number, number][];
  depth: number;
  /** True when this face turns toward the camera and should be drawn. */
  visible: boolean;
}

const CORNERS: [number, number, number][] = [
  [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],   // near face (z = min)
  [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1],   // far face  (z = max)
];

// Every face is wound COUNTER-CLOCKWISE as seen from OUTSIDE the box. That consistency is
// what lets one shoelace-sign test decide visibility for all six; hand-written orders that
// disagree produce impossible results (a box showing both its front and its back at once,
// which is what an earlier version of this table did).
//
// Corner indices: 0-3 are the near face (z=min) as [x0y0, x1y0, x1y1, x0y1];
//                 4-7 are the far face  (z=max) in the same order.
const FACE_IDX: Record<Face, [number, number, number, number]> = {
  front: [0, 1, 2, 3],     // z = min, normal toward -z (the viewer)
  back: [5, 4, 7, 6],      // z = max, normal toward +z
  left: [4, 0, 3, 7],      // x = min, normal toward -x
  right: [1, 5, 6, 2],     // x = max, normal toward +x
  top: [3, 2, 6, 7],       // y = max, normal toward +y
  bottom: [4, 5, 1, 0],    // y = min, normal toward -y
};

/**
 * Project a world box into per-face screen quads, back to front.
 *
 * Visibility is decided by the SIGN OF THE PROJECTED AREA (the shoelace formula), not by
 * an ad-hoc "is this object left or right of centre" test. That is what guarantees a box
 * on the left shows its right face and vice versa, with no special cases and no per-object
 * tuning — the geometry decides, exactly once.
 */
export function projectBox(cam: CameraView, b: Box3): FaceQuad[] {
  const world = CORNERS.map(([i, j, k]) => ({
    x: b.x + i * b.w, y: b.y + j * b.h, z: b.z + k * b.d,
  }));
  const proj = world.map((p) => cam.project(p));

  const quads: FaceQuad[] = (Object.keys(FACE_IDX) as Face[]).map((face) => {
    const idx = FACE_IDX[face];
    const pts = idx.map((i) => [proj[i].sx, proj[i].sy] as [number, number]);
    // Shoelace: negative area means counter-clockwise on screen, i.e. facing the camera
    // given the winding order above.
    let area = 0;
    for (let i = 0; i < 4; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % 4];
      area += x1 * y2 - x2 * y1;
    }
    const depth = idx.reduce((s, i) => s + proj[i].depth, 0) / 4;
    // Faces are wound counter-clockwise seen from outside the box (see FACE_IDX). Screen y
    // grows DOWNWARD, which mirrors the image and so inverts the shoelace sign: a face
    // turned toward the camera comes out NEGATIVE. Verified against all six faces by the
    // visibility tests, which caught both an inconsistent winding table and this sign.
    return { face, pts, depth, visible: area < 0 };
  });

  return quads.sort((a, b2) => b2.depth - a.depth);
}

/** The visible faces only, back to front — what a painter actually draws. */
export function visibleFaces(cam: CameraView, b: Box3): FaceQuad[] {
  return projectBox(cam, b).filter((q) => q.visible);
}

/** A box's screen-space bounding box, for laying out content or hit areas. */
export function boxBounds(cam: CameraView, b: Box3): { x: number; y: number; w: number; h: number } {
  const pts = CORNERS.map(([i, j, k]) =>
    cam.project({ x: b.x + i * b.w, y: b.y + j * b.h, z: b.z + k * b.d }));
  const xs = pts.map((p) => p.sx), ys = pts.map((p) => p.sy);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

// ── Planes: for screens, posters, and anything with content mapped onto it ───

/** A rectangle in world space, tilted about its own horizontal axis.
 *  `tilt` > 0 leans the TOP away from the viewer, which is how a monitor is set. */
export interface Plane3 {
  /** Centre of the rectangle. */
  cx: number; cy: number; cz: number;
  w: number; h: number;
  /** Rotation about the world y axis (yaw), radians. Positive turns the panel's left edge
   *  toward the viewer. */
  yaw: number;
  /** Rotation about the panel's own x axis (tilt back), radians. */
  tilt: number;
}

/** The plane's four corners in world space: TL, TR, BR, BL as seen face-on. */
export function planeCorners(pl: Plane3): Vec3[] {
  const cy = Math.cos(pl.yaw), sy = Math.sin(pl.yaw);
  const ct = Math.cos(pl.tilt), st = Math.sin(pl.tilt);
  const hw = pl.w / 2, hh = pl.h / 2;
  // Panel-local axes: u across, v up the face (tilted), then yawed into the world.
  const u = { x: cy, y: 0, z: -sy };
  const v = { x: sy * st, y: ct, z: cy * st };
  return [
    [-hw, +hh], [+hw, +hh], [+hw, -hh], [-hw, -hh],
  ].map(([a, b]) => ({
    x: pl.cx + u.x * a + v.x * b,
    y: pl.cy + u.y * a + v.y * b,
    z: pl.cz + u.z * a + v.z * b,
  }));
}

/** Project a plane to a screen quad (TL, TR, BR, BL). */
export function projectPlane(cam: CameraView, pl: Plane3): {
  pts: [number, number][]; depth: number;
} {
  const cs = planeCorners(pl).map((p) => cam.project(p));
  return {
    pts: cs.map((p) => [p.sx, p.sy] as [number, number]),
    depth: cs.reduce((s, p) => s + p.depth, 0) / 4,
  };
}

/** Screen bounds of a plane — used for the DOM overlay's click targets. */
export function planeBounds(cam: CameraView, pl: Plane3): { x: number; y: number; w: number; h: number } {
  const { pts } = projectPlane(cam, pl);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/**
 * Yaw for a monitor at world x, so the rig curves to face the seated viewer.
 *
 * A real multi-monitor desk is arranged on an arc: the further a panel sits from the
 * centre line, the more it turns inward. Deriving it here means the whole rig shares one
 * rule instead of each panel guessing.
 */
export function faceViewer(x: number, z: number, strength = 0.72): number {
  return Math.atan2(x, Math.max(0.2, z)) * strength;
}
