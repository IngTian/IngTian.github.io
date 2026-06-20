// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://ingtian.github.io',

  fonts: [
    { provider: fontProviders.google(), name: 'Fraunces', cssVariable: '--font-display', weights: [300, 400, 500, 600], styles: ['normal', 'italic'] },
    { provider: fontProviders.google(), name: 'Inter', cssVariable: '--font-body', weights: [300, 400, 500] },
    { provider: fontProviders.google(), name: 'JetBrains Mono', cssVariable: '--font-mono', weights: [400, 500] },
  ],

  vite: {
    plugins: [tailwindcss()]
  },

  integrations: [react(), sitemap()]
});