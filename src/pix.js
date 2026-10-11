'use strict';
// Пиксельные примитивы без сглаживания: всё рисуется целыми прямоугольниками.
(function () {
  const G = (window.G = window.G || {});
  const P = (G.Pix = {});
  P.rect = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  P.px = (c, x, y, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), 1, 1); };
  // Шахматный дизеринг двух цветов; pattern: 0 — 50%, 1 — 25% второго цвета, 2 — 12.5%
  P.dither = (c, x, y, w, h, a, b, pattern = 0) => {
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    c.fillStyle = a; c.fillRect(x, y, w, h);
    c.fillStyle = b;
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      const on = pattern === 0 ? (xx + yy) % 2 === 0 : pattern === 1 ? xx % 2 === 0 && yy % 2 === 0 : xx % 4 === 0 && yy % 2 === 0 && ((xx / 4 + yy / 2) % 2 === 0);
      if (on) c.fillRect(xx, yy, 1, 1);
    }
  };
  // Вертикальный градиент полосами с дизеринговыми переходами (как на SNES)
  // stops: массив цветов сверху вниз; band — высота перехода дизеринга
  P.bands = (c, x, y, w, h, stops, band = 2) => {
    const n = stops.length;
    const seg = h / n;
    for (let i = 0; i < n; i++) {
      const y0 = Math.round(y + i * seg), y1 = Math.round(y + (i + 1) * seg);
      P.rect(c, x, y0, w, y1 - y0, stops[i]);
      if (i < n - 1 && band > 0) {
        P.dither(c, x, y1 - band, w, band, stops[i], stops[i + 1], 1);
        P.dither(c, x, y1, w, band, stops[i + 1], stops[i], 1);
      }
    }
  };
  P.hline = (c, x0, x1, y, col) => { c.fillStyle = col; const a = Math.round(Math.min(x0, x1)); c.fillRect(a, Math.round(y), Math.round(Math.max(x0, x1)) - a + 1, 1); };
  P.vline = (c, x, y0, y1, col) => { c.fillStyle = col; const a = Math.round(Math.min(y0, y1)); c.fillRect(Math.round(x), a, 1, Math.round(Math.max(y0, y1)) - a + 1); };
  // Брезенхем
  P.line = (c, x0, y0, x1, y1, col) => {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    c.fillStyle = col;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    for (let i = 0; i < 4000; i++) {
      c.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  };
  // Заполненный круг/эллипс без сглаживания
  P.ellipse = (c, cx, cy, rx, ry, col) => {
    c.fillStyle = col;
    for (let y = -Math.ceil(ry); y <= Math.ceil(ry); y++) {
      const k = 1 - (y * y) / (ry * ry);
      if (k < 0) continue;
      const hw = Math.round(rx * Math.sqrt(k));
      c.fillRect(Math.round(cx - hw), Math.round(cy + y), hw * 2 + 1, 1);
    }
  };
  P.circle = (c, cx, cy, r, col) => P.ellipse(c, cx, cy, r, r, col);
  // Многоугольник: точки [[x,y],...]; заливка по строкам
  P.poly = (c, pts, col) => {
    c.fillStyle = col;
    let minY = Infinity, maxY = -Infinity;
    for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
    for (let y = Math.ceil(minY); y <= Math.floor(maxY); y++) {
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) xs.push(a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
      }
      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2) { const x0 = Math.round(xs[i]), x1 = Math.round(xs[i + 1]); if (x1 > x0) c.fillRect(x0, y, x1 - x0, 1); }
    }
  };
  // Силуэт «хребта»: высоты по колонкам — функция f(x) → y
  P.ridge = (c, x0, w, bottom, f, col) => {
    c.fillStyle = col;
    for (let x = x0; x < x0 + w; x++) { const y = Math.round(f(x)); if (y < bottom) c.fillRect(x, y, 1, bottom - y); }
  };
  // Смешение цветов
  P.mix = (a, b, t) => {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
    const g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
    const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
  };
  // Детерминированный ГСЧ
  P.rng = (seed) => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
})();
