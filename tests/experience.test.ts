// tests/experience.test.ts
// /experience's pure half (lib/experience.ts) and the invariants between its three sources: profile.ts's
// organisations and the timeline's roles that name them, and data/experienceMarks.ts's marks.
import { describe, expect, it } from 'vitest';
import { chartRows, orgPeriod, runs } from '../src/lib/experience';
import { compileGlyph, coverage } from '../src/lib/pixels';
import { organisations, timeline } from '../src/data/profile';
import { MARKS } from '../src/data/experienceMarks';
import { REPRO } from '../src/data/papers/rl-bhrp';

describe('orgPeriod', () => {
  it('returns one role’s period as written', () => {
    expect(orgPeriod(['Fall 2027 —'])).toBe('Fall 2027 —');
  });
  it('spans the earliest start to the latest end, in the timeline’s own form', () => {
    expect(orgPeriod(['2023 — 25', '2021'])).toBe('2021 — 25');
    expect(orgPeriod(['2021 — 23', '2019 — 23'])).toBe('2019 — 23');
    expect(orgPeriod(['1999', '2001'])).toBe('1999 — 2001');
  });
  it('stays open while any role is', () => {
    expect(orgPeriod(['2026 —', '2023 — 25'])).toBe('2023 —');
  });
  it('refuses a period with no year', () => {
    expect(() => orgPeriod(['soon', '2020'])).toThrow(/no year/);
  });
});

describe('chartRows', () => {
  const rows = chartRows(REPRO.rl, 24);
  it('is an n x n mark of line and area, with an empty margin', () => {
    expect(rows).toHaveLength(24);
    expect(rows.every((r) => r.length === 24 && /^[.km]+$/.test(r))).toBe(true);
    expect(rows[0] + rows[23] + rows.map((r) => r[0] + r[23]).join('')).toMatch(/^\.+$/);
  });
  it('has one line cell a column, the area under it', () => {
    for (let x = 1; x < 23; x++) {
      const col = rows.map((r) => r[x]).join('');
      expect(col, `column ${x}`).toMatch(/^\.+km*\.$/);
    }
  });
  it('ends higher than it starts, as RL-BHRP’s wealth does', () => {
    const top = (x: number) => rows.findIndex((r) => r[x] === 'k');
    expect(top(22)).toBeLessThan(top(1));
  });
});

describe('runs', () => {
  it('covers exactly the filled cells, one run per stretch of one role', () => {
    const rows = ['.kk.s', 'mm...'];
    expect(runs(rows)).toEqual([
      { x: 1, y: 0, w: 2, c: 'k' }, { x: 4, y: 0, w: 1, c: 's' }, { x: 0, y: 1, w: 2, c: 'm' },
    ]);
  });
});

describe("the record and its marks agree", () => {
  it('every role names an organisation, and every organisation has a role and a mark', () => {
    const keys = new Set(organisations.map((o) => o.key));
    expect(timeline.filter((t) => !keys.has(t.org)).map((t) => t.role)).toEqual([]);
    expect(organisations.filter((o) => !timeline.some((t) => t.org === o.key)).map((o) => o.key)).toEqual([]);
    expect(organisations.filter((o) => !MARKS[o.key]).map((o) => o.key)).toEqual([]);
    expect(Object.keys(MARKS).filter((k) => !keys.has(k))).toEqual([]);
  });

  it('every mark is 24 x 24 in the four roles, neither noise nor a block', () => {
    for (const [key, m] of Object.entries(MARKS)) {
      const rows = m.rows ?? chartRows(REPRO.rl, 24);
      expect(rows.length, key).toBe(24);
      expect(rows.every((r) => r.length === 24 && /^[.kms]+$/.test(r)), key).toBe(true);
      const share = coverage(compileGlyph(rows));
      expect(share, `${key} fills ${share.toFixed(2)}`).toBeGreaterThan(0.2);
      expect(share, `${key} fills ${share.toFixed(2)}`).toBeLessThan(0.6);
    }
  });

  it('gives every role a mark uses a colour on both sheets', () => {
    for (const [key, m] of Object.entries(MARKS)) {
      const used = new Set((m.rows ?? chartRows(REPRO.rl, 24)).join('').replace(/\./g, ''));
      for (const r of used) {
        for (const sheet of ['light', 'dark'] as const) {
          expect(m.brand[sheet][r as 'k' | 'm' | 's'], `${key} ${sheet} ${r}`).toMatch(/^#[0-9a-f]{6}$/);
        }
      }
    }
  });
});
