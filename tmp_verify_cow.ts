import { COW_DARK, COW_LIGHT, COW_W, COW_H } from './src/data/cowGlyph';
console.log(`grid ${COW_W}x${COW_H}  dark ${COW_DARK.cells.length}  light ${COW_LIGHT.cells.length}`);
const grid = Array.from({length:COW_H},()=>Array(COW_W).fill(' '));
for (const c of COW_LIGHT.cells) grid[c.y][c.x] = '░';
for (const c of COW_DARK.cells) grid[c.y][c.x] = '█';
for (const row of grid) console.log('  ' + row.map(c=>c+c).join(''));
// The two layers must never overlap: a cell is dark OR light, never both.
const dk = new Set(COW_DARK.cells.map(c=>`${c.x},${c.y}`));
const overlap = COW_LIGHT.cells.filter(c=>dk.has(`${c.x},${c.y}`));
console.log('\noverlapping cells (must be 0):', overlap.length);
