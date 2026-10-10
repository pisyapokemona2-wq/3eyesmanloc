'use strict';
// Точка входа: загрузка, фиксированный шаг 60 Гц и отрисовка с частотой экрана.
(() => {
  G.Save.load();
  G.setupTouch();
  const game = (G.game = new G.Game());

  const start = () => {
    game.setState('boot');
    game.fadeTarget = 0;
    let last = performance.now(), acc = 0;
    const loop = (now) => {
      acc += Math.min(0.1, (now - last) / 1000);
      last = now;
      let steps = 0;
      while (acc >= G.STEP && steps < 5) {
        game.step();
        acc -= G.STEP;
        steps++;
      }
      if (steps === 5) acc = 0;
      game.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  };

  // Ждём пиксельный шрифт (если сеть недоступна — через секунду стартуем с запасным)
  const fontReady = document.fonts && document.fonts.load ? document.fonts.load('10px "Press Start 2P"', 'АБВ') : Promise.resolve();
  Promise.race([fontReady, new Promise((r) => setTimeout(r, 1200))]).then(start, start);

  // Клик/тап тоже запускает звук
  const unlock = () => { G.Audio.init(); };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  window.addEventListener('touchstart', unlock, { passive: true });
})();
