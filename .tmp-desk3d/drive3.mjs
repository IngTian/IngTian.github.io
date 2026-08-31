import http from 'node:http';
function get(path){return new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path},(r)=>{let b='';r.on('data',d=>b+=d);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});}
const page=(await get('/json/list')).find(t=>t.type==='page');
const ws=new WebSocket(page.webSocketDebuggerUrl);
let id=0;const pending=new Map();
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}});
await new Promise(r=>ws.addEventListener('open',r));
const send=(method,params={})=>{const i=++id;return new Promise(res=>{pending.set(i,res);ws.send(JSON.stringify({id:i,method,params}));});};
await send('Emulation.enable');
const base='file://'+process.cwd()+'/fps.html';
for (const rate of [1,4,6,10]) {
  await send('Emulation.setCPUThrottlingRate',{rate});
  for (const n of [10, 20]) {
    await send('Page.navigate',{url:`${base}?n=${n}&r=${rate}`});
    await new Promise(r=>setTimeout(r, 7000 + rate*400));
    const out=await send('Runtime.evaluate',{expression:'document.title'});
    console.log(`cpuThrottle=${rate}x n=${n} -> ${out.result.result.value}`);
  }
}
await send('Emulation.setCPUThrottlingRate',{rate:1});
ws.close();
