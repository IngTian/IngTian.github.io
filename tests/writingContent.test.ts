import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { KINDS, bodyWords, leadAndRest, neighbours, pieces, type WritingEntry } from '../src/data/writing';
import { FIGURES, figureFor } from '../src/lib/writingCovers';

/**
 * The seam between the taxonomy (TypeScript) and the pieces (markdown files): pieces() in data/writing.ts, which
 * every surface that shows a piece reads. What it gets wrong, it gets wrong everywhere at once, and silently: a draft
 * published, a reading time typed by nobody, two pages that disagree on which piece is newest.
 */
const entry = (id: string, date: string, over: Partial<WritingEntry['data']> = {}, html = '<p>A few words here.</p>'): WritingEntry => ({
  id, data: { title: id, date, kind: 'misc', blurb: `What ${id} says.`, ...over }, rendered: { html },
});

describe('the schema', () => {
  // Read as text: content.config.ts imports `astro:content`, a virtual module vitest cannot load.
  const src = readFileSync(new URL('../src/content.config.ts', import.meta.url), 'utf8');

  it("takes its kinds from data/writing.ts and its covers from lib/writingCovers.ts, so neither list is retyped", () => {
    expect(src).toMatch(/\bkind: z\.enum\(KIND_KEYS\)/);
    expect(src).toMatch(/\bcover: z\.enum\(FIGURES\)\.optional\(\)/);
    expect(src).toMatch(/import \{[^}]*\bKIND_KEYS\b[^}]*\} from '\.\/data\/writing'/);
    expect(src).toMatch(/import \{[^}]*\bFIGURES\b[^}]*\} from '\.\/lib\/writingCovers'/);
  });

  // The reading time is computed (bodyWords), so `minutes` is no field, and the strict object refuses it.
  it('has no minutes field, and refuses a field it does not know', () => {
    const writing = /const writing = defineCollection\(\{([\s\S]*?)\n\}\);/.exec(src)?.[1] ?? '';
    expect(writing, 'no writing collection in content.config.ts').toContain('z.strictObject(');
    expect(writing).not.toMatch(/\bminutes:/);
  });
});

describe('pieces', () => {
  it('drops drafts and orders the rest newest first, two on one day by slug', () => {
    const list = pieces([
      entry('old', '2025-03-01'), entry('b', '2026-07-01'), entry('draft', '2027-01-01', { draft: true }),
      entry('a', '2026-07-01'), entry('mid', '2026-01-01'),
    ]);
    expect(list.map((p) => p.slug)).toEqual(['a', 'b', 'mid', 'old']);
  });

  it('builds what the pages read: the href, the figure, the folded search text, featured as a boolean', () => {
    const [p] = pieces([entry('risk-parity', '2026-01-01', { title: 'Why risk parity isn’t “equal”', kind: 'explainers', cover: 'tails' })]);
    expect(p.href).toBe('/writing/risk-parity');
    expect(p.figure).toBe('tails');
    expect(p.featured).toBe(false);
    expect(p.q).toContain("why risk parity isn't \"equal\"");
    expect(p.q).toContain(KINDS.explainers.label.toLowerCase());
    expect(p.q).toContain('what risk-parity says.');
  });

  it("gives a piece with no cover its slug's figure", () => {
    const [p] = pieces([entry('favourite-quotes', '2026-08-15')]);
    expect(FIGURES).toContain(p.figure);
    expect(p.figure).toBe(figureFor('favourite-quotes'));
  });

  // Printed only when it says something new, so a page prints `updated` as it is.
  it('keeps `updated` only when it differs from `date`', () => {
    const [same, later] = pieces([
      entry('same', '2026-01-02', { updated: '2026-01-02' }), entry('later', '2026-01-01', { updated: '2026-03-01' }),
    ]);
    expect(same.updated).toBeUndefined();
    expect(later.updated).toBe('2026-03-01');
  });

  it('computes the reading time from the body, never under a minute', () => {
    const words = (k: number) => `<p>${'word '.repeat(k)}</p>`;
    const [short, long] = pieces([entry('short', '2026-02-01', {}, words(3)), entry('long', '2026-01-01', {}, words(2300))]);
    expect(short.minutes).toBe(1);
    expect(long.minutes).toBe(10);
  });

  // A markdown plugin's throw leaves an entry unrendered rather than failing the build; this fails it, by name.
  it('throws, naming the file, on an entry that did not render', () => {
    expect(() => pieces([{ ...entry('broken', '2026-01-01'), rendered: undefined, filePath: 'src/content/writing/broken.md' }]))
      .toThrow(/src\/content\/writing\/broken\.md did not render/);
  });
});

describe('bodyWords', () => {
  it('counts the text a reader reads, maths left out, an entity neither a word nor a break', () => {
    const math = '<span class="katex"><math><semantics><mi>x</mi><annotation encoding="application/x-tex">x + y</annotation></semantics></math></span>';
    expect(bodyWords(`<h2>Two words</h2><p>Over ${math} the <em>real</em> line, don&#x27;t &#x26; go.</p>`)).toBe(8);
  });
});

describe('leadAndRest', () => {
  const list = pieces([entry('new', '2026-03-01'), entry('star', '2026-02-01', { featured: true }), entry('old', '2026-01-01')]);

  it('leads with the newest featured piece, and keeps the rest newest first', () => {
    const { lead, rest } = leadAndRest(list);
    expect(lead?.slug).toBe('star');
    expect(rest.map((p) => p.slug)).toEqual(['new', 'old']);
  });

  it('leads with the newest piece when none is featured, and with nothing when there is none', () => {
    const plain = pieces([entry('new', '2026-03-01'), entry('old', '2026-01-01')]);
    expect(leadAndRest(plain).lead?.slug).toBe('new');
    expect(leadAndRest(plain).rest.map((p) => p.slug)).toEqual(['old']);
    expect(leadAndRest([])).toEqual({ lead: undefined, rest: [] });
  });
});

describe('neighbours', () => {
  const list = pieces([entry('c', '2026-03-01'), entry('b', '2026-02-01'), entry('a', '2026-01-01')]);

  it('is the newer piece before and the older after, each only where it exists, never wrapping', () => {
    expect(neighbours(list, 'b')).toEqual({ prev: list[0], next: list[2] });
    expect(neighbours(list, 'c')).toEqual({ prev: undefined, next: list[1] });
    expect(neighbours(list, 'a')).toEqual({ prev: list[1], next: undefined });
    expect(neighbours(list.slice(0, 1), 'c')).toEqual({ prev: undefined, next: undefined });
    expect(neighbours(list, 'none')).toEqual({});
  });
});
