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
      expect(r.width, `slot ${slot} width%`).toBeGreaterThan(20);
      expect(r.height, `slot ${slot} height%`).toBeGreaterThan(20);
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
  it('stays low-res enough to read as pixel art', () => {
    // Real pixel art is authored small and scaled up. At 800px wide, a 1600px viewport
    // paints each buffer pixel as a crisp 2x2 block. Push much past this and the pixels
    // stop reading as pixels and the style collapses into the fake-pixel look.
    expect(ROOM_W).toBeLessThanOrEqual(1000);
    expect(ROOM_H).toBeLessThanOrEqual(560);
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
