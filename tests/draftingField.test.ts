// tests/draftingField.test.ts
// THE DRAFTING FIELD — /projects' background, as pure math: a drifting Gaussian mixture, two sonar pings, the
// axis ticks and the probe readouts. The component only paints what this module returns, so these are the
// assertions on what a reader actually sees moving behind the page.
import { describe, expect, it } from 'vitest';
import {
  FIELD_BASE, FIELD_CELL, FIELD_LEVELS, FIELD_SPAN, FRAME_MS, PING_SPEED,
  axisTicks, centersAt, fieldAt, frameInterval, litByRing, pingAt, probeLabel, ringState, sampleGrid,
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
    // the frame is centred on the origin: on a landscape screen x runs from the mockup's -3.2 to 3.2
    expect(s.x0).toBeCloseTo(-3.2, 12);
    expect(s.y0).toBeCloseTo(-(900 * s.sx) / 2, 15);
    const c = centersAt(0);
    for (const [i, j] of [[0, 0], [120, 75], [37, 12]]) {
      const want = fieldAt(s.x0 + i * FIELD_CELL * s.sx, s.y0 + j * FIELD_CELL * s.sx, 0, c);
      expect(s.grid[j * (s.cols + 1) + i]).toBe(Math.fround(want));
    }
  });

  it('is pure — the same inputs give the same samples, in a fresh buffer', () => {
    const a = sampleGrid(1440, 900, 0), b = sampleGrid(1440, 900, 0);
    expect(b.grid).not.toBe(a.grid);
    expect(b).toEqual(a);
  });
});

describe('the framing — FIELD_SPAN covers the longer side', () => {
  it("is the mockup's fit-to-width on every landscape screen", () => {
    for (const [W, H] of [[1440, 900], [2000, 1100], [1100, 800], [1280, 1024], [1000, 1000]]) {
      const s = sampleGrid(W, H, 0);
      expect(s.sx, `${W}x${H}`).toBeCloseTo(FIELD_SPAN / W, 15);
      expect(s.x0, `${W}x${H}`).toBeCloseTo(-FIELD_SPAN / 2, 12);
    }
  });

  it('fits the height on a portrait screen, so the frame never reaches past |y| = 3.2', () => {
    for (const [W, H] of [[390, 844], [320, 568], [820, 1180]]) {
      const s = sampleGrid(W, H, 0);
      expect(s.sx, `${W}x${H}`).toBeCloseTo(FIELD_SPAN / H, 15);
      expect(s.y0, `${W}x${H}`).toBeCloseTo(-FIELD_SPAN / 2, 12);
      expect(s.x0, `${W}x${H}`).toBeCloseTo(-(W * s.sx) / 2, 12);
    }
  });

  // THE DEFECT THIS RULE FIXES, measured rather than described. Where every Gaussian is below 0.02 only the 0.05
  // ripple is left, no level but 0 crosses it, and its zero set is a rectangular lattice. Fitting the width put that
  // under 60% of a 390x844 phone's rows (51% at 320x568, 39% on an iPad in portrait); fitting the longer side, 13%.
  it('keeps the bare-ripple lattice off a portrait screen: at most 15% of the rows are ripple alone', () => {
    const c = centersAt(0);
    const ripple = (W: number, H: number): number => {
      const { sx, x0, y0, cols, rows } = sampleGrid(W, H, 0);
      let flat = 0;
      for (let j = 0; j <= rows; j++) {
        const y = y0 + j * FIELD_CELL * sx;
        let bare = true;
        for (let i = 0; i <= cols && bare; i++) {
          const x = x0 + i * FIELD_CELL * sx;
          bare = c.every(([cx, cy, a, w]) => Math.abs(a) * Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (2 * w * w)) < 0.02);
        }
        if (bare) flat++;
      }
      return flat / (rows + 1);
    };
    for (const [W, H] of [[390, 844], [320, 568], [820, 1180]]) expect(ripple(W, H), `${W}x${H}`).toBeLessThanOrEqual(0.15);
    for (const [W, H] of [[1440, 900], [2000, 1100]]) expect(ripple(W, H), `${W}x${H}`).toBe(0);
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

  it('starts every ping in a basin, never on a peak, and can reach both basins — on either framing', () => {
    // Spec §3: the pings "spread from basins". Four of the six centres are peaks (a > 0).
    const t = 12.3;
    const basins = centersAt(t).filter((c) => c[2] < 0);
    expect(basins).toHaveLength(2);
    for (const [W, H] of [[1440, 900], [820, 1180]]) {
      const { sx, x0, y0 } = sampleGrid(W, H, t);
      const hits = new Set<number>();
      for (const u of [0, 0.25, 0.49, 0.5, 0.75, 0.999999, 1]) {
        const p = pingAt(t, W, H, u);
        expect(p.t0).toBe(t);
        const i = basins.findIndex(([cx, cy]) => Math.abs(x0 + p.x * sx - cx) < 1e-9 && Math.abs(y0 + p.y * sx - cy) < 1e-9);
        expect(i, `${W}x${H} u=${u}`).toBeGreaterThanOrEqual(0);
        expect(fieldAt(x0 + p.x * sx, y0 + p.y * sx, t, centersAt(t))).toBeLessThan(0);
        hits.add(i);
      }
      expect(hits.size).toBe(2);
    }
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

  it('never lets two x labels collide — a phone labels every other tick, and keeps all nine marks', () => {
    // 10px mono at a 0.6em advance: 6px a character, plus a 10px gap between neighbouring labels.
    for (let W = 320; W <= 3840; W++) {
      const x = axisTicks(W, 700).x;
      expect(x).toHaveLength(9);
      const lab = x.filter((t) => t.label);
      expect(lab[0].px).toBe(60);
      for (let k = 1; k < lab.length; k++) {
        expect(lab[k].px - lab[k - 1].px, `W=${W}`).toBeGreaterThanOrEqual(lab[k - 1].label.length * 6 + 10);
      }
    }
    // 320x700 is portrait, so the height spans FIELD_SPAN and x runs ±1.46 (see 'the framing' above)
    expect(axisTicks(320, 700).x.map((t) => t.label)).toEqual(['-0.91', '', '-0.46', '', '0.00', '', '0.46', '', '0.91']);
    expect(axisTicks(440, 700).x.every((t) => t.label)).toBe(true);
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
