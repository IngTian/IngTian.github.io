import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { PAGES } from '../src/data/nav';
import {
  INTRO_DURATION_MS, INTRO_DUR_MIN_MS, INTRO_DUR_MAX_MS,
} from '../src/lib/introTimeline';
import { INTRO_SEEN_KEY } from '../src/lib/introSession';
import { inProgress, projects, publications, timeline } from '../src/data/profile';
import { PAPER_DATA } from '../src/data/papers';
import {
  type Stop, experienceStops, flattenStops, paperPageOwns, paperSections, paperStops, projectSectionId, projectStops,
} from '../src/lib/pageStops';
import type { PaperReport } from '../src/lib/paperMarkdown';
import { countWords, readingMinutes } from '../src/lib/words';
import { renderMarkdown } from './helpers/paperChain';
import { GALLERY_ORDER } from '../src/lib/galleryLayout';
import { EASE, RAIL_ENTER_MS, stagger } from '../src/lib/motionTiming';
import { listingLines } from '../src/lib/projectsListing';
import { BOOT_CMD, BOOT_DEADLINE_MS, BOOT_SEEN_KEY } from '../src/lib/projectsBoot';
import { PHONE_QUERY } from '../src/lib/viewport';

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
const builtPage = (route: string): Page => {
  const p = byRoute().get(route);
  if (!p) throw new Error(`no built page for ${route} — run \`npm run build\``);
  return p;
};
const projectsPage = (): Page => builtPage('/projects');
/** Every bundled stylesheet in dist/_astro, concatenated. */
const distCss = (): string => readdirSync(join(DIST, '_astro')).filter((f) => f.endsWith('.css'))
  .map((f) => readFileSync(join(DIST, '_astro', f), 'utf8')).join('\n');

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

/**
 * What the markdown plugins report for a paper's file (its sections, its words), from the file itself, through the
 * chain the build runs (tests/helpers/paperChain.ts) — a second reading of the file, so a page that renders its rail
 * from anything else is caught. The frontmatter is read for what the report needs: which record it explains.
 */
const paperReport = async (slug: string): Promise<PaperReport> => {
  const path = fileURLToPath(new URL(`../src/content/papers/${slug}.md`, import.meta.url));
  const body = readFileSync(path, 'utf8').replace(/^---\n[\s\S]*?\n---\n/, '');
  const { report } = await renderMarkdown(body, path, { papers: PAPER_DATA, publications, frontmatter: { publication: slug } });
  return report;
};

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

describe("BaseLayout's per-page hooks: /projects is the drafting page, the research routes the paper page", () => {
  // `page` puts `data-page` on <html>, the scope tokens.css hangs a register's palette from; `veil={false}` drops
  // the descent veil — on /projects because its boot is its entrance, on the research routes because the veil would
  // replay on every card click and every way back, holding the text ~1.1s. Both are props, so what this guards is a
  // default changing under every other route.
  // Read from `markup` (scripts stripped): the veil's own inline script names `[data-veil]` on every page.
  const veilEl = /<div\b[^>]*\sdata-veil\b/;
  const pageOf = (markup: string): string | undefined => /<html\b[^>]*\sdata-page="([^"]*)"/.exec(markup)?.[1];
  const isResearch = (route: string): boolean => route === '/research' || route.startsWith('/research/');
  const research = (): Page[] => pages().filter((p) => isResearch(p.route));

  it('marks /projects as drafting, every research route as paper, and no other route at all', () => {
    expect(research().length, 'no research route was built').toBeGreaterThan(0);
    const want = (route: string): string | undefined =>
      route === '/projects' ? 'drafting' : isResearch(route) ? 'paper' : undefined;
    const wrong = pages().filter((p) => pageOf(p.markup) !== want(p.route))
      .map((p) => `${p.route}: data-page=${pageOf(p.markup) ?? '(none)'}`);
    expect(wrong).toEqual([]);
  });

  // `.test()` rather than `toMatch` so a failure names the defect instead of printing the whole page.
  it('renders /projects and the research routes no veil, and /writing its veil', () => {
    for (const p of [projectsPage(), ...research()]) {
      expect(veilEl.test(p.markup), `${p.route} renders a [data-veil] element`).toBe(false);
    }
    expect(veilEl.test(builtPage('/writing').markup), '/writing lost its [data-veil] element').toBe(true);
  });

  // Each register's ink is sized for its own ground (tests/draftingPalette.test.ts, tests/paperPalette.test.ts), not
  // for the reading sky: light drafting --ink-3 over --reading-grad's lower stops measured 4.20 and 3.89. So neither
  // page paints a sky. /writing is the control: the sky it keeps is the markup these patterns look for.
  it('paints /projects and the research routes no fluid sky and no sky wash, and /writing both', () => {
    for (const p of [projectsPage(), ...research()]) {
      expect(/class="fluid-sky"/.test(p.markup), `${p.route} renders the fluid-sky canvas`).toBe(false);
      expect(/class="sky-wash"/.test(p.markup), `${p.route} renders the SkyWash layer`).toBe(false);
    }
    const { markup } = builtPage('/writing');
    expect(/class="fluid-sky"/.test(markup), '/writing lost the fluid-sky canvas').toBe(true);
    expect(/class="sky-wash"/.test(markup), '/writing lost the SkyWash layer').toBe(true);
  });

  // The dot is on every page under a door: its own link's ("page"), or on a page under one (/research/<slug>,
  // /writing/<slug>) its section's ("true"). No other link is marked.
  it('marks the page you are on in the corner nav, or the section it is under', () => {
    const wrong: string[] = [];
    for (const p of pages()) {
      const nav = /<ul id="cnav-list"[^>]*>[\s\S]*?<\/ul>/.exec(p.markup)?.[0] ?? '';
      const marked = [...nav.matchAll(/<a\b[^>]*\shref="([^"]*)"[^>]*\saria-current="([^"]*)"/g)].map((m) => `${m[1]}=${m[2]}`);
      const door = PAGES.find((x) => p.route === x.href || p.route.startsWith(`${x.href}/`));
      const want = door ? [`${door.href}=${p.route === door.href ? 'page' : 'true'}`] : [];
      if (marked.join() !== want.join()) wrong.push(`${p.route}: ${marked.join() || '(none)'}, want ${want.join() || '(none)'}`);
    }
    expect(pages().some((p) => p.route === '/research/rl-bhrp'), 'no nested route was built').toBe(true);
    expect(wrong).toEqual([]);
  });

  // A face declared below the weight a rule asks for gets a FAKE bold (the engine clamps, then emboldens), and a
  // computed style cannot show that: it reads 600 either way. So compare the request with the declared face.
  it("declares JetBrains Mono up to the nav's current-page weight, so that weight is real, not synthesised", () => {
    const want = /aria-current\][^{]*\{font-weight:(\d+)/.exec(distCss());
    const face = /@font-face\{font-family:"JetBrains Mono-[^"]*";[^}]*font-weight:(\d+) (\d+)/.exec(builtPage('/research').html);
    expect(want, "no font-weight rule for the nav's current link in dist/_astro/*.css").not.toBeNull();
    expect(face, 'no JetBrains Mono @font-face with a weight range on /research').not.toBeNull();
    expect(Number(want![1])).toBeLessThanOrEqual(Number(face![2]));
  });
});

describe('SideRail — one rail, shipped the same way on every page that has it', () => {
  // Found by markup rather than listed, so a page that gains the rail is checked too; the set is pinned as well, so a
  // page that loses its rail fails by name.
  const railPages = (): Page[] => pages().filter((p) => /<nav\b[^>]*\sclass="side-rail"/.test(p.markup));
  const decode = (s: string): string => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  interface Item { target: string; label: string; depth: number; tag: string; inner: string }
  /** The rail's links in document order, each with its nesting depth (0 = top level). */
  const itemsOf = (p: Page): Item[] => {
    const nav = /<nav\b[^>]*\sclass="side-rail"[\s\S]*?<\/nav>/.exec(p.markup)![0];
    const out: Item[] = [];
    let open = 0;
    for (const m of nav.matchAll(/<ul\b[^>]*>|<\/ul>|(<a\b[^>]*>)([\s\S]*?)<\/a>/g)) {
      if (m[0].startsWith('<ul')) open += 1;
      else if (m[0] === '</ul>') open -= 1;
      else {
        out.push({
          target: /\shref="#([^"]*)"/.exec(m[1])?.[1] ?? '', label: decode(/\sdata-l="([^"]*)"/.exec(m[2])?.[1] ?? ''),
          depth: open - 1, tag: m[1], inner: m[2],
        });
      }
    }
    return out;
  };
  const flat = (stops: readonly Stop[], depth = 0): { target: string; label: string; depth: number }[] =>
    stops.flatMap((s) => [{ target: s.target, label: s.label, depth }, ...flat(s.children ?? [], depth + 1)]);

  it('is on /experience, /projects, /research/rl-bhrp and /writing', () => {
    expect(railPages().map((p) => p.route).sort()).toEqual(['/experience', '/projects', '/research/rl-bhrp', '/writing']);
  });

  // The label is two layers in the markup and two more in CSS (::before, ::after, from data-l), so its states
  // cross-fade by opacity. The dash is its own aria-hidden span. The marks are the script's: none is served. The
  // one thing served on a link is its place in the entrance, --i, its index in document order.
  it('renders every link as href + aria-hidden dash + one label whose data-l is its text, its --i, and no state', () => {
    const bad: string[] = [];
    for (const p of railPages()) {
      for (const [k, it] of itemsOf(p).entries()) {
        const parts = /^<span class="rule" aria-hidden="true"[^>]*><\/span><span class="lbl" data-l="([^"]*)"[^>]*><span class="dim"[^>]*>([^<]*)<\/span><\/span>$/
          .exec(it.inner);
        if (!parts) bad.push(`${p.route} #${it.target}: ${it.inner}`);
        else if (decode(parts[1]) !== decode(parts[2])) bad.push(`${p.route} #${it.target}: data-l ≠ its text`);
        if (!p.ids.has(it.target)) bad.push(`${p.route}: the rail links #${it.target}, which the page does not emit`);
        if (/\s(aria-current|class)=/.test(it.tag)) bad.push(`${p.route} #${it.target}: served with ${it.tag}`);
        if (/\sstyle="([^"]*)"/.exec(it.tag)?.[1] !== `--i:${k}`) bad.push(`${p.route} #${it.target}: not style="--i:${k}" in ${it.tag}`);
      }
    }
    expect(bad).toEqual([]);
  });

  // Every level of the tree, at its depth: the template recurses rather than unrolling a fixed number of levels.
  it("nests the links as the page's Stop tree does, at every depth", async () => {
    const strip = (xs: Item[]) => xs.map(({ target, label, depth }) => ({ target, label, depth }));
    expect(strip(itemsOf(projectsPage()))).toEqual(flat(projectStops(projects)));
    expect(strip(itemsOf(builtPage('/experience')))).toEqual(flat(experienceStops(timeline)));
    expect(strip(itemsOf(builtPage('/research/rl-bhrp')))).toEqual(flat(paperStops((await paperReport('rl-bhrp')).sections)));
    expect(new Set(itemsOf(builtPage('/writing')).map((i) => i.depth))).toEqual(new Set([0, 1]));
  });

  // CLAUDE.md, Motion: only transform and opacity animate. The old rail transitioned `width` (its dash, which pushed
  // the label sideways) and `color`.
  /** Every shipped rule that styles the rail, from the pages' inline styles and the bundled sheets, scope hashes
   *  stripped: [whole, selector, body]. */
  const railCss = (): string => [...railPages().flatMap((p) => [...p.html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)]
    .map((m) => m[1])), distCss()].join('\n').replace(/\[data-astro-cid-[\w-]+\]/g, '');
  const railRules = (): RegExpMatchArray[] => [...railCss().matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, sel]) => /\.side-rail\b/.test(sel));

  it('transitions nothing but opacity and transform', () => {
    const rules = railRules();
    expect(rules.length, 'no shipped rule styles the rail').toBeGreaterThan(5);
    const moving = rules.flatMap(([, sel, body]) => [...body.matchAll(/(?:^|;)\s*transition(?:-property)?\s*:([^;]*)/g)]
      .flatMap((t) => t[1].split(/,(?![^(]*\))/).map((x) => x.trim().split(/\s+/)[0]))
      .filter((prop) => !['opacity', 'transform', 'none'].includes(prop))
      .map((prop) => `${sel.trim()} transitions ${prop}`));
    expect(moving).toEqual([]);
    // CSS cannot import lib/motionTiming, so the curve is a literal there: hold it to EASE.
    const curves = new Set(rules.flatMap(([, , body]) => body.match(/cubic-bezier\([^)]*\)/g) ?? []));
    expect([...curves].map((c) => c.replace(/\s+/g, ''))).toEqual([EASE]);
  });

  // THE ENTRANCE IS CSS, so it runs from the first frame with no script to wait for (a bundled script runs after
  // the browser has painted). Each row comes in from 6px left, --i (its index) times the rail's --gap late, with a
  // backwards fill so it waits in its from-state; --gap is lib/motionTiming's stagger() over the rail's rows, so
  // every row is in by RAIL_ENTER_MS however long the rail is. Read as shipped, the duration and the gaps.
  it('enters by CSS alone, where motion is allowed: opacity and transform, each row --i x --gap late, all in by RAIL_ENTER_MS', () => {
    const css = railCss();
    const frames = /@keyframes side-rail-enter\{((?:[^{}]*\{[^{}]*\})*)\}/.exec(css);
    expect(frames, 'no @keyframes side-rail-enter').not.toBeNull();
    // one frame, the from-state, and nothing in it but opacity and transform
    expect(frames![1]).toMatch(/^(?:from|0%)\{opacity:0;transform:translate(?:X)?\(-6px\)\}$/);

    const gated = [...css.matchAll(/@media ?\(prefers-reduced-motion: ?no-preference\) ?\{((?:[^{}]*\{[^{}]*\})*)\}/g)]
      .map((m) => m[1]).join('');
    const rule = /\.side-rail a\{(animation:side-rail-enter [^}]*)\}/.exec(gated);
    expect(rule, 'the entrance is not on .side-rail a under prefers-reduced-motion: no-preference').not.toBeNull();
    expect([...css.matchAll(/animation(?:-name)?:side-rail-enter\b/g)], 'the entrance is also set outside the motion gate').toHaveLength(1);
    const m = /^animation:side-rail-enter (\d*\.?\d+)(m?s) (cubic-bezier\([^)]*\)) backwards;animation-delay:calc\(var\(--i\) ?\* ?var\(--gap\)\)$/.exec(rule![1]);
    expect(m, `the entrance's declarations: ${rule![1]}`).not.toBeNull();
    const row = Number(m![1]) * (m![2] === 's' ? 1000 : 1);
    expect(m![3]).toBe(EASE);

    for (const p of railPages()) {
      const gap = /<nav\b[^>]*\sclass="side-rail"[^>]*\sstyle="--gap:([\d.]+)ms"/.exec(p.html);
      expect(gap, `${p.route}: the rail carries no --gap`).not.toBeNull();
      const n = itemsOf(p).length; // and each row's --i is its index (the markup test above)
      for (let i = 0; i < n; i += 1) {
        expect(i * Number(gap![1]), `${p.route} row ${i}`).toBeCloseTo(stagger(i, n, { step: 40, total: RAIL_ENTER_MS - row }), 6);
      }
      expect((n - 1) * Number(gap![1]) + row, p.route).toBeLessThanOrEqual(RAIL_ENTER_MS + 1e-9);
    }
  });

  // A touch laptop's primary pointer can hover, so a tap there leaves :hover on the tapped row until the next tap
  // elsewhere. The script's .is-hover is set for a mouse or a pen only.
  it("styles hover by the script's .is-hover, never by :hover", () => {
    expect(railRules().map(([, sel]) => sel.trim()).filter((sel) => /:hover\b/.test(sel))).toEqual([]);
    expect(railRules().some(([, sel]) => /\.is-hover/.test(sel)), 'no rule reads .is-hover').toBe(true);
  });
});

describe('/projects — the page shell on the drafting field', () => {
  // Derived from the tree the rail renders, so a stop the page forgot to emit fails here by name. (No fluid sky
  // and no sky wash on this page is asserted in the describe above.)
  it('emits an id for every rail stop and for every project', () => {
    const { ids } = projectsPage();
    const want = [
      ...flattenStops(projectStops(projects)).map((s) => s.target),
      ...projects.map((p) => projectSectionId(p.slug)),
    ];
    expect(want.filter((id) => !ids.has(id))).toEqual([]);
  });

  // NOT /art's issue #60. The vendored captures are static ImageMetadata imports read only through <Image>, and Astro
  // drops an original whose `.src` nothing reads — so their PNGs never reach dist; only the webp variants do. This was
  // predicted otherwise (~593 KB of originals) and planned around (storing them pre-shrunk); measured, it was 0
  // bytes, and this holds it there. The day something reads `.src` (an og:image, a plain <img>), it goes red.
  it('ships no original of a vendored capture, only its webp variants', () => {
    const vendored = readdirSync(new URL('../src/assets/projects/', import.meta.url))
      .filter((f) => f.endsWith('.png')).map((f) => f.slice(0, -'.png'.length));
    expect(vendored.length, 'no PNG captures in src/assets/projects').toBeGreaterThan(0);
    const emitted = readdirSync(join(DIST, '_astro')).filter((f) => vendored.some((v) => f.startsWith(`${v}.`)));
    expect(emitted.filter((f) => !f.endsWith('.webp'))).toEqual([]);
    expect(vendored.filter((v) => !emitted.some((f) => f.startsWith(`${v}.`))), 'captures with no variant at all').toEqual([]);
  });

  it('has exactly one <h1>, and it reads "Projects"', () => {
    const h1s = [...projectsPage().markup.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)]
      .map((m) => m[1].replace(/<[^>]*>/g, '').trim());
    expect(h1s).toEqual(['Projects']);
  });

  // The field is a picture, so its canvas is hidden from assistive tech; it is the page's only canvas.
  it('paints the field on one aria-hidden canvas, beside <main class="projects-page">', () => {
    const { markup } = projectsPage();
    const canvases = [...markup.matchAll(/<canvas\b[^>]*>/g)].map((m) => m[0]);
    expect(canvases.length, 'canvases on /projects').toBe(1);
    expect(/\sdata-drafting-field\b/.test(canvases[0]), 'the canvas is not the drafting field').toBe(true);
    expect(/\saria-hidden="true"/.test(canvases[0]), 'the field canvas is not aria-hidden').toBe(true);
    expect(/<main\b[^>]*\sclass="[^"]*\bprojects-page\b/.test(markup), 'no <main class="projects-page">').toBe(true);
  });

  // The shipped CSS, scoped hashes stripped, so a rule reads the way it was written. Astro inlines this page's
  // styles into the HTML; the bundled sheets are included in case it ever stops doing so.
  const rawCss = (): string => {
    const inline = [...projectsPage().html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
    return [...inline, distCss()].join('\n');
  };
  const shippedCss = (): string => rawCss().replace(/\[data-astro-cid-[\w-]+\]/g, '');

  // Every jump target lands clear of the fixed corner nav — and the scope hashes are the point here, so this reads
  // the RAW rule. It lives on the page, the targets are partly rendered by child components, and a scoped selector
  // cannot reach a child's elements: #p-index (TerminalHeader's) once compiled out of reach and sat flush under the
  // nav. So the rule must carry <main>'s own scope hash on `.projects-page` and none on `section[id]` / `li[id]`,
  // and every target must be one of those inside <main>.
  it('gives every jump target a scroll-margin-top whose selector actually reaches it', () => {
    const { markup } = projectsPage();
    const main = /<main\b[^>]*>/.exec(markup)![0];
    const cid = /\s(data-astro-cid-[\w-]+)/.exec(main)?.[1];
    expect(cid, '<main> carries no scope hash').toBeTruthy();
    const scope = `\\.projects-page\\[${cid}\\]`;
    expect(rawCss()).toMatch(new RegExp(`${scope} section\\[id\\],${scope} li\\[id\\]\\{[^}]*scroll-margin-top:`));
    const inMain = markup.slice(markup.indexOf(main), markup.indexOf('</main>'));
    const targets = new Set([
      ...flattenStops(projectStops(projects)).map((s) => s.target),
      ...listingLines(projects, inProgress).map((l) => l.href.slice(1)),
    ]);
    expect([...targets].filter((id) => !new RegExp(`<(section|li)\\b[^>]*\\sid="${id}"`).test(inMain))).toEqual([]);
  });

  // The mockup's always-on edge vignette (projects-b4.html `.ov-vig`): a layer of its own after the canvas, so it
  // paints over the field and under <main> (z 1), and it draws the --draft-vig token.
  it('lays the edge vignette over the field, after the canvas, aria-hidden, drawing --draft-vig', () => {
    const { markup } = projectsPage();
    const m = /<canvas\b[^>]*data-drafting-field[^>]*><\/canvas>\s*(<div\b[^>]*>)/.exec(markup);
    expect(m, 'no element straight after the field canvas').not.toBeNull();
    expect(/\sclass="[^"]*\bdrafting-vig\b/.test(m![1]), `the element after the canvas is ${m![1]}`).toBe(true);
    expect(/\saria-hidden="true"/.test(m![1]), 'the vignette is not aria-hidden').toBe(true);
    expect(shippedCss()).toMatch(/\.drafting-vig\{background:radial-gradient\([^)]*var\(--draft-vig\)\)\}/);
  });

  // 100vh is the LARGE viewport, so the box holds still while a phone's toolbar collapses: at `height: 100%` the
  // bitmap stretched and every isoline jumped by half the toolbar on each change of scroll direction.
  it("sizes the field's box to the large viewport, so a mobile toolbar cannot move the drawing", () => {
    const rule = /\.drafting-field,\.drafting-vig\{([^}]*)\}/.exec(shippedCss());
    expect(rule, 'no shared .drafting-field,.drafting-vig rule').not.toBeNull();
    expect(rule![1]).toMatch(/(^|;)height:100(l?)vh(;|$)/);
    expect(rule![1]).toMatch(/(^|;)position:fixed(;|$)/);
  });

  // Neither main nor the rail has a background, so their text sits straight on the field's strokes. The knockout
  // gives every glyph an opaque 1px ring of the ground: eight offsets, none blurred, in the ground colour. <main> is
  // the page's own; the rail is shared, so it wears the same ring through the role tokens the drafting blocks declare
  // (tests/draftingPalette.test.ts holds their values), and the page does not touch it.
  it("rings every glyph in <main> and in the rail with the bare ground, so no stroke touches the page's text", () => {
    const css = shippedCss();
    expect(css).toMatch(/\.side-rail \.lbl\{(?:[^}]*;)?text-shadow:var\(--rail-halo,\s*none\)/);
    expect(css).toMatch(/\.side-rail \.rule\{(?:[^}]*;)?box-shadow:var\(--rail-dash-halo,\s*none\)/);
    const rule = /\.projects-page\{([^}]*text-shadow:[^}]*)\}/.exec(css);
    expect(rule, 'no text-shadow rule for .projects-page').not.toBeNull();
    expect(rule![1]).toMatch(/--knock:\s*var\(--draft-ground\)/);
    const shadows = /text-shadow:([^;}]*)/.exec(rule![1])![1].split(/,(?![^(]*\))/).map((s) => s.trim());
    const offsets = shadows.map((s) => {
      const p = /^(-?\d+)(?:px)? (-?\d+)(?:px)? 0(?:px)? var\(--knock\)$/.exec(s);
      expect(p, `"${s}" is not an unblurred offset in var(--knock)`).not.toBeNull();
      return `${Number(p![1])},${Number(p![2])}`;
    });
    expect(new Set(offsets)).toEqual(new Set(['-1,-1', '0,-1', '1,-1', '-1,0', '1,0', '-1,1', '0,1', '1,1']));
  });
});

describe('/projects — the ask: one non-modal dialog and its GitHub button', () => {
  // The pop-up a project click opens (components/projects/ProjectAsk.astro). NON-MODAL on purpose: it closes on an
  // outside click, on scroll and when focus leaves it, so there is no focus trap to promise — aria-modal would tell
  // a screen reader the rest of the page is unreachable when it is not.
  /** The element whose opening tag starts at `at`, through its matching close tag. */
  const outer = (html: string, at: number): string => {
    const tag = /^<([a-z][\w-]*)/.exec(html.slice(at))![1];
    const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'g');
    re.lastIndex = at;
    let depth = 0;
    for (let m = re.exec(html); m; m = re.exec(html)) {
      depth += m[1] ? -1 : 1;
      if (depth === 0) return html.slice(at, m.index + m[0].length);
    }
    throw new Error(`unclosed <${tag}> at ${at}`);
  };
  const dialog = (): { tag: string; html: string } => {
    const { markup } = projectsPage();
    const opens = [...markup.matchAll(/<[a-z][\w-]*\b[^>]*\srole="dialog"[^>]*>/g)];
    expect(opens.length, '[role="dialog"] elements on /projects').toBe(1);
    return { tag: opens[0][0], html: outer(markup, opens[0].index!) };
  };

  it('ships exactly one [role="dialog"]: non-modal, inert while closed, labelled by its own title', () => {
    const { tag, html } = dialog();
    expect(/\saria-modal\b/.test(tag), 'the dialog claims aria-modal').toBe(false);
    // Closed, it is only transparent — without inert its controls would sit in the Tab order, unseen.
    expect(/\sinert\b/.test(tag), 'the closed dialog is not inert').toBe(true);
    const id = /\saria-labelledby="([^"]+)"/.exec(tag)?.[1];
    expect(id, 'the dialog has no aria-labelledby').toBeTruthy();
    const title = new RegExp(`<[a-z][\\w-]*\\b[^>]*\\sid="${id}"[^>]*>`).exec(html)?.[0];
    expect(title, `aria-labelledby="${id}" names no element inside the dialog`).toBeTruthy();
    expect(/\sclass="[^"]*\bask-t\b/.test(title!), `the dialog is labelled by ${title}, not by its title`).toBe(true);
  });

  it("makes the dialog's GitHub button a link to a new tab that is not handed window.opener", () => {
    const links = [...dialog().html.matchAll(/<a\b[^>]*>/g)].map((m) => m[0]);
    expect(links.length, '<a> elements in the dialog').toBe(1);
    expect(/\sclass="[^"]*\bbtn--sticker\b/.test(links[0]), `${links[0]} is not the sticker button`).toBe(true);
    expect(/\starget="_blank"/.test(links[0]), `${links[0]} lacks target="_blank"`).toBe(true);
    expect(/\srel="[^"]*\bnoopener\b/.test(links[0]), `${links[0]} lacks rel="noopener"`).toBe(true);
  });
});

describe('/projects — the boot: decided inline before first paint, and the served HTML is the finished state', () => {
  const decider = (): { at: number; body: string } => {
    const m = /<script>((?:(?!<\/script>)[\s\S])*?projects\.boot\.seen[\s\S]*?)<\/script>/.exec(projectsPage().html);
    expect(m, 'no inline boot decider in dist/projects/index.html').not.toBeNull();
    return { at: m!.index, body: m![1] };
  };

  // Inline (a bare <script>, so no src and no defer) and ahead of the banner, so html.projects-boot is set before
  // anything it dims or hides is parsed — a bundled script runs after parse, which is past the first paint.
  it('ships the decider inline, before the banner, keyed on the session flag from lib/', () => {
    const { at, body } = decider();
    expect(at, 'the decider must precede the banner').toBeLessThan(projectsPage().html.search(/<svg\b[^>]*class="banner\b/));
    expect(body).toContain(JSON.stringify(BOOT_SEEN_KEY));
  });

  // The policy, asserted where it ships: the shipped script, run against stand-ins for what it reads. This is the
  // wiring the unit tests of shouldBoot cannot see — which input comes from where, and when the flag is written.
  type Arrival = { search?: string; hash?: string; seen?: boolean; reduce?: boolean; phone?: boolean; stateY?: number; throws?: boolean };
  const exec = (o: Arrival) => {
    const store = new Map<string, string>(o.seen ? [[BOOT_SEEN_KEY, '1']] : []);
    const classes = new Set<string>();
    const dataset: Record<string, string> = {};
    const timers: { fn: () => void; ms: number }[] = [];
    const sent: string[] = [];
    const storage = {
      getItem: (k: string) => { if (o.throws) throw new Error('denied'); return store.get(k) ?? null; },
      setItem: (k: string, v: string) => { if (o.throws) throw new Error('denied'); store.set(k, v); },
    };
    class FakeEvent { type: string; constructor(type: string) { this.type = type; } }
    runInNewContext(decider().body, {
      URLSearchParams, sessionStorage: storage, scrollY: 0,
      location: { search: o.search ?? '', hash: o.hash ?? '' },
      history: { state: o.stateY === undefined ? null : { index: 0, scrollX: 0, scrollY: o.stateY } },
      // The phone query must be lib/viewport.ts's, exactly: a typed or drifted width never matches here.
      matchMedia: (q: string) => ({
        matches: (/reduce/.test(q) && o.reduce === true) || (q === PHONE_QUERY && o.phone === true),
      }),
      performance: { now: () => 1234.5 },
      setTimeout: (fn: () => void, ms: number) => timers.push({ fn, ms }),
      Event: FakeEvent,
      window: { dispatchEvent: (e: FakeEvent) => { sent.push(e.type); return true; } },
      document: { documentElement: { dataset, classList: {
        add: (c: string) => classes.add(c), remove: (c: string) => classes.delete(c), contains: (c: string) => classes.has(c),
      } } },
    });
    return { classes, store, dataset, timers, sent };
  };

  it('boots a fresh top-of-page arrival off a phone only, sets the flag at start, and survives a storage that throws', () => {
    const run = (o: Arrival) => {
      const r = exec(o);
      return { boot: r.classes.has('projects-boot'), flagged: r.store.has(BOOT_SEEN_KEY) };
    };
    expect(run({})).toEqual({ boot: true, flagged: true });
    expect(run({ seen: true })).toEqual({ boot: false, flagged: true });
    expect(run({ seen: true, search: '?boot=1' })).toEqual({ boot: true, flagged: true });
    expect(run({ hash: '#p-witness' })).toEqual({ boot: false, flagged: false });
    expect(run({ stateY: 2400 })).toEqual({ boot: false, flagged: false });
    expect(run({ stateY: 0 })).toEqual({ boot: true, flagged: true });
    expect(run({ reduce: true, search: '?boot=1' })).toEqual({ boot: false, flagged: false });
    expect(run({ phone: true, search: '?boot=1' })).toEqual({ boot: false, flagged: false });
    expect(run({ throws: true })).toEqual({ boot: true, flagged: false });
  });

  // The boot's clock and its failsafe start here, at parse, with the class. TerminalHeader reads data-boot-at as its
  // t=0, so a late start catches up; the deadline ends a boot whose header never ran, and whoever takes the class
  // off sends `projects:booted` — so a header that finished first leaves the deadline nothing to say.
  it('starts the clock and arms the deadline with the boot; at the deadline it ends the boot itself, once', () => {
    const r = exec({});
    expect(r.dataset.bootAt).toBe('1234.5');
    expect(r.timers.map((t) => t.ms)).toEqual([BOOT_DEADLINE_MS]);
    r.timers[0].fn();
    expect(r.classes.has('projects-boot')).toBe(false);
    expect(r.sent).toEqual(['projects:booted']);

    const finished = exec({});
    finished.classes.delete('projects-boot');
    finished.timers[0].fn();
    expect(finished.sent).toEqual([]);

    const seen = exec({ seen: true });
    expect([seen.timers.length, seen.dataset.bootAt]).toEqual([0, undefined]);
  });

  // A ClientRouter arrival styles the new DOM before the decider runs, so that style is the finished page. A boot
  // rule with a transition would animate the finished page INTO the boot (measured: the fan folding into the pile,
  // the listing, rows and cards fading out). A transition takes its timing from the style it goes to, so every rule
  // that holds something back under html.projects-boot must say `transition: none` — the way out still animates.
  it('holds nothing back with a transition: every boot rule that sets opacity or transform says transition: none', () => {
    const rules = [...distCss().matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter(([, sel]) => sel.split(',').every((s) => /html\.projects-boot\b/.test(s)))
      .filter(([, , body]) => /(^|;)\s*(opacity|transform)\s*:/.test(body));
    expect(rules.length, 'the nine boot rules written today').toBeGreaterThanOrEqual(9);
    const moving = rules.filter(([, , body]) => !/(^|;)\s*transition\s*:\s*none\b/.test(body)).map(([, sel]) => sel.trim());
    expect(moving).toEqual([]);
  });

  // With JS off nothing sets html.projects-boot, so every boot rule is inert and the page is exactly what was
  // served: the banner, the command, the comment, the whole listing and the summary.
  it('serves the finished state: no boot class, and the banner, listing and summary all in the markup', () => {
    const { markup } = projectsPage();
    expect(/<html\b[^>]*\bprojects-boot\b/.test(markup), '<html> is served with projects-boot').toBe(false);
    const term = /<section\b[^>]*\sid="p-index"[^>]*>([\s\S]*?)<\/section>/.exec(markup)?.[1];
    expect(term, 'no #p-index terminal section').toBeTruthy();
    expect([...term!.matchAll(/<g\b[^>]*\sdata-row="\d"/g)], 'banner rows').toHaveLength(6);
    const text = term!.replace(/<[^>]*>/g, '').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    const want = [
      '~/projects $ ls --shipped', '# ideas I turned into things that run', ' shipped · ',
      ...listingLines(projects, inProgress).map((l) => l.perm + l.name + l.kind + l.short),
    ];
    expect(want.filter((w) => !text.includes(w))).toEqual([]);
  });

  // The command is one span per key so the boot can type it, which a screen reader can read as twelve letters
  // (VoiceOver stops on each span). So the keys are aria-hidden and an sr-only copy says the command whole.
  it('reads the command whole: the typed keys are aria-hidden, and an sr-only copy precedes them', () => {
    const line = /<div\b[^>]*class="tline"[^>]*>([\s\S]*?)<\/div>/.exec(projectsPage().markup)?.[1] ?? '';
    const m = /<span\b[^>]*class="sr-only"[^>]*>([^<]*)<\/span>\s*<span\b([^>]*class="cmd"[^>]*)>/.exec(line);
    expect(m, 'no sr-only command before the typed keys').not.toBeNull();
    expect(m![1]).toBe(BOOT_CMD);
    expect(m![2]).toMatch(/\saria-hidden="true"/);
  });
});

describe('/projects — repo links, private repos, and what assistive tech is told', () => {
  /** Every opening tag in the markup carrying `data-ask="<slug>"` — the page's project surfaces. */
  const surfaces = (slug: string): string[] =>
    [...projectsPage().markup.matchAll(new RegExp(`<[a-z][\\w-]*\\b[^>]*\\sdata-ask="${slug}"[^>]*>`, 'g'))].map((m) => m[0]);
  /** Which surface a tag is: a gallery card (.shot), a selected row (.row) or a workshop card (.card). */
  const kindOf = (tag: string): string =>
    (/\sclass="([^"]*)"/.exec(tag)?.[1] ?? '').split(/\s+/).find((c) => ['shot', 'row', 'card'].includes(c)) ?? tag;
  /** The surfaces a project should have: its row or card, and a gallery card if the fan holds it. */
  const where = (p: (typeof projects)[number]): string[] =>
    [p.tier === 'selected' ? 'row' : 'card', ...((GALLERY_ORDER as readonly string[]).includes(p.slug) ? ['shot'] : [])].sort();

  // A real <a href> to the repo is what makes a surface work without JS, for crawlers and for cmd/middle-click;
  // the page only turns a PLAIN click into the ask (spec §11).
  it("links every public project's row or card, and its gallery card, to https://github.com/IngTian/<slug>", () => {
    for (const p of projects.filter((q) => q.visibility === 'public')) {
      const tags = surfaces(p.slug);
      expect(tags.map(kindOf).sort(), `${p.slug}'s surfaces`).toEqual(where(p));
      for (const t of tags) {
        expect(/^<a\b/.test(t), `${p.slug}: ${t} is not a link`).toBe(true);
        expect(/\shref="([^"]*)"/.exec(t)?.[1], `${p.slug}: ${t}`).toBe(`https://github.com/IngTian/${p.slug}`);
      }
    }
  });

  // The RAW HTML, scripts and attributes included — the ask's data-asks JSON is where a URL would slip in. The
  // in-progress card stands for a repo that is not public yet, so its name is held to the same rule.
  it('renders no GitHub URL for a private repo anywhere in the HTML, and makes its surfaces buttons', () => {
    const html = projectsPage().html.toLowerCase();
    const hidden = [
      ...projects.filter((p) => p.visibility === 'private').map((p) => p.slug),
      ...inProgress.flatMap((w) => (w.repo ? [w.repo] : [])),
    ];
    expect(hidden.length, 'no private repos to check').toBeGreaterThan(0);
    for (const slug of hidden) expect(html, slug).not.toContain(`github.com/ingtian/${slug.toLowerCase()}`);
    for (const p of projects.filter((q) => q.visibility === 'private')) {
      const tags = surfaces(p.slug);
      expect(tags.map(kindOf).sort(), `${p.slug}'s surfaces`).toEqual(where(p));
      for (const t of tags) {
        expect(/^<button\b/.test(t), `${p.slug}: ${t} is not a button`).toBe(true);
        expect(/\shref=/.test(t), `${p.slug}: ${t} has an href`).toBe(false);
      }
    }
  });

  // Pictures say nothing to a screen reader. The probes' elevation readouts are the canvas's own text (DraftingField
  // paints them with fillText), so the canvas being hidden is what hides them.
  it("hides the pictures: the field canvas, the banner and the ask's brackets are aria-hidden", () => {
    const { markup } = projectsPage();
    for (const [re, what] of [
      [/<canvas\b[^>]*\sdata-drafting-field\b[^>]*>/g, 'the field canvas'],
      [/<svg\b[^>]*\sclass="banner\b[^>]*>/g, 'the banner'],
      [/<[a-z][\w-]*\b[^>]*\sdata-ask-rk\b[^>]*>/g, "the ask's brackets"],
    ] as const) {
      const tags = [...markup.matchAll(re)].map((m) => m[0]);
      expect(tags.length, `${what} on /projects`).toBe(1);
      expect(/\saria-hidden="true"/.test(tags[0]), `${what} is not aria-hidden`).toBe(true);
    }
  });

  // The cow must not narrate unprompted (spec §8): its visible bubble types every line, the greeting and idle
  // chatter included, so it is hidden; only the lines a reader asked for reach the ONE polite region.
  it("hides the cow's visible bubble and gives the page exactly one live region, the cow's polite one", () => {
    const { markup } = projectsPage();
    const bubbles = [...markup.matchAll(/<[a-z][\w-]*\b[^>]*\sclass="cow-bubble\b[^>]*>/g)].map((m) => m[0]);
    expect(bubbles.length, 'cow bubbles').toBe(1);
    expect(/\saria-hidden="true"/.test(bubbles[0]), 'the cow bubble is not aria-hidden').toBe(true);
    const live = [...markup.matchAll(/<[a-z][\w-]*\b[^>]*(?:\saria-live="(?!off")[^"]*"|\srole="(?:status|log|alert|marquee|timer)")[^>]*>/g)]
      .map((m) => m[0]);
    expect(live.length, `live regions: ${live.join(' ')}`).toBe(1);
    expect(live[0]).toMatch(/\saria-live="polite"/);
    expect(live[0]).toMatch(/\sdata-cow-live\b/);
  });
});

describe('/research/rl-bhrp — a paper explained, from its file', async () => {
  const page = (): Page => builtPage('/research/rl-bhrp');
  const report = await paperReport('rl-bhrp');
  const rl = publications.find((p) => p.slug === 'rl-bhrp')!;
  const text = (html: string): string => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;|\s+/g, ' ');

  it('is a paper page: data-page="paper", one <main class="paper">', () => {
    expect(/<html\b[^>]*\sdata-page="paper"/.test(page().markup)).toBe(true);
    expect(page().markup.match(/<main\b[^>]*\sclass="paper"/g)).toHaveLength(1);
  });

  // The rail and the page's sections come from one report; a stop the page did not emit fails here by name.
  it('emits an id for every rail stop, and each id once', () => {
    const stops = paperStops(report.sections).map((s) => s.target);
    expect(stops.filter((id) => !page().ids.has(id))).toEqual([]);
    const all = [...page().markup.matchAll(/\sid="([^"]*)"/g)].map((m) => m[1]);
    expect(all.filter((id, i) => all.indexOf(id) !== i)).toEqual([]);
  });

  // The page refuses a file id it writes itself (paperPageOwns), so the build fails. That holds only while the plugin
  // reports every id the file writes and paperPageOwns knows every id the page and the layout write: each id here is
  // the one or the other. An id the layout gains, or the plugin writes unreported, fails here by name.
  it("carries no id but its file's and its own", () => {
    const file = new Set(report.ids);
    expect([...page().ids].filter((id) => file.has(id) === paperPageOwns(id))).toEqual([]);
  });

  // Below 1100px the Contents list replaces the rail: the rail's stops, each by its title, a section's number before it.
  it('lists the same sections in its Contents as in its rail, each by its title', () => {
    const links = (cls: string) => [...(new RegExp(`<nav\\b[^>]*\\sclass="${cls}"[\\s\\S]*?</nav>`).exec(page().markup)?.[0] ?? '')
      .matchAll(/<a\b[^>]*\shref="#([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)];
    const contents = links('toc-inline');
    expect(contents.length).toBeGreaterThan(3);
    expect(contents.map((m) => m[1])).toEqual(links('side-rail').map((m) => m[1]));
    expect(contents.map((m) => text(m[2]).trim()))
      .toEqual(paperSections(report.sections).map((s) => [s.n, s.title].filter(Boolean).join(' ')));
  });

  it("prints the paper's Table 2 whole: all 18 rows", () => {
    const table = /<table class="bt">[\s\S]*?<\/table>/.exec(page().markup)?.[0] ?? '';
    expect(table.match(/<tbody>[\s\S]*<\/tbody>/)?.[0].match(/<tr\b/g)).toHaveLength(18);
  });

  // Underline, on 5–7 key sentences: no more than about one a screen (spec §4).
  it('highlights five to seven sentences', () => {
    const n = page().markup.match(/<mark class="hl">/g)?.length ?? 0;
    expect(n).toBeGreaterThanOrEqual(5);
    expect(n).toBeLessThanOrEqual(7);
  });

  // A preprint, always: never "published" or "peer-reviewed" — the one place it may say "not peer reviewed".
  it('never says the preprint was published or reviewed', () => {
    const words = text(page().markup);
    expect(words).not.toMatch(/published/i);
    expect(words.replace(/not peer reviewed/g, '')).not.toMatch(/peer[- ]reviewed/i);
    expect(words).toContain('preprint, not peer reviewed');
  });

  it('sets every numbered equation as MathML, its number outside the maths', () => {
    const eqs = [...page().markup.matchAll(/<div class="eq an" id="([^"]+)">([\s\S]*?)<span class="eq-no">([^<]*)<\/span>/g)];
    const numbered = eqs.filter((m) => m[3]);
    expect(numbered.map((m) => m[3])).toEqual(['(2)', '(3)', '(4)']);
    for (const [, id, body] of numbered) expect(body, id).toMatch(/<math\b/);
    expect(page().markup).not.toMatch(/katex-error|\\tag/);
  });

  it('cites every reference it lists, and lists every one it cites', () => {
    const listed = [...page().markup.matchAll(/<li id="(ref-[^"]+)"/g)].map((m) => m[1]);
    const cited = new Set([...page().markup.matchAll(/<a class="cite" href="#(ref-[^"]+)"/g)].map((m) => m[1]));
    expect(listed.length).toBeGreaterThan(5);
    expect(listed.filter((id) => !cited.has(id))).toEqual([]);
    expect([...cited].filter((id) => !listed.includes(id))).toEqual([]);
  });

  it('gives the BibTeX verbatim, with a copy control in the paper skin', () => {
    const pre = /<pre id="bibtex">([\s\S]*?)<\/pre>/.exec(page().markup)?.[1] ?? '';
    expect(pre.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')).toBe(rl.bibtex);
    const button = /<button\b[^>]*\sdata-copy="bibtex"[^>]*>/.exec(page().markup)?.[0] ?? '';
    expect(button).toMatch(/\stype="button"/);
    expect(button).toMatch(/\sclass="btn btn--paper\b/);
  });

  // The reading time is computed from the words, never typed: the file's own (the plugin's count) and the abstract's.
  it('computes its reading time from the words a reader reads', () => {
    const minutes = readingMinutes(report.bodyWords + countWords(rl.abstract!));
    expect(text(page().markup)).toContain(`· ${minutes} min read · written by Zeying Tian, the second author`);
  });

  // The caption is the explainer's, so it says here what the figure is: the owner's reproduction, not the paper's run.
  it("captions Figure 2 as the second author's reproduction, with the paper's own figure beside it", () => {
    const cap = /<figure class="fig" id="figure-2">[\s\S]*?<figcaption>([\s\S]*?)<\/figcaption>/.exec(page().markup)?.[1] ?? '';
    const v = PAPER_DATA['rl-bhrp'].values;
    expect(text(cap)).toContain('Figure 2. A reproduction, not the paper’s run:');
    expect(text(cap)).toContain(`median of the reproduction’s ${v.reproRuns} training runs`);
    expect(text(cap)).toContain(`where the paper reports ${v['usd.rl']} from its original run`);
    expect(text(cap)).toContain('not fresh evidence');
  });

  it('shows exactly one drawing per figure in the markup the CSS swaps: a wide and a narrow, by class', () => {
    for (const id of ['figure-1', 'figure-2']) {
      const fig = new RegExp(`<figure\\b[^>]*\\sid="${id}"[\\s\\S]*?</figure>`).exec(page().markup)?.[0] ?? '';
      expect(fig.match(/\sclass="[^"]*\bwide\b/g), id).toHaveLength(1);
      expect(fig.match(/\sclass="[^"]*\bnarrow\b/g), id).toHaveLength(1);
    }
  });
});
