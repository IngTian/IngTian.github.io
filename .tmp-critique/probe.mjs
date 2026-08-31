// Measure real page geometry over CDP: section rects, doc height, gradient stop
// at the Mountains/Ground zone, and the fluid canvas state.
const V = await (await fetch('http://localhost:9223/json/new?about:blank', { method: 'PUT' })).json();
const ws = V.webSocketDebuggerUrl;
const WebSocket = (await import('node:worker_threads'), globalThis.WebSocket);
const sock = new WebSocket(ws);
let id = 0;
const pending = new Map();
sock.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
});
await new Promise((r) => sock.addEventListener('open', r));
function send(method, params = {}) {
  const i = ++id;
  return new Promise((res) => { pending.set(i, res); sock.send(JSON.stringify({ id: i, method, params })); });
}
async function ev(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  return r.result?.result?.value;
}
await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: 'http://localhost:4322/' });
await new Promise((r) => setTimeout(r, 3500));

const out = await ev(`(() => {
  const ids = ['heights','interlude','mountains','ground','signature'];
  const docH = document.documentElement.scrollHeight;
  const secs = ids.map(i => {
    const el = document.getElementById(i);
    if (!el) return { id: i, missing: true };
    const r = el.getBoundingClientRect();
    const top = r.top + window.scrollY;
    return { id: i, top: Math.round(top), h: Math.round(r.height), pctTop: +(100*top/docH).toFixed(1), pctBot: +(100*(top+r.height)/docH).toFixed(1) };
  });
  const main = document.querySelector('main');
  const cs = getComputedStyle(main);
  return JSON.stringify({
    docH, vh: window.innerHeight, secs,
    mainBg: cs.backgroundImage.slice(0,60),
    fluidLive: main.classList.contains('fluid-live'),
    canvasDisplay: getComputedStyle(document.querySelector('[data-fluid-canvas]')).display,
    islandCount: document.querySelectorAll('astro-island').length,
    terminalRect: (() => { const t = document.querySelector('.terminal-chrome'); if(!t) return null; const r=t.getBoundingClientRect(); return { top: Math.round(r.top+window.scrollY), h: Math.round(r.height), pct: +(100*(r.top+window.scrollY)/docH).toFixed(1) }; })(),
  });
})()`);
console.log(out);

// scroll to mountains and sample the actual painted sky colour behind content
await ev(`document.getElementById('mountains').scrollIntoView(); true`);
await new Promise((r) => setTimeout(r, 1200));
const shot = await send('Page.captureScreenshot', { format: 'png' });
const fs = await import('node:fs');
fs.writeFileSync('/Users/zetian/devpro/ing/IngTian.github.io/.claude/worktrees/scroll-reveal/.tmp-critique/mountains.png', Buffer.from(shot.result.data, 'base64'));

const px = await ev(`(async () => {
  // read the fluid canvas' painted colour near the mountains zone via drawImage
  const c = document.querySelector('[data-fluid-canvas]');
  return JSON.stringify({ w: c.width, h: c.height, clientW: c.clientWidth, clientH: c.clientHeight });
})()`);
console.log(px);
sock.close();
process.exit(0);
