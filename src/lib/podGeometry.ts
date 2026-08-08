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

/** Horizon line as a fraction of frame height. 0.62 leaves room for the bench
 *  below and the monitor wall above. */
const HORIZON = 0.62;

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
