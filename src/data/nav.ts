// src/data/nav.ts
// THE SITE'S PAGE SET — one source of truth for "where can you go from here".
//
// The owner: "it might be wiser to add navigations directly on the top right hovering bar, so it's always
// visible. the click stays an easter egg." Both halves matter. The hero's tagline links (/research, /art) are
// a discovery you make; navigation is a thing that must never require discovery. So the corner nav carries the
// real page set at all times, and the tagline keeps its quiet affordances as an easter egg.
//
// It lives in data/ rather than inside CornerNav because the page set is a FACT about the site, and the site
// has already shipped a link to a page that did not exist (/experience 404'd from a pod panel). A single
// exported list plus a test that every href resolves to a real route is what stops that recurring.

export interface NavPage {
  /** Route, root-relative. */
  href: string;
  /** What it says in the nav. */
  label: string;
}

/** Ordered by the site's own hierarchy: research first, art last — quant before avocation.
 *
 *  /writing sits directly after /research because it is the same subject at a different formality: the papers,
 *  then the thinking around them. It is a separate route rather than sections on /research on the owner's
 *  choice — a paper and a post have different contracts, and filing them together lets the informal writing
 *  borrow the paper's authority. */
export const PAGES: NavPage[] = [
  { href: '/research', label: 'Research' },
  { href: '/writing', label: 'Writing' },
  { href: '/projects', label: 'Projects' },
  { href: '/experience', label: 'Experience' },
  { href: '/art', label: 'Art' },
];
