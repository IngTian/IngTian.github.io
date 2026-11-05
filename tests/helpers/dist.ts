// tests/helpers/dist.ts
// The built site, read one way for every spec that inspects it (distSmoke, cssVars). A missing build THROWS rather
// than skips: a test that quietly passes when its subject is absent is the `passWithNoTests: false` footgun in another
// costume. Not a spec itself — vitest collects only tests/**/*.test.ts.
import { readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DIST = fileURLToPath(new URL('../../dist/', import.meta.url));

const NEEDS_BUILD =
  'found no HTML in dist/. The dist specs inspect the BUILT site, so `npm run build` has to run before ' +
  '`npm test`. ci.yml and deploy.yml both order it that way; any workflow that runs the suite needs the same.';

export interface Page {
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
    return out; // dist/ absent entirely — pages() turns that into a readable failure.
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
 * report them as links the page offers. The flip side, worth stating because it bounds what a dist
 * spec can promise: nodes a script CREATES at runtime are not here either. The /art photo grid is
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
export const pages = (): Page[] => {
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

/** The bundled files in dist/_astro with this extension, each its name and its text. */
export const bundled = (ext: string): { file: string; text: string }[] =>
  readdirSync(join(DIST, '_astro')).filter((f) => f.endsWith(ext))
    .map((f) => ({ file: f, text: readFileSync(join(DIST, '_astro', f), 'utf8') }));

/** Every bundled stylesheet in dist/_astro, concatenated. */
export const distCss = (): string => bundled('.css').map((f) => f.text).join('\n');

/** A page's inline <style> blocks: Astro's `inlineStylesheets: 'auto'` puts small sheets in the document. */
export const inlineCss = (html: string): string =>
  [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');

/** Every byte of CSS these pages ship: their inline <style> blocks, then the bundled sheets. */
export const shippedCss = (ps: readonly Page[]): string => [...ps.map((p) => inlineCss(p.html)), distCss()].join('\n');
