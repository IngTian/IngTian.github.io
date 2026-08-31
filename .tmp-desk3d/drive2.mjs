// Drive real (GPU-backed) Chrome over CDP: load fps.html at several card counts
// and read back the measured fps + long-frame count from document.title.
import http from 'node:http';


function get(path) {
  return new Promise((res, rej) => {
    http.get({ host: '127.0.0.1', port: 9222, path }, (r) => {
      let b = ''; r.on('data', (d) => b += d); r.on('end', () => res(JSON.parse(b)));
    }).on('error', rej);
  });
}

const targets = await get('/json/list');
const page = targets.find((t) => t.type === 'page');
console.log('target:', page.url);

// minimal CDP over raw ws using node's built-in WebSocket (node 22+)
const ws = new globalThis.WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
});
await new Promise((r) => ws.addEventListener('open', r));
function send(method, params = {}) {
  const i = ++id;
  return new Promise((res) => { pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
}

const base = 'file://' + process.cwd() + '/fps.html';
for (const n of [6, 10, 14, 20]) {
  await send('Page.navigate', { url: `${base}?n=${n}` });
  await new Promise((r) => setTimeout(r, 6500));
  const out = await send('Runtime.evaluate', { expression: 'document.title' });
  console.log(`n=${n}  ->  ${out.result.result.value}`);
}
ws.close();
