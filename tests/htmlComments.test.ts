import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * THE BUILT SITE MUST NOT CARRY ITS OWN DESIGN REVIEW.
 *
 * This repo comments heavily and on purpose — the reasoning next to the code is what stops a fixed bug from
 * being reintroduced, and CLAUDE.md mandates it. But those comments quote internal review verbatim (owner
 * quotes, rejected approaches, measurements of things that failed), and for a long time every one of them
 * reached a visitor's View Source: measured at 79 comments and ~30KB, 56 of them on the homepage alone, 9.6%
 * of that page. astro.config.mjs was already excluding the prototype routes from the sitemap BECAUSE their
 * bodies quote review notes, while the homepage shipped the same material — which was never a decision, just
 * a side effect of the toolchain.
 *
 * WHAT KEEPS IT CLEAN IS THE COMMENT SYNTAX, NOT A BUILD STEP. In a .astro template, `<!-- … -->` is HTML and
 * is emitted; `{/* … *\/}` is a JS expression comment the compiler discards. So every markup comment here is
 * written in the second form and none of them can reach the output.
 *
 * A 529-line `astro:build:done` integration did this job first, by regex over the built HTML, and was deleted
 * once the owner asked the obvious question: why post-process the output when the language already discards
 * these at compile time? This test outlived it, because the PROPERTY is what matters and it is now guarded
 * against a much likelier mistake — someone typing `<!-- -->` out of habit in a new section.
 *
 * ONE SUBTLETY IF THIS EVER FAILS: `{/* … *\/}` is only correct in TEMPLATE position. Inside an expression
 * that is already open — `{cond && ( … )}`, a `.map(x => ( … ))` body — the braces are read as an object
 * literal and the build fails with "Expected ) but found $$render". There the comment must be a bare
 * `/* … *\/` with no braces. That is a build error, not a test failure, but it is the thing that will bite.
 */

const DIST = new URL('../dist/', import.meta.url).pathname;

function htmlFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) htmlFiles(p, out);
    else if (p.endsWith('.html')) out.push(p);
  }
  return out;
}

describe('the built site ships no HTML comments', () => {
  const files = (() => {
    try {
      return htmlFiles(DIST);
    } catch {
      return [];
    }
  })();

  it('has a build to inspect', () => {
    // THROWS rather than skips, deliberately, and the same rule tests/distSmoke.test.ts follows: a test that
    // quietly passes when its subject is absent is worse than no test. It is also how a missing build step in
    // deploy.yml was caught — that gate ran `npm ci && npm test` with no build, so this class of test failed
    // the deploy until a build step was added.
    expect(
      files.length,
      'no HTML in dist/ — run `npm run build` before `npm test` (deploy.yml and ci.yml both do)',
    ).toBeGreaterThan(0);
  });

  it('carries zero HTML comments on any page', () => {
    const offenders: string[] = [];
    for (const f of files) {
      const html = readFileSync(f, 'utf8');
      // The doctype is not a comment. Conditional comments would be, but this site emits none.
      const found = html.match(/<!--[\s\S]*?-->/g) ?? [];
      if (found.length) {
        offenders.push(
          // `?? ''` because noUncheckedIndexedAccess types found[0] as possibly undefined even inside a
          // length check — the compiler cannot know the two are related.
          `${f.replace(DIST, '')}: ${found.length} — first: ${(found[0] ?? '').slice(0, 90).replace(/\s+/g, ' ')}`,
        );
      }
    }
    expect(
      offenders,
      `HTML comments reached the build. In .astro templates use {/* … */} (or a bare /* … */ inside an ` +
        `expression), never <!-- … -->:\n  ${offenders.join('\n  ')}`,
    ).toEqual([]);
  });

  it('still ships the pages it should, so an empty dist cannot pass as clean', () => {
    // Guards the inverse mistake: a build that emitted nothing would trivially have no comments.
    const routes = files.map((f) => f.replace(DIST, ''));
    expect(routes).toContain('index.html');
    expect(routes).toContain('404.html');
    expect(routes.some((r) => r.startsWith('writing/'))).toBe(true);
  });
});
