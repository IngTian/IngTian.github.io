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
function nearest(p,poly){
  const signs=[];
  for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];
    signs.push(Math.sign((b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x)));}
  if(signs.every(s=>s>=0)||signs.every(s=>s<=0)) return {p:{...p},d:0,inside:true};
  let best=null;
  for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];
    const dx=b.x-a.x,dy=b.y-a.y; const L=dx*dx+dy*dy;
    let t = L>0 ? ((p.x-a.x)*dx+(p.y-a.y)*dy)/L : 0; t=Math.max(0,Math.min(1,t));
    const q={x:a.x+t*dx,y:a.y+t*dy}; const d=Math.hypot(q.x-p.x,q.y-p.y);
    if(!best||d<best.d)best={p:q,d};}
  return {...best,inside:false};
}
const whole=area(SIMPLEX);
const YOURS=[0.45,0.20,0.35];
const yp=toPlane(YOURS);

function run(rules, sizes){
  let poly=[...SIMPLEX];
  const out=[];
  // rung 0
  out.push({rung:0, size:sizes[0], rules:0, legal:100, yoursLegal:true, near:'—', turnPP:0, sellDollars:'—', verts:3});
  for(let r=1;r<sizes.length;r++){
    for(const c of rules.filter(c=>c.rung===r)) poly=clip(poly,c);
    const n=nearest(yp,poly); const w=toW(n.p);
    const turn=w.reduce((s,ww,k)=>s+Math.abs(ww-YOURS[k]),0)/2;
    out.push({rung:r, size:sizes[r], rules:rules.filter(c=>c.rung<=r).length,
      legal:+(area(poly)/whole*100).toFixed(2), verts:poly.length,
      yoursLegal:n.inside, near:w.map(v=>(v*100).toFixed(1)).join('/'),
      turnPP:+(turn*100).toFixed(2), sellDollars:+(turn*sizes[r]).toFixed(0),
      centroid:toW(cent(poly)).map(v=>(v*100).toFixed(1)).join('/')});
  }
  return out;
}

console.log('=== VARIANT A: cap 25%, risk budget, gold floor 45 + bank cap 30');
console.table(run([
  {rung:1,a:[1,0,0],b:0.50},
  {rung:2,a:[1,0,0],b:0.25},
  {rung:2,a:[0.55,0.30,0.08],b:0.30},
  {rung:3,a:[0,0,-1],b:-0.45},
  {rung:3,a:[0,1,0],b:0.30},
],[8000,250000,40e6,1e9]));

console.log('=== VARIANT B: rung2 = cap 25% only; rung3 = risk budget + gold floor 45 + bank cap 30');
console.table(run([
  {rung:1,a:[1,0,0],b:0.50},
  {rung:2,a:[1,0,0],b:0.25},
  {rung:2,a:[0,1,0],b:0.35},
  {rung:3,a:[0.55,0.30,0.08],b:0.30},
  {rung:3,a:[0,0,-1],b:-0.45},
],[8000,250000,40e6,1e9]));

console.log('=== VARIANT C: 1 / 2 / 2 rules; rung1 cap50; rung2 cap25+gold>=25; rung3 riskbudget+gold>=45');
console.table(run([
  {rung:1,a:[1,0,0],b:0.50},
  {rung:2,a:[1,0,0],b:0.25},
  {rung:2,a:[0,0,-1],b:-0.25},
  {rung:3,a:[0.55,0.30,0.08],b:0.30},
  {rung:3,a:[0,0,-1],b:-0.45},
],[8000,250000,40e6,1e9]));
