// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://ingtian.github.io',

  // Weights/styles are pruned to exactly what the site uses (audited against the
  // codebase) — fewer @font-face faces, and dropping mono italic removes a whole
  // woff2. Fraunces: 400/500/600 normal+italic. Inter: 400/500 normal+italic
  // (italic = venue/timeline lines). Mono: 400/500 normal only (never italic).
  fonts: [
    { provider: fontProviders.google(), name: 'Fraunces', cssVariable: '--font-display', weights: [400, 500, 600], styles: ['normal', 'italic'] },
    { provider: fontProviders.google(), name: 'Inter', cssVariable: '--font-body', weights: [400, 500], styles: ['normal', 'italic'] },
    { provider: fontProviders.google(), name: 'JetBrains Mono', cssVariable: '--font-mono', weights: [400, 500], styles: ['normal'] },
  ],

  vite: {
    plugins: [tailwindcss()]
  },

  integrations: [react(), sitemap()]
});