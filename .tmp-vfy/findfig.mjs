import fs from 'fs';
const s = fs.readFileSync('/tmp/local_index.html', 'utf8');
let i = -1;
while ((i = s.indexOf('<figure', i + 1)) !== -1) {
  console.log('---', i, JSON.stringify(s.slice(i - 120, i + 60)));
}
