import { existsSync, readdirSync, readFileSync } from 'node:fs';
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

/* ================================================================================================
   THE FIRST-VISIT GATE. Three of these four assertions are about things that cannot be seen from a
   unit test: whether the gate reached one route and not the other eight, and whether the shipped
   HTML is in a state a visitor could get stuck in. The gate's POLICY is tested in tests/gate.test.ts
   (storage that throws, reduced-motion dismissal, idempotency) — this file is the only place that can
   answer "and what actually went into the page".
   ================================================================================================ */
describe('the first-visit gate, as shipped', () => {
  const home = byRoute().get('/');

  /** The gate's CSS, from the emitted stylesheets AND the page — Astro's inlineStylesheets: 'auto' may put a
   *  small scoped sheet in the <head> instead of emitting a file, and which one it picks is not this test's
   *  subject. */
  const gateCss = (): string => {
    const files = existsSync(join(DIST, '_astro'))
      ? readdirSync(join(DIST, '_astro')).filter((f) => f.endsWith('.css'))
        .map((f) => readFileSync(join(DIST, '_astro', f), 'utf8'))
      : [];
    return [...files, home!.html].join('\n');
  };

  it('is on the homepage', () => {
    expect(home, 'no / in dist').toBeDefined();
    expect(home!.html).toMatch(/data-gate\b/);
  });

  it('is on NO other route', () => {
    // A full-screen interstitial on /research would be hostile, and the only thing stopping it is that
    // Gate.astro is rendered from index.astro rather than BaseLayout. That is a structural choice, so it
    // gets a structural test: move the component one file up and this goes red on eight pages at once.
    for (const p of pages()) {
      if (p.route === '/') continue;
      expect(p.html, `${p.route} must not carry the gate`).not.toMatch(/data-gate\b/);
    }
  });

  it('SHIPS DISMISSED — the no-JS invariant', () => {
    // THE ONE THAT MATTERS. The gate must be raised by script, never by markup. If `is-up` is ever
    // rendered onto the element, a visitor whose JS failed is locked out of the site with no way to
    // dismiss it — and so is every crawler that does not run scripts. Checking `markup` (scripts and
    // styles stripped) is what makes this assertion mean what it says: the class name appears in both the
    // stylesheet and the raise-script by design, and neither is a covering state.
    expect(home!.markup).not.toMatch(/class="[^"]*\bis-up\b/);
  });

  it('gives the button a real element and an accessible name', () => {
    const btn = home!.markup.match(/<button[^>]*data-gate-enter[^>]*>([\s\S]*?)<\/button>/);
    expect(btn, 'the gate needs a real <button>').not.toBeNull();
    expect(btn![1].replace(/<[^>]*>/g, '').trim().length).toBeGreaterThan(3);
  });

  it('marks the decorative field aria-hidden and the dialog labelled', () => {
    // An SVG, and it went back to being one: the canvas version was built on a misreading of "trails of
    // asteroids" and the owner had already approved the SVG dash. What matters to a11y either way is that the
    // decorative field is hidden from the tree.
    expect(home!.markup).toMatch(/<svg[^>]*class="[^"]*gate-field[^"]*"[^>]*aria-hidden="true"/);
    expect(home!.markup).toMatch(/aria-labelledby="gate-name"/);
    expect(home!.markup).toMatch(/id="gate-name"/);
  });

  it('NOTHING ON THE GATE HAS AN INVISIBLE RESTING STATE', () => {
    // THE BUG THIS PINS COST THE OWNER TWO SCREENSHOTS. The letters, the roles line and the button each had
    // `opacity: 0` in CSS with a `forwards` animation expected to bring them back. Any element whose animation
    // does not run or is interrupted is then permanently invisible — and what vanished was the owner's NAME on
    // the first screen of his portfolio, and later the roles line together with the modal's only button.
    //
    // Every one of them now animates TRANSFORM from a state that is already legible. So the rule is: no gate
    // element may declare `opacity: 0`. A fade-in is not worth a screen that can lose its own content.
    const css = gateCss();
    const gateRules = [...css.matchAll(/\.gate[a-z-]*\[[^\]]*\][^{}]*\{[^}]*\}/g)].map((m) => m[0]);
    expect(gateRules.length, 'no gate rules found in the shipped CSS').toBeGreaterThan(3);
    for (const r of gateRules) {
      // The container itself is legitimately opacity:0 — that IS the not-covering resting state (trap 1).
      if (/\.gate\[/.test(r) && !/\.gate-/.test(r)) continue;
      expect(r, `a gate element rests at opacity 0 and can lose itself: ${r}`).not.toMatch(/opacity:\s*0[;}]/);
    }
  });

  it('KEEPS THE APPROVED TRAVELLING DASH, AND FADES TO ZERO WHERE IT RESETS', () => {
    // Two things, and the pair is the point.
    //
    // (1) THE MOTION IS THE APPROVED ONE. The owner reviewed this exact treatment — a dash travelling along each
    //     curve, written in real user units from the arc length — and said "oh yeah perfect. now that's what im
    //     talking about." Everything after it was fixing the ONE defect he reported against it, and two of those
    //     attempts replaced the motion instead: a permanent faint stroke under the dash (which he read as "the
    //     line leaves a trail behind"), then no dash at all (a static drawing), then a canvas of comet trails
    //     from over-reading "like the trails of asteroids". So this pins the dash as present.
    //
    // (2) THE DEFECT IS FIXED AT ITS CAUSE. "entire lines go dark immediately" happened because the drawn length
    //     is a sawtooth — it collapses from the whole arc to a 30% fragment at the curve's off-screen start once
    //     per cycle — while the source's opacity envelope is 0.3, not 0, at that instant. The envelope now shares
    //     the offset triangle and so is zero exactly there. The arithmetic is unit-tested in tests/gate.test.ts;
    //     what this checks is that the SHIPPED script is driven by those same constants, because the inline
    //     script cannot import and a hardcoded copy is exactly the kind of thing that drifts.
    const paths = home!.markup.match(/<path[^>]*class="[^"]*gate-trail[^"]*"[^>]*>/g) ?? [];
    expect(paths.length, 'the gate shipped no strokes at all').toBeGreaterThanOrEqual(1);
    for (const p of paths) {
      // vector-effect defeats the renderer's stroke caching across every full-screen path; measured as a real
      // cost here, and the source does not use it either.
      expect(p, `vector-effect is back on a gate stroke: ${p}`).not.toMatch(/vector-effect/);
      expect(p, `the arc length no longer reaches the client, so the dash cannot be written: ${p}`)
        .toMatch(/data-len="\d/);
    }

    // THE ON-SCREEN ARC WINDOW MUST SHIP. The entire fix for "entire lines go dark immediately" is that travel
    // is clipped to [a, b] — the arc of each curve that is actually in frame, measured at build time because the
    // driver is inline and cannot import. If these attributes stop being emitted the driver silently falls back
    // to the whole arc (`data-b` defaults to the full length), which is exactly the 42%-blank defect, and
    // nothing else in the suite would notice.
    for (const p of paths) {
      expect(p, `no on-screen window ships for this stroke: ${p}`).toMatch(/data-a="[\d.]+"/);
      expect(p, `no on-screen window ships for this stroke: ${p}`).toMatch(/data-b="[\d.]+"/);
    }

    // No second permanently-drawn layer. That is what read as a trail, so it is worth a test rather than a note.
    expect(home!.markup, 'a faint underlay is back — it will read as a trail behind every line')
      .not.toMatch(/class="gate-(base|haze)"/);
    expect(home!.markup, 'the field is a canvas again; the SVG dash is the approved treatment')
      .not.toMatch(/<canvas[^>]*gate-field/);

    // The script is inline (it has to beat first paint), so it is in the HTML itself rather than a module.
    const html = home!.html;
    expect(html, 'the script no longer writes a dash — the strokes cannot be travelling')
      .toMatch(/strokeDasharray/);
    // define:vars inlines the tested constants as `const PEAK = 0.72` (or similar). Assert the envelope is a
    // bare multiple of the triangle: an additive floor is precisely the bug.
    expect(html, 'the opacity envelope has an additive floor again, so the reset will be visible')
      .not.toMatch(/style\.opacity\s*=\s*String\(\s*0?\.\d+\s*\+/);
    // THE CLAIM IS "DRIVEN BY THE TESTED CONSTANTS", NOT "SPELLED THIS WAY".
    //
    // This assertion used to match the inline script's source character-for-character, down to the name of a
    // loop local (`tri`). Renaming it, or hoisting the envelope into a helper, turned the test red with
    // byte-identical output — which is why it had been rewritten once per redesign, and why pinning an
    // expression's shape is the wrong instrument.
    //
    // What genuinely needs guarding is the seam: the driver is `is:inline` so it CANNOT import, and the four
    // numbers that decide whether strokes vanish are unit-tested in lib/gate.ts. `define:vars` is what keeps
    // the two on one value. So assert that the constants arrive that way and that the opacity write is computed
    // from them — the arithmetic itself is proven in tests/gate.test.ts, where it belongs.
    expect(html, 'GATE_OPACITY_PEAK is no longer handed to the script by define:vars')
      .toMatch(/\bPEAK\s*=\s*0?\.\d+/);
    expect(html, 'GATE_OPACITY_RAMP is no longer handed to the script by define:vars')
      .toMatch(/\bRAMP\s*=\s*0?\.\d+/);
    const opacityWrite = /\.opacity\s*=\s*([^;]{0,120});/.exec(html)?.[1] ?? '';
    expect(opacityWrite, 'no opacity write found in the shipped script').not.toBe('');
    expect(opacityWrite, 'the envelope ignores the tested peak — a hardcoded copy will drift')
      .toMatch(/PEAK/);
    expect(opacityWrite, 'the envelope ignores the tested ramp, so it peaks instead of plateauing')
      .toMatch(/RAMP/);
  });

  it('gives a reduced-motion reader the same picture, held still', () => {
    // SCOPED TO THE GATE'S OWN BLOCK, which this test did not used to be: it searched the entire homepage
    // stylesheet for `prefers-reduced-motion` and `animation: none`, both of which the bundle has carried since
    // BaseLayout was written. It passed regardless of what the gate did, and its name still said "drift" two
    // commits after the drift was deleted.
    //
    // What matters is narrow: under reduced motion the strokes must be PINNED, not animated and not reset. The
    // driver never runs (`if (!reduced())`), so no inline dash is ever written and there is nothing to undo —
    // the one thing needed is the opacity pin, because the per-path `stroke-opacity` attribute ramps to 1.0 and
    // without it a still reader sees the drawing at full strength: a different picture, not a still of this one.
    const css = gateCss();
    const blocks = [...css.matchAll(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{/g)];
    expect(blocks.length, 'the gate CSS has no reduced-motion block').toBeGreaterThan(0);
    // Take the stylesheet from each such block and keep the one that governs a gate stroke.
    const governing = blocks
      .map((m) => css.slice(m.index ?? 0, (m.index ?? 0) + 1200))
      .filter((b) => /\.gate-trail/.test(b));
    expect(governing.length, 'no reduced-motion rule reaches .gate-trail').toBeGreaterThan(0);
    expect(governing[0], 'the strokes are not pinned for a reader with motion off').toMatch(/opacity:\s*0?\.\d/);
  });
});

describe('the gate script, after the whole-branch review', () => {
  const home = byRoute().get('/')!;
  /**
   * THE GATE'S OWN SCRIPT BLOCK, not "every script on the page".
   *
   * This used to be a lazy `/<script>[\s\S]*?data-gate[\s\S]*?<\/script>/`, which starts at the document's FIRST
   * <script> — BaseLayout's theme resolver — and ends at the first </script> after the `data-gate` div: one
   * match, 236KB, 14 blocks. Every assertion below then meant "appears somewhere in the page's script", which
   * is not what any of their comments claim. Splitting on the tag and keeping the one block that mentions
   * `[data-gate]` gives the ~17KB that actually belongs to the gate.
   */
  const script = home.html
    .split(/<script\b[^>]*>/)
    .map((b) => b.split('</script>')[0])
    .filter((b) => b.includes('[data-gate]'))
    .join('\n');

  it('captures the gate block and nothing else', () => {
    // Guards the capture itself, because every assertion in this describe is only as good as it. If the split
    // ever grabs the whole page again, these numbers go wrong long before the assertions do.
    expect(script.length, 'no script block mentions [data-gate]').toBeGreaterThan(2000);
    expect(script.length, 'the capture has swallowed other script blocks again').toBeLessThan(60000);
    expect(script, 'the capture reaches outside the gate block').not.toMatch(/localStorage\.getItem\('theme'\)/);
  });

  // NO 'does the script exist' TEST. The four below each match a pattern that appears nowhere else in the
  // shipped page, so they already fail if the script is missing — an extra length check only duplicated them.

  it('guards against ClientRouter re-executing it mid-session', () => {
    // The script exists only in /'s HTML, so Astro does not carry it in `scriptsAlreadyRan` for a visitor
    // whose entry page was another route — it gets EXECUTED on the navigation into /. Without the readyState
    // guard the gate raised over a homepage the visitor was already going to.
    expect(script).toMatch(/readyState\s*!==\s*['"]loading['"]/);
  });

  it('stops the event reaching the deck, not merely the browser', () => {
    // preventDefault() cancels the browser's scroll; it does nothing to Deck.astro's sibling window
    // listener, whose onWheel does not check defaultPrevented. Without stopImmediatePropagation one flick
    // scrolled the page behind the gate and dismissal revealed a later slide instead of the hero.
    expect(script).toMatch(/stopImmediatePropagation/);
  });

  it('tears itself down when the page is swapped away', () => {
    // swallow/onKey are bound to window and document, which survive a View Transition; the gate's DOM does
    // not. Without this, wheel scrolling and Tab stayed dead site-wide for the rest of the session.
    expect(script).toMatch(/astro:before-swap/);
  });

  it('inerts every body child, not just one element', () => {
    // 18 focusable elements render after the main landmark closes (Toc links, CornerNav's page and mark
    // links, the menu button, the theme toggle). Inerting one element left all of them reachable behind
    // what claims to be a modal.
    expect(script).toMatch(/document\.body\.children/);
  });
});
