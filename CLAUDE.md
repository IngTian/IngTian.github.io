# ingtian.github.io — Claude Code Context

Personal website for Ing Tian (Zeying Tian) — quant researcher (portfolio
optimization / OR), incoming UofT Operations Research PhD (Fall 2027), currently
a Software Engineer at EA; ex-TikTok ML-systems engineer; McGill B.Eng. Live at
**https://ingtian.github.io**.

The concept is **"The Descent"**: a single-page vertical scroll *down* through
one continuous "Monet sky" gradient (luminous dawn paper → warm ochre → lavender
→ indigo dusk → grey ink → near-black ground). You don't navigate between
sections — you descend through the sky. Swiss-minimal structure carries the
weight; the gradient + the math-generative terrain hero + one editorial tagline
carry the soul. English-only text (no Chinese characters render — the literati
feel comes from restraint and composition, never from displayed glyphs; the lone
exceptions are deliberate math glyphs ∇/λ/μ in the terrain's rare Easter-egg
pill, rendered as build-time MathML).

## Stack & layout
- **Astro 6** (static output) + **React 19** (exactly ONE island) + **Tailwind v4**
  (`@tailwindcss/vite`, tokens via `@theme` in `src/styles/global.css`) + TS strict.
- `astro:fonts` self-hosts **Fraunces** (display, uses the SOFT axis), **Inter**
  (body), **JetBrains Mono** (terminal/labels). No CJK fonts.
- Deploys to GitHub Pages via `.github/workflows/deploy.yml` (`withastro/action`,
  **Node pinned to 22** in CI). `site: 'https://ingtian.github.io'`, no `base`
  (user site at root). Push to `main` → auto-deploy (~45s).

```
src/
  styles/{tokens.css, global.css}   # palette + fonts; the .descent gradient + atmosphere washes live in global.css
  layouts/BaseLayout.astro          # head, astro:fonts, meta/OG, <main class="descent">
  data/profile.ts                   # ALL content: name, roles, rolesSub, phd, bio, timeline (TimelineEntry has optional `sub`), publications, awards, links
  data/script.ts                    # terminal Q&A graph (typed; text lines support an optional `href`)
  lib/terrain.ts                    # pure terrain math (field/grad/runDescent/colormap/project) — unit-tested
  lib/equations.ts                  # build-time KaTeX→MathML for the terrain Easter-egg pill (katex is a devDependency, never shipped)
  sections/{Heights,Interlude,Mountains,Ground,Signature}.astro   # scroll order, ride over the gradient
  components/{Timeline,Publications,Awards,SealMark,Grain}.astro
  components/Toc.astro              # thin left-margin TOC — vanilla IntersectionObserver scrollspy, no React island
  components/TerrainHero.astro      # full-bleed hero canvas (the terrain) — vanilla <script>, no React island
  components/terminal/{Terminal.tsx (the React island), useTypewriter.ts, terminal.types.ts}
  pages/index.astro                 # composes sections inside <main class="descent">, + <Toc/> + <Grain/>
tests/{useTypewriter,terrain,equations}.test.ts   # vitest — 14 tests (reducer, terrain math, baked equations)
```

**"Exactly ONE React island" still holds — it's the terminal.** Toc and
TerrainHero need JS but are plain Astro components with bundled vanilla
`<script>` (not islands). Don't add a `client:*` directive to them.

Section order (= the descent): **Heights** (hero — de-centered: name bottom-left,
about-me bio top-right, math-generative terrain canvas full-bleed behind) →
**Interlude** (one tagline in the warm sky) → **Mountains** (Selected writing /
Experience / Recognition) → **Ground** (scripted terminal) → **Signature** (links
+ seal). A thin left-margin **Toc** fades in after the hero and tracks the active
section.

## Identity (as the user defined it — keep this voice)
- Hero: **"Quant Researcher · Portfolio Optimization"**, with a small mono subline
  **"Incoming PhD · University of Toronto · Software Engineer"** beneath. He is a
  quant/mathematician FIRST; software-engineering is secondary — do not re-promote
  it above the quant identity.
- **PhD is INCOMING (Fall 2027)** — Operations Research at UofT (MIE, under Prof.
  Roy H. Kwon). Never state it present-tense ("PhD student") — honesty rule.
- **Currently a Software Engineer at EA** (contracted via Hatch Innovations) — so
  he is NOT "ex SDE". Prior: Senior SWE at TikTok, independent quant researcher
  (RL-BHRP paper, arXiv:2508.11856).
- Tagline (his words, in the Interlude): **"A researcher by day, an artist by
  night, and a mathematician at heart."** ("by night" deliberately lands where the
  gradient turns to dusk.)
- He's an **OR quant in multi-period portfolio optimization**, a mathematician at
  heart, an artist (guqin + Chinese/English calligraphy) by avocation.

## The terminal (signature interactive piece)
A scripted, Claude-Code-style terminal in the Ground section — visitors click
suggested-question chips, answers type out with `●` tool-call lines + a smooth
typewriter reveal (~34ms/char, low jitter). **Fully scripted, no backend** (static
site). Content in `data/script.ts`; engine is a pure reducer in `useTypewriter.ts`
(unit-tested — keep tests green). The "fun" answer holds the **cow Easter egg**:
cows.ca lore + a plain hyperlink to "Jazz for Cows" (text lines carry an optional
`href`). A real-LLM version (Cloudflare Worker proxy) is a deferred future slice.

## Conventions / how to work here
- **Node:** default machine nvm is v20 which Astro 6 REJECTS. Always
  `source ~/.nvm/nvm.sh && nvm use 24` (`.nvmrc` pins 24) before npm/npx.
- **Branch hygiene:** never commit straight to `main`; cut `claude/<topic>`,
  open a PR, squash-merge. Commit messages end with the Co-Authored-By trailer.
- **Verify visually, not just by build.** Art/layout/animation must be SEEN. The
  proven loop this repo was built with: `npm run build` → `npm run preview` →
  drive headless Chrome over CDP (port 9222) → screenshot at scroll positions →
  look → refine. (Helper scripts were ad-hoc in /tmp; re-create as needed.)
- **Gates:** `npm run build` (tsc-checked) AND `npm test` (vitest — 14 tests)
  before commit; plus a browser smoke for anything visual. Lighthouse holds at
  **Perf ≥99 / A11y 100 / Best-practices 100 / SEO 100** (terrain hero measured
  100/100) — don't regress a11y (there's a `<main>` landmark; terminal has
  aria-live + real `<button>` chips; canvas/Toc/bubble are `aria-hidden`/labeled).
- **Palette discipline:** ONLY the tokens in `tokens.css` (paper, ink-1..5, ochre,
  indigo, seal). The vermilion **seal** (`--seal #b23a2e`) is the ONLY saturated
  color on the whole site. Never pure `#fff`/`#f00`.
- **Motion:** animate only `transform`/`opacity`; NEVER animate `filter: blur`
  (bake it). ALL motion gated behind `@media (prefers-reduced-motion: no-preference)`;
  the no-motion state must look finished (it's also the Firefox fallback, since
  `animation-timeline` isn't in Firefox yet).

## The hero art — SHIPPED (was the long-deferred "painting")
The descent originally wanted a Chinese ink-wash 山水 painting; two early attempts
(hand-drawn SVG, composited Song painting) were cut. The idea was **reinvented and
shipped** as the **math-generative terrain hero** (PR #5): a 3D dotted optimization
landscape (Gaussian-mixture loss field) rendered to a full-bleed hero `<canvas>`,
colored by height (ochre valleys → indigo peaks), breathing gently, with occasional
**gradient-descent "walkers"** flowing downhill into local minima as fading comet
trails — "The Descent" made literal. Rare Easter-egg pill at a settled optimum shows
typeset math (`∇f = 0`, the KKT condition) or "Moo!".
- Code: `components/TerrainHero.astro` (vanilla `<script>`) + pure math in
  `lib/terrain.ts` (unit-tested: gradient verified vs finite-difference, descent
  converges to true minima) + `lib/equations.ts` (build-time KaTeX→MathML).
- **Math is honest** — keep it that way (e.g. don't claim quadratic convergence for
  plain gradient descent; ∇f=0 is the unconstrained stationarity condition).
- Perf: rAF loop **paused offscreen** (IntersectionObserver) + ~30fps throttle +
  DPR≤2; a finished **static frame** is painted first (instant LCP) and is the
  reduced-motion / no-JS state. Measured Lighthouse **Perf 100 / A11y 100**.
- Built spike-first on a throwaway scratch page; full design/plan in the paper trail.

## Open follow-ups
- Optionally revise terminal "why quant?" / "what are you working on?" answers
  toward the OR/quant/math identity (they still lean ML-systems-flavored).
- Real-LLM terminal (Cloudflare Worker) — deferred slice.
- (CV link now works — `public/cv.pdf` is the current résumé, PR #7.)

## Paper trail (gitignored, local-only — between Ing and Claude)
Original "Descent" build: `docs/superpowers/specs/2026-06-17-the-descent-design.md`,
`docs/superpowers/plans/2026-06-17-the-descent.md`, closing notes (early painting
recipe + lessons) `docs/notes/2026-06-17-the-descent.md`.
Post-launch arc (all in `docs/superpowers/specs|plans/` and `docs/notes/`):
exemplar study, sub-project A (de-centered hero + about-me + UofT PhD), B (side
TOC), C terrain hero (spike → `2026-06-18-subproject-c-terrain-hero-design.md` +
`plans/2026-06-18-terrain-hero.md`). Brainstorm/visual-companion mockups in
`.superpowers/brainstorm/`.
