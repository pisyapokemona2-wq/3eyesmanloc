// Сборка Windows-версии (portable): node tools/build-exe.js
// 1) скачивает Electron для win32-x64 в .cache/  2) кладёт игру в resources/app
// 3) переименовывает exe и ставит иконку/версию  4) упаковывает dist/ThirdEye-win64.zip
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const CACHE = path.join(ROOT, '.cache');
const DIST = path.join(ROOT, 'dist');
const EV = process.env.ELECTRON_VERSION || '33.2.1';
const NAME = 'ThirdEye';
const OUT = path.join(DIST, `${NAME}-win64`);

const sh = (c, o = {}) => execSync(c, Object.assign({ stdio: 'inherit' }, o));
const rm = (p) => fs.rmSync(p, { recursive: true, force: true });
function copy(src, dst) {
  const st = fs.statSync(src);
  if (st.isDirectory()) { fs.mkdirSync(dst, { recursive: true }); for (const f of fs.readdirSync(src)) copy(path.join(src, f), path.join(dst, f)); }
  else fs.copyFileSync(src, dst);
}

(async () => {
  fs.mkdirSync(CACHE, { recursive: true });
  const zip = path.join(CACHE, `electron-v${EV}-win32-x64.zip`);
  if (!fs.existsSync(zip)) {
    console.log('Скачиваю Electron', EV);
    sh(`curl -sSL --fail -o "${zip}" https://github.com/electron/electron/releases/download/v${EV}/electron-v${EV}-win32-x64.zip`);
  }
  rm(OUT);
  fs.mkdirSync(OUT, { recursive: true });
  sh(`unzip -q "${zip}" -d "${OUT}"`);
  fs.renameSync(path.join(OUT, 'electron.exe'), path.join(OUT, `${NAME}.exe`));
  rm(path.join(OUT, 'resources', 'default_app.asar'));
  rm(path.join(OUT, 'LICENSES.chromium.html'));
  // приложение
  const APP = path.join(OUT, 'resources', 'app');
  fs.mkdirSync(APP, { recursive: true });
  for (const f of ['index.html', 'src', 'assets', 'desktop']) copy(path.join(ROOT, f), path.join(APP, f));
  copy(path.join(ROOT, 'desktop', 'package.json'), path.join(APP, 'package.json'));
  fs.writeFileSync(path.join(OUT, 'КАК ИГРАТЬ.txt'),
    'ТРЕТИЙ ГЛАЗ — пиксельный ремейк 3 Eyes Boy\r\n\r\nЗапуск: ThirdEye.exe\r\nF11 или Alt+Enter — окно / полный экран.\r\n\r\n' +
    'Управление: стрелки — ходьба, Z — прыжок, C — копьё, X — выстрел глазом,\r\nSHIFT — рывок, V — пробуждение глаза, Esc — пауза.\r\nПоддерживается геймпад.\r\n');
  // иконка и сведения о версии
  try {
    const ResEdit = await import(path.join(CACHE, 'node_modules', 'resedit', 'dist', 'index.js')).catch(() => import('resedit'));
    const PELibrary = await import(path.join(CACHE, 'node_modules', 'pe-library', 'dist', 'index.js')).catch(() => import('pe-library'));
    const RE = ResEdit.default || ResEdit, PL = PELibrary.default || PELibrary;
    const exePath = path.join(OUT, `${NAME}.exe`);
    const exe = PL.NtExecutable.from(fs.readFileSync(exePath), { ignoreCert: true });
    const res = PL.NtExecutableResource.from(exe);
    const ico = RE.Data.IconFile.from(fs.readFileSync(path.join(ROOT, 'desktop', 'icon.ico')));
    RE.Resource.IconGroupEntry.replaceIconsForResource(res.entries, 1, 1033, ico.icons.map((i) => i.data));
    const vi = RE.Resource.VersionInfo.fromEntries(res.entries)[0];
    if (vi) {
      vi.setStringValues({ lang: 1033, codepage: 1200 }, { ProductName: 'Third Eye', FileDescription: 'Third Eye', OriginalFilename: `${NAME}.exe`, InternalName: NAME, CompanyName: 'Third Eye' });
      vi.setFileVersion(2, 0, 0, 0, 1033); vi.setProductVersion(2, 0, 0, 0, 1033);
      vi.outputToResourceEntries(res.entries);
    }
    res.outputResource(exe);
    fs.writeFileSync(exePath, Buffer.from(exe.generate()));
    console.log('Иконка и версия записаны');
  } catch (e) { console.warn('Не удалось записать иконку:', e.message); }
  const zipOut = path.join(DIST, `${NAME}-win64.zip`);
  rm(zipOut);
  sh(`cd "${DIST}" && zip -qr -9 "${path.basename(zipOut)}" "${path.basename(OUT)}"`);
  console.log('Готово:', zipOut, (fs.statSync(zipOut).size / 1048576).toFixed(1) + ' МБ');
})();
