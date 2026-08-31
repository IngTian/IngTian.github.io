const SQ = Math.sqrt(3)/2, i3 = 1/Math.sqrt(3);
const SIMPLEX=[{x:0,y:0},{x:1,y:0},{x:0.5,y:SQ}];
const toPlane=w=>({x:w[1]+0.5*w[2], y:w[2]*SQ});
const toW=p=>{const w3=p.y/SQ; const w2=p.x-0.5*w3; return [1-w2-w3,w2,w3];};
const hp=c=>{const[a1,a2,a3]=c.a;return{nx:-a1+a2,ny:-a1*i3-a2*i3+a3*2*i3,cc:c.b-a1};};
const slack=(p,c)=>{const h=hp(c);return h.nx*p.x+h.ny*p.y-h.cc;};
function dedupe(poly){const out=[];for(const p of poly){const l=out[out.length-1];if(!l||Math.hypot(l.x-p.x,l.y-p.y)>1e-9)out.push(p);}if(out.length>1){const f=out[0],l=out[out.length-1];if(Math.hypot(f.x-l.x,f.y-l.y)<1e-9)out.pop();}return out;}
function clip(poly,c){if(!poly.length)return[];const out=[];for(let i=0;i<poly.length;i++){const cur=poly[i],nx=poly[(i+1)%poly.length];const sc=slack(cur,c),sn=slack(nx,c);const ic=sc<=1e-12,inx=sn<=1e-12;if(ic)out.push(cur);if(ic!==inx){const t=sc/(sc-sn);out.push({x:cur.x+(nx.x-cur.x)*t,y:cur.y+(nx.y-cur.y)*t});}}return dedupe(out);}
const area=p=>{if(p.length<3)return 0;let s=0;for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];s+=a.x*b.y-b.x*a.y;}return Math.abs(s)/2;};
const cent=p=>{let x=0,y=0;for(const q of p){x+=q.x;y+=q.y;}return{x:x/p.length,y:y/p.length};};
function cutLine(c){const h=hp(c);const pts=[];for(let i=0;i<3;i++){const a=SIMPLEX[i],b=SIMPLEX[(i+1)%3];const sa=h.nx*a.x+h.ny*a.y-h.cc,sb=h.nx*b.x+h.ny*b.y-h.cc;if((sa<=0&&sb>0)||(sa>0&&sb<=0)){const t=sa/(sa-sb);pts.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});}}return pts.length>=2?[pts[0],pts[1]]:null;}
const turnover=(a,b)=>a.reduce((s,v,i)=>s+Math.abs(v-b[i]),0)/2;
function inside(p,poly){if(poly.length<3)return false;const s=poly.map((a,i)=>{const b=poly[(i+1)%poly.length];return Math.sign((b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x));});return s.every(v=>v>=-1e-12)||s.every(v=>v<=1e-12);}
function minTurnover(w0, poly){
  if(!poly.length) return null;
  if(inside(toPlane(w0),poly)) return {p:toPlane(w0),f:0,w:[...w0]};
  const kinks=[{nx:-1,ny:-i3,cc:w0[0]-1},{nx:1,ny:-i3,cc:w0[1]},{nx:0,ny:2*i3,cc:w0[2]}];
  const cands=[...poly];
  for(let e=0;e<poly.length;e++){const a=poly[e],b=poly[(e+1)%poly.length];
    for(const k of kinks){const sa=k.nx*a.x+k.ny*a.y-k.cc,sb=k.nx*b.x+k.ny*b.y-k.cc;
      if((sa<0&&sb>0)||(sa>0&&sb<0)){const t=sa/(sa-sb);cands.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});}}}
  let best=null;
  for(const p of cands){const f=turnover(toW(p),w0); if(!best||f<best.f-1e-15)best={p,f,w:toW(p)};}
  return best;
}
const whole=area(SIMPLEX);
const YOURS=[0.60,0.25,0.15];

function trial(name, rungs){
  console.log('\n===== '+name);
  let poly=[...SIMPLEX];
  const rows=[];
  rungs.forEach((R,i)=>{
    const before=poly;
    for(const r of R.rules) for(const h of r.hs) poly=clip(poly,h);
    const m=minTurnover(YOURS,poly);
    rows.push({i,who:R.who,size:R.size,
      rules:rungs.slice(0,i+1).reduce((s,r)=>s+r.rules.length,0),
      halfplanes:rungs.slice(0,i+1).reduce((s,r)=>s+r.rules.reduce((t,x)=>t+x.hs.length,0),0),
      legal:+(area(poly)/whole*100).toFixed(2),
      cut:+((area(before)-area(poly))/whole*100).toFixed(2),
      verts:poly.length, ok:inside(toPlane(YOURS),poly),
      hold:m.w.map(v=>(v*100).toFixed(1)).join('/'),
      turnPP:+(m.f*100).toFixed(2), sell:Math.round(m.f*R.size),
      cg:toW(cent(poly)).map(v=>(v*100).toFixed(1)).join('/')});
  });
  console.table(rows);
  let q=[...SIMPLEX];
  rungs.forEach((R,i)=>{for(const r of R.rules){const b=q;for(const h of r.hs)q=clip(q,h);
    console.log(`  r${i} "${r.label}" cuts ${((area(b)-area(q))/whole*100).toFixed(2)}% left ${(area(q)/whole*100).toFixed(2)}% verts ${q.length}`);}});
}

const capAll=b=>[{a:[1,0,0],b},{a:[0,1,0],b},{a:[0,0,1],b}];

trial('T1: half / 40 + gold>=15 / risk .26 + bank<=30', [
 {who:'own', size:8000, rules:[]},
 {who:'friends', size:250000, rules:[{label:'nothing more than half in one name', hs:capAll(0.50)}]},
 {who:'small fund', size:40e6, rules:[
   {label:'no name above 40%', hs:capAll(0.40)},
   {label:'at least 15% in gold', hs:[{a:[0,0,-1],b:-0.15}]}]},
 {who:'pension', size:1e9, rules:[
   {label:'risk budget 26', hs:[{a:[0.55,0.30,0.08],b:0.26}]},
   {label:'no more than 30% in the bank', hs:[{a:[0,1,0],b:0.30}]}]},
]);

trial('T2: half / NVDA<=35 + gold>=20 / risk .24 + bank<=28', [
 {who:'own', size:8000, rules:[]},
 {who:'friends', size:250000, rules:[{label:'nothing more than half in one name', hs:capAll(0.50)}]},
 {who:'small fund', size:40e6, rules:[
   {label:'no name above 35%', hs:capAll(0.35)},
   {label:'at least 20% in gold', hs:[{a:[0,0,-1],b:-0.20}]}]},
 {who:'pension', size:1e9, rules:[
   {label:'risk budget 24', hs:[{a:[0.55,0.30,0.08],b:0.24}]},
   {label:'no more than 28% in the bank', hs:[{a:[0,1,0],b:0.28}]}]},
]);

trial('T3: half / 40 + gold>=20 / risk .25 + bank<=25', [
 {who:'own', size:8000, rules:[]},
 {who:'friends', size:250000, rules:[{label:'nothing more than half in one name', hs:capAll(0.50)}]},
 {who:'small fund', size:40e6, rules:[
   {label:'no name above 40%', hs:capAll(0.40)},
   {label:'at least 20% in gold', hs:[{a:[0,0,-1],b:-0.20}]}]},
 {who:'pension', size:1e9, rules:[
   {label:'risk budget 25', hs:[{a:[0.55,0.30,0.08],b:0.25}]},
   {label:'no more than 25% in the bank', hs:[{a:[0,1,0],b:0.25}]}]},
]);
