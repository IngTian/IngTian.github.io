const S={rl:{cum:1.20,cagr:15.2,vol:17.4,sh:0.90,so:1.65,mdd:-20.3,cal:0.75,ir:0.69,cvar:-10.2,hit:64.2},
        bh:{cum:1.01,cagr:13.4,vol:16.5,sh:0.85,so:1.53,mdd:-19.1,cal:0.70,ir:0.22,cvar:-9.7,hit:64.2},
        bm:{cum:0.91,cagr:12.3,vol:17.3,sh:0.76,so:1.37,mdd:-18.3,cal:0.67,ir:null,cvar:-10.3,hit:62.7}};
const yrs=67/12;
console.log("years =",yrs.toFixed(4));
for(const[k,v]of Object.entries(S)){
  const cagrDer=((1+v.cum)**(1/yrs)-1)*100;
  console.log(`\n${k}:`);
  console.log(`  CAGR from cum over 67mo: ${cagrDer.toFixed(2)}%  printed ${v.cagr}%  -> ${Math.abs(cagrDer-v.cagr)<0.15?"MATCHES":"off"}`);
  console.log(`  Calmar = CAGR/|MDD|:     ${(v.cagr/-v.mdd).toFixed(4)}  printed ${v.cal}  -> ${Math.abs(v.cagr/-v.mdd-v.cal)<0.006?"MATCHES (derived)":"off"}`);
  console.log(`  CAGR/vol:                ${(v.cagr/v.vol).toFixed(3)}  printed Sharpe ${v.sh}  gap ${(v.sh-v.cagr/v.vol).toFixed(3)}`);
  const arith=v.cagr+(v.vol/100)**2/2*100;
  console.log(`  arith approx geo+s^2/2:  ${arith.toFixed(2)}%  /vol = ${(arith/v.vol).toFixed(3)}`);
  console.log(`  hit x 67 = ${(v.hit/100*67).toFixed(2)} -> ${Math.round(v.hit/100*67)}/67 = ${(Math.round(v.hit/100*67)/67*100).toFixed(2)}%`);
  console.log(`  return per unit: vol ${(v.cagr/v.vol).toFixed(3)} | MDD ${(v.cagr/-v.mdd).toFixed(3)} | CVaR ${(v.cagr/-v.cvar).toFixed(3)}`);
}
console.log("\n--- risk raw (higher magnitude = worse) ---");
for(const m of["vol","mdd","cvar"]) console.log(m, Object.entries(S).map(([k,v])=>`${k}:${v[m]}`).join("  "));
console.log("\n--- Sortino/Sharpe ratio (downside asymmetry) ---");
for(const[k,v]of Object.entries(S)) console.log(k,(v.so/v.sh).toFixed(3));
