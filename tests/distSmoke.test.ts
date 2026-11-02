import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PAGES } from '../src/data/nav';
import {
  INTRO_DURATION_MS, INTRO_DUR_MIN_MS, INTRO_DUR_MAX_MS,
} from '../src/lib/introTimeline';
import { INTRO_SEEN_KEY } from '../src/lib/introSession';

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
 * Does this URL path name a FILE rather than a route?
 *
 * The site's internal hrefs are two populations and they need two different questions asked. Routes
 * (`/writing`, `/writing/favourite-quotes`) are extensionless because Astro emits directory pages;
 * assets carry an extension — `/cv.pdf`, `/favicon.svg`, `/site.webmanifest`, the hashed
 * `/_astro/*.css`, and the two preloaded `/_astro/fonts/*.woff2`. Asking "is there a built page at
 * this path" of `/cv.pdf` would report the CV as a dead link; asking "is there a file on disk" of
 * `/writing` would report every route as one.
 *
 * The dividing line is a dot in the last segment — the same rule check 2 below spells inline as
 * `/\.\w+$/` for the footer's `/cv.pdf`. (Check 2 keeps its own copy on purpose: it *skips* assets,
 * where this one goes on to look for them on disk, so they are not the same predicate doing the same
 * job.) It is a heuristic, and the way it could be wrong is a route whose final segment contains a
 * dot — a writing slug like `v1.0-notes` would be mistaken for a file and looked for on disk. No such
 * route exists today; if one is ever added, this is the line to fix, and it will fail loudly rather
 * than quietly pass.
 */
const namesAFile = (path: string): boolean => /\/[^/]*\.[a-z0-9]+$/i.test(path);

/**
 * Which built routes are prototypes. Used by the noindex check below — and by NOTHING ELSE any more,
 * which is the point of this note.
 *
 * It used to also exclude the proto routes from the fragment-link check, because /proto-paper rendered
 * the shared homepage `<Toc />` whose stop list is the HOMEPAGE's slides, so five of its seven rail
 * entries pointed at ids that page did not contain. That was fixed at the source (proto-paper stopped
 * rendering the Toc) and /proto-paper has since been retired altogether, so the exclusion protected
 * nothing. It is gone, and with it the separate proto-only copy of the fragment check that existed to
 * make the gap visible: the fragment check below now runs over EVERY built page, prototypes included,
 * which is strictly more coverage than the two tests it replaces.
 *
 * Keep it that way. A prototype that borrows the homepage rail again will now fail the main check
 * rather than a parked one, and re-adding an exclusion here would hide it.
 */
const isProto = (p: Page): boolean => p.route.startsWith('/proto-');

describe('the built site (dist/) — rendered-output smoke test', () => {
  it('has a build to inspect at all', () => {
    // First, so that a missing dist/ reads as "you did not build" once, instead of as four
    // unrelated-looking failures further down.
    expect(pages().length, NEEDS_BUILD).toBeGreaterThan(5);
  });

  // ── 1. EVERY INTERNAL LINK RESOLVES ──────────────────────────────────────────────────────────
  // EVERY page, prototypes included — see the note on isProto for why there is no exclusion here.
  //
  // IT USED TO CHECK ONLY THE HREFS CONTAINING A '#'. The loop opened with `if (hash === -1)
  // continue;`, which is a much narrower promise than the test's name implied, and the gap was not
  // theoretical: dist/writing/index.html links its only piece as href="/writing/favourite-quotes",
  // with no fragment — so the sole door to the sole writing piece was checked by nothing at all here,
  // and check 2 below only ever looks inside the homepage footer. A renamed .md file (the slug IS the
  // filename) or a moved route would have shipped a 404 on the newest section of the site with all
  // three gates green.
  //
  // So the fragment is now the OPTIONAL half of the question. Every internal href is resolved to a
  // path first and that path must exist; an href that also names a fragment must additionally find
  // the id on the page it lands on. Same walk, same failure list, strictly more coverage.
  it('resolves every internal link to a built page, and every fragment to an id on it', () => {
    const routes = byRoute();
    const dead: string[] = [];

    for (const page of pages()) {
      for (const href of internalHrefs(page)) {
        const hash = href.indexOf('#');
        const frag = hash === -1 ? null : href.slice(hash + 1);
        // `href="#"` is a no-op affordance and `#top` is defined by the HTML spec to mean the document
        // itself, so neither needs an element to exist. Only the ID half is waived, not the whole
        // href: the old version `continue`d here, which meant a link to a page that does not exist
        // escaped the check entirely as long as it ended in "#top".
        const waiveId = frag === '' || frag === 'top';

        // Resolve against the page's own served URL so a same-page "#x", a sibling "writing#x", an
        // absolute "/writing#x" and a bare "/writing" all go through one code path. `pathname` also
        // drops any query string for free. The origin is a throwaway.
        const path = new URL(href, servedUrl(page.route)).pathname;

        // Assets are checked as files, not as routes — see namesAFile. decodeURIComponent because a
        // filename with a space or a non-ASCII character is percent-encoded in the href and not on
        // disk; the gallery's photos are imported by astro:assets rather than linked, but a future
        // download link would hit this.
        if (namesAFile(path)) {
          const onDisk = join(DIST, decodeURIComponent(path).replace(/^\//, '').split('/').join(sep));
          if (!existsSync(onDisk)) dead.push(`${page.file}: href="${href}" → no file at dist${path}`);
          continue;
        }

        // Routes are keyed without a trailing slash (routeOf), while Astro's own hrefs and the ones
        // hand-written in profile.ts/nav.ts disagree about whether to write one — so normalise here
        // rather than requiring one spelling. '/' normalises to '' and has to come back.
        const target = path.replace(/\/+$/, '') || '/';
        const dest = routes.get(target);

        if (!dest) {
          dead.push(`${page.file}: href="${href}" → no built page at ${target}`);
        } else if (frag !== null && !waiveId && !dest.ids.has(frag)) {
          dead.push(`${page.file}: href="${href}" → ${dest.file} has no id="${frag}"`);
        }
      }
    }

    // One message listing every dead link, because these come in families: a renamed id breaks
    // every link to it at once, and fixing them one failure per run wastes the information.
    expect(dead, `dead internal links in the built site:\n  ${dead.join('\n  ')}`).toEqual([]);
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
    // proto routes are a workflow, so gaining one is the expected case, not a regression.
    //
    // The floor is 1, and it was 4 until three of the four routes were retired (/proto-showpiece,
    // /proto-paper, /proto-ladder — all answered questions; see tests/protoNoindex.test.ts for the
    // full reason each went). Only /proto-sketches ships now. The number is a non-empty guard, not a
    // census, so it does not need to track the count — but it must never become 0.
    expect(protos.length, 'no proto-* routes found in dist/').toBeGreaterThanOrEqual(1);

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

  /* (There is no separate 'resolves fragments on the proto routes too' test any more. It existed only to
     make the `isProto` exclusion in check 1 a visible gap rather than a silent filter; the exclusion is
     gone, so check 1 covers the proto routes directly and this was a strict subset of it — with a worse
     failure message, since it reported one dead anchor per run instead of the whole family at once.) */
});

describe('the homepage intro ships on / and ONLY on /', () => {
  // MOVING THE INTRO UP INTO BaseLayout IS THE ONE EDIT that would hand a 5.2-second construction
  // animation to all nine routes — including /404 and the proto gallery. The retired first-visit gate
  // verified the equivalent property by reading built HTML ("5 data-gate references on /, zero on the
  // other eight"), and this is that check for its replacement.
  //
  // The marker is `data-intro` on the terrain canvas. It is an attribute rather than a class because a
  // class would be a styling hook nobody styles, and nothing in the page reads it — it exists so this
  // assertion can exist. `TerrainHero` renders only via `Heights`, which renders only on the homepage,
  // so today this is one attribute and one regex; the point is that it stays that way.
  const pages = htmlFiles(DIST);

  it('finds the built pages at all', () => {
    // Without this the two assertions below would pass vacuously over an empty list — the exact failure
    // mode a dist-reading test has to rule out first.
    expect(pages.length, 'no built HTML found — run `npm run build`').toBeGreaterThan(5);
  });

  it('marks the intro on the homepage', () => {
    const home = join(DIST, 'index.html');
    expect(existsSync(home)).toBe(true);
    expect(readFileSync(home, 'utf8')).toMatch(/<canvas[^>]*\bdata-intro\b/);
  });

  it('marks it nowhere else', () => {
    const leaked = pages
      .filter((p) => p !== join(DIST, 'index.html'))
      .filter((p) => /\bdata-intro\b/.test(readFileSync(p, 'utf8')))
      .map((p) => p.slice(DIST.length));
    expect(leaked, `the intro leaked onto ${leaked.join(', ')} — has it moved into BaseLayout?`)
      .toEqual([]);
  });

  it('ships the decision INLINE, before the hero, with the constants from lib/', () => {
    // THIS TEST EXISTS BECAUSE THE WELL-TESTED VERSION OF THIS POLICY WAS THE WRONG ONE.
    //
    // `introStillRunning`, `introDurationFrom` and `shouldPlayIntro` lived in lib/introTimeline.ts with
    // 97 lines of specs. Then the decision moved into an `is:inline` script, because only an inline
    // script parses before first paint — and an inline script cannot `import`, so it re-implements the
    // parse and the clamp in raw JS. The three exports lost every production caller while their tests
    // went on passing: a green suite over code nothing ran. They are deleted, and this is the check that
    // replaces them, because it reads the code that actually ships.
    //
    // Two properties, and both have already broken once:
    //   1. INLINE AND BEFORE THE HERO. A bundled `<script>` is deferred and runs after parse, which is
    //      what made the sky flash warm → flat → warm for ~300ms.
    //   2. THE CONSTANTS AGREE WITH lib/. They are passed through `define:vars` precisely so there is one
    //      source; this fails if someone hand-types a number into the inline body.
    const html = readFileSync(join(DIST, 'index.html'), 'utf8');
    const m = html.match(/<script>((?:(?!<\/script>)[\s\S])*?descent\.intro\.seen[\s\S]*?)<\/script>/);
    expect(m, 'no inline intro decider in dist/index.html').not.toBeNull();
    const body = m![1];

    // 1 — inline (the regex only matches a bare `<script>`, so no src), and ahead of the canvas it gates.
    expect(html.indexOf(m![0]), 'the decider must precede the terrain canvas it gates')
      .toBeLessThan(html.search(/<canvas[^>]*\bdata-intro\b/));

    // 2 — the emitted values, against the modules they are supposed to come from.
    const num = (name: string) => Number(body.match(new RegExp(`\\b${name}\\s*=\\s*(-?[\\d.]+)`))?.[1]);
    expect(body).toContain(`"${INTRO_SEEN_KEY}"`);
    expect(num('DEF')).toBe(INTRO_DURATION_MS);
    expect(num('MIN')).toBe(INTRO_DUR_MIN_MS);
    expect(num('MAX')).toBe(INTRO_DUR_MAX_MS);
    // And that the clamp is applied at all — the constants are worthless if nothing uses them.
    expect(body).toMatch(/Math\.min\(\s*MAX\s*,\s*Math\.max\(\s*MIN\s*,/);
  });

  it('does not ship the tuning override anywhere a visitor could reach it', () => {
    // `?intro=1` and `?dur=` exist so the owner can tune on the real page. They are an affordance, not
    // a feature: no link, no sitemap entry, nothing discoverable. If one ever appears in an href the
    // animation becomes reachable as a destination, which is not what it is for.
    const offenders: string[] = [];
    for (const p of pages) {
      const html = readFileSync(p, 'utf8');
      for (const m of html.matchAll(/(?:href|src)="([^"]*(?:[?&](?:intro|dur)=)[^"]*)"/g)) {
        offenders.push(`${p.slice(DIST.length)} → ${m[1]}`);
      }
    }
    expect(offenders, offenders.join(' | ')).toEqual([]);
    const sitemap = join(DIST, 'sitemap-0.xml');
    if (existsSync(sitemap)) {
      expect(readFileSync(sitemap, 'utf8')).not.toMatch(/[?&](intro|dur)=/);
    }
  });
});

describe("/art's image payload, measured on the built output", () => {
  // WHY A BYTE CEILING AND NOT A WIDTHS CHECK. The defect this pins was a `widths` array containing
  // `w.src.width` — the image's NATIVE width — on an element that is also `fetchpriority="high"`. For
  // `spring-couplet-stele` that is 1727w, a 1342 KB webp, so the browser picked it as the page's
  // high-priority LCP resource where the 900w variant (139 KB) covers the element.
  //
  // Asserting the array would have been the weaker test: the array is a means, and what hurts a visitor is
  // bytes on the critical path. So this reads the shipped srcset, resolves the file a browser would actually
  // choose, and weighs it.
  //
  // AND THE DEVICE-PX FIGURE IS DERIVED FROM THE SHIPPED `sizes`, NOT HARD-CODED. This test first wrote
  // `const NEEDED = 1152` with the comment "1440 CSS px at DPR 2, in the `40vw` branch" — which was the very
  // arithmetic that was wrong: the element is height-capped by `max-height: min(82vh, 820px)` and renders at
  // 298–414 CSS px, never the 576 that `40vw` implies. Hard-coding it meant the test agreed with the bug and
  // would have gone on agreeing after the hint was corrected. Parsing the real hint makes this test follow
  // the page instead of a number somebody typed. (Whether the hint itself is *right* is artSizes.test.ts's
  // job — it pins CAL_MAX_H against the CSS cap. These two together are what close the hole.)
  const artHtml = (): string => {
    const p = join(DIST, 'art', 'index.html');
    if (!existsSync(p)) throw new Error('dist/art/index.html missing — run `npm run build`');
    return readFileSync(p, 'utf8');
  };
  const bytesOf = (url: string): number => {
    const p = join(DIST, url.replace(/^\//, ''));
    return existsSync(p) ? readFileSync(p).byteLength : -1;
  };

  it('keeps the eager, high-priority LCP image well under what it was', () => {
    const tag = /<img[^>]*fetchpriority="high"[^>]*>/.exec(artHtml())?.[0] ?? '';
    expect(tag, 'no fetchpriority="high" image on /art — has the LCP hint been dropped?').not.toBe('');

    const srcset = /srcset="([^"]+)"/.exec(tag)?.[1] ?? '';
    const candidates = srcset.split(',')
      .map((s) => s.trim().split(/\s+/))
      .map(([url, w]) => ({ url, w: Number(String(w).replace('w', '')), bytes: bytesOf(url) }))
      .sort((a, b) => a.w - b.w);
    expect(candidates.length, 'the LCP image has no srcset').toBeGreaterThan(1);
    for (const c of candidates) {
      expect(c.bytes, `a srcset candidate is missing from dist: ${c.url}`).toBeGreaterThan(0);
    }

    // Resolve the DESKTOP branch of the shipped `sizes` — the trailing, media-conditionless entry — and read
    // the device px a DPR-2 display asks for from it. A `vw` unit here is itself the regression (the element
    // is height-capped, so its width does not scale with the viewport), which is why that case fails loudly
    // rather than picking a viewport to multiply by.
    const sizes = /sizes="([^"]+)"/.exec(tag)?.[1] ?? '';
    const desktopBranch = sizes.split(',').map((s) => s.trim()).pop() ?? '';
    expect(
      desktopBranch,
      `/art's LCP hint has no px desktop branch — got "${sizes}". A vw bound here means the fluid hint is `
      + 'back; see the note above calSizes() in art.astro and the pair pinned in artSizes.test.ts.',
    ).toMatch(/^\d+(\.\d+)?px$/);
    const NEEDED = Math.ceil(parseFloat(desktopBranch) * 2);

    const chosen = candidates.find((c) => c.w >= NEEDED) ?? candidates[candidates.length - 1];

    // 139 KB today (the 900w variant at 828 device px), down from 1342 KB native and from the 387 KB that
    // capping `widths` alone still fetched. The ceiling leaves room to retune the cap without being so loose
    // that either regression slips back through.
    expect(
      chosen.bytes,
      `the LCP candidate at ${NEEDED} device px is ${(chosen.bytes / 1024).toFixed(0)} KB (${chosen.w}w). `
      + 'If this jumped, check whether a native image width got back into `widths`, or whether `sizes` went '
      + 'back to a viewport fraction, in art.astro.',
    ).toBeLessThan(250 * 1024);
  });

  it('serves every lightbox source as a processed webp, not the untouched original', () => {
    // `data-zoom` was `ImageMetadata.src`, the unprocessed file, which cost 0.6-2.2 MB of JPEG per open.
    // The PIXELS are deliberate — artGallery.ts zooms to 6x, so capping the long edge would have quietly
    // degraded the feature while the byte count looked better. The fix was the container, not the size.
    const zooms = [...artHtml().matchAll(/data-zoom="([^"]+)"/g)].map((m) => m[1]);
    expect(zooms.length, 'no data-zoom attributes on /art').toBeGreaterThan(10);
    const notWebp = zooms.filter((z) => !z.endsWith('.webp'));
    expect(notWebp, `lightbox sources that are not webp: ${notWebp.slice(0, 3).join(', ')}`).toEqual([]);
  });
});

describe("BaseLayout's per-page hooks ship on /projects and ONLY on /projects", () => {
  // `page` puts `data-page` on <html>, the scope tokens.css hangs the drafting palette from; `veil={false}` drops
  // the descent veil, because /projects' boot is its entrance and two entrances back to back would put readable
  // text ~4.4s away. Both are props, so what this guards is a default changing under every other route.
  // Read from `markup` (scripts stripped): the veil's own inline script names `[data-veil]` on every page.
  const veilEl = /<div\b[^>]*\sdata-veil\b/;
  const page = (route: string): Page => {
    const p = byRoute().get(route);
    if (!p) throw new Error(`no built page for ${route} — run \`npm run build\``);
    return p;
  };

  // `.test()` rather than `toMatch` so a failure names the defect instead of printing the whole page.
  it('marks /projects as the drafting page, on <html>, and renders it no veil', () => {
    const { markup } = page('/projects');
    expect(/<html\b[^>]*\sdata-page="drafting"/.test(markup), '<html> on /projects lacks data-page="drafting"')
      .toBe(true);
    expect(veilEl.test(markup), '/projects renders a [data-veil] element').toBe(false);
  });

  it('leaves every other page unmarked, and /research its veil', () => {
    expect(veilEl.test(page('/research').markup), '/research lost its [data-veil] element').toBe(true);
    const marked = pages().filter((p) => p.route !== '/projects' && /\sdata-page=/.test(p.markup)).map((p) => p.route);
    expect(marked).toEqual([]);
  });

  // The drafting ink is sized for the drafting ground (tests/draftingPalette.test.ts), not for the reading sky:
  // light --ink-3 over --reading-grad's lower stops measured 4.20 and 3.89. So the page must not paint a sky.
  it('paints /projects no fluid sky and no sky wash, so its ink sits on the ground it was measured on', () => {
    const { markup } = page('/projects');
    expect(/class="fluid-sky"/.test(markup), '/projects renders the fluid-sky canvas').toBe(false);
    expect(/class="sky-wash"/.test(markup), '/projects renders the SkyWash layer').toBe(false);
  });

  // A face declared below the weight a rule asks for gets a FAKE bold (the engine clamps, then emboldens), and a
  // computed style cannot show that: it reads 600 either way. So compare the request with the declared face.
  it("declares JetBrains Mono up to the nav's current-page weight, so that weight is real, not synthesised", () => {
    const css = readdirSync(join(DIST, '_astro')).filter((f) => f.endsWith('.css'))
      .map((f) => readFileSync(join(DIST, '_astro', f), 'utf8')).join('\n');
    const want = /aria-current=page\][^{]*\{font-weight:(\d+)/.exec(css);
    const face = /@font-face\{font-family:"JetBrains Mono-[^"]*";[^}]*font-weight:(\d+) (\d+)/.exec(page('/research').html);
    expect(want, "no font-weight rule for the nav's current link in dist/_astro/*.css").not.toBeNull();
    expect(face, 'no JetBrains Mono @font-face with a weight range on /research').not.toBeNull();
    expect(Number(want![1])).toBeLessThanOrEqual(Number(face![2]));
  });
});
