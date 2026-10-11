// Windows-версия одним файлом (~4 МБ): node tools/build-exe-lite.js → dist/ThirdEye.exe
// Neutralino использует встроенный в Windows 10/11 движок WebView2; игра вшита прямо в exe.
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const STAGE = path.join(ROOT, '.cache', 'neuproj');
const DIST = path.join(ROOT, 'dist');
const NV = process.env.NEU_VERSION || '6.4.0';
const sh = (c) => execSync(c, { stdio: 'inherit', cwd: STAGE });
const rm = (p) => fs.rmSync(p, { recursive: true, force: true });
function copy(src, dst) {
  if (fs.statSync(src).isDirectory()) { fs.mkdirSync(dst, { recursive: true }); for (const f of fs.readdirSync(src)) copy(path.join(src, f), path.join(dst, f)); }
  else fs.copyFileSync(src, dst);
}

rm(path.join(STAGE, 'www')); rm(path.join(STAGE, 'dist'));
fs.mkdirSync(path.join(STAGE, 'www', 'desktop'), { recursive: true });
for (const f of ['index.html', 'src', 'assets']) copy(path.join(ROOT, f), path.join(STAGE, 'www', f));
for (const f of ['neu-boot.js', 'icon.png']) copy(path.join(ROOT, 'desktop', f), path.join(STAGE, 'www', 'desktop', f));
fs.writeFileSync(path.join(STAGE, 'neutralino.config.json'), JSON.stringify({
  applicationId: 'thirdeye.game', version: '2.0.0', defaultMode: 'window',
  documentRoot: '/www/', url: '/', enableServer: true, enableNativeAPI: true,
  tokenSecurity: 'one-time', logging: { enabled: false, writeToLogFile: false },
  nativeAllowList: ['app.exit', 'window.*'],
  modes: { window: {
    title: 'Третий Глаз', width: 1440, height: 810, minWidth: 480, minHeight: 270,
    fullScreen: true, center: true, resizable: true, enableInspector: false,
    exitProcessOnClose: true, icon: '/www/desktop/icon.png',
  } },
  cli: { binaryName: 'ThirdEye', resourcesPath: '/www/', extensionsPath: '/extensions/', clientLibrary: '/www/desktop/neutralino.js', binaryVersion: NV, clientVersion: NV, distributionPath: '/dist' },
}, null, 2));
if (!fs.existsSync(path.join(STAGE, 'package.json'))) fs.writeFileSync(path.join(STAGE, 'package.json'), '{"name":"thirdeye-build","private":true}');
if (!fs.existsSync(path.join(STAGE, 'node_modules', '@neutralinojs', 'neu'))) sh('npm i -s @neutralinojs/neu@11.8.0');
sh('npx neu update');
sh('npx neu build --release --embed-resources');
fs.mkdirSync(DIST, { recursive: true });
const out = path.join(DIST, 'ThirdEye.exe');
fs.copyFileSync(path.join(STAGE, 'dist', 'ThirdEye', 'ThirdEye-win_x64.exe'), out);
console.log('Готово:', out, (fs.statSync(out).size / 1048576).toFixed(1) + ' МБ');
