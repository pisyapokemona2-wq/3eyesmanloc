'use strict';
// Параллакс-фоны: слои из G.BG_THEMES рисуются один раз в холсты и прокручиваются.
G.Backgrounds = (() => {
  const B = {};
  const cache = {};
  function build(theme) {
    const T = (G.BG_THEMES || {})[theme];
    const out = { sky: document.createElement('canvas'), layers: [], T };
    out.sky.width = G.W; out.sky.height = G.H;
    const sc = out.sky.getContext('2d');
    if (!T) { G.Pix.bands(sc, 0, 0, G.W, G.H, ['#0c0818', '#1a1030', '#2a1840']); return out; }
    T.sky(sc, G.W, G.H);
    T.layers.forEach((L, i) => {
      const w = L.w || G.W, h = L.h || G.H;
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      L.draw(cv.getContext('2d'), w, h, G.Pix.rng(1000 + i * 77));
      out.layers.push({ f: L.f, w, y: L.y || 0, img: cv });
    });
    return out;
  }
  B.prewarm = (theme) => { if (!cache[theme]) cache[theme] = build(theme); };
  // dy — насколько камера выше нижнего края уровня (0 — у земли)
  B.draw = (c, theme, camX, dy, time) => {
    B.prewarm(theme);
    const bg = cache[theme];
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(bg.sky, 0, 0);
    for (const L of bg.layers) {
      const ox = -Math.round(((camX * L.f) % L.w + L.w) % L.w);
      const oy = Math.round(L.y + dy * L.f * 0.35);
      for (let x = ox; x < G.W; x += L.w) c.drawImage(L.img, x, oy);
    }
  };
  B.overlay = (c, theme, camX, time) => {
    const T = cache[theme] && cache[theme].T;
    if (T && T.overlay) { c.setTransform(1, 0, 0, 1, 0, 0); T.overlay(c, G.W, G.H, time, camX); }
  };
  return B;
})();
