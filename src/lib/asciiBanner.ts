// src/lib/asciiBanner.ts
// THE /projects BANNER — "PROJECTS" in ANSI Shadow, the block-letter style of a terminal's login banner, drawn as
// SVG rects rather than set as text. The site's mono face is a latin subset with none of these glyphs
// (█ ═ ║ ╔ ╗ ╚ ╝), so as text each would fall back per glyph to the system mono at its own width and the rows would
// stop lining up (spec §11). Rects are crisp at any size, cannot shift layout, and add no font.
//
// The letters are matrices, the way the cow's MOO glyph is (lib/pixels.ts): data, inspectable in a test.
// Pure: returns markup, touches no DOM.

/** One matrix per letter of PROJECTS — six rows each, every row of a letter the same width (O and T are 9, the
 *  rest 8). Copied from the approved mockup's `L`. */
export const ANSI_SHADOW: Record<'P' | 'R' | 'O' | 'J' | 'E' | 'C' | 'T' | 'S', readonly string[]> = {
  P: ['██████╗ ', '██╔══██╗', '██████╔╝', '██╔═══╝ ', '██║     ', '╚═╝     '],
  R: ['██████╗ ', '██╔══██╗', '██████╔╝', '██╔══██╗', '██║  ██║', '╚═╝  ╚═╝'],
  O: [' ██████╗ ', '██╔═══██╗', '██║   ██║', '██║   ██║', '╚██████╔╝', ' ╚═════╝ '],
  J: ['     ██╗', '     ██║', '     ██║', '██   ██║', '╚█████╔╝', ' ╚════╝ '],
  E: ['███████╗', '██╔════╝', '█████╗  ', '██╔══╝  ', '███████╗', '╚══════╝'],
  C: [' ██████╗', '██╔════╝', '██║     ', '██║     ', '╚██████╗', ' ╚═════╝'],
  T: ['████████╗', '╚══██╔══╝', '   ██║   ', '   ██║   ', '   ██║   ', '   ╚═╝   '],
  S: ['███████╗', '██╔════╝', '███████╗', '╚════██║', '███████║', '╚══════╝'],
};

/** The word's six banner rows, its letters joined by one space. */
export function bannerRows(word: string): string[] {
  const letters = [...word].map((ch) => {
    const m = ANSI_SHADOW[ch as keyof typeof ANSI_SHADOW];
    if (!m) throw new Error(`bannerRows: no ANSI Shadow matrix for "${ch}"`);
    return m;
  });
  return [0, 1, 2, 3, 4, 5].map((r) => letters.map((m) => m[r]).join(' '));
}

const THICK = 0.16;    // a box stroke's thickness, in cells
const OFFSET = 0.18;   // each line of a double stroke sits this far from the cell's centre line, in cells
/** Which way each corner's strokes run from the corner: [x, y], +1 = right / down. */
const CORNERS: Record<string, readonly [number, number]> = { '╔': [1, 1], '╗': [-1, 1], '╚': [1, -1], '╝': [-1, -1] };

type Box = readonly [number, number, number, number];   // x, y, width, height

/**
 * A box character's strokes, as rects, in the cell at (x0, y0). Every stroke runs between two points on its centre
 * line and overshoots each by half a stroke, like a square line cap. At a corner's joint that closes the corner; at
 * a cell edge it overlaps the neighbour, which is what lets the strokes be anti-aliased: two AA rects that merely
 * abut leave a seam where both half-cover a pixel, and overlapped by half a stroke the seam is covered.
 */
function strokes(ch: string, x0: number, y0: number, w: number, h: number): Box[] {
  const cx = x0 + w / 2, cy = y0 + h / 2, dx = OFFSET * w, dy = OFFSET * h, tx = THICK * w, ty = THICK * h;
  const hLine = (yc: number, xa: number, xb: number): Box =>
    [Math.min(xa, xb) - tx / 2, yc - ty / 2, Math.abs(xb - xa) + tx, ty];
  const vLine = (xc: number, ya: number, yb: number): Box =>
    [xc - tx / 2, Math.min(ya, yb) - ty / 2, tx, Math.abs(yb - ya) + ty];
  if (ch === '═') return [hLine(cy - dy, x0, x0 + w), hLine(cy + dy, x0, x0 + w)];
  if (ch === '║') return [vLine(cx - dx, y0, y0 + h), vLine(cx + dx, y0, y0 + h)];
  const dir = CORNERS[ch];
  if (!dir) throw new Error(`bannerSvg: cannot draw "${ch}"`);
  const [sx, sy] = dir;
  const xEdge = sx > 0 ? x0 + w : x0, yEdge = sy > 0 ? y0 + h : y0;
  // Two pairs, the outer (side -1) then the inner (+1). Each pair is a horizontal at yh and a vertical at xv that
  // meet at (xv, yh) and run out to the edges the corner points at, where the neighbouring ═ or ║ picks them up.
  return [-1, 1].flatMap((side) => {
    const yh = cy + side * sy * dy, xv = cx + side * sx * dx;
    return [hLine(yh, xv, xEdge), vLine(xv, yh, yEdge)];
  });
}

const num = (v: number): string => String(+v.toFixed(3));
const rect = ([x, y, w, h]: Box): string => `<rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}"/>`;

/**
 * The banner's rows as SVG, for the caller's `<svg>` (which owns the viewBox, the size and the paint):
 * `cols * cellW` by `rows * cellH`. Every row is a `<g class="row" data-row="i">`, so the boot can light rows one
 * at a time; a `█` is one rect filling its cell, and the box strokes go in the row's `<g class="shade">`. No
 * `<text>` anywhere — that is the point of drawing it.
 *
 * The shade groups are anti-aliased (`geometricPrecision`), whatever the caller sets for the blocks. A stroke is
 * 0.16 cell — 0.86 to 1.44 CSS px across a vertical one at the banner's clamp — and under crispEdges each edge
 * rounds to a device pixel on its own, so equal strokes drew 1 or 2px wide by where they started, and one under
 * a device pixel could round to nothing and vanish.
 */
export function bannerSvg(rows: readonly string[], cellW: number, cellH: number): string {
  return rows.map((row, r) => {
    const blocks: Box[] = [], shade: Box[] = [];
    [...row].forEach((ch, c) => {
      const x = c * cellW, y = r * cellH;
      if (ch === '█') blocks.push([x, y, cellW, cellH]);
      else if (ch !== ' ') shade.push(...strokes(ch, x, y, cellW, cellH));
    });
    return `<g class="row" data-row="${r}">${blocks.map(rect).join('')}` +
      `<g class="shade" shape-rendering="geometricPrecision">${shade.map(rect).join('')}</g></g>`;
  }).join('');
}
