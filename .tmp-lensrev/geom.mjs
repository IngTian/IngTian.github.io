// Does a zoomed risk-return window with iso-ratio rays actually separate 3 points?
const P=[{k:'RL-BHRP',vol:17.4,mdd:20.3,cvar:10.2,cagr:15.2},
         {k:'BHRP',   vol:16.5,mdd:19.1,cvar:9.7, cagr:13.4},
         {k:'Bench',  vol:17.3,mdd:18.3,cvar:10.3,cagr:12.3}];
for(const risk of ['vol','mdd','cvar']){
  const xs=P.map(p=>p[risk]), ys=P.map(p=>p.cagr);
  console.log(`\n=== x = ${risk} ===  x span ${Math.min(...xs)}..${Math.max(...xs)} (${(Math.max(...xs)-Math.min(...xs)).toFixed(1)}pp)`);
  console.log(`    ratios:`, P.map(p=>`${p.k} ${(p.cagr/p[risk]).toFixed(3)}`).join('  '));
  // window: pad the data range
  const x0=Math.floor(Math.min(...xs)-1), x1=Math.ceil(Math.max(...xs)+1);
  const y0=Math.floor(Math.min(...ys)-1), y1=Math.ceil(Math.max(...ys)+1);
  console.log(`    window x[${x0},${x1}] y[${y0},${y1}]`);
  // which iso-ratio rays cross this window, and how far apart at window centre?
  const xm=(x0+x1)/2, rays=[];
  for(let r=0.5;r<=1.7;r+=0.05){ const y=r*xm; if(y>y0&&y<y1) rays.push({r:+r.toFixed(2),y:+y.toFixed(2)}); }
  console.log(`    rays crossing at x=${xm}:`, rays.map(o=>`${o.r}->${o.y}`).join(' '));
  // do the 3 points fall on DISTINCT ray bands?
  const step = risk==='cvar'?0.1:0.05;
  const band=p=>Math.floor((p.cagr/p[risk])/step);
  console.log(`    band(step ${step}):`, P.map(p=>`${p.k} b${band(p)}`).join('  '),
              new Set(P.map(band)).size===3?'-> ALL DISTINCT':'-> COLLISION');
}
