// src/lib/projectsBoot.ts
// /projects' BOOT ("boot B", spec §3 and §11): the banner and the gallery are on screen from the first frame, the
// banner as a dim ghost that lights row by row; then the prompt types `ls --shipped`, the listing prints line by
// line, the summary appears, the pile fans out and the rows and cards below rise in.
//
// Two halves, both pure. shouldBoot() is WHETHER: pages/projects.astro's inline decider ships this very function
// (as its source), so the policy tested here is the one the browser runs. bootSteps()/bootState() are WHAT, at
// each moment: TerminalHeader renders bootState(steps, elapsed) on every tick, and a skip renders
// bootState(steps, Infinity) — so a skip and a full run cannot land in different places.

/** The session flag. Versioned: bump the suffix when the boot changes enough to want a second look mid-session. */
export const BOOT_SEEN_KEY = 'projects.boot.seen.v1';

/** The command the prompt types, and the mockup's per-key delay range in ms, drawn once per boot. */
export const BOOT_CMD = 'ls --shipped';
export const BOOT_KEY_MS = [38, 84] as const;

/**
 * The decider's deadline, from parse: past it the decider takes html.projects-boot off itself and tells the page
 * (`projects:booted`), so a header script that never arrives or throws hides nothing for longer than this. It must
 * outlast the longest boot the page can schedule (every key at the top of BOOT_KEY_MS) with room for a late frame;
 * tests/projectsBoot.test.ts holds that against today's banner and listing. In a hidden tab it ends a boot nobody is
 * watching, which is the better return: a finished page, not a 1.4s deal played on arrival.
 */
export const BOOT_DEADLINE_MS = 4500;

/**
 * Play the boot? Once per session (`force` is `?boot=1`, and overrides only that), and never under reduced motion,
 * at a deep link or at a restored scroll — each of those readers is already somewhere, and the boot starts at the
 * top. SHIPPED AS SOURCE into an inline script, so it must stay self-contained: one expression over its argument.
 */
export function shouldBoot(o: { seen: boolean; force: boolean; reduce: boolean; hash: string; restoredScroll: boolean }): boolean {
  return (o.force || !o.seen) && !o.reduce && o.hash === '' && !o.restoredScroll;
}

export type BootStep = { at: number; do: 'banner-row' | 'type' | 'line' | 'summary' | 'deal' | 'done'; i: number };

/**
 * The approved mockup's boot(), each action and then its sleep, as a schedule in ms. `line` 0 is the `# ideas…`
 * comment and 1..listLines the listing. A key's sleep is `keyDelays[i]`, else 61 — the mockup's 38–84ms jitter,
 * averaged; the component draws its own jitter once per boot.
 */
export function bootSteps(cmd: string, bannerRows: number, listLines: number, keyDelays?: readonly number[]): BootStep[] {
  const steps: BootStep[] = [];
  let t = 140;
  for (let i = 0; i < bannerRows; i++, t += 62) steps.push({ at: t, do: 'banner-row', i });
  t += 260;
  for (let i = 0; i < cmd.length; i++) {
    steps.push({ at: t, do: 'type', i });
    t += keyDelays?.[i] ?? 61;
  }
  t += 220;
  steps.push({ at: t, do: 'line', i: 0 });
  t += 150;
  for (let i = 1; i <= listLines; i++, t += 82) steps.push({ at: t, do: 'line', i });
  steps.push({ at: t, do: 'summary', i: 0 });
  t += 150 + 240;
  steps.push({ at: t, do: 'deal', i: 0 }, { at: t, do: 'done', i: 0 });
  return steps;
}

/** What is showing `tMs` into the boot: how many banner rows are lit, keys typed and lines printed. */
export function bootState(steps: readonly BootStep[], tMs: number): { rows: number; typed: number; lines: number; summary: boolean; dealt: boolean } {
  const n = (d: BootStep['do']): number => steps.filter((s) => s.do === d && s.at <= tMs).length;
  return { rows: n('banner-row'), typed: n('type'), lines: n('line'), summary: n('summary') > 0, dealt: n('deal') > 0 };
}
