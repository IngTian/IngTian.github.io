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

// THE IN-FLOW COW (below 1180px, phones included) stands on two hand-synced numbers (Task D, fix round 1). PlushCow's
// rail wrapper is a row with align-items: flex-end, so without its own align-self the cow sat on the bottom of a line
// as tall as the phone's bubble: 23px low at rest, 18px lower for every row a line wrapped to. And its top is the
// prompt line's top (TerminalHeader's .idle margin) so the hop on each line, overshoot included, stays under the
// summary's type. The 0.5px is the overshoot's spill into the summary's half-leading; measured in one headless Chrome
// at 61 widths from 320 to 1179, the horns at the peak stayed at least 1.67px under every glyph box.
describe('the in-flow cow (projects.astro, below 1180px)', () => {
  const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
  const page = read('../src/pages/projects.astro');
  const cow = read('../src/components/PlushCow.astro');
  const flow = /@media \(max-width: 1179px\) \{([\s\S]*?)\n {2}\}/.exec(page)?.[1] ?? '';
  const rule = /\.cowbox :global\(\.cow\) \{([^}]*)\}/.exec(flow)?.[1] ?? '';

  it("is top-aligned, so the bubble's height cannot move it", () => {
    expect(cow).toMatch(/\.cow-wrap--rail \{[^}]*align-items: flex-end;/);
    expect(rule).toMatch(/align-self: flex-start;/);
  });

  it("stands on the prompt line's top, high enough to clear the hop's overshoot", () => {
    const margin = Number(/margin-top: ([\d.]+)px;/.exec(rule)?.[1]);
    const idle = Number(/\.idle \{ margin-top: ([\d.]+)px; \}/.exec(read('../src/components/projects/TerminalHeader.astro'))?.[1]);
    expect(margin).toBe(idle);
    const hop = Number(/@keyframes cow-hop \{[\s\S]*?40% +\{ transform: translateY\(-([\d.]+)px\); \}/.exec(cow)?.[1]);
    const [, y1, , y2] = (/animation: cow-hop [\d.]+s cubic-bezier\(([^)]*)\)/.exec(cow)?.[1] ?? '').split(',').map(Number);
    let over = 0;
    for (let t = 0; t <= 1; t += 1e-3) over = Math.max(over, 3 * (1 - t) ** 2 * t * y1 + 3 * (1 - t) * t * t * y2 + t ** 3);
    expect(hop).toBeGreaterThan(0);
    expect(hop * over).toBeLessThanOrEqual(margin + 0.5);
  });
});
