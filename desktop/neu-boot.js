// Обёртка Neutralino (лёгкий exe): F11 / Alt+Enter — окно / полный экран.
// В браузере и Electron ничего не делает.
(function () {
  if (!window.NL_PORT) return;
  const s = document.createElement('script');
  s.src = 'desktop/neutralino.js';
  s.onload = function () {
    Neutralino.init();
    Neutralino.events.on('windowClose', function () { Neutralino.app.exit(); });
    let full = true;
    window.addEventListener('keydown', function (e) {
      if (e.key === 'F11' || (e.altKey && e.key === 'Enter')) {
        e.preventDefault();
        full = !full;
        (full ? Neutralino.window.setFullScreen() : Neutralino.window.exitFullScreen()).catch(function () {});
      }
    }, true);
  };
  document.head.appendChild(s);
})();
