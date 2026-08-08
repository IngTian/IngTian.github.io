// What each pod monitor displays. Pure data generators — no canvas, no DOM — so
// every screen's content is unit-testable and the painter stays dumb.

import type { TimelineEntry } from '../data/profile';

// ── Monitor 3: a Gantt of tenures, from the REAL timeline ───────────────────

export interface GanttBar {
  label: string;
  /** fractional year */
  start: number;
  end: number;
  kind: 'work' | 'education';
}

/** Where an open-ended range is drawn to. Beyond the incoming PhD's 2027 start so
 *  a present-tense role visibly runs off the right edge of the chart. */
const OPEN_END = 2029;

/**
 * Parse a profile.ts period string to a year span.
 *
 * The real strings are irregular, which is why this is parsed rather than
 * hand-maintained: '2023 — 25' (two-digit end), '2026 —' (open ended),
 * 'Fall 2027 —' (leading word), '2021' (single year), and the awards use
 * typographic apostrophes like ''21–'22'.
 *
 * @returns null when no 4-digit year is present (e.g. the 'Elsewhere' tail label).
 */
export function parsePeriod(period: string): { start: number; end: number } | null {
  const first = period.match(/(\d{4})/);
  if (!first) return null;
  const start = Number(first[1]);

  // Anything after the first year: an en/em dash means a range.
  const rest = period.slice(first.index! + 4);
  const hasDash = /[—–-]/.test(rest);
  if (!hasDash) return { start, end: start + 1 };

  const endMatch = rest.match(/(\d{2,4})/);
  if (!endMatch) return { start, end: OPEN_END };   // open-ended: '2026 —'

  const raw = Number(endMatch[1]);
  // Two-digit end years are within the same century as the start.
  const end = raw < 100 ? Math.floor(start / 100) * 100 + raw : raw;
  return { start, end: end > start ? end : start + 1 };
}

/** Shorten a timeline title to something that fits a screen: keep the employer or
 *  institution, which is the part a reader scans for. */
function shortLabel(title: string): string {
  const afterDot = title.includes(' · ') ? title.split(' · ').pop()! : title;
  const cleaned = afterDot.replace(/^(Incoming\s+)?/, '').trim();
  const short = cleaned.length <= 18 ? cleaned : cleaned.slice(0, 17) + '…';
  // The PhD row is the identity headline — label it as such, not as the university.
  return /University of Toronto/.test(title) ? 'UofT PhD' : short;
}

/**
 * Bars for the Gantt screen: longest-running first, capped at 6 so the screen
 * stays readable at monitor scale.
 */
export function ganttBars(entries: readonly TimelineEntry[], nowYear: number): GanttBar[] {
  const bars: GanttBar[] = [];
  for (const e of entries) {
    const span = parsePeriod(e.period);
    if (!span) continue;
    bars.push({ label: shortLabel(e.title), start: span.start, end: span.end, kind: e.kind });
  }
  return bars
    .sort((a, b) => (b.end - b.start) - (a.end - a.start) || b.start - a.start)
    .slice(0, 6);
}
