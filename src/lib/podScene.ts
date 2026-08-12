// src/lib/podScene.ts
// The pod as FLAT MODERNIST ARCHITECTURE — bold colour planes, clean edges, hard sun and
// shadow, silhouette figures. Barragán / Bauhaus by way of vaporwave, which is what the
// owner means by "retrofuturism": clean lines, clean colours, bold structures.
//
// NOT the previous "retro" attempt. That was 1960s mission control — chrome, rivets,
// needle gauges, CRT scanlines, dark and cluttered. This is the opposite discipline:
// almost no detail, enormous flat shapes, and colour doing all the work.
//
// WHY THIS IS THE RIGHT PAIRING WITH podCamera:
// This style is large flat planes meeting at clean angles — which is exactly what
// projectBox() returns: one flat fill per visible face. Lit face light, shadow face dark,
// no texture, no gradients inside a face. The style and the geometry engine want the same
// thing, so there is nothing to fake.
//
// THE SCENE, and why it is an open terrace rather than a room:
// An enclosed office is what made every previous version feel dark and dull. Here the pod
// is a rooftop workstation on a modernist terrace at sunset: a sky gradient with a sun
// disc, a cream colonnade wall, stepped coral and teal masses, a pool, plants, and a
// seated silhouette — you. The desk and its screens are the same objects in the same
// world positions as before, just lit and coloured for daylight.

import {
  makeCamera, projectBox, visibleFaces, projectPlane, planeBounds, faceViewer,
  EYE_Y, WALL_Z, CEIL_Y, ROOM_HALF_W, DESK_Y, DESK_Z_NEAR, DESK_Z_FAR, DESK_THICK,
  type CameraView, type Box3, type Plane3, type Face,
} from './podCamera';
import { ideLines, backtestCurve, bloombergRows, type GanttBar } from './podScreens';

type Ctx = CanvasRenderingContext2D;

// ── Palette ─────────────────────────────────────────────────────────────────
// ANCHORED ON THE SITE'S TOKENS, then extended to the saturation this style needs.
// The bridge is deliberate and worth stating, because CLAUDE.md says the vermilion seal is
// the only saturated colour in the light theme:
//     seal   #b23a2e  →  coral / terracotta family
//     ochre  #c8a36a  →  mustard / sand family
//     indigo #6d7689  →  teal / turquoise family
//     paper  #efe9dd  →  the cream masses
// So every hue here descends from a token; the change is chroma, not hue. This is a
// per-style exception for the pod (already a human-approved standalone art piece), not a
// change to the site's palette.

export interface ScenePal {
  /** Sky, top to bottom. */
  skyTop: string; skyMid: string; skyLow: string;
  sun: string; sunHalo: string;
  /** The five structural colours. Each mass takes ONE of these, flat. */
  cream: string; creamShade: string;
  coral: string; coralShade: string;
  teal: string; tealShade: string;
  mint: string; mintShade: string;
  mustard: string; mustardShade: string;
  /** Deep shade for recesses and cast shadow. */
  shadow: string; deepShadow: string;
  /** Silhouettes and hard graphic marks. */
  ink: string;
  /** Water. */
  water: string; waterDeep: string; waterLine: string;
  /** Screens: a bright face and the graphic marks on it. */
  screen: string; screenInk: string; screenAccent: string; screenWarn: string;
  /** Plants. */
  leaf: string; leafDark: string;
}

export function scenePalette(theme: 'light' | 'dark'): ScenePal {
  return theme === 'dark'
    ? {
        // Dusk: the same architecture after the sun has dropped. Cooler, deeper, and the
        // screens become the light source — which keeps the terminal-galaxy identity the
        // dark theme exists for.
        skyTop: '#131a2e', skyMid: '#2b2b4d', skyLow: '#5b3a54',
        sun: '#e0574a', sunHalo: '#8a3b48',
        cream: '#c9c3b4', creamShade: '#8e8a80',
        coral: '#b1483c', coralShade: '#78302a',
        teal: '#2f7f86', tealShade: '#1d5259',
        mint: '#66c28c', mintShade: '#3d7d5b',
        mustard: '#c2954f', mustardShade: '#836334',
        shadow: '#1b2130', deepShadow: '#0d1119',
        ink: '#080a10',
        water: '#2a6f7d', waterDeep: '#17434f', waterLine: '#7fd4d0',
        screen: '#0d1a18', screenInk: '#dce1dc', screenAccent: '#66c28c', screenWarn: '#e0574a',
        leaf: '#4e9e6d', leafDark: '#2c6041',
      }
    : {
        // Sunset. The reference's register: coral sky, cream masses, teal water.
        skyTop: '#f2764f', skyMid: '#f79a72', skyLow: '#f6c3a4',
        sun: '#ef5d3c', sunHalo: '#f58d63',
        cream: '#f2ece0', creamShade: '#cdc4b4',
        coral: '#e2694a', coralShade: '#b84a34',
        teal: '#3fa1a8', tealShade: '#2a7078',
        mint: '#7fc9a0', mintShade: '#54946f',
        mustard: '#e2a94e', mustardShade: '#b07f33',
        shadow: '#5d4a41', deepShadow: '#3a2d28',
        ink: '#1b1512',
        water: '#4bb3b6', waterDeep: '#2c8590', waterLine: '#bfeae6',
        screen: '#12211f', screenInk: '#f2ece0', screenAccent: '#7fc9a0', screenWarn: '#e2694a',
        leaf: '#5aa878', leafDark: '#34714c',
      };
}

/** Which palette pair a mass is painted in. One flat colour per mass — that is the style's
 *  central rule, and the reason it reads as clean. */
export type MassTone = 'cream' | 'coral' | 'teal' | 'mint' | 'mustard' | 'shadow' | 'ink';

function toneFaces(p: ScenePal, tone: MassTone): Record<Face, string> {
  const pair: Record<MassTone, [string, string]> = {
    cream: [p.cream, p.creamShade],
    coral: [p.coral, p.coralShade],
    teal: [p.teal, p.tealShade],
    mint: [p.mint, p.mintShade],
    mustard: [p.mustard, p.mustardShade],
    shadow: [p.shadow, p.deepShadow],
    ink: [p.ink, p.ink],
  };
  const [lit, shade] = pair[tone];
  // The sun is high and to the LEFT, so left and top faces are lit, right faces are in
  // shade. Consistent for every mass in the scene — one light source, like one camera.
  return { top: lit, left: lit, front: shade, right: shade, back: shade, bottom: p.deepShadow };
}

// ── The scene, in world metres ──────────────────────────────────────────────
// Positions chosen so the desk and screens land where the camera expects a seated viewer,
// and the architecture builds outward and upward from there.

const DESK: Box3 = {
  x: -2.6, y: DESK_Y - DESK_THICK, z: DESK_Z_NEAR,
  w: 5.2, h: DESK_THICK, d: DESK_Z_FAR - DESK_Z_NEAR,
};

/** The five destination screens plus two ambient, as tilted planes on the desk's far side.
 *  Same seven-screen rig as before; the geometry is now real world space. */
export interface ScreenPlace {
  slot: number | null;
  ambient?: 'heat' | 'tape';
  plane: Plane3;
}

const SCREEN_Z = DESK_Z_FAR - 0.12;
const PRIMARY_W = 0.98, PRIMARY_H = 0.58;
const SECOND_W = 0.72, SECOND_H = 0.42;
const TILT = 0.10;

function panel(cx: number, cy: number, w: number, h: number): Plane3 {
  return { cx, cy, cz: SCREEN_Z, w, h, yaw: faceViewer(cx, SCREEN_Z), tilt: TILT };
}

export const SCREENS: ScreenPlace[] = [
  // Upper row: ambient, Writing, Market reports, ambient.
  { slot: null, ambient: 'heat', plane: panel(-2.02, 1.86, SECOND_W, SECOND_H) },
  { slot: 3, plane: panel(-0.71, 1.90, SECOND_W, SECOND_H) },
  { slot: 4, plane: panel(0.71, 1.90, SECOND_W, SECOND_H) },
  { slot: null, ambient: 'tape', plane: panel(2.02, 1.86, SECOND_W, SECOND_H) },
  // Primary row: the three big destinations at eye level.
  { slot: 0, plane: panel(-1.30, 1.26, PRIMARY_W, PRIMARY_H) },
  { slot: 1, plane: panel(0, 1.28, PRIMARY_W, PRIMARY_H) },
  { slot: 2, plane: panel(1.30, 1.26, PRIMARY_W, PRIMARY_H) },
];

/** Screen rects as buffer FRACTIONS, for the DOM overlay's real links. Same contract as
 *  before: the painter and the overlay read one source, so they cannot drift apart. */
export function sceneScreens(W: number, H: number): {
  slot: number; left: number; top: number; width: number; height: number;
}[] {
  const cam = makeCamera(W, H);
  return SCREENS
    .filter((s): s is ScreenPlace & { slot: number } => s.slot !== null)
    .map((s) => {
      const b = planeBounds(cam, s.plane);
      return {
        slot: s.slot,
        left: (b.x / W) * 100, top: (b.y / H) * 100,
        width: (b.w / W) * 100, height: (b.h / H) * 100,
      };
    })
    .sort((a, b) => a.slot - b.slot);
}

// ── Drawing ─────────────────────────────────────────────────────────────────

function poly(ctx: Ctx, pts: [number, number][]) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

/** Draw a world box as flat faces. No outlines: in this style the colour boundary IS the
 *  edge, and adding strokes makes it look like a diagram instead of a painting. */
function mass(ctx: Ctx, cam: CameraView, p: ScenePal, b: Box3, tone: MassTone) {
  const faces = toneFaces(p, tone);
  for (const q of visibleFaces(cam, b)) {
    poly(ctx, q.pts);
    ctx.fillStyle = faces[q.face];
    ctx.fill();
  }
}

/** Deterministic pseudo-random. No Math.random(): the scene repaints on hover and theme
 *  change, and fresh randomness would make every plant and window twitch. */
function hash(i: number): number {
  const h = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return h - Math.floor(h);
}

export interface SceneOpts {
  theme: 'light' | 'dark';
  hoverSlot: number | null;
  gantt: GanttBar[];
  /** Seconds since mount. Drives ONLY slow ambient life (sun drift, water, tape) and is
   *  ignored entirely under prefers-reduced-motion, where the static frame is finished. */
  t: number;
}

export function paintScene(ctx: Ctx, W: number, H: number, o: SceneOpts): void {
  const p = scenePalette(o.theme);
  const cam = makeCamera(W, H);
  ctx.imageSmoothingEnabled = true;
  ctx.lineJoin = 'miter';

  drawSky(ctx, W, H, p, o);
  drawSkyline(ctx, cam, p);
  drawColonnade(ctx, cam, p);
  drawTerraceMasses(ctx, cam, p);
  drawPool(ctx, cam, p, W, H, o);
  drawPlants(ctx, cam, p);
  drawDesk(ctx, cam, p);
  drawScreens(ctx, cam, p, o);
  drawDeskObjects(ctx, cam, p);
  drawFigure(ctx, cam, p);
  drawGrain(ctx, W, H, p);
}

/** The sky: one broad gradient and a hard-edged sun disc. The disc is the reference's
 *  signature — a flat circle, no glow falloff inside it. */
function drawSky(ctx: Ctx, W: number, H: number, p: ScenePal, o: SceneOpts) {
  const g = ctx.createLinearGradient(0, 0, 0, H * 0.78);
  g.addColorStop(0, p.skyTop);
  g.addColorStop(0.55, p.skyMid);
  g.addColorStop(1, p.skyLow);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // The sun drifts a few pixels over minutes — ambient life, not animation you can catch.
  const drift = Math.sin(o.t * 0.03) * 6;
  const sx = W * 0.26, sy = H * 0.20 + drift, r = Math.min(W, H) * 0.15;
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.arc(sx, sy, r * 1.5, 0, Math.PI * 2);
  ctx.fillStyle = p.sunHalo;
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(sx, sy, r, 0, Math.PI * 2);
  ctx.fillStyle = p.sun;
  ctx.fill();

  // Birds: three or four hard little chevrons, the reference's one loose gesture.
  ctx.strokeStyle = p.ink;
  ctx.lineWidth = Math.max(1.5, W / 700);
  ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const bx = W * (0.34 + i * 0.045) + Math.sin(o.t * 0.06 + i) * 8;
    const by = H * (0.10 + hash(i * 5.3) * 0.07);
    const s = Math.min(W, H) * (0.012 + hash(i * 2.1) * 0.008);
    ctx.beginPath();
    ctx.moveTo(bx - s, by);
    ctx.lineTo(bx, by - s * 0.55);
    ctx.lineTo(bx + s, by);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
}

/** A far skyline of flat blocks: depth without detail. Sits beyond the wall plane. */
function drawSkyline(ctx: Ctx, cam: CameraView, p: ScenePal) {
  const z = WALL_Z + 14;
  ctx.save();
  ctx.globalAlpha = 0.28;
  for (let i = 0; i < 16; i++) {
    const w = 1.1 + hash(i * 3.1) * 2.2;
    const h = 1.4 + hash(i * 5.7) * 4.4;
    const x = -13 + i * 1.7;
    mass(ctx, cam, p, { x, y: 0, z: z + hash(i * 7.3) * 6, w, h, d: 1.2 }, 'shadow');
  }
  ctx.restore();
}

/** The cream back wall, pierced by an arcade of tall arched openings. The colonnade is the
 *  single most identifiable gesture in the reference. */
function drawColonnade(ctx: Ctx, cam: CameraView, p: ScenePal) {
  const wall: Box3 = { x: -ROOM_HALF_W - 1.2, y: 0, z: WALL_Z, w: (ROOM_HALF_W + 1.2) * 2, h: CEIL_Y + 1.1, d: 0.45 };
  mass(ctx, cam, p, wall, 'cream');

  // Openings cut as dark arches on the wall's front face. Drawn in screen space against
  // the projected wall, so they follow the perspective exactly.
  const yBase = 0.42, yTop = CEIL_Y + 0.30;
  const count = 7;
  for (let i = 0; i < count; i++) {
    const cx = -ROOM_HALF_W - 0.4 + (i + 0.5) * ((ROOM_HALF_W + 0.4) * 2 / count);
    const halfW = 0.29;
    const [lx, ly] = cam.xy({ x: cx - halfW, y: yBase, z: WALL_Z });
    const [rx] = cam.xy({ x: cx + halfW, y: yBase, z: WALL_Z });
    const [, springY] = cam.xy({ x: cx, y: yTop - halfW * 1.05, z: WALL_Z });
    // A SEMICIRCULAR head (a true arc springing from the jambs), not a quadratic curve to
    // an apex — that produced a pointed gothic arch, which is the wrong century for this
    // style. Modernist arcades are round-headed.
    const r = (rx - lx) / 2;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(lx, springY);
    ctx.arc((lx + rx) / 2, springY, r, Math.PI, 0);
    ctx.lineTo(rx, ly);
    ctx.closePath();
    ctx.fillStyle = p.deepShadow;
    ctx.fill();
    // A rose in a few of them — the reference's roses against the arches.
    if (i % 3 === 1) {
      const fx = (lx + rx) / 2, fy = springY + (ly - springY) * 0.42;
      ctx.beginPath();
      ctx.arc(fx, fy, Math.max(2.5, (rx - lx) * 0.15), 0, Math.PI * 2);
      ctx.fillStyle = p.sun;
      ctx.fill();
      ctx.strokeStyle = p.leafDark;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx, fy + (ly - fy) * 0.7);
      ctx.stroke();
    }
  }

  // A dark eaves slab overhanging the colonnade — hard shadow line across the cream.
  mass(ctx, cam, p, {
    x: -ROOM_HALF_W - 1.4, y: CEIL_Y + 1.1, z: WALL_Z - 0.9,
    w: (ROOM_HALF_W + 1.4) * 2, h: 0.22, d: 1.5,
  }, 'shadow');
}

/** Stepped coral, teal, mint and mustard masses flanking the desk — the reference's
 *  interlocking blocks and staircases. These carry the colour. */
function drawTerraceMasses(ctx: Ctx, cam: CameraView, p: ScenePal) {
  // Left: a coral wall with a stepped top, stepping DOWN toward the centre.
  for (let i = 0; i < 5; i++) {
    mass(ctx, cam, p, {
      x: -ROOM_HALF_W - 0.9 + i * 0.42, y: 0, z: WALL_Z - 1.5 - i * 0.16,
      w: 0.44, h: 1.85 - i * 0.20, d: 0.9,
    }, 'coral');
  }
  // Right: a teal mass with a mustard staircase climbing it.
  mass(ctx, cam, p, { x: 2.35, y: 0, z: WALL_Z - 1.9, w: 1.6, h: 1.55, d: 1.0 }, 'teal');
  for (let i = 0; i < 6; i++) {
    mass(ctx, cam, p, {
      x: 2.2 + i * 0.20, y: 0, z: WALL_Z - 2.5,
      w: 0.22, h: 0.32 + i * 0.24, d: 0.5,
    }, 'mustard');
  }
  // A mint plinth behind the desk's left end, and a cream one at its right.
  mass(ctx, cam, p, { x: -2.9, y: 0, z: WALL_Z - 3.1, w: 0.9, h: 0.95, d: 0.7 }, 'mint');
  mass(ctx, cam, p, { x: 2.05, y: 0, z: WALL_Z - 3.4, w: 0.7, h: 0.62, d: 0.6 }, 'cream');
}

/** A pool in front of the desk, filling the foreground. Flat teal with a few hard
 *  highlight lines that drift — the reference's water, and the scene's ambient life. */
function drawPool(ctx: Ctx, cam: CameraView, p: ScenePal, W: number, H: number, o: SceneOpts) {
  const zNear = 0.05, zFar = DESK_Z_NEAR - 0.02;
  const corners: [number, number][] = [
    cam.xy({ x: -8, y: 0, z: zFar }), cam.xy({ x: 8, y: 0, z: zFar }),
    cam.xy({ x: 12, y: 0, z: zNear }), cam.xy({ x: -12, y: 0, z: zNear }),
  ];
  poly(ctx, corners);
  ctx.save();
  ctx.clip();
  const g = ctx.createLinearGradient(0, cam.xy({ x: 0, y: 0, z: zFar })[1], 0, H);
  g.addColorStop(0, p.waterDeep);
  g.addColorStop(1, p.water);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Hard horizontal highlight bars, drifting slowly. No blur — flat marks only.
  ctx.fillStyle = p.waterLine;
  for (let i = 0; i < 7; i++) {
    const zz = zFar - 0.04 - i * 0.075;
    const [, yy] = cam.xy({ x: 0, y: 0, z: Math.max(0.06, zz) });
    const phase = o.t * 0.12 + i * 1.7;
    const w = W * (0.10 + 0.05 * Math.sin(phase));
    const x = W * (0.16 + i * 0.11) + Math.sin(phase * 0.7) * W * 0.02;
    ctx.globalAlpha = 0.30 + 0.16 * Math.sin(phase * 1.3);
    ctx.fillRect(x, yy, w, Math.max(2, H * 0.006));
  }
  ctx.globalAlpha = 1;

  // A single swimmer silhouette, the reference's submerged figure.
  const [fx, fy] = cam.xy({ x: -1.7, y: 0, z: 0.34 });
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = p.ink;
  ctx.translate(fx, fy);
  ctx.rotate(-0.12);
  ctx.beginPath();
  ctx.ellipse(0, 0, W * 0.045, H * 0.011, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(W * 0.045, -H * 0.004, H * 0.012, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

/** Fan palms: flat leaf blades from a single origin. The reference's one organic form
 *  against all that geometry, and it must stay a silhouette, not an illustration. */
function drawPlants(ctx: Ctx, cam: CameraView, p: ScenePal) {
  const spots: [number, number, number][] = [
    [-3.15, WALL_Z - 3.0, 0.72], [2.62, WALL_Z - 2.2, 0.62], [-2.05, WALL_Z - 0.7, 0.5],
  ];
  for (const [x, z, scale] of spots) {
    const [bx, by] = cam.xy({ x, y: 0.02, z });
    const [, topY] = cam.xy({ x, y: scale, z });
    const len = by - topY;
    for (let i = 0; i < 11; i++) {
      const a = -Math.PI / 2 + (i - 5) * 0.21;
      const l = len * (0.62 + hash(i * 3.7 + x) * 0.48);
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(
        bx + Math.cos(a) * l * 0.6, by + Math.sin(a) * l * 0.75,
        bx + Math.cos(a) * l, by + Math.sin(a) * l * 0.92,
      );
      ctx.lineWidth = Math.max(2, len * 0.055);
      ctx.strokeStyle = i % 2 ? p.leaf : p.leafDark;
      ctx.stroke();
    }
  }
}

function drawDesk(ctx: Ctx, cam: CameraView, p: ScenePal) {
  // The plinth FIRST, so the slab's front edge overhangs it and casts the shadow line that
  // makes the desk sit on the ground rather than hover. It runs the full depth from the
  // pool's edge to the wall: a shorter plinth left a visible gap under the desk and the
  // whole thing read as floating.
  mass(ctx, cam, p, {
    x: -1.62, y: 0, z: DESK_Z_NEAR + 0.02, w: 3.24, h: DESK_Y - DESK_THICK,
    d: (DESK_Z_FAR - DESK_Z_NEAR) - 0.10,
  }, 'mustard');
  // Two side returns, so the desk is supported across its whole width.
  for (const x of [-2.52, 1.66]) {
    mass(ctx, cam, p, {
      x, y: 0, z: DESK_Z_NEAR + 0.30, w: 0.86, h: DESK_Y - DESK_THICK, d: 1.10,
    }, 'cream');
  }
  // The slab.
  mass(ctx, cam, p, DESK, 'cream');
  // A coral riser the screens sit on, so the rig reads as built into the terrace.
  mass(ctx, cam, p, {
    x: -2.45, y: DESK_Y, z: DESK_Z_FAR - 0.34, w: 4.9, h: 0.42, d: 0.34,
  }, 'coral');
}

function drawScreens(ctx: Ctx, cam: CameraView, p: ScenePal, o: SceneOpts) {
  // Far to near, so nearer panels occlude further ones.
  const ordered = [...SCREENS].sort((a, b) =>
    projectPlane(cam, b.plane).depth - projectPlane(cam, a.plane).depth);

  for (const s of ordered) {
    const { pts } = projectPlane(cam, s.plane);
    const hot = s.slot !== null && o.hoverSlot === s.slot;

    // A slim dark housing behind the glass: the panel's own body, one flat shape.
    ctx.save();
    ctx.translate(0, Math.max(2, cam.H * 0.004));
    poly(ctx, pts);
    ctx.fillStyle = p.deepShadow;
    ctx.fill();
    ctx.restore();

    // The glass.
    poly(ctx, pts);
    ctx.save();
    ctx.clip();
    ctx.fillStyle = p.screen;
    ctx.fill();
    const b = planeBounds(cam, s.plane);
    ctx.translate(b.x, b.y);
    if (s.slot === null) drawAmbientArt(ctx, p, s.ambient!, b.w, b.h);
    else drawDestinationArt(ctx, p, s.slot, b.w, b.h, o);
    ctx.restore();

    // HOVER: quiet — a single accent hairline along the panel's bottom edge. No ring, no
    // bloom; the previous loud version read as an error state.
    if (hot) {
      ctx.beginPath();
      ctx.moveTo(pts[3][0], pts[3][1]);
      ctx.lineTo(pts[2][0], pts[2][1]);
      ctx.lineWidth = Math.max(2, cam.H * 0.004);
      ctx.strokeStyle = p.screenAccent;
      ctx.stroke();
    }
  }
}

/** Screen art, flat and graphic: this style would be ruined by dense pseudo-UI, so each
 *  screen shows ONE strong mark plus a real caption. */
function drawDestinationArt(ctx: Ctx, p: ScenePal, slot: number, w: number, h: number, o: SceneOpts) {
  const pad = Math.max(6, w * 0.06);
  ctx.font = `500 ${Math.max(8, h * 0.11)}px "JetBrains Mono", ui-monospace, monospace`;
  ctx.textBaseline = 'top';

  if (slot === 0) {
    // Code, as bold indent bars — the shape of a program.
    const lines = ideLines().slice(0, 9);
    const lh = (h - pad * 2) / lines.length;
    lines.forEach((ln, i) => {
      const y = pad + i * lh;
      const x = pad + ln.indent * w * 0.055;
      const len = Math.min(w - x - pad, w * (0.24 + (ln.tokens.length / 9) * 0.5));
      ctx.fillStyle = i === 2 || i === 6 ? p.screenAccent : p.screenInk;
      ctx.globalAlpha = i === 2 || i === 6 ? 1 : 0.5;
      ctx.fillRect(x, y, len, Math.max(2, lh * 0.34));
      ctx.globalAlpha = 1;
    });
  } else if (slot === 1) {
    // One equity curve, thick, with a flat fill under it.
    const pts = backtestCurve(48);
    const pw = w - pad * 2, ph = h - pad * 2.4;
    ctx.beginPath();
    pts.forEach((pt, i) => {
      const x = pad + (i / (pts.length - 1)) * pw;
      const y = pad + (1 - pt.y) * ph;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.lineTo(pad + pw, pad + ph);
    ctx.lineTo(pad, pad + ph);
    ctx.closePath();
    ctx.fillStyle = p.screenAccent;
    ctx.globalAlpha = 0.22;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    pts.forEach((pt, i) => {
      const x = pad + (i / (pts.length - 1)) * pw;
      const y = pad + (1 - pt.y) * ph;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.lineWidth = Math.max(2, h * 0.035);
    ctx.strokeStyle = p.screenAccent;
    ctx.stroke();
  } else if (slot === 2) {
    // Career spans as bold bars, no axis furniture.
    const bars = o.gantt.slice(0, 5);
    if (!bars.length) return;
    const lo = Math.min(...bars.map((b) => b.start));
    const hi = Math.max(...bars.map((b) => b.end));
    const span = Math.max(1, hi - lo);
    const rowH = (h - pad * 2) / bars.length;
    bars.forEach((bar, i) => {
      const y = pad + i * rowH;
      const x0 = pad + ((bar.start - lo) / span) * (w - pad * 2);
      const x1 = pad + ((bar.end - lo) / span) * (w - pad * 2);
      ctx.fillStyle = bar.kind === 'education' ? p.screenAccent : p.screenInk;
      ctx.globalAlpha = bar.kind === 'education' ? 1 : 0.62;
      ctx.fillRect(x0, y + rowH * 0.2, Math.max(3, x1 - x0), rowH * 0.5);
      ctx.globalAlpha = 1;
    });
  } else if (slot === 3) {
    // A page: a title bar and one centred equation mark.
    ctx.fillStyle = p.screenInk;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(pad, pad, w * 0.5, Math.max(2, h * 0.055));
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(pad, pad + h * 0.19 + i * h * 0.095, (w - pad * 2) * (i === 4 ? 0.55 : 0.92), Math.max(1.5, h * 0.028));
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = p.screenAccent;
    ctx.fillRect(w * 0.22, h * 0.53, w * 0.56, Math.max(2, h * 0.05));
  } else {
    // Market rows: ticker stub, value stub, and a coloured change block.
    const rows = bloombergRows().slice(0, 6);
    const rowH = (h - pad * 2) / rows.length;
    rows.forEach((r, i) => {
      const y = pad + i * rowH + rowH * 0.22;
      const bh = Math.max(2, rowH * 0.44);
      ctx.fillStyle = p.screenInk;
      ctx.globalAlpha = 0.55;
      ctx.fillRect(pad, y, w * 0.20, bh);
      ctx.globalAlpha = 0.8;
      ctx.fillRect(pad + w * 0.26, y, w * 0.24, bh);
      ctx.globalAlpha = 1;
      ctx.fillStyle = r.up ? p.screenAccent : p.screenWarn;
      ctx.fillRect(pad + w * 0.58, y, w * 0.22, bh);
    });
  }
}

function drawAmbientArt(ctx: Ctx, p: ScenePal, kind: 'heat' | 'tape', w: number, h: number) {
  const pad = Math.max(4, w * 0.06);
  if (kind === 'heat') {
    const n = 8;
    const cw = (w - pad * 2) / n, ch = (h - pad * 2) / n;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const v = i === j ? 1 : hash(Math.min(i, j) * 31.7 + Math.max(i, j) * 11.3);
        ctx.globalAlpha = 0.14 + v * 0.8;
        ctx.fillStyle = v > 0.6 ? p.screenAccent : p.screenWarn;
        ctx.fillRect(pad + j * cw, pad + i * ch, cw - 1.5, ch - 1.5);
      }
    }
    ctx.globalAlpha = 1;
  } else {
    const rows = 6;
    const rowH = (h - pad * 2) / rows;
    for (let i = 0; i < rows; i++) {
      const up = hash(i * 9.7) > 0.5;
      ctx.fillStyle = up ? p.screenAccent : p.screenWarn;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(pad, pad + i * rowH, (w - pad * 2) * (0.3 + hash(i * 3.1) * 0.6), Math.max(2, rowH * 0.42));
      ctx.globalAlpha = 1;
    }
  }
}

/** Desk objects as simple flat masses. In this style a coffee cup is a cylinder-ish block
 *  and nothing more — detail would break the register. */
function drawDeskObjects(ctx: Ctx, cam: CameraView, p: ScenePal) {
  // Keyboard.
  mass(ctx, cam, p, { x: -0.62, y: DESK_Y, z: DESK_Z_NEAR + 0.30, w: 1.24, h: 0.03, d: 0.36 }, 'shadow');
  // Mug: a small teal block with a paler top, and its handle as one stroke.
  const mug: Box3 = { x: 0.90, y: DESK_Y, z: DESK_Z_NEAR + 0.34, w: 0.13, h: 0.15, d: 0.13 };
  mass(ctx, cam, p, mug, 'teal');
  // Fanned papers as three overlapping flat sheets.
  for (let i = 2; i >= 0; i--) {
    mass(ctx, cam, p, {
      x: 1.28 + i * 0.045, y: DESK_Y + i * 0.004, z: DESK_Z_NEAR + 0.20 + i * 0.03,
      w: 0.52, h: 0.004, d: 0.34,
    }, 'cream');
  }
  // The plush cow: two cream blocks and a coral muzzle. Recognisable by proportion only.
  mass(ctx, cam, p, { x: -1.72, y: DESK_Y, z: DESK_Z_NEAR + 0.26, w: 0.34, h: 0.17, d: 0.20 }, 'cream');
  mass(ctx, cam, p, { x: -1.50, y: DESK_Y + 0.13, z: DESK_Z_NEAR + 0.28, w: 0.16, h: 0.14, d: 0.15 }, 'cream');
  mass(ctx, cam, p, { x: -1.46, y: DESK_Y + 0.15, z: DESK_Z_NEAR + 0.25, w: 0.09, h: 0.06, d: 0.05 }, 'coral');
}

/** The seated silhouette — YOU. Pure flat ink, no interior detail, exactly like the
 *  reference's figures. This is the element that makes the scene a place with a person in
 *  it rather than an empty render, and it replaces the old near-black chair blob. */
function drawFigure(ctx: Ctx, cam: CameraView, p: ScenePal) {
  // Seated OFF the centre line and to the side, so the figure never masks the middle
  // monitor. A centred figure at this camera height became a black slab across the whole
  // composition — the reference's figures always sit to one side of the architecture.
  const seatZ = DESK_Z_NEAR - 0.34;
  const fx = 1.62;
  const [hx, hy] = cam.xy({ x: fx, y: 1.34, z: seatZ });        // head
  const [sx, sy] = cam.xy({ x: fx, y: 1.10, z: seatZ });        // shoulders
  const [wx, wy] = cam.xy({ x: fx, y: 0.74, z: seatZ });        // waist
  const headR = Math.abs(sy - hy) * 0.40;

  // The chair: a low flat mass BEHIND the figure, in shade rather than ink, so it reads as
  // furniture instead of a hole in the picture.
  mass(ctx, cam, p, {
    x: fx - 0.34, y: 0.20, z: seatZ + 0.16, w: 0.68, h: 0.62, d: 0.42,
  }, 'shadow');

  ctx.fillStyle = p.ink;
  // Head, with a suggestion of hair as one offset arc — enough to read as a person.
  ctx.beginPath();
  ctx.arc(hx, hy, headR, 0, Math.PI * 2);
  ctx.fill();
  // Neck.
  ctx.fillRect(hx - headR * 0.32, hy, headR * 0.64, Math.abs(sy - hy) * 0.5);
  // Torso: shoulders down to waist, a clean tapered silhouette.
  const shW = headR * 2.0, wsW = headR * 1.55;
  poly(ctx, [[sx - shW, sy], [sx + shW, sy], [wx + wsW, wy], [wx - wsW, wy]]);
  ctx.fill();
  // Rounded shoulder line, so the torso is not a hard-cornered box.
  ctx.beginPath();
  ctx.ellipse(sx, sy, shW, headR * 0.7, 0, Math.PI, 0);
  ctx.fill();
  // One forearm resting on the desk in front of the figure — NOT reaching across to the
  // keyboard. Aiming at the centred keyboard from an off-centre seat drew a long black bar
  // straight across the whole desk, which read as a girder rather than an arm.
  const [ex, ey] = cam.xy({ x: fx - 0.46, y: DESK_Y + 0.04, z: DESK_Z_NEAR + 0.22 });
  ctx.lineWidth = headR * 0.58;
  ctx.lineCap = 'round';
  ctx.strokeStyle = p.ink;
  ctx.beginPath();
  ctx.moveTo(sx - shW * 0.72, sy + headR * 0.7);
  ctx.quadraticCurveTo(sx - shW * 1.1, (sy + ey) / 2, ex, ey);
  ctx.stroke();
  ctx.lineCap = 'butt';
}

/** A whisper of grain over everything. The reference is a print, and a perfectly clean
 *  canvas gradient looks digital next to it. Deterministic, so it never shimmers. */
function drawGrain(ctx: Ctx, W: number, H: number, p: ScenePal) {
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = p.ink;
  const step = 3;
  for (let i = 0; i < 2600; i++) {
    const x = Math.floor(hash(i * 1.37) * (W / step)) * step;
    const y = Math.floor(hash(i * 2.71) * (H / step)) * step;
    ctx.fillRect(x, y, step, step);
  }
  ctx.restore();
}
