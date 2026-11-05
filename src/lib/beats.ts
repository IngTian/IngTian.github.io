// src/lib/beats.ts
// The beat walk's pure half: the key map. The walk itself (timer, freeze, observer, reduced motion) is
// scripts/beats.ts, which the three explainer slides (sections/Choice, Rules and Solve) drive.

/** The beat an arrow key moves to from `step` of `n`, as a tablist walks: Right and Down forward, Left and Up back,
 *  wrapping at both ends. Null for any other key, which stays the page's. */
export function arrowBeat(key: string, step: number, n: number): number | null {
  const dir = key === 'ArrowRight' || key === 'ArrowDown' ? 1 : key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 0;
  return dir ? (step + dir + n) % n : null;
}
