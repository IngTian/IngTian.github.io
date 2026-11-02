// tests/draftingField.test.ts
// THE DRAFTING FIELD — /projects' background, as pure math: a drifting Gaussian mixture, two sonar pings, the
// axis ticks and the probe readouts. The component only paints what this module returns, so these are the
// assertions on what a reader actually sees moving behind the page.
import { describe, expect, it } from 'vitest';
import {
  FIELD_BASE, FIELD_CELL, FIELD_LEVELS, FIELD_SPAN, FIELD_X0, FRAME_MS, PING_SPEED,
  axisTicks, centersAt, fieldAt, frameInterval, litByRing, probeLabel, ringState, sampleGrid,
} from '../src/lib/draftingField';

describe('centersAt — the drift', () => {
  it('starts each centre at its base point shifted by its phase', () => {
    const c = centersAt(0);
    expect(c).toHaveLength(FIELD_BASE.length);
    FIELD_BASE.forEach(([x, y, a, w, dx, dy, , ph], i) => {
      expect(c[i][0]).toBeCloseTo(x + dx * Math.sin(ph), 12);
      expect(c[i][1]).toBeCloseTo(y + dy * Math.cos(ph), 12);
      expect(c[i][2]).toBe(a);
      expect(c[i][3]).toBe(w);
    });
  });

  it('returns each centre to its t=0 x after one of its own periods', () => {
    const c0 = centersAt(0);
    FIELD_BASE.forEach(([, , , , , , period], i) => {
      expect(centersAt(period)[i][0]).toBeCloseTo(c0[i][0], 9);
    });
  });
});

describe('fieldAt', () => {
  it('is the ripple plus a Gaussian of width w (exp(-r²/2w²)) per centre', () => {
    const one: ReturnType<typeof centersAt> = [[0, 0, 1, 1]];
    expect(fieldAt(0, 0, 0, one)).toBeCloseTo(1, 12);
    expect(fieldAt(1, 0, 0, one)).toBeCloseTo(Math.exp(-0.5) + 0.05 * Math.sin(1.7), 12);
    expect(fieldAt(0, 0, 0, [])).toBe(0);
  });
});

describe('sampleGrid', () => {
  it('samples (cols+1) x (rows+1) points, row-major, one per FIELD_CELL px across FIELD_SPAN', () => {
    const s = sampleGrid(1440, 900, 0);
    expect(s.cols).toBe(120);
    expect(s.rows).toBe(75);
    expect(s.grid).toHaveLength(121 * 76);
    expect(s.sx).toBeCloseTo(FIELD_SPAN / 1440, 15);
    // the frame is vertically centred on y = 0: the top edge sits at -(H * sx) / 2
    expect(s.y0).toBeCloseTo(-(900 * s.sx) / 2, 15);
    const c = centersAt(0);
    for (const [i, j] of [[0, 0], [120, 75], [37, 12]]) {
      const want = fieldAt(FIELD_X0 + i * FIELD_CELL * s.sx, s.y0 + j * FIELD_CELL * s.sx, 0, c);
      expect(s.grid[j * (s.cols + 1) + i]).toBe(Math.fround(want));
    }
  });

  it('is pure — the same inputs give the same samples, in a fresh buffer', () => {
    const a = sampleGrid(1440, 900, 0), b = sampleGrid(1440, 900, 0);
    expect(b.grid).not.toBe(a.grid);
    expect(b).toEqual(a);
  });
});

describe('FIELD_LEVELS', () => {
  it('is k * 0.085 for k = -8..15', () => {
    expect(FIELD_LEVELS).toHaveLength(24);
    FIELD_LEVELS.forEach((l, i) => expect(l).toBeCloseTo((i - 8) * 0.085, 12));
  });
});

describe('pings', () => {
  const r = { x: 100, y: 200, t0: 10 };

  it('grows at PING_SPEED and fades to nothing at maxR', () => {
    const s = ringState(r, 11, 1000);
    expect(s).not.toBeNull();
    expect(s!.R).toBeCloseTo(PING_SPEED * 1, 9);
    expect(s!.fade).toBeCloseTo(1 - 300 / 1000, 9);
    expect(ringState(r, 10 + 1000 / PING_SPEED + 0.01, 1000)).toBeNull();
  });

  it('never runs backwards — a frame stamped before t0 is a ring of radius 0', () => {
    expect(ringState(r, 9.9, 1000)).toEqual({ R: 0, fade: 1 });
  });

  it('lights a line on the ring band and not 40px off it once faded', () => {
    const s = { R: 300, fade: 0 };
    expect(litByRing(r.x + 300, r.y, s, r)).toBe(true);
    expect(litByRing(r.x + 340, r.y, s, r)).toBe(false);
    expect(litByRing(r.x + 260, r.y, s, r)).toBe(false);
  });

  it('draws at ~15fps while drifting and ~30fps while a ping travels', () => {
    expect(frameInterval(0)).toBe(66);
    expect(frameInterval(1)).toBe(33);
    expect(frameInterval(2)).toBe(FRAME_MS.ping);
  });
});

describe('axisTicks and probes', () => {
  it('puts 9 x ticks and 6 y ticks on the frame, labelled in field coordinates', () => {
    const t = axisTicks(1440, 900);
    const sx = FIELD_SPAN / 1440, y0 = -(900 * sx) / 2;
    expect(t.x).toHaveLength(9);
    expect(t.y).toHaveLength(6);
    expect(t.x[0]).toEqual({ px: 60, label: (-3.2 + 60 * sx).toFixed(2) });
    expect(t.x[8].px).toBeCloseTo(1440 - 60, 9);
    expect(t.y[0]).toEqual({ px: 40, label: (-(y0 + 40 * sx)).toFixed(2) });
    expect(t.y[5].px).toBeCloseTo(900 - 40, 9);
  });

  it('never prints a negative zero — the centre tick at 1470px is 0.00', () => {
    // The middle x tick always sits at W/2, which is field x = 0; at 1470px the float lands on -4e-16.
    expect(axisTicks(1470, 900).x[4].label).toBe('0.00');
    expect(probeLabel(-0.001)).toBe('z 0.00');
  });

  it('reads out an elevation the way the mockup did', () => {
    expect(probeLabel(0.4149)).toBe('z 0.41');
    expect(probeLabel(-0.3)).toBe('z -0.30');
  });
});
