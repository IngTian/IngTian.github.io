// Where is the fan's ink, in a FULL-BLEED field? Rasterise the real 80 trajectories
// into a grid and report per-cell ink density, so type can be placed in the holes.

function mulberry32(seed){let a=seed>>>0;return()=>{a=(a+0x6d2b79f5)>>>0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
function gauss(rand){const u=Math.max(1e-12,rand());const v=rand();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}
function trajectories(count=80,weeks=52,seed=0x51a7){const rand=mulberry32(seed);const out=[];for(let i=0;i<count;i++){const drift=0.04+0.22*rand();const vol=0.14+0.40*rand();let v=100;const p=[v];for(let w=0;w<weeks;w++){v*=1+drift/52+(vol/Math.sqrt(52))*gauss(rand);p.push(v);}out.push(p);}return out;}
function trajBounds(paths,trim=0.01){const all=[];for(const p of paths)for(const v of p)all.push(v);all.sort((a,b)=>a-b);const i=Math.min(all.length-1,Math.max(0,Math.floor(trim*(all.length-1))));return{lo:all[i],hi:all[all.length-1-i]};}

const paths=trajectories();
const b=trajBounds(paths);
const full=trajBounds(paths,0);
console.log('bounds trim1%:',b.lo.toFixed(1),b.hi.toFixed(1),' full:',full.lo.toFixed(1),full.hi.toFixed(1));

// per-week percentiles, as fraction-of-band (0=bottom lo, 1=top hi)
const W=paths[0].length;
const pct=(arr,q)=>{const s=[...arr].sort((x,y)=>x-y);return s[Math.min(s.length-1,Math.floor(q*(s.length-1)))];}
console.log('\nweek  p2    p10   p25   p50   p75   p90   p98   (as frac of band, 0=lo 1=hi; clipped)');
for(const w of [0,4,8,13,21,26,34,39,44,48,52]){
  const col=paths.map(p=>p[w]);
  const f=v=>Math.max(0,Math.min(1,(v-b.lo)/(b.hi-b.lo)));
  console.log(String(w).padStart(4),[0.02,0.10,0.25,0.5,0.75,0.90,0.98].map(q=>f(pct(col,q)).toFixed(3)).join(' '));
}

// Ink grid: draw polylines into GX x GY cells of a full-bleed field, count coverage.
function inkGrid(GX,GY,bandTop,bandBot){ // bandTop/bandBot as fraction of field height where hi/lo map
  const grid=Array.from({length:GY},()=>new Array(GX).fill(0));
  const SUB=8; // subsample per week segment
  for(const p of paths){
    for(let i=0;i<p.length-1;i++){
      for(let s=0;s<SUB;s++){
        const t=(i+s/SUB)/(p.length-1);
        const v=p[i]+(p[i+1]-p[i])*(s/SUB);
        const fy=(v-b.lo)/(b.hi-b.lo);
        const y=bandBot-(bandBot-bandTop)*fy; // fraction of field height
        if(y<0||y>1) continue;
        const gx=Math.min(GX-1,Math.floor(t*GX));
        const gy=Math.min(GY-1,Math.floor(y*GY));
        grid[gy][gx]++;
      }
    }
  }
  return grid;
}
const GX=12,GY=8;
for(const band of [[0.10,0.98],[0.18,0.92],[0.00,1.00]]){
  const g=inkGrid(GX,GY,band[0],band[1]);
  const max=Math.max(...g.flat());
  console.log(`\nINK GRID  band top=${band[0]} bot=${band[1]}   (0-9 scale of max ${max}); rows top->bottom, cols left->right`);
  for(let r=0;r<GY;r++) console.log('  '+g[r].map(v=>v===0?'.':String(Math.min(9,Math.round(9*v/max)))).join(' '));
}
