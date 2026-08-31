// 1) Where does each section sit in the descent gradient today, and where would
//    it sit if Mountains+Ground are replaced by 3 plates + a monitor wall?
// 2) What is the light-theme gradient COLOUR at those positions (tokens.css)?

const stops = [
  [0, '#f4efe4'], [8, '#f0eadf'], [15, '#efe6d4'], [23, '#e2d2c2'], [30, '#ccc4b6'],
  [37, '#a6a8ad'], [44, '#7d7e88'], [52, '#565660'], [62, '#3a3833'], [78, '#2a2720'],
  [90, '#1d1b16'], [100, '#16140f'],
];
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
function gradAt(pct) {
  for (let i = 0; i < stops.length - 1; i++) {
    const [p0, c0] = stops[i], [p1, c1] = stops[i + 1];
    if (pct >= p0 && pct <= p1) {
      const t = (pct - p0) / (p1 - p0);
      const a = hex(c0), b = hex(c1);
      return a.map((v, k) => Math.round(v + (b[k] - v) * t));
    }
  }
  return hex(stops.at(-1)[1]);
}
const lum = ([r, g, b]) => {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const PAPER = hex('#efe9dd');

// measured today @1440x900
const today = { heights: [0, 972], interlude: [972, 702], mountains: [1674, 2399], ground: [4073, 545], signature: [4618, 193] };
const docToday = 4811;

console.log('=== TODAY (docH ' + docToday + 'px) ===');
for (const [k, [top, h]] of Object.entries(today)) {
  const p0 = 100 * top / docToday, p1 = 100 * (top + h) / docToday;
  console.log(`${k.padEnd(10)} ${p0.toFixed(1)}%–${p1.toFixed(1)}%  sky@mid rgb(${gradAt((p0 + p1) / 2)})  paper-on-sky@mid ${ratio(PAPER, gradAt((p0 + p1) / 2)).toFixed(2)}:1`);
}

// scenario: plates each ~1 screen (900). pile 900, journal 2 spreads 1800, wall 1100.
for (const [label, deskH] of [['3 plates, lean (pile 900 + journal 1800 + wall 1100)', 3800], ['3 plates, 3 journal spreads', 4700]]) {
  const newDoc = docToday - today.mountains[1] - today.ground[1] + deskH;
  const secs = { heights: [0, 972], interlude: [972, 702], desk: [1674, deskH], signature: [1674 + deskH, 193] };
  console.log(`\n=== ${label} → docH ${newDoc}px (${(newDoc / docToday).toFixed(2)}x) ===`);
  for (const [k, [top, h]] of Object.entries(secs)) {
    const p0 = 100 * top / newDoc, p1 = 100 * (top + h) / newDoc;
    console.log(`${k.padEnd(10)} ${p0.toFixed(1)}%–${p1.toFixed(1)}%  sky@mid rgb(${gradAt((p0 + p1) / 2)})`);
  }
  // the tagline: Interlude is centred (flex items-center) -> its midpoint
  const tagPct = 100 * (972 + 702 / 2) / newDoc;
  const tagToday = 100 * (972 + 702 / 2) / docToday;
  console.log(`tagline sits at ${tagPct.toFixed(1)}% (today ${tagToday.toFixed(1)}%) sky rgb(${gradAt(tagPct)}) vs today rgb(${gradAt(tagToday)})`);
  // FluidSky legibility gate = #mountains top / scrollHeight
  console.log(`FluidSky gateTop -> ${(1674 / newDoc).toFixed(3)} (today ${(1674 / docToday).toFixed(3)})`);
}

console.log('\n=== paper #efe9dd sheet vs the light-theme sky it would sit on ===');
for (const p of [40, 50, 60, 70, 80, 85]) {
  const s = gradAt(p);
  console.log(`${p}%  sky rgb(${s})  L=${lum(s).toFixed(3)}  paper/sky ratio ${ratio(PAPER, s).toFixed(2)}:1`);
}
