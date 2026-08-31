// Screenshot each showpiece sketch at real width (1600x900), light + dark, via CDP.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9411;
const OUT = '/Users/zetian/devpro/ing/IngTian.github.io/.claude/worktrees/scroll-reveal/.tmp-lensrev/';

const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`,
  '--headless=new',
  '--window-size=1800,1100',
  '--user-data-dir=/tmp/cdp-sketch-profile',
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
const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  return r?.result?.value;
};

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1800, height: 1100, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: 'http://localhost:4477/proto-sketches/' });
await sleep(3000);

const ids = await ev(`Array.from(document.querySelectorAll('.sk-block .sk-meta .sk-n')).map(e=>e.textContent.trim())`);
console.log('BLOCKS', JSON.stringify(ids));

async function shotAll(tag) {
  const n = await ev(`document.querySelectorAll('.sk-art').length`);
  for (let i = 0; i < n; i++) {
    const box = await ev(`(()=>{const e=document.querySelectorAll('.sk-art')[${i}];
      e.scrollIntoView({block:'center'});
      const r=e.getBoundingClientRect();
      return {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)};})()`);
    await sleep(400);
    const box2 = await ev(`(()=>{const e=document.querySelectorAll('.sk-art')[${i}];
      const r=e.getBoundingClientRect();
      return {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)};})()`);
    const r = await send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: box2.x, y: box2.y, width: box2.w, height: box2.h, scale: 1 },
    });
    if (r?.data) writeFileSync(`${OUT}sk-${tag}-${i}.png`, Buffer.from(r.data, 'base64'));
    else console.log('fail', i, JSON.stringify(r).slice(0, 160));
  }
}

await shotAll('L');
await ev(`localStorage.setItem('theme','dark'); document.documentElement.dataset.theme='dark'; document.dispatchEvent(new Event('astro:page-load')); 1`);
await sleep(1200);
await shotAll('D');

ws.close();
chrome.kill();
process.exit(0);
