// tests/cowTalk.test.ts
// The /projects cow: what it says (data/cowLines.ts) and when it may say it (lib/cowTalk.ts).
import { readFileSync } from 'node:fs';
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

// THE COLUMN HOLDS THE WIDEST BUBBLE. From 1180px the cow is fixed in a right-hand gutter, which spec §3 (the owner's)
// says exists so the cow never overlaps content — and its bubble is as wide as the line it is saying. The mockup's
// gutter left the widest bubble 52px over the content column from 1180 to 1440 (Task 9's measurement), so the
// gutter is now the cow's inset plus a reserve, and this holds the reserve against the copy: a longer line must
// widen the gutter, not reach back over the column.
describe("the cow's right-hand column (projects.astro)", () => {
  const read = (f: string): string => readFileSync(new URL(f, import.meta.url), 'utf8');
  it('reserves the widest line\'s bubble plus a 24px gap', () => {
    const page = read('../src/pages/projects.astro');
    const reserve = /calc\(max\(26px, 3\.2vw\) \+ (\d+)px - \(100% - min\(100%, 1500px\)\)\)/.exec(page)?.[1];
    expect(reserve, 'projects.astro no longer reserves the gutter as max(26px, 3.2vw) + Npx').toBeTruthy();
    // and the cow sits at that same inset, so the reserve is measured from where it actually is
    expect(page).toMatch(/\.cowbox \{ position: fixed; right: max\(26px, 3\.2vw\);/);
    const font = /\.cow-wrap--rail \.cow-says \{[^}]*font-size: ([\d.]+)px;[^}]*letter-spacing: 0;/.exec(read('../src/components/PlushCow.astro'))?.[1];
    expect(font, "PlushCow's rail line is no longer a px size with no letter-spacing").toBeTruthy();
    // The script sizes the line in ch, and JetBrains Mono's advance is 0.6em. The box adds the rail's padding (3
    // cells a side) and border (1 cell) at its 4px cell: 32px.
    const widest = Math.max(...ALL.flat().map((h) => h.length));
    const bubble = widest * Number(font) * 0.6 + 32;
    expect(Number(reserve) - bubble).toBeGreaterThanOrEqual(24);
  });
});
