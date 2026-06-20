// Pure justified-rows packing for the photo grid: greedily fill each row to the
// container width at ~targetHeight, preserving order, never cropping (each
// image keeps its true aspect ratio; the row's height is solved so widths +
// gaps == containerWidth). Mirrors the Flickr/Google "justified layout" idea.
// Unit-tested; runs client-side on load/resize.

export interface JustifiedRow {
  height: number;
  indices: number[];
}

export function justifyRows(
  ars: number[],
  containerWidth: number,
  targetHeight: number,
  gap: number,
): JustifiedRow[] {
  const rows: JustifiedRow[] = [];
  let row: number[] = [];
  let arSum = 0;

  const flush = (last: boolean) => {
    if (row.length === 0) return;
    const gaps = gap * (row.length - 1);
    // height so that sum(ar*h) + gaps == containerWidth  =>  h = (W - gaps) / arSum
    let height = (containerWidth - gaps) / arSum;
    if (last) height = Math.min(height, targetHeight * 1.16); // don't blow up a lone last row
    rows.push({ height, indices: row });
    row = [];
    arSum = 0;
  };

  for (let i = 0; i < ars.length; i++) {
    row.push(i);
    arSum += ars[i];
    const gaps = gap * (row.length - 1);
    // close the row once its projected height would drop to/below target
    if ((containerWidth - gaps) / arSum <= targetHeight) flush(false);
  }
  flush(true);
  return rows;
}
