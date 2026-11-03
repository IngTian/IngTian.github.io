// src/lib/galleryLayout.ts
// /projects' gallery — a fan of project pictures in 3D — as numbers, and the one click rule every project surface
// on the page shares (gallery card, selected row, workshop card). Pure: the components own the DOM.

/** The fan, left to right: the mockup's order, quant projects in the middle of the hand. */
export const GALLERY_ORDER = ['rl-bhrp', 'trading-desk', 'offchart', 'manifold', 'witness', 'daylogs'] as const;

const r2 = (v: number): number => Math.round(v * 100) / 100;

/**
 * Card `i` of `n`, as the CSS custom properties it is posed with: `x` (px, at full spread), `z` (px), `ry`/`rz`
 * (deg), `zi` (its stacking order — a custom property, never an inline z-index, which would beat the hover rule
 * and leave a card behind its neighbour while it is lifted), and `pile` (deg — its turn in the visible pile the
 * boot deals from, alternating ±2 so neighbours never lie exactly on each other). Rounded to 0.01, so the
 * markup reads -3.3 rather than -3.3000000000000003.
 */
export function fanPose(i: number, n: number): { x: number; z: number; ry: number; rz: number; zi: number; pile: number } {
  const k = i - (n - 1) / 2;
  return {
    x: r2(150 * k),
    z: r2(-70 * Math.abs(k)),
    ry: r2(-9 * k),
    rz: r2(2.2 * k),
    zi: 10 - Math.round(2 * Math.abs(k)),
    pile: r2(3.4 * k + (i % 2 ? 2 : -2)),
  };
}

/** How long a card may wait for its picture before it leaves the loading state regardless. */
export const READY_MS = 4000;

/** Whether a card stops shimmering: when its picture has loaded, or once READY_MS has passed without it — a
 *  picture that is slow or never arrives must not leave a card shimmering forever. */
export function readyAfter(loaded: boolean, elapsedMs: number): boolean {
  return loaded || elapsedMs >= READY_MS;
}

interface ClickLike { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; clientX: number; clientY: number }
interface BoxLike { left: number; top: number; width: number; height: number }

/**
 * Where a click on a project asks "open on GitHub?", or null when it should fall through to the link: a modifier
 * or a non-primary button (cmd/ctrl/middle-click) opens the repo directly, as a reader doing that expects. A
 * keyboard activation (Enter, or Space on a button) reports no pointer — (0, 0) — so it asks at the element's
 * centre instead. MouseEvent and DOMRect satisfy the two shapes as they are.
 */
export function askPoint(e: ClickLike, box: BoxLike): { x: number; y: number } | null {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
  if (e.clientX === 0 && e.clientY === 0) return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  return { x: e.clientX, y: e.clientY };
}
