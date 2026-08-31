# ingtian.github.io — engineering & design guide

A personal portfolio for **Ing Tian (Zeying Tian)**. Live at
**https://ingtian.github.io**. This file is the working agreement for anyone —
human or AI — building on the site: how it's put together, the taste it holds
to, and the rules that keep it coherent.

**This file is load-bearing, so it has to be true.** It was wrong for a while —
it documented a React island, a terminal and a data file that had all been
deleted, and said nothing about the deck, the phone gate or the writing
collection, which is most of what a change now touches. An agent reading a stale
guide edits the files the guide names and not the ones that exist. If you change
something this file describes, change this file in the same commit; if you find a
claim here that the code contradicts, **the code is the truth** — fix the line.

## The concept — "The Descent"

A vertical scroll *down* through one continuous "Monet sky" (luminous dawn paper
→ warm ochre → lavender → indigo dusk → grey ink → near-black ground). You don't
navigate between sections — you descend through the sky. Swiss-minimal structure
carries the weight; the sky, the math-generative terrain hero, and one editorial
tagline carry the soul.

The homepage is the descent. Around it are the **reading pages** — /research,
/writing, /writing/&lt;slug&gt;, /projects, /experience — and **/art**, a quiet museum
room for calligraphy and photography. Every route rides the same sky, and the
reading pages deliberately share one margin, one measure and one back-link
treatment: pages that each guessed their own layout would read as several sites.
Borrow composition from the neighbouring page rather than inventing it.

**Restraint is the aesthetic.** Text is English-only — the literati feel comes
from composition and negative space, never from displayed CJK glyphs. The lone
exceptions are deliberate math glyphs (∇/λ/μ), rendered as build-time MathML.
When in doubt, remove rather than add.

## Stack

- **Astro 6** (static output) + **Tailwind v4** (`@tailwindcss/vite`; tokens via
  `@theme` in `src/styles/global.css`) + TypeScript (strict). Sitemap via
  `@astrojs/sitemap`.
- **NO REACT, AND NO CLIENT FRAMEWORK AT ALL.** This is the single most important
  correction to make to your instincts if you have read an older version of this
  file. The terminal was the site's one island and it is **deleted**; with it went
  `@astrojs/react`, `react`, `react-dom` and both `@types` packages (they had been
  sitting in `dependencies`, reinstalling ~8MB on every `npm ci` for a runtime no
  page loaded). Today: `find src tests -name '*.tsx'` → 0, `grep -rn 'client:' src`
  → 0, and `astro.config.mjs` has no `integrations` entry for a UI framework.
  **Do not add an island.** Everything interactive here is a plain `.astro`
  component with a bundled vanilla `<script>` — see *Interactivity* below. If an
  island ever becomes genuinely necessary, it is `npm i -D @astrojs/react …` (dev
  deps: it's a static build's tooling) plus a deliberate decision recorded here.
- **`three` is a real dependency, and it ships nowhere a visitor goes.** It is
  imported once, in `lib/fanScene.ts`, behind a *dynamic* `import()` in
  `FactorFan.astro` — and `FactorFan` is rendered only by `/proto-showpiece`. So
  it code-splits into its own 483KB chunk that no content route references
  (`grep -c fanScene dist/index.html` → 0). Keep it that way: nothing on a shipped
  page should pull it in statically.
- **Type: four roles, TWO downloaded faces.** `--font-display` is **Georgia** and
  `--font-body` is the **system UI stack** — neither downloads anything.
  `--font-mono` is **JetBrains Mono** and `--font-accent` is **Fraunces**, used
  only on sub-headlines and italic editorial lines. No CJK fonts.
  - Georgia and system-ui are deliberate, not leftovers. A long-standing bug meant
    no webfont had EVER rendered, so the whole design was judged in Georgia + SF;
    when Fraunces finally appeared the owner rejected it on sight ("prod's font is
    better, the current font is kind of weird"). Both role faces are therefore what
    the site has always actually looked like. Keep Georgia for structure.
  - **The two webfonts are LOCAL files** in `src/assets/fonts/`, served through
    `fontProviders.local()`. Do not go back to `fontProviders.google()`: fetching at
    build time made every build depend on Google, and it failed a CI run with a 404
    when they rotated a file hash mid-run — the same failure on a push to `main`
    would silently leave the site stale. Variable fonts, one file per style, with
    `weight` declared as a range. Provider config goes under `options.variants`, not
    at the top level (the schema is strict).
  - They live under their own `--ff-*` variables. Never point `cssVariable` at
    `--font-display`/`-body`/`-mono`: those are the site's role tokens, and that
    collision is what stopped every webfont from loading. Fraunces keeps its
    preload — removing it measured a worse FCP (1956 → 2333ms; see BaseLayout).
- **Math in markdown is typeset at build time.** `astro.config.mjs` wires
  `remark-math` + `rehype-katex` with **`output: 'mathml'`**, which is the
  load-bearing option: KaTeX's default HTML tree needs `katex.min.css` and ~half a
  megabyte of `KaTeX_*` webfonts, and a third downloaded family is against the font
  rules above. MathML ships as static `<math>` markup — zero client JS, zero CSS,
  zero fonts. `katex` is a **devDependency** and stays one; only its output ships.
  `lib/equations.ts` holds the same guarantee for build-time equations in `.astro`,
  and `tests/equations.test.ts` asserts it.
- `astro:assets` optimizes gallery images (responsive `widths`, webp/avif).
- `site: 'https://ingtian.github.io'`, no `base` (user site at root).

## Layout

The load-bearing files and what each owns. **Not exhaustive** — `src/lib` in
particular holds a module per piece of real math, and those come and go with the
slides they serve; `ls` beats this list for a full inventory. What is listed here
is what a change is likely to need, and what must not be confused for something
else.

```
src/
  styles/{tokens.css, global.css}   # palette + type roles; the .descent gradient, atmosphere washes and the .is-slides slide metrics live in global.css
  layouts/BaseLayout.astro          # head, astro:fonts, meta/OG/JSON-LD, favicons, the page-load veil, CornerNav, ClientRouter
  content.config.ts                 # the `writing` collection + its frontmatter schema (the ONLY content collection)
  content/writing/*.md              # the pieces themselves — a new one is a FILE, not a code change
  data/profile.ts                   # ALL résumé content: name, roles, rolesSub, phd, bio, timeline, publications, projects, awards, links
  data/nav.ts                       # PAGES — the canonical page set (see Navigation)
  data/writing.ts                   # the writing TAXONOMY (KINDS) + buildKinds(), the one seam to the markdown
  data/artworks.ts                  # gallery: calligraphy entries + globbed photos (+ photoNotes.ts for per-photo copy)
  data/{define,desk,making,story}.ts                       # the homepage explainer's copy + numbers, per slide
  data/{cowGlyph,ruleGlyphs,tickerGlyphs,signalWeights}.ts # pixel-art matrices and weights the slides draw from
  lib/deck.ts                       # pure deck stops: WHERE the homepage scroll may rest, and what's next — unit-tested
  lib/pageStops.ts                  # pure Stop trees: one tree per page drives BOTH its rail and its section ids — unit-tested
  lib/viewport.ts                   # PHONE_MAX_WIDTH = 640 + isPhone() — the one phone gate
  lib/motion.ts                     # prefersReducedMotion() — the one motion gate
  lib/skyShader.ts, skyPalette.ts, skyLegibility.ts   # the fluid sky: GLSL, ramps, and the text-contrast policy
  lib/terrain.ts, terrainRender.ts  # pure terrain math (field/grad/runDescent/colormap/project) + its painter
  lib/descentPath.ts, trajectory.ts # the career descent graph's field and route
  lib/{bellman,factorModel,problemSize,complexity,policyPnl,scenario,split}.ts   # the explainer slides' real math
  lib/{justify,scrollspy,pixels,cowSpeech,knowledge,capability,paperMath,equations,signalRubric}.ts
  sections/{Heights,Interlude,Choice,Rules,Solve,Story,Work}.astro   # the homepage, in scroll order
  sections/Signature.astro          # links + seal — rendered INSIDE Work.astro, not as its own slide
  sections/Mountains.astro          # PARKED: the old résumé section, off the homepage; only /proto-paper still renders it
  components/Deck.astro             # the deck's event plumbing (homepage only)
  components/proto/FluidSky.astro   # the WebGL sky canvas — on every page despite the proto/ path
  components/SkyWash.astro          # woven warm/cold broken-color wash over the sky — pure CSS
  components/TerrainHero.astro      # the hero's terrain canvas (Heights only)
  components/DescentPath.astro      # the career descent graph (inside Story)
  components/SideRail.astro         # the reading pages' marginal rail, driven by a Stop tree
  components/Toc.astro              # the homepage's thin left-margin TOC, driven by homeStops()
  components/CornerNav.astro        # the always-visible glass nav + theme toggle
  components/PlushCow.astro         # the cow, at three scales, with a pixel speech bubble
  components/{SealMark,Grain,ProjectCard,FactorFan}.astro
  scripts/artGallery.ts             # the /art page behavior (justified rows, placard, scrollspy, lightbox)
tests/*.test.ts                     # vitest — every pure lib module, the data/route invariants, the content seam
```

### Routes

Twelve pages, not two:

| Route | What it is |
| --- | --- |
| `/` | the descent — the homepage deck |
| `/research` | papers, in full: the idea, the method's equations, results |
| `/writing` | the writing shelf — kinds, each listing its markdown pieces |
| `/writing/<slug>` | one piece, rendered from `src/content/writing/<slug>.md` |
| `/projects` | shipped artifacts with links |
| `/experience` | the timeline — education and roles |
| `/art` | calligraphy + photography |
| `/404` | the not-found page (noindex, no canonical) |
| `/proto-showpiece`, `/proto-sketches`, `/proto-ladder`, `/proto-paper` | **prototypes** |

**The prototype routes are internal.** They exist so a visual choice can be made
by looking at the real thing in the real page rather than at a screenshot (see the
project's own habit: put the options in the page as a switcher). They must carry
`noindex={true}` on `BaseLayout` **and** stay out of the sitemap — `astro.config.mjs`
filters `/proto-` from the sitemap already, and there is a test asserting the
noindex. Their rendered bodies quote internal review notes, so an indexed one is a
real leak, not an untidiness.

### Interactivity — vanilla scripts, and the contract they keep

`Deck`, `Toc`, `SideRail`, `TerrainHero`, `FluidSky`, `DescentPath`, `FactorFan`
and the gallery all need JS. Every one of them is a plain Astro component with a
bundled `<script>`, **not** an island (see *Stack*). The shared contract:

- **Re-init on `astro:page-load`, with a teardown**, because `ClientRouter` is on
  and a View Transition replaces the DOM without a fresh page load. A script that
  only runs at parse time works on first load and is dead after the first
  navigation.
- **Pure logic goes in `lib/`, plumbing stays in the component.** That split is
  why `deck.ts`, `pageStops.ts`, `terrain.ts`, `justify.ts` and `scrollspy.ts`
  have specs at all — the parts worth testing are not tangled in event handlers.
- **Both gates are asked, not re-derived**: `prefersReducedMotion()` from
  `lib/motion.ts`, `isPhone()` from `lib/viewport.ts`.

## The homepage — the deck

Section order (= the descent), all seven top-level `<section>`s of `main.is-slides`:

**Heights** (hero — de-centered: name bottom-left, bio top-right, terrain canvas
full-bleed behind) → **Interlude** (the tagline in the warm sky) → **Choice** →
**Rules** → **Solve** (the three-slide explainer) → **Story** (the editorial, with
the descent graph in a sticky column beside it) → **Work** (the appendix: papers,
writing, projects — with **Signature**, links + seal, inside it).

**What I do comes before how I got here**, on the owner's observation: "the
descent answered my trajectory, but didn't answer what I do. Normally people think
about what do I do first, then my trajectory." The explainer earns the graph.

The three explainer slides are **real math, not drawings** — that rule survived
five rejected showpieces, every one of which "looked like it meant something
without meaning anything":

1. **Choice** — what the decision *is*. One object, a hundred dollars in a bar,
   divided three ways and re-priced after one piece of news, then re-divided month
   after month. The object never changes; only what is being said about it does,
   which is what keeps it one slide. It also has to *define* the words: an earlier
   version opened with "every month, decide how much of each to own", which assumes
   the concept — grepping the built page confirmed nothing anywhere said what a
   portfolio was.
2. **Rules** — how hard it actually is, in four beats: you run $1bn+ and your
   slippage is now measurable; here are the constraints; here are the thousands of
   futures they have to hold in; now do all of it at once. Impact is square-root,
   calibrated to a published anchor; the trajectory fan is a *seeded* walk, because
   a fan that shimmered between builds would undercut a slide whose whole claim is
   that the scale is real.
3. **Solve** — the method as the algorithm running: a real finite-horizon Bellman
   lattice filled in backward from the horizon, then the optimal route traced
   forward past the candidates it beat.

**The register of the second slide is "bigger", not "smaller", and that is a
design rule.** Two earlier drawings lived in Rules — a convex feasible polygon and
a lattice of decision sequences, both exact and unit-tested — and both were pulled:
they answer "what is the feasible set", a question a reader who has never been told
no does not yet have, and both *shrink* something, which reads as tidying up. The
point is the opposite: the problem gets bigger the closer you look.

The numbers in the prose are **computed at build time from the same data the
picture draws**, so the words and the drawing cannot drift — including the detail
that a sentence quoting a figure must quote the same row the chart highlights (an
early draft said "a billion dollars" while quoting the $10bn row's numbers). Don't
hand-type a number a module can compute.

**The résumé is not on the homepage**, on the owner's instruction ("you may delete
everything from below. The record, the experience, everything"). Nothing was lost:
every block has its own route, and the corner nav plus the footer carry the doors.
`sections/Mountains.astro` is kept on purpose — off the homepage, still rendered by
/proto-paper — so the markup is recoverable without git archaeology.

### THE DECK — one gesture, one slide

`components/Deck.astro` (plumbing) + `lib/deck.ts` (pure stops, unit-tested).
The brief: *"like a PPT, one scroll guides you to the next slide. It's not a free
scroll."*

- **It is not CSS scroll-snap, and that was measured, not assumed.** Slide gaps
  are 819–2346px while one wheel gesture is ~320px, so `scroll-snap-type: y
  mandatory` re-snapped to the slide it started from: the scroll sat at **y=84
  through eight consecutive gestures**, and through a 12-event trackpad flick.
  `proximity`, `scroll-snap-stop: always`, and a hero shrunk to exactly 100vh all
  measured identically stuck — the arithmetic is gesture size vs. slide spacing, so
  no snap flag can fix it. Only gestures of 640px+ advanced.
- **Tall slides get interior stops**, one viewport apart, so the deck pages
  *through* them; a slide only barely taller than the viewport is treated as
  fitting (`slack`), because an 84px "advance" is exactly the free-scroll feel
  being replaced.
- **What it deliberately does not break**: keyboard (Home/End/PageUp/PageDown/
  space/arrows), find-in-page and `#anchor` jumps (programmatic scrolls are
  ignored), resize/zoom (re-measured), trackpad momentum (one flick is coalesced
  into one slide).
- **It does not engage under reduced motion, and it does not engage on a phone.**
  Both fall back to an ordinary free scroll, which is a *finished* state.

## Phones

`lib/viewport.ts` is the one phone gate: **`PHONE_MAX_WIDTH = 640`** and
`isPhone()`, which asks `matchMedia` rather than measuring `innerWidth` so it
agrees with CSS exactly (the two disagree by a scrollbar's width, and that is
enough to engage the deck on a viewport whose styles think it's a phone).

**The number lives in two places and they are synced BY HAND.** `@media
(max-width: var(--x))` is not valid CSS, so there is no way to feed one value to
both. **If you change `PHONE_MAX_WIDTH`, change every `@media (max-width: 640px)`
block with it** — there are 15 (`grep -rn 'max-width: 640px' src`), across
`global.css`, `CornerNav`, `Toc`, `DescentPath`, `ProjectCard`, `FluidSky`,
`Heights`, the two proto sections, `404`, `experience`, `research` and
`writing/[...slug]`. `tests/viewport.test.ts` pins the value so a
silent drift shows up as a failure rather than as a phone with half a treatment.

**The phone gets the same CONTENT as the desktop.** A phone-specific content
design was built **three times and reverted every time** — do not rebuild it. The
phone treatment is *bug fixes only*, and the whole of it is:

- the corner nav collapses to a **menu mark** that swaps for the list when opened
  (mutually exclusive, so the capsule can never grow a second row);
- the **deck disengages** — measured in real WebKit, 5 of the 7 slides are taller
  than the viewport (rules 1.84 screens, story 3.07 on an iPhone 14; 2.5 and 4.2 on
  an SE), so its "every slide owns the screen" contract is simply false there. All
  four reported symptoms — text resting under the fixed nav at 7 of 15 stops, one
  swipe scrolling twice, a light flick going nowhere, one swipe skipping a screen —
  follow from the deck resting *inside* slides, and turning it off removes all four
  by deleting behaviour rather than adding compensation;
- the **Toc hides** (`display: none` — a 38px margin rail has no margin to sit in);
- the **descent graph** drops its in-frame labels and becomes a block with its own
  height, with the sentence that explains it read *after* it rather than across it;
- the **fluid sky canvas is skipped** entirely under 640px.

## Navigation & structure

- **`src/data/nav.ts` `PAGES` is the canonical page set** — "where can you go from
  here", in the site's own hierarchy (research first, art last; /writing directly
  after /research because it's the same subject at a different formality). It lives
  in `data/` because the page set is a *fact* about the site: the site once shipped
  a link to `/experience` before that page existed, and `tests/nav.test.ts` now
  asserts every href resolves to a real route, with no duplicate hrefs or labels.
  `CornerNav` renders it.
- **`profile.ts`'s `links` array is a SECOND list, and it has already diverged.**
  It exists for a different job — the footer, the CV button, and the GitHub/LinkedIn
  hrefs that JSON-LD's `sameAs` reads — but it also enumerates pages, and it is
  currently missing `/writing`, so the footer offers four doors where the nav offers
  five. When you add a page: **`PAGES` is canonical, and `links` must be checked by
  hand.** Anything that just needs "the pages" should read `PAGES`.
- **`src/lib/pageStops.ts` is one tree per page, and it drives BOTH the rail and
  the page's section ids.** This is structural, not stylistic: `/research` used to
  render N papers with `featured.map(...)` while building its rail with
  `featured.some(...)`, so N papers collapsed into one flat anchor set pointing at
  ids emitted once per paper — `getElementById` takes the first match, so every
  "Method" link jumped to paper 1. Now the same function that names a stop's anchor
  hands the page the id to render, so **a stop cannot point at an id the page didn't
  emit.** Add a section to a page → add it to its `*Stops()` and render the id from
  the same helper. `SideRail` (reading pages) and `Toc` (homepage, via `homeStops()`)
  are both dumb markup over these trees.
  - Rail labels are **bookmarks, not sentences**: measured, "The problem" /
    "Constraints" pushed the indented tier's right edge to x=151 against a headline
    starting at 143, and the rail printed over the words.
  - `flattenStops()` is *tree* order, which is **not** visual order (/research puts
    Results in a right-hand column, higher on screen than its tree position).
    `SideRail` sorts by measured position before running the scrollspy — don't
    assume monotonicity.

## The content model rule

This is the structural conclusion of the audit, and it is policy, not preference:

- **Records rendered in more than one shape stay TypeScript data.** Publications,
  the timeline, projects and artworks are cross-referenced by id and rendered in 3+
  shapes each (a rail label, a homepage line, a full panel, JSON-LD, a computed
  number). They live in `src/data/*.ts` where a type error catches a mistake and a
  test can assert the invariant.
- **Unbounded prose with exactly one renderer becomes a content collection.**
  Writing is that: one route renders it, there is no upper bound on how much of it
  there will be, and its author should never open an editor on a `.ts` file to add a
  piece.

**Do not converge them.** Turning `profile.ts` into markdown would break every
cross-reference and every computed number; turning writing back into a TS array
would make a new post a code change. The seam between the two is exactly one
function (`buildKinds`), and that is the whole point.

## Writing is markdown

The owner: *"i want the writing to be flexible. so essentially writing.ts displays
some markdown notes i have. My favorite quotes is just a markdown file."*

**A new piece is a FILE, not a code change**: drop a `.md` into
`src/content/writing/`, give it frontmatter, and it appears on `/writing` under its
kind and gets its own page at `/writing/<slug>`. Nothing else is edited.

- **`src/content.config.ts`** defines the collection (`glob` loader) and validates
  frontmatter at **build** time, which is why it's a collection rather than
  `import.meta.glob`: a typo in `kind:` fails `npm run build` naming the file,
  where a glob would render a broken row and ship it.
- **The frontmatter contract:**

  | field | required | notes |
  | --- | --- | --- |
  | `title` | yes | |
  | `date` | yes | `YYYY-MM-DD`. Unquoted YAML dates are fine — the schema accepts a string *or* a `Date` and normalises, because YAML parses `2026-08-15` into a Date object and a bare `z.string()` rejected the most natural spelling (that is how the first file failed to build). |
  | `kind` | yes | enum: `notes` \| `essays` \| `explainers` \| `misc`. An enum so a misspelling is a build error, not a piece that silently belongs to no section. |
  | `blurb` | yes | one or two sentences; shown on the index, not on the piece. |
  | `updated` | no | when the piece last **gained** something. |
  | `minutes` | no | omit rather than guess — the index only prints it when it's real. |
  | `featured` | no | leads its kind. |
  | `draft` | no | committed but unpublished: no index row, no page. |

- **`updated` is SET BY HAND, and only when a piece gains content.** It is not
  derived from git: a reformat, a typo fix or a rebase would each register as an
  edit, CI's shallow clones make the git date unreliable anyway, and a date that
  moves on its own teaches a reader to distrust every date on the site. Leave it
  alone for a CSS change. It renders only when it *differs* from `date`, so a piece
  written once shows one date rather than two identical ones. It may not precede
  `date` (the schema refuses).
- **`data/writing.ts` keeps only the taxonomy** — what each kind IS, its rail
  label, its gloss, and the copy shown while it's empty. That is site *voice*, so it
  stays in TypeScript. **`buildKinds()` is the single seam** between taxonomy and
  files, and it returns the same `WritingKind` shape the page and `pageStops`
  already consumed, deliberately: nothing downstream had to learn that content
  moved. The schema's enum and `KINDS`' keys must agree, and
  `tests/writingContent.test.ts` asserts exactly that (it reads `content.config.ts`
  as *text*, since `astro:content` is a virtual module vitest cannot import).
- **Empty kinds are shown**, with copy that names what is coming rather than
  "coming soon" — it states intent, and it's honest in a way a silently-missing
  section is not. A test enforces that the empty copy is specific.

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
  turns to dusk. Its links to /research and /art are an **easter egg** — real
  navigation must never require a discovery, which is why the corner nav carries
  the page set at all times.
- The art avocation (guqin + Chinese/English calligraphy) is real and shown on
  /art, but stays an avocation in the framing.
- **/research is papers-only.** A paper and a post have different contracts — one
  is co-authored, dated, citable and has results; the other is one person thinking
  out loud. Filed together, the informal writing quietly borrows the paper's
  authority. That's why /writing is its own route.
- **The appendix is not a résumé.** A résumé lists credentials and claims
  authorization; the Work slide lists **artefacts** and where to read them. Every
  row is something a reader can go and check.

All résumé content lives in `src/data/profile.ts` — editing the site's facts
means editing data, never components. A new résumé becomes a `profile.ts` edit.

## The hero — math-generative terrain

A 3D dotted optimization landscape (Gaussian-mixture loss field) rendered to a
full-bleed hero `<canvas>` in **Heights**, colored by height (ochre valleys →
indigo peaks), breathing gently, with occasional gradient-descent "walkers"
flowing downhill into local minima as fading comet trails — "The Descent" made
literal. A rare Easter-egg pill at a settled optimum shows typeset math (∇f = 0,
the stationarity condition) or "Moo!".

- Code: `components/TerrainHero.astro` (vanilla `<script>`) + pure, unit-tested
  math in `lib/terrain.ts` (gradient verified vs finite-difference; descent
  converges to true minima), painted via `lib/terrainRender.ts`, with
  `lib/equations.ts` for build-time KaTeX→MathML.
- **The math must stay honest.** Don't claim quadratic convergence for plain
  gradient descent; ∇f=0 is the unconstrained stationarity condition. Misstated
  math undercuts the whole point of the piece. The same rule governs the explainer
  slides and the descent graph.
- Perf: rAF loop paused offscreen (IntersectionObserver) + ~30fps throttle +
  DPR≤2; a finished static frame is painted first (instant LCP) and is the
  reduced-motion / no-JS state.

## The fluid sky

`components/proto/FluidSky.astro` is the sky on **every** page (the `proto/` path
is where it was born, not where it belongs). A WebGL canvas: a two-level domain
warp over the descent/reading ramps, sampled from scroll position, with viscous
luminance banding and a warm bloom. `lib/skyShader.ts` holds the GLSL,
`lib/skyPalette.ts` the ramps, `lib/skyLegibility.ts` the **contrast policy** that
keeps text readable over it. Two archetypes: `descent` (paper text; the dangerous
direction is lighter) and `reading` (dark ink on a luminous field; dangerous is
darker). `yStart` lets a page begin further down the pattern — the owner, on the
reading pages: "what i liked is actually lower" — without touching the shader.

Two invariants, both about the compositor and both easy to break:

1. **The canvas is OPAQUE, with no `mix-blend-mode`.** A blended full-screen layer
   forces the compositor to re-read the page backdrop every frame, which defeats
   layer caching for the entire document.
2. **`.fluid-live` must never outlive a visible canvas.** CSS gates the canvas
   (hidden under 640px, under reduced motion, and at `strength=0`), and the class is
   additionally dropped on resize-to-hidden and on GL context loss.

Perf: viewport-sized (scroll is a uniform), half internal resolution, ~30fps idle
and full rate while scrolling, paused on tab-hide, skipped on phones. The CSS
`--descent-grad` gradient remains underneath as the base and the no-WebGL state.

## Themes (light ⇄ dark)

Two themes, driven by `html[data-theme]` (absent = light, `'dark'` = terminal
galaxy). The whole system is **token override**, not per-component branching:

- **How it flips:** `tokens.css` defines the palette in `:root` (light) and
  re-declares it under `html[data-theme='dark']`. `global.css` `@theme` maps
  `--color-*` → those tokens, so **every Tailwind utility and hand-written
  `var(--ink-*)` re-themes for free** — no component edits for the ~90% that
  just uses tokens. Only redefine a surface explicitly when it hardcodes a
  color a token can't reach.
- **Role tokens that must NOT flip with the ink ramp:** `--bg` (page base
  behind the sky — always dark, never flashes bright), `--on-accent` (dark
  ink for text ON the accent chip — the accent is a light color in both themes,
  so text on it stays dark), and `--descent-grad` (the whole sky, redefined
  wholesale per theme).
- **Surfaces that can't inherit CSS tokens** (handle per-theme by hand):
  the **terrain canvas** (JS-painted — `TerrainHero.astro` picks a `TerrainRamp`
  + walker palette off `data-theme`; dark = green "stars"), the **fluid sky**
  (`skyPalette`/`skyShader` switch to a phosphor nebula with stars behind the
  line), the **SkyWash** + `.descent::before/::after` washes (raw rgba — dark
  nearly kills the warm Monet strokes), the **hero legibility halo** (paper→dark
  veil), the **Story panel's paper ground** (chosen per theme, not shared), and the
  **corner-nav glass** (forced dark-frost in dark theme).
- **Default + persistence:** an inline no-FOUC head script in `BaseLayout`
  resolves theme *before first paint* — explicit `localStorage.theme` first,
  else `prefers-color-scheme` (so a first-time visitor matches their OS). The
  toggle (a real `<button>` in `CornerNav`, sun/moon by action) writes
  `localStorage` and flips the attribute live, then re-fires `astro:page-load`
  so the canvases repaint for the new palette.
- **Additive rule (load-bearing):** the dark theme must NEVER degrade the
  shipped light Descent. Light is the base; dark is an override layer. When
  touching themes, verify BOTH — build breaks and contrast regressions hide in
  the theme you didn't look at.
- One panel used to be dark in both themes for emphasis. It was removed: a
  light-theme reader read it as a **bug**, not as emphasis. All four paper slides
  now share one palette and follow the theme.

## Two CSS traps that have each shipped a bug here

1. **Astro scoped styles rewrite selectors with `[data-astro-cid-…]`,** which
   changes specificity **and what the selector can reach.** A scoped rule **cannot**
   reach markdown rendered by `<Content />`, slotted content, or nodes a script
   created at runtime — `.prose blockquote` becomes `.prose[cid] blockquote[cid]`
   and matches nothing, silently. This is why `/writing/<slug>`'s prose styles are
   in an `is:global` block (nested under `.prose` so going global cannot leak), and
   why several component rules use `:global(...)`. When a rule "does nothing" and the
   markup is clearly right, check this first.
2. **At equal specificity, SOURCE ORDER decides.** Put an override **after** the
   rule it overrides. A phone override placed above the desktop rule it was meant to
   beat has shipped here more than once.

Related: `scroll-margin-top` is only honoured by `scrollIntoView()`. The deck moves
with `window.scrollTo()`, so a CSS rule looked correct, did nothing, and panel
titles came to rest hard against the browser chrome — the lead is a number in
`lib/deck.ts` for that reason.

## Conventions

- **Node:** Astro 6 rejects Node 20. Use `nvm use` (`.nvmrc` pins 24) before any
  npm/npx. CI and the deploy action read the same version — except
  `withastro/action`, which takes only `node-version` and is hardcoded to 24;
  **edit that line and `.nvmrc` together.**
- **Branch hygiene:** never commit to `main`. Cut `claude/<topic>`, open a PR,
  squash-merge. Commit messages end with the Co-Authored-By trailer.
- **CI is the merge gate.** `.github/workflows/ci.yml` runs **build → typecheck →
  test** on every PR. **Wait for CI to go green before merging** — don't squash-merge
  a PR with a pending or failing check, even when local gates passed. It also has
  `workflow_dispatch`, so the gate can be run by hand (`gh workflow run ci.yml --ref
  <branch>`) — during the 2026-08-06 Actions incident, webhook throttling meant
  pushes produced no runs at all and a PR could not be merged through no fault of
  the branch.
- **Local gates before commit: `npm run build`, `npm run typecheck`, `npm test`.**
  All three, and the middle one is not optional:
  - **`npm run build` is NOT type-checked.** Astro and vitest both hand `.ts` to
    esbuild, which strips annotations without asking the compiler. A green build says
    nothing about types — proof: `tsc --noEmit` reported a real TS2345 in
    `tests/skyShader.test.ts` while build and test were both green.
  - **`npm run typecheck` is the only place types are checked**, and it runs **two**
    checkers because neither covers the other: `astro check` is the only thing that
    reads the ~4,400 lines of `<script>` bodies inside `.astro` files (tsc can't parse
    `.astro`), and `tsc --noEmit` is the only thing that covers `tests/` and `src/lib`.
    Run it after a build so the generated content-collection types in `.astro/` exist.
  - `tsconfig.json` excludes `tmp_*` and `.tmp-*` — the ad-hoc probes the verification
    loop produces are not the project, and a gate whose output is mostly noise is a
    gate people learn to ignore.
  - **The gate is at ZERO, so a red typecheck means you broke it.** Read that literally:
    `npm run typecheck` reports `0 errors` today, and there is no inherited noise to
    excuse a new one. (This bullet previously said the opposite — it described the 86-error
    backlog `astro check` arrived with and told you a red gate "does not mean you broke
    it". All 86 were fixed in the same batch that added the gate; leaving that sentence up
    would have taught the next reader to dismiss a real failure as somebody else's mess,
    which is how a gate stops being one.)
  - **The error class those 86 were, because it will come back.** `astro check` is the only
    thing that reads the `<script>` bodies in `.astro` files, and they were written for
    years against a compiler that never looked. Almost all of it was `ts(18047)/(18049)`
    "possibly null" on canvas contexts and `querySelector` results — and the guards were
    *already correct*. The cause is that TypeScript does not carry a `const`'s narrowing
    into a **hoisted `function` declaration**, only into arrow functions, since a hoisted
    function could in principle run before the guard. The fix is a non-null alias right
    after the guard (`const nav = maybeNav;`), which makes the type true at the
    declaration so no narrowing has to survive anything. Prefer that to a `!` or a cast.
  - **Types gate the MERGE, tests gate the DEPLOY**, and that asymmetry is
    deliberate: `deploy.yml` runs tests but not typecheck, because a type error cannot
    change the shipped bytes, and blocking a deploy on it would leave the live site
    stale to punish a mistake that isn't in the output.
- **`vitest` runs with `passWithNoTests: false`**, on purpose: a mistake in the
  `include` glob would otherwise collect zero files and still exit 0, turning every
  required check green with the safety net switched off and nothing red to say so.
- **Verify visually, not just by build.** Art/layout/animation must be SEEN, and
  small-detail screenshots are unjudgeable — put the options *in the live page* as a
  switcher and look (that is what the `/proto-*` routes are for). When a browser is
  needed: `npm run build` → `npm run preview` → drive **one** headless Chrome over
  CDP → screenshot at scroll positions → look → refine. For faint issues,
  contrast-stretch the screenshot or toggle layers off and diff — single-column pixel
  math misleads. Helper scripts are ad-hoc; recreate as needed.
  - **One browser at a time, and never a fleet.** A parallel browser fleet took the
    owner's machine down. If a task forbids browsers, `npm run build` plus reading
    `dist/` with grep is the verification path — the last several defects here were
    confirmed exactly that way (`grep -c 'content="noindex"' dist/proto-*/index.html`,
    `grep -o '<loc>' dist/sitemap-0.xml`).
  - **rAF and screencast cannot measure fps**, and extent probes must skip
    `position: fixed` elements (the descent veil lies about page height).
- **Lighthouse bar:** Perf ≥99 / A11y 100 / Best-practices 100 / SEO 100. Don't
  regress a11y: there's a `<main>` landmark; nav is real `<button>`/`<a>`; decorative
  canvases, rails and the cow bubble are `aria-hidden` or labeled.
- **Pure logic is tested.** Anything non-trivial in `lib/` gets a vitest spec, and
  so does every *invariant between two files* (`nav.test.ts`: every nav href is a
  real route; `writingContent.test.ts`: the schema enum matches `KINDS`;
  `pageStops.test.ts`: no stop points at an id the page won't emit;
  `viewport.test.ts`: the breakpoint still says 640). They're the only automated
  safety net, and they're where "two places must agree" is actually enforced.

## Taste rules (these define the look — hold the line)

- **Palette discipline:** ONLY the tokens in `tokens.css` (paper, ink-1..5,
  ochre, indigo, seal). In the **light** theme the vermilion **seal**
  (`--seal #b23a2e`) is the ONLY saturated color. Never pure `#fff` / `#f00`.
  **Deliberate exception — the dark theme.** `html[data-theme='dark']` is the
  "terminal galaxy": it intentionally swaps the ochre accent for a phosphor
  **emerald** (`--ochre: #66c28c` under dark) — a second saturated color, on
  purpose, because the terminal/coder identity is the whole point of dark mode
  (the user chose it seeing both this and a "night descent" variant live). Do
  NOT "fix" this back to ochre. The seal red stays the brand mark in both
  themes (brightened to `#e0574a` for the dark ground).
- **Motion:** animate only `transform` / `opacity`; NEVER animate `filter: blur`
  (bake it). ALL motion is gated behind `@media (prefers-reduced-motion:
  no-preference)` via `lib/motion.ts`. The no-motion state must look *finished* —
  it's also the Firefox fallback (`animation-timeline` isn't in Firefox yet), and
  it's what a reduced-motion reader gets instead of the deck.
- **Loading states are designed, not default.** No bare grey rectangles — a
  loading tile uses a palette-tone placeholder with a transform-only shimmer (see
  `.tile` in `art.astro`), gone the instant the image decodes.
- **Pixel art has no curves.** The cow's speech bubble is built from one number
  (a 10px cell, the owner's pick of two mocks): border thickness, the MOO glyph and
  the tail's steps all measure exactly one cell. That is what makes it read as pixel
  art rather than as a rounded chat bubble with a blocky font. `MOO!` is *type*,
  drawn from a matrix in `data/cowGlyph.ts`.
- **Favicons:** the browser tab uses the SVG seal; Google Search renders a
  *raster* favicon, so PNG fallbacks (48/32/180/192/512) + a webmanifest +
  `og:image` ship from `public/`. Regenerate them from `favicon.svg` if the seal
  changes (sharp rasterizes SVG→PNG).

## Rejected — do not rebuild

Kept here so the same work isn't done a fourth time. Each of these was built,
looked at, and turned down:

- **Pointer/mouse interaction on the hero** — built and rejected 2026-08-06.
- **A phone-specific content design** — built three times, reverted every time.
  Phone content stays in sync with desktop; see *Phones*.
- **CSS scroll-snap for the deck** — measured stuck; see *The deck*.
- **Five showpieces** for the explainer slides, three of them hand-drawn props —
  each "looked like it meant something without meaning anything". The replacement
  rule: the surface has to be real math, computed.
- **The feasible polygon and the decision lattice** in the Rules slide — exact,
  unit-tested, and *still wrong for the slide*, because both shrink something on a
  slide whose whole job is that the problem grows. See *The homepage*.
- **A dark panel for emphasis** in the light theme — read as a bug, not emphasis.
- **The scripted terminal** — the site's only React island, deleted on the owner's
  instruction ("you can delete the terminal at the bottom, it's already useless").
  Its data, engine and spec went with it; git holds them.
