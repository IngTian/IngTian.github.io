// tests/podRoom.test.ts
// The room's only pure, testable surface is its screen layout — and that layout is
// load-bearing twice over: the painter draws the monitors from it AND the DOM overlay
// positions its links from it. If they can disagree, the clickable areas drift off the
// painted screens silently, which is exactly the class of bug that survived three
// review rounds on the previous implementation.

import { describe, it, expect } from 'vitest';
import { roomScreens, ROOM_W, ROOM_H, MONITOR_COUNT, roomPalette } from '../src/lib/podRoom';

describe('roomScreens', () => {
  const rects = roomScreens();

  it('returns one rect per monitor', () => {
    expect(rects).toHaveLength(MONITOR_COUNT);
    expect(rects.map((r) => r.slot)).toEqual([0, 1, 2, 3, 4]);
  });

  it('orders slots left to right', () => {
    const lefts = rects.map((r) => r.left);
    expect(lefts).toEqual([...lefts].sort((a, b) => a - b));
  });

  it('keeps every screen inside the frame', () => {
    for (const r of rects) {
      expect(r.left).toBeGreaterThanOrEqual(0);
      expect(r.top).toBeGreaterThanOrEqual(0);
      expect(r.left + r.width).toBeLessThanOrEqual(100);
      expect(r.top + r.height).toBeLessThanOrEqual(100);
    }
  });

  it('never overlaps two screens', () => {
    for (let i = 1; i < rects.length; i++) {
      expect(rects[i].left).toBeGreaterThanOrEqual(rects[i - 1].left + rects[i - 1].width);
    }
  });

  it('gives every screen the same size', () => {
    const w = rects[0].width, h = rects[0].height;
    for (const r of rects) {
      expect(r.width).toBeCloseTo(w, 6);
      expect(r.height).toBeCloseTo(h, 6);
    }
  });

  it('leaves the screens big enough to be a click target', () => {
    // 10% of a full-bleed width is a comfortably large target at any viewport; the
    // previous design's 140px-in-1180px screens were both hard to hit and unreadable.
    for (const r of rects) {
      expect(r.width).toBeGreaterThan(10);
      expect(r.height).toBeGreaterThan(12);
    }
  });

  it('centres the monitor array horizontally', () => {
    const first = rects[0], last = rects[rects.length - 1];
    const leftMargin = first.left;
    const rightMargin = 100 - (last.left + last.width);
    expect(Math.abs(leftMargin - rightMargin)).toBeLessThan(1.5);
  });
});

describe('the buffer', () => {
  it('is small enough to be genuine pixel art', () => {
    // Real pixel art is authored at low resolution and scaled up. Past ~600px the
    // "pixels" stop reading as pixels and the style collapses into the fake-pixel
    // look that the first implementation had.
    expect(ROOM_W).toBeLessThanOrEqual(600);
    expect(ROOM_H).toBeLessThanOrEqual(400);
  });

  it('is a landscape frame', () => {
    expect(ROOM_W / ROOM_H).toBeGreaterThan(1.4);
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
    // --bg never flips bright in this site's token system, so the room must stay dark
    // in light theme too; the theme changes temperature and accent, not time of day.
    const lum = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
    };
    for (const theme of ['light', 'dark'] as const) {
      const p = roomPalette(theme);
      expect(lum(p.void), `${theme}.void`).toBeLessThan(30);
      expect(lum(p.wall), `${theme}.wall`).toBeLessThan(60);
    }
  });

  it('separates the value bands the depth read depends on', () => {
    const lum = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
    };
    for (const theme of ['light', 'dark'] as const) {
      const p = roomPalette(theme);
      // void < wallDark < wall < wallLit < line < lineHi is what makes depth read.
      const ramp = [p.void, p.wallDark, p.wall, p.wallLit, p.line, p.lineHi].map(lum);
      for (let i = 1; i < ramp.length; i++) {
        expect(ramp[i], `${theme} ramp step ${i}`).toBeGreaterThan(ramp[i - 1]);
      }
      // The lit desk lip must clearly beat the desk top, or the desk reads as a slab.
      expect(lum(p.deskLip) - lum(p.deskTop), `${theme} lip vs desk`).toBeGreaterThan(20);
    }
  });
});
