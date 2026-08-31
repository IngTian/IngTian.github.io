// Measure the Rules slide's real height budget at the three target viewports.
const PORT = process.env.CDP || 9222;
const V = await (await fetch(`http://localhost:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
const sock = new WebSocket(V.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
sock.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
await new Promise((r) => sock.addEventListener('open', r));
const send = (method, params = {}) => { const i = ++id; return new Promise((res) => { pending.set(i, res); sock.send(JSON.stringify({ id: i, method, params })); }); };
async function ev(x) {
  const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) return 'ERR: ' + JSON.stringify(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails);
  return r.result?.result?.value;
}
await send('Page.enable'); await send('Runtime.enable');

const SIZES = [[1700, 1050], [1366, 768], [900, 1050]];
const script = `
(function(){
  var r = function(s){ var el = document.querySelector(s); if(!el) return null; var b = el.getBoundingClientRect();
    return { w: Math.round(b.width), h: Math.round(b.height), x: Math.round(b.x), y: Math.round(b.y) }; };
  var cs = function(s, p){ var el = document.querySelector(s); return el ? getComputedStyle(el)[p] : null; };
  var panelHeights = {};
  document.querySelectorAll('#rules [data-panel]').forEach(function(p){
    // real content height of each panel = sum of its children's outer boxes
    var kids = Array.from(p.children).map(function(k){ return Math.round(k.getBoundingClientRect().height); });
    panelHeights['panel'+p.dataset.panel] = { own: Math.round(p.getBoundingClientRect().height), kids: kids,
      kidSum: kids.reduce(function(a,b){return a+b;},0), scroll: p.scrollHeight };
  });
  return JSON.stringify({
    vp: [window.innerWidth, window.innerHeight],
    section: r('#rules'), paper: r('.ru-paper'), inner: r('.ru-inner'),
    kicker: r('.ru-kicker'), split: r('.ru-split'),
    say: r('.ru-say'), head: r('.ru-head'), beats: r('.ru-beats'), scale: r('.ru-scale'),
    fig: r('.ru-fig'), figHead: r('.ru-fig-head'), stagebox: r('.ru-stagebox'), cap: r('.ru-cap'),
    beatBodyFS: cs('.ru-beat-body','fontSize'), beatHeadFS: cs('.ru-beat-head','fontSize'),
    scaleFS: cs('.ru-scale','fontSize'), headFS: cs('.ru-head','fontSize'),
    paperPadTop: cs('.ru-paper','paddingTop'),
    innerPadLeft: cs('.ru-inner','paddingLeft'),
    panels: panelHeights,
    railRight: (function(){ var t=document.querySelector('.toc'); return t? Math.round(t.getBoundingClientRect().right):null; })()
  }, null, 1);
})()`;

for (const [w, h] of SIZES) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'http://localhost:4399/' });
  await new Promise((r) => setTimeout(r, 2600));
  await ev(`document.querySelector('#rules').scrollIntoView()`);
  await new Promise((r) => setTimeout(r, 900));
  console.log(`\n===== ${w}x${h} =====`);
  console.log(await ev(script));
}
sock.close(); process.exit(0);
