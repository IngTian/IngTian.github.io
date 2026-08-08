// tests/podCamera.test.ts
// The camera's whole reason to exist is SPATIAL COHERENCE, so that is what these tests
// assert — not that the maths runs, but that every system in the room converges on ONE
// vanishing point.
//
// Context: the previous room had five contradictory spatial systems. Measured implied
// vanishing points were y = 300 (declared), 501 (floor), -303 (ceiling), 825..1326 (desk
// objects, each different) and infinity (wall fixtures). These tests exist so that can
// never silently return.

import { describe, it, expect } from 'vitest';
import {
  makeCamera, projectBox, visibleFaces, boxBounds, projectPlane, planeBounds,
  planeCorners, faceViewer, EYE_Y, WALL_Z, DESK_Y, DESK_Z_NEAR, DESK_Z_FAR,
  type Box3, type Plane3,
} from '../src/lib/podCamera';

const W = 1600, H = 880;
const cam = makeCamera(W, H);

/** Where does a family of world-parallel edges appear to converge? Take two edges that
 *  are parallel in world space, project them, and intersect them on screen. */
function convergence(
  a: [{ x: number; y: number; z: number }, { x: number; y: number; z: number }],
  b: [{ x: number; y: number; z: number }, { x: number; y: number; z: number }],
): { x: number; y: number } | null {
  const [a1, a2] = a.map((p) => cam.project(p));
  const [b1, b2] = b.map((p) => cam.project(p));
  const d1x = a2.sx - a1.sx, d1y = a2.sy - a1.sy;
  const d2x = b2.sx - b1.sx, d2y = b2.sy - b1.sy;
  const den = d1x * d2y - d1y * d2x;
  if (Math.abs(den) < 1e-9) return null;   // parallel on screen too
  const t = ((b1.sx - a1.sx) * d2y - (b1.sy - a1.sy) * d2x) / den;
  return { x: a1.sx + d1x * t, y: a1.sy + d1y * t };
}

describe('one vanishing point — the defect this camera was built to fix', () => {
  it('sends floor edges, ceiling edges and desk edges to the SAME point', () => {
    // Three families of world-parallel lines, all running along +z at different heights.
    const floor = convergence(
      [{ x: -3, y: 0, z: 1 }, { x: -3, y: 0, z: 6 }],
      [{ x: 3, y: 0, z: 1 }, { x: 3, y: 0, z: 6 }],
    )!;
    const ceiling = convergence(
      [{ x: -3, y: 2.7, z: 1 }, { x: -3, y: 2.7, z: 6 }],
      [{ x: 3, y: 2.7, z: 1 }, { x: 3, y: 2.7, z: 6 }],
    )!;
    const desk = convergence(
      [{ x: -1.2, y: DESK_Y, z: 1 }, { x: -1.2, y: DESK_Y, z: 3 }],
      [{ x: 1.2, y: DESK_Y, z: 1 }, { x: 1.2, y: DESK_Y, z: 3 }],
    )!;

    // All three must agree, to within a pixel.
    expect(Math.abs(floor.y - ceiling.y), 'floor vs ceiling').toBeLessThan(1);
    expect(Math.abs(floor.y - desk.y), 'floor vs desk').toBeLessThan(1);
    expect(Math.abs(floor.x - ceiling.x), 'x agreement').toBeLessThan(1);
  });

  it('reports that shared point as the camera vanishing point', () => {
    const floor = convergence(
      [{ x: -3, y: 0, z: 1 }, { x: -3, y: 0, z: 6 }],
      [{ x: 3, y: 0, z: 1 }, { x: 3, y: 0, z: 6 }],
    )!;
    expect(Math.abs(floor.x - cam.vpx)).toBeLessThan(1);
    expect(Math.abs(floor.y - cam.vpy)).toBeLessThan(1.5);
  });

  it('puts the vanishing point inside the frame, near eye level', () => {
    // If the VP drifts outside the buffer the room stops reading as an interior you are
    // sitting in. The old ceiling system put it at y = -303, i.e. above the picture.
    expect(cam.vpy).toBeGreaterThan(0);
    expect(cam.vpy).toBeLessThan(H);
    expect(cam.vpx).toBeCloseTo(W / 2, 6);
  });

  it('sends every desk object to the same vanishing point, whatever its size', () => {
    // The old box() derived depth per object, so five objects implied five different
    // vanishing points (825..1326). Now depth is a property of the world.
    const objects: Box3[] = [
      { x: -2.4, y: DESK_Y, z: 1.0, w: 0.3, h: 0.1, d: 0.2 },
      { x: -0.9, y: DESK_Y, z: 0.9, w: 0.5, h: 0.03, d: 0.18 },
      { x: 0.1, y: DESK_Y, z: 1.4, w: 1.2, h: 0.02, d: 0.4 },
      { x: 1.8, y: DESK_Y, z: 1.1, w: 0.4, h: 0.25, d: 0.3 },
    ];
    const vps = objects.map((b) => convergence(
      [{ x: b.x, y: b.y, z: b.z }, { x: b.x, y: b.y, z: b.z + b.d }],
      [{ x: b.x + b.w, y: b.y, z: b.z }, { x: b.x + b.w, y: b.y, z: b.z + b.d }],
    )).filter((v): v is { x: number; y: number } => v !== null);

    expect(vps.length).toBeGreaterThan(2);
    for (const v of vps) {
      expect(Math.abs(v.y - cam.vpy), 'object VP matches camera VP').toBeLessThan(2);
    }
  });
});

describe('projection basics', () => {
  it('puts a point on the centre line at the buffer centre horizontally', () => {
    expect(cam.project({ x: 0, y: EYE_Y, z: 3 }).sx).toBeCloseTo(W / 2, 6);
  });

  it('shrinks things as they recede', () => {
    const near = cam.project({ x: 1, y: EYE_Y, z: 1 });
    const far = cam.project({ x: 1, y: EYE_Y, z: 5 });
    expect(Math.abs(near.sx - W / 2)).toBeGreaterThan(Math.abs(far.sx - W / 2));
    expect(near.scale).toBeGreaterThan(far.scale);
  });

  it('reports increasing depth for further points, for painter sorting', () => {
    expect(cam.project({ x: 0, y: 1, z: 1 }).depth)
      .toBeLessThan(cam.project({ x: 0, y: 1, z: 4 }).depth);
  });

  it('never divides by zero at the film plane', () => {
    const p = cam.project({ x: 0.5, y: 0.5, z: 0 });
    expect(Number.isFinite(p.sx)).toBe(true);
    expect(Number.isFinite(p.sy)).toBe(true);
  });

  it('places the floor below eye level and the ceiling above it on screen', () => {
    const floor = cam.project({ x: 0, y: 0, z: WALL_Z });
    const ceil = cam.project({ x: 0, y: 2.7, z: WALL_Z });
    expect(floor.sy).toBeGreaterThan(cam.vpy);
    expect(ceil.sy).toBeLessThan(cam.vpy);
  });
});

describe('projectBox — face visibility decided by geometry, not by special cases', () => {
  const at = (x: number): Box3 => ({ x, y: DESK_Y, z: 1.2, w: 0.4, h: 0.3, d: 0.3 });

  it('always shows the front face', () => {
    for (const x of [-2, 0, 2]) {
      expect(visibleFaces(cam, at(x)).map((q) => q.face)).toContain('front');
    }
  });

  it('shows the RIGHT face for a box left of centre', () => {
    const faces = visibleFaces(cam, at(-2)).map((q) => q.face);
    expect(faces).toContain('right');
    expect(faces).not.toContain('left');
  });

  it('shows the LEFT face for a box right of centre — mirror, with no special case', () => {
    const faces = visibleFaces(cam, at(2)).map((q) => q.face);
    expect(faces).toContain('left');
    expect(faces).not.toContain('right');
  });

  it('shows the TOP face for a box below eye level', () => {
    expect(visibleFaces(cam, at(0)).map((q) => q.face)).toContain('top');
  });

  it('shows the BOTTOM face for a box above eye level', () => {
    const high: Box3 = { x: 0, y: 2.2, z: 2.5, w: 0.6, h: 0.2, d: 0.3 };
    const faces = visibleFaces(cam, high).map((q) => q.face);
    expect(faces).toContain('bottom');
    expect(faces).not.toContain('top');
  });

  it('never shows opposite faces of a box at the same time', () => {
    // The real invariant. "At most three faces" holds only for ORTHOGRAPHIC projection;
    // under perspective a box straddling the centre line can legitimately show both side
    // faces (you see into it), which is a fourth face and is correct. What can never
    // happen is seeing a face AND its opposite — that would mean the winding test is
    // broken, which it was: an inverted shoelace sign showed every box's far faces and
    // hid its near ones.
    for (const x of [-3, -1, -0.2, 0, 0.2, 1, 3]) {
      const faces = new Set(visibleFaces(cam, at(x)).map((q) => q.face));
      for (const [a, b] of [['front', 'back'], ['left', 'right'], ['top', 'bottom']] as const) {
        expect(faces.has(a) && faces.has(b), `${a}+${b} both visible at x=${x}`).toBe(false);
      }
      expect(faces.size).toBeGreaterThan(0);
      expect(faces.size).toBeLessThanOrEqual(4);
    }
  });

  it('sorts faces back to front', () => {
    const qs = projectBox(cam, at(-1.5));
    for (let i = 1; i < qs.length; i++) {
      expect(qs[i].depth).toBeLessThanOrEqual(qs[i - 1].depth);
    }
  });

  it('gives a box on the desk a bounding box on screen', () => {
    const b = boxBounds(cam, at(0));
    expect(b.w).toBeGreaterThan(0);
    expect(b.h).toBeGreaterThan(0);
  });
});

describe('planes — the monitors', () => {
  const panel = (cx: number, yaw: number, tilt: number): Plane3 =>
    ({ cx, cy: 1.35, cz: 2.6, w: 0.62, h: 0.36, yaw, tilt });

  it('keeps a face-on panel symmetric', () => {
    const { pts } = projectPlane(cam, panel(0, 0, 0));
    const lH = Math.abs(pts[3][1] - pts[0][1]);
    const rH = Math.abs(pts[2][1] - pts[1][1]);
    expect(Math.abs(lH - rH)).toBeLessThan(1);
  });

  it('makes the nearer edge taller when a panel is yawed', () => {
    // Yaw is only visible as a difference between the two vertical edges. This is the
    // property that makes a panel read as an object rather than a rectangle.
    const { pts } = projectPlane(cam, panel(0, 0.3, 0));
    const lH = Math.abs(pts[3][1] - pts[0][1]);
    const rH = Math.abs(pts[2][1] - pts[1][1]);
    expect(Math.abs(lH - rH)).toBeGreaterThan(2);
  });

  it('tilting back pushes the top edge away, so it projects lower', () => {
    const flat = projectPlane(cam, panel(0, 0, 0));
    const tilted = projectPlane(cam, panel(0, 0, 0.16));
    const topFlat = Math.min(flat.pts[0][1], flat.pts[1][1]);
    const topTilt = Math.min(tilted.pts[0][1], tilted.pts[1][1]);
    expect(topTilt).toBeGreaterThan(topFlat);
  });

  it('preserves the panel size — corners stay a rectangle in world space', () => {
    const cs = planeCorners(panel(1.2, 0.4, 0.1));
    const d = (a: typeof cs[0], b: typeof cs[0]) =>
      Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    expect(d(cs[0], cs[1])).toBeCloseTo(0.62, 6);   // top edge
    expect(d(cs[3], cs[2])).toBeCloseTo(0.62, 6);   // bottom edge
    expect(d(cs[0], cs[3])).toBeCloseTo(0.36, 6);   // left edge
    expect(d(cs[1], cs[2])).toBeCloseTo(0.36, 6);   // right edge
  });

  it('gives every panel a positive on-screen bounding box', () => {
    for (const x of [-1.8, 0, 1.8]) {
      const b = planeBounds(cam, panel(x, faceViewer(x, 2.6), 0.1));
      expect(b.w).toBeGreaterThan(0);
      expect(b.h).toBeGreaterThan(0);
    }
  });
});

describe('faceViewer — the rig curves on one shared rule', () => {
  it('turns panels inward, and more so the further out they sit', () => {
    const near = faceViewer(0.6, 2.6);
    const far = faceViewer(2.2, 2.6);
    expect(far).toBeGreaterThan(near);
    expect(near).toBeGreaterThan(0);
  });

  it('is antisymmetric about the centre line', () => {
    expect(faceViewer(-1.5, 2.6)).toBeCloseTo(-faceViewer(1.5, 2.6), 9);
  });

  it('leaves a centred panel unyawed', () => {
    expect(faceViewer(0, 2.6)).toBeCloseTo(0, 9);
  });
});

describe('the room is dimensionally sane', () => {
  it('seats the viewer at the desk, with the desk below eye level', () => {
    expect(DESK_Y).toBeLessThan(EYE_Y);
    expect(DESK_Z_NEAR).toBeLessThan(DESK_Z_FAR);
  });

  it('puts the back wall beyond the desk', () => {
    expect(WALL_Z).toBeGreaterThan(DESK_Z_FAR);
  });
});
