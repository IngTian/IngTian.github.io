// Drive headless Chrome over CDP: screenshot the pod at both themes + measure geometry.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;
const OUT = new URL('.', import.meta.url).pathname;

const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`,
  '--headless=new',
  '--window-size=1440,900',
  '--user-data-dir=/tmp/cdp-pod-profile',
  '--no-first-run',
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(2500);

const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const target = list.find((t) => t.type === 'page');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => { ws.onopen = r; });

let id = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
};
const send = (method, params = {}) => new Promise((res) => {
  const myId = ++id;
  pending.set(myId, (msg) => res(msg.result ?? msg.error));
  ws.send(JSON.stringify({ id: myId, method, params }));
});

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false });

async function go(url) {
  await send('Page.navigate', { url });
  await sleep(3500);
}
const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  return r?.result?.value;
};
async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  if (r?.data) writeFileSync(OUT + name, Buffer.from(r.data, 'base64'));
  else console.log('shot failed', name, JSON.stringify(r).slice(0, 200));
}

await go('http://localhost:4399/');

// page geometry
const geom = await evaluate(`(() => {
  const d = document.documentElement;
  const sec = id => { const e = document.getElementById(id); if (!e) return null;
    const r = e.getBoundingClientRect(); const top = r.top + window.scrollY;
    return { top: +(top/d.scrollHeight*100).toFixed(1), h: Math.round(r.height),
             pct: +(r.height/d.scrollHeight*100).toFixed(1) }; };
  return { docH: d.scrollHeight, mountains: sec('mountains'), pod: sec('pod'),
           ground: sec('ground'), interlude: sec('interlude'),
           islands: document.querySelectorAll('astro-island').length,
           podCanvas: (()=>{const c=document.querySelector('.pod-canvas'); if(!c) return null;
             const r=c.getBoundingClientRect(); return {css:[Math.round(r.width),Math.round(r.height)], internal:[c.width,c.height]};})(),
           hits: Array.from(document.querySelectorAll('.pod-hit')).map(h=>h.tagName+':'+h.textContent.trim().slice(0,30)),
  };
})()`);
console.log('GEOM', JSON.stringify(geom, null, 1));

// scroll to pod and shoot, light theme
await evaluate(`document.getElementById('pod').scrollIntoView({block:'center'}); 1`);
await sleep(1200);
await shot('pod-light.png');

// dark theme
await evaluate(`localStorage.setItem('theme','dark'); document.documentElement.dataset.theme='dark'; document.dispatchEvent(new Event('astro:page-load')); 1`);
await sleep(1500);
await shot('pod-dark.png');

// full-page-ish: hero for reference
await evaluate(`localStorage.setItem('theme','light'); document.documentElement.dataset.theme=''; document.documentElement.removeAttribute('data-theme'); document.dispatchEvent(new Event('astro:page-load')); window.scrollTo(0,0); 1`);
await sleep(1500);
await shot('hero-light.png');

// the section just above the pod (mountains tail) for the "dull" comparison
await evaluate(`(()=>{const m=document.getElementById('mountains'); window.scrollTo(0, m.getBoundingClientRect().top+window.scrollY+400); return 1})()`);
await sleep(1000);
await shot('mountains.png');

// mobile
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await go('http://localhost:4399/');
await evaluate(`document.getElementById('pod').scrollIntoView({block:'start'}); 1`);
await sleep(1200);
await shot('pod-mobile.png');
const mob = await evaluate(`(()=>{const c=document.querySelector('.pod-canvas');
  return { canvasDisplay: c?getComputedStyle(c).display:'none', hitCount: document.querySelectorAll('.pod-hit').length,
           podH: Math.round(document.getElementById('pod').getBoundingClientRect().height) };})()`);
console.log('MOBILE', JSON.stringify(mob));

ws.close();
chrome.kill();
process.exit(0);
