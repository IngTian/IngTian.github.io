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
function inside(p,poly){const s=poly.map((a,i)=>{const b=poly[(i+1)%poly.length];return Math.sign((b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x));});return s.every(v=>v>=0)||s.every(v=>v<=0);}
function minTurnover(w0, poly){
  if(!poly.length) return null;
  const kinks=[{nx:-1,ny:-i3,cc:w0[0]-1},{nx:1,ny:-i3,cc:w0[1]},{nx:0,ny:2*i3,cc:w0[2]}];
  const cands=[...poly];
  for(let e=0;e<poly.length;e++){const a=poly[e],b=poly[(e+1)%poly.length];
    for(const k of kinks){const sa=k.nx*a.x+k.ny*a.y-k.cc,sb=k.nx*b.x+k.ny*b.y-k.cc;
      if((sa<0&&sb>0)||(sa>0&&sb<0)){const t=sa/(sa-sb);cands.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});}}}
  let best=null;
  for(const p of cands){const f=turnover(toW(p),w0); if(!best||f<best.f-1e-15)best={p,f,w:toW(p)};}
  return best;
}
function bruteMin(w0,poly,N=600){let best=Infinity,bp=null;
  for(let i=0;i<=N;i++)for(let j=0;j<=N-i;j++){const w=[i/N,j/N,(N-i-j)/N];if(!inside(toPlane(w),poly))continue;
    const f=turnover(w,w0);if(f<best){best=f;bp=w;}}return {f:best,w:bp};}

const YOURS=[0.60,0.25,0.15];
const whole=area(SIMPLEX);

// A RUNG = a set of RULES; a RULE = one sentence with 1..3 half-planes.
const RUNGS=[
  {who:'Your own money', size:8000, doc:'nothing written down', rules:[]},
  {who:"Your friends' money", size:250000, doc:'one page, signed at a kitchen table',
   rules:[{label:'Nothing more than half in one name', hs:[{a:[1,0,0],b:0.50},{a:[0,1,0],b:0.50},{a:[0,0,1],b:0.50}]}]},
  {who:'A small fund', size:40e6, doc:'a partnership agreement',
   rules:[{label:'No name above 40%', hs:[{a:[1,0,0],b:0.40},{a:[0,1,0],b:0.40},{a:[0,0,1],b:0.40}]},
          {label:'At least 20% in gold', hs:[{a:[0,0,-1],b:-0.20}]}]},
  {who:"A teachers' pension", size:1e9, doc:'an investment policy statement',
   rules:[{label:'Risk budget: 30 units', hs:[{a:[0.55,0.30,0.08],b:0.30}]},
          {label:'No more than 25% in the bank', hs:[{a:[0,1,0],b:0.25}]}]},
];

let poly=[...SIMPLEX];
const rows=[];
RUNGS.forEach((R,i)=>{
  const before=poly;
  for(const r of R.rules) for(const h of r.hs) poly=clip(poly,h);
  const m=minTurnover(YOURS,poly);
  const trades = m ? m.w.map((w,k)=>+( (w-YOURS[k])*R.size ).toFixed(0)) : null;
  rows.push({i,who:R.who,size:R.size,
    rulesCum:RUNGS.slice(0,i+1).reduce((s,r)=>s+r.rules.length,0),
    legal:+(area(poly)/whole*100).toFixed(2),
    cutThisRung:+((area(before)-area(poly))/whole*100).toFixed(2),
    verts:poly.length, yoursLegal:inside(toPlane(YOURS),poly),
    mustHold:m.w.map(v=>(v*100).toFixed(1)).join('/'),
    turnPP:+(m.f*100).toFixed(2), dollars:Math.round(m.f*R.size),
    trades:trades&&trades.join(' | '),
    centroid:toW(cent(poly)).map(v=>(v*100).toFixed(1)).join('/')});
});
console.table(rows);
// verify
let p=[...SIMPLEX];
RUNGS.forEach((R,i)=>{for(const r of R.rules)for(const h of r.hs)p=clip(p,h);
  const m=minTurnover(YOURS,p),b=bruteMin(YOURS,p,600);
  console.log(`rung${i} exact ${(m.f*100).toFixed(4)}  brute ${(b.f*100).toFixed(4)}`);});
// per-rule bite within its rung
let q=[...SIMPLEX];
console.log('\nper-rule bite:');
RUNGS.forEach((R,i)=>{for(const r of R.rules){const before=q;for(const h of r.hs)q=clip(q,h);
  console.log(` rung${i} "${r.label}" cuts ${((area(before)-area(q))/whole*100).toFixed(2)}%  left ${(area(q)/whole*100).toFixed(2)}%  lines ${r.hs.map(h=>!!cutLine(h)).join(',')}`);}});
console.log('\nrisk budget at YOURS =', (0.55*0.60+0.30*0.25+0.08*0.15).toFixed(4));
