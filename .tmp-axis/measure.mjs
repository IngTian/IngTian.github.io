// Measure the Rules slide's real vertical budget at the three required viewports.
const V = await (await fetch('http://localhost:9222/json/new?about:blank', { method: 'PUT' })).json();
const sock = new WebSocket(V.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
sock.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
await new Promise((r) => sock.addEventListener('open', r));
const send = (method, params = {}) => { const i = ++id; return new Promise((res) => { pending.set(i, res); sock.send(JSON.stringify({ id: i, method, params })); }); };
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
await send('Page.enable'); await send('Runtime.enable');

const PROBE = `(() => {
  const q = (s) => document.querySelector(s);
  const box = (s) => { const el = q(s); if (!el) return null; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    return { h: +r.height.toFixed(1), w: +r.width.toFixed(1), top: +r.top.toFixed(1), left: +r.left.toFixed(1),
      fs: cs.fontSize, mt: cs.marginTop, mb: cs.marginBottom, pt: cs.paddingTop, pb: cs.paddingBottom }; };
  const sec = q('#rules');
  const r = sec.getBoundingClientRect();
  // tallest of the four panels, measured by natural content height
  const panels = Array.from(sec.querySelectorAll('[data-panel]')).map((p, i) => {
    const kids = Array.from(p.children).map((k) => k.getBoundingClientRect().height);
    return { i, own: +p.getBoundingClientRect().height.toFixed(1), kidsum: +kids.reduce((a, b) => a + b, 0).toFixed(1), scroll: p.scrollHeight };
  });
  return JSON.stringify({
    vw: innerWidth, vh: innerHeight,
    section: { h: +r.height.toFixed(1), top: +(r.top + scrollY).toFixed(1) },
    paper: box('.ru-paper'), inner: box('.ru-inner'),
    kicker: box('.ru-kicker'), split: box('.ru-split'), say: box('.ru-say'), fig: box('.ru-fig'),
    head: box('.ru-head'), beats: box('.ru-beats'), beat0: box('.ru-beat'), scale: box('.ru-scale'),
    fighead: box('.ru-fig-head'), stagebox: box('.ru-stagebox'), cap: box('.ru-cap'),
    fanchart: box('.ru-fanchart'), cats: box('.ru-cats'), rungs: box('.ru-rungs'), tally: box('.ru-tally'),
    panels,
    railRight: (() => { const t = document.querySelector('.toc, [class*=toc]'); if (!t) return null; const b = t.getBoundingClientRect(); return { l: +b.left.toFixed(1), r: +b.right.toFixed(1), w: +b.width.toFixed(1) }; })(),
  });
})()`;

const results = {};
for (const [w, h] of [[1700, 1050], [1366, 768], [900, 1050]]) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'http://localhost:4321/' });
  await new Promise((r) => setTimeout(r, 2600));
  await ev(`document.getElementById('rules').scrollIntoView(); true`);
  await new Promise((r) => setTimeout(r, 900));
  results[`${w}x${h}`] = JSON.parse(await ev(PROBE));
}
console.log(JSON.stringify(results, null, 1));
sock.close(); process.exit(0);
