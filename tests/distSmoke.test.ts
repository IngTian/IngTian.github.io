import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { PAGES } from '../src/data/nav';
import {
  INTRO_DURATION_MS, INTRO_DUR_MIN_MS, INTRO_DUR_MAX_MS,
} from '../src/lib/introTimeline';
import { INTRO_SEEN_KEY } from '../src/lib/introSession';
import { contact, inProgress, projects, publications, researchInterests, timeline, type Publication } from '../src/data/profile';
import { PAPER_DATA } from '../src/data/papers';
import {
  type Stop, experienceStops, flattenStops, homeStops, paperPageOwns, paperSections, paperStops, projectSectionId,
  projectStops, researchIndexStops,
} from '../src/lib/pageStops';
import { FIGURE_NAME, PAPERS_DIR, type PaperReport } from '../src/lib/paperMarkdown';
import { countWords, readingMinutes, wholeParts } from '../src/lib/words';
import { DIST, type Page, distCss, pages, shippedCss } from './helpers/dist';
import { renderMarkdown } from './helpers/paperChain';
import { GALLERY_ORDER } from '../src/lib/galleryLayout';
import { EASE, RAIL, stagger } from '../src/lib/motionTiming';
import { listingLines } from '../src/lib/projectsListing';
import { BOOT_CMD, BOOT_DEADLINE_MS, BOOT_SEEN_KEY } from '../src/lib/projectsBoot';
import { PHONE_QUERY } from '../src/lib/viewport';

/* ================================================================================================
   WHAT THE SITE ACTUALLY SHIPS. This is a static site, so the build output IS the product, and the
   failures a unit test cannot reach are two files that were supposed to agree and don't: a link whose
   target got renamed, a prop nobody passed, a page list that drifted.

   HOW IT READS THE HTML. Regex over the built files, no parser: jsdom or cheerio would put a dependency
   in the deploy path for a job a few regexes do. The cost is that the queries stay simple; where that
   bites, it is written down next to the assertion.

   IT NEEDS A BUILD: tests/helpers/dist.ts reads dist/ for this file and cssVars, and throws, never skips,
   when there is none.
   ================================================================================================ */

const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url));
const CONTENT = fileURLToPath(new URL('../src/content/', import.meta.url));

/** A collection's files, each its name (the slug its glob loader gives it) and its frontmatter block. */
const contentFiles = (dir: string): { name: string; front: string }[] => readdirSync(join(CONTENT, dir))
  .filter((f) => f.endsWith('.md'))
  .map((f) => ({ name: f.slice(0, -3), front: /^---\n([\s\S]*?)\n---/.exec(readFileSync(join(CONTENT, dir, f), 'utf8'))?.[1] ?? '' }));
/** The records with a page of their own: the one each paper file explains (its `publication`). */
const explained = (): Set<string> =>
  new Set(contentFiles('papers').map((f) => /^publication:\s*(\S+)/m.exec(f.front)?.[1] ?? `(${f.name} names no publication)`));

/** Root-relative route → page, keyed the way the helper spells a route (no trailing slash). */
const byRoute = (): Map<string, Page> => new Map(pages().map((p) => [p.route, p]));
const builtPage = (route: string): Page => {
  const p = byRoute().get(route);
  if (!p) throw new Error(`no built page for ${route} — run \`npm run build\``);
  return p;
};
const projectsPage = (): Page => builtPage('/projects');

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
 * The dividing line is a dot in the last segment. It is a heuristic, and the way it could be wrong is a
 * route whose final segment contains a dot — a writing slug like `v1.0-notes` would be mistaken for a
 * file and looked for on disk. No such route exists today; if one is ever added, this is the line to fix,
 * and it will fail loudly rather than quietly pass.
 */
const namesAFile = (path: string): boolean => /\/[^/]*\.[a-z0-9]+$/i.test(path);

/**
 * A paper's file rendered, and what the markdown plugins report for it (its sections, its words), through the chain
 * the build runs (tests/helpers/paperChain.ts) — a second reading of the file, so a page that renders its rail from
 * anything else is caught. The frontmatter is read for what the report needs: which record it explains. Without its
 * references a citation renders as its key, so the words are this render's, not the built page's.
 */
const paperRender = async (slug: string): Promise<{ html: string; report: PaperReport }> => {
  const path = fileURLToPath(new URL(`../${PAPERS_DIR}/${slug}.md`, import.meta.url));
  const body = readFileSync(path, 'utf8').replace(/^---\n[\s\S]*?\n---\n/, '');
  return renderMarkdown(body, path, { papers: PAPER_DATA, publications, frontmatter: { publication: slug } });
};

describe('the built site (dist/) — rendered-output smoke test', () => {
  it('has a build to inspect at all', () => {
    // First, so that a missing dist/ reads as "you did not build" once, instead of as four
    // unrelated-looking failures further down.
    expect(pages().length, 'too few pages in dist/ — run `npm run build`').toBeGreaterThan(5);
  });

  // In a .astro template `<!-- … -->` is HTML and ships, quoting design review into View Source; `{/* … */}` is
  // discarded at compile time (astro.config.mjs, beside `integrations`, says why that is the whole mechanism).
  it('ships no HTML comment on any page', () => {
    const found = pages().flatMap((p) => (p.html.match(/<!--[\s\S]*?-->/g) ?? [])
      .map((c) => `${p.file}: ${c.slice(0, 90).replace(/\s+/g, ' ')}`));
    expect(found, 'in .astro templates write {/* … */} (a bare /* … */ inside an expression), never <!-- … -->')
      .toEqual([]);
  });

  // The seven page files' routes, then one per published writing piece and one per paper file: nine today, the
  // "9 page(s) built" CLAUDE.md quotes. The content routes are counted from src/content/ rather than typed, because
  // a new piece or paper is a file and nothing else may need an edit. A deleted page that still builds, or a page
  // that stopped building, fails by name. (dist/ also holds public/'s one .html, which no page builds.)
  it('builds exactly its routes: seven pages, one per writing piece and one per paper (nine today)', () => {
    const built = pages().filter((p) => !existsSync(join(PUBLIC, p.file))).map((p) => p.route).sort();
    const want = [
      '/', '/404.html', '/art', '/experience', '/projects', '/research', '/writing',
      ...contentFiles('writing').filter((f) => !/^draft:\s*true\b/m.test(f.front)).map((f) => `/writing/${f.name}`),
      ...[...explained()].map((slug) => `/research/${slug}`),
    ].sort();
    expect(built).toEqual(want);
  });

  // ── 1. EVERY INTERNAL LINK RESOLVES ──────────────────────────────────────────────────────────
  // EVERY page, with no exclusion, and every href, not only those with a '#' (a renamed .md is a moved
  // route, and its link has no fragment). Each resolves to a path that must exist; an href that also
  // names a fragment must find the id on the page it lands on.
  it('resolves every internal link to a built page, and every fragment to an id on it', () => {
    const routes = byRoute();
    const dead: string[] = [];

    for (const page of pages()) {
      for (const href of internalHrefs(page)) {
        const hash = href.indexOf('#');
        const frag = hash === -1 ? null : href.slice(hash + 1);
        // `href="#"` is a no-op affordance and `#top` is defined by the HTML spec to mean the document
        // itself, so neither needs an element to exist. Only the ID half is waived, not the whole
        // href, so a link to a missing page cannot escape by ending in "#top".
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

  // ── 2. CV AND EMAIL ARE IN EVERY CORNER NAV, AT EVERY WIDTH ──────────────────────────────────────
  // The corner nav is the only place on the site they are linked. The phone's list is the same <ul>, and below
  // 1200px only an item marked `profile` (GitHub, LinkedIn) is hidden, so neither of these may carry it.
  it('links the CV and Email from every corner nav, in the list the phone opens too', () => {
    const wrong: string[] = [];
    for (const p of pages()) {
      if (!/<html[\s>]/i.test(p.html)) continue;
      const list = /<ul id="cnav-list"[^>]*>[\s\S]*?<\/ul>/.exec(p.markup)?.[0] ?? '';
      for (const c of [contact.cv, contact.email]) {
        const li = [...list.matchAll(/<li\b([^>]*)>([\s\S]*?)<\/li>/g)]
          .find((m) => m[2].includes(`href="${c.href}"`) && m[2].includes(`aria-label="${c.label}"`));
        if (!li) wrong.push(`${p.route}: no ${c.label} link in the corner nav`);
        else if (/\bprofile\b/.test(li[1])) wrong.push(`${p.route}: ${c.label} is hidden below 1200px`);
      }
      // and every link in it goes somewhere: the link check skips an empty href and every off-site one, so a contact
      // href emptied in profile.ts would ship a link to the page itself
      for (const [a] of list.matchAll(/<a\b[^>]*>/g)) if (!/\shref="[^"]+"/.test(a)) wrong.push(`${p.route}: ${a}`);
    }
    expect(wrong).toEqual([]);
    // and no rule hides the marks wholesale: below 1200px only `.profile` goes. Read from every byte of CSS the pages
    // ship, and known to be reading the corner nav's: the `.profile` rule is found first.
    const css = shippedCss(pages());
    expect(css, 'the corner nav hides `.profile` below 1200px').toMatch(/\.cnav\[[^\]]+\] \.profile\[[^\]]+\][^{}]*\{[^}]*display:none/);
    const hides = /\.cnav\[[^\]]+\] \.mark(?:-li)?\[[^\]]+\][^{}]*\{[^}]*display:none/.exec(css);
    expect(hides?.[0], 'a corner-nav rule hides every contact mark').toBeUndefined();
  });

  // ── 3. ONE H1, ONE MAIN, EACH ID ONCE, AND NO IMAGE WITHOUT ALT ──────────────────────────────
  it('gives every document exactly one <h1> and one <main>', () => {
    for (const p of pages()) {
      // dist also holds the Google Search Console verification file: a one-line text file that
      // happens to end in .html and is not a document at all. Anything without an <html> element
      // is not being asked for a heading or a landmark.
      if (!/<html[\s>]/i.test(p.html)) continue;
      for (const tag of ['h1', 'main']) {
        const n = (p.markup.match(new RegExp(`<${tag}[\\s>]`, 'gi')) ?? []).length;
        expect(n, `${p.file} has ${n} <${tag}> elements; a document gets exactly one`).toBe(1);
      }
    }
  });

  // A second element with an id takes none of its links: a `#fragment` and getElementById find the first.
  it('gives every id on a page once', () => {
    const twice = pages().flatMap((p) => {
      const all = [...p.markup.matchAll(/\sid="([^"]*)"/g)].map((m) => m[1]);
      return all.filter((id, i) => all.indexOf(id) !== i).map((id) => `${p.route}: #${id}`);
    });
    expect(twice).toEqual([]);
  });

  // KaTeX does not throw on bad TeX: it draws the source in its error markup. A paper refuses that at build time;
  // this holds every page to it, a writing piece's maths included.
  it('typesets every formula: no page carries KaTeX error markup', () => {
    expect(pages().filter((p) => p.markup.includes('katex-error')).map((p) => p.route)).toEqual([]);
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

  // .sr-only's 1px box hides nothing on a table: a table's width and height are only minimums, so it lays out every
  // column and row at full size, inside the page's scrollable overflow, where a scroll to a hidden cell (find-in-page,
  // a screen reader's cursor) moves the page sideways. A hidden table goes inside a hidden div.
  it('never puts .sr-only on a table', () => {
    const bad = pages().flatMap((p) => [...p.markup.matchAll(/<table\b[^>]*\bclass="[^"]*\bsr-only\b[^>]*>/gi)].map(([t]) => `${p.file}: ${t}`));
    expect(bad).toEqual([]);
  });
});

describe('the homepage intro ships on / and ONLY on /', () => {
  // MOVING THE INTRO UP INTO BaseLayout IS THE ONE EDIT that would hand a 5.2-second construction
  // animation to every route — including /404. The marker is `data-intro` on the terrain canvas, which
  // nothing in the page reads: it exists so this assertion can (TerrainHero.astro says so).
  it('marks the intro on the homepage', () => {
    expect(builtPage('/').html).toMatch(/<canvas[^>]*\bdata-intro\b/);
  });

  it('marks it nowhere else', () => {
    const leaked = pages().filter((p) => p.route !== '/' && /\bdata-intro\b/.test(p.html)).map((p) => p.file);
    expect(leaked, `the intro leaked onto ${leaked.join(', ')} — has it moved into BaseLayout?`).toEqual([]);
  });

  it('ships the decision INLINE, before the hero, with the constants from lib/', () => {
    // THE POLICY IS ASSERTED WHERE IT SHIPS: the decision is an `is:inline` script, which cannot `import`,
    // so it re-implements the parse and the clamp in raw JS, and this reads that code (module copies of it
    // for a spec to call had no production caller and are deleted). Two properties:
    //   1. INLINE AND BEFORE THE HERO. A bundled `<script>` is deferred and runs after parse, which is
    //      what made the sky flash warm → flat → warm for ~300ms.
    //   2. THE CONSTANTS AGREE WITH lib/. They are passed through `define:vars` precisely so there is one
    //      source; this fails if someone hand-types a number into the inline body.
    const { html } = builtPage('/');
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
    for (const p of pages()) {
      for (const m of p.html.matchAll(/(?:href|src)="([^"]*(?:[?&](?:intro|dur)=)[^"]*)"/g)) {
        offenders.push(`${p.file} → ${m[1]}`);
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
  // A BYTE CEILING, NOT A WIDTHS CHECK: the regression was the stele's native 1727w (a 1342 KB webp) in the
  // `widths` of the fetchpriority="high" LCP image, and the array is only a means. This weighs the file a
  // DPR-2 browser would choose, with the device px read from the shipped `sizes`: a hard-coded figure once
  // agreed with a wrong hint. Whether the hint is right is artSizes.test.ts's job; the arithmetic is in
  // art.astro, above calSizes().
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
    // Native pixels, for the 6x zoom, in a webp: the JPEG original cost 0.6-2.2 MB per open (see zoomOf()).
    const zooms = [...artHtml().matchAll(/data-zoom="([^"]+)"/g)].map((m) => m[1]);
    expect(zooms.length, 'no data-zoom attributes on /art').toBeGreaterThan(10);
    const notWebp = zooms.filter((z) => !z.endsWith('.webp'));
    expect(notWebp, `lightbox sources that are not webp: ${notWebp.slice(0, 3).join(', ')}`).toEqual([]);
  });
});

describe('the images under src/assets', () => {
  // Astro drops an imported image's original unless something reads a property of its ImageMetadata outside
  // <Image>/getImage() (the import is a Proxy; see zoomOf() in art.astro). /art reading `.width` once kept all 44
  // of its JPEGs, 40.5 MB that nothing referenced. So every image here ships as its webp variants and nothing
  // else; an og:image or a plain <img> reading `.src` turns this red.
  it('ships no original of any of them, only its webp variants', () => {
    const sources = readdirSync(new URL('../src/assets/', import.meta.url), { recursive: true, encoding: 'utf8' })
      .filter((f) => /\.(png|jpe?g|gif|webp|avif|tiff?)$/i.test(f))
      .map((f) => basename(f).replace(/\.[^.]+$/, ''));
    expect(sources.length, 'no images found under src/assets').toBeGreaterThan(0);
    const emitted = readdirSync(join(DIST, '_astro')).filter((f) => sources.some((s) => f.startsWith(`${s}.`)));
    expect(emitted.filter((f) => !f.endsWith('.webp')), 'originals in dist/_astro').toEqual([]);
    expect(sources.filter((s) => !emitted.some((f) => f.startsWith(`${s}.`))), 'images with no variant at all').toEqual([]);
  });
});

describe("BaseLayout's per-page hooks: /projects is the drafting page, the research routes the paper page", () => {
  // `page` puts `data-page` on <html>, the scope tokens.css hangs a register's palette from (and, on `/`, 'deck',
  // the rail's resting ink); `veil={false}` drops
  // the descent veil — on /projects because its boot is its entrance, on the research routes because the veil would
  // replay on every card click and every way back, holding the text ~1.1s. Both are props, so what this guards is a
  // default changing under every other route.
  // Read from `markup` (scripts stripped): the veil's own inline script names `[data-veil]` on every page.
  const veilEl = /<div\b[^>]*\sdata-veil\b/;
  const pageOf = (markup: string): string | undefined => /<html\b[^>]*\sdata-page="([^"]*)"/.exec(markup)?.[1];
  const isResearch = (route: string): boolean => route === '/research' || route.startsWith('/research/');
  const research = (): Page[] => pages().filter((p) => isResearch(p.route));

  it('marks /projects as drafting, every research route as paper, / as deck, and no other route at all', () => {
    expect(research().length, 'no research route was built').toBeGreaterThan(0);
    const want = (route: string): string | undefined =>
      route === '/projects' ? 'drafting' : isResearch(route) ? 'paper' : route === '/' ? 'deck' : undefined;
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
          target: /\shref="#([^"]*)"/.exec(m[1])?.[1] ?? '', label: decode(/<span class="dim"[^>]*>([^<]*)</.exec(m[2])?.[1] ?? ''),
          depth: open - 1, tag: m[1], inner: m[2],
        });
      }
    }
    return out;
  };
  const flat = (stops: readonly Stop[], depth = 0): { target: string; label: string; depth: number }[] =>
    stops.flatMap((s) => [{ target: s.target, label: s.label, depth }, ...flat(s.children ?? [], depth + 1)]);

  it('is on /, /experience, /projects, /research, /research/rl-bhrp and /writing', () => {
    expect(railPages().map((p) => p.route).sort()).toEqual(['/', '/experience', '/projects', '/research', '/research/rl-bhrp', '/writing']);
  });

  // The homepage's rail stays off its hero (SideRail's hideOver): a script marks it passed, and until then a plain
  // rule outside any query keeps it display: none, so it is out of the tab order with no script too. The id it
  // names must be the page's, or the rail never shows.
  it('stays off the element its page names, which the page emits, and on / that is the hero', () => {
    const over = (p: Page) => /<nav\b[^>]*\sclass="side-rail"[^>]*\sdata-hide-over="([^"]*)"/.exec(p.markup)?.[1];
    expect(railPages().filter((p) => over(p) !== undefined).map((p) => [p.route, over(p)])).toEqual([['/', 'heights']]);
    expect(builtPage('/').ids.has('heights')).toBe(true);
    expect(railCss()).toMatch(/(?:^|\})\.side-rail\[data-hide-over\]:not\(\[data-past\]\)\{display:none\}/);
  });

  // The label is three layers of its text, so its states cross-fade by opacity: the dim one, the link's name and the
  // only text in the markup, and two inks over it, each an empty aria-hidden element whose text is generated from
  // its data-l, so every engine names the link by its label once and find-in-page sees it once. The dash is its own
  // aria-hidden span. The marks are the script's: none is served. The one thing served on a link is its place in the
  // entrance, --i, its index in document order.
  it('renders every link as href + aria-hidden dash + its label and two empty aria-hidden copies, its --i, and no state', () => {
    const bad: string[] = [];
    for (const p of railPages()) {
      for (const [k, it] of itemsOf(p).entries()) {
        const parts = /^<span class="rule" aria-hidden="true"[^>]*><\/span><span class="lbl"[^>]*><span class="dim"[^>]*>([^<]*)<\/span><span class="ink2" aria-hidden="true" data-l="([^"]*)"[^>]*><\/span><span class="ink1" aria-hidden="true" data-l="([^"]*)"[^>]*><\/span><\/span>$/
          .exec(it.inner);
        if (!parts) bad.push(`${p.route} #${it.target}: ${it.inner}`);
        else if (decode(parts[2]) !== decode(parts[1]) || decode(parts[3]) !== decode(parts[1])) bad.push(`${p.route} #${it.target}: a copy ≠ its label`);
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
    expect(strip(itemsOf(builtPage('/research/rl-bhrp')))).toEqual(flat(paperStops((await paperRender('rl-bhrp')).report.sections)));
    expect(strip(itemsOf(builtPage('/research')))).toEqual(flat(researchIndexStops()));
    expect(strip(itemsOf(builtPage('/')))).toEqual(flat(homeStops()));
    expect(new Set(itemsOf(builtPage('/writing')).map((i) => i.depth))).toEqual(new Set([0, 1]));
  });

  // CLAUDE.md, Motion: only transform and opacity animate, so the dash never grows by `width` (which would push the
  // label sideways) and a label never fades by `color`.
  /** Every shipped rule that styles the rail, from the pages' inline styles and the bundled sheets, scope hashes
   *  stripped: [whole, selector, body]. */
  const railCss = (): string => shippedCss(railPages()).replace(/\[data-astro-cid-[\w-]+\]/g, '');
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
  // backwards fill so it waits in its from-state; --row is RAIL.row and --gap lib/motionTiming's stagger() over the
  // rail's rows, so every row is in by RAIL.enter however long the rail is. Read as shipped, the duration and the gaps.
  it('enters by CSS alone, where motion is allowed: opacity and transform, each row --i x --gap late, all in by RAIL.enter', () => {
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
    const m = /^animation:side-rail-enter var\(--row\) (cubic-bezier\([^)]*\)) backwards;animation-delay:calc\(var\(--i\) ?\* ?var\(--gap\)\)$/.exec(rule![1]);
    expect(m, `the entrance's declarations: ${rule![1]}`).not.toBeNull();
    expect(m![1]).toBe(EASE);

    for (const p of railPages()) {
      const vars = /<nav\b[^>]*\sclass="side-rail"[^>]*\sstyle="--gap:([\d.]+)ms;--row:([\d.]+)ms"/.exec(p.html);
      expect(vars, `${p.route}: the rail carries no --gap and --row`).not.toBeNull();
      const gap = Number(vars![1]), row = Number(vars![2]);
      expect(row, p.route).toBe(RAIL.row);
      const n = itemsOf(p).length; // and each row's --i is its index (the markup test above)
      for (let i = 0; i < n; i += 1) {
        expect(i * gap, `${p.route} row ${i}`).toBeCloseTo(stagger(i, n, { step: RAIL.rowStep, total: RAIL.enter - row }), 6);
      }
      expect((n - 1) * gap + row, p.route).toBeLessThanOrEqual(RAIL.enter + 1e-9);
    }
  });

  // A touch laptop's primary pointer can hover, so a tap there leaves :hover on the tapped row until the next tap
  // elsewhere. The script's .is-hover is set for a mouse or a pen only.
  it("styles hover by the script's .is-hover, never by :hover", () => {
    expect(railRules().map(([, sel]) => sel.trim()).filter((sel) => /:hover\b/.test(sel))).toEqual([]);
    expect(railRules().some(([, sel]) => /\.is-hover/.test(sel)), 'no rule reads .is-hover').toBe(true);
  });

  // Generated text is in the accessible name in some engines and not in others (the alt text after a slash that
  // keeps it out does not parse before Safari 17.4 and Firefox 128), so a label's text is generated only inside the
  // copies, whose aria-hidden keeps it out of the name everywhere (the markup test above). Generated, the copies are in
  // no selection and no find-in-page; real text in them would be in both. The rail's one other generated box is the
  // hover preview's dash, which holds no text.
  it('generates label text only in the aria-hidden copies, and nothing else', () => {
    const content = railRules().flatMap(([, sel, body]) => [...body.matchAll(/(?:^|;)content:([^;]*)/g)]
      .map((m) => `${sel.trim().replace(/::/g, ':')} ${m[1].replace(/\s+/g, '')}`));
    expect(content.sort()).toEqual(['.side-rail .ink2:before,.side-rail .ink1:before attr(data-l)', '.side-rail a:after ""']);
  });

  // Forced colours (Windows High Contrast) map every ink to one system colour and paint backgrounds as Canvas, so the
  // marks the rail tells its stops apart by, an ink's strength and a dash, are gone. The current stop keeps a mark
  // there: the dash painted in Highlight, the current label underlined.
  it('keeps the current stop marked under forced colours', () => {
    const forced = [...railCss().matchAll(/@media ?\(forced-colors: ?active\) ?\{((?:[^{}]*\{[^{}]*\})*)\}/g)].map((m) => m[1]).join('');
    const rules = [...forced.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, sel, body]) => ({ sel, body }));
    const dash = rules.find((r) => /\.side-rail \.rule\b/.test(r.sel));
    expect(dash?.body, 'no forced-colours rule for the dash').toMatch(/forced-color-adjust:none/);
    expect(dash?.body).toMatch(/background(?:-color)?:highlight\b/i);
    const current = rules.find((r) => /\.is-active\b/.test(r.sel) && /\.ink1\b/.test(r.sel));
    expect(current?.body, 'no forced-colours underline for the current label').toMatch(/text-decoration(?:-line)?:underline\b/);
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
  const rawCss = (): string => shippedCss([projectsPage()]);
  const unscoped = (): string => rawCss().replace(/\[data-astro-cid-[\w-]+\]/g, '');

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
    expect(unscoped()).toMatch(/\.drafting-vig\{background:radial-gradient\([^)]*var\(--draft-vig\)\)\}/);
  });

  // 100vh is the LARGE viewport, so the box holds still while a phone's toolbar collapses: at `height: 100%` the
  // bitmap stretched and every isoline jumped by half the toolbar on each change of scroll direction.
  it("sizes the field's box to the large viewport, so a mobile toolbar cannot move the drawing", () => {
    const rule = /\.drafting-field,\.drafting-vig\{([^}]*)\}/.exec(unscoped());
    expect(rule, 'no shared .drafting-field,.drafting-vig rule').not.toBeNull();
    expect(rule![1]).toMatch(/(^|;)height:100(l?)vh(;|$)/);
    expect(rule![1]).toMatch(/(^|;)position:fixed(;|$)/);
  });

  // Neither main nor the rail has a background, so their text sits straight on the field's strokes. The knockout
  // gives every glyph an opaque 1px ring of the ground. It is ONE role token, --knockout, which the drafting blocks
  // declare (tests/draftingPalette.test.ts holds its value and that it has no second spelling): <main>'s text and the
  // shared rail's labels both read it, so the page does not touch the rail.
  it("rings every glyph in <main> and in the rail with the bare ground, so no stroke touches the page's text", () => {
    const css = unscoped();
    expect(css).toMatch(/\.side-rail \.lbl\{(?:[^}]*;)?text-shadow:var\(--knockout,\s*none\)/);
    expect(css).toMatch(/\.side-rail \.rule\{(?:[^}]*;)?box-shadow:var\(--rail-dash-halo,\s*none\)/);
    expect(css).toMatch(/\.projects-page\{(?:[^}]*;)?text-shadow:var\(--knockout\)(;|\})/);
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

/** What a title keeps on one line (lib/words wholeParts): its names, spans of years, dates and arXiv categories. */
const kept = (title: string): string[] => wholeParts(title).filter((_, i) => i % 2);

describe('/research — the papers as cards, newest first, then the interests', () => {
  const page = (): Page => builtPage('/research');
  const text = (html: string): string => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;|\s+/g, ' ').trim();
  /** Each card in order: its title link's attributes and href, and its markup. */
  const cards = () => [...page().markup.matchAll(/<article\b[^>]*\sclass="pc"[^>]*>([\s\S]*?)<\/article>/g)].map((m) => {
    const attrs = /<h3 class="p-title"><a\b([^>]*)>/.exec(m[1])?.[1] ?? '';
    return { attrs, href: /\shref="([^"]*)"/.exec(attrs)?.[1] ?? '', html: m[1] };
  });
  // A record that a paper file explains opens that page; any other opens where the paper is published.
  const want = (p: Publication): string => (explained().has(p.slug) ? `/research/${p.slug}` : p.href);

  // in the records' order, which publications.test.ts holds newest first
  it('renders one card per publication, newest first', () => {
    expect(cards().map((c) => c.href)).toEqual(publications.map(want));
  });

  it("opens a paper's own page when it has one, and otherwise the record's href, saying so", () => {
    for (const [i, c] of cards().entries()) {
      const p = publications[i];
      if (c.href.startsWith('/')) {
        expect(byRoute().has(c.href), `${p.slug}: ${c.href} is not a built route`).toBe(true);
        expect(text(c.html), p.slug).not.toContain('opens the publisher');
      } else {
        expect(c.href, p.slug).toBe(p.href);
        expect(c.attrs, p.slug).toMatch(/\starget="_blank"/);
        expect(c.attrs, p.slug).toMatch(/\srel="noopener noreferrer"/);
        expect(text(c.html), p.slug).toContain('opens the publisher’s page ↗');
        // and says so to a reader who reaches the link from a list of links, too
        const said = /\saria-describedby="([^"]*)"/.exec(c.attrs)?.[1] ?? '';
        // the arrow is a picture of "opens elsewhere", which the words already say, so it is not read out
        expect(new RegExp(`<span class="out" id="${said}">opens the publisher’s page<span aria-hidden="true"> ↗</span></span>`).test(c.html), p.slug).toBe(true);
      }
    }
    // both kinds are on the page today, so neither branch above is vacuous
    expect(new Set(cards().map((c) => c.href.startsWith('/')))).toEqual(new Set([false, true]));
  });

  // The venue never carries the year itself, nor a volume, which the DOI carries: a card reads, as spec §3 has it,
  // "Conference paper · SPIE (CNSSE) · 2022".
  it("prints each card's status, venue and year, the year once", () => {
    const metas = cards().map((c) => text(/<p class="p-meta">([\s\S]*?)<\/p>/.exec(c.html)?.[1] ?? ''));
    for (const [i, meta] of metas.entries()) {
      const p = publications[i];
      expect(meta, p.slug).toContain(` · ${p.venue} · ${p.year}`);
      expect(meta.split(p.year).length - 1, meta).toBe(1);
    }
    expect(metas.some((m) => m.startsWith('Conference paper · SPIE (CNSSE) · 2022'))).toBe(true);
  });

  it("shows a paper's miniature on its card, captioned as the reproduction, and no picture on one without", () => {
    for (const [i, c] of cards().entries()) {
      const thumb = PAPER_DATA[publications[i].slug]?.thumb;
      if (!thumb) {
        expect(c.html, publications[i].slug).not.toMatch(/<svg\b/);
        continue;
      }
      expect(c.html).toContain(thumb.svg);
      expect(thumb.caption).toMatch(/reproduction/);
      expect(text(c.html)).toContain(thumb.caption);
    }
    expect(PAPER_DATA['rl-bhrp'].thumb, "RL-BHRP's card has no miniature").toBeDefined();
  });

  // A reader who moves by headings lands on the title, and what follows it is the card: the picture is the card's
  // last word in the markup, wherever the grid shows it.
  it("puts a card's title first and its picture last in the markup", () => {
    const pictured = cards().filter((c) => c.html.includes('class="p-fig"'));
    expect(pictured.length).toBeGreaterThan(0);
    for (const c of cards()) expect(c.html.trimStart().startsWith('<h3 class="p-title">'), c.href).toBe(true);
    for (const c of pictured) expect(c.html.trimEnd()).toMatch(/<div class="p-fig">[\s\S]*<\/div>$/);
  });

  // A browser may break a line after any hyphen, and a title would then split a paper's own name ("(RL-BHRP)").
  it("keeps each card title's names whole", () => {
    for (const [i, c] of cards().entries()) {
      for (const w of kept(publications[i].title)) expect(c.html, w).toContain(`<span class="nw">${w}</span>`);
    }
  });

  // (that the page emits each id is the rail's markup test, above)
  it('sets the rail stops in order, the papers before the interests', () => {
    const ids = researchIndexStops().map((s) => s.target);
    const at = ids.map((id) => page().markup.indexOf(` id="${id}"`));
    expect(at).toEqual([...at].sort((a, b) => a - b));
    for (const r of researchInterests) expect(text(page().markup)).toContain(`${r.label}. ${r.gloss}`);
  });

  // A preprint, always: no research route says a paper was published or peer-reviewed. A paper page calls its
  // preprint "not peer reviewed", the one place the words may stand.
  it('never says a paper was published or peer-reviewed, on any research route', () => {
    const routes = pages().filter((p) => p.route === '/research' || p.route.startsWith('/research/'));
    expect(routes.length).toBeGreaterThan(1);
    for (const p of routes) {
      const words = text(p.markup);
      expect(words, p.route).not.toMatch(/published/i);
      expect(words.replace(/not peer reviewed/g, ''), p.route).not.toMatch(/peer[- ]reviewed/i);
    }
    expect(text(builtPage('/research/rl-bhrp').markup)).toContain('preprint, not peer reviewed');
  });

  // The generated sitemap lists every route. public/sitemap.xml is an index that points at it, so it lists none.
  it('reaches the generated sitemap with every paper page', () => {
    const map = readFileSync(join(DIST, 'sitemap-0.xml'), 'utf8');
    for (const route of ['/research', ...[...explained()].map((s) => `/research/${s}`)]) {
      expect(map, route).toContain(`<loc>https://ingtian.github.io${route}/</loc>`);
    }
    expect(readFileSync(join(DIST, 'sitemap.xml'), 'utf8')).toContain('<loc>https://ingtian.github.io/sitemap-0.xml</loc>');
  });
});

describe('/research/rl-bhrp — a paper explained, from its file', async () => {
  const page = (): Page => builtPage('/research/rl-bhrp');
  const { html: rendered, report } = await paperRender('rl-bhrp');
  const rl = publications.find((p) => p.slug === 'rl-bhrp')!;
  const text = (html: string): string => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;|\s+/g, ' ');

  // Every rule on the page is scoped to .paper, so its one <main> (the first describe) must carry it.
  it('sets the page in <main class="paper">', () => {
    expect(/<main\b[^>]*\sclass="paper"/.test(page().markup)).toBe(true);
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

  // Underline, on 5–7 key sentences: no more than about one a screen (spec §4).
  it('highlights five to seven sentences', () => {
    const n = page().markup.match(/<mark class="hl">/g)?.length ?? 0;
    expect(n).toBeGreaterThanOrEqual(5);
    expect(n).toBeLessThanOrEqual(7);
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

  // The reading time counts every word a reader reads on the page, as the approved prototype did: the head, the
  // abstract, the body with its captions and notes, Read the full paper, the note on the references, the cite line,
  // the corrections and the tags. Not the controls (the back link, the links, Copy), the maths, the figures'
  // drawings, the tables, the Contents, the reference list or the BibTeX. Recounted here by that rule, from the
  // markup: the plugin's count of the file to the word, and the built page's minutes.
  it('computes its reading time from every word a reader reads', () => {
    const unread = [/<(math|svg|table|pre|nav|button)\b[\s\S]*?<\/\1>/g, /<a class="back"[\s\S]*?<\/a>/g,
      /<p class="links">[\s\S]*?<\/p>/g, /<ol class="refs">[\s\S]*?<\/ol>/g, /(?<=<figure class="fig\b[^>]*>)[\s\S]*?(?=<figcaption>)/g];
    // a name kept whole is one word, as the plugin counted it before the span went round it
    const words = (html: string) => countWords(unread.reduce((s, re) => s.replace(re, ' '), html)
      .replace(/<span class="nw">([^<]*)<\/span>/g, '$1').replace(/<[^>]+>|&nbsp;/g, ' ').replace(/&[#\w]+;/g, ''));
    expect(words(rendered)).toBe(report.bodyWords);
    const markup = page().markup, main = markup.slice(markup.indexOf('<main'), markup.indexOf('</main>'));
    expect(text(main)).toContain(`· ${readingMinutes(words(main))} min read · written by Zeying Tian, the second author`);
  });

  // The title, the abstract and the page's own prose round the file (the head, the cite line, the corrections) go
  // through the rule the body does (lib/words wholeParts), so nowhere on the page does a line break inside a name:
  // "RL-" / "BHRP)" on the cite line, "[q-" / "fin.PM" in the meta. (The title's text-wrap: balance would keep
  // "(RL-BHRP)" whole only where balance applies: not past six lines, nor in Safari before 17.5.) Read from the
  // page's text, the maths, drawings, tables and BibTeX aside (the drawings' text is set on one line by their own
  // CSS: the readout's tip is nowrap).
  it('keeps every hyphenated name, span of years, ISO date and arXiv category whole, in its own prose too', () => {
    const markup = page().markup;
    const prose = markup.slice(markup.indexOf('<main'), markup.indexOf('</main>'))
      .replace(/(?<=<figure class="fig\b[^>]*>)[\s\S]*?(?=<figcaption>)/g, ' ')
      .replace(/<(math|svg|pre|table|nav|script)\b[\s\S]*?<\/\1>/g, ' ')
      .replace(/<span class="nw">[^<]*<\/span>/g, ' ').replace(/<[^>]+>/g, ' ');
    expect(wholeParts(prose).filter((_, i) => i % 2)).toEqual([]);
    expect(/<p class="ref-line">[\s\S]*?<\/p>/.exec(markup)?.[0]).toContain('(<span class="nw">RL-BHRP</span>) Approach');
  });

  // The plugin numbers what the file places, not what PAPER_DATA registers, so a drawing the file stopped placing
  // would go unseen: each is here once (by its outermost tag), and no page still says FIGURE_NAME, the placeholder
  // a drawing names itself by until its :::figure numbers it.
  it('places every drawing its data registers, once, each named by its :::figure', () => {
    expect(Object.keys(PAPER_DATA['rl-bhrp'].figures).sort()).toEqual(['metrics', 'pipeline', 'wealth']);
    for (const [name, html] of Object.entries(PAPER_DATA['rl-bhrp'].figures)) {
      const head = /^<\w+ class="[^"]*"/.exec(html)?.[0] ?? `(${name} opens with no class)`;
      expect(page().markup.split(head).length - 1, `${name}: ${head}`).toBe(1);
    }
    expect(pages().filter((p) => p.html.includes(FIGURE_NAME)).map((p) => p.route)).toEqual([]);
  });

  // The caption is the explainer's, so it says here what the figure is: the owner's reproduction, not the paper's run.
  // A month-by-month median is no single run and has no turnover: the one run's turnover is named as that run's.
  it("captions Figure 2 as the second author's reproduction, with the paper's own figure beside it", () => {
    const cap = /<figure class="fig" id="figure-2">[\s\S]*?<figcaption>([\s\S]*?)<\/figcaption>/.exec(page().markup)?.[1] ?? '';
    const v = PAPER_DATA['rl-bhrp'].values;
    expect(text(cap)).toContain('Figure 2. A reproduction, not the paper’s run:');
    expect(text(cap)).toContain(`median of the reproduction’s ${v.reproRuns} training runs`);
    expect(text(cap)).toContain(`where the paper reports ${v['usd.rl']} from its original run`);
    expect(text(cap)).toContain(`the run with the median growth turns over ${v.reproTurnover}`);
    expect(text(cap)).not.toMatch(/median run|its median,/);
    expect(text(cap)).toContain('not fresh evidence');
  });

  // Which fell deepest depends on where the count starts (Results says why), so each such claim says whose count.
  it("qualifies every claim of the deepest fall as the paper's count", () => {
    const claims = text(page().markup).split(/(?<=\.)\s/).filter((s) => /\bdeepe(?:r|st)\b/.test(s));
    expect(claims.length).toBeGreaterThanOrEqual(3);
    for (const s of claims) expect(s).toMatch(/by the paper’s count/i);
  });

  // Hovering a Notation row lights every place its symbols stand in the displays, an index inside the symbol it
  // indexes too, as the approved prototype did: these are its counts, over eq. (4)'s wide and narrow forms both.
  it("tags each Notation row's symbols wherever a display uses them", () => {
    const markup = page().markup;
    const rows = new Map([...markup.matchAll(/<tr data-sym="(\d+)">\s*<th scope="row">[\s\S]*?<annotation encoding="application\/x-tex">([^<]*)<\/annotation>/g)]
      .map((m) => [m[1], m[2]]));
    const lit: Record<string, number> = {};
    for (const [, eq] of markup.matchAll(/<div class="eq-math">([\s\S]*?)<span class="eq-no/g)) {
      for (const [, k] of eq.matchAll(/\sdata-sym="(\d+)"/g)) lit[rows.get(k)!] = (lit[rows.get(k)!] ?? 0) + 1;
    }
    expect(lit).toEqual({
      'N,\\ G': 1, 'i\\in\\mathcal{I}_{g}': 14, 'w,\\ w_{i}': 20, 'W_{g}': 5, '\\eta_{i\\mid g},\\ \\eta^{(g)}': 3,
      'R_{t+1}': 2, '\\Sigma,\\ \\Sigma_{t}': 5, '\\widetilde{\\Sigma}(\\eta)': 2, '\\sigma_{p}^{2}(w)': 2,
      '\\mathrm{RC}_{i}(w),\\ \\mathrm{RC}_{g}(w)': 3, c: 2, '\\mathcal{V}_{\\mathrm{within}},\\ \\mathcal{V}_{\\mathrm{across}}': 4,
      '\\lambda,\\ \\alpha': 6, 'U_{t+1}': 2,
    });
  });
});

describe('the research routes — what a reader prints or hovers', () => {
  // A printout is laid out where no IntersectionObserver sees it and no on-screen backstop runs, so a hold-back
  // that applied there would print the page blank below its first screen, Figure 2 under its mask. Every rule that
  // holds something back (a `[data-pending]` reveal, an unplaced margin note) is inside an `@media screen` block.
  // Outside one such a rule may say only `transition: none`: kept in every medium, it makes the print layout's
  // dropping of a hold a snap, where a note's opacity transition would otherwise start from 0 and print it there.
  it('holds nothing back in print: every hold-back rule is screen-only', () => {
    const css = distCss();
    const screen = /@media screen\b[^{]*\{((?:[^{}]*\{[^{}]*\})*)\}/g;
    const holds = (s: string) => [...s.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter(([, sel]) => /\[data-pending\]|:not\(\.is-placed\)/.test(sel))
      .map(([, sel, body]) => ({ sel: sel.trim(), body }));
    const guarded = [...css.matchAll(screen)].flatMap((m) => holds(m[1]));
    expect(guarded.length, 'the seven hold-back rules written today').toBeGreaterThanOrEqual(7);
    const outside = holds(css.replace(screen, ''));
    expect(outside.length, "the two pages' transition: none").toBeGreaterThanOrEqual(2);
    expect(outside.filter((r) => r.body !== 'transition:none').map((r) => r.sel)).toEqual([]);
  });

  // WCAG 1.4.13, which neither Lighthouse nor axe tests: content shown on hover must be hoverable. Each of the paper
  // page's two tips takes the pointer while it shows, and bridges the gap to what it reads, so the pointer can cross.
  it('makes each tip hoverable: a shown tip takes the pointer, and a bridge spans its gap', () => {
    const rules = [...distCss().matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, sel, body]) => ({ sels: sel.split(',').map((s) => s.trim()), body }));
    const body = (sel: string) => rules.filter((r) => r.sels.includes(sel)).map((r) => r.body).join(';');
    for (const shown of ['.paper .f-plot.reading .f-tip', 'html[data-page=paper] .sym-tip.on']) {
      expect(body(shown), shown).toMatch(/(^|;)pointer-events:auto\b/);
    }
    for (const bridge of ['.paper .f-tip:after', 'html[data-page=paper] .sym-tip:before']) {
      expect(body(bridge), bridge).toMatch(/(^|;)content:""/);
      expect(body(bridge), bridge).toMatch(/(^|;)height:\d+px/);
    }
  });
});
