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
/** The gate's CSS, from the emitted stylesheets AND the page — Astro's inlineStylesheets: 'auto' may put a
 *  small scoped sheet in the <head> instead of emitting a file, and which one it picks is not this test's
 *  subject. */
const gateCss = (): string => {
  const home = byRoute().get('/');
  const files = existsSync(join(DIST, '_astro'))
    ? readdirSync(join(DIST, '_astro')).filter((f) => f.endsWith('.css'))
      .map((f) => readFileSync(join(DIST, '_astro', f), 'utf8'))
    : [];
  return [...files, home!.html].join('\n');
};

/**
 * THE GATE'S OWN INLINE SCRIPT BLOCK, not "every script on the page".
 *
 * This used to be a lazy `/<script>[\s\S]*?data-gate[\s\S]*?<\/script>/`, which starts at the document's
 * FIRST <script> — BaseLayout's theme resolver — and ends at the first </script> after the `data-gate` div:
 * one match, 236KB, 14 blocks. Every assertion using it then meant "appears somewhere in the page's script",
 * which is not what any of their comments claimed. Splitting on the tag and keeping the one block that
 * mentions `[data-gate]` gives just the policy script.
 *
 * Hoisted here because BOTH gate describes need it now — the entrance's handshake and its backstop are
 * properties of this script, while its markup and CSS are asserted in the other one.
 */
const gateScript = (): string => byRoute().get('/')!.html
  .split(/<script\b[^>]*>/)
  .map((b) => b.split('</script>')[0])
  .filter((b) => b.includes('[data-gate]'))
  .join('\n');

describe('the first-visit gate, as shipped', () => {
  const home = byRoute().get('/');
  const script = gateScript();

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

  it('IS AUTOMATIC: no control, nothing to focus, and not announced as a dialog', () => {
    // THE INVERSE OF WHAT THIS FILE USED TO ASSERT. There was a test here demanding a real <button> with an
    // accessible name, because the overlay was a door and that button was the only way through it — trap 6
    // is the story of it going invisible twice. The entrance plays itself and settles into the hero, so
    // there is no control at all: "the users wont click anything just seeing through the animation."
    //
    // Which inverts the a11y requirement too. A `role="dialog" aria-modal="true"` with nothing to act on and
    // no way to escape is worse than announcing nothing, so the whole overlay is aria-hidden and the real
    // <h1> is the hero's underneath — which also retires the two-<h1> defect this component shipped once.
    const gate = /<div class="gate"[^>]*>/.exec(home!.markup)?.[0] ?? '';
    expect(gate, 'the gate element is gone or renamed').not.toBe('');
    expect(gate, 'announced as a dialog it cannot honour').not.toMatch(/role="dialog"/);
    expect(gate, 'aria-modal on an overlay with nothing to interact with').not.toMatch(/aria-modal/);
    expect(gate, 'the decorative overlay is not hidden from the a11y tree').toMatch(/aria-hidden="true"/);
    expect(home!.markup, 'a control is back inside the entrance').not.toMatch(/data-gate-enter/);
    expect((home!.markup.match(/<h1[\s>]/g) ?? []).length, 'the page needs exactly one <h1>').toBe(1);
  });

  it('PAINTS THE HERO\'S OWN TERRAIN ON A CANVAS, and carries no text of its own', () => {
    // THE WHOLE POINT OF THE REDESIGN, asserted against the build rather than trusted. The field was a
    // ported 21st.dev line drawing that cross-faded into an unrelated hero; ten rounds of tuning it never
    // shook "a little bit dull", and the replacement — which flew a stand-in name across the screen — got
    // "that's horrible". It is now the hero's own loss field, painted by the same renderer, with the camera
    // and the breath settling onto exactly the hero's values.
    expect(home!.markup, 'the field is not a canvas').toMatch(/<canvas[^>]*class="[^"]*gate-field/);
    expect(home!.markup, 'the decorative field is not hidden from the a11y tree')
      .toMatch(/<canvas[^>]*class="[^"]*gate-field[^"]*"[^>]*aria-hidden="true"/);
    expect(home!.markup, 'an SVG stroke field is back').not.toMatch(/gate-trail/);
    // "the name and other stuff just fades in" — the HERO's name does that, so the overlay has no text.
    // A stand-in copy is what produced two names on screen, a FLIP between two measured boxes, and an
    // ivory-to-ink colour crossover. None of that can come back while this holds.
    expect(home!.markup, 'the entrance has grown its own name again').not.toMatch(/gate-name|gate-letter/);
    expect(home!.markup, 'the opaque ground layer is gone').toMatch(/class="gate-back"/);
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

  it('HANDS OVER ON ONE CHANNEL, AND ENDS EVEN IF THE PAINTER NEVER RUNS', () => {
    // The painter is a BUNDLED module and the policy script is inline. If the painter fails to load, throws
    // on an old browser, or cannot get a 2D context, nothing would ever reach the landing and an opaque
    // full-screen layer would sit over the site permanently — strictly worse than any defect this component
    // has actually shipped. The inline script cannot fail to run, so it carries the backstop.
    // THE HANDSHAKE ITSELF, and this assertion exists because its absence shipped. The painter owns the clock
    // and dispatches LAND when it runs out; the policy script has to be LISTENING or the entrance can only
    // end by backstop. Measured before the fix: 4000ms instead of 2600, with the terrain sitting finished for
    // a second and a half. Every other assertion in this file passed through that bug — the backstop existed,
    // the order in land() was right, the markup was right — because none of them checked that the two halves
    // were actually connected.
    expect(script, 'the policy script does not listen for the painter\'s landing')
      .toMatch(/addEventListener\(LAND,\s*land\)/);

    const t = /setTimeout\(\s*land\s*,\s*(\d+)\s*\)/.exec(script);
    expect(t, 'no backstop timer — a failed painter would strand the overlay').not.toBe(null);
    expect(Number(t![1]), 'the backstop is too long to save a visitor from a stuck overlay')
      .toBeLessThanOrEqual(6000);
    expect(Number(t![1]), 'the backstop fires before the entrance can finish normally').toBeGreaterThan(2600);

    // ORDER IS LOAD-BEARING and the opposite of the obvious one: the attribute must come OFF before REVEAL
    // fires, because the hero's apply() re-reads isCovered() — fire first and it decides it is still
    // covered and never resumes. And REVEAL goes on `document`; dispatching on `window` is a channel the
    // hero does not listen to, which is a bug this component has already shipped once.
    const landFn = /function land\(\)\s*\{[\s\S]*?\n    \}/.exec(script)?.[0] ?? '';
    expect(landFn, 'land() is gone or renamed').not.toBe('');
    expect(landFn).toMatch(/removeAttribute\(UP\)[\s\S]*dispatchEvent\(new Event\(REVEAL\)\)/);
    expect(script, 'REVEAL must be dispatched on document, not window')
      .toMatch(/document\.dispatchEvent\(new Event\(REVEAL\)\)/);
  });

  it('DOES NOT RAISE AT ALL UNDER REDUCED MOTION, and holds the hero text rather than hiding it', () => {
    // An entrance made entirely of motion has nothing to show a reader who asked for none, and a still frame
    // of the hero's terrain held for two seconds is a delay with no content. The finished state the motion
    // rule asks for is the homepage itself, so the inline script returns before raising.
    expect(script, 'the entrance no longer checks the motion preference')
      .toMatch(/prefers-reduced-motion:\s*reduce/);

    // AND THE TEXT FADE IS A PAUSE, NOT AN OPACITY OVERRIDE. The hero's name/bio/tagline already rise in on
    // load; the entrance only holds that animation while it covers them. Written as `animation-play-state`
    // the resting state in the stylesheet is the animation running to opacity 1 — so a visitor whose JS
    // never runs still sees the text. An `opacity: 0` override would make invisibility a property of the
    // element, which is trap 6, the defect that twice shipped an invisible name on this very screen.
    const css = gateCss();
    expect(css, 'the hero text is no longer held during the entrance')
      .toMatch(/\[data-gate-up\][^{]*\.hero-rise[^{]*\{[^}]*animation-play-state:\s*paused/);
    expect(css, 'the hero text is held by hiding it, which is trap 6')
      .not.toMatch(/\[data-gate-up\][^{]*\.hero-rise[^{]*\{[^}]*opacity:\s*0[;}]/);
  });
});

describe('the gate script, after the whole-branch review', () => {
  const script = gateScript();

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
