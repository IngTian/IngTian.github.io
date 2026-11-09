// src/lib/experience.ts
// /experience's pure half: an organisation's span from its roles' periods, the independent panel's mark (RL-BHRP's
// wealth path as cells, since it has no logo), and a mark's rows as runs of one colour, one <rect> each. Pure.

/** A mark's colours by role ('k' ink, 'm' mid-ink, 's' seal), on the light sheet and on the dark one. */
export interface Brand {
  light: Partial<Record<'k' | 'm' | 's', string>>;
  dark: Partial<Record<'k' | 'm' | 's', string>>;
}

/**
 * The span of an organisation's roles, written as the timeline writes a period ("2023 — 25", "2026 —"): the earliest
 * start to the latest end, open if any role is. One role's period is returned as written ("Fall 2027 —").
 */
export function orgPeriod(periods: readonly string[]): string {
  if (periods.length === 1) return periods[0];
  const spans = periods.map((p) => {
    const m = /(\d{4})(?:\s*—\s*(\d{2,4})?)?/.exec(p);
    if (!m) throw new Error(`orgPeriod: no year in "${p}"`);
    const start = Number(m[1]);
    const open = /—\s*$/.test(p);
    const end = open ? Infinity : m[2] ? (m[2].length === 2 ? Math.floor(start / 100) * 100 + Number(m[2]) : Number(m[2])) : start;
    return { start, end };
  });
  const start = Math.min(...spans.map((s) => s.start));
  const end = Math.max(...spans.map((s) => s.end));
  if (end === Infinity) return `${start} —`;
  if (end === start) return String(start);
  return `${start} — ${Math.floor(end / 100) === Math.floor(start / 100) ? String(end % 100).padStart(2, '0') : end}`;
}

/**
 * A wealth path as an n x n mark: one column a point (sampled evenly), its value the line's row, in ink, with the
 * area under it in mid-ink, and one empty cell of margin. The independent panel's mark, from RL-BHRP's series.
 */
export function chartRows(series: readonly number[], n: number): string[] {
  const inner = n - 2;
  const lo = Math.min(...series), hi = Math.max(...series);
  const grid = Array.from({ length: n }, () => Array<string>(n).fill('.'));
  for (let i = 0; i < inner; i++) {
    const v = series[Math.round((i * (series.length - 1)) / (inner - 1))];
    const top = n - 2 - Math.round(((v - lo) / (hi - lo)) * (inner - 1));
    grid[top][i + 1] = 'k';
    for (let y = top + 1; y <= n - 2; y++) grid[y][i + 1] = 'm';
  }
  return grid.map((r) => r.join(''));
}

/** A mark's rows as horizontal runs of one role, so a 24-cell mark is a few dozen rects rather than hundreds. */
export function runs(rows: readonly string[]): { x: number; y: number; w: number; c: string }[] {
  return rows.flatMap((r, y) => {
    const out: { x: number; y: number; w: number; c: string }[] = [];
    for (let x = 0; x < r.length;) {
      let e = x + 1;
      while (e < r.length && r[e] === r[x]) e++;
      if (r[x] !== '.') out.push({ x, y, w: e - x, c: r[x] });
      x = e;
    }
    return out;
  });
}
