'use strict';
// Общие константы и утилиты. Все модули живут в глобальном пространстве имён G,
// чтобы игра запускалась прямо из файла (file://) без сборщика и сервера.
const G = (window.G = window.G || {});

G.TILE = 16;      // размер тайла в пикселях
G.W = 480;        // внутреннее разрешение (на 1080p — ровно ×4)
G.H = 270;
G.STEP = 1 / 60;  // фиксированный шаг симуляции

G.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
G.lerp = (a, b, t) => a + (b - a) * t;
G.rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
G.randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
G.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
G.approach = (v, t, d) => (v < t ? Math.min(v + d, t) : Math.max(v - d, t));
G.sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
G.dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
G.overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
G.easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
G.easeOutBack = (t) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

// Детерминированный генератор (mulberry32) — для фонов и декора,
// чтобы картинка не «мерцала» между перерисовками.
G.rng = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
G.hash2 = (x, y) => {
  let h = (x * 374761393 + y * 668265263) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// Цвет: смешивание и затемнение hex-строк
G.hexToRgb = (h) => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
G.mix = (c1, c2, t) => {
  const a = G.hexToRgb(c1), b = G.hexToRgb(c2);
  const r = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return '#' + r.map((v) => v.toString(16).padStart(2, '0')).join('');
};
G.shade = (c, t) => (t < 0 ? G.mix(c, '#000000', -t) : G.mix(c, '#ffffff', t));
G.rgba = (c, a) => {
  const [r, g, b] = G.hexToRgb(c);
  return `rgba(${r},${g},${b},${a})`;
};

// Сохранение прогресса и настроек
G.Save = {
  key: 'third-eye-save-v2',
  data: null,
  defaults() {
    return { unlocked: 1, bestCoins: 0, cleared: false, music: 0.6, sfx: 0.8, shake: true, upJump: true, secrets: {} };
  },
  load() {
    try {
      const raw = localStorage.getItem(this.key);
      this.data = Object.assign(this.defaults(), raw ? JSON.parse(raw) : {});
    } catch (e) {
      this.data = this.defaults();
    }
    return this.data;
  },
  store() {
    try {
      localStorage.setItem(this.key, JSON.stringify(this.data));
    } catch (e) { /* приватный режим — просто не сохраняем */ }
  },
};
