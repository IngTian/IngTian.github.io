import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Every prototype route must be un-indexable — asserted over the SOURCE, so a new one is caught the
 * moment it is written rather than after it has been crawled.
 *
 * THE BUG THIS EXISTS FOR. Two proto routes shipped without `noindex`, and BaseLayout's head is a
 * single either/or:
 *
 *     {noindex ? <meta name="robots" content="noindex" /> : <link rel="canonical" href={canonical} />}
 *
 * so the missing prop did not merely fail to discourage a crawler — it took the other branch and
 * emitted `rel="canonical" href="https://ingtian.github.io/proto-…/"`, an explicit request to index
 * that URL, on routes whose rendered bodies carry internal work-in-progress (a scoring rubric,
 * kill-gate notes, and the reasons five earlier attempts were rejected). robots.txt is `Allow: /`,
 * and the sitemap's exclusion does not help: a sitemap is a hint about what to fetch, not a rule
 * about what to keep, and a canonical is the stronger signal.
 *
 * WHY GLOB THE DIRECTORY instead of naming today's routes. The failure mode is additive: the proto
 * routes are a workflow (a candidate costs one function and one page), so there WILL be another one,
 * and it will be written by copying a sibling that already has the prop or one that does not. A test
 * that enumerates today's pages passes forever while the leak grows. This one turns "I forgot" into a
 * red CI check before the page can reach main.
 *
 * HOW MANY ROUTES THERE ARE, AND WHY THE FLOOR IS 1. This suite used to require four and name two of
 * them, which was correct while four existed. Three have since been retired — /proto-showpiece (a
 * kill gate for three designs the owner rejected), /proto-paper (a cut-layer experiment) and
 * /proto-ladder (a calibration ladder whose value was picked, shipped, and whose printed numbers had
 * gone stale against the amplitudes FluidSky actually uses). They were answered questions; git keeps
 * them. /proto-sketches survives because its still-frame gate is the cheapest thing that ever worked
 * here. So the floor is 1 rather than 4 — the point of the number was never the
 * count, it was that an empty glob must be RED: renaming the `proto-` prefix would otherwise leave
 * the it.each below with nothing to iterate and this file would go green while checking nothing, the
 * same shape of hole as `passWithNoTests`. Do not "tidy" the floor to 0.
 *
 * The companion check runs over the built HTML — tests/distSmoke.test.ts asserts every
 * dist/proto-*​/index.html really does carry robots=noindex and no canonical, which is what closes the
 * loop in case the prop is passed but the layout stops honouring it.
 */
describe('prototype routes are noindex at the source', () => {
  const pagesDir = new URL('../src/pages/', import.meta.url);
  const protoPages = readdirSync(pagesDir)
    .filter((f) => f.startsWith('proto-') && f.endsWith('.astro'))
    .sort();

  it('finds the proto routes at all (a rename must not silently empty this suite)', () => {
    expect(protoPages.length).toBeGreaterThanOrEqual(1);
    expect(protoPages).toContain('proto-sketches.astro');
  });

  it.each(protoPages)('%s passes noindex to BaseLayout', (file) => {
    const src = readFileSync(new URL(file, pagesDir), 'utf8');

    // The prop must be inside the BaseLayout opening tag, not merely somewhere in the file — a
    // mention in a comment or a `const noindex = true` that nothing reads would satisfy a bare
    // substring search while the page stayed crawlable. So: drop comments, then slice from
    // `<BaseLayout` to the `>` that closes the tag.
    //
    // Comments are stripped FIRST because this repo documents props inline and those notes quote
    // markup: the note above proto-sketches' own noindex contains the literal
    // `<link rel="canonical">`, whose `>` would otherwise end the slice before reaching the prop and
    // fail the page that is correct. An attribute list, once the comments are gone, holds no `>`.
    const src2 = src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/<!--[\s\S]*?-->/g, '');
    const open = src2.indexOf('<BaseLayout');
    expect(open, `${file} does not render <BaseLayout>`).toBeGreaterThan(-1);
    const attrs = src2.slice(open, src2.indexOf('>', open));

    // Both spellings count: `noindex={true}` and the JSX-style bare `noindex`. `noindex={false}`
    // does not — the `=` blocks the shorthand branch and `{false}` blocks the explicit one.
    expect(
      /(^|\s)noindex(\s*=\s*\{true\}|(?=\s|$))/.test(attrs),
      `${file} must pass noindex={true} to BaseLayout. Without it BaseLayout emits a self-referential ` +
        `<link rel="canonical"> instead of <meta name="robots" content="noindex">, which invites Google ` +
        `to index an internal prototype. Add noindex={true} to the <BaseLayout> attributes.`,
    ).toBe(true);
  });
});
