// Иконка приложения из пиксельного спрайта: desktop/icon.png (256) и desktop/icon.ico
const path = require('path'), fs = require('fs');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
  const p = await b.newPage();
  await p.goto('file://' + path.resolve(__dirname, 'sheet.html') + '?prefix=zzz&files=items.js,hero.js');
  await p.waitForFunction(() => document.title === 'done');
  const pngs = await p.evaluate(() => [256, 64, 48, 32, 16].map((S) => {
    const c = document.createElement('canvas'); c.width = c.height = S;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    // тёмный скруглённый фон с золотой рамкой
    const r = S / 8;
    x.fillStyle = '#1a0e2a'; x.beginPath(); x.roundRect(0, 0, S, S, r); x.fill();
    x.strokeStyle = '#e8b84a'; x.lineWidth = Math.max(1, S / 32); x.beginPath(); x.roundRect(x.lineWidth / 2, x.lineWidth / 2, S - x.lineWidth, S - x.lineWidth, r); x.stroke();
    const s = G.Art.get('hero_portrait');
    const k = Math.floor((S * 0.86) / s.w) || S / s.w;
    x.drawImage(s.img, Math.round((S - s.w * k) / 2), Math.round(S - s.h * k - S * 0.04), s.w * k, s.h * k);
    return c.toDataURL('image/png').split(',')[1];
  }));
  await b.close();
  const bufs = pngs.map((d) => Buffer.from(d, 'base64'));
  fs.writeFileSync(path.join(__dirname, '../desktop/icon.png'), bufs[0]);
  // ICO с PNG-записями
  const sizes = [256, 64, 48, 32, 16];
  const head = Buffer.alloc(6 + 16 * bufs.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(bufs.length, 4);
  let off = head.length;
  bufs.forEach((bf, i) => {
    const o = 6 + i * 16, sz = sizes[i];
    head.writeUInt8(sz >= 256 ? 0 : sz, o); head.writeUInt8(sz >= 256 ? 0 : sz, o + 1);
    head.writeUInt8(0, o + 2); head.writeUInt8(0, o + 3);
    head.writeUInt16LE(1, o + 4); head.writeUInt16LE(32, o + 6);
    head.writeUInt32LE(bf.length, o + 8); head.writeUInt32LE(off, o + 12);
    off += bf.length;
  });
  fs.writeFileSync(path.join(__dirname, '../desktop/icon.ico'), Buffer.concat([head, ...bufs]));
  console.log('icon ok');
})();
