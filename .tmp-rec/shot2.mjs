import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9337;
const OUT = new URL('.', import.meta.url).pathname;
const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`, '--headless=new', '--window-size=1440,900',
  '--user-data-dir=/tmp/cdp-pod-p2', '--no-first-run', '--force-color-profile=srgb',
  'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(2500);
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const target = list.find((t) => t.type === 'page');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => { ws.onopen = r; });
let id = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, (m) => res(m.result ?? m.error)); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
const ev_ = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }))?.result?.value;
const shot = async (n, clip) => { const r = await send('Page.captureScreenshot', clip ? { format: 'png', clip } : { format: 'png' }); if (r?.data) writeFileSync(OUT + n, Buffer.from(r.data, 'base64')); else console.log('FAIL', n); };

await send('Page.navigate', { url: 'http://localhost:4399/index.html' });
await sleep(3500);
await ev_(`localStorage.setItem('theme','light'); localStorage.removeItem('theme'); document.documentElement.removeAttribute('data-theme'); document.dispatchEvent(new Event('astro:page-load')); 1`);
await sleep(1500);
console.log('THEME', await ev_(`document.documentElement.dataset.theme || 'light(none)'`));

const geom = await ev_(`(() => { const d=document.documentElement;
  const s=(id)=>{const e=document.getElementById(id); if(!e) return null; const r=e.getBoundingClientRect();
    return {topPct:+(((r.top+window.scrollY)/d.scrollHeight)*100).toFixed(1), h:Math.round(r.height), pct:+((r.height/d.scrollHeight)*100).toFixed(1)};};
  const c=document.querySelector('.pod-canvas'); const cr=c&&c.getBoundingClientRect();
  return {docH:d.scrollHeight, interlude:s('interlude'), mountains:s('mountains'), pod:s('pod'), ground:s('ground'),
    islands:document.querySelectorAll('astro-island').length,
    canvasCss:cr&&[Math.round(cr.width),Math.round(cr.height)], canvasInternal:c&&[c.width,c.height],
    hits:Array.from(document.querySelectorAll('.pod-hit')).map(h=>h.tagName+'|'+(h.getAttribute('href')||'btn')+'|'+h.textContent.trim().replace(/\\s+/g,' ')),
    tocStops:Array.from(document.querySelectorAll('[data-toc] a, .toc a')).map(a=>a.getAttribute('href')+':'+a.textContent.trim()),
  };})()`);
console.log('GEOM', JSON.stringify(geom, null, 1));

// pod clip in light
const clip = await ev_(`(()=>{const f=document.querySelector('.pod-frame'); f.scrollIntoView({block:'center'}); const r=f.getBoundingClientRect();
  return {x:Math.max(0,r.left-40), y:Math.max(0,r.top-40), width:r.width+80, height:r.height+80, scale:1};})()`);
await sleep(900);
await shot('L-pod.png', clip);
await shot('L-full.png');

// dark
await ev_(`localStorage.setItem('theme','dark'); document.documentElement.dataset.theme='dark'; document.dispatchEvent(new Event('astro:page-load')); 1`);
await sleep(1400);
await shot('D-pod.png', clip);

// sample the actual painted pixel colours to check accent per theme
const px = await ev_(`(()=>{const c=document.querySelector('.pod-canvas'); const g=c.getContext('2d');
  const out={}; const grab=(x,y,k)=>{const d=g.getImageData(Math.round(x),Math.round(y),1,1).data; out[k]='rgb('+d[0]+','+d[1]+','+d[2]+')';};
  grab(c.width*0.10,c.height*0.85,'benchLeft'); grab(c.width*0.5,c.height*0.80,'benchMid');
  grab(c.width*0.5,c.height*0.08,'wallTop'); grab(c.width*0.05,c.height*0.35,'wallLeftOfScreens');
  grab(c.width*0.28,c.height*0.30,'screen1'); return out;})()`);
console.log('DARK PIXELS', JSON.stringify(px));
ws.close(); chrome.kill(); process.exit(0);
