import { describe, it, expect } from 'vitest';
import { justifyRows } from '../src/lib/justify';

describe('justifyRows', () => {
  it('places every item exactly once, in order', () => {
    const ars = [1.5, 0.75, 1.0, 0.6, 1.8, 0.75, 1.33];
    const rows = justifyRows(ars, 1000, 300, 14);
    const flat = rows.flatMap((r) => r.indices);
    expect(flat).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('each non-last row fills the container width (sum of widths + gaps ≈ width)', () => {
    const ars = [1.5, 0.75, 1.0, 0.6, 1.8, 0.75, 1.33, 0.75, 1.2, 0.66];
    const W = 1200, gap = 14;
    const rows = justifyRows(ars, W, 300, gap);
    rows.slice(0, -1).forEach((row) => {
      const widths = row.indices.reduce((s, i) => s + ars[i] * row.height, 0);
      const total = widths + gap * (row.indices.length - 1);
      expect(Math.abs(total - W)).toBeLessThan(1); // within 1px
    });
  });

  it('row heights stay near the target (no wild blow-ups)', () => {
    const ars = Array.from({ length: 30 }, (_, i) => (i % 3 === 0 ? 1.5 : 0.75));
    const rows = justifyRows(ars, 1100, 320, 14);
    rows.slice(0, -1).forEach((row) => {
      expect(row.height).toBeGreaterThan(180);
      expect(row.height).toBeLessThan(520);
    });
  });

  it('handles a single item (one row, capped near target)', () => {
    const rows = justifyRows([0.75], 1000, 300, 14);
    expect(rows).toHaveLength(1);
    expect(rows[0].indices).toEqual([0]);
    expect(rows[0].height).toBeLessThanOrEqual(300 * 1.16);
  });

  it('returns no rows for an empty input', () => {
    expect(justifyRows([], 1000, 300, 14)).toEqual([]);
  });
});
