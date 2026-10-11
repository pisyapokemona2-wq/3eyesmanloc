// Лёгкая Windows-версия (~3 МБ) на Neutralino: node tools/build-exe-lite.js
// Использует встроенный в Windows 10/11 движок WebView2 вместо целого Chromium.
// Нужен пакет @electron/asar (в .cache/node_modules или глобально).
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const CACHE = path.join(ROOT, '.cache');
const DIST = path.join(ROOT, 'dist');
const NV = process.env.NEU_VERSION || '5.4.0';
const NAME = 'ThirdEye';
const OUT = path.join(DIST, `${NAME}-lite`);
const sh = (c) => execSync(c, { stdio: 'inherit' });
const rm = (p) => fs.rmSync(p, { recursive: true, force: true });
function copy(src, dst) {
  if (fs.statSync(src).isDirectory()) { fs.mkdirSync(dst, { recursive: true }); for (const f of fs.readdirSync(src)) copy(path.join(src, f), path.join(dst, f)); }
  else fs.copyFileSync(src, dst);
}

fs.mkdirSync(CACHE, { recursive: true });
const zip = path.join(CACHE, `neutralinojs-v${NV}.zip`);
if (!fs.existsSync(zip)) sh(`curl -sSL --fail -o "${zip}" https://github.com/neutralinojs/neutralinojs/releases/download/v${NV}/neutralinojs-v${NV}.zip`);
rm(OUT); fs.mkdirSync(OUT, { recursive: true });
sh(`unzip -q -o "${zip}" neutralino-win_x64.exe -d "${OUT}"`);
fs.renameSync(path.join(OUT, 'neutralino-win_x64.exe'), path.join(OUT, `${NAME}.exe`));

// ресурсы игры + конфиг -> resources.neu (формат asar)
const STAGE = path.join(CACHE, 'neu-stage');
rm(STAGE); fs.mkdirSync(STAGE, { recursive: true });
for (const f of ['index.html', 'src', 'assets']) copy(path.join(ROOT, f), path.join(STAGE, f));
fs.mkdirSync(path.join(STAGE, 'desktop'));
for (const f of ['neu-boot.js', 'neutralino.js', 'icon.png']) copy(path.join(ROOT, 'desktop', f), path.join(STAGE, 'desktop', f));
fs.writeFileSync(path.join(STAGE, 'neutralino.config.json'), JSON.stringify({
  applicationId: 'thirdeye.game', version: '2.0.0', defaultMode: 'window',
  documentRoot: '/', url: '/', enableServer: true, enableNativeAPI: true,
  tokenSecurity: 'one-time', logging: { enabled: false, writeToLogFile: false },
  nativeAllowList: ['app.exit', 'window.*'],
  modes: { window: {
    title: 'Третий Глаз', width: 1440, height: 810, minWidth: 480, minHeight: 270,
    fullScreen: true, center: true, resizable: true, enableInspector: false,
    exitProcessOnClose: true, icon: '/desktop/icon.png',
  } },
  cli: { binaryName: NAME, resourcesPath: '/', distributionPath: '/dist' },
}, null, 2));
let asar;
try { asar = require(path.join(CACHE, 'node_modules', '@electron', 'asar')); } catch (e) { asar = require('@electron/asar'); }
(async () => {
  await asar.createPackage(STAGE, path.join(OUT, 'resources.neu'));
  rm(STAGE);
  fs.writeFileSync(path.join(OUT, 'КАК ИГРАТЬ.txt'),
    'ТРЕТИЙ ГЛАЗ — пиксельный ремейк 3 Eyes Boy\r\n\r\nЗапуск: ThirdEye.exe (файл resources.neu должен лежать рядом).\r\n' +
    'Нужен Windows 10/11 (движок WebView2 уже встроен).\r\nF11 или Alt+Enter — окно / полный экран.\r\n\r\n' +
    'Управление: стрелки — ходьба, Z — прыжок, C — копьё, X — выстрел глазом,\r\nSHIFT — рывок, V — пробуждение глаза, Esc — пауза.\r\nПоддерживается геймпад.\r\n');
  const zipOut = path.join(DIST, `${NAME}-lite.zip`);
  rm(zipOut);
  sh(`cd "${DIST}" && zip -qr -9 "${path.basename(zipOut)}" "${path.basename(OUT)}"`);
  console.log('Готово:', zipOut, (fs.statSync(zipOut).size / 1048576).toFixed(1) + ' МБ');
})();
