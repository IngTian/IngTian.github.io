// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://ingtian.github.io',

  // Weights/styles are pruned to exactly what the site uses (audited against the
  // codebase) — fewer @font-face faces, and dropping mono italic removes a whole
  // woff2. Fraunces: 400/500/600 normal+italic. Inter: 400/500 normal+italic
  // (italic = venue/timeline lines). Mono: 400/500 normal only (never italic).
  //
  // ── EACH FAMILY OWNS ITS OWN VARIABLE (--ff-*), AND NOT --font-display/-body/-mono.
  // Those three names are the site's TYPE ROLE tokens, declared in the stylesheet, and pointing
  // astro:fonts at the same names was a silent, total failure: astro:fonts writes
  // `--font-display: "Fraunces-2d723b2dd3e1ca4b", …` into an inline <style> in the head, then our
  // bundled sheet re-declared `--font-display: 'Fraunces', Georgia, serif` further down and won on
  // source order — and the unhashed name "Fraunces" matches no @font-face rule anywhere. So the
  // whole site rendered in Georgia / system-ui / Menlo while every woff2 still downloaded and
  // painted nothing. Measured before the fix, on the live site as well as locally: 0 of 24
  // FontFace entries loaded, and getPlatformFontsForNode reported Georgia on the h1, .SF NS on
  // body copy and Menlo on the mono, all isCustomFont: false.
  //
  // With distinct names there is nothing to collide: astro:fonts owns --ff-*, the stylesheet builds
  // the role tokens out of them, and neither can clobber the other.
  //
  // `fallbacks` is per family, because the default lands every family on sans-serif — which for the
  // display serif and the mono is the wrong shape to fall back to, and is what a reader saw during
  // the swap and would see again if a woff2 ever failed.
  fonts: [
    {
      provider: fontProviders.google(), name: 'Fraunces', cssVariable: '--ff-fraunces',
      weights: [400, 500, 600], styles: ['normal', 'italic'],
      fallbacks: ['Georgia', 'Times New Roman', 'serif'],
    },
    {
      provider: fontProviders.google(), name: 'Inter', cssVariable: '--ff-inter',
      weights: [400, 500], styles: ['normal', 'italic'],
      fallbacks: ['system-ui', 'Helvetica Neue', 'sans-serif'],
    },
    {
      provider: fontProviders.google(), name: 'JetBrains Mono', cssVariable: '--ff-jetbrains',
      weights: [400, 500], styles: ['normal'],
      fallbacks: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
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