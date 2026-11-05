// tests/dates.test.ts — the one date helper, as every page prints a date.
import { describe, expect, it } from 'vitest';
import { longDate, monthYear } from '../src/lib/dates';

describe('lib/dates', () => {
  it('prints a day as the site writes it', () => {
    expect(longDate('2026-11-03')).toBe('3 November 2026');
    expect(longDate('2025-08-13')).toBe('13 August 2025');
  });

  it('prints a month, long or short', () => {
    expect(monthYear('2020-02-29')).toBe('February 2020');
    expect(monthYear('2025-08-31', 'short')).toBe('Aug 2025');
  });

  // Parsed as local time, a YYYY-MM-DD date is a day early west of Greenwich.
  it('keeps the 1st of a month in its month, whatever the time zone', () => {
    expect(monthYear('2026-11-01')).toBe('November 2026');
    expect(longDate('2026-01-01')).toBe('1 January 2026');
  });
});
