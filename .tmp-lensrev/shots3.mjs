// Screenshot each showpiece sketch, light + dark. No captureBeyondViewport (it resizes the
// viewport and vh-based layout shifts under the clip). Scroll the block into view, clip in page
// coords, viewport is tall enough to contain it.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9413;
const OUT = '/Users/zetian/devpro/ing/IngTian.github.io/.claude/worktrees/scroll-reveal/.tmp-lensrev/';

const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`,
  '--headless=new',
  '--window-size=1800,1200',
  '--user-data-dir=/tmp/cdp-sketch3',
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
await send('Emulation.setDeviceMetricsOverride', { width: 1800, height: 1200, deviceScaleFactor: 1, mobile: false });
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
await send('Page.navigate', { url: 'http://localhost:4477/proto-sketches/' });
await sleep(3500);

// kill the page-load veil and any leftover overlay, force theme explicitly
const setTheme = async (t) => {
  await ev(`(()=>{ localStorage.setItem('theme','${t}');
    if ('${t}'==='dark') document.documentElement.setAttribute('data-theme','dark');
    else document.documentElement.removeAttribute('data-theme');
    document.dispatchEvent(new Event('astro:page-load'));
    document.querySelectorAll('.veil,[class*=veil]').forEach(e=>e.remove());
    return 1; })()`);
  await sleep(900);
};

async function shotAll(tag) {
  const n = await ev(`document.querySelectorAll('.sk-art').length`);
  for (let i = 0; i < n; i++) {
    await ev(`(()=>{const e=document.querySelectorAll('.sk-art')[${i}];
      const r=e.getBoundingClientRect(); window.scrollTo(0, r.top+window.scrollY-120); return 1;})()`);
    await sleep(600);
    const box = await ev(`(()=>{const e=document.querySelectorAll('.sk-art')[${i}];
      const r=e.getBoundingClientRect();
      return {x:Math.round(r.x+window.scrollX),y:Math.round(r.y+window.scrollY),
              w:Math.round(r.width),h:Math.round(r.height),vp:window.innerHeight};})()`);
    const r = await send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: box.x, y: box.y, width: box.w, height: box.h, scale: 1 },
    });
    if (r?.data) writeFileSync(`${OUT}s3-${tag}-${i}.png`, Buffer.from(r.data, 'base64'));
    else console.log('fail', i, JSON.stringify(r).slice(0, 200));
    console.log(tag, i, JSON.stringify(box));
  }
}

await setTheme('light');
await shotAll('L');
await setTheme('dark');
await shotAll('D');

ws.close();
chrome.kill();
process.exit(0);
