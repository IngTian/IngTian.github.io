// Screenshot each showpiece sketch at real width, light + dark, via CDP.
// clip is in PAGE coordinates, so add scroll offsets and use captureBeyondViewport.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9412;
const OUT = '/Users/zetian/devpro/ing/IngTian.github.io/.claude/worktrees/scroll-reveal/.tmp-lensrev/';

const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`,
  '--headless=new',
  '--window-size=1800,1100',
  '--user-data-dir=/tmp/cdp-sketch2',
  '--no-first-run',
  '--force-device-scale-factor=1',
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
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
};
const send = (method, params = {}) => new Promise((res) => {
  const myId = ++id;
  pending.set(myId, (m) => res(m.result ?? m.error));
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
await sleep(3500);

async function shotAll(tag) {
  const n = await ev(`document.querySelectorAll('.sk-art').length`);
  for (let i = 0; i < n; i++) {
    const box = await ev(`(()=>{const e=document.querySelectorAll('.sk-art')[${i}];
      const r=e.getBoundingClientRect();
      return {x:Math.round(r.x+window.scrollX),y:Math.round(r.y+window.scrollY),
              w:Math.round(r.width),h:Math.round(r.height)};})()`);
    const r = await send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true,
      clip: { x: box.x, y: box.y, width: box.w, height: box.h, scale: 1 },
    });
    if (r?.data) writeFileSync(`${OUT}s2-${tag}-${i}.png`, Buffer.from(r.data, 'base64'));
    else console.log('fail', i, JSON.stringify(r).slice(0, 200));
    console.log(tag, i, JSON.stringify(box));
  }
}

await shotAll('L');
await ev(`localStorage.setItem('theme','dark'); document.documentElement.dataset.theme='dark'; document.dispatchEvent(new Event('astro:page-load')); 1`);
await sleep(1200);
await shotAll('D');

ws.close();
chrome.kill();
process.exit(0);
