# Sediment of Sentences — a recommendation, NOT a decision

Output of a design workflow (six independent takes, three judges: a curious stranger, an art
director, a graphics engineer; curiosity and buildability weighted double). The judges looked at
the rendered `/proto-sketches` frames and MEASURED them rather than reasoning about them, which is
why this is worth keeping.

**Nothing here is approved.** The owner has said explicitly: *"we don't need to rush, we have
plenty of time to think about this."* This file is input to that thinking.

## The two findings that matter most

**Ink coverage, measured.** The four rejected attempts sat at **1.2–2.6%** ink. The
forty-two-sentences frame measured **6.1%** — the only one that did not measure empty. That
finally makes "reads empty on a large screen" a number instead of an opinion, and it is the metric
any future candidate should be checked against (their proposed bar: ≥8%, no quadrant under 3%).

**The path sketch re-renders the hero's own field, and that is fatal.** It calls
`terrain.ts`'s `field()` — the same Gaussian mixture, the same two basins. Contours instead of dots
is a change of HATCHING, not of object, so it is the one concept already rejected outright, walked
back into. Their sharpest line, and it lands: *"'escaping costs a 1.26 climb' is self-flattery
wearing a measurement."* That is the self-branding problem in mathematical costume.

## The continuity argument worth stealing regardless of what gets built

> Same mark, different projection: the hero is a dot field in **plan**, looking down at a surface;
> this is a dot field in **section**, cut through what is under it. It reuses the visual grammar
> (dots, a value ramp, down as the axis) and reuses *none* of the mathematics.

And the enforcement, which is the good engineering idea here: **a test asserting the module never
imports `terrain.ts`**, so "not a second terrain" is a checked property rather than an intention.

## The open judgement, in their words, which only the owner can settle

> "The subject is still the photographs, which means the closing note of a quant-first page is the
> avocation, dressed in geology… The first two risks are answerable at the gate for the cost of one
> function. The third is a judgement only you can make, and it should be made before, not after,
> the component exists."

That is the real question on the table: **should the last thing on a quant-first page be the
art?** It may be exactly right (it is the human note after the mathematics) or exactly wrong (it
buries the quant identity at the moment of departure). Not a technical question.

---

# 1. THE TOP TWO

## ① SEDIMENT OF SENTENCES

**Pitch.** You scroll past the near-black ground and the descent doesn't stop — it cuts, and you're looking at a core sample whose grains are the 42 sentences he wrote about his own photographs.

**Curiosity mechanism.** The rock is legible as rock but the writing embedded in it is truncated, so the only way to finish a sentence is to touch its layer — and touching it pairs the sentence with the photograph it was written about.

**The still frame, concretely.** A vertical core occupying the middle third of the frame, 42 hard-edged bands stacked top to bottom, each band's value taken from the mean luminance of one photograph (real range 0.180 → 0.687, so the stack genuinely reads as stratigraphy, not stripes). Inside each band, hash-placed grains, count proportional to that note's character length — a long sentence is literally coarser rock. Two sentences are set at reading size in the left margin against the strata; the other 40 sit as thin truncated lines with hairline leaders to their own band. Six mono markers down the right side of the shaft, ochre, evenly spaced, each a destination. Nothing is drawn by hand; every mark is a consequence of a number on disk.

**Continuity without repetition, stated precisely.** Same mark, different projection: the hero is a dot field in **plan**, looking down at a surface; this is a dot field in **section**, cut through what's under it. It reuses the visual grammar (dots, a value ramp, down as the axis) and reuses *none* of the mathematics — no `field()`, no Gaussian mixture, no contours. I'd enforce that with a test asserting `sediment.ts` never imports `terrain.ts`, so "not a second terrain" is a checked property rather than an intention.

**Single biggest risk.** It becomes E·section again: a stack of labelled bands reads as a table with rock texture. The defence is that no band is labelled with a year, an employer, or a role — the only text in the object is his own prose — but the failure mode is one bad label away.

## ② FORTY-TWO SENTENCES

**Pitch.** The same 42 notes, no geometry: a typographic field where two sentences are large and forty are truncated invitations.

**Curiosity mechanism.** Identical — a sentence that ends in an ellipsis is an instruction to touch it — minus any object to touch it *on*.

**The still frame.** Two sentences at 34px against the dark ground, a hairline rule, then three columns of 12.5px truncated lines; 6.1% ink coverage, the only frame in the batch that didn't measure empty.

**Continuity.** Weakest part: it inherits the palette and the darkness and nothing else. It is *on* the descent rather than *of* it.

**Single biggest risk.** As the last thing on a quant-first page it makes the avocation the closing note, and it has nowhere structural for the six links to live, so they become a footer menu.

**Why this is the right #2:** it is a strict subset of #1. Delete the canvas, the strata and the markers from Sediment and this is exactly what remains. So a failure of #1 degrades to a shippable #2 instead of to nothing — which, after four write-offs, is the property worth paying for.

# 2. FIRST-SESSION BUILD SPEC (Sediment only)

**Files**
- `/Users/zetian/devpro/ing/IngTian.github.io/scripts/bake-strata.mjs` — one-shot Node script, `sharp` (already a dep, 0.34.5) reads `src/assets/art/photos/*`, emits mean relative luminance per file. Run by hand, output **committed**; sharp never runs at page build and no image is decoded at runtime.
- `/Users/zetian/devpro/ing/IngTian.github.io/src/data/photoStrata.ts` — the baked table: `{ file, lum }[]`, sorted.
- `/Users/zetian/devpro/ing/IngTian.github.io/src/lib/sediment.ts` — pure: `strata()`, `strataColor(v, ramp)`, `grainsFor(band)`, `markerDepths()`, `hash2(i, j)`.
- `/Users/zetian/devpro/ing/IngTian.github.io/src/lib/sketches/batch2.ts` — the SVG gate frame (this is the *first* thing built; see §3).
- `/Users/zetian/devpro/ing/IngTian.github.io/src/sections/Sediment.astro` — the section, vanilla `<script>`, **no** React island, **no** three.js.
- `/Users/zetian/devpro/ing/IngTian.github.io/tests/sediment.test.ts`.
- Two one-line stub routes `/writing`, `/reports` — a focusable element that goes nowhere fails both the brief and a11y.

**Geometry from real data, and the honest limits of it.** Depth ordering = photographs sorted by luminance. Band *thickness* must **not** be luminance-proportional: measured, the thickest band would take 18.6% of the core and `photo-19`/`photo-30` differ by 1.1e-5, so two sentences would occupy zero pixels. Use `t = 0.5·(1/42) + 0.5·proportional`, floored at 0.8%. Grain count per band `= 6 × note.length` (≈20,600 total, ≈1 canvas frame at DPR≤2); positions from `hash2`, never `Math.random()`.

**Marker depths are a layout decision, and I'm not going to dress it as a measurement.** The six sharpest natural contacts sit at depth fractions 0.06 / 0.25 / 0.31 / 0.37 / 0.44 / 0.96 — five bunched in the top half and one stranded at the bottom. Derived marker positions would look broken. So the six sit at `(i + 0.5)/6`, each anchored to whichever band it lands in.

**Six links in register.** A `<nav aria-label="Sections">` of six `<a>`, absolutely positioned by `top: calc(var(--core-top) + <depth> * var(--core-h))` — the same scalar the canvas uses, so registration is arithmetic, not eyeballed. The 42 sentences are an `<ol>` of `<a href="/art#p-NN">`; tab order equals descent order.

**Themes.** One function, two ramps: `STRATA_LIGHT` (ink greys warmed toward ochre) and `STRATA_DARK` (cooler, emerald-tinged). Strata render as a **42-hard-stop CSS gradient** built from the baked table at build time, one gradient per theme — which means the strata exist with JS off and with the canvas dead. Verify the darkest band against `--bg` in *both* themes; the light theme's `--bg` is #16140f and that's where this kind of thing dies.

**Reduced motion / no-JS.** No-JS = CSS strata + all 48 links + `:focus-within` reveal, i.e. finished. Reduced motion = canvas paints its one static frame at a committed depth constant chosen by looking, not 0. Motion (parallax of the grain layer, marker fade) is `transform`/`opacity` on a single `--sed-depth` var, behind `prefersReducedMotion()`.

**Lazy loading.** 42 reveal thumbnails via `astro:assets` at ~160px, `loading="lazy"`, `decoding="async"`; the canvas initialises on IntersectionObserver and re-inits on `astro:page-load` with teardown, per `TerrainHero`.

**Tests assert.** 42 bands; thicknesses sum to 1 ± 1e-9; every thickness ≥ floor; band order matches luminance order; `hash2` deterministic and in [0,1); grain counts match note lengths; `markerDepths()` strictly increasing with min separation ≥ 0.1; `strataColor` monotone in value and inside the token gamut for both ramps; and `sediment.ts` contains no import of `terrain`.

# 3. THE KILL GATE

One `draw()` added to `batch2.ts` and looked at on `/proto-sketches` at 1600×900, **in both themes**, before any component exists. It costs one function; that harness is the only gate in this project that has ever saved time.

What to look for, in order: (1) squint at it as a thumbnail — if it reads as the hero, stop; (2) does it read as **one object**, or as a list with texture (the E·section death); (3) ink coverage ≥ 8% with no quadrant under 3% — the four prior deaths all measured 1.2–2.6%; (4) is the darkest band still distinguishable from the page ground in *light* theme; (5) do the two large sentences survive the strata behind them, and do the six markers clear the 40 small lines.

# 4. WHAT TO DROP

- **Underside** — cheapest to build and closest to the one thing already rejected outright; "it's the hero inverted" is a distinction you have to explain.
- **The Core (unlabelled)** — structurally right, but unlabelled rock gives a stranger nothing specific to be curious about; it is #1 with the subject removed.
- **Constellation** — generic; every third portfolio has one and dark mode already owns stars.
- **Flow-field tracers** — a gradient field under a gradient field, with nothing to click. Screensaver.
- **Long exposure** — hue extraction imports saturated colour and breaks the palette rule; 42 hand-tuned textures is exactly the work this implementer loses at.
- **Stepwell / Simplex Cage / Seriation** — the first dies on materials (a terrace already read as a bathtub), the second is the most dated WebGL object of the last four years and retells the hero's story, the third is a category error already diagnosed.

# 5. WHAT COULD STILL GO WRONG

The honest pattern across four failures is not bad ideas, it's that I pass my own gates and then fail your eye — and the specific mechanism is that I can verify *correctness* (the numbers are real, the bands are ordered, the tests are green) but I cannot verify *taste* until you look. Sediment reduces that exposure — it has no drawn props, its density is guaranteed by 20,600 marks rather than hoped for, and its resting state is a CSS gradient that cannot fail to render — but it does not eliminate it. Three things could still kill it: the strata may read as a chart no matter what the labels say, because a stack of ranked horizontal bands *is* a chart; brightness ordering is an honest axis but a semantically arbitrary one, and if you find the mapping meaningless the whole object becomes decoration with a story attached; and the subject is still the photographs, which means the closing note of a quant-first page is the avocation, dressed in geology. The first two are answerable at the gate for the cost of one function. The third is a judgement only you can make, and it should be made before, not after, the component exists.