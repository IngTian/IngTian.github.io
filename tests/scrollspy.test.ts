import { describe, it, expect } from 'vitest';
import { activeStopIndex } from '../src/lib/scrollspy';

// Viewport 1000px tall => reference line at 400px. A stop is "active" once its
// top has scrolled to/above that line; the last such stop wins.
const VH = 1000;
const DOC = 5000;

describe('activeStopIndex', () => {
  it('returns -1 when there are no stops', () => {
    expect(activeStopIndex([], VH, 0, DOC)).toBe(-1);
  });

  it('selects the first stop before anything crosses the reference line', () => {
    // all stops still below the 400px line
    expect(activeStopIndex([450, 900, 1500], VH, 0, DOC)).toBe(0);
  });

  it('selects the last stop whose top has crossed the reference line', () => {
    // tops at 100 and 300 are above 400 (crossed); 700 is not
    expect(activeStopIndex([100, 300, 700], VH, 600, DOC)).toBe(1);
  });

  it('treats a stop exactly on the reference line as crossed', () => {
    expect(activeStopIndex([400, 900], VH, 0, DOC)).toBe(0);
  });

  it('forces the final stop active when scrolled to the document bottom', () => {
    // none of the tops crossed the line, but we are at the very bottom, so the
    // short final section (e.g. a footer) still lights up
    expect(activeStopIndex([500, 600, 700], VH, DOC - VH, DOC)).toBe(2);
  });

  it('honors the 2px bottom epsilon', () => {
    // 1px short of the bottom still counts as "at bottom"
    expect(activeStopIndex([500, 600], VH, DOC - VH - 1, DOC)).toBe(1);
  });
});
