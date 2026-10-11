// node tools/bg.js <theme> <out.png>
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
(async () => {
  const [theme = 'city', out = 'bg.png'] = process.argv.slice(2);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 960, height: 800 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + path.resolve(__dirname, 'bg.html') + '?theme=' + theme);
  await p.waitForFunction(() => document.title === 'done', null, { timeout: 15000 }).catch(() => errs.push('timeout/ошибка'));
  await p.screenshot({ path: out, fullPage: true });
  console.log(errs.join('\n') || 'ok');
  await b.close();
})();
