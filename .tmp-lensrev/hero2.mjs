// Light-theme homepage: top of the descent and the bottom (the slot's real ground).
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9416;
const OUT = '/Users/zetian/devpro/ing/IngTian.github.io/.claude/worktrees/scroll-reveal/.tmp-lensrev/';
const chrome = spawn(CHROME, [`--remote-debugging-port=${PORT}`, '--headless=new', '--window-size=1600,900',
  '--user-data-dir=/tmp/cdp-hero2', '--no-first-run', '--force-device-scale-factor=1', 'about:blank'], { stdio: 'ignore' });
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
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
await send('Page.navigate', { url: 'http://localhost:4477/' });
await sleep(5000);
console.log('theme:', await ev(`document.documentElement.getAttribute('data-theme')`));
await ev(`document.querySelectorAll('[class*=veil]').forEach(e=>e.remove()); 1`);
await sleep(500);
let r = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(OUT + 'lt-top.png', Buffer.from(r.data, 'base64'));
// just above the ground/terminal — where the showpiece would sit
await ev(`(()=>{const g=document.getElementById('ground'); window.scrollTo(0, g.getBoundingClientRect().top+window.scrollY-450); return 1})()`);
await sleep(1200);
r = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(OUT + 'lt-slot.png', Buffer.from(r.data, 'base64'));
ws.close(); chrome.kill(); process.exit(0);
