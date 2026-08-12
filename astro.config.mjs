// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

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

  // NO REACT. The terminal was the site's only island and it is deleted, so nothing renders a
  // component: no .tsx files, no client:* directives, no react imports remain. Keeping the integration
  // would ship the client runtime for nothing — the site is now entirely static HTML plus vanilla
  // scripts. If an island is ever needed again, re-add @astrojs/react here (it stays in devDeps).
  integrations: [sitemap({
    // Prototype routes carry noindex, but an unfiltered sitemap still advertises
    // them to crawlers — and their rendered bodies quote internal review notes.
    filter: (page) => !page.includes('/proto-'),
  })]
});