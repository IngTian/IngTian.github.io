// src/lib/dates.ts
// The one date helper: a YYYY-MM-DD date as the site prints it. Parsed as UTC and printed in UTC, because a date
// parsed as local time renders a day early west of Greenwich, which is enough to move the 1st of a month into the
// month before. Pure.

const at = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** "3 November 2026". */
export function longDate(iso: string): string {
  return at(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** "November 2026", or "Nov 2026" with `month: 'short'`. */
export function monthYear(iso: string, month: 'long' | 'short' = 'long'): string {
  return at(iso).toLocaleDateString('en-GB', { month, year: 'numeric', timeZone: 'UTC' });
}
