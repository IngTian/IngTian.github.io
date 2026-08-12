// tests/factorModel.test.ts
// The betas are CLAIMS ABOUT A REAL PERSON'S RECORD, rendered on a page a quant researcher
// will read. So these tests are not shape checks — they are honesty guards. Every number the
// object displays must be derivable from profile.ts by the arithmetic in factorModel.ts, and
// a violation should be a red test rather than something spotted on screen.

import { describe, it, expect } from 'vitest';
import {
  FACTORS, FAN, periodYears, signals, loadings, fanBeams, beamQuad, expressionTerms,
} from '../src/lib/factorModel';
import { timeline, publications, projects, awards, researchInterests } from '../src/data/profile';

describe('periodYears — parses every real shape in profile.ts', () => {
  it('reads a closed two-digit range', () => {
    expect(periodYears('2023 — 25')).toBe(2);
  });

  it('reads an open range up to the given year, never to infinity', () => {
    // A current role must not dominate the model just because it has no end date.
    expect(periodYears('2026 —', 2026)).toBe(1);
    expect(periodYears('2023 —', 2026)).toBe(3);
  });

  it('ignores a leading word', () => {
    expect(periodYears('Fall 2027 —', 2028)).toBe(1);
  });

  it('counts a single year as one year, not zero', () => {
    // An internship is a real signal; a zero would silently delete it from the model.
    expect(periodYears('2021')).toBe(1);
    expect(periodYears('2022')).toBe(1);
  });

  it('reads apostrophe-prefixed two-digit years', () => {
    expect(periodYears("'21–'22")).toBe(1);
  });

  it('never returns zero or negative for any real period', () => {
    for (const t of timeline) {
      expect(periodYears(t.period), t.period).toBeGreaterThan(0);
    }
  });

  it('is deterministic', () => {
    expect(periodYears('2023 — 25')).toBe(periodYears('2023 — 25'));
  });
});

describe('signals — declared membership, drawn from real data', () => {
  const sig = signals();

  it('includes every timeline entry, publication, project, award and interest', () => {
    const expected =
      timeline.length + publications.length + researchInterests.length +
      projects.length + awards.length;
    expect(sig.length).toBe(expected);
  });

  it('gives every signal a positive weight', () => {
    for (const s of sig) expect(s.weight, s.label).toBeGreaterThan(0);
  });

  it('assigns every signal to a declared factor', () => {
    const keys = new Set(FACTORS.map((f) => f.key));
    for (const s of sig) expect(keys.has(s.factor), `${s.label} -> ${s.factor}`).toBe(true);
  });

  it('leaves Writing and Market reports with NO signals', () => {
    // The honest state today: those pages do not exist. The model must show a zero beam
    // rather than invent a loading for work that has not been done.
    expect(sig.filter((s) => s.factor === 'writing')).toHaveLength(0);
    expect(sig.filter((s) => s.factor === 'markets')).toHaveLength(0);
  });
});

describe('loadings — beta is a share, and the definition is the caption', () => {
  const ls = loadings();

  it('returns one loading per factor, in declared order', () => {
    expect(ls.map((l) => l.factor.key)).toEqual(FACTORS.map((f) => f.key));
  });

  it('sums to 1', () => {
    const total = ls.reduce((s, l) => s + l.beta, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it('keeps every beta in [0,1]', () => {
    for (const l of ls) {
      expect(l.beta, l.factor.key).toBeGreaterThanOrEqual(0);
      expect(l.beta, l.factor.key).toBeLessThanOrEqual(1);
    }
  });

  it('gives exactly zero to the two factors with no signals', () => {
    const zero = ls.filter((l) => l.beta === 0).map((l) => l.factor.key).sort();
    expect(zero).toEqual(['markets', 'writing']);
  });

  it('matches raw/total by construction — the arithmetic the caption claims', () => {
    // This is the test that makes the on-screen definition true. If someone later tweaks a
    // beta "to look better", this fails.
    const sig = signals();
    const total = sig.reduce((s, x) => s + x.weight, 0);
    for (const l of ls) {
      const mine = sig.filter((s) => s.factor === l.factor.key)
        .reduce((s, x) => s + x.weight, 0);
      expect(l.raw, l.factor.key).toBe(mine);
      expect(l.beta, l.factor.key).toBeCloseTo(mine / total, 12);
    }
  });

  it('counts signals per factor consistently with its raw weight', () => {
    for (const l of ls) {
      if (l.count === 0) expect(l.raw).toBe(0);
      else expect(l.raw).toBeGreaterThanOrEqual(l.count);   // every weight is >= 1
    }
  });

  it('ranks experience highest today, because it is duration-weighted', () => {
    // Not a preference — a consequence of the declared weighting, asserted so that a change
    // in the weighting scheme is visible in the diff rather than silent on screen.
    const top = [...ls].sort((a, b) => b.beta - a.beta)[0];
    expect(top.factor.key).toBe('experience');
  });

  it('is deterministic across calls', () => {
    expect(JSON.stringify(loadings())).toBe(JSON.stringify(loadings()));
  });
});

describe('fanBeams — the equation laid out in space', () => {
  const beams = fanBeams();

  it('produces one beam per factor', () => {
    expect(beams).toHaveLength(FACTORS.length);
    expect(new Set(beams.map((b) => b.factor.key)).size).toBe(FACTORS.length);
  });

  it('puts the largest beta nearest the fan centre', () => {
    // The layout claim: magnitude is readable by position as well as by size.
    const centreDist = (b: typeof beams[0]) => Math.abs(b.azimuth);
    const sorted = [...beams].sort((a, b) => b.beta - a.beta);
    expect(centreDist(sorted[0])).toBeLessThan(centreDist(sorted[sorted.length - 1]));
  });

  it('keeps every beam inside the declared spread', () => {
    const half = (FAN.spreadDeg * Math.PI) / 180 / 2;
    for (const b of beams) {
      expect(Math.abs(b.azimuth), b.factor.key).toBeLessThanOrEqual(half + 1e-9);
    }
  });

  it('never overlaps two beams in azimuth', () => {
    // Wedges must not collide, or the picture double-counts area and misleads.
    const sorted = [...beams].sort((a, b) => a.azimuth - b.azimuth);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].azimuth, `beam ${i}`).toBeGreaterThan(sorted[i - 1].azimuth);
    }
  });

  it('gives every beam the SAME elevation, so none can cross another', () => {
    // The interleaving bug: elevation used to rise with azimuth, and horizontal reach goes as
    // cos(elevation), so a short steeply-lifted outer beam reached less far across the screen
    // than a long flat inner one and got drawn INSIDE it. One shared elevation makes that
    // impossible by construction.
    const els = new Set(beams.map((b) => b.elevation.toFixed(9)));
    expect(els.size).toBe(1);
    for (const b of beams) expect(b.elevation).toBeGreaterThan(0);
  });

  it('gives every beam its own angular slot, evenly pitched', () => {
    // The invariant that prevents interleaving, restated for a full circle. Sorting by dir.x no
    // longer matches azimuth order once the fan wraps past 90 degrees (sin is not monotone over
    // 360), so the honest test is that the azimuths are distinct and equally spaced — no two
    // beams can ever occupy the same slot, whatever the betas are.
    const az = [...beams].map((b) => b.azimuth).sort((a, b) => a - b);
    expect(new Set(az.map((a) => a.toFixed(9))).size).toBe(beams.length);
    const gaps = az.slice(1).map((v, i) => v - az[i]);
    for (const g of gaps) expect(g).toBeCloseTo(gaps[0], 9);
  });

  it('gives every beam a unit-length direction', () => {
    for (const b of beams) {
      expect(Math.hypot(b.dir.x, b.dir.y, b.dir.z), b.factor.key).toBeCloseTo(1, 9);
    }
  });

  it('spaces the beams evenly in azimuth', () => {
    // Even spacing is what makes it read as a FAN rather than as two dominant wedges with
    // stragglers behind them. With a shared elevation, equal azimuth steps are the only
    // remaining lever on angular rhythm.
    const az = [...beams].map((b) => b.azimuth).sort((a, b) => a - b);
    const gaps = az.slice(1).map((v, i) => v - az[i]);
    const first = gaps[0];
    for (const g of gaps) expect(g).toBeCloseTo(first, 9);
  });

  it('gives a zero-loading factor a visible stub, not nothing', () => {
    // "No signal yet" is information and must be legible; a zero-length beam would read as
    // a rendering bug rather than as an honest gap.
    const zeros = beams.filter((b) => b.beta === 0);
    expect(zeros.length).toBe(2);
    for (const z of zeros) {
      expect(z.length).toBeCloseTo(FAN.minLength, 10);
      expect(z.halfWidth).toBeCloseTo(FAN.minHalfWidth, 10);
    }
  });

  it('makes length and width monotone in beta', () => {
    const sorted = [...beams].sort((a, b) => a.beta - b.beta);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].length).toBeGreaterThanOrEqual(sorted[i - 1].length);
      expect(sorted[i].halfWidth).toBeGreaterThanOrEqual(sorted[i - 1].halfWidth);
    }
  });

  it('spreads beams all the way around the circle', () => {
    // NOT "every tip has positive z" any more. That was right when the fan was a flat SVG still
    // and every label had to face one fixed camera; the object now rotates, so a beam pointing
    // away is the REASON to turn it rather than a defect. What matters on a full circle is that
    // the beams genuinely surround the origin instead of bunching in one hemisphere — which is
    // what a 150 degree spread looked like, and the complaint that prompted the change.
    const behind = beams.filter((b) => b.tip.z < 0);
    const infront = beams.filter((b) => b.tip.z >= 0);
    expect(behind.length, 'some beams point away').toBeGreaterThan(0);
    expect(infront.length, 'some beams point toward').toBeGreaterThan(0);
  });

  it('covers the full circle without two beams sharing a slot', () => {
    const az = [...beams].map((b) => b.azimuth).sort((a, b) => a - b);
    const span = az[az.length - 1] - az[0];
    // Six beams at a 60 degree pitch span 300 degrees between first and last; the wrap-around
    // gap closes the circle.
    expect(span).toBeGreaterThan(Math.PI * 1.5);
    for (let i = 1; i < az.length; i++) expect(az[i]).toBeGreaterThan(az[i - 1]);
  });

  it('keeps tip magnitude equal to the beam length', () => {
    for (const b of beams) {
      const r = Math.hypot(b.tip.x, b.tip.y, b.tip.z);
      expect(r, b.factor.key).toBeCloseTo(b.length, 10);
    }
  });

  it('is deterministic', () => {
    expect(JSON.stringify(fanBeams())).toBe(JSON.stringify(fanBeams()));
  });
});

describe('beamQuad', () => {
  it('is narrow at the root and wide at the tip', () => {
    for (const b of fanBeams()) {
      const [r0, t0, t1, r1] = beamQuad(b);
      const rootW = Math.hypot(r1.x - r0.x, r1.y - r0.y, r1.z - r0.z);
      const tipW = Math.hypot(t1.x - t0.x, t1.y - t0.y, t1.z - t0.z);
      expect(tipW, b.factor.key).toBeGreaterThan(rootW);
    }
  });

  it('roots every wedge at the origin', () => {
    for (const b of fanBeams()) {
      const [r0, , , r1] = beamQuad(b);
      expect(Math.hypot(r0.x, r0.y, r0.z)).toBeLessThan(FAN.minHalfWidth);
      expect(Math.hypot(r1.x, r1.y, r1.z)).toBeLessThan(FAN.minHalfWidth);
    }
  });

  it('gives a wider tip to a larger beta', () => {
    const bs = [...fanBeams()].sort((a, b) => a.beta - b.beta);
    const tipW = (b: typeof bs[0]) => {
      const [, t0, t1] = beamQuad(b);
      return Math.hypot(t1.x - t0.x, t1.y - t0.y, t1.z - t0.z);
    };
    expect(tipW(bs[bs.length - 1])).toBeGreaterThan(tipW(bs[0]));
  });
});

describe('expressionTerms — the equation reads left to right like the fan', () => {
  it('returns one term per factor, ordered by azimuth', () => {
    const terms = expressionTerms();
    expect(terms).toHaveLength(FACTORS.length);
    const beams = [...fanBeams()].sort((a, b) => a.azimuth - b.azimuth);
    expect(terms.map((t) => t.label)).toEqual(beams.map((b) => b.factor.label));
  });

  it('carries the same betas as the loadings', () => {
    const byLabel = new Map(loadings().map((l) => [l.factor.label, l.beta]));
    for (const t of expressionTerms()) {
      expect(t.beta, t.label).toBeCloseTo(byLabel.get(t.label)!, 12);
    }
  });
});

describe('FACTORS — the six, and what they promise', () => {
  it('has exactly six', () => {
    // Six is the conventional factor count (Fama–French uses five), so it needs no
    // invented justification — but it must stay six or the fan layout claim changes.
    expect(FACTORS).toHaveLength(6);
  });

  it('uses unique keys and symbols', () => {
    expect(new Set(FACTORS.map((f) => f.key)).size).toBe(6);
    expect(new Set(FACTORS.map((f) => f.symbol)).size).toBe(6);
  });

  it('gives every factor without an href an announcement instead', () => {
    // Otherwise a beam would be a dead click with no explanation.
    for (const f of FACTORS) {
      if (!f.href) expect(f.announce, f.key).toBeTruthy();
    }
  });

  it('points every href at a route that exists', () => {
    const built = new Set(['/research', '/projects', '/experience', '/art']);
    for (const f of FACTORS) {
      if (f.href) expect(built.has(f.href), f.href).toBe(true);
    }
  });

  it('gives every factor a gloss', () => {
    for (const f of FACTORS) expect(f.gloss.length, f.key).toBeGreaterThan(10);
  });
});
