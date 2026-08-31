// Dark-theme shots with the theme set BEFORE first paint (emulate prefers-color-scheme: dark),
// so nothing depends on re-firing astro:page-load. Also hide the fixed corner nav so it does not
// composite into the clip.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9415;
const OUT = '/Users/zetian/devpro/ing/IngTian.github.io/.claude/worktrees/scroll-reveal/.tmp-lensrev/';

const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`, '--headless=new', '--window-size=1800,1200',
  '--user-data-dir=/tmp/cdp-sketch4', '--no-first-run', '--force-device-scale-factor=1', 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(2500);
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => { ws.onopen = r; });
let id = 0; const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((res) => { const my = ++id; pending.set(my, (m) => res(m.result ?? m.error)); ws.send(JSON.stringify({ id: my, method, params })); });
const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }))?.result?.value;

await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1800, height: 1200, deviceScaleFactor: 1, mobile: false });
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
await send('Page.navigate', { url: 'http://localhost:4477/proto-sketches/' });
await sleep(4000);
console.log('theme attr:', await ev(`document.documentElement.getAttribute('data-theme')`));
await ev(`document.querySelectorAll('[class*=veil], .corner-nav, nav').forEach(e=>e.style.display='none'); 1`);
await sleep(400);

const n = await ev(`document.querySelectorAll('.sk-art').length`);
for (let i = 0; i < n; i++) {
  await ev(`(()=>{const e=document.querySelectorAll('.sk-art')[${i}];
    window.scrollTo(0, e.getBoundingClientRect().top+window.scrollY-120); return 1;})()`);
  await sleep(500);
  const box = await ev(`(()=>{const e=document.querySelectorAll('.sk-art')[${i}];const r=e.getBoundingClientRect();
    return {x:Math.round(r.x+window.scrollX),y:Math.round(r.y+window.scrollY),w:Math.round(r.width),h:Math.round(r.height)};})()`);
  const r = await send('Page.captureScreenshot', { format: 'png', clip: { ...box, width: box.w, height: box.h, scale: 1 } });
  if (r?.data) writeFileSync(`${OUT}s4-D-${i}.png`, Buffer.from(r.data, 'base64'));
  else console.log('fail', i, JSON.stringify(r).slice(0, 160));
}
ws.close(); chrome.kill(); process.exit(0);
