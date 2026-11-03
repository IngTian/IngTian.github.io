// Shared motion guard. ALL animation on the site is gated behind the user's
// reduced-motion preference (the finished, no-motion state must always look
// complete). Every vanilla <script> reads it through this one helper instead
// of re-typing the media query string.
//
// This comment used to say "Both the React island and the vanilla <script>s".
// There is no island — the terminal was the site's only one and it was deleted
// along with react, react-dom and @astrojs/react. This was the last place in
// src/ still asserting otherwise, which matters because "NO REACT, AND NO
// CLIENT FRAMEWORK AT ALL" is the first correction CLAUDE.md asks a reader to
// make, and this file is imported by every animated component on the site.

/** True when the user has asked the OS to minimize non-essential motion. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * WCAG 2.2.2's five seconds: motion that starts on its own and runs longer needs a way to stop it. /projects' idle
 * cursor and manifold's video stop on their own inside it instead (tests/motionLimit.test.ts), and so does its cow:
 * the greeting and lib/cowTalk.ts' idleLines() unprompted lines, ~3.4s of movement in all, then it speaks only when
 * asked (tests/cowTalk.test.ts). It used to chatter every 14-30s for as long as the page was open. Not yet the
 * backgrounds: the hero terrain, the fluid sky and the drafting field drift for as long as they are on screen,
 * the site's older pattern, and are not held to this.
 */
export const MOTION_LIMIT_MS = 5000;
