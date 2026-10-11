// Рендер листа спрайтов в PNG: node tools/sheet.js <префикс> <out.png> [масштаб] [файлы,через,запятую]
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
(async () => {
  const [prefix = '', out = 'sheet.png', scale = '4', files = ''] = process.argv.slice(2);
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
  const p = await b.newPage({ viewport: { width: 1600, height: 800 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  const url = 'file://' + path.resolve(__dirname, 'sheet.html') + `?prefix=${encodeURIComponent(prefix)}&scale=${scale}` + (files ? `&files=${files}` : '');
  await p.goto(url);
  await p.waitForFunction(() => document.title === 'done', null, { timeout: 15000 }).catch(() => errs.push('timeout'));
  await p.screenshot({ path: out, fullPage: true });
  const artErrs = await p.evaluate(() => (window.G && G.Art ? G.Art.errors : ['no registry']));
  console.log([...errs, ...artErrs].join('\n') || 'ok');
  await b.close();
})();
