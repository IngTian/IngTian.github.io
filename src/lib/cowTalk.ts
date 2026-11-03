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

/** An unprompted line never comes within 14s of the last line, so it never talks over itself or over someone still
 *  reading what it just said. Arrival counts as a line, so that is never during the boot (BOOT_DEADLINE_MS, 4.5s). */
export function mayIdle(nowMs: number, lastSpokeMs: number): boolean {
  return nowMs - lastSpokeMs >= 14000;
}

/** Unprompted lines per page view (two keep the owner's "now and then"), then it waits to be asked (MOTION_LIMIT_MS;
 *  tests/cowTalk.test.ts adds up the ~3.4s). None on a phone or under reduced motion. */
export function idleLines(phone: boolean, reduce: boolean): number {
  return phone || reduce ? 0 : 2;
}
