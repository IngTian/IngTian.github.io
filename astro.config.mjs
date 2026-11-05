// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import { markdownPlugins } from './src/lib/paperMarkdown/index.ts';
import { PAPER_DATA } from './src/data/papers/index.ts';
import { publications } from './src/data/profile.ts';

// https://astro.build/config
export default defineConfig({
  site: 'https://ingtian.github.io',

  // ── EACH FAMILY OWNS ITS OWN VARIABLE (--ff-*), NOT --font-display/-body/-mono: those are the site's
  // type role tokens, and with the same names our stylesheet's declaration won on source order, naming a
  // family no @font-face matched, so no webfont rendered anywhere (0 of 24 FontFace entries loaded).
  //
  // `fallbacks` is per family: the default lands every family on sans-serif, the wrong shape for a display
  // serif and a mono during the swap or a failed load.
  //
  // ── LOCAL FILES, NOT GOOGLE: fetching at build time made every build depend on a third party, and a CI run
  // once failed with a 404 when Google rotated a file hash mid-run. The files (src/assets/fonts) are VARIABLE
  // fonts, one per style across the weight range, so `weight` is a range and Astro emits one @font-face per
  // style. In src/, not public/, which would ship them twice. The body face is the system UI stack, no webfont
  // (CLAUDE.md, Stack).
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
      // The range must reach the heaviest weight any mono rule asks for (the nav's current link, 600). A face
      // declared only to 500 makes every engine clamp to 500 and fake the bold on top, so the label shipped smeared
      // while the file itself runs wght 400-800. Same file either way, so widening it costs no bytes.
      options: {
        variants: [
          { weight: '400 600', style: 'normal', src: ['./src/assets/fonts/jetbrains-mono-latin-var.woff2'] },
        ],
      },
    },
  ],

  vite: {
    plugins: [tailwindcss()]
  },

  // ── MATH IN MARKDOWN, TYPESET AT BUILD TIME: remark-math parses the TeX, rehype-katex typesets it.
  // output: 'mathml' IS THE LOAD-BEARING OPTION: KaTeX's default HTML tree needs katex.min.css and
  // ~half a megabyte of KaTeX_* webfonts, a third family against the font rules. MathML ships static <math>
  // markup with zero client JS, CSS or fonts, the guarantee src/lib/equations.ts holds for .astro (and
  // tests/equations.test.ts asserts). katex is a devDependency and stays one: only its output ships.
  //
  // A TeX error does not fail the build by itself: rehype-katex always catches it and draws the source in
  // KaTeX's error markup. In a paper that is reported, and the paper page fails the build on it.
  //
  // The chain lives in src/lib/paperMarkdown/index.ts, so its spec runs exactly this. It adds the paper format
  // (remark-directive's syntax, parsed only in a paper, and the two paper plugins, inert on any other file) and the MathML
  // letter fix for every file. PAPER_DATA and the records go in as options so they are part of the config digest:
  // when a paper's number or its record changes, its cached render is thrown away rather than served stale.
  markdown: markdownPlugins(PAPER_DATA, publications),

  // NO UI-FRAMEWORK INTEGRATION: the site has no island (CLAUDE.md, Stack). If one is ever needed,
  // `npm i -D @astrojs/react react react-dom` and add it here: devDeps is a static build's tooling.
  integrations: [sitemap({
    // A /proto- route is an internal prototype: BaseLayout gives it noindex, and this keeps the
    // sitemap from advertising it to crawlers anyway.
    filter: (page) => !page.includes('/proto-'),
  }),
  // ── COMMENTS STAY IN SOURCE AND DO NOT SHIP, with no integration: in a .astro template `<!-- … -->` is
  // HTML and IS emitted, while `{/* … */}` is a JS expression comment the compiler discards, so every markup
  // comment is written in the second form. tests/distSmoke.test.ts asserts dist carries no HTML comment.
  ]
});