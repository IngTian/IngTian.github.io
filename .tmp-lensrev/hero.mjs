// One screenshot of the live hero, for the continuity judgement (what the showpiece must not repeat).
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9414;
const OUT = '/Users/zetian/devpro/ing/IngTian.github.io/.claude/worktrees/scroll-reveal/.tmp-lensrev/';

const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`, '--headless=new', '--window-size=1600,900',
  '--user-data-dir=/tmp/cdp-hero', '--no-first-run', '--force-device-scale-factor=1', 'about:blank',
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
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: 'http://localhost:4477/' });
await sleep(5000);
await ev(`document.querySelectorAll('[class*=veil]').forEach(e=>e.remove()); 1`);
await sleep(600);
let r = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(OUT + 'hero-L.png', Buffer.from(r.data, 'base64'));
// what sections exist and how tall the page is (for the "slot" context)
console.log(await ev(`Array.from(document.querySelectorAll('main > section, main > div[id]')).map(e=>e.id+':'+Math.round(e.getBoundingClientRect().height))`));
// the bottom of the page (where the showpiece would sit)
await ev(`window.scrollTo(0, document.documentElement.scrollHeight); 1`);
await sleep(1500);
r = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(OUT + 'bottom-L.png', Buffer.from(r.data, 'base64'));
ws.close(); chrome.kill(); process.exit(0);
