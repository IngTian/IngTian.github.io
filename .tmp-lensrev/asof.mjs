// Does the TIME lens actually produce a moving, honest number?
// Signals with a real DATE only. Research interests (4x score 1) have NO date at
// all -- they are declared today, so they can only enter at "now", never earlier.
const S = [
  ['exp', 2019, 2, 'B.Eng McGill'],
  ['exp', 2021, 1, 'RA McGill'],
  ['exp', 2021, 1, 'TikTok intern'],
  ['exp', 2022, 2, 'Ericsson AI Lab'],
  ['exp', 2022, 1, 'Amazon intern'],
  ['exp', 2023, 4, 'Freelance quant'],
  ['exp', 2023, 2, 'TikTok Senior'],
  ['exp', 2026, 2, 'Electronic Arts'],
  ['exp', 2027, 2, 'Incoming PhD'],
  ['res', 2022, 4, 'SPIE self-attention'],
  ['res', 2025, 4, 'RL-BHRP arXiv'],
  ['res', 2026, 1, 'interest: multi-period'],
  ['res', 2026, 1, 'interest: risk parity'],
  ['res', 2026, 1, 'interest: RL alloc'],
  ['res', 2026, 1, 'interest: OR/convex'],
  ['prj', 2026, 2, 'witness'],
  ['prj', 2026, 2, 'manifold'],
  ['crf', 2020, 1, 'Rio Tinto award'],
  ['crf', 2021, 2, 'IEEExtreme'],
  ['crf', 2021, 1, 'Hatch'],
];
const keys = ['exp', 'res', 'prj', 'crf'];
console.log('year  n  tot | ' + keys.join('     ') + '   | effN  concentration');
for (let y = 2019; y <= 2027; y++) {
  const live = S.filter((s) => s[1] <= y);
  const tot = live.reduce((a, s) => a + s[2], 0);
  const b = keys.map((k) => live.filter((s) => s[0] === k).reduce((a, s) => a + s[2], 0) / (tot || 1));
  const hhi = b.reduce((a, x) => a + x * x, 0);
  console.log(
    y,
    String(live.length).padStart(2),
    String(tot).padStart(3),
    '|',
    b.map((x) => x.toFixed(3)).join('  '),
    '| effN ' + (1 / hhi).toFixed(2),
  );
}
// How many DISTINCT concurrent intervals at each year -- does a Gantt have rows to stack?
console.log('\nconcurrency of timeline intervals (roles+degrees):');
const IV = [
  [2019, 2023, 'B.Eng'], [2021, 2021, 'TT intern'], [2021, 2023, 'RA'],
  [2022, 2022, 'Amazon'], [2022, 2023, 'Ericsson'], [2023, 2025, 'TT senior'],
  [2023, 2026, 'Independent quant'], [2026, 2026, 'EA'], [2027, 2027, 'PhD'],
];
for (let y = 2019; y <= 2027; y++) {
  const on = IV.filter(([a, b]) => a <= y && y <= b);
  console.log(y, on.length, on.map((x) => x[2]).join(', '));
}
