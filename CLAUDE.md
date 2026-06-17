# ingtian.github.io — Claude Code Context

Personal website for Ing Tian (Zeying Tian) — quant researcher (portfolio
optimization / OR), ex-TikTok ML-systems engineer, McGill. Live at
**https://ingtian.github.io**.

The concept is **"The Descent"**: a single-page vertical scroll *down* through
one continuous "Monet sky" gradient (luminous dawn paper → warm ochre → lavender
→ indigo dusk → grey ink → near-black ground). You don't navigate between
sections — you descend through the sky. Swiss-minimal structure carries the
weight; the gradient + one editorial tagline carry the soul. English-only text
(no Chinese characters render — the literati feel comes from restraint and
composition, never from displayed glyphs).

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
  styles/{tokens.css, global.css}   # palette + fonts; the .descent gradient lives in global.css
  layouts/BaseLayout.astro          # head, astro:fonts, meta/OG, <main class="descent">
  data/profile.ts                   # ALL content: name, roles, rolesSub, timeline, publications, awards, links
  data/script.ts                    # terminal Q&A graph (typed)
  sections/{Heights,Interlude,Mountains,Ground,Signature}.astro   # scroll order, ride over the gradient
  components/{Timeline,Publications,Awards,SealMark,Grain}.astro
  components/terminal/{Terminal.tsx (the island), useTypewriter.ts, terminal.types.ts}
  pages/index.astro                 # composes sections inside <main class="descent">
tests/useTypewriter.test.ts         # vitest — the reducer is the one unit-tested piece
```

Section order (= the descent): **Heights** (hero) → **Interlude** (one tagline in
the warm sky) → **Mountains** (Selected writing / Experience / Recognition) →
**Ground** (scripted terminal) → **Signature** (links + seal).

## Identity (as the user defined it — keep this voice)
- Hero role line: **"Quant Researcher · Portfolio Optimization"**, with a small,
  deprioritized **"Full-stack SDE"** beneath. He is a quant/mathematician FIRST;
  developer is secondary — do not re-promote it.
- Tagline (his words, in the Interlude): **"A researcher by day, an artist by
  night, and a mathematician at heart."** ("by night" deliberately lands where the
  gradient turns to dusk.)
- He's an **OR quant in multi-period portfolio optimization**, a mathematician at
  heart, an artist (guqin + Chinese/English calligraphy) by avocation.

## The terminal (signature interactive piece)
A scripted, Claude-Code-style terminal in the Ground section — visitors click
suggested-question chips, answers type out with `●` tool-call lines + a typewriter
reveal. **Fully scripted, no backend** (static site). Content in `data/script.ts`;
engine is a pure reducer in `useTypewriter.ts` (unit-tested — keep tests green).
A real-LLM version (Cloudflare Worker proxy) is a deferred future slice.
NOTE: the "why quant?" / "what are you working on?" answers still lean
ML-systems-flavored; could be revised toward the OR/math identity.

## Conventions / how to work here
- **Node:** default machine nvm is v20 which Astro 6 REJECTS. Always
  `source ~/.nvm/nvm.sh && nvm use 24` (`.nvmrc` pins 24) before npm/npx.
- **Branch hygiene:** never commit straight to `main`; cut `claude/<topic>`,
  open a PR, squash-merge. Commit messages end with the Co-Authored-By trailer.
- **Verify visually, not just by build.** Art/layout/animation must be SEEN. The
  proven loop this repo was built with: `npm run build` → `npm run preview` →
  drive headless Chrome over CDP (port 9222) → screenshot at scroll positions →
  look → refine. (Helper scripts were ad-hoc in /tmp; re-create as needed.)
- **Gates:** `npm run build` (tsc-checked) AND `npm test` (vitest) before commit;
  plus a browser smoke for anything visual. Lighthouse target met at launch:
  **Perf 99 / A11y 100 / Best-practices 100 / SEO 100** — don't regress a11y
  (there's a `<main>` landmark; terminal has aria-live + real `<button>` chips).
- **Palette discipline:** ONLY the tokens in `tokens.css` (paper, ink-1..5, ochre,
  indigo, seal). The vermilion **seal** (`--seal #b23a2e`) is the ONLY saturated
  color on the whole site. Never pure `#fff`/`#f00`.
- **Motion:** animate only `transform`/`opacity`; NEVER animate `filter: blur`
  (bake it). ALL motion gated behind `@media (prefers-reduced-motion: no-preference)`;
  the no-motion state must look finished (it's also the Firefox fallback, since
  `animation-timeline` isn't in Firefox yet).

## The painting — DEFERRED (important lesson)
The original design wanted a Chinese ink-wash 山水 painting in the descent. Two
attempts were cut:
1. **Hand-drawn SVG** (clouds/cows/buffalo) — looked like glowing blobs and
   turtles. Two diagnosed bugs to AVOID next time: ink must be **subtractive**
   (`mix-blend-mode: multiply` / Beer–Lambert), not additive glow; and
   `feDisplacementMap scale` must be **≤8** for edge-roughening (≥13 melts shapes).
2. **Real public-domain Song painting composited in** (Fan Kuan, *Travelers Among
   Mountains and Streams*, via Wikimedia) — read as authentic ink but sat
   awkwardly; deferred for iterative polish.
The recipe + source URLs + bug diagnosis are in `docs/notes/2026-06-17-the-descent.md`.
Best long-term: Ing's OWN scanned brushwork / a real carved seal.

## Open follow-ups
- **CV:** the "Download CV" link points to `/cv.pdf` — drop the file in with
  `cp <resume>.pdf public/cv.pdf` and commit (Astro copies `public/` verbatim).
  Until then that link 404s.
- Revisit the ink painting (see above).
- Optionally revise terminal answers toward the OR/quant/math identity.
- Real-LLM terminal (Cloudflare Worker) — deferred slice.

## Paper trail (gitignored, local-only — between Ing and Claude)
- Spec: `docs/superpowers/specs/2026-06-17-the-descent-design.md`
- Plan: `docs/superpowers/plans/2026-06-17-the-descent.md`
- Closing notes (with the painting recipe + lessons): `docs/notes/2026-06-17-the-descent.md`
- Brainstorm mockups: `.superpowers/brainstorm/` (the visual-companion HTML).
