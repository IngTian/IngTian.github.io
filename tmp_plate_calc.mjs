const SPREAD_BPS=1.0, SIGMA=0.025, K=1.0, VOL=30e9;
const slipBps=(o)=>o<=0?0:SPREAD_BPS/2+K*SIGMA*Math.sqrt(o/VOL)*1e4;
const cost=(o)=>o*slipBps(o)/1e4;
const rungs=[['your savings',5e3],['a rich family',1e7],['a fund',1e9],['a big fund',1e10]];
const lad=rungs.map(([label,aum])=>{const order=aum*0.2;return{label,aum,order,part:order/VOL,bps:slipBps(order),cost:cost(order)};});
const big=lad[lad.length-1];
const hiL=Math.log10(Math.max(big.cost,10));
console.log('hiL',hiL.toFixed(4));
for(const r of lad){
  const w = r.cost>1 ? Math.max(1.5,(Math.log10(r.cost)/hiL)*100) : 1.5;
  console.log(r.label.padEnd(14), 'aum',r.aum.toExponential(1),'order',r.order.toExponential(2),
    'part%',(r.part*100).toFixed(3), 'bps',r.bps.toFixed(2),
    'cost',Math.round(r.cost).toLocaleString(), 'w%',w.toFixed(1),
    '-> px@1480', Math.round(w/100*1480), 'px@1198', Math.round(w/100*1198), 'px@700', Math.round(w/100*700));
}
