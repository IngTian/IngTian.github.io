// src/lib/cowTalk.ts
// WHEN THE /projects COW TALKS, and which line comes next. Pure; the plumbing is projects.astro's script.
import type { SpokenLine } from './cowSpeech';

/** The unprompted line comes at a random point in this window, in ms; mayIdle() still has the last word. */
export const IDLE_EVERY_MS = [9000, 18000] as const;
/** How long a finished line stays up before the bubble fades. */
export const BUBBLE_MS = 5200;
/** One character typed per this many ms, like the terminal header. */
export const TYPE_MS = 19;
/** The greeting waits this long after the page is booted. */
export const HELLO_DELAY_MS = 900;

/** The next line of a set, in order and wrapping; `said` is how many of the set it has said so far. */
export function nextLine(lines: readonly SpokenLine[], said: number): { line: SpokenLine; said: number } {
  return { line: lines[said % lines.length], said: said + 1 };
}

/** An unprompted line never comes during the boot, nor within 14s of the last line, so it never talks over itself
 *  or over someone still reading what it just said. */
export function mayIdle(nowMs: number, lastSpokeMs: number, booting: boolean): boolean {
  return !booting && nowMs - lastSpokeMs >= 14000;
}

/** HOW MANY LINES IT SAYS UNPROMPTED IN ONE PAGE VIEW, and then it stops scheduling them. WCAG 2.2.2 (lib/motion.ts'
 *  MOTION_LIMIT_MS): a bubble that popped up, typed and hopped beside the listing every 14-30s, forever, was an
 *  auto-advancing thing with no way to stop it. Two keep the owner's "now and then", and with the greeting they add
 *  up to ~3.4s of movement (tests/cowTalk.test.ts adds it up); the rest of the idle set is a press away. None on a phone
 *  (it says only what it is asked, Task D) and none under reduced motion, where they were a box swapping its text. */
export function idleLines(phone: boolean, reduce: boolean): number {
  return phone || reduce ? 0 : 2;
}
