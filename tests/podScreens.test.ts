import { describe, it, expect } from 'vitest';
import { parsePeriod, ganttBars } from '../src/lib/podScreens';
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
