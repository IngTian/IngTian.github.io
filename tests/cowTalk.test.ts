// tests/cowTalk.test.ts
// The /projects cow: what it says (data/cowLines.ts) and when it may say it (lib/cowTalk.ts).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PROJECT_COW_LINES } from '../src/data/cowLines';
import { projects, WITNESS_RELEASES } from '../src/data/profile';
import { TYPE_MS, idleLines, mayIdle, nextLine } from '../src/lib/cowTalk';
import { MOTION_LIMIT_MS } from '../src/lib/motion';
import { BOOT_DEADLINE_MS } from '../src/lib/projectsBoot';

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
    expect(mayIdle(20000, 5000)).toBe(true);
    expect(mayIdle(18999, 5000)).toBe(false);
  });

  // Arrival counts as a line, and the decider's failsafe ends any boot by BOOT_DEADLINE_MS: so no idle line in a boot.
  it('stays quiet through the boot', () => {
    expect(mayIdle(BOOT_DEADLINE_MS, 0)).toBe(false);
  });
});

// IT STOPS ON ITS OWN (WCAG 2.2.2, lib/motion.ts). Unbounded, the idle chatter popped a bubble,
// typed and hopped beside the listing every 14-32s for as long as the page was open, and pressing the cow only said
// more. Now everything it does unasked — the greeting plus idleLines() idle lines — must add up to less movement than
// MOTION_LIMIT_MS, the way motionLimit.test.ts holds the cursor's blinks. A line's pop, hop and typing start together;
// its fade comes after BUBBLE_MS of stillness. The pop/fade and the hop are read from PlushCow.astro's stylesheet.
describe('idleLines', () => {
  const page = readFileSync(new URL('../src/pages/projects.astro', import.meta.url), 'utf8');
  const cow = readFileSync(new URL('../src/components/PlushCow.astro', import.meta.url), 'utf8');

  it('says none unprompted on a phone or under reduced motion, and the page asks with both', () => {
    expect([idleLines(true, false), idleLines(false, true), idleLines(true, true)]).toEqual([0, 0, 0]);
    expect(page).toMatch(/let idleLeft = idleLines\(phone, reduce\);/);
    expect(page).toMatch(/if \(idleLeft <= 0\) return;/);
  });

  it('adds up to under the limit: a counted number of lines, then quiet', () => {
    const hop = /\.cow\.is-hop \.cow-art \{ animation: cow-hop ([\d.]+)s/.exec(cow);
    const bubble = /\.cow-wrap--talk \.cow-bubble \{[^}]*?transition: opacity ([\d.]+)s, transform ([\d.]+)s/.exec(cow);
    expect(hop, "PlushCow's `cow-hop` animation").not.toBeNull();
    expect(bubble, "the talking bubble's transition").not.toBeNull();
    const ease = Math.max(Number(bubble![1]), Number(bubble![2])) * 1000;
    const moves = (pair: readonly string[]): number =>
      Math.max(pair.join('').length * TYPE_MS, Number(hop![1]) * 1000, ease) + ease;
    const n = idleLines(false, false);
    expect(Number.isInteger(n), `${n} idle lines`).toBe(true);
    expect(n).toBeGreaterThan(0);   // the owner's "now and then": bounded, not deleted
    const total = Math.max(...hello.map(moves)) + n * Math.max(...idle.map(moves));
    expect(total).toBeLessThanOrEqual(MOTION_LIMIT_MS);
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

  // witness's release count is hand-maintained in profile.ts; the joke quotes it, so the two must not drift.
  it("quotes witness's release count from profile.ts", () => {
    expect(byKey.witness.some(([a]) => a === `${WITNESS_RELEASES} releases.`)).toBe(true);
  });
});

// THE BUBBLE IS CAPPED TO THE COW'S COLUMN, AND THE COLUMN IS THE MOCKUP'S. From 1180px the cow is fixed in a
// right-hand gutter, which spec §3 (the owner's) says exists so the cow never overlaps content — and its bubble is as
// wide as the line it says. The mockup's gutter, calc(4vw + 210px), is narrower than the widest bubbles (~272px) from
// 1180 to ~1560px. The bubble is capped to the gutter rather than the gutter widened, so a long half wraps inside
// the bubble. This holds the cap and the gutter to the same terms: neither moves alone.
describe("the cow's right-hand column (projects.astro)", () => {
  const page = readFileSync(new URL('../src/pages/projects.astro', import.meta.url), 'utf8');
  const wide = [...page.matchAll(/@media not all and \(max-width: 1179px\) \{([\s\S]*?)\n {2}\}/g)].map((m) => m[1]).join('\n');

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

// THE IN-FLOW COW (below 1180px, phones included) stands on two hand-synced numbers. PlushCow's
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

// THE PHONE STRIP HOLDS EVERY LINE. On a phone the bubble opens below the prompt into a strip of fixed
// height — projects.astro's `.cowbox { height: calc(4px + 4 * 1.45 * 12.5px + …) }`, four rows of the cow's type —
// beside the 88px cow, so its halves wrap to what is left of the column. A line that wrapped to a fifth row would
// overrun the strip into the gallery's cards with the suite green, the hole this closes: every half is word-wrapped
// here at the narrowest column, from the same literals the stylesheets use, and each pair must fit the strip's rows.
describe("the phone's strip (projects.astro, ≤640px)", () => {
  const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
  const page = read('../src/pages/projects.astro');
  const cow = read('../src/components/PlushCow.astro');
  const num = (re: RegExp, src: string, what: string): number[] => {
    const m = re.exec(src);
    if (!m) throw new Error(`could not find ${what}: the stylesheet changed shape, so this spec must follow it`);
    return m.slice(1).map(Number);
  };
  const phone = /@media \(max-width: 640px\) \{([\s\S]*?)\n {2}\}/.exec(page)?.[1] ?? '';
  const flow = /@media \(max-width: 1179px\) \{([\s\S]*?)\n {2}\}/.exec(page)?.[1] ?? '';

  // The narrowest viewport the site is measured at (CLAUDE.md, Phones). A mono advance is 0.6em (JetBrains Mono,
  // 600 of 1000 units), the cell TerminalHeader's banner is drawn on.
  const NARROWEST = 320, ADVANCE_EM = 0.6;
  const [rows, stripLh, stripFont] = num(/\.cowbox \{ height: calc\(4px \+ (\d+) \* ([\d.]+) \* ([\d.]+)px \+/, phone, "the strip's height");
  const [padVw] = num(/\.projects-page \{[^}]*padding: 0 ([\d.]+)vw /, page, "the page's side padding");
  const [art] = num(/\.cowbox :global\(\.cow-art\) \{ width: ([\d.]+)px;/, flow, "the in-flow cow's width");
  const [gapMin, gapVw, gapMax] = num(/\.cow-wrap \{[^}]*gap: clamp\(([\d.]+)px, ([\d.]+)vw, ([\d.]+)px\);/, cow, "the cow's gap");
  const [cell] = num(/\.cow-wrap--rail \{ --moo-cell: ([\d.]+)px;/, cow, "the rail cow's cell");
  const [padCells] = num(/\.cow-wrap--rail \.cow-bubble \{\s*padding: calc\(var\(--moo-cell\) \* [\d.]+\) calc\(var\(--moo-cell\) \* ([\d.]+)\);/, cow, "the bubble's side padding");
  const [font] = num(/\.cow-wrap--rail \.cow-says \{ margin: 0; font-size: ([\d.]+)px; letter-spacing: 0;/, cow, "the rail cow's type");
  const [lh] = num(/\.cow-says \{[^}]*line-height: ([\d.]+);/, cow, "the cow's leading");

  it('sizes the strip in the type the bubble is set in', () => {
    expect(cow).toMatch(/\.cow-bubble \{[^}]*border: var\(--moo-cell\) solid/);   // one cell a side, used below
    expect([stripFont, stripLh]).toEqual([font, lh]);
  });

  it('fits every half of every line into its rows at the narrowest column', () => {
    const column = NARROWEST * (1 - (2 * padVw) / 100);
    const gap = Math.min(gapMax, Math.max(gapMin, (gapVw / 100) * NARROWEST));
    const text = column - gap - art - 2 * cell - 2 * padCells * cell;   // 281.6 - 4 - 88 - 8 - 24 = 157.6px today
    const perRow = Math.floor(text / (ADVANCE_EM * font));
    expect(perRow).toBeGreaterThan(0);
    // Greedy word wrap, as the browser does it: a half breaks only at spaces, and a word longer than a row overflows.
    const wrap = (s: string): number => {
      let n = 1, at = 0;
      for (const w of s.split(' ')) {
        expect(w.length, `"${w}" is wider than a row`).toBeLessThanOrEqual(perRow);
        if (at === 0) at = w.length;
        else if (at + 1 + w.length <= perRow) at += 1 + w.length;
        else { n += 1; at = w.length; }
      }
      return n;
    };
    const over = ALL.map((pair) => ({ pair: pair.join(' / '), rows: wrap(pair[0]) + wrap(pair[1]) })).filter((l) => l.rows > rows);
    expect(over).toEqual([]);
  });
});
