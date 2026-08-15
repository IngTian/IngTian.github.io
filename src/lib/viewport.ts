// Shared phone guard. The site has a genuinely different shape on a phone — one nav mark instead of a
// capsule, collapsed explainers, no slide deck — and every one of those decisions has to agree on where the
// boundary is. This is the one place that answers it, in the same spirit as lib/motion.ts owning the motion
// gate: the string `640px` appears here, and callers ask a question instead of re-typing a media query.
//
// WHY A JS QUESTION AND NOT JUST CSS. Most of the phone treatment IS pure CSS and never comes near this file.
// This exists for the decisions CSS cannot express: whether to attach the deck's event listeners at all, and
// whether to build the collapsing disclosure. Those are behaviour, not presentation.
//
// KEPT IN SYNC WITH THE STYLESHEETS BY HAND, deliberately: the alternative is exporting the number into CSS
// through a custom property, which would put the breakpoint's source of truth in a place a media query
// cannot read anyway (`@media (max-width: var(--x))` is not valid CSS). So the rule is: if this number
// changes, the `@media (max-width: 640px)` blocks change with it. There is a test asserting the value, so a
// silent drift shows up as a failure rather than as a phone with half a treatment.

/** The phone breakpoint, in px. Mirrors every `@media (max-width: 640px)` block in the styles. */
export const PHONE_MAX_WIDTH = 640;

/**
 * True when the viewport is at or below the phone breakpoint.
 *
 * Uses matchMedia rather than innerWidth so it agrees with CSS exactly — innerWidth and the media query can
 * disagree by the scrollbar's width on desktop, which is precisely the kind of one-pixel disagreement that
 * would make the deck engage on a viewport whose styles think it is a phone.
 */
export function isPhone(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(`(max-width: ${PHONE_MAX_WIDTH}px)`).matches;
}
