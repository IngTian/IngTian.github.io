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
  // the full-width forms. TEXT: the English-only rule governs words the site sets, not pictures of the owner's works
  // (CLAUDE.md, The concept) — manifold's screensaver frames keep the motto they were recorded with.
  it('prints no CJK text', () => {
    const cjk = (cp: number): boolean =>
      (cp >= 0x3000 && cp <= 0x9fff) || (cp >= 0xac00 && cp <= 0xd7af) ||
      (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0xff00 && cp <= 0xffef);
    const found = ALL.flatMap((pair) => [...pair.join(' ')]).filter((c) => cjk(c.codePointAt(0)!));
    expect(found).toEqual([]);
  });
});

// THE BUBBLE IS CAPPED TO THE COW'S COLUMN, AND THE COLUMN IS THE MOCKUP'S. From 1180px the cow is fixed in a
// right-hand gutter, which spec §3 (the owner's) says exists so the cow never overlaps content — and its bubble is as
// wide as the line it says. The mockup's gutter, calc(4vw + 210px), is narrower than the widest bubbles (~272px) from
// 1180 to ~1560px. The controller's call (Task D, D7) was to cap the bubble to the gutter rather than widen it, so a
// long half wraps inside the bubble. This holds the cap and the gutter to the same terms: neither moves alone.
describe("the cow's right-hand column (projects.astro)", () => {
  const page = readFileSync(new URL('../src/pages/projects.astro', import.meta.url), 'utf8');
  const wide = [...page.matchAll(/@media \(min-width: 1180px\) \{([\s\S]*?)\n {2}\}/g)].map((m) => m[1]).join('\n');

  it("keeps the mockup's gutter", () => {
    expect(wide).toMatch(/\.projects-page \{ padding-right: calc\(4vw \+ 210px\); \}/);
  });

  it("caps the cow's box at that gutter, less the cow's own inset", () => {
    const box = /\.cowbox \{([^}]*)\}/.exec(wide)?.[1] ?? '';
    expect(box).toMatch(/right: max\(26px, 3\.2vw\);/);
    // The box is fixed, so 100% is the viewport; past the main's 1500px max-width the room beyond it is the cow's.
    expect(box).toMatch(/max-width: calc\(100% - min\(100%, 1500px\) \+ 4vw \+ 210px - max\(26px, 3\.2vw\)\);/);
  });
});
