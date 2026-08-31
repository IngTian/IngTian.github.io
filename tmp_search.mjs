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
const turnover=(a,b)=>a.reduce((s,v,i)=>s+Math.abs(v-b[i]),0)/2;
function inside(p,poly){if(poly.length<3)return false;const s=poly.map((a,i)=>{const b=poly[(i+1)%poly.length];return Math.sign((b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x));});return s.every(v=>v>=-1e-12)||s.every(v=>v<=1e-12);}
function minTurnover(w0, poly){
  if(!poly.length) return null;
  if(inside(toPlane(w0),poly)) return {f:0,w:[...w0],p:toPlane(w0)};
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
const SIZES=[8000,250000,40e6,1e9];

function evalLadder(rungs, verbose){
  let poly=[...SIMPLEX];
  const out=[];
  const perRule=[];
  for(let i=0;i<rungs.length;i++){
    const before=poly;
    for(const r of rungs[i]){
      const b2=poly;
      for(const h of r.hs) poly=clip(poly,h);
      perRule.push({rung:i,label:r.label,cut:(area(b2)-area(poly))/whole});
    }
    const m=minTurnover(YOURS,poly);
    if(!m||poly.length<3) return null;
    out.push({rung:i,legal:area(poly)/whole,cut:(area(before)-area(poly))/whole,
      verts:poly.length, ok:inside(toPlane(YOURS),poly), turn:m.f, w:m.w,
      dollars:m.f*SIZES[i], cg:toW(cent(poly))});
  }
  return {out,perRule};
}
const capN=b=>[{a:[1,0,0],b}];
const floorG=b=>[{a:[0,0,-1],b:-b}];
const capB=b=>[{a:[0,1,0],b}];
const risk=b=>[{a:[0.55,0.30,0.08],b}];

const ladders={
 L1:[[],
     [{label:'gold>=10',hs:floorG(0.10)}],
     [{label:'nvda<=40',hs:capN(0.40)},{label:'gold>=20',hs:floorG(0.20)}],
     [{label:'risk<=0.30',hs:risk(0.30)},{label:'bac<=25',hs:capB(0.25)}]],
 L2:[[],
     [{label:'nvda<=60',hs:capN(0.60)}],
     [{label:'nvda<=40',hs:capN(0.40)},{label:'gold>=20',hs:floorG(0.20)}],
     [{label:'risk<=0.30',hs:risk(0.30)},{label:'bac<=25',hs:capB(0.25)}]],
 L3:[[],
     [{label:'gold>=10 (something safe)',hs:floorG(0.10)}],
     [{label:'nvda<=35',hs:capN(0.35)},{label:'gold>=25',hs:floorG(0.25)}],
     [{label:'risk<=0.28',hs:risk(0.28)},{label:'bac<=25',hs:capB(0.25)}]],
 L4:[[],
     [{label:'gold>=10',hs:floorG(0.10)}],
     [{label:'nvda<=40',hs:capN(0.40)}],
     [{label:'gold>=25',hs:floorG(0.25)},{label:'risk<=0.30',hs:risk(0.30)},{label:'bac<=25',hs:capB(0.25)}]],
 L5:[[],
     [{label:'gold>=10',hs:floorG(0.10)}],
     [{label:'nvda<=40',hs:capN(0.40)},{label:'gold>=20',hs:floorG(0.20)}],
     [{label:'risk<=0.32',hs:risk(0.32)},{label:'bac<=30',hs:capB(0.30)}]],
};
for(const [k,l] of Object.entries(ladders)){
  const r=evalLadder(l);
  console.log('\n==== '+k);
  if(!r){console.log('  DEGENERATE');continue;}
  console.table(r.out.map(o=>({rung:o.rung,legalPct:+(o.legal*100).toFixed(2),cutPct:+(o.cut*100).toFixed(2),
    verts:o.verts, yoursLegal:o.ok, turnPP:+(o.turn*100).toFixed(2), dollars:Math.round(o.dollars),
    nearest:o.w.map(v=>(v*100).toFixed(1)).join('/'), centroid:o.cg.map(v=>(v*100).toFixed(1)).join('/')})));
  console.log(r.perRule.map(p=>`  r${p.rung} ${p.label}: -${(p.cut*100).toFixed(2)}%`).join('\n'));
}
