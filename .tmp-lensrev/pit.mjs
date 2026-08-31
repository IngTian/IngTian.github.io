// NAIVE (score attached to role START) vs POINT-IN-TIME (score attached to the date its
// evidence became CHECKABLE). If these differ, the naive version has look-ahead bias --
// the exact thing a buy-side reader is trained to spot.
//
// [factor, startYear, evidenceYear, score, label]
const S = [
  ['exp', 2019, 2023, 2, 'B.Eng McGill (3.99 conferred at graduation)'],
  ['exp', 2021, 2021, 1, 'TikTok intern'],
  ['exp', 2021, 2023, 1, 'RA McGill'],
  ['exp', 2022, 2022, 1, 'Amazon intern'],
  ['exp', 2022, 2023, 2, 'Ericsson AI Lab'],
  ['exp', 2023, 2025, 2, 'TikTok Senior (review at exit)'],
  ['exp', 2023, 2025, 4, 'Freelance quant (score 4 IS the arXiv paper)'],
  ['exp', 2026, 2026, 2, 'Electronic Arts'],
  ['exp', 2027, 2027, 2, 'Incoming PhD (FUTURE)'],
  ['res', 2022, 2022, 4, 'SPIE self-attention'],
  ['res', 2025, 2025, 4, 'RL-BHRP arXiv (2025-08)'],
  ['res', 2026, 2026, 1, 'interest: multi-period'],
  ['res', 2026, 2026, 1, 'interest: risk parity'],
  ['res', 2026, 2026, 1, 'interest: RL alloc'],
  ['res', 2026, 2026, 1, 'interest: OR/convex'],
  ['prj', 2026, 2026, 2, 'witness'],
  ['prj', 2026, 2026, 2, 'manifold'],
  ['crf', 2020, 2020, 1, 'Rio Tinto award'],
  ['crf', 2021, 2021, 2, 'IEEExtreme'],
  ['crf', 2021, 2021, 1, 'Hatch'],
];
const keys = ['exp', 'res', 'prj', 'crf'];
function path(dateIdx, name) {
  console.log('\n== ' + name + ' ==');
  console.log('year | ' + keys.map((k) => k.padEnd(5)).join(' ') + '| effN');
  for (let y = 2019; y <= 2027; y++) {
    const live = S.filter((s) => s[dateIdx] <= y);
    const tot = live.reduce((a, s) => a + s[3], 0);
    const b = keys.map((k) => live.filter((s) => s[0] === k).reduce((a, s) => a + s[3], 0) / (tot || 1));
    const hhi = b.reduce((a, x) => a + x * x, 0);
    console.log(y, '|', b.map((x) => x.toFixed(3)).join(' '), '| ' + (tot ? (1 / hhi).toFixed(2) : '-'));
  }
}
path(1, 'NAIVE: score enters at role START (has look-ahead)');
path(2, 'POINT-IN-TIME: score enters when the artefact became checkable');

// The headline honesty question: what does RESEARCH beta look like in 2023 under each rule?
const naive23 = (() => {
  const live = S.filter((s) => s[1] <= 2023);
  const tot = live.reduce((a, s) => a + s[3], 0);
  return live.filter((s) => s[0] === 'res').reduce((a, s) => a + s[3], 0) / tot;
})();
const pit23 = (() => {
  const live = S.filter((s) => s[2] <= 2023);
  const tot = live.reduce((a, s) => a + s[3], 0);
  return live.filter((s) => s[0] === 'res').reduce((a, s) => a + s[3], 0) / tot;
})();
console.log('\nresearch beta as of 2023: naive ' + naive23.toFixed(3) + ' vs point-in-time ' + pit23.toFixed(3));
