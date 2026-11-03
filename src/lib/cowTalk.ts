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
