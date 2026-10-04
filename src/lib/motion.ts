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
