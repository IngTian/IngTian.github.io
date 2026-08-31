// Drafting the cow against the owner's reference: a classic 8-bit Holstein, side view, facing left, head LOWERED,
// white fill with a BLACK OUTLINE, black patches, a big pink muzzle, ears on top, tail with a tuft.
//
// What my last one was missing, comparing to the reference:
//   * an OUTLINE. Mine was a solid silhouette; the reference is white FILL inside dark ink. That single change
//     is most of why the reference reads as a drawing of a cow and mine read as a blob with legs.
//   * a LOWERED HEAD with a big muzzle. Mine held its head level, which reads as a dog or a pig.
//   * EARS on top of the head.
//   * a TUFTED tail, not a bare line.
//
// '#' ink (outline, patches, eye, hooves) · '+' fill (the white of the cow) · 'o' muzzle · '.' transparent

const DRAFTS: Record<string, string[]> = {
  cow: [
    '.................####.......',
    '................##++##......',
    '..##...........##++++##.....',
    '.#++#.........##++++++##....',
    '.#++#........##++##++++##...',
    '##++##......##++##..##++##..',
    '#++++#.....##++##....##++#..',
    '#+##+#....##++##......#++#..',
    '#++++###############++##++#.',
    '#+oo++++++++++++++++++#+++#.',
    '#+oo++++###+++++++++++#+++#.',
    '##oo++++###++++++++++++###+.',
    '.#oo+++++#+++++++oo+++++#...',
    '.######++++++++++oo+++++#...',
    '...#++#++#++#+++++#++#++#...',
    '...#++#++#++#+++++#++#++#...',
    '...#++#++#++#+++++#++#++#...',
    '...####++####+++++####++#...',
    '...................#####....',
  ],
};

const GLYPHS: Record<string, string> = { '#': '██', '+': '░░', o: '▓▓', '.': '  ' };

for (const [name, rows] of Object.entries(DRAFTS)) {
  const w = Math.max(...rows.map((r) => r.length));
  const bad = rows.map((r, i) => (r.length !== w ? `${i}:${r.length}` : null)).filter(Boolean);
  console.log(`\n=== ${name} — ${w}x${rows.length}${bad.length ? `  RAGGED ${bad.join(' ')}` : ''} ===\n`);
  for (const r of rows) console.log('  ' + r.padEnd(w, '.').split('').map((c) => GLYPHS[c] ?? '??').join(''));
  const count = (ch: string) => rows.join('').split('').filter((c) => c === ch).length;
  console.log(`\n  ink ${count('#')}  fill ${count('+')}  muzzle ${count('o')}`);
}
