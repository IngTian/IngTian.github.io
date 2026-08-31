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
function project(p,poly){
  if(inside(p,poly)) return {p:{...p},d:0,inside:true};
  let best=null;
  for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];
    const dx=b.x-a.x,dy=b.y-a.y,L=dx*dx+dy*dy;
    let t=L>0?((p.x-a.x)*dx+(p.y-a.y)*dy)/L:0;t=Math.max(0,Math.min(1,t));
    const q={x:a.x+t*dx,y:a.y+t*dy},d=Math.hypot(q.x-p.x,q.y-p.y);
    if(!best||d<best.d)best={p:q,d};}
  return {...best,inside:false};
}
const whole=area(SIMPLEX);
const YOURS=[0.60,0.25,0.15];
const SIZES=[8000,250000,40e6,1e9];
const STRESS=[0.55,0.30,0.08];
const stressOf=w=>STRESS.reduce((s,a,i)=>s+a*w[i],0);
const capN=b=>({a:[1,0,0],b}), capB=b=>({a:[0,1,0],b}), floorG=b=>({a:[0,0,-1],b:-b}), st=b=>({a:STRESS,b});

function show(name, rungs){
  let poly=[...SIMPLEX]; const rows=[]; const det=[]; let mb=1;
  rungs.forEach((R,i)=>{
    for(const r of R){const b2=poly;for(const h of r.hs)poly=clip(poly,h);
      const cut=(area(b2)-area(poly))/whole; mb=Math.min(mb,cut);
      det.push(`   r${i} ${r.label}: cuts ${(cut*100).toFixed(1)}%  left ${(area(poly)/whole*100).toFixed(1)}%  drawable ${r.hs.map(h=>!!cutLine(h)).join(',')}`);}
    const pr=project(toPlane(YOURS),poly); const w=toW(pr.p); const t=turnover(w,YOURS);
    rows.push({rung:i, legal:+(area(poly)/whole*100).toFixed(1), verts:poly.length, ok:pr.inside,
      nearest:w.map(v=>(v*100).toFixed(1)).join('/'),
      turnPP:+(t*100).toFixed(1), usd:Math.round(t*SIZES[i]),
      stressNear:+(stressOf(w)*100).toFixed(1),
      cg:toW(cent(poly)).map(v=>(v*100).toFixed(1)).join('/')});
  });
  console.log(`\n===== ${name}  [minBite ${(mb*100).toFixed(1)}%]`);
  console.table(rows); console.log(det.join('\n'));
}

// FAMILY: rung1 cap50 ; rung2 cap40 + gold>=20 ; rung3 cap25 + X
for(const X of [
  {label:'stress<=26%', hs:[st(0.26)]},
  {label:'stress<=24%', hs:[st(0.24)]},
  {label:'stress<=22%', hs:[st(0.22)]},
  {label:'bank<=25%', hs:[capB(0.25)]},
  {label:'bank<=30%', hs:[capB(0.30)]},
  {label:'gold>=40%', hs:[floorG(0.40)]},
  {label:'gold>=45%', hs:[floorG(0.45)]},
]){
  show('cap50 | cap40+gold20 | cap25+'+X.label, [
    [],
    [{label:'no name above 50%', hs:[capN(0.50)]}],
    [{label:'no name above 40%', hs:[capN(0.40)]},{label:'at least 20% gold', hs:[floorG(0.20)]}],
    [{label:'no name above 25%', hs:[capN(0.25)]}, X],
  ]);
}
console.log('\nyours stress =', (stressOf(YOURS)*100).toFixed(1)+'%');
