# ingtian.github.io — engineering & design guide

A personal portfolio for **Ing Tian (Zeying Tian)**. Live at
**https://ingtian.github.io**. This file is the working agreement for anyone —
human or AI — building on the site: how it's put together, the taste it holds
to, and the rules that keep it coherent.

## The concept — "The Descent"

A single-page vertical scroll *down* through one continuous "Monet sky" gradient
(luminous dawn paper → warm ochre → lavender → indigo dusk → grey ink →
near-black ground). You don't navigate between sections — you descend through the
sky. Swiss-minimal structure carries the weight; the gradient, the
math-generative terrain hero, and one editorial tagline carry the soul.

A second route, **/art**, is a quiet museum room for calligraphy and photography.

**Restraint is the aesthetic.** Text is English-only — the literati feel comes
from composition and negative space, never from displayed CJK glyphs. The lone
exceptions are deliberate math glyphs (∇/λ/μ) in the terrain's rare Easter-egg
pill, rendered as build-time MathML. When in doubt, remove rather than add.

## Stack

- **Astro 6** (static output) + **React 19** (exactly ONE island — the terminal)
  + **Tailwind v4** (`@tailwindcss/vite`; tokens via `@theme` in
  `src/styles/global.css`) + TypeScript (strict).
- `astro:fonts` self-hosts **Fraunces** (display, uses the SOFT axis), **Inter**
  (body), **JetBrains Mono** (mono/terminal). No CJK fonts.
- `astro:assets` optimizes gallery images (responsive `widths`, webp/avif).
- `site: 'https://ingtian.github.io'`, no `base` (user site at root).

## Layout

```
src/
  styles/{tokens.css, global.css}   # palette + fonts; the .descent gradient + atmosphere washes live in global.css
  layouts/BaseLayout.astro          # head, astro:fonts, meta/OG, favicons, the page-load veil, <main class="descent">
  data/profile.ts                   # ALL résumé content: name, roles, rolesSub, phd, bio, timeline, publications, awards, links
  data/script.ts                    # terminal Q&A graph (typed; text lines support an optional `href`)
  data/artworks.ts                  # gallery: calligraphy entries + globbed photos (+ photoNotes.ts for per-photo copy)
  lib/terrain.ts                    # pure terrain math (field/grad/runDescent/colormap/project) — unit-tested
  lib/justify.ts                    # pure justified-rows packing for the photo grid — unit-tested
  lib/scrollspy.ts                  # pure active-stop logic shared by the TOC + the /art rail — unit-tested
  lib/motion.ts                     # prefersReducedMotion() — the one source of truth for the motion gate
  lib/equations.ts                  # build-time KaTeX→MathML for the terrain pill (katex is a devDependency, never shipped)
  sections/{Heights,Interlude,Mountains,Ground,Signature}.astro   # scroll order, ride over the gradient
  components/{Timeline,Publications,Awards,SealMark,Grain}.astro
  components/Toc.astro              # thin left-margin TOC — vanilla IntersectionObserver scrollspy, no React island
  components/TerrainHero.astro      # full-bleed hero canvas (the terrain) — vanilla <script>, no React island
  components/SkyWash.astro          # woven warm/cold broken-color wash over the gradient — pure CSS
  components/terminal/{Terminal.tsx (the React island), useTypewriter.ts, terminal.types.ts}
  scripts/artGallery.ts             # the /art page behavior (justified rows, placard, scrollspy, lightbox)
  pages/{index.astro, art.astro}    # routes
tests/*.test.ts                     # vitest — reducer, terrain math, justify, scrollspy, baked equations
```

Section order (= the descent): **Heights** (hero — de-centered: name
bottom-left, about-me bio top-right, math-generative terrain canvas full-bleed
behind) → **Interlude** (one tagline in the warm sky) → **Mountains** (Selected
writing / Experience / Recognition) → **Ground** (scripted terminal) →
**Signature** (links + seal). A thin left-margin **Toc** fades in after the hero
and tracks the active section.

**"Exactly ONE React island" is a constraint, not an accident — it's the
terminal.** `Toc`, `TerrainHero`, and the gallery need JS but ship as plain
Astro components with bundled vanilla `<script>` (not islands). Don't add a
`client:*` directive to them. Vanilla scripts that must survive View Transitions
re-init on `astro:page-load` with a teardown (see `TerrainHero`, `Toc`,
`artGallery.ts`).

## Identity & voice (a design constraint)

The hierarchy is deliberate and load-bearing for how the site reads. Keep it:

- **Quant / mathematician first.** Hero headline: **"Quant Researcher · Portfolio
  Optimization"**, with a small mono subline (incoming PhD · University of
  Toronto · the engineering role) beneath. Software engineering is the *second*
  hat — when it's named, it's a **full-stack SDE/MLE** (more than "a developer"),
  but it never gets promoted above the quant identity.
- **The PhD is incoming** (Operations Research, University of Toronto). State it
  as incoming — never present-tense "PhD student." Honesty over flourish,
  everywhere on the site.
- **Tagline** (the Interlude): *"A researcher by day, an artist by night, and a
  mathematician at heart."* "by night" deliberately lands where the gradient
  turns to dusk.
- The art avocation (guqin + Chinese/English calligraphy) is real and shown on
  /art, but stays an avocation in the framing.

All résumé content lives in `src/data/profile.ts` — editing the site's facts
means editing data, never components. A new résumé becomes a `profile.ts` edit.

## The terminal (signature interactive piece)

A scripted, Claude-Code-style terminal in the Ground section: visitors click
suggested-question chips, answers type out with `●` tool-call lines and a smooth
typewriter reveal (~34ms/char, low jitter). **Fully scripted, no backend.**
Content in `data/script.ts`; the engine is a pure reducer in `useTypewriter.ts`
(unit-tested — keep it green). Text lines carry an optional `href`. A real-LLM
version (e.g. a Cloudflare Worker proxy) is a possible future slice.

## The hero — math-generative terrain

A 3D dotted optimization landscape (Gaussian-mixture loss field) rendered to a
full-bleed hero `<canvas>`, colored by height (ochre valleys → indigo peaks),
breathing gently, with occasional gradient-descent "walkers" flowing downhill
into local minima as fading comet trails — "The Descent" made literal. A rare
Easter-egg pill at a settled optimum shows typeset math (∇f = 0, the KKT
condition) or "Moo!".

- Code: `components/TerrainHero.astro` (vanilla `<script>`) + pure, unit-tested
  math in `lib/terrain.ts` (gradient verified vs finite-difference; descent
  converges to true minima) + `lib/equations.ts` (build-time KaTeX→MathML).
- **The math must stay honest.** Don't claim quadratic convergence for plain
  gradient descent; ∇f=0 is the unconstrained stationarity condition. Misstated
  math undercuts the whole point of the piece.
- Perf: rAF loop paused offscreen (IntersectionObserver) + ~30fps throttle +
  DPR≤2; a finished static frame is painted first (instant LCP) and is the
  reduced-motion / no-JS state.

## Conventions

- **Node:** Astro 6 rejects Node 20. Use `nvm use` (`.nvmrc` pins 24) before any
  npm/npx. CI and the deploy action read the same version.
- **Branch hygiene:** never commit to `main`. Cut `claude/<topic>`, open a PR,
  squash-merge. Commit messages end with the Co-Authored-By trailer.
- **CI is the merge gate.** `.github/workflows/ci.yml` runs build + test on every
  PR. **Wait for CI to go green before merging** — don't squash-merge a PR with a
  pending or failing check, even when local gates passed. Deploy
  (`deploy.yml`) runs only after merge to `main` (push → live in ~45s).
- **Local gates before commit:** `npm run build` (tsc-checked) AND `npm test`
  (vitest). Anything visual also gets a browser smoke — see below.
- **Verify visually, not just by build.** Art/layout/animation must be SEEN. The
  loop: `npm run build` → `npm run preview` → drive headless Chrome over CDP
  (port 9222) → screenshot at scroll positions → look → refine. For faint issues,
  contrast-stretch the screenshot or toggle layers off and diff — single-column
  pixel math misleads. Helper scripts are ad-hoc in `/tmp`; recreate as needed.
- **Lighthouse bar:** Perf ≥99 / A11y 100 / Best-practices 100 / SEO 100. Don't
  regress a11y: there's a `<main>` landmark; the terminal has aria-live + real
  `<button>` chips; decorative canvas/Toc/bubble are `aria-hidden` or labeled.
- **Pure logic is tested.** Anything non-trivial in `lib/` gets a vitest spec.
  Keep them green — they're the only automated safety net.

## Taste rules (these define the look — hold the line)

- **Palette discipline:** ONLY the tokens in `tokens.css` (paper, ink-1..5,
  ochre, indigo, seal). The vermilion **seal** (`--seal #b23a2e`) is the ONLY
  saturated color on the whole site. Never pure `#fff` / `#f00`.
- **Motion:** animate only `transform` / `opacity`; NEVER animate `filter: blur`
  (bake it). ALL motion is gated behind `@media (prefers-reduced-motion:
  no-preference)` via `lib/motion.ts`. The no-motion state must look *finished* —
  it's also the Firefox fallback (`animation-timeline` isn't in Firefox yet).
- **Loading states are designed, not default.** No bare grey rectangles — a
  loading tile uses a palette-tone placeholder with a transform-only shimmer (see
  `.tile` in `art.astro`), gone the instant the image decodes.
- **Favicons:** the browser tab uses the SVG seal; Google Search renders a
  *raster* favicon, so PNG fallbacks (48/32/180/192/512) + a webmanifest +
  `og:image` ship from `public/`. Regenerate them from `favicon.svg` if the seal
  changes (sharp rasterizes SVG→PNG; it's already a dep).
