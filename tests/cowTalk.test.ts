// tests/cowTalk.test.ts
// The /projects cow: what it says (data/cowLines.ts) and when it may say it (lib/cowTalk.ts).
import { describe, expect, it } from 'vitest';
import { PROJECT_COW_LINES } from '../src/data/cowLines';
import { projects } from '../src/data/profile';
import { mayIdle, nextLine } from '../src/lib/cowTalk';

const { hello, idle, byKey } = PROJECT_COW_LINES;
const ALL = [...hello, ...idle, ...Object.values(byKey).flat()];

describe('nextLine', () => {
  it('rotates through a set and wraps: a, b, a', () => {
    const set = [['a', '1'], ['b', '2']] as const;
    let said = 0;
    const out: string[] = [];
    for (let i = 0; i < 3; i++) {
      const r = nextLine(set, said);
      out.push(r.line[0]);
      said = r.said;
    }
    expect(out).toEqual(['a', 'b', 'a']);
  });
});

describe('mayIdle', () => {
  it('speaks unprompted only 14s after its last line', () => {
    expect(mayIdle(20000, 5000, false)).toBe(true);
    expect(mayIdle(18999, 5000, false)).toBe(false);
  });

  it('never speaks during the boot', () => {
    expect(mayIdle(99999, 0, true)).toBe(false);
  });
});

describe('PROJECT_COW_LINES', () => {
  // STORED AS PAIRS: lib/cowSpeech.ts's balanced split would move the break in 6 of these and lose the punchline.
  it('stores every line as two non-empty halves that fit the bubble', () => {
    for (const pair of ALL) {
      expect(pair).toHaveLength(2);
      for (const half of pair) {
        expect(half.trim().length, `${pair.join(' / ')}`).toBeGreaterThan(0);
        expect(half.length, `${pair.join(' / ')}`).toBeLessThanOrEqual(34);
      }
    }
  });

  it('has lines for exactly the seven projects and the in-progress card', () => {
    expect(projects).toHaveLength(7);
    expect(Object.keys(byKey).sort()).toEqual([...projects.map((p) => p.slug), 'in-progress'].sort());
  });

  it("says what macboot is now: one README, not 4,700 lines of bash", () => {
    expect(byKey.macboot).toEqual([
      ['4,700 lines of bash', 'became one good README.'],
      ['Look before you change anything.', 'Words to live by.'],
    ]);
  });

  // witness's release count is hand-maintained on its record; the joke quotes it, so the two must not drift.
  it("quotes witness's release count from its record", () => {
    const count = projects.find((p) => p.slug === 'witness')?.releases?.count;
    expect(byKey.witness.some(([a]) => a === `${count} releases.`)).toBe(true);
  });

  // By code point: CJK symbols and kana through the unified ideographs, Hangul, the compatibility ideographs and
  // the full-width forms.
  it('prints no CJK', () => {
    const cjk = (cp: number): boolean =>
      (cp >= 0x3000 && cp <= 0x9fff) || (cp >= 0xac00 && cp <= 0xd7af) ||
      (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0xff00 && cp <= 0xffef);
    const found = ALL.flatMap((pair) => [...pair.join(' ')]).filter((c) => cjk(c.codePointAt(0)!));
    expect(found).toEqual([]);
  });
});
