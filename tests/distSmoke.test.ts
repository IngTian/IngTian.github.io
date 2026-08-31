import { readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PAGES } from '../src/data/nav';

/* ================================================================================================
   THE FIRST TEST THAT LOOKS AT WHAT THE SITE ACTUALLY SHIPS.

   Before this file the suite was ~820 assertions and every one of them called a function. Nothing
   had ever read a byte of dist/. That is a specific, and expensive, shape of blind spot: this is a
   static site, so the build output IS the product, and the interesting failures are not wrong
   arithmetic inside lib/ — they are two files that were supposed to agree and don't, a link whose
   target got renamed, a prop nobody passed. Those cannot be reached from a unit test, because from
   a unit test's point of view every part in isolation is correct. Three of the four defects in the
   batch this file was written for would have been caught here:

     - a "back to the section" link pointing at /writing#misc while the section renders id="w-misc";
     - the footer's page list drifting from data/nav.ts's, silently dropping a whole route;
     - two prototype routes shipping a self-referential <link rel="canonical"> instead of noindex.

   HOW IT READS THE HTML. Regex over the built files, no parser. That is a deliberate choice, not a
   shortcut: adding jsdom/cheerio to devDependencies to grep for `id="x"` would put a dependency in
   the deploy path for a job four regexes do, and tests/writingContent.test.ts already establishes
   node:fs + a regex as how this repo reads a file it cannot import. The cost is that the queries
   have to stay simple. Where that cost bites, it is written down next to the assertion.

   IT NEEDS A BUILD, AND THAT IS A WORKFLOW DEPENDENCY. `npm run build` must have run first, and a
   missing dist/ is a LOUD failure rather than a skip — a test that quietly passes when its subject
   is absent is exactly the `passWithNoTests: false` footgun in another costume (see the note in
   vitest.config.ts). ci.yml already orders Build before Test. deploy.yml's gate job did NOT: it ran
   `npm test` on a bare checkout, so that job needs a build step before its Test step or this file
   fails the deploy. Any future workflow that runs the suite needs the same.
   ================================================================================================ */

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));

const NEEDS_BUILD =
  'tests/distSmoke.test.ts found no HTML in dist/. It inspects the BUILT site, so `npm run build` ' +
  'has to run before `npm test`. ci.yml already orders it that way. If you are seeing this in a ' +
  "workflow, that workflow's test job needs `npm run build` added before its Test step — " +
  "deploy.yml's did.";

interface Page {
  /** dist-relative path with forward slashes, e.g. "writing/index.html". */
  file: string;
  /** The URL path this file serves, never trailing-slashed: "/", "/writing", "/404.html". */
  route: string;
  html: string;
  /** `html` with <script>/<style>/comments removed — see stripNonMarkup. */
  markup: string;
  /** Every id present in the served HTML. */
  ids: Set<string>;
}

const htmlFiles = (dir: string, out: string[] = []): string[] => {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out; // dist/ absent entirely — the guard below turns that into a readable failure.
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) htmlFiles(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
};

/**
 * Drop <script>, <style> and comments before scanning for markup.
 *
 * Not tidiness — correctness. BaseLayout inlines a JSON-LD block and a theme bootstrap, and a naive
 * href/img scan over the raw file would pick up URL strings and selectors out of JavaScript and
 * report them as links the page offers. The flip side, worth stating because it bounds what this
 * file can promise: nodes a script CREATES at runtime are not here either. The /art photo grid is
 * built by scripts/artGallery.ts, so its <img>s are only covered to the extent the build emits
 * them. Rendered-output tests see rendered output; they are not a browser.
 */
const stripNonMarkup = (html: string): string =>
  html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

const routeOf = (rel: string): string => {
  const p = rel.split(sep).join('/');
  if (p === 'index.html') return '/';
  if (p.endsWith('/index.html')) return '/' + p.slice(0, -'/index.html'.length);
  return '/' + p; // 404.html, and the Search Console verification file
};

let cached: Page[] | null = null;

/** Every built page. Throws (does not skip) when there is no build to inspect. */
const pages = (): Page[] => {
  if (cached) return cached;
  const files = htmlFiles(DIST).sort();
  if (files.length === 0) throw new Error(NEEDS_BUILD);
  cached = files.map((abs) => {
    const html = readFileSync(abs, 'utf8');
    const markup = stripNonMarkup(html);
    return {
      file: abs.slice(DIST.length).split(sep).join('/'),
      route: routeOf(abs.slice(DIST.length)),
      html,
      markup,
      ids: new Set([...markup.matchAll(/\sid="([^"]*)"/g)].map((m) => m[1])),
    };
  });
  return cached;
};

/** Root-relative route → page, keyed the way routeOf spells it (no trailing slash). */
const byRoute = (): Map<string, Page> => new Map(pages().map((p) => [p.route, p]));

/**
 * The URL the host really serves a route at — the base a relative href resolves against.
 *
 * The trailing slash is the whole point and it is not cosmetic: `new URL('x', '…/writing')` resolves
 * to /x, while `new URL('x', '…/writing/')` resolves to /writing/x. Astro's build emits directory
 * pages (writing/index.html), which GitHub Pages serves at /writing/ — so directory routes get the
 * slash and file routes (404.html) must not.
 */
const servedUrl = (route: string): string =>
  `https://example.invalid${route}${route === '/' || route.endsWith('.html') ? '' : '/'}`;

/** Every href in a page's markup, ignoring off-site and non-navigational schemes. */
const internalHrefs = (p: Page): string[] =>
  [...p.markup.matchAll(/href="([^"]*)"/g)]
    .map((m) => m[1])
    .filter((h) => h !== '' && !/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(h));

/**
 * The proto-* routes are excluded from the link check below, and the reason is written out in the
 * skipped test at the bottom of this file rather than hidden here: they render the shared homepage
 * Toc, whose stop list is the homepage's, so /proto-paper carries five anchors to slides it does
 * not contain. Real defect, wrong file for this round, and it is a noindex diagnostic route — the
 * one class of page where a dead in-page anchor costs a visitor nothing, because there are none.
 */
const isProto = (p: Page): boolean => p.route.startsWith('/proto-');

describe('the built site (dist/) — rendered-output smoke test', () => {
  it('has a build to inspect at all', () => {
    // First, so that a missing dist/ reads as "you did not build" once, instead of as four
    // unrelated-looking failures further down.
    expect(pages().length, NEEDS_BUILD).toBeGreaterThan(5);
  });

  // ── 1. FRAGMENT LINKS RESOLVE ────────────────────────────────────────────────────────────────
  it('resolves every in-page fragment link to an id on the page it points at', () => {
    const routes = byRoute();
    const dead: string[] = [];

    for (const page of pages()) {
      if (isProto(page)) continue;
      for (const href of internalHrefs(page)) {
        const hash = href.indexOf('#');
        if (hash === -1) continue;
        const frag = href.slice(hash + 1);
        // `href="#"` is a no-op affordance and `#top` is defined by the HTML spec to mean the
        // document itself; neither needs an element to exist.
        if (frag === '' || frag === 'top') continue;

        // Resolve against the page's own served URL so a same-page "#x", a sibling "writing#x" and
        // an absolute "/writing#x" all go through one code path. The origin is a throwaway.
        const target = new URL(href, servedUrl(page.route)).pathname.replace(/\/$/, '');
        const dest = routes.get(target === '' ? '/' : target);

        if (!dest) {
          dead.push(`${page.file}: href="${href}" → no built page at ${target || '/'}`);
        } else if (!dest.ids.has(frag)) {
          dead.push(`${page.file}: href="${href}" → ${dest.file} has no id="${frag}"`);
        }
      }
    }

    // One message listing every dead link, because these come in families: a renamed id breaks
    // every link to it at once, and fixing them one failure per run wastes the information.
    expect(dead, `dead fragment links in the built site:\n  ${dead.join('\n  ')}`).toEqual([]);
  });

  // ── 2. THE FOOTER CARRIES THE WHOLE PAGE SET ─────────────────────────────────────────────────
  const footerNav = (): string => {
    const home = byRoute().get('/');
    expect(home, 'dist/index.html is missing').toBeTruthy();
    // Anchored on the footer nav's aria-label rather than a class, because the label is the part
    // that is contractually stable — it is what a screen reader announces, so it cannot be renamed
    // as a styling decision (sections/Signature.astro).
    const mark = 'aria-label="Links and downloads"';
    const at = home!.markup.indexOf(mark);
    expect(
      at,
      'could not find the footer nav (aria-label="Links and downloads") in the homepage. If it was ' +
        'renamed, update this test; if it vanished, the site lost its footer navigation.',
    ).toBeGreaterThan(-1);
    return home!.markup.slice(at, home!.markup.indexOf('</nav>', at));
  };

  /* SKIPPED, AND THE SKIP IS THE FINDING. This assertion fails today, on a real bug that this test
     is what found: the footer is built from `links` in src/data/profile.ts, the corner nav from
     PAGES in src/data/nav.ts, and the two lists have drifted — profile.ts never gained /writing, so
     the rendered footer offers Research / Experience / Projects / Art and the site's newest route is
     reachable only from the corner nav.

     THE FIX (src/data/profile.ts, in `links`, directly after the Research entry — the position
     nav.ts uses and for its stated reason, "the papers, then the thinking around them"):

         { label: 'Research', href: '/research' },
       + { label: 'Writing', href: '/writing' },
         { label: 'Experience', href: '/experience' },

     UN-SKIPPED: profile.ts now carries the Writing link, so this passes. It stays as the guard against the
     two lists diverging again — which is how /writing came to be in the nav and absent from the footer
     that adds the line — it needs no other change. */
  it('offers every nav page in the footer', () => {
    const foot = footerNav();
    const hrefs = new Set([...foot.matchAll(/href="([^"]*)"/g)].map((m) => m[1]));
    for (const p of PAGES) {
      expect(
        hrefs.has(p.href),
        `the homepage footer has no link to ${p.href} (${p.label}), but data/nav.ts lists it as one ` +
          'of the site\'s pages. The footer is built from the `links` array in src/data/profile.ts — ' +
          'add it there.',
      ).toBe(true);
    }
  });

  it('never links the footer at a page the site does not have', () => {
    // The half of the footer/nav agreement that IS green, kept live so the seam has real coverage
    // while the assertion above is parked. It catches the failure the site has actually shipped
    // before (a link to /experience while that route did not exist) from the other direction.
    const foot = footerNav();
    const routes = byRoute();
    for (const href of [...foot.matchAll(/href="(\/[^"#]*)"/g)].map((m) => m[1])) {
      if (/\.\w+$/.test(href)) continue; // /cv.pdf and friends are assets, not routes
      const path = href.replace(/\/$/, '') || '/';
      expect(
        routes.has(path) || routes.has(`${path}.html`),
        `the homepage footer links to ${href}, which built no page`,
      ).toBe(true);
    }
  });

  // ── 3. PROTOTYPE ROUTES ARE NOT INDEXABLE ────────────────────────────────────────────────────
  it('emits robots=noindex and NO canonical on every proto route', () => {
    const protos = pages().filter(isProto);
    // Asserted, not assumed: if the routes are renamed away from the prefix this must go red rather
    // than iterate an empty list and congratulate itself. A lower bound, not an exact count — the
    // proto routes are a workflow and gaining a fifth is the expected case, not a regression.
    expect(protos.length, 'no proto-* routes found in dist/').toBeGreaterThanOrEqual(4);

    for (const p of protos) {
      const robots = /<meta\s[^>]*name="robots"[^>]*>/i.exec(p.html)?.[0] ?? '';
      expect(
        /noindex/i.test(robots),
        `${p.file} has no robots=noindex. Pass noindex={true} to BaseLayout in the matching ` +
          `src/pages/*.astro (see tests/protoNoindex.test.ts).`,
      ).toBe(true);

      // BaseLayout emits one OR the other, so a canonical here means the noindex is not in force —
      // and a self-referential canonical on an internal prototype is a request to index it.
      const canonical = /<link\s[^>]*rel="canonical"[^>]*>/i.exec(p.html)?.[0] ?? '';
      expect(canonical, `${p.file} advertises a canonical URL: ${canonical}`).toBe('');
    }
  });

  // ── 4. ONE H1, AND NO IMAGE WITHOUT ALT ──────────────────────────────────────────────────────
  it('gives every document exactly one <h1>', () => {
    for (const p of pages()) {
      // dist also holds the Google Search Console verification file: a one-line text file that
      // happens to end in .html and is not a document at all. Anything without an <html> element
      // is not being asked for a heading.
      if (!/<html[\s>]/i.test(p.html)) continue;
      const n = (p.markup.match(/<h1[\s>]/gi) ?? []).length;
      expect(n, `${p.file} has ${n} <h1> elements; a document gets exactly one`).toBe(1);
    }
  });

  it('gives every <img> an alt attribute', () => {
    const bare: string[] = [];
    for (const p of pages()) {
      for (const [tag] of p.markup.matchAll(/<img\b[^>]*>/gi)) {
        // Presence, not content: alt="" is the correct and required spelling for a decorative
        // image, so demanding non-empty text here would push authors to write noise for a screen
        // reader to read out.
        if (!/\salt=/.test(tag)) bare.push(`${p.file}: ${tag.slice(0, 120)}`);
      }
    }
    expect(bare, `<img> without alt:\n  ${bare.join('\n  ')}`).toEqual([]);
  });

  /* UN-SKIPPED. The cause is fixed at the source: proto-paper no longer renders the homepage <Toc />, which is
     where its five dead anchors came from. Kept as a test rather than deleted, so a prototype that borrows the
     rail again is caught immediately. Historical note follows — the exclusion `isProto` applies to the fragment
     check above, stated as a test so it is a visible gap rather than a silent filter.

     /proto-paper renders the shared homepage <Toc />, whose stop list is the HOMEPAGE's slides, but
     its own <main> holds only PaperHeights, PaperInterlude, Mountains and Signature. So five of its
     seven rail entries — #choice, #rules, #solve, #story, #appendix — point at ids that page does not
     contain, and clicking them does nothing. Verified in the built HTML: proto-paper/index.html has
     ids heights, terrain, terrain-bubble, interlude, mountains, ri-gloss, signature.

     Parked rather than fixed because the fix belongs in components/Toc.astro (or in proto-paper's
     decision to render it), neither of which was assigned this round, and because the cost is
     bounded: these are noindex diagnostic routes with an audience of one. Un-skip after the Toc
     learns its stops from the page it is on, and delete `isProto` in the same change. */
  it('resolves fragments on the proto routes too', () => {
    const routes = byRoute();
    for (const page of pages().filter(isProto)) {
      for (const href of internalHrefs(page)) {
        const hash = href.indexOf('#');
        if (hash === -1) continue;
        const frag = href.slice(hash + 1);
        if (frag === '' || frag === 'top') continue;
        const target = new URL(href, servedUrl(page.route)).pathname.replace(/\/$/, '');
        const dest = routes.get(target === '' ? '/' : target);
        expect(dest?.ids.has(frag), `${page.file}: href="${href}" resolves to nothing`).toBe(true);
      }
    }
  });
});
