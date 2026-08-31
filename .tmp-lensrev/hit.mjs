const N=67;
const H=[['RL-BHRP',64.2,15.2],['BHRP',64.2,13.4],['Bench',62.7,12.3]];
console.log('exact period counts recoverable from hit rate x 67:');
for(const[k,h,cagr]of H){
  const raw=h/100*N, n=Math.round(raw);
  console.log(`  ${k.padEnd(8)} ${h}% x 67 = ${raw.toFixed(3)} -> ${n}/67 = ${(n/N*100).toFixed(2)}%  ${Math.abs(n/N*100-h)<0.05?'EXACT':'MISMATCH'}   CAGR ${cagr}%`);
}
console.log('\nRL vs BHRP: identical hit count (43/67) but CAGR 15.2 vs 13.4');
console.log('  -> the edge is in the MAGNITUDE of periods, not the COUNT. Checkable arithmetic.');
console.log('\nRL vs Bench: 43 vs 42 out of 67 = ONE period. Must NOT be drawn as a meaningful gap.');
// naive binomial sanity: is 43/67 vs 42/67 distinguishable? obviously not.
const se=Math.sqrt(0.64*0.36/N);
console.log(`  se of a hit rate at n=67 ~ ${(se*100).toFixed(2)}pp -> 1.5pp gap is ~${(1.5/(se*100)).toFixed(2)} se. Noise.`);
console.log('\nSharpe vs CAGR/vol -- why rays must NOT be labelled "iso-Sharpe":');
for(const[k,,cagr]of H){}
const T=[['RL-BHRP',15.2,17.4,0.90],['BHRP',13.4,16.5,0.85],['Bench',12.3,17.3,0.76]];
for(const[k,cagr,vol,sh]of T)
  console.log(`  ${k.padEnd(8)} CAGR/vol=${(cagr/vol).toFixed(3)}  printed Sharpe=${sh}  (differ: Sharpe uses ARITHMETIC excess return)`);
