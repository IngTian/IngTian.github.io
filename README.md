# ingtian.github.io

Personal site for **Ing Tian (Zeying Tian)** — quant researcher in portfolio
optimization, incoming Operations Research PhD at the University of Toronto,
software engineer. Live at **https://ingtian.github.io**.

The site is a single-page vertical scroll — *"The Descent"* — down one
continuous "Monet sky" gradient (luminous dawn paper → warm ochre → indigo dusk
→ near-black ground). A separate **/art** page is a quiet museum room for
calligraphy and photography.

## Stack

- **[Astro 6](https://astro.build)** (static output) + **React 19** (one island
  — the terminal) + **[Tailwind v4](https://tailwindcss.com)** (`@theme` tokens
  in `src/styles/global.css`) + TypeScript (strict).
- `astro:fonts` self-hosts Fraunces (display), Inter (body), JetBrains Mono
  (mono).
- `astro:assets` optimizes the gallery images (webp/avif, responsive `widths`).
- Deploys to GitHub Pages on push to `main` via `.github/workflows/deploy.yml`
  (Node pinned to 22 in CI; `.nvmrc` pins 24 locally).

## Local development

> **Node:** Astro 6 requires Node ≥ 22. If you use nvm, run `nvm use` first
> (`.nvmrc` pins 24); the default Node 20 is rejected.

```sh
nvm use            # Node 24 (see .nvmrc)
npm install
npm run dev        # dev server at http://localhost:4321
```

| Command           | Action                                            |
| :---------------- | :------------------------------------------------ |
| `npm run dev`     | Dev server with HMR                               |
| `npm run build`   | Type-checked production build to `./dist/`        |
| `npm run preview` | Serve the built `./dist/` locally                 |
| `npm test`        | Run the Vitest unit suite                         |
| `npm run test:watch` | Vitest in watch mode                           |

**Before committing:** `npm run build` (tsc-checked) **and** `npm test` must
pass; anything visual also gets an eyeball in the browser.

## Project layout

```
src/
  pages/            index.astro (the descent) · art.astro (the gallery) — routes
  layouts/          BaseLayout.astro — <head>, fonts, meta/OG, the page-load veil
  sections/         Heights · Interlude · Mountains · Ground · Signature (scroll order)
  components/       Timeline · Publications · Awards · SealMark · Grain · Toc
                    TerrainHero.astro (hero canvas) · SkyWash.astro (woven sky)
                    terminal/ — the single React island (Terminal.tsx + reducer)
  data/             ALL content lives here (see "Updating content" below)
  lib/              pure, unit-tested logic: terrain math, justified-rows packing,
                    scrollspy, equations (build-time KaTeX→MathML), motion guard
  styles/           tokens.css (palette + fonts) · global.css (the descent gradient)
  assets/art/       gallery source images (optimized at build time)
tests/              Vitest specs mirroring src/lib + the terminal reducer
public/             static passthrough — cv.pdf, favicon, robots.txt
```

**Content is fully separated from code** — every component reads from
`src/data/`, so updating the site never means touching rendering logic.

## Updating content

To refresh the résumé, swap a photo, or edit the terminal — edit one data file:

| What                    | File                       | Notes |
| :---------------------- | :------------------------- | :---- |
| Résumé / bio / timeline / publications / awards / links | `src/data/profile.ts` | Plain typed objects; `tsc` validates the shape on build. From a new résumé PDF, regenerate the values here. |
| Calligraphy works       | `src/data/artworks.ts` + images in `src/assets/art/` | |
| Photographs             | drop files in `src/assets/art/photos/` (auto-globbed, sorted by filename) | Per-photo title/note/alt in `src/data/photoNotes.ts`, keyed by filename; missing entries fall back to a generic label. |
| Terminal Q&A            | `src/data/script.ts`       | Typed question→answer graph. |
| Palette / fonts         | `src/styles/tokens.css`    | The only colors on the site. |

## Conventions

- **Palette discipline** — only the tokens in `tokens.css` (paper, ink-1…5,
  ochre, indigo, seal). The vermilion seal is the one saturated accent; never
  pure `#fff`/`#f00`.
- **Motion** — animate only `transform`/`opacity` (never `filter: blur` — bake
  it). All motion is gated behind `@media (prefers-reduced-motion: no-preference)`
  via `lib/motion.ts`; the no-motion state must look finished (it's also the
  Firefox fallback for scroll-timeline animations).
- **One React island** — the terminal. `TerrainHero` and `Toc` need JS but ship
  as plain Astro components with bundled vanilla `<script>`s (no `client:*`).
- **Pure logic is tested** — anything non-trivial in `lib/` has a Vitest spec.

## License

Source code is available for reference. Written content, the résumé, the
calligraphy, and the photographs are © Zeying Tian — not licensed for reuse.
