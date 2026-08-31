// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// https://astro.build/config
export default defineConfig({
  site: 'https://ingtian.github.io',

  // ── EACH FAMILY OWNS ITS OWN VARIABLE (--ff-*), AND NOT --font-display/-body/-mono.
  // Those three names are the site's TYPE ROLE tokens, declared in the stylesheet, and pointing
  // astro:fonts at the same names was a silent, total failure: astro:fonts writes
  // `--font-display: "Fraunces-2d723b2dd3e1ca4b", …` into an inline <style> in the head, then our
  // bundled sheet re-declared `--font-display: 'Fraunces', Georgia, serif` further down and won on
  // source order — and the unhashed name "Fraunces" matches no @font-face rule anywhere. So the
  // whole site rendered in Georgia / system-ui / Menlo while every woff2 downloaded and painted
  // nothing. Measured before the fix, on the live site as well as locally: 0 of 24 FontFace entries
  // loaded, and getPlatformFontsForNode reported Georgia on the h1, .SF NS on body copy and Menlo on
  // the mono, all isCustomFont: false. With distinct names there is nothing to collide.
  //
  // `fallbacks` is per family, because the default lands every family on sans-serif — which for a
  // display serif and a mono is the wrong shape to fall back to, and is what a reader sees during the
  // swap and would see again if a woff2 ever failed to load.
  //
  // ── LOCAL FILES, NOT GOOGLE. The build used to fetch every face from fonts.gstatic.com, and that made every
  // build — including the deploy — depend on a third party being consistent at that moment. It bit us: a CI run
  // failed with CannotFetchFontFile / 404 because Google had rotated JetBrains Mono's file hashes mid-run (the
  // request ended BYaTNPxDcwgknk-4, the live URL ended BYRbKPx3cwgknk-6nFg). A retry passed, but the same failure
  // on a push to main would leave the site un-updated with nothing wrong in the repo.
  //
  // The files are the exact latin subsets Astro had already downloaded, committed under src/assets/fonts. They
  // are VARIABLE fonts — one file per style covering the whole weight range, which is why 400/500/600 share a
  // source rather than needing three. `weight` is declared as a range so Astro emits one @font-face per style
  // instead of one per weight.
  //
  // Stored in src/, not public/: Astro copies these into the output itself, so public/ would ship them twice.
  //
  // INTER IS GONE, and the body face is the system UI stack again. Two reasons that agree: it is what the live
  // site has always actually rendered (SF on a Mac) because no webfont ever loaded, and the owner's preference
  // has consistently been for what he was already reading; and it was the most expensive face here — 100KB of
  // the 222KB, for a sans-serif nearly indistinguishable from SF at body size. Vendored payload is now 111KB.
  fonts: [
    {
      provider: fontProviders.local(), name: 'Fraunces', cssVariable: '--ff-fraunces',
      fallbacks: ['Georgia', 'Times New Roman', 'serif'],
      // Provider-specific config goes under `options`; `variants` is not a top-level family key (the schema is
      // strict and rejects it there — 'Unrecognized key: variants').
      options: {
        variants: [
          { weight: '400 600', style: 'normal', src: ['./src/assets/fonts/fraunces-latin-var.woff2'] },
          { weight: '400 600', style: 'italic', src: ['./src/assets/fonts/fraunces-latin-var-italic.woff2'] },
        ],
      },
    },
    {
      provider: fontProviders.local(), name: 'JetBrains Mono', cssVariable: '--ff-jetbrains',
      fallbacks: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      options: {
        variants: [
          { weight: '400 500', style: 'normal', src: ['./src/assets/fonts/jetbrains-mono-latin-var.woff2'] },
        ],
      },
    },
  ],

  vite: {
    plugins: [tailwindcss()]
  },

  // ── MATH IN MARKDOWN, TYPESET AT BUILD TIME ────────────────────────────────────────────────────
  // The writing shelf's kinds promise derivations and "the mathematics left in", and a .md had no way
  // to typeset any of it: there was no markdown config here at all, so `$x$` rendered as the literal
  // dollar signs. remark-math parses the TeX out of the markdown, rehype-katex typesets it.
  //
  // output: 'mathml' IS THE LOAD-BEARING OPTION. rehype-katex's default emits KaTeX's HTML span tree,
  // which is unreadable without katex.min.css AND its ~half-megabyte of KaTeX_* webfonts — a CDN link
  // or a third webfont family, and both are against this project's font rules (two downloaded faces,
  // served locally, no third party at build or at runtime). MathML is the browser's own math renderer:
  // the page ships static <math> markup, zero client JS, zero CSS, zero fonts. Safari, Firefox and
  // Chromium have all shipped MathML Core. This is the same guarantee src/lib/equations.ts already
  // holds for the terrain pill and the /research panels, and tests/equations.test.ts asserts it there
  // ("ships MathML, not a KaTeX runtime") — the markdown path must not be the one that breaks it.
  //
  // throwOnError: false matches equations.ts: one malformed formula renders as KaTeX's error markup in
  // that one spot instead of failing the whole build (and the deploy) over a typo in a note.
  //
  // katex is a devDependency, and stays one — nothing about it is shipped, only its output.
  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [[rehypeKatex, { output: 'mathml', throwOnError: false }]],
  },

  // NO REACT, AND NOT INSTALLED ANY MORE. The terminal was the site's only island and it is deleted, so
  // nothing renders a component: no .tsx files, no client:* directives, no react imports remain.
  // This comment used to claim React "stays in devDeps" — it never did. @astrojs/react, react,
  // react-dom, @types/react and @types/react-dom all sat in `dependencies`, which is precisely why
  // nobody noticed: ~8MB reinstalled on every `npm ci`, in CI and in the deploy, for a runtime no page
  // loads (`grep -rlE 'react-dom|createRoot' dist --include='*.js'` finds nothing). All five are now
  // uninstalled. If an island is ever needed again, `npm i -D @astrojs/react react react-dom` and add
  // the integration back here — devDeps is the right home for a static build's tooling.
  integrations: [sitemap({
    // Prototype routes carry noindex, but an unfiltered sitemap still advertises
    // them to crawlers — and their rendered bodies quote internal review notes.
    filter: (page) => !page.includes('/proto-'),
  }),
  // ── COMMENTS STAY IN SOURCE AND DO NOT SHIP, and it costs nothing to arrange: no integration, no build
  // step, no regex walking built HTML.
  // In a .astro template `<!-- … -->` is HTML and IS emitted, while `{/* … */}` is a JS expression comment
  // the compiler discards. So all 83 markup comments here are written in the second form, and the ~30KB of
  // internal design review they carry (56 on the homepage alone, quoting review verbatim) never reaches a
  // visitor's View Source. tests/htmlComments.test.ts asserts dist stays clean.
  // A 529-line `astro:build:done` integration did this job first, correctly, and is deleted: the owner asked
  // why it existed when the language already had an answer, and he was right.
  ]
});