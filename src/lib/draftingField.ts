// src/lib/draftingField.ts
//
// THE DRAFTING FIELD — /projects' background, as pure math. A slowly drifting Gaussian mixture (the same kind
// of field as the homepage hero) whose isolines are drawn as hairlines, with axis ticks along the edges, three
// probe crosshairs reading out the live elevation, and two sonar pings when the boot finishes. After the pings,
// nothing but the drift, "so that readers can read quietly."
//
// Every value here is the approved mockup's, copied rather than retuned. The component that paints it owns the
// canvas, the clock and the colours; this module owns what the numbers are, so they can be tested.

/** [x, y, amplitude, width, drift-x, drift-y, period (s), phase] — the mockup's `BASE`. */
export const FIELD_BASE: readonly [x: number, y: number, a: number, w: number, dx: number, dy: number, period: number, phase: number][] = [
  [-1.6, -0.5, 1.15, 0.9, 0.35, 0.22, 46, 0], [1.4, 0.7, 0.95, 0.75, 0.28, 0.3, 58, 1.7],
  [0.3, -1.2, -0.7, 0.6, 0.4, 0.18, 39, 3.1], [2.3, -1.1, 0.6, 0.5, 0.22, 0.26, 51, 0.6],
  [-2.4, 1.1, -0.55, 0.7, 0.3, 0.2, 63, 2.3], [0.4, 1.3, 0.45, 0.55, 0.25, 0.32, 44, 4.4],
];

/** The viewport always spans FIELD_SPAN field units across, starting at FIELD_X0; one sample every FIELD_CELL px. */
export const FIELD_X0 = -3.2, FIELD_SPAN = 6.4, FIELD_CELL = 12;

/** k * 0.085 for k = -8..15. */
export const FIELD_LEVELS: readonly number[] = Array.from({ length: 24 }, (_, i) => (i - 8) * 0.085);

export const PING_DELAYS_MS = [200, 2100] as const;
export const PING_SPEED = 300; // px / s

/** ~15fps for the drift, which moves about a pixel a frame at that rate; ~30fps only while a ping travels. */
export const FRAME_MS = { idle: 66, ping: 33 } as const;

/** Probe crosshairs, as fractions of the viewport [x, y]. */
export const PROBES = [[0.78, 0.3], [0.36, 0.66], [0.64, 0.8]] as const;

/** The drifted centres at time `tSec`, as [x, y, amplitude, width]. The y drift runs 1.3x slower than the x. */
export function centersAt(tSec: number): [number, number, number, number][] {
  return FIELD_BASE.map(([x, y, a, w, dx, dy, per, ph]): [number, number, number, number] => [
    x + dx * Math.sin((tSec * 2 * Math.PI) / per + ph),
    y + dy * Math.cos((tSec * 2 * Math.PI) / (per * 1.3) + ph),
    a, w,
  ]);
}

/**
 * The field's elevation at (x, y): a faint ripple plus one Gaussian per centre.
 *
 * An indexed loop on purpose: this runs ~16,500 times a frame at 2000x1100, and `for (const [cx, cy, a, w] of
 * centers)` measured 1.66 ms for the grid against 1.05 ms indexed (Node 24, median of 80 frames) — about +1% of a
 * core at 15fps, against a quiet-drift budget of 6%.
 */
export function fieldAt(x: number, y: number, tSec: number, centers: ReturnType<typeof centersAt>): number {
  let v = 0.05 * Math.sin(1.7 * x + tSec * 0.05) * Math.cos(1.3 * y);
  for (let i = 0; i < centers.length; i++) {
    const c = centers[i], dx = x - c[0], dy = y - c[1];
    v += c[2] * Math.exp(-(dx * dx + dy * dy) / (2 * c[3] * c[3]));
  }
  return v;
}

/** Field units per px, and the field y at the top edge — the frame is vertically centred on y = 0. */
function scale(widthPx: number, heightPx: number): { sx: number; y0: number } {
  const sx = FIELD_SPAN / widthPx;
  return { sx, y0: -(heightPx * sx) / 2 };
}

/**
 * The field sampled every FIELD_CELL px over a viewport: (cols+1) x (rows+1) values, row-major with stride
 * cols+1, sample (i, j) at px (i * FIELD_CELL, j * FIELD_CELL) — the layout `isoSegments` reads. A fresh buffer
 * on every call.
 */
export function sampleGrid(widthPx: number, heightPx: number, tSec: number): { grid: Float32Array; cols: number; rows: number; sx: number; y0: number } {
  const { sx, y0 } = scale(widthPx, heightPx);
  const cols = Math.ceil(widthPx / FIELD_CELL), rows = Math.ceil(heightPx / FIELD_CELL), stride = cols + 1;
  const centers = centersAt(tSec);
  const grid = new Float32Array(stride * (rows + 1));
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) grid[j * stride + i] = fieldAt(FIELD_X0 + i * FIELD_CELL * sx, y0 + j * FIELD_CELL * sx, tSec, centers);
  }
  return { grid, cols, rows, sx, y0 };
}

/** A ping: where it started, in px, and when, in the same seconds the frame clock uses. */
export interface Ring { x: number; y: number; t0: number }

/**
 * A ping starting now from one of the field's BASINS — a centre with negative amplitude — drifted to `tSec`.
 * `u` in [0, 1) picks which (pass `Math.random()`). The spec says the pings "spread from basins"; the mockup
 * picked any of the six centres, and four of those are peaks.
 */
export function pingAt(tSec: number, widthPx: number, heightPx: number, u: number): Ring {
  const basins = centersAt(tSec).filter((c) => c[2] < 0);
  const [cx, cy] = basins[Math.min(basins.length - 1, Math.floor(u * basins.length))];
  const { sx, y0 } = scale(widthPx, heightPx);
  return { x: (cx - FIELD_X0) / sx, y: (cy - y0) / sx, t0: tSec };
}

/**
 * A ping's radius (px) and how much of it is left (1 → 0), or null once it has spread past `maxR`. A frame
 * stamped a moment before `t0` — a rAF timestamp predates the timer that started the ping — reads as radius 0.
 */
export function ringState(r: Ring, tSec: number, maxR: number): { R: number; fade: number } | null {
  const R = Math.max(0, tSec - r.t0) * PING_SPEED;
  return R > maxR ? null : { R, fade: 1 - R / maxR };
}

/** True when a point is on the ping's lit band, which narrows as the ping fades. */
export function litByRing(mx: number, my: number, s: { R: number; fade: number }, r: Ring): boolean {
  return Math.abs(Math.hypot(mx - r.x, my - r.y) - s.R) < 34 * (0.5 + s.fade);
}

export function frameInterval(ringsAlive: number): number {
  return ringsAlive > 0 ? FRAME_MS.ping : FRAME_MS.idle;
}

/**
 * Two decimals, never "-0.00". The middle x tick always sits at W/2, which is field x = 0, and at some widths
 * (1470px is one) the float lands on -4e-16; a probe in a flat stretch of the field can read just under zero.
 */
function fixed2(v: number): string {
  const s = v.toFixed(2);
  return s === '-0.00' ? '0.00' : s;
}

/**
 * Narrowest x-tick spacing that still labels every tick. A label is at most five characters ("-3.20") of 10px mono
 * at a 0.6em advance, so 30px, plus a 10px gap. Below it (W < 440: every phone) only every other tick is labelled —
 * at 320px the spacing is 25px and the mockup's nine labels overlapped.
 */
const TICK_LABEL_MIN_PX = 40;

/**
 * 9 x ticks at 60 + k(W-120)/8 and 6 y ticks at 40 + k(H-80)/5, labelled in field coordinates (y up). An x tick
 * whose label would collide with its neighbour's carries an empty label; the tick mark itself is always drawn.
 */
export function axisTicks(widthPx: number, heightPx: number): { x: { px: number; label: string }[]; y: { px: number; label: string }[] } {
  const { sx, y0 } = scale(widthPx, heightPx);
  const every = (widthPx - 120) / 8 < TICK_LABEL_MIN_PX ? 2 : 1;
  const x = Array.from({ length: 9 }, (_, k) => {
    const px = 60 + (k * (widthPx - 120)) / 8;
    return { px, label: k % every === 0 ? fixed2(FIELD_X0 + px * sx) : '' };
  });
  const y = Array.from({ length: 6 }, (_, k) => {
    const px = 40 + (k * (heightPx - 80)) / 5;
    return { px, label: fixed2(-(y0 + px * sx)) };
  });
  return { x, y };
}

/** A probe's readout. */
export function probeLabel(z: number): string {
  return `z ${fixed2(z)}`;
}
