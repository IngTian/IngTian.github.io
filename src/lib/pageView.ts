// src/lib/pageView.ts
// WHEN a /projects script that must not wait for the pictures starts. astro:page-load is the site's re-init hook,
// but on a FULL load Astro fires it from window `load` (node_modules/astro/dist/transitions/router.js), and `load`
// waits for every font and eager subresource: under DevTools' slow-4G emulation, ~520ms after first paint with the
// listing hidden and no skip listening, and never at all when one of them does not arrive. (Every /projects picture
// is lazy, and in headless Chrome 156 a held lazy picture did not hold `load`; held fonts did.) A bundled module
// script runs right after parse.
//
// So init runs NOW when the document is still loading its subresources, and again on each astro:page-load that
// brings a DOM it has not run for — a ClientRouter arrival, or a departure whose teardown must run. init returns
// its teardown, and this runs it before the next init. The page-load that ends a full load finds the same element
// and does nothing: the element, not a flag, because a flag cannot tell that page-load from the next arrival's.
//
// It touches the DOM despite living in lib/, the exception lib/introSession.ts makes for the same reason: six scripts
// share it (TerminalHeader, ProjectAsk, Gallery, DraftingField, and the page's ask dispatcher and cow), and a
// component cannot import one.

/** Run `init` for this page view's `selector` element: now on a full load, then once per new DOM, each time after
 *  the teardown the last init returned. */
export function onPageView(selector: string, init: () => (() => void) | undefined): void {
  let ranFor: Element | null = null;
  let teardown: (() => void) | undefined;
  const run = (): void => {
    const el = document.querySelector(selector);
    if (el && el === ranFor) return;
    ranFor = el;
    teardown?.();
    teardown = init();
  };
  if (document.readyState !== 'complete') run();
  document.addEventListener('astro:page-load', run);
}
