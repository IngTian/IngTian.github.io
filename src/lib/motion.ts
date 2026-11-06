// Shared motion guard. ALL animation on the site is gated behind the user's
// reduced-motion preference (the finished, no-motion state must always look
// complete). Every vanilla <script> reads it through this one helper instead
// of re-typing the media query string. (There is no island to gate: CLAUDE.md, Stack.)

/** True when the user has asked the OS to minimize non-essential motion. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** WCAG 2.2.2: motion that starts on its own and runs past this needs a way to stop it. What is and is not yet
 *  held to it: CLAUDE.md, Motion. */
export const MOTION_LIMIT_MS = 5000;
