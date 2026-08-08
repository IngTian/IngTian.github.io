import { describe, it, expect } from 'vitest';
import {
  parsePeriod, ganttBars,
  ideLines, backtestCurve, latexLines, bloombergRows, SCREEN_CONTENT,
} from '../src/lib/podScreens';
import { timeline } from '../src/data/profile';

describe('parsePeriod', () => {
  it('parses a closed range with a two-digit end', () => {
    expect(parsePeriod('2023 — 25')).toEqual({ start: 2023, end: 2025 });
  });

  it('parses an open-ended range as running to the horizon', () => {
    const r = parsePeriod('2026 —');
    expect(r!.start).toBe(2026);
    expect(r!.end).toBeGreaterThan(2026);
  });

  it('parses a single year as a one-year span', () => {
    expect(parsePeriod('2021')).toEqual({ start: 2021, end: 2022 });
  });

  it('parses a leading word before the year', () => {
    const r = parsePeriod('Fall 2027 —');
    expect(r!.start).toBe(2027);
  });

  it('parses a four-digit closed range', () => {
    expect(parsePeriod('2019 — 23')).toEqual({ start: 2019, end: 2023 });
  });

  it('returns null for something with no year', () => {
    expect(parsePeriod('Elsewhere')).toBeNull();
  });
});

describe('ganttBars — against the REAL timeline', () => {
  it('parses every period in profile.ts (no silent drops)', () => {
    const unparsed = timeline.filter((e) => parsePeriod(e.period) === null);
    expect(unparsed.map((e) => e.period)).toEqual([]);
  });

  it('produces bars with start strictly before end', () => {
    for (const b of ganttBars(timeline, 2026)) expect(b.start).toBeLessThan(b.end);
  });

  it('caps at 6 bars so the screen stays readable', () => {
    expect(ganttBars(timeline, 2026).length).toBeLessThanOrEqual(6);
  });

  it('keeps the labels short enough for a screen', () => {
    for (const b of ganttBars(timeline, 2026)) expect(b.label.length).toBeLessThanOrEqual(18);
  });

  it('includes the incoming PhD — the identity headline', () => {
    const labels = ganttBars(timeline, 2026).map((b) => b.label.toLowerCase());
    expect(labels.some((l) => l.includes('phd'))).toBe(true);
  });
});

describe('screen content generators are deterministic', () => {
  it('backtestCurve returns identical output on repeat calls', () => {
    expect(backtestCurve(64)).toEqual(backtestCurve(64));
  });

  it('backtestCurve stays inside 0..1 and rises overall', () => {
    const c = backtestCurve(64);
    expect(c).toHaveLength(64);
    for (const p of c) {
      expect(p.x).toBeGreaterThanOrEqual(0); expect(p.x).toBeLessThanOrEqual(1);
      expect(p.y).toBeGreaterThanOrEqual(0); expect(p.y).toBeLessThanOrEqual(1);
    }
    expect(c[c.length - 1].y).toBeGreaterThan(c[0].y);
  });

  it('backtestCurve has at least one drawdown — a monotone line is not a backtest', () => {
    const c = backtestCurve(64);
    expect(c.some((p, i) => i > 0 && p.y < c[i - 1].y)).toBe(true);
  });

  it('ideLines produces indented, tokenised code', () => {
    const lines = ideLines();
    expect(lines.length).toBeGreaterThanOrEqual(8);
    expect(lines.some((l) => l.indent > 0)).toBe(true);
    expect(lines.every((l) => l.tokens.length > 0)).toBe(true);
    expect(lines.some((l) => l.tokens.some((t) => t.kind === 'kw'))).toBe(true);
  });

  it('latexLines and bloombergRows are non-empty and plain data', () => {
    expect(latexLines().length).toBeGreaterThanOrEqual(5);
    const rows = bloombergRows();
    expect(rows.length).toBeGreaterThanOrEqual(6);
    expect(rows.some((r) => r.up)).toBe(true);
    expect(rows.some((r) => !r.up)).toBe(true);
  });

  it('contains no CJK anywhere (English-only rule)', () => {
    const all = JSON.stringify([ideLines(), latexLines(), bloombergRows(), SCREEN_CONTENT]);
    expect(/[一-鿿]/.test(all)).toBe(false);
  });
});

describe('SCREEN_CONTENT — the slot binding', () => {
  it('covers all 5 slots exactly once', () => {
    expect(SCREEN_CONTENT.map((s) => s.slot).sort()).toEqual([0, 1, 2, 3, 4]);
  });

  it('three slots navigate and two announce', () => {
    const links = SCREEN_CONTENT.filter((s) => s.href);
    const announces = SCREEN_CONTENT.filter((s) => s.announce);
    expect(links).toHaveLength(3);
    expect(announces).toHaveLength(2);
    // never both — a control either goes somewhere or says it is coming
    for (const s of SCREEN_CONTENT) expect(Boolean(s.href) && Boolean(s.announce)).toBe(false);
  });

  it('links point at real routes', () => {
    const hrefs = SCREEN_CONTENT.filter((s) => s.href).map((s) => s.href);
    expect(hrefs.sort()).toEqual(['/experience', '/projects', '/research']);
  });

  it('every slot has a short label for the overlay control', () => {
    for (const s of SCREEN_CONTENT) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.label.length).toBeLessThanOrEqual(24);
    }
  });
});
