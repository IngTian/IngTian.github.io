// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  // User site served at the root domain — no `base` needed (that's for project sites).
  site: 'https://ingtian.github.io',

  vite: {
    plugins: [tailwindcss()]
  },

  integrations: [react()]
});