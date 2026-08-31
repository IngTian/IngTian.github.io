const SQ = Math.sqrt(3)/2;
const SIMPLEX=[{x:0,y:0},{x:1,y:0},{x:0.5,y:SQ}];
const toPlane=w=>({x:w[1]+0.5*w[2], y:w[2]*SQ});
const toW=p=>{const w3=p.y/SQ; const w2=p.x-0.5*w3; return [1-w2-w3,w2,w3];};
const hp=c=>{const[a1,a2,a3]=c.a;const i=1/Math.sqrt(3);return{nx:-a1+a2,ny:-a1*i-a2*i+a3*2*i,cc:c.b-a1};};
const slack=(p,c)=>{const h=hp(c);return h.nx*p.x+h.ny*p.y-h.cc;};
function dedupe(poly){const out=[];for(const p of poly){const l=out[out.length-1];if(!l||Math.hypot(l.x-p.x,l.y-p.y)>1e-9)out.push(p);}if(out.length>1){const f=out[0],l=out[out.length-1];if(Math.hypot(f.x-l.x,f.y-l.y)<1e-9)out.pop();}return out;}
function clip(poly,c){if(!poly.length)return[];const out=[];for(let i=0;i<poly.length;i++){const cur=poly[i],nx=poly[(i+1)%poly.length];const sc=slack(cur,c),sn=slack(nx,c);const ic=sc<=1e-12,inx=sn<=1e-12;if(ic)out.push(cur);if(ic!==inx){const t=sc/(sc-sn);out.push({x:cur.x+(nx.x-cur.x)*t,y:cur.y+(nx.y-cur.y)*t});}}return dedupe(out);}
const area=p=>{if(p.length<3)return 0;let s=0;for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];s+=a.x*b.y-b.x*a.y;}return Math.abs(s)/2;};
const cent=p=>{let x=0,y=0;for(const q of p){x+=q.x;y+=q.y;}return{x:x/p.length,y:y/p.length};};
function cutLine(c){const h=hp(c);const pts=[];for(let i=0;i<3;i++){const a=SIMPLEX[i],b=SIMPLEX[(i+1)%3];const sa=h.nx*a.x+h.ny*a.y-h.cc,sb=h.nx*b.x+h.ny*b.y-h.cc;if((sa<=0&&sb>0)||(sa>0&&sb<=0)){const t=sa/(sa-sb);pts.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});}}return pts.length>=2?[pts[0],pts[1]]:null;}

// one-way turnover between two weight vectors, as a FRACTION of the book
const turnover=(a,b)=>a.reduce((s,v,i)=>s+Math.abs(v-b[i]),0)/2;

// EXACT min-turnover legal point.
// f(p)=turnover(toW(p),w0) is convex piecewise-linear; min over a convex polygon is attained at a polygon
// vertex or where a kink line (w_i = w0_i) crosses a polygon edge.
function minTurnover(w0, poly){
  if(!poly.length) return null;
  // kink lines in the plane: w_i(p) = w0_i  ->  linear in (x,y)
  // w1 = 1 - x - y/sqrt3 ; w2 = x - y/sqrt3 ; w3 = 2y/sqrt3
  const i3=1/Math.sqrt(3);
  const kinks=[
    {nx:-1, ny:-i3, cc:w0[0]-1},   // w1 = w0[0]
    {nx: 1, ny:-i3, cc:w0[1]},     // w2 = w0[1]
    {nx: 0, ny: 2*i3, cc:w0[2]},   // w3 = w0[2]
  ];
  const cands=[...poly];
  for(let e=0;e<poly.length;e++){
    const a=poly[e], b=poly[(e+1)%poly.length];
    for(const k of kinks){
      const sa=k.nx*a.x+k.ny*a.y-k.cc, sb=k.nx*b.x+k.ny*b.y-k.cc;
      if((sa<0&&sb>0)||(sa>0&&sb<0)){const t=sa/(sa-sb);cands.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});}
    }
  }
  let best=null;
  for(const p of cands){const f=turnover(toW(p),w0); if(!best||f<best.f-1e-15)best={p,f};}
  return best;
}
function inside(p,poly){
  const signs=poly.map((a,i)=>{const b=poly[(i+1)%poly.length];return Math.sign((b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x));});
  return signs.every(s=>s>=0)||signs.every(s=>s<=0);
}
// brute check
function bruteMin(w0,poly,N=900){
  let best=Infinity, bp=null;
  for(let i=0;i<=N;i++)for(let j=0;j<=N-i;j++){
    const w=[i/N,j/N,(N-i-j)/N]; const p=toPlane(w);
    if(!inside(p,poly))continue;
    const f=turnover(w,w0); if(f<best){best=f;bp=w;}
  }
  return {f:best,w:bp};
}

const RULES=[
 {rung:1, label:'Nothing more than half in one name', a:[1,0,0], b:0.50},
 {rung:2, label:'No name above a quarter of the fund', a:[1,0,0], b:0.25},
 {rung:2, label:'No more than 30% in financials', a:[0,1,0], b:0.30},
 {rung:3, label:'Risk budget: 30 units of volatility', a:[0.55,0.30,0.08], b:0.30},
 {rung:3, label:'At least 45% in the safe asset', a:[0,0,-1], b:-0.45},
];
const SIZES=[8000, 250000, 40e6, 1e9];
const LABELS=['Your own money','Your friends\' money','A small fund','A teachers\' pension'];
const YOURS=[0.60,0.25,0.15];
const whole=area(SIMPLEX);

let poly=[...SIMPLEX];
const rows=[];
for(let r=0;r<=3;r++){
  if(r>0) for(const c of RULES.filter(c=>c.rung===r)) poly=clip(poly,c);
  const yp=toPlane(YOURS);
  const legal=inside(yp,poly);
  const m=minTurnover(YOURS,poly);
  const w=toW(m.p);
  rows.push({rung:r, who:LABELS[r], size:SIZES[r], rules:RULES.filter(c=>c.rung<=r).length,
    legalPct:+(area(poly)/whole*100).toFixed(2), verts:poly.length,
    yoursLegal:legal, mustHold:w.map(v=>(v*100).toFixed(1)).join(' / '),
    turnPP:+(m.f*100).toFixed(2), dollars:Math.round(m.f*SIZES[r]),
    centroid:toW(cent(poly)).map(v=>(v*100).toFixed(1)).join(' / ')});
}
console.table(rows);

// verify exact solver against brute force at each rung
let p3=[...SIMPLEX];
for(let r=1;r<=3;r++){
  for(const c of RULES.filter(c=>c.rung===r)) p3=clip(p3,c);
  const m=minTurnover(YOURS,p3), b=bruteMin(YOURS,p3,600);
  console.log(`rung ${r}: exact ${(m.f*100).toFixed(4)}pp  brute ${(b.f*100).toFixed(4)}pp  brute-w ${b.w.map(v=>(v*100).toFixed(1)).join('/')}`);
}

// per-rule slab areas (does every rule bite?)
let p4=[...SIMPLEX];
console.log('\nper-rule:');
for(const c of RULES){
  const before=p4; const after=clip(before,c);
  const slab=clip(before,{...c,a:c.a.map(v=>-v),b:-c.b});
  p4=after;
  console.log(` rung${c.rung} ${c.label}: cuts ${(area(slab)/whole*100).toFixed(2)}%  left ${(area(after)/whole*100).toFixed(2)}%  line? ${!!cutLine(c)}`);
}
console.log('\nrisk budget at YOURS =', (0.55*0.60+0.30*0.25+0.08*0.15).toFixed(4));
