// tests/motionLimit.test.ts
// WCAG 2.2.2 (Level A): motion that starts on its own and lasts more than five seconds needs a way to stop it. On
// /projects the three such things in the reading area — the idle prompt's cursor, manifold's video and the cow's
// unprompted lines — stop on their own instead. The video's rule is
// lib/galleryLayout.ts' videoPlays() and the cow's is lib/cowTalk.ts' idleLines(), each in its own spec; this holds
// the limit and the cursor, which is CSS, so its literals are read from the stylesheet the way artSizes pins CAL_MAX_H.
// It also holds the paper page's margin-note backstop, a pending state whose end is a CSS delay, to the same limit
// scripts/motion.ts' reveals end by, and Story's descent walk on /, which starts once its slide is on screen.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MOTION_LIMIT_MS } from '../src/lib/motion';

describe('MOTION_LIMIT_MS', () => {
  it("is WCAG 2.2.2's five seconds", () => {
    expect(MOTION_LIMIT_MS).toBe(5000);
  });
});

describe("the idle prompt's cursor (TerminalHeader.astro)", () => {
  const src = readFileSync(new URL('../src/components/projects/TerminalHeader.astro', import.meta.url), 'utf8');
  const blink = /\.cur \{ animation: term-blink ([\d.]+)s steps\(1\) (\w+); \}/.exec(src);

  it('blinks a counted number of times, inside the limit', () => {
    expect(blink, "the cursor's `animation: term-blink …` rule").not.toBeNull();
    const [, seconds, count] = blink!;
    // `infinite` is NaN here, which is the bug this replaced: a cursor beside the listing that blinked forever.
    expect(Number.isInteger(Number(count)), `iteration count "${count}"`).toBe(true);
    expect(Number(seconds) * 1000 * Number(count)).toBeLessThanOrEqual(MOTION_LIMIT_MS);
  });

  it('comes to rest solid: the only frame it is off is mid-cycle', () => {
    expect(src).toMatch(/@keyframes term-blink \{ 50% \{ opacity: 0; \} \}/);
  });

  it('starts counting when it appears, not while the boot is hiding it', () => {
    expect(src).toMatch(/:global\(html\.projects-boot\) \.idle \.cur \{ animation: none; \}/);
  });
});

describe("the margin notes' backstop (research/[slug].astro)", () => {
  const src = readFileSync(new URL('../src/pages/research/[slug].astro', import.meta.url), 'utf8');

  it('holds a wide note hidden until placed, and shows it after MOTION_LIMIT_MS if the script never runs', () => {
    const held = /@media not all and \(max-width: 1100px\) \{\s*@media screen and \(scripting: enabled\) \{\s*\.paper \.mn:not\(\.is-placed\) \{ visibility: hidden; animation: mn-unheld 0s (\d+)ms forwards; \}\s*\}\s*\}/.exec(src);
    expect(held, 'the `.paper .mn:not(.is-placed)` hold').not.toBeNull();
    expect(Number(held![1])).toBe(MOTION_LIMIT_MS);
    expect(src).toMatch(/@keyframes mn-unheld \{ to \{ visibility: visible; \} \}/);
    expect(src, 'place() marks a note placed').toContain("classList.add('is-placed')");
  });
});

describe("Story's descent walk (DescentPath.astro)", () => {
  const src = readFileSync(new URL('../src/components/DescentPath.astro', import.meta.url), 'utf8');

  it('ends, coda fade included, inside the limit', () => {
    const walk = /const DURATION_MS = (\d+);/.exec(src);
    const coda = /\.dp-coda \{[^}]*transition: opacity ([\d.]+)s/.exec(src);
    expect(walk, "the walk's `DURATION_MS`").not.toBeNull();
    expect(coda, "the coda's `transition: opacity …s`").not.toBeNull();
    // The coda shows on discovery, which can come as late as the walk's last frame: count both in full.
    expect(Number(walk![1]) + Number(coda![1]) * 1000).toBeLessThanOrEqual(MOTION_LIMIT_MS);
  });
});
