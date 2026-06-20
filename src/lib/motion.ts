// Shared motion guard. ALL animation on the site is gated behind the user's
// reduced-motion preference (the finished, no-motion state must always look
// complete). Both the React island and the vanilla <script>s read it through
// this one helper instead of re-typing the media query string.

/** True when the user has asked the OS to minimize non-essential motion. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
