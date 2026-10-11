// Проверка арта без браузера: node tools/check-art.js [файлы...]
const fs = require('fs'), path = require('path');
global.window = global;
eval(fs.readFileSync(path.join(__dirname, '../src/art/registry.js'), 'utf8'));
eval(fs.readFileSync(path.join(__dirname, '../src/art/manifest.js'), 'utf8'));
const files = process.argv.slice(2).length ? process.argv.slice(2) : window.ART_FILES;
const errs = [];
for (const f of files) {
  const p = path.join(__dirname, '../src/art', path.basename(f));
  if (!fs.existsSync(p)) { errs.push('нет файла ' + f); continue; }
  try { eval(fs.readFileSync(p, 'utf8')); } catch (e) { errs.push(f + ': ' + e.message); }
}
const A = G.Art;
for (const [n, d] of Object.entries(A.defs)) {
  const pal = typeof d.pal === 'string' ? A.pals[d.pal] : d.pal;
  if (!pal) { errs.push(`${n}: нет палитры ${d.pal}`); continue; }
  const w = d.rows[0].length;
  d.rows.forEach((r, i) => { if (r.length !== w) errs.push(`${n}: строка ${i} длиной ${r.length}, ожидалось ${w}`); });
  const bad = new Set();
  for (const r of d.rows) for (const ch of r) if (ch !== '.' && ch !== ' ' && !pal[ch]) bad.add(ch);
  if (bad.size) errs.push(`${n}: символы не из палитры: ${[...bad].join('')}`);
}
for (const [n, a] of Object.entries(A.anims)) for (const f of a.frames) if (!A.defs[f]) errs.push(`анимация ${n}: нет кадра ${f}`);
errs.push(...A.errors);
console.log(errs.length ? errs.join('\n') : `ok: ${Object.keys(A.defs).length} спрайтов, ${Object.keys(A.anims).length} анимаций`);
process.exit(errs.length ? 1 : 0);
