# FluidSky Refactor & Audit Closeout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `FluidSky.astro` from an 852-line patch record into a component whose shader and math live in named, tested `lib/` modules, and close every verified finding from the adversarial audit.

**Architecture:** The component keeps only WebGL lifecycle (context, program, uniforms, rAF loop, teardown). Everything else moves out: the palette ramps become a data module, the fragment shader becomes a template function in a shader module, and the contrast/legibility rules — currently scattered inline as magic numbers — become one pure, unit-tested policy module. Extracting the policy is what lets the audit's contrast findings be *tested* rather than re-measured by hand each time.

**Tech Stack:** Astro 6 (static), TypeScript strict, vanilla `<script>` (no island), WebGL1, vitest.

## Global Constraints

- **Node 24** (`nvm use` before any npm command). Astro 6 rejects Node 20.
- **Gates before every commit:** `npm run build` AND `npm test`. Both green.
- **The shader-string invariant, which RELOCATES during this plan.** A backtick inside a template literal's comments terminates the string and breaks the build; this has happened five times. Before Task 4, the literal lives in `FluidSky.astro` and that file must contain **exactly four** backticks. Task 4 moves the GLSL to `src/lib/skyShader.ts`, after which `FluidSky.astro` must contain **zero** and the four-backtick check applies to `skyShader.ts` instead. Verify with `grep -c '\`' <file>` after every edit to whichever file holds the literal. The end state is strictly safer: a `.ts` module cannot mix GLSL comments with Astro markup.
- **Palette discipline:** only tokens from `tokens.css`. Never raw `#fff`/`#f00`.
- **Motion:** transform/opacity only in CSS; never animate `filter: blur`; all motion behind `prefers-reduced-motion` with a finished-looking static state.
- **Zero new npm dependencies. No new React island** (the terminal is the only one).
- **Comments state INTENT, not history.** No "was X, now Y", no "BUG FIXED HERE", no measurement narration. If a number is load-bearing, a test asserts it instead.
- **Any luminance figure in a comment must be WCAG relative luminance** (linearize sRGB, then 0.2126/0.7152/0.0722) — never Rec.601 luma on gamma-encoded values.
- The shipped light theme is the base; dark is an override layer. Verify both.

## Verified findings this plan closes

Each was independently reproduced before being planned. Findings the audit raised that I **disproved** are listed at the end and deliberately NOT actioned.

| # | Finding | Evidence |
|---|---|---|
| A | `uReadCap` never binds — max darkward excursion `0.34 × 1.35 × 0.5 = 0.230` vs a cap of `0.34`. The comment calls it "the single number keeping body text safe". | arithmetic |
| B | Deleted test guards justified by a false claim: comment says the ramp "has been REVERTED" while `TERRAIN_LIGHT` ships `[58,40,18]`, deeper than ever. | `terrain.ts:80` vs `:118` |
| C | `/terrain-lab` named in two comments as a live consumer; the route does not exist. | `ls src/pages` |
| D | Sitemap enumerates `/proto-paper` and `/proto-ladder`, whose bodies quote internal review feedback. | `astro.config.mjs:26` |
| E | `Timeline`/`Publications`/`Awards` have 0 importers but CLAUDE.md:48 documents them as the renderers. | grep |
| F | Rec.601-vs-WCAG luminance figures in shader comments don't reproduce. | formula |
| G | Zero test coverage on the reading↔descent ramp selection; inverting it leaves the suite green. `paintTerrain` has no test file. `TERRAIN_LIGHT` can be reverted with all tests passing. | mutation |

## File Structure

- **Create `src/lib/skyPalette.ts`** — the four ramp stop tables (descent/reading × light/dark) plus `buildRampCanvas()`. Pure data + one DOM-free-testable builder. Owns "what colours the sky is made of".
- **Create `src/lib/skyLegibility.ts`** — the contrast policy: `zoneAt()`, `gateFor()`, `tintBudget()`, `wcagLuminance()`, `contrastRatio()`. Pure functions, no WebGL. Owns "how far the sky may deviate before text suffers". This is the module the audit's findings become tests against.
- **Create `src/lib/skyShader.ts`** — `fragmentShader(opts)` returning GLSL as a string, and `VERTEX_SHADER`. Owns the field maths. Keeping GLSL here (not in the `.astro` file) removes the backtick hazard from the component entirely.
- **Modify `src/components/proto/FluidSky.astro`** — WebGL lifecycle only: context, program, uniform upload, rAF loop with scroll pacing, resize/visibility/context-loss handling, teardown. Target < 300 lines.
- **Create `tests/skyPalette.test.ts`**, **`tests/skyLegibility.test.ts`**, **`tests/paintTerrain.test.ts`**.
- **Modify `tests/edlSpend.test.ts`** — restore the two guards deleted on a false rationale.
- **Modify `astro.config.mjs`** — filter proto routes out of the sitemap.
- **Modify `CLAUDE.md`** — correct the component list.
- **Delete** `src/components/{Timeline,Publications,Awards}.astro` (0 importers).

---

### Task 1: Sitemap leak + orphaned components + false `/terrain-lab` claims

Small, independent, no behaviour change. Clears three findings and gets the tree honest before the refactor.

**Files:**
- Modify: `astro.config.mjs:26`
- Delete: `src/components/Timeline.astro`, `src/components/Publications.astro`, `src/components/Awards.astro`
- Modify: `CLAUDE.md:48`
- Modify: `src/lib/terrainRender.ts:3`, `src/components/TerrainHero.astro:95`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing. Pure cleanup.

- [ ] **Step 1: Confirm the three components really have no importers**

```bash
for f in Timeline Publications Awards; do
  echo "$f: $(grep -rl "components/$f" src | wc -l) importers"
done
```

Expected: `0` for all three. If any is non-zero, STOP and report — do not delete.

- [ ] **Step 2: Filter proto routes from the sitemap**

In `astro.config.mjs`, replace `sitemap()` with:

```js
sitemap({
  // Prototype routes carry noindex, but an unfiltered sitemap still advertises
  // them to crawlers — and their rendered bodies quote internal review notes.
  filter: (page) => !page.includes('/proto-'),
})
```

- [ ] **Step 3: Delete the orphaned components**

```bash
git rm src/components/Timeline.astro src/components/Publications.astro src/components/Awards.astro
```

- [ ] **Step 4: Correct CLAUDE.md's component list**

At line 48, change:

```
  components/{Timeline,Publications,Awards,SealMark,Grain}.astro
```

to:

```
  components/{SealMark,Grain}.astro
```

And in the Layout section, note that the publication list, timeline and awards markup is inlined in `sections/Mountains.astro`.

- [ ] **Step 5: Remove the false `/terrain-lab` references**

`src/lib/terrainRender.ts:3` currently claims the module is shared with a `/terrain-lab` route that does not exist. Replace the "used by BOTH the hero and the tuning lab" framing with a statement of what is actually true: this module is the single source of truth for how terrain dots are drawn, so hero and any future consumer stay in sync. Do the same for the comment at `src/components/TerrainHero.astro:95`.

- [ ] **Step 6: Verify the sitemap no longer lists proto routes**

```bash
source ~/.nvm/nvm.sh && nvm use 24 && npm run build && grep -c 'proto-' dist/sitemap-0.xml
```

Expected: `0` (grep exits 1, which is the pass condition here).

- [ ] **Step 7: Run gates and commit**

```bash
source ~/.nvm/nvm.sh && nvm use 24 && npm run build && npm test
git add -A && git commit -m "chore: filter proto routes from sitemap, drop orphaned components, remove false /terrain-lab claims"
```

---

### Task 2: `skyLegibility.ts` — the contrast policy, extracted and tested

The audit's central lesson: the rules protecting text were inline magic numbers, so a guard that never bound (`uReadCap`) looked like a guarantee. Extracting them makes them assertable.

**Files:**
- Create: `src/lib/skyLegibility.ts`
- Create: `tests/skyLegibility.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `wcagLuminance(rgb: readonly [number, number, number]): number` — sRGB 0-255 in, WCAG relative luminance 0-1 out.
  - `contrastRatio(a: number, b: number): number` — takes two luminances, returns the WCAG ratio.
  - `AA_BODY = 4.5`
  - `type SkyVariant = 'descent' | 'reading'`
  - `zoneAt(depth: number, gateTop: number, variant: SkyVariant): number`
  - `gateFor(zone: number, variant: SkyVariant): { dark: number; light: number }`
  - `maxDarkwardExcursion(amp: number, displacement: number): number`
  - `tintBudget(variant: SkyVariant): { magnitude: number; cap: number; viscousFloor: number }`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import {
  wcagLuminance, contrastRatio, AA_BODY,
  zoneAt, gateFor, maxDarkwardExcursion, tintBudget,
} from '../src/lib/skyLegibility';

// --ink-3 #5a544a is the smallest ink actually used on the reading pages (12-14px).
const INK_3 = wcagLuminance([0x5a, 0x54, 0x4a]);
const PAPER = wcagLuminance([0xf4, 0xef, 0xe4]);

describe('wcagLuminance', () => {
  it('uses WCAG relative luminance, not Rec.601 luma on gamma-encoded values', () => {
    // Rec.601 on gamma-encoded #5a544a gives ~0.336; WCAG gives ~0.090.
    // Every contrast figure in this project must use the latter.
    expect(wcagLuminance([0x5a, 0x54, 0x4a])).toBeCloseTo(0.0901, 3);
    expect(wcagLuminance([255, 255, 255])).toBeCloseTo(1, 6);
    expect(wcagLuminance([0, 0, 0])).toBeCloseTo(0, 6);
  });
});

describe('contrastRatio', () => {
  it('is symmetric and matches the WCAG formula', () => {
    expect(contrastRatio(PAPER, INK_3)).toBeCloseTo(contrastRatio(INK_3, PAPER), 9);
    expect(contrastRatio(1, 0)).toBeCloseTo(21, 6);
  });
});

describe('zoneAt', () => {
  it('is fully engaged everywhere on a reading page (text runs top to bottom)', () => {
    for (const d of [0, 0.2, 0.5, 0.9, 1]) {
      expect(zoneAt(d, 0.348, 'reading')).toBe(1);
    }
  });

  it('ramps in at the content boundary on a descent page', () => {
    expect(zoneAt(0.20, 0.348, 'descent')).toBe(0);
    expect(zoneAt(0.348, 0.348, 'descent')).toBe(0);
    expect(zoneAt(0.50, 0.348, 'descent')).toBe(1);
    expect(zoneAt(0.40, 0.348, 'descent')).toBeGreaterThan(0);
  });
});

describe('gateFor — the asymmetry must INVERT by variant', () => {
  it('descent pages restrain the LIGHTWARD direction (text is paper-coloured)', () => {
    const g = gateFor(1, 'descent');
    expect(g.light).toBeLessThan(g.dark);
  });

  it('reading pages restrain the DARKWARD direction (text is dark ink)', () => {
    const g = gateFor(1, 'reading');
    expect(g.dark).toBeLessThan(g.light);
  });

  it('is a no-op outside the zone in both variants', () => {
    for (const v of ['descent', 'reading'] as const) {
      expect(gateFor(0, v)).toEqual({ dark: 1, light: 1 });
    }
  });
});

describe('maxDarkwardExcursion', () => {
  it('is what any cap must be compared against — a cap above it is inert', () => {
    // (f - 0.5) peaks at 0.5, so the excursion is displacement * amp * 0.5.
    expect(maxDarkwardExcursion(1.35, 0.34)).toBeCloseTo(0.2295, 4);
  });
});

describe('tintBudget — bounds the darkening at its SOURCE', () => {
  it('caps reading-page tint so composited paper cannot fall below AA against ink-3', () => {
    const { magnitude, cap, viscousFloor } = tintBudget('reading');
    // Worst case: start at the reading ramp's own darkest stop, apply the viscous
    // multiply at its floor, then subtract the full capped tint.
    const start = wcagLuminance([0xdc, 0xd5, 0xcf]);
    const afterViscous = start * viscousFloor;
    // magnitude is per-channel in 0-1 units; convert to a luminance delta bound.
    const worst = afterViscous - magnitude * cap;
    expect(contrastRatio(worst, INK_3)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('gives descent pages a larger budget — its danger direction is the other one', () => {
    expect(tintBudget('descent').magnitude).toBeGreaterThan(tintBudget('reading').magnitude);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
source ~/.nvm/nvm.sh && nvm use 24 && npx vitest run tests/skyLegibility.test.ts
```

Expected: FAIL — `Cannot find module '../src/lib/skyLegibility'`.

- [ ] **Step 3: Write the implementation**

```ts
// The contrast policy for the fluid sky, in one place.
//
// The sky is generated, so no CSS tool can audit it — Lighthouse's contrast check
// reads background-color and sees nothing. These functions are therefore the only
// guarantee that generated colour cannot make text unreadable, which is why they
// live here as pure functions with tests rather than as inline constants.
//
// The governing asymmetry: what threatens text depends on the text's own colour.
//   descent pages carry PAPER-coloured text -> a LIGHTER sky erases it
//   reading pages carry DARK INK on pale paper -> a DARKER sky erases it
// So the two variants restrain opposite directions. Treating them alike is the
// mistake this module exists to make impossible.

export type SkyVariant = 'descent' | 'reading';

/** WCAG 2.x relative luminance from sRGB 0-255. */
export function wcagLuminance(rgb: readonly [number, number, number]): number {
  const lin = (c: number): number => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
}

/** WCAG contrast ratio between two relative luminances. */
export function contrastRatio(a: number, b: number): number {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** WCAG AA floor for body text. */
export const AA_BODY = 4.5;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * How fully the legibility rules apply at a given page depth.
 *
 * A reading page is text from top to bottom, so the rules apply everywhere. A
 * descent page has an open sky above its content, so they ramp in at the
 * content boundary and leave the hero unconstrained.
 */
export function zoneAt(depth: number, gateTop: number, variant: SkyVariant): number {
  if (variant === 'reading') return 1;
  return smoothstep(gateTop, gateTop + 0.1, depth);
}

/**
 * Per-direction multipliers on the sky's excursion along its palette ramp.
 * The permissive direction stays near 1 so the ink keeps its character; the
 * dangerous direction is clamped.
 */
export function gateFor(zone: number, variant: SkyVariant): { dark: number; light: number } {
  const FREE = 0.25;
  const CLAMPED = 0.9;
  return variant === 'reading'
    ? { dark: 1 - CLAMPED * zone, light: 1 - FREE * zone }
    : { dark: 1 - FREE * zone, light: 1 - CLAMPED * zone };
}

/**
 * The largest darkward move the field can produce, in ramp units.
 *
 * Any cap on that move must be compared against this: a cap set above it never
 * binds and is therefore not a guarantee, however it is documented.
 */
export function maxDarkwardExcursion(amp: number, displacement: number): number {
  return displacement * amp * 0.5;   // (f - 0.5) peaks at 0.5
}

/**
 * Bounds on the two stages that darken the composed colour: the viscous
 * multiply and the subtractive tint.
 *
 * Bounding these rather than the ramp-lookup index is deliberate. The lookup
 * index cannot express what these stages do — they operate on the colour after
 * it leaves the ramp, so a colour darker than any ramp stop is reachable and no
 * cap on the index can prevent it.
 */
export function tintBudget(variant: SkyVariant): {
  magnitude: number;
  cap: number;
  viscousFloor: number;
} {
  return variant === 'reading'
    ? { magnitude: 0.055, cap: 0.55, viscousFloor: 0.955 }
    : { magnitude: 0.095, cap: 1.0, viscousFloor: 0.86 };
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
source ~/.nvm/nvm.sh && nvm use 24 && npx vitest run tests/skyLegibility.test.ts
```

Expected: PASS, all specs.

- [ ] **Step 5: Commit**

```bash
git add src/lib/skyLegibility.ts tests/skyLegibility.test.ts
git commit -m "feat(lib): extract the sky contrast policy into a tested module"
```

---

### Task 3: `skyPalette.ts` — ramp data, with the variant selection under test

Closes finding G's sharpest instance: inverting the reading↔descent ramp choice currently leaves the whole suite green, on the one axis the audit brief called the critical risk.

**Files:**
- Create: `src/lib/skyPalette.ts`
- Create: `tests/skyPalette.test.ts`

**Interfaces:**
- Consumes: `wcagLuminance` from `src/lib/skyLegibility`.
- Produces:
  - `type RampStop = readonly [number, string]`
  - `type Theme = 'light' | 'dark'`
  - `rampFor(variant: SkyVariant, theme: Theme): readonly RampStop[]`
  - `luminanceRange(stops: readonly RampStop[]): { min: number; max: number; span: number }`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { rampFor, luminanceRange } from '../src/lib/skyPalette';
import { wcagLuminance, contrastRatio, AA_BODY } from '../src/lib/skyLegibility';

const hexToRgb = (h: string): [number, number, number] => [
  parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16),
];

describe('rampFor — variant selection', () => {
  it('gives descent and reading DIFFERENT ramps (inverting the choice must fail)', () => {
    expect(rampFor('descent', 'light')).not.toEqual(rampFor('reading', 'light'));
    expect(rampFor('descent', 'dark')).not.toEqual(rampFor('reading', 'dark'));
  });

  it('descent sinks to near-black; reading never does', () => {
    const descentEnd = wcagLuminance(hexToRgb(rampFor('descent', 'light').at(-1)![1]));
    const readingEnd = wcagLuminance(hexToRgb(rampFor('reading', 'light').at(-1)![1]));
    expect(descentEnd).toBeLessThan(0.1);
    expect(readingEnd).toBeGreaterThan(0.6);
  });

  it('every reading-light stop clears AA against --ink-3 unmodified', () => {
    // The reading ramp exists so dark ink stays legible top-to-bottom. If a raw
    // stop already fails, no downstream guard can save it.
    const ink3 = wcagLuminance([0x5a, 0x54, 0x4a]);
    for (const [, hex] of rampFor('reading', 'light')) {
      expect(contrastRatio(wcagLuminance(hexToRgb(hex)), ink3)).toBeGreaterThanOrEqual(AA_BODY);
    }
  });

  it('stops are ordered and span the full 0-1 range in every combination', () => {
    for (const v of ['descent', 'reading'] as const) {
      for (const t of ['light', 'dark'] as const) {
        const stops = rampFor(v, t);
        expect(stops[0][0]).toBe(0);
        expect(stops.at(-1)![0]).toBe(1);
        for (let i = 1; i < stops.length; i++) {
          expect(stops[i][0]).toBeGreaterThan(stops[i - 1][0]);
        }
      }
    }
  });
});

describe('luminanceRange — why the two variants need different mechanisms', () => {
  it('shows the reading ramp is far flatter, so displacement alone cannot show on it', () => {
    const d = luminanceRange(rampFor('descent', 'light'));
    const r = luminanceRange(rampFor('reading', 'light'));
    expect(d.span).toBeGreaterThan(0.8);
    expect(r.span).toBeLessThan(0.15);
    expect(d.span / r.span).toBeGreaterThan(5);
  });

  it('shows the dark descent ramp is also flat — hence its additive nebula', () => {
    expect(luminanceRange(rampFor('descent', 'dark')).span).toBeLessThan(0.1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
source ~/.nvm/nvm.sh && nvm use 24 && npx vitest run tests/skyPalette.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Move the four stop tables verbatim out of `FluidSky.astro` (they currently sit inline as `LIGHT_STOPS`, `DARK_STOPS`, `READING_LIGHT_STOPS`, `READING_DARK_STOPS`).

```ts
// The sky's colour data: one ramp per (variant, theme), mirroring the CSS tokens.
//
// These mirror --descent-grad and --reading-grad from tokens.css. They are
// duplicated here because the canvas is JS-painted and cannot read CSS custom
// properties per-stop; tests/skyPalette.test.ts asserts the properties that
// matter so drift is caught rather than assumed away.

import { wcagLuminance, type SkyVariant } from './skyLegibility';

export type RampStop = readonly [number, string];
export type Theme = 'light' | 'dark';

/** --descent-grad: the full dawn -> ground descent. Text over it is paper-coloured. */
const DESCENT_LIGHT: readonly RampStop[] = [
  [0.0, '#f4efe4'], [0.08, '#f0eadf'], [0.15, '#efe6d4'], [0.23, '#e2d2c2'],
  [0.3, '#ccc4b6'], [0.37, '#a6a8ad'], [0.44, '#7d7e88'], [0.52, '#565660'],
  [0.62, '#3a3833'], [0.78, '#2a2720'], [0.9, '#1d1b16'], [1.0, '#16140f'],
];

/** The dark twin: a charcoal void. Its luminance span is tiny by design. */
const DESCENT_DARK: readonly RampStop[] = [
  [0.0, '#16191d'], [0.2, '#131619'], [0.4, '#111417'],
  [0.6, '#0e1013'], [0.8, '#0b0d0f'], [1.0, '#08090b'],
];

/** --reading-grad: stays luminous top-to-bottom so DARK ink reads all the way down. */
const READING_LIGHT: readonly RampStop[] = [
  [0.0, '#f4efe4'], [0.24, '#f1ebe0'], [0.48, '#efe6d4'],
  [0.74, '#e7ddce'], [1.0, '#dcd5cf'],
];

const READING_DARK: readonly RampStop[] = [
  [0.0, '#14171b'], [0.48, '#131619'], [1.0, '#111417'],
];

export function rampFor(variant: SkyVariant, theme: Theme): readonly RampStop[] {
  if (variant === 'reading') return theme === 'dark' ? READING_DARK : READING_LIGHT;
  return theme === 'dark' ? DESCENT_DARK : DESCENT_LIGHT;
}

/**
 * Luminance span of a ramp.
 *
 * This is the quantity that decides which mechanism a variant can use at all:
 * the effect works by displacing WHERE along a ramp a pixel samples, so a ramp
 * with almost no span has nothing to reveal and needs an additive treatment
 * instead. Both the reading ramp and the dark descent ramp are in that category.
 */
export function luminanceRange(stops: readonly RampStop[]): {
  min: number; max: number; span: number;
} {
  const ys = stops.map(([, hex]) => wcagLuminance([
    parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16),
  ]));
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  return { min, max, span: max - min };
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
source ~/.nvm/nvm.sh && nvm use 24 && npx vitest run tests/skyPalette.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/skyPalette.ts tests/skyPalette.test.ts
git commit -m "feat(lib): extract sky ramps; cover the variant selection the audit found untested"
```

---

### Task 4: `skyShader.ts` — GLSL out of the component, with the inert cap removed

Removes finding A (the cap that never binds) and takes the backtick hazard out of the `.astro` file for good.

**Files:**
- Create: `src/lib/skyShader.ts`
- Modify: `src/components/proto/FluidSky.astro` (import the shader; delete the inline GLSL)

**Interfaces:**
- Consumes: `tintBudget`, `gateFor` semantics from `src/lib/skyLegibility` (values passed in as uniforms, not imported into GLSL).
- Produces:
  - `VERTEX_SHADER: string`
  - `fragmentShader(): string`
  - `SKY_UNIFORMS: readonly string[]` — the uniform names, so the component's lookup loop cannot drift from the shader.

- [ ] **Step 1: Create the shader module**

Move the GLSL verbatim from `FluidSky.astro`, then make exactly these changes:

1. **Delete `uniform float uReadCap` and the `readGuard` line that uses it.** It never binds (`0.230` max excursion vs a `0.34` cap), and the darkening is now bounded at its sources by `tintBudget`. Leaving a non-binding guard in place is worse than having none, because it reads as a guarantee.
2. Replace the inline gate arithmetic with uniforms `uGateDark` / `uGateLight`, supplied by `gateFor()`. The policy then has exactly one home.
3. Replace `uniform float uReading` usage for tint magnitude with `uTintMagnitude` / `uTintCap` / `uViscousFloor`, supplied by `tintBudget()`.
4. Strip every history comment. Each remaining comment states what the code does and why it must, in the present tense.

Export the uniform-name list alongside it:

```ts
export const SKY_UNIFORMS = [
  'uRamp', 'uAmp', 'uTime', 'uYOffset', 'uYSpan', 'uDepth0', 'uDepthSpan',
  'uGateTop', 'uGateDark', 'uGateLight', 'uDark', 'uNebula', 'uReading',
  'uTintMagnitude', 'uTintCap', 'uViscousFloor',
] as const;
```

- [ ] **Step 2: Wire the component to it**

In `FluidSky.astro`: `import { VERTEX_SHADER, fragmentShader, SKY_UNIFORMS } from '../../lib/skyShader';`, delete both inline template literals, and build the uniform-location map by iterating `SKY_UNIFORMS`.

- [ ] **Step 3: Verify the backtick hazard is gone**

```bash
grep -c '`' src/components/proto/FluidSky.astro
```

Expected: `0`. The component no longer contains a template literal at all, so the class of bug that broke the build five times is now structurally impossible there.

- [ ] **Step 4: Verify the shader still compiles and the page still paints**

```bash
source ~/.nvm/nvm.sh && nvm use 24 && npm run build
```

Then serve and confirm `live=true` on `/`, `/art`, `/research`, `/projects` in both themes. A GLSL error hides the canvas silently and is indistinguishable from "the effect is off", so a green build is NOT sufficient evidence here.

- [ ] **Step 5: Re-run the two critical reproductions**

Narrow past 640px with no reload: `.fluid-live` must go false and the gradient must return. Reading-page contrast behind `.lede` must stay >= 4.5:1 on both pages.

- [ ] **Step 6: Run gates and commit**

```bash
source ~/.nvm/nvm.sh && nvm use 24 && npm run build && npm test
git add -A && git commit -m "refactor(sky): move GLSL to lib/skyShader; drop the non-binding uReadCap"
```

---

### Task 5: Slim `FluidSky.astro` to lifecycle only

**Files:**
- Modify: `src/components/proto/FluidSky.astro`

**Interfaces:**
- Consumes: everything from Tasks 2-4.
- Produces: a component under 300 lines whose only job is WebGL lifecycle.

- [ ] **Step 1: Delete what now lives elsewhere**

Remove the inline stop tables (now `skyPalette`), the gate/tint arithmetic (now `skyLegibility`), and `buildRamp` (now `skyPalette.buildRampCanvas`).

- [ ] **Step 2: Rewrite the comments to state intent**

Every comment that narrates a past failure goes. The component header should say what the component is and what invariants it holds — not what it used to do. Keep exactly two historical notes, because they encode non-obvious hazards a future reader would otherwise re-introduce:
- the canvas must be opaque with no `mix-blend-mode` (a blended full-screen layer forces a compositor backdrop re-read every frame);
- `.fluid-live` must never outlive a visible canvas, and the CSS is breakpoint-gated so it cannot.

State both as invariants, not as war stories.

- [ ] **Step 3: Verify the size target**

```bash
wc -l src/components/proto/FluidSky.astro
```

Expected: under 300 (from 852).

- [ ] **Step 4: Full verification sweep**

Build; `live=true` on all four routes in both themes; both critical reproductions still fixed; `25-27` draws/sec on both archetypes; 0 pointermove listeners.

- [ ] **Step 5: Run gates and commit**

```bash
source ~/.nvm/nvm.sh && nvm use 24 && npm run build && npm test
git add -A && git commit -m "refactor(sky): FluidSky is now lifecycle only"
```

---

### Task 6: Restore the deleted guards and cover `paintTerrain`

Closes findings B and G. The guards were removed on a rationale that is false about the shipped code, and the branch's largest visual change has no test at all.

**Files:**
- Modify: `tests/edlSpend.test.ts`
- Create: `tests/paintTerrain.test.ts`

**Interfaces:**
- Consumes: `colormap`, `TERRAIN_LIGHT`, `edlSpend` from `src/lib/terrain`; `paintTerrain`, `buildGrid`, `TERRAIN_CONFIG_DEFAULTS` from `src/lib/terrainRender`.
- Produces: nothing.

- [ ] **Step 1: Delete the false NOTE and restore a correct guard**

`tests/edlSpend.test.ts:116` claims the ramp "has been reverted". It was not: `TERRAIN_LIGHT` ships `[58,40,18] / [104,108,126] / [154,168,196]`. Remove the NOTE and add a guard that pins the property the ramp exists to provide, over the range the renderer actually uses (`hn` reaches ~0.80, so sweeping to 1.0 tests values that never paint):

```ts
describe('TERRAIN_LIGHT carries elevation as VALUE', () => {
  it('spans real luminance across the RENDERED elevation range', () => {
    // hn maxes near 0.80 on screen; asserting over 0..1 would pass on values that
    // never paint, which is how the previous guard came to be deleted as useless.
    const ys: number[] = [];
    for (let hn = 0; hn <= 0.80001; hn += 0.05) {
      ys.push(wcagLuminance(colormap(hn, TERRAIN_LIGHT) as [number, number, number]));
    }
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(0.30);
  });

  it('is not iso-luminant — reverting to a flat ramp must fail this', () => {
    const lo = wcagLuminance(colormap(0.05, TERRAIN_LIGHT) as [number, number, number]);
    const hi = wcagLuminance(colormap(0.78, TERRAIN_LIGHT) as [number, number, number]);
    expect(Math.abs(hi - lo)).toBeGreaterThan(0.20);
  });
});
```

- [ ] **Step 2: Run to verify the new guards pass and would catch a revert**

```bash
source ~/.nvm/nvm.sh && nvm use 24 && npx vitest run tests/edlSpend.test.ts
```

Then temporarily set `TERRAIN_LIGHT` to main's values `{valley:[150,110,58], mid:[120,112,96], peak:[109,118,137]}` and re-run: the specs MUST fail. Revert the temporary change.

- [ ] **Step 3: Write the `paintTerrain` test**

```ts
import { describe, it, expect } from 'vitest';
import { buildGrid, paintTerrain, TERRAIN_CONFIG_DEFAULTS, starIdentity } from '../src/lib/terrainRender';
import { TERRAIN_LIGHT, TERRAIN_TERMINAL } from '../src/lib/terrain';

/** Minimal 2D-context recorder: paintTerrain only needs arc/fill/fillStyle/clearRect. */
function recordingCtx() {
  const calls: Array<{ r: number; fill: string }> = [];
  let pending = 0;
  return {
    calls,
    ctx: {
      clearRect() {},
      beginPath() {},
      arc(_x: number, _y: number, r: number) { pending = r; },
      set fillStyle(v: string) { calls.push({ r: pending, fill: v }); },
      get fillStyle() { return ''; },
      fill() {},
    } as unknown as CanvasRenderingContext2D,
  };
}

describe('paintTerrain', () => {
  const grid = buildGrid();

  it('paints dots for both themes without throwing', () => {
    for (const [ramp, darkness] of [[TERRAIN_LIGHT, 0], [TERRAIN_TERMINAL, 1]] as const) {
      const { ctx, calls } = recordingCtx();
      paintTerrain(ctx, grid, { ...TERRAIN_CONFIG_DEFAULTS, ramp, darkness, dotScale: 1 },
        1440, 900, 1, 0, 0);
      expect(calls.length).toBeGreaterThan(200);
      for (const c of calls) {
        expect(Number.isFinite(c.r)).toBe(true);
        expect(c.r).toBeGreaterThan(0);
        expect(c.fill).toMatch(/^rgba\(/);
      }
    }
  });

  it('applies the starfield ONLY when configured (light theme must be unaffected)', () => {
    const paint = (starfield: boolean) => {
      const { ctx, calls } = recordingCtx();
      paintTerrain(ctx, grid, { ...TERRAIN_CONFIG_DEFAULTS, ramp: TERRAIN_LIGHT, darkness: 0, dotScale: 1, starfield },
        1440, 900, 1, 0, 0);
      return calls.map((c) => c.fill).join('|');
    };
    expect(paint(false)).toBe(paint(false));       // deterministic
    expect(paint(true)).not.toBe(paint(false));    // the flag must actually do something
  });

  it('is deterministic for a fixed time — no hidden Math.random', () => {
    const once = () => {
      const { ctx, calls } = recordingCtx();
      paintTerrain(ctx, grid, { ...TERRAIN_CONFIG_DEFAULTS, ramp: TERRAIN_LIGHT, darkness: 0, dotScale: 1 },
        1440, 900, 1, 1.5, 0.04);
      return calls.map((c) => `${c.r.toFixed(3)}:${c.fill}`).join('|');
    };
    expect(once()).toBe(once());
  });
});
```

- [ ] **Step 4: Run it**

```bash
source ~/.nvm/nvm.sh && nvm use 24 && npx vitest run tests/paintTerrain.test.ts
```

Expected: PASS. If the recorder shape is wrong for the real `paintTerrain` call order, adjust the recorder — not the assertions.

- [ ] **Step 5: Run gates and commit**

```bash
source ~/.nvm/nvm.sh && nvm use 24 && npm run build && npm test
git add -A && git commit -m "test: restore the guards deleted on a false rationale; cover paintTerrain"
```

---

### Task 7: Correct every false measurement in a comment

Closes finding F and the `dotScale` figures. CLAUDE.md's "the math must stay honest" applies to justifications, not just to rendered math.

**Files:**
- Modify: `src/components/TerrainHero.astro:58-64`
- Modify: `src/lib/terrain.ts` (the `edlSpend` float-literal comment)
- Modify: any remaining comment in `src/lib/terrainRender.ts` or `src/lib/terrain.ts` quoting a luminance or contrast figure

- [ ] **Step 1: Recompute each quoted figure**

For every comment that states a measured number, either recompute it with WCAG luminance and correct it, or delete the figure and state the intent qualitatively. Prefer deleting: a number in a comment cannot be kept true, whereas a test can.

Specifically:
- `TerrainHero.astro:58-64` claims ink lands "~+5%" over shipped with "true parity ~1.05". The audit measured +27% and 0.955. Replace the whole block with a one-line statement of why `dotScale` is trimmed at all, and no figures.
- The `edlSpend` comment cites `0.19999999999999996`; the actual value is `0.20000000000000007`. Since the point is only "use the mix form so `d=1` is exact", state that and drop the literal.

- [ ] **Step 2: Verify no stale figures remain**

```bash
grep -rn 'L=0\.\|contrast [0-9]\|:1\b' src/lib/terrain.ts src/lib/terrainRender.ts src/components/TerrainHero.astro | grep -v '^\s*$'
```

Review each hit; every surviving number must be either currently true or removed.

- [ ] **Step 3: Run gates and commit**

```bash
source ~/.nvm/nvm.sh && nvm use 24 && npm run build && npm test
git add -A && git commit -m "docs: correct or remove every false measured figure in comments"
```

---

### Task 8: Final verification sweep and PR

**Files:** none modified.

- [ ] **Step 1: Gates**

```bash
source ~/.nvm/nvm.sh && nvm use 24 && npm run build && npm test
```

- [ ] **Step 2: Structural checks**

```bash
grep -c '`' src/components/proto/FluidSky.astro   # expect 0
wc -l src/components/proto/FluidSky.astro         # expect < 300
grep -c 'proto-' dist/sitemap-0.xml               # expect no matches
```

- [ ] **Step 3: Behavioural checks — all four routes, both themes**

`live=true`; narrow past 640px with no reload restores the gradient; GL context loss restores the gradient; reading-page contrast behind `.lede` >= 4.5:1 on both pages; 0 pointermove listeners; 25-27 draws/sec.

- [ ] **Step 4: Mutation check on the newly covered axes**

Each of these must now turn the suite red — that is the point of Task 3 and Task 6:
- swap `rampFor`'s variant branches
- revert `TERRAIN_LIGHT` to main's values
- invert the `starfield` gate

- [ ] **Step 5: Raise the PR**

Scope: the fluid sky only. Body states what shipped, the two criticals the audit caught and how each is now structurally prevented, the findings disproved and why, and the mutation checks that now guard the risky axes.

---

## Findings deliberately NOT actioned

Recording these matters as much as the fixes: acting on a false finding is its own defect.

- **"Light-theme descent pages have zone=0 across the dark-ink region, inverting contrast."** The arithmetic is right — `zone=0` for depth 0-0.348 and `topLift` does bias darkward by up to 0.484 — but measured on the real page the hero reads **13.79:1 with the fluid on vs 14.42:1 off**. `--ink-1` is dark enough that the bias cannot threaten it. No fix; the mechanism is understood and harmless here.
- **Rec.601 figures in shader comments.** Task 7 corrects the comments, but the *rendering* is unaffected: the shader's own luma weights are used only to compare against its own floors, never to claim a WCAG ratio.
- **Duplicated ramp data between `tokens.css` and `skyPalette.ts`.** Unavoidable — a JS-painted canvas cannot read per-stop CSS custom properties. Task 3 covers it with tests instead.
