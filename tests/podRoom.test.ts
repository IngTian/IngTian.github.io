// tests/podRoom.test.ts
// The room's pure surface: its monitor layout and its palette.
//
// WHY THE LAYOUT IS WORTH TESTING: the monitor rectangles are load-bearing twice — the
// painter draws the monitors from them AND the DOM overlay positions its real
// <a>/<button> links from them. If the two can disagree, the click targets drift off the
// painted screens with no visible symptom. That is exactly the class of bug that
// survived three review rounds on the previous implementation.

import { describe, it, expect } from 'vitest';
import {
  roomScreens, ROOM_W, ROOM_H, ROOM_CX, MONITOR_COUNT, MONITORS, roomPalette, sideDepth,
  CEIL_BOTTOM, WALL_BOTTOM, DESK_FRONT, APRON_BOTTOM, FLOOR_BOTTOM,
  monitorQuad, screenQuad, quadBounds, TILT_DEG, YAW_MAX_DEG,
} from '../src/lib/podRoom';

const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
};

describe('roomScreens', () => {
  const rects = roomScreens();

  it('returns one rect per interactive destination', () => {
    expect(rects).toHaveLength(MONITOR_COUNT);
    expect(rects.map((r) => r.slot)).toEqual([0, 1, 2, 3, 4]);
  });

  it('keeps every screen inside the frame', () => {
    for (const r of rects) {
      expect(r.left, `slot ${r.slot} left`).toBeGreaterThanOrEqual(0);
      expect(r.top, `slot ${r.slot} top`).toBeGreaterThanOrEqual(0);
      expect(r.left + r.width, `slot ${r.slot} right`).toBeLessThanOrEqual(100);
      expect(r.top + r.height, `slot ${r.slot} bottom`).toBeLessThanOrEqual(100);
    }
  });

  it('never overlaps two screens', () => {
    // Screens live on two rows, so overlap is only a defect within a row.
    for (const row of [[0, 1, 2], [3, 4]]) {
      const inRow = row.map((s) => rects.find((r) => r.slot === s)!).sort((a, b) => a.left - b.left);
      for (let i = 1; i < inRow.length; i++) {
        expect(inRow[i].left).toBeGreaterThanOrEqual(inRow[i - 1].left + inRow[i - 1].width);
      }
    }
  });

  it('gives the three primaries a big click target', () => {
    // The previous design's 140px-in-1180px screens were both hard to hit and too small
    // to show anything; the owner explicitly asked for bigger monitors. This guard exists
    // because a later composition pass shrank them again to make room for the window —
    // the fix was to narrow the window, not the screens.
    for (const slot of [0, 1, 2]) {
      const r = rects.find((x) => x.slot === slot)!;
      expect(r.width, `slot ${slot} width%`).toBeGreaterThan(19);
      expect(r.height, `slot ${slot} height%`).toBeGreaterThan(19);
    }
  });

  it('puts the secondary row ABOVE the primary row', () => {
    const primaryTop = Math.min(...[0, 1, 2].map((s) => rects.find((r) => r.slot === s)!.top));
    const secondaryBottom = Math.max(
      ...[3, 4].map((s) => { const r = rects.find((x) => x.slot === s)!; return r.top + r.height; }),
    );
    expect(secondaryBottom).toBeLessThanOrEqual(primaryTop);
  });

  it('orders each row left to right by slot', () => {
    for (const row of [[0, 1, 2], [3, 4]]) {
      const lefts = row.map((s) => rects.find((r) => r.slot === s)!.left);
      expect(lefts).toEqual([...lefts].sort((a, b) => a - b));
    }
  });
});

describe('MONITORS', () => {
  it('includes ambient screens with no destination', () => {
    // The wall should not have exactly as many monitors as there are links — that reads
    // as a menu, not a desk. The ambient pair is deliberate.
    const ambient = MONITORS.filter((m) => m.slot === null);
    expect(ambient.length).toBeGreaterThan(0);
    for (const a of ambient) expect(a.ambient).toBeDefined();
  });

  it('assigns every destination slot exactly once', () => {
    const slots = MONITORS.map((m) => m.slot).filter((s): s is number => s !== null).sort();
    expect(slots).toEqual([0, 1, 2, 3, 4]);
  });

  it('keeps every monitor inside the buffer', () => {
    for (const m of MONITORS) {
      expect(m.x).toBeGreaterThanOrEqual(0);
      expect(m.y).toBeGreaterThanOrEqual(0);
      expect(m.x + m.w).toBeLessThanOrEqual(ROOM_W);
      expect(m.y + m.h).toBeLessThanOrEqual(ROOM_H);
    }
  });

  it('keeps every monitor above the desk surface', () => {
    for (const m of MONITORS) expect(m.y + m.h).toBeLessThanOrEqual(WALL_BOTTOM);
  });

  it('makes primaries larger than secondaries', () => {
    const prim = MONITORS.filter((m) => m.kind === 'primary');
    const sec = MONITORS.filter((m) => m.kind === 'secondary');
    const area = (m: { w: number; h: number }) => m.w * m.h;
    expect(Math.min(...prim.map(area))).toBeGreaterThan(Math.max(...sec.map(area)));
  });

  it('leaves a bezel thin enough to leave real screen area', () => {
    for (const m of MONITORS) {
      expect(m.bezel * 2).toBeLessThan(m.w * 0.25);
      expect(m.bezel * 2).toBeLessThan(m.h * 0.25);
    }
  });
});

describe('sideDepth', () => {
  it('shows the RIGHT face for boxes left of the vanishing axis', () => {
    expect(sideDepth(ROOM_CX - 200)).toBeLessThan(0);
  });

  it('shows the LEFT face for boxes right of the axis', () => {
    expect(sideDepth(ROOM_CX + 200)).toBeGreaterThan(0);
  });

  it('shows almost no side face on the axis itself', () => {
    expect(Math.abs(sideDepth(ROOM_CX))).toBeLessThanOrEqual(1);
  });

  it('grows with distance from the axis, and clamps', () => {
    const near = Math.abs(sideDepth(ROOM_CX + 60));
    const far = Math.abs(sideDepth(ROOM_CX + 300));
    expect(far).toBeGreaterThan(near);
    expect(Math.abs(sideDepth(ROOM_CX + 10_000, 30, 7))).toBe(7);
  });
});

describe('the buffer', () => {
  it('is sized for detailed screen content', () => {
    // The buffer grew 480 -> 800 -> 1600 on the owner's instruction ("keep going higher
    // res, way higher"), because the screen CONTENTS were the limiting factor: at 800px a
    // monitor's glass was ~165px wide, too coarse for an editor with a minimap or an axis
    // with ticks. The pixel-art look now comes from flat shading, hard 1px edges and
    // ordered dithering rather than from upscaling. The cap remains only so nobody
    // wanders into full-resolution territory where repaint cost stops being constant.
    expect(ROOM_W).toBeGreaterThanOrEqual(1200);
    expect(ROOM_W).toBeLessThanOrEqual(2048);
    expect(ROOM_H).toBeLessThanOrEqual(1200);
  });

  it('gives each primary screen enough pixels for legible content', () => {
    // The concrete reason the buffer grew. A code editor with a gutter, ~20 token-run
    // lines and a minimap needs roughly this much glass.
    for (const m of MONITORS.filter((x) => x.kind === 'primary')) {
      const b = quadBounds(screenQuad(m));
      expect(b.w, 'screen width px').toBeGreaterThan(300);
      expect(b.h, 'screen height px').toBeGreaterThan(170);
    }
  });

  it('is a landscape frame', () => {
    expect(ROOM_W / ROOM_H).toBeGreaterThan(1.4);
  });

  it('orders its vertical bands ceiling -> wall -> desk -> floor', () => {
    const bands = [CEIL_BOTTOM, WALL_BOTTOM, DESK_FRONT, APRON_BOTTOM, FLOOR_BOTTOM];
    for (let i = 1; i < bands.length; i++) expect(bands[i]).toBeGreaterThan(bands[i - 1]);
    expect(FLOOR_BOTTOM).toBe(ROOM_H);
  });

  it('gives the desk real thickness, so it is not a painted line', () => {
    expect(APRON_BOTTOM - DESK_FRONT).toBeGreaterThanOrEqual(8);
  });
});

describe('monitorQuad — the yaw/tilt maths that makes a panel look like an object', () => {
  const left = MONITORS.filter((m) => m.kind === 'primary')[0];
  const mid = MONITORS.filter((m) => m.kind === 'primary')[1];
  const right = MONITORS.filter((m) => m.kind === 'primary')[2];

  const edgeH = (q: ReturnType<typeof monitorQuad>) => ({
    l: Math.abs(q[3][1] - q[0][1]),   // BL.y - TL.y
    r: Math.abs(q[2][1] - q[1][1]),   // BR.y - TR.y
  });

  it('yaws a left monitor so its LEFT edge is the taller, nearer one', () => {
    // Yaw is only visible as a difference in the two vertical edges' heights. If they
    // match, the panel is straight-on and cannot read as 3D — the whole point of note 2.
    const e = edgeH(monitorQuad(left));
    expect(e.l).toBeGreaterThan(e.r);
  });

  it('yaws a right monitor the mirror way', () => {
    const e = edgeH(monitorQuad(right));
    expect(e.r).toBeGreaterThan(e.l);
  });

  it('yaws less the closer a monitor sits to the vanishing axis', () => {
    // NOT "the middle monitor is square-on": the rig is deliberately shifted right to
    // clear the window, so its centre monitor is ~120px right of the axis and is yawed
    // too. The real invariant is monotonicity — yaw grows with distance from the axis.
    const skew = (m: typeof mid) => {
      const e = edgeH(monitorQuad(m));
      return Math.abs(e.l - e.r);
    };
    const dist = (m: typeof mid) => Math.abs(m.x + m.w / 2 - ROOM_CX);
    const byDist = [left, mid, right].sort((a, b) => dist(a) - dist(b));
    for (let i = 1; i < byDist.length; i++) {
      expect(skew(byDist[i]), `skew grows with distance (step ${i})`)
        .toBeGreaterThanOrEqual(skew(byDist[i - 1]));
    }
  });

  it('yaws the outer monitors visibly, not imperceptibly', () => {
    const e = edgeH(monitorQuad(left));
    expect(Math.abs(e.l - e.r)).toBeGreaterThan(8);
  });

  it('tilts every screen back, dropping its top edge below the untilted top', () => {
    for (const m of MONITORS) {
      const q = monitorQuad(m);
      const topMost = Math.min(q[0][1], q[1][1]);
      expect(topMost, 'tilted top sits below the flat top').toBeGreaterThan(m.y - 1);
    }
  });

  it('keeps the tilt and yaw shallow — a desk, not a fisheye', () => {
    expect(TILT_DEG).toBeGreaterThan(0);
    expect(TILT_DEG).toBeLessThanOrEqual(12);
    expect(YAW_MAX_DEG).toBeGreaterThan(0);
    expect(YAW_MAX_DEG).toBeLessThanOrEqual(20);
  });

  it('keeps every quad inside the buffer', () => {
    for (const m of MONITORS) {
      for (const [qx, qy] of monitorQuad(m)) {
        expect(qx).toBeGreaterThanOrEqual(0);
        expect(qx).toBeLessThanOrEqual(ROOM_W);
        expect(qy).toBeGreaterThanOrEqual(0);
        expect(qy).toBeLessThanOrEqual(ROOM_H);
      }
    }
  });
});

describe('screenQuad', () => {
  it('sits strictly inside its monitor quad', () => {
    for (const m of MONITORS) {
      const outer = quadBounds(monitorQuad(m));
      const inner = quadBounds(screenQuad(m));
      expect(inner.x).toBeGreaterThan(outer.x);
      expect(inner.y).toBeGreaterThan(outer.y);
      expect(inner.x + inner.w).toBeLessThan(outer.x + outer.w);
      expect(inner.y + inner.h).toBeLessThan(outer.y + outer.h);
    }
  });

  it('inherits the yaw, so the glass is a trapezoid too', () => {
    // If the screen were axis-aligned inside a tilted bezel, the illusion would break at
    // the glass — the most visible surface in the scene.
    const m = MONITORS.filter((x) => x.kind === 'primary')[0];
    const q = screenQuad(m);
    const lH = Math.abs(q[3][1] - q[0][1]), rH = Math.abs(q[2][1] - q[1][1]);
    expect(Math.abs(lH - rH)).toBeGreaterThan(4);
  });
});

describe('roomPalette', () => {
  it('provides both themes with every role filled', () => {
    for (const theme of ['light', 'dark'] as const) {
      const p = roomPalette(theme);
      for (const [role, value] of Object.entries(p)) {
        expect(value, `${theme}.${role}`).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it('uses the site accent per theme: ochre in light, emerald in dark', () => {
    expect(roomPalette('light').accent.toLowerCase()).toBe('#c8a36a');
    expect(roomPalette('dark').accent.toLowerCase()).toBe('#66c28c');
  });

  it('keeps the seal red as the brand mark in both themes', () => {
    expect(roomPalette('light').seal.toLowerCase()).toBe('#b23a2e');
    expect(roomPalette('dark').seal.toLowerCase()).toBe('#e0574a');
  });

  it('never uses pure white or pure red', () => {
    for (const theme of ['light', 'dark'] as const) {
      for (const v of Object.values(roomPalette(theme))) {
        expect(v.toLowerCase()).not.toBe('#ffffff');
        expect(v.toLowerCase()).not.toBe('#ff0000');
      }
    }
  });

  it('is a NIGHT room in both themes — the room never flashes bright', () => {
    // This site's --bg never flips bright, so the room stays dark in light theme too;
    // the theme changes temperature and accent, not time of day.
    for (const theme of ['light', 'dark'] as const) {
      const p = roomPalette(theme);
      expect(lum(p.void), `${theme}.void`).toBeLessThan(30);
      expect(lum(p.wall), `${theme}.wall`).toBeLessThan(60);
    }
  });

  it('separates the value bands the depth read depends on', () => {
    for (const theme of ['light', 'dark'] as const) {
      const p = roomPalette(theme);
      const rampV = [p.void, p.wallDark, p.wall, p.wallLit, p.line, p.lineHi].map(lum);
      for (let i = 1; i < rampV.length; i++) {
        expect(rampV[i], `${theme} ramp step ${i}`).toBeGreaterThan(rampV[i - 1]);
      }
    }
  });

  it('shades a box its three faces distinctly, or volume does not read', () => {
    // side < front < top is what makes an extruded box look extruded.
    for (const theme of ['light', 'dark'] as const) {
      const p = roomPalette(theme);
      expect(lum(p.monSide), `${theme} mon side`).toBeLessThan(lum(p.monFront));
      expect(lum(p.monFront), `${theme} mon front`).toBeLessThan(lum(p.monTop));
      expect(lum(p.deskSide), `${theme} desk side`).toBeLessThan(lum(p.deskTop));
    }
  });

  it('lights the desk near edge clearly above the desk top', () => {
    // A plane only reads as a surface once its near edge catches light.
    for (const theme of ['light', 'dark'] as const) {
      const p = roomPalette(theme);
      expect(lum(p.deskLip) - lum(p.deskTop), `${theme} lip vs desk`).toBeGreaterThan(20);
    }
  });
});
