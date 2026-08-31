import { spawn } from 'node:child_process';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9341;
const chrome = spawn(CHROME, [`--remote-debugging-port=${PORT}`, '--headless=new', '--window-size=1440,900',
  '--user-data-dir=/tmp/cdp-cost', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(2500);
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => { ws.onopen = r; });
let id = 0; const p = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && p.has(m.id)) { p.get(m.id)(m); p.delete(m.id); } };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; p.set(i, (m) => res(m.result ?? m.error)); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Page.enable'); await send('Runtime.enable');
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }))?.result?.value;

for (const rate of [1, 4]) {
  await send('Emulation.setCPUThrottlingRate', { rate });
  await send('Page.navigate', { url: 'http://localhost:4399/index.html' });
  await sleep(4000);
  const r = await ev(`(async () => {
    const c = document.querySelector('.pod-canvas');
    const m = await import('/_astro/podPaint.js').catch(()=>null);
    // can't import the chunk; instead time a forced repaint via the MutationObserver path
    const t = [];
    for (let i = 0; i < 12; i++) {
      const t0 = performance.now();
      document.documentElement.dataset.podStyle = (i % 2) ? 'dots' : 'dots';
      document.documentElement.setAttribute('data-pod-style', 'dots');
      // force a synchronous read of the canvas to flush the paint
      c.getContext('2d').getImageData(0,0,1,1);
      await new Promise(r => requestAnimationFrame(r));
      t.push(performance.now() - t0);
    }
    const longTasks = performance.getEntriesByType('longtask') || [];
    return { repaints: t.map(x=>+x.toFixed(1)),
             nav: (()=>{const n=performance.getEntriesByType('navigation')[0]; return n?{domInteractive:+n.domInteractive.toFixed(0), loadEnd:+n.loadEventEnd.toFixed(0)}:null;})(),
             longTasks: longTasks.map(l=>+l.duration.toFixed(0)),
             rafRunning: !!window.requestAnimationFrame };
  })()`);
  console.log('rate=' + rate, JSON.stringify(r));
}
ws.close(); chrome.kill(); process.exit(0);
