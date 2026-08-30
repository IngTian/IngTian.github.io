import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { KINDS, buildKinds, sorted, totalEntries } from '../src/data/writing';

/**
 * The seam between the taxonomy (TypeScript) and the pieces (markdown files).
 *
 * Both failures guarded here are SILENT: a piece whose `kind` no section declares simply never renders, and a
 * mis-grouped entry appears under the wrong heading. Neither throws, neither fails the build, and neither is
 * visible unless you happen to look at the right page.
 */
describe('writing content seam', () => {
  const entry = (kind: string, slug: string, date = '2026-01-01') => ({
    slug,
    title: slug,
    date,
    blurb: 'b',
    kind,
  });

  it('keeps the schema enum and the kind keys in step', () => {
    // Read content.config.ts as text rather than importing it: it imports `astro:content`, a virtual module
    // that only exists inside an Astro build, so vitest cannot load it. Parsing the enum is less elegant than
    // importing it and it catches the thing that actually goes wrong — someone adds a kind to one file and not
    // the other.
    const src = readFileSync(new URL('../src/content.config.ts', import.meta.url), 'utf8');
    const enumMatch = /kind:\s*z\.enum\(\[([^\]]+)\]\)/.exec(src);
    expect(enumMatch, 'could not find the kind enum in content.config.ts').toBeTruthy();
    const schemaKinds = [...enumMatch![1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
    expect(schemaKinds).toEqual(KINDS.map((k) => k.key).sort());
  });

  it('groups entries under their declared kind', () => {
    const built = buildKinds([entry('quotes', 'a'), entry('essays', 'b'), entry('quotes', 'c')]);
    const byKey = Object.fromEntries(built.map((k) => [k.key, k.entries.map((e) => e.slug)]));
    expect(byKey.quotes).toEqual(['a', 'c']);
    expect(byKey.essays).toEqual(['b']);
    expect(byKey.notes).toEqual([]);
  });

  it('drops the kind field from the entries it emits', () => {
    // The kind is the grouping key, not a property of the piece — leaving it on would let a template render a
    // section heading from an entry and quietly disagree with the section it sits in.
    const [first] = buildKinds([entry('quotes', 'a')]).find((k) => k.key === 'quotes')!.entries;
    expect(first).not.toHaveProperty('kind');
    expect(first.slug).toBe('a');
  });

  it('preserves taxonomy order and keeps empty kinds, so a section still announces itself', () => {
    const built = buildKinds([entry('quotes', 'a')]);
    expect(built.map((k) => k.key)).toEqual(KINDS.map((k) => k.key));
    expect(built.every((k) => typeof k.empty === 'string' && k.empty.length > 0)).toBe(true);
  });

  it('ignores an entry whose kind no section declares, rather than throwing', () => {
    // A piece can only reach buildKinds after passing the schema's enum, so this is belt and braces — but the
    // failure mode if it ever happened must be a missing row, not a broken build of the whole site.
    const built = buildKinds([entry('nonexistent', 'x'), entry('quotes', 'a')]);
    expect(totalEntries(built)).toBe(1);
  });

  it('leaves ordering to sorted(), newest first', () => {
    const built = buildKinds([
      entry('quotes', 'old', '2020-01-01'),
      entry('quotes', 'new', '2026-08-15'),
    ]);
    const quotes = built.find((k) => k.key === 'quotes')!;
    expect(sorted(quotes).map((e) => e.slug)).toEqual(['new', 'old']);
  });
});
