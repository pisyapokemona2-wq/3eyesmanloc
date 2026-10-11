G.BG_THEMES = G.BG_THEMES || {};
// Процедурные параллакс-фоны (SNES-стиль): только G.Pix и fillRect, целые координаты.
// Каждый слой бесшовно повторяется по x: всё, что может пересечь край, рисуется через at()
// в трёх копиях (x-w, x, x+w), шум — периодический по ширине слоя.
(function () {
  'use strict';
  const P = G.Pix;
  const TAU = Math.PI * 2;
  const T = G.BG_THEMES;

  // ---------- общие помощники ----------
  const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const on = (x, y, l) => BAY[((y & 3) << 2) | (x & 3)] < l;
  const mix = P.mix;
  const fr = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  // дизеринг-строка по Байеру 4×4 (уровень 0..16)
  function drow(c, x0, x1, y, col, l) {
    if (l <= 0) return;
    c.fillStyle = col;
    x0 = Math.round(x0); x1 = Math.round(x1); y = Math.round(y);
    if (l >= 16) { c.fillRect(x0, y, x1 - x0 + 1, 1); return; }
    for (let x = x0; x <= x1; x++) if (on(x, y, l)) c.fillRect(x, y, 1, 1);
  }
  function dfill(c, x, y, w, h, col, l) {
    for (let yy = Math.round(y); yy < Math.round(y + h); yy++) drow(c, x, x + w - 1, yy, col, l);
  }
  function dell(c, cx, cy, rx, ry, col, l) {
    if (rx < 0.5 || ry < 0.5) return;
    for (let y = -Math.ceil(ry); y <= Math.ceil(ry); y++) {
      const k = 1 - (y * y) / (ry * ry);
      if (k < 0) continue;
      const hw = Math.round(rx * Math.sqrt(k));
      drow(c, Math.round(cx) - hw, Math.round(cx) + hw, Math.round(cy) + y, col, l);
    }
  }
  // мягкое свечение: концентрические кольца дизеринга
  function glow(c, cx, cy, r, col, lv = 8, ry) {
    ry = ry || r;
    for (let k = 0; k < 4; k++) {
      const s = 1 - k * 0.22;
      dell(c, cx, cy, r * s, ry * s, col, Math.round((lv * (k + 1)) / 4));
    }
  }
  // небо полосами с дизеринговыми переходами; stops: [[y, col], ...]
  function skyBands(c, w, h, stops, dz = 3) {
    for (let i = 0; i < stops.length; i++) {
      const y0 = stops[i][0], y1 = i + 1 < stops.length ? stops[i + 1][0] : h;
      fr(c, 0, y0, w, y1 - y0, stops[i][1]);
    }
    for (let i = 1; i < stops.length; i++) {
      const b = stops[i][0], a = stops[i - 1][1], n = stops[i][1];
      for (let yy = b - dz; yy < b + dz; yy++) {
        const t = (yy - (b - dz) + 0.5) / (2 * dz);
        fr(c, 0, yy, w, 1, a);
        drow(c, 0, w - 1, yy, n, Math.round(t * 16));
      }
    }
  }
  // копии фигуры по краям для бесшовности
  function at(w, x, fn) { fn(x - w); fn(x); fn(x + w); }
  // периодический шум 0..1
  function pnoise(rnd, period, cells) {
    const v = [];
    for (let i = 0; i < cells; i++) v.push(rnd());
    return (x) => {
      let t = (x / period) * cells;
      t = ((t % cells) + cells) % cells;
      const i = Math.floor(t), f = t - i, s = f * f * (3 - 2 * f);
      return v[i] + (v[(i + 1) % cells] - v[i]) * s;
    };
  }
  function fbm(rnd, period, cells, oct = 4, gain = 0.5) {
    const ns = [];
    for (let o = 0; o < oct; o++) { ns.push(pnoise(rnd, period, cells)); cells *= 2; }
    return (x) => { let s = 0, a = 1, t = 0; for (const n of ns) { s += n(x) * a; t += a; a *= gain; } return s / t; };
  }
  // детерминированный хеш 0..1
  function hash(a, b = 0, c2 = 0) {
    let h = (a * 374761393 + b * 668265263 + c2 * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  // хребет с дизеринговой кромкой (полупиксельная мягкость силуэта не нужна — кромка сплошная)
  function ridge(c, w, bottom, f, col) { P.ridge(c, 0, w, bottom, f, col); }
  // вертикальная заливка «туманом» по высоте: снизу плотнее
  function hazeUp(c, w, y0, y1, col, lmax) {
    for (let y = y0; y < y1; y++) drow(c, 0, w - 1, y, col, Math.round(((y - y0) / (y1 - y0)) * lmax));
  }
  function hazeDown(c, w, y0, y1, col, lmax) {
    for (let y = y0; y < y1; y++) drow(c, 0, w - 1, y, col, Math.round((1 - (y - y0) / (y1 - y0)) * lmax));
  }
  // звёзды
  function stars(c, w, h, rnd, n, cols) {
    for (let i = 0; i < n; i++) {
      const x = Math.floor(rnd() * w), y = Math.floor(rnd() * h), col = cols[Math.floor(rnd() * cols.length)];
      fr(c, x, y, 1, 1, col);
      if (rnd() < 0.08) { fr(c, x - 1, y, 3, 1, col); fr(c, x, y - 1, 1, 3, col); }
    }
  }
  // облако из эллипсов: тело + светлая шапка + тёмное брюхо
  function cloud(c, cx, cy, s, cols, rnd) {
    const [dark, mid, lite] = cols;
    const puffs = [];
    const n = 4 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1) - 0.5;
      puffs.push([cx + t * 44 * s, cy - (1 - Math.abs(t) * 2) * 8 * s - rnd() * 4 * s, (9 + rnd() * 7) * s]);
    }
    for (const [x, y, r] of puffs) P.ellipse(c, x, y + 2, r, r * 0.75, dark);
    for (const [x, y, r] of puffs) P.ellipse(c, x, y, r * 0.95, r * 0.68, mid);
    for (const [x, y, r] of puffs) P.ellipse(c, x - r * 0.25, y - r * 0.25, r * 0.6, r * 0.4, lite);
    fr(c, cx - 26 * s, cy + 3 * s, 52 * s, 2 * s, dark);
  }

  // =====================================================================
  // CITY — Токио на закате: дальняя телебашня, небоскрёбы с окнами, краны
  // =====================================================================
  function building(c, x, y, bw, bh, body, edge, win, winOff, seed, opt = {}) {
    fr(c, x, y, bw, bh, body);
    fr(c, x, y, 1, bh, edge);
    fr(c, x, y, bw, 1, edge);
    const sx = opt.sx || 4, sy = opt.sy || 5, ww = opt.ww || 2, wh = opt.wh || 2;
    for (let j = 0, wy = y + 4; wy < y + bh - 2; wy += sy, j++) {
      for (let i = 0, wx = x + 3; wx + ww <= x + bw - 2; wx += sx, i++) {
        const r = hash(seed, i, j);
        const lit = r < (opt.lit || 0.25) && hash(seed + 7, j, 0) < 0.85;
        if (lit) fr(c, wx, wy, ww, wh, r < 0.05 ? opt.win2 || win : win);
        else if (winOff) fr(c, wx, wy, ww, wh, winOff);
      }
    }
  }
  function tokyoTower(c, x, base, H, col, lite, dark) {
    // две опоры с аркой, сужение к верху, две обзорные площадки, шпиль
    const half = (t) => Math.round(18 * Math.pow(1 - t, 1.6)) + 1;
    for (let y = 0; y < H * 0.82; y++) {
      const t = y / H;
      const hw = half(t);
      const yy = base - y;
      fr(c, x - hw, yy, hw * 2 + 1, 1, (Math.floor(y / 6) % 2) ? col : lite);
    }
    // арка внизу (просвет)
    for (let y = 0; y < 16; y++) {
      const hw = Math.round(9 * Math.sqrt(1 - (y / 16) * (y / 16)));
      fr(c, x - hw, base - y, hw * 2 + 1, 1, dark);
    }
    // решётка — диагонали
    for (let y = 18; y < H * 0.6; y += 8) { const hw = half(y / H); P.line(c, x - hw + 1, base - y, x, base - y - 4, dark); P.line(c, x + hw - 1, base - y, x, base - y - 4, dark); }
    const d1 = base - Math.round(H * 0.42), d2 = base - Math.round(H * 0.68);
    fr(c, x - 9, d1 - 3, 19, 4, lite); fr(c, x - 9, d1 + 1, 19, 1, dark);
    fr(c, x - 4, d2 - 2, 9, 3, lite);
    fr(c, x, base - H, 1, Math.round(H * 0.2), col);
    fr(c, x, base - H - 1, 1, 1, '#ffe0a0');
  }
  function skytree(c, x, base, H, col, lite) {
    for (let y = 0; y < H * 0.85; y++) {
      const t = y / H;
      const hw = Math.max(1, Math.round(6 * (1 - t) + 0.5));
      fr(c, x - hw, base - y, hw * 2 + 1, 1, col);
    }
    const d1 = base - Math.round(H * 0.55), d2 = base - Math.round(H * 0.7);
    fr(c, x - 5, d1 - 4, 11, 5, lite); fr(c, x - 3, d2 - 2, 7, 3, lite);
    fr(c, x, base - H, 1, Math.round(H * 0.16), col);
  }
  function crane(c, x, base, H, jibL, jibR, col, lite) {
    // мачта-ферма
    const top = base - H;
    fr(c, x, top, 1, H, col); fr(c, x + 6, top, 1, H, col);
    for (let y = top; y < base; y += 7) { P.line(c, x, y, x + 6, y + 7, col); fr(c, x, y, 7, 1, col); }
    fr(c, x + 1, top, 1, H, lite);
    // кабина
    fr(c, x - 2, top - 6, 9, 6, col); fr(c, x - 1, top - 5, 3, 2, '#d89060');
    // стрела вправо: ферма-треугольник
    const jy = top - 8;
    fr(c, x - jibL, jy, jibL + jibR + 7, 1, col);
    fr(c, x - jibL, jy + 4, jibL + jibR + 7, 1, col);
    for (let k = x - jibL; k < x + jibR; k += 6) P.line(c, k, jy + 4, k + 3, jy, col);
    // противовес
    fr(c, x - jibL, jy + 5, 14, 7, col); fr(c, x - jibL, jy + 5, 14, 1, lite);
    // оголовок и ванты
    fr(c, x + 2, jy - 18, 3, 18, col);
    P.line(c, x + 3, jy - 18, x + jibR, jy, col);
    P.line(c, x + 3, jy - 18, x - jibL + 2, jy, col);
    fr(c, x + 3, jy - 19, 1, 1, '#ff5040');
    // трос с крюком
    const hx = x + Math.round(jibR * 0.7), hl = Math.round(H * 0.35);
    fr(c, hx, jy + 5, 1, hl, col);
    fr(c, hx - 2, jy + 5 + hl, 5, 3, col);
    fr(c, hx - 1, jy + 8 + hl, 1, 2, col);
  }
  function steelFrame(c, x, base, bw, floors, col, lite, warn) {
    const fh = 9;
    for (let f = 0; f <= floors; f++) {
      const y = base - f * fh;
      const wcut = f === floors ? Math.round(bw * 0.55) : bw;
      fr(c, x, y, wcut, 2, col);
      fr(c, x, y, wcut, 1, lite);
    }
    for (let k = 0; k <= bw; k += 10) {
      const top = k > bw * 0.55 ? base - (floors - 1) * fh : base - floors * fh;
      fr(c, x + k, top, 2, base - top, col);
    }
    // диагональные связи
    for (let f = 0; f < floors - 1; f += 2) P.line(c, x, base - f * fh, x + 10, base - (f + 1) * fh, col);
    fr(c, x + 2, base - floors * fh - 3, 1, 3, col);
    fr(c, x + 2, base - floors * fh - 4, 1, 1, warn);
  }

  T.city = {
    sky(c, w, h) {
      skyBands(c, w, h, [
        [0, '#170d2c'], [34, '#22123c'], [66, '#331750'], [96, '#4c1d5e'], [122, '#6c2566'],
        [144, '#93326a'], [162, '#b9466a'], [178, '#d8625f'], [192, '#ec8660'], [206, '#f6aa6a'], [224, '#f9c47a'],
      ], 3);
      const r = P.rng(31);
      stars(c, w, 70, r, 50, ['#4a3a72', '#6a5a92', '#8f7fb0']);
      // солнце с полосами-прорезями
      const sx = 330, sy = 168, R0 = 28;
      glow(c, sx, sy, 64, '#f6a46c', 6, 44);
      for (let y = -R0; y <= R0; y++) {
        const hw = Math.round(Math.sqrt(R0 * R0 - y * y));
        const t = (y + R0) / (2 * R0);
        const col = t < 0.33 ? '#ffeeb0' : t < 0.6 ? '#ffd890' : t < 0.8 ? '#ffb478' : '#ff9268';
        const gap = y > 4 && ((y - 4) % 7) < Math.min(4, 1 + Math.floor((y - 4) / 8));
        if (!gap) fr(c, sx - hw, sy + y, hw * 2 + 1, 1, col);
      }
      // перистые облака
      const cl = [[60, 112, 120], [190, 128, 90], [400, 104, 140], [250, 150, 70], [20, 156, 80], [430, 144, 60]];
      for (const [x, y, len] of cl) {
        fr(c, x, y, len, 1, '#c25478'); fr(c, x + 8, y + 1, len - 20, 1, '#a8406e');
        fr(c, x + 14, y - 1, Math.round(len * 0.4), 1, '#e07a7a');
      }
    },
    layers: [
      { // дальний горизонт: дымка, телебашни
        f: 0.04, w: 960, y: 0, h: 270,
        draw(c, w, h, rnd) {
          const col = '#a94b72', lite = '#c25f7a', dark = '#93406a';
          const base = 214;
          let x = 0, k = 0;
          while (x < w) {
            const bw = 10 + Math.floor(rnd() * 22), bh = 10 + Math.floor(rnd() * 40);
            const xx = x, s = k;
            at(w, xx, (X) => building(c, X, base - bh, bw, bh + 60, col, lite, '#d6807a', null, 100 + s, { sx: 4, sy: 5, ww: 1, wh: 1, lit: 0.12 }));
            x += bw + Math.floor(rnd() * 3) - 1; k++;
          }
          tokyoTower(c, 300, base, 112, '#c4506a', '#d66a74', '#a9466e');
          skytree(c, 770, base, 140, '#a24a72', '#b9587a');
          hazeUp(c, w, 196, 230, '#c46072', 8);
          fr(c, 0, 230, w, 40, '#b55470');
        },
      },
      { // средний план: небоскрёбы с окнами
        f: 0.12, w: 960, y: 0, h: 270,
        draw(c, w, h, rnd) {
          const body = '#5c2858', edge = '#7a3a64', off = '#532552';
          let x = 0, k = 0;
          while (x < w) {
            const bw = 22 + Math.floor(rnd() * 34), bh = 26 + Math.floor(rnd() * 58) + (rnd() < 0.15 ? 30 : 0);
            const top = 234 - bh, s = k;
            const roof = rnd();
            at(w, x, (X) => {
              building(c, X, top, bw, h - top, body, edge, '#e0a062', off, 300 + s, { lit: 0.16, win2: '#f4d08a' });
              if (roof < 0.3) { fr(c, X + 4, top - 7, 8, 7, body); fr(c, X + 4, top - 7, 8, 1, edge); fr(c, X + 5, top - 9, 1, 2, body); }
              else if (roof < 0.55) { fr(c, X + Math.floor(bw / 2), top - 22, 1, 22, body); fr(c, X + Math.floor(bw / 2), top - 23, 1, 1, '#ff5a4a'); }
              else if (roof < 0.7) { for (let i = 0; i < 6; i++) fr(c, X + 2 + i, top - 6 + i, bw - 4 - i * 2, 1, body); }
            });
            x += bw + (rnd() < 0.35 ? 10 + Math.floor(rnd() * 26) : Math.floor(rnd() * 4)); k++;
          }
          hazeUp(c, w, 200, 236, '#8a3a62', 6);
        },
      },
      { // стройка: краны и каркасы
        f: 0.25, w: 960, y: 0, h: 270,
        draw(c, w, h, rnd) {
          const col = '#33173e', lite = '#4a2350';
          // низкие тёмные дома
          let x = 0, k = 0;
          while (x < w) {
            const bw = 30 + Math.floor(rnd() * 50), bh = 20 + Math.floor(rnd() * 40), s = k;
            at(w, x, (X) => building(c, X, 236 - bh, bw, 40 + bh, col, lite, '#c98a5c', null, 500 + s, { sx: 5, sy: 6, lit: 0.12 }));
            x += bw + Math.floor(rnd() * 20); k++;
          }
          at(w, 140, (X) => steelFrame(c, X, 220, 70, 9, col, lite, '#ff6040'));
          at(w, 610, (X) => steelFrame(c, X, 224, 90, 7, col, lite, '#ff6040'));
          at(w, 120, (X) => crane(c, X, 226, 150, 34, 110, col, lite));
          at(w, 640, (X) => crane(c, X, 230, 120, 28, 90, col, lite));
          at(w, 880, (X) => crane(c, X, 236, 96, 24, 70, col, lite));
        },
      },
      { // ближние крыши: кондиционеры, бак, вывески
        f: 0.45, w: 960, y: 0, h: 270,
        draw(c, w, h, rnd) {
          const col = '#190c22', lite = '#2a1532';
          let x = 0, k = 0;
          while (x < w) {
            const bw = 60 + Math.floor(rnd() * 90), top = 222 + Math.floor(rnd() * 24), s = k;
            const kind = rnd();
            at(w, x, (X) => {
              fr(c, X, top, bw, h - top, col); fr(c, X, top, bw, 1, lite);
              // парапет-ограждение
              for (let i = 0; i < bw; i += 5) fr(c, X + i, top - 5, 1, 5, col);
              fr(c, X, top - 5, bw, 1, col);
              if (kind < 0.35) { // водонапорный бак
                const bx = X + 14;
                fr(c, bx, top - 26, 18, 14, col); fr(c, bx + 1, top - 26, 16, 1, lite);
                P.poly(c, [[bx - 1, top - 26], [bx + 9, top - 33], [bx + 19, top - 26]], col);
                fr(c, bx + 2, top - 12, 1, 12, col); fr(c, bx + 15, top - 12, 1, 12, col);
                P.line(c, bx + 2, top - 12, bx + 15, top - 2, col); P.line(c, bx + 15, top - 12, bx + 2, top - 2, col);
              } else if (kind < 0.7) { // вывеска с тусклым неоном
                const sx = X + 10, sw = 26, sh = 30, sy = top - sh - 8;
                fr(c, sx + 4, sy + sh, 1, 8, col); fr(c, sx + sw - 5, sy + sh, 1, 8, col);
                fr(c, sx, sy, sw, sh, col);
                const neon = hash(s, 1) < 0.5 ? '#a8406c' : '#3d6a7e';
                fr(c, sx + 2, sy + 2, sw - 4, 1, neon); fr(c, sx + 2, sy + sh - 3, sw - 4, 1, neon);
                for (let g = 0; g < 3; g++) { const gy = sy + 6 + g * 7; fr(c, sx + 8, gy, 10, 1, neon); fr(c, sx + 12, gy, 1, 5, neon); fr(c, sx + 9, gy + 3, 8, 1, neon); }
              }
              // кондиционеры
              for (let i = 0; i < 3; i++) if (hash(s, i, 3) < 0.6) {
                const ax = X + bw - 18 - i * 16;
                fr(c, ax, top - 9, 12, 9, col); fr(c, ax, top - 9, 12, 1, lite); fr(c, ax + 3, top - 7, 5, 5, lite); fr(c, ax + 4, top - 6, 3, 3, col);
              }
            });
            x += bw + 6 + Math.floor(rnd() * 30); k++;
          }
        },
      },
    ],
    overlay(c, w, h, time, camX) {
      // медленные облачные полосы у верха и мигание огней кранов
      for (let i = 0; i < 5; i++) {
        const len = 50 + i * 17;
        const x = Math.round(((i * 211 - time * (3 + i) - camX * 0.02) % (w + 200) + w + 200) % (w + 200)) - 100;
        const y = 22 + i * 15;
        c.fillStyle = i % 2 ? '#3a1a52' : '#45205c';
        c.fillRect(x, y, len, 1); c.fillRect(x + 10, y + 1, len - 22, 1);
      }
    },
  };
  // =====================================================================
  // SEWER — тоннели с арками, ржавые трубы, слизь, капли
  // =====================================================================
  function bricks(c, x, y, w, h, base, mortar, lite, bw = 8, bh = 4, seed = 1) {
    fr(c, x, y, w, h, base);
    for (let j = 0, yy = y; yy < y + h; yy += bh, j++) {
      fr(c, x, yy, w, 1, mortar);
      const off = j % 2 ? bw / 2 : 0;
      for (let xx = x - bw + off; xx < x + w; xx += bw) {
        if (xx >= x) fr(c, xx, yy, 1, bh, mortar);
        if (lite && hash(seed, Math.round(xx / bw), j) < 0.18) fr(c, Math.max(x, xx + 1), yy + 1, Math.min(bw - 2, x + w - xx - 1), 1, lite);
      }
    }
  }
  // заливка внешней (над аркой) части пролёта; дуга — полуэллипс
  function archSpan(c, x0, span, top, spring, col, mortar) {
    const rx = span / 2, ry = spring - top, cx = x0 + rx;
    for (let x = x0; x < x0 + span; x++) {
      const t = (x + 0.5 - cx) / rx;
      const y = Math.round(spring - ry * Math.sqrt(Math.max(0, 1 - t * t)));
      fr(c, x, 0, 1, y, col);
      if (mortar) for (let yy = 0; yy < y - 1; yy++) {
        const row = Math.floor(yy / 5);
        if (yy % 5 === 0 || (x + (row % 2) * 6) % 12 === 0) fr(c, x, yy, 1, 1, mortar);
      }
    }
  }
  function archRing(c, cx, spring, rx, ry, thick, col, mortar) {
    // кольцо клинчатого камня
    for (let a = 0; a <= 180; a += 1) {
      const r = (a * Math.PI) / 180;
      for (let k = 0; k < thick; k++) {
        const x = Math.round(cx + Math.cos(r) * (rx + k)), y = Math.round(spring - Math.sin(r) * (ry + k));
        fr(c, x, y, 1, 1, col);
      }
    }
    for (let a = 0; a <= 180; a += 12) {
      const r = (a * Math.PI) / 180;
      P.line(c, cx + Math.cos(r) * rx, spring - Math.sin(r) * ry, cx + Math.cos(r) * (rx + thick - 1), spring - Math.sin(r) * (ry + thick - 1), mortar);
    }
  }
  function hPipe(c, x, y, len, d, ramp, flangeStep, seed) {
    const [k, m, l, hl] = ramp;
    fr(c, x, y, len, d, m);
    fr(c, x, y + d - 2, len, 2, k);
    fr(c, x, y + 1, len, 1, l);
    fr(c, x, y, len, 1, hl);
    if (flangeStep) for (let fx = x + 6; fx < x + len - 4; fx += flangeStep) {
      fr(c, fx, y - 2, 4, d + 4, m); fr(c, fx, y - 2, 4, 1, l); fr(c, fx + 3, y - 2, 1, d + 4, k);
      fr(c, fx + 1, y - 1, 1, 1, hl);
      // ржавые потёки
      if (hash(seed, fx) < 0.5) fr(c, fx + 1, y + d + 2, 1, 2 + Math.floor(hash(seed, fx, 2) * 6), '#3a2a1e');
    }
  }
  function vPipe(c, x, y, len, d, ramp) {
    const [k, m, l, hl] = ramp;
    fr(c, x, y, d, len, m);
    fr(c, x + d - 2, y, 2, len, k);
    fr(c, x + 1, y, 1, len, l);
    fr(c, x, y, 1, len, hl);
  }
  function valve(c, cx, cy, r, col, hl) {
    for (let a = 0; a < 360; a += 6) { const t = (a * Math.PI) / 180; fr(c, Math.round(cx + Math.cos(t) * r), Math.round(cy + Math.sin(t) * r), 1, 1, col); }
    fr(c, cx - r, cy, r * 2 + 1, 1, col); fr(c, cx, cy - r, 1, r * 2 + 1, col);
    fr(c, cx - 1, cy - 1, 3, 3, col); fr(c, cx - 1, cy - r, 1, 1, hl);
  }

  T.sewer = {
    sky(c, w, h) {
      skyBands(c, w, h, [[0, '#060d0f'], [50, '#08120f'], [110, '#0b1714'], [170, '#0e1c18'], [215, '#0c1916'], [245, '#09130f']], 3);
    },
    layers: [
      { // дальний тоннель: ряд арок, в глубине — тусклый свет
        f: 0.06, w: 640, y: 0, h: 270,
        draw(c, w, h, rnd) {
          bricks(c, 0, 0, w, h, '#1a322e', '#152926', '#1e3934', 8, 4, 11);
          for (let i = 0; i < 4; i++) {
            const cx = 80 + i * 160, rx = 54, spring = 120, ry = 50;
            // проём
            P.ellipse(c, cx, spring, rx, ry, '#0b1817');
            fr(c, cx - rx, spring, rx * 2 + 1, 226 - spring, '#0b1817');
            // глубина: второе кольцо и свет
            glow(c, cx, 170, 34, '#17322b', 12, 46);
            P.ellipse(c, cx, 150, 26, 24, '#112420'); fr(c, cx - 26, 150, 53, 76, '#112420');
            glow(c, cx, 196, 14, '#2a5544', 10, 26);
            P.ellipse(c, cx, 176, 12, 12, '#1a3a30'); fr(c, cx - 12, 176, 25, 50, '#1a3a30');
            archRing(c, cx, spring, rx, ry, 5, '#28463f', '#1a332f');
            // пилястры
            fr(c, cx - rx - 6, spring, 6, 106, '#223e38'); fr(c, cx + rx + 1, spring, 6, 106, '#223e38');
            fr(c, cx - rx - 6, spring, 1, 106, '#2c4a43');
          }
          // канал
          fr(c, 0, 226, w, h - 226, '#10261f');
          for (let y = 228; y < h; y += 3) for (let x = (y * 7) % 23; x < w; x += 23 + (y % 5)) fr(c, x, y, 6 + (x % 5), 1, '#18382c');
          hazeDown(c, w, 0, 60, '#0e1c1a', 10);
        },
      },
      { // своды-рёбра и пучки труб
        f: 0.18, w: 960, y: 0, h: 270,
        draw(c, w, h, rnd) {
          const wall = '#12241f', mortar = '#0d1b18', lite = '#183029';
          // своды пролётами по 240
          for (let i = 0; i < 4; i++) {
            const x0 = i * 240;
            archSpan(c, x0, 240, 26, 92, wall, mortar);
            // столбы между пролётами
            at(w, x0, (X) => { fr(c, X - 12, 60, 24, h - 60, wall); fr(c, X - 12, 60, 2, h - 60, lite); fr(c, X + 10, 60, 2, h - 60, mortar);
              for (let y = 66; y < h; y += 8) fr(c, X - 12, y, 24, 1, mortar);
              fr(c, X - 16, 92, 32, 5, lite); fr(c, X - 16, 96, 32, 1, mortar);
            });
          }
          // кромка свода
          for (let i = 0; i < 4; i++) {
            const x0 = i * 240, rx = 120, cx = x0 + rx;
            for (let x = x0 + 12; x < x0 + 228; x++) {
              const t = (x + 0.5 - cx) / rx;
              const y = Math.round(92 - 66 * Math.sqrt(Math.max(0, 1 - t * t)));
              fr(c, x, y - 3, 1, 3, '#1d362f'); fr(c, x, y - 1, 1, 1, '#24433a');
              if (x % 9 === 0) fr(c, x, y - 4, 1, 4, mortar);
            }
          }
          const rust = ['#1a1612', '#2c241b', '#3b3023', '#4c3e2d'];
          const teal = ['#11201e', '#1b302c', '#27413b', '#33524a'];
          hPipe(c, 0, 104, w, 14, rust, 64, 3);
          hPipe(c, 0, 122, w, 8, teal, 48, 4);
          hPipe(c, 0, 166, w, 10, rust, 80, 5);
          // вертикальные отводы и вентили
          for (const vx of [70, 300, 520, 760]) {
            at(w, vx, (X) => { vPipe(c, X, 118, 50, 6, rust); fr(c, X - 2, 140, 10, 3, rust[2]); });
          }
          for (const vx of [190, 640, 880]) at(w, vx, (X) => valve(c, X, 98, 5, '#4c3e2d', '#66523a'));
          // потёки слизи с труб
          for (let i = 0; i < 40; i++) {
            const x = Math.floor(rnd() * w), len = 2 + Math.floor(rnd() * 9);
            fr(c, x, 130, 1, len, '#264d2e'); fr(c, x, 130 + len, 1, 1, '#33613a');
            if (rnd() < 0.5) { const x2 = Math.floor(rnd() * w); fr(c, x2, 176, 1, 2 + Math.floor(rnd() * 5), '#264d2e'); }
          }
        },
      },
      { // ближний план: колонны, решётки, сброс жижи, цепи
        f: 0.4, w: 960, y: 0, h: 270,
        draw(c, w, h, rnd) {
          const col = '#070f0e', lite = '#0f1d1b';
          const rustD = ['#0b0d0b', '#17150f', '#221d16', '#2e261c'];
          // потолочная балка
          fr(c, 0, 0, w, 14, col); fr(c, 0, 14, w, 1, lite);
          for (let x = 0; x < w; x += 32) { fr(c, x, 14, 6, 4, col); fr(c, x + 2, 15, 2, 2, lite); }
          for (const [x, kind] of [[40, 'pipe'], [230, 'grate'], [420, 'out'], [640, 'pipe'], [800, 'grate']]) {
            at(w, x, (X) => {
              if (kind === 'pipe') {
                vPipe(c, X, 14, h, 16, rustD); fr(c, X - 3, 80, 22, 5, rustD[2]); fr(c, X - 3, 80, 22, 1, rustD[3]);
                fr(c, X - 3, 190, 22, 5, rustD[2]);
                vPipe(c, X + 22, 14, 120, 6, rustD);
                hPipe(c, X + 22, 134, 30, 6, rustD, 0);
              } else if (kind === 'grate') {
                // решётка в стене, за ней тусклый зелёный свет
                fr(c, X, 40, 60, 70, col);
                fr(c, X + 4, 44, 52, 62, '#0e2a22');
                glow(c, X + 30, 75, 26, '#1a4434', 10, 30);
                for (let gx = X + 4; gx < X + 56; gx += 7) fr(c, gx, 44, 3, 62, col);
                fr(c, X + 4, 66, 52, 3, col); fr(c, X, 40, 60, 1, lite);
                fr(c, X - 6, 110, 72, 6, col); fr(c, X - 6, 110, 72, 1, lite);
              } else {
                // труба-коллектор со сбросом зелёной жижи
                P.ellipse(c, X + 18, 120, 18, 18, '#14130f'); P.ellipse(c, X + 18, 120, 13, 13, '#050807');
                fr(c, X, 100, 4, 40, col);
                for (let y = 134; y < h; y++) {
                  const ww = 10 + Math.min(8, Math.floor((y - 134) / 10));
                  fr(c, X + 18 - ww / 2, y, ww, 1, '#173f22');
                  if ((y + X) % 5 === 0) fr(c, X + 16 - ww / 4, y, 2, 2, '#235a2c');
                  if ((y * 3) % 7 === 0) fr(c, X + 18 + ww / 4, y, 1, 3, '#1f5028');
                }
                fr(c, X + 6, 132, 24, 3, '#235a2c');
              }
            });
          }
          // цепи
          for (const [x, len] of [[150, 90], [170, 60], [560, 110], [720, 70], [900, 96]]) {
            at(w, x, (X) => { for (let y = 14; y < 14 + len; y += 4) { fr(c, X, y, 1, 3, lite); fr(c, X - 1, y + 2, 3, 1, col); } fr(c, X - 2, 14 + len, 5, 4, lite); });
          }
          // мостки внизу
          fr(c, 0, 236, w, h - 236, col); fr(c, 0, 236, w, 1, lite);
          for (let x = 0; x < w; x += 12) fr(c, x, 226, 1, 10, col);
          fr(c, 0, 226, w, 1, col);
        },
      },
    ],
    overlay(c, w, h, time, camX) {
      // падающие капли, привязанные к ближнему слою
      for (let i = 0; i < 14; i++) {
        const wx = Math.floor(hash(i, 17) * 960);
        const sx = Math.round(((wx - camX * 0.4) % 960 + 960) % 960) - 240;
        if (sx < -2 || sx > w + 2) continue;
        const per = 1.6 + hash(i, 5) * 1.8;
        const t = ((time + hash(i, 9) * per) % per) / per;
        const y0 = 16, y1 = 228;
        if (t < 0.2) { c.fillStyle = '#3c7a5e'; c.fillRect(sx, y0, 1, 1 + Math.round(t * 10)); continue; }
        const ft = (t - 0.2) / 0.7;
        if (ft <= 1) {
          const y = Math.round(y0 + (y1 - y0) * ft * ft);
          c.fillStyle = '#4e9074'; c.fillRect(sx, y, 1, 3);
        } else {
          c.fillStyle = '#3c7a5e'; c.fillRect(sx - 2, y1 - 1, 1, 1); c.fillRect(sx + 2, y1 - 1, 1, 1); c.fillRect(sx - 1, y1 - 2, 3, 1);
        }
      }
    },
  };
  // =====================================================================
  // RUINS — джунгли: туманные горы, ступенчатая пирамида, водопады, лианы
  // =====================================================================
  function canopy(c, w, baseY, rnd, cols, rMin, rMax, step) {
    const [dark, mid, lite] = cols;
    const crowns = [];
    for (let x = 0; x < w; x += step + Math.floor(rnd() * step)) {
      const r = rMin + rnd() * (rMax - rMin);
      crowns.push([x, baseY - r * 0.6 - rnd() * r * 0.8, r]);
    }
    for (const [x, y, r] of crowns) at(w, x, (X) => P.ellipse(c, X, y, r, r * 0.8, dark));
    for (const [x, y, r] of crowns) at(w, x, (X) => P.ellipse(c, X - r * 0.12, y - r * 0.12, r * 0.82, r * 0.62, mid));
    for (const [x, y, r] of crowns) at(w, x, (X) => { P.ellipse(c, X - r * 0.35, y - r * 0.38, r * 0.42, r * 0.28, lite); });
    fr(c, 0, Math.round(baseY), w, 400, dark);
  }
  function pyramid(c, cx, base, tiers, w0, th, cols) {
    const [dark, mid, lite, moss, door] = cols;
    for (let i = 0; i < tiers; i++) {
      const ww = Math.round(w0 * (1 - i / (tiers + 1.5))), y = base - (i + 1) * th;
      fr(c, cx - ww / 2, y, ww, th, mid);
      fr(c, cx - ww / 2, y, ww, 1, lite);
      fr(c, cx + ww / 2 - Math.round(ww * 0.28), y + 1, Math.round(ww * 0.28), th - 1, dark);
      // блоки
      for (let k = 0; k < ww; k += 7) fr(c, cx - ww / 2 + k + (i % 2) * 3, y + 2, 1, th - 2, dark);
      // мох
      for (let k = 0; k < ww; k += 3) if (hash(i, k, 77) < 0.35) fr(c, cx - ww / 2 + k, y + 1, 2 + Math.floor(hash(i, k, 78) * 3), 1 + Math.floor(hash(i, k) * 3), moss);
    }
    // лестница
    const top = base - tiers * th;
    for (let y = top; y < base; y += 2) { fr(c, cx - 6, y, 13, 1, lite); fr(c, cx - 6, y + 1, 13, 1, mid); }
    fr(c, cx - 7, top, 1, base - top, dark); fr(c, cx + 7, top, 1, base - top, dark);
    // святилище
    const sw = Math.round(w0 * (1 - tiers / (tiers + 1.5))) - 6;
    fr(c, cx - sw / 2, top - 18, sw, 18, mid); fr(c, cx - sw / 2, top - 18, sw, 1, lite);
    fr(c, cx - sw / 2 - 2, top - 22, sw + 4, 4, mid); fr(c, cx - sw / 2 - 2, top - 22, sw + 4, 1, lite);
    fr(c, cx + sw / 2 - 4, top - 17, 4, 17, dark);
    fr(c, cx - 3, top - 12, 7, 12, door);
    fr(c, cx - sw / 2 + 2, top - 15, 3, 3, door); fr(c, cx + sw / 2 - 5, top - 15, 3, 3, door);
  }
  function waterfall(c, x, y0, y1, ww, cols, seed) {
    const [deep, mid, lite, foam] = cols;
    fr(c, x, y0, ww, y1 - y0, mid);
    for (let i = 0; i < ww; i++) {
      const hsh = hash(seed, i);
      if (hsh < 0.3) fr(c, x + i, y0, 1, y1 - y0, deep);
      else if (hsh > 0.75) fr(c, x + i, y0 + Math.floor(hash(seed, i, 1) * 10), 1, y1 - y0, lite);
    }
    for (let y = y0 + 4; y < y1; y += 3) {
      const o = Math.floor(hash(seed, y) * ww);
      fr(c, x + o, y, 1 + Math.floor(hash(seed, y, 2) * 2), 2, lite);
    }
    fr(c, x - 1, y0, ww + 2, 2, foam);
    fr(c, x - 2, y0 + 2, 1, 4, mid); fr(c, x + ww + 1, y0 + 2, 1, 4, mid);
    glow(c, x + ww / 2, y1, ww * 0.9 + 6, foam, 10, 7);
  }
  function vine(c, x, y0, len, col, leaf, seed) {
    let px = x;
    for (let y = y0; y < y0 + len; y++) {
      const nx = Math.round(x + Math.sin((y + seed * 13) * 0.09) * 2);
      fr(c, nx, y, 1, 1, col);
      if ((y + seed) % 7 === 0) { const s = ((y / 7) | 0) % 2 ? 1 : -3; fr(c, nx + s, y, 3, 2, leaf); fr(c, nx + (s > 0 ? s + 1 : s), y + 2, 1, 1, leaf); }
      px = nx;
    }
    fr(c, px - 1, y0 + len, 3, 3, leaf);
  }

  T.ruins = {
    sky(c, w, h) {
      skyBands(c, w, h, [[0, '#2e6886'], [32, '#387690'], [64, '#47869a'], [94, '#5a96a0'], [122, '#70a6a6'], [148, '#89b6aa'], [172, '#a3c4ac'], [196, '#bcd0ae'], [222, '#d2dcb2']], 3);
      glow(c, 360, 40, 46, '#6aa2a6', 10);
      glow(c, 360, 40, 26, '#a8d0b8', 12);
      P.circle(c, 360, 40, 11, '#f4eab8'); P.circle(c, 359, 39, 8, '#fff6d4');
      const r = P.rng(5);
      for (const [x, y, s] of [[70, 74, 1.1], [200, 58, 0.8], [440, 92, 1.3], [300, 110, 0.7], [20, 128, 0.9]]) cloud(c, x, y, s, ['#6a9ea2', '#8cb8b2', '#b2d4c4'], r);
    },
    layers: [
      { // дальние туманные горы и силуэт пирамиды
        f: 0.04, w: 960, y: 0, h: 270,
        draw(c, w, h, rnd) {
          const f1 = fbm(rnd, w, 4, 4);
          const m1 = (x) => Math.max(70, Math.min(190, -40 + f1(x) * 300));
          ridge(c, w, h, m1, '#78a6a0');
          ridge(c, w, h, (x) => m1(x) + 2 + Math.max(0, (m1(x + 5) - m1(x)) * 3), '#6a9a96');
          pyramid(c, 640, 186, 6, 120, 9, ['#62908a', '#6e9a92', '#86ae9e', '#6a988a', '#55807a']);
          const f2 = fbm(rnd, w, 5, 4);
          ridge(c, w, h, (x) => Math.max(120, -10 + f2(x) * 330), '#5e8c88');
          hazeUp(c, w, 170, 220, '#a6c6aa', 8);
          fr(c, 0, 220, w, 50, '#8db49c');
        },
      },
      { // скальные плато с водопадами, большая пирамида
        f: 0.12, w: 960, y: 0, h: 270,
        draw(c, w, h, rnd) {
          const rock = ['#3b5a54', '#4a6a62', '#5a7c70', '#6a8c7a'];
          const plateaus = [[0, 150, 84], [210, 120, 100], [700, 180, 70]];
          for (const [x, pw, top] of plateaus) at(w, x, (X) => {
            for (let i = 0; i < pw; i++) {
              const t = i / pw, edge = Math.min(i, pw - i);
              const y = top + (edge < 12 ? Math.round((12 - edge) * (12 - edge) * 0.25) : 0) + Math.round(hash(x, i >> 2) * 3);
              const shade = t > 0.72 ? rock[0] : rock[1];
              fr(c, X + i, y, 1, h - y, shade);
              if (t > 0.66 && t <= 0.72) for (let yy = y; yy < h; yy++) if (on(X + i, yy, 8)) fr(c, X + i, yy, 1, 1, rock[0]);
              // пласты
              for (let yy = y + 8 + ((i >> 4) % 3); yy < h; yy += 11) fr(c, X + i, yy, 1, 1, t > 0.72 ? '#33504b' : rock[2]);
              if (hash(x, i, 9) < 0.08) fr(c, X + i, y + 4, 1, 30 + Math.floor(hash(x, i, 10) * 60), rock[0]);
              fr(c, X + i, y, 1, 2, rock[3]);
              // мох свисает с кромки
              const m = Math.floor(hash(x, i, 11) * 7);
              fr(c, X + i, y + 2, 1, m, '#3f6a4c');
            }
          });
          // водопады с плато
          waterfall(c, 258, 104, 214, 9, ['#6f9ca0', '#86b2b2', '#a8cec8', '#c6e2d8'], 3);
          waterfall(c, 300, 106, 214, 5, ['#6f9ca0', '#86b2b2', '#a8cec8', '#c6e2d8'], 4);
          waterfall(c, 760, 74, 214, 12, ['#6f9ca0', '#86b2b2', '#a8cec8', '#c6e2d8'], 5);
          // джунгли на плато
          for (const [x, pw, top] of plateaus) at(w, x, (X) => {
            for (let i = 4; i < pw - 4; i += 8) {
              const r = 5 + hash(x, i, 3) * 6;
              P.ellipse(c, X + i, top - r * 0.3, r, r * 0.7, '#3a6448'); P.ellipse(c, X + i - 2, top - r * 0.5, r * 0.5, r * 0.35, '#4a7654');
            }
          });
          pyramid(c, 500, 214, 10, 170, 11, ['#4a6656', '#587662', '#6c8a70', '#4d7552', '#24342c']);
          hazeUp(c, w, 180, 224, '#8fb49e', 7);
          fr(c, 0, 224, w, 46, '#6e9682');
        },
      },
      { // ряд деревьев, колонны и голова-идол с лианами
        f: 0.25, w: 960, y: 0, h: 270,
        draw(c, w, h, rnd) {
          const stone = ['#24372f', '#30473b', '#3e5848'];
          // стволы
          for (let i = 0; i < 18; i++) {
            const x = Math.floor(rnd() * w), tw = 3 + Math.floor(rnd() * 4);
            at(w, x, (X) => { fr(c, X, 150, tw, 120, '#1d3326'); fr(c, X, 150, 1, 120, '#284430'); });
          }
          canopy(c, w, 196, rnd, ['#1d3a28', '#264a32', '#32603e'], 12, 24, 16);
          // руины колонн
          for (const [x, ch] of [[120, 70], [150, 46], [560, 82], [600, 34], [860, 60]]) at(w, x, (X) => {
            fr(c, X, 230 - ch, 14, ch, stone[1]); fr(c, X, 230 - ch, 2, ch, stone[2]); fr(c, X + 11, 230 - ch, 3, ch, stone[0]);
            fr(c, X - 3, 230 - ch, 20, 5, stone[1]); fr(c, X - 3, 230 - ch, 20, 1, stone[2]);
            for (let y = 230 - ch + 12; y < 230; y += 12) fr(c, X, y, 14, 1, stone[0]);
            // золотая вставка-глиф
            fr(c, X + 5, 230 - ch + 8, 4, 3, '#8a7a3a'); fr(c, X + 6, 230 - ch + 9, 2, 1, '#6a5c2c');
            vine(c, X + 4, 230 - ch, 20 + (x % 17), '#2c5636', '#3a6c40', x);
          });
          // каменная голова-идол
          at(w, 340, (X) => {
            const y = 168;
            fr(c, X, y, 44, 54, stone[1]); fr(c, X, y, 44, 2, stone[2]); fr(c, X + 32, y + 2, 12, 52, stone[0]);
            fr(c, X - 4, y + 6, 4, 18, stone[0]); fr(c, X + 44, y + 6, 4, 18, stone[0]);
            fr(c, X + 6, y + 12, 10, 4, stone[0]); fr(c, X + 26, y + 12, 10, 4, stone[0]);
            fr(c, X + 19, y + 4, 6, 5, '#2a2c1c'); fr(c, X + 21, y + 5, 2, 2, '#6a8a3a'); // третий глаз
            fr(c, X + 18, y + 18, 8, 12, stone[2]); fr(c, X + 24, y + 18, 2, 12, stone[0]);
            fr(c, X + 10, y + 36, 24, 4, stone[0]); fr(c, X + 12, y + 37, 20, 2, '#1a2620');
            for (let k = 0; k < 6; k++) vine(c, X + 3 + k * 7, y, 10 + (k * 13) % 22, '#2c5636', '#3a6c40', k + 5);
          });
          fr(c, 0, 230, w, 40, '#16281e');
        },
      },
      { // передний план: свисающие лианы и листва
        f: 0.5, w: 960, y: 0, h: 270,
        draw(c, w, h, rnd) {
          const col = '#0c1c13', lite = '#14301e';
          // кромка листвы сверху
          for (let x = 0; x < w; x += 6) {
            const d = 6 + Math.round(hash(x, 4) * 10 + Math.sin((x / w) * TAU * 6) * 6);
            fr(c, x, 0, 6, d, col);
          }
          for (let i = 0; i < 26; i++) {
            const x = Math.floor(rnd() * w), r = 6 + rnd() * 10;
            at(w, x, (X) => { P.ellipse(c, X, 8 + rnd() * 6, r, r * 0.6, col); });
          }
          for (let i = 0; i < 22; i++) {
            const x = Math.floor(rnd() * w), len = 30 + Math.floor(rnd() * 110), sd = i * 3;
            at(w, x, (X) => vine(c, X, 8, len, lite, col, sd));
          }
          // папоротники внизу
          for (let x = 0; x < w; x += 40 + Math.floor(rnd() * 30)) {
            const hh = 14 + Math.floor(rnd() * 16);
            at(w, x, (X) => {
              for (let k = -3; k <= 3; k++) P.line(c, X, 252, X + k * 6, 252 - hh + Math.abs(k) * 3, col);
              P.ellipse(c, X, 256, 18, 8, col);
            });
          }
          fr(c, 0, 254, w, 16, col);
        },
      },
    ],
    overlay(c, w, h, time, camX) {
      // пыльца и светлячки
      for (let i = 0; i < 26; i++) {
        const sp = 4 + hash(i, 2) * 8;
        const x = Math.round((((hash(i, 1) * 600 - camX * 0.3 + Math.sin(time * 0.7 + i) * 8 + time * sp) % 600) + 600) % 600) - 60;
        const y = Math.round(60 + hash(i, 3) * 160 + Math.sin(time * 1.3 + i * 2) * 6);
        const blink = Math.sin(time * 2 + i * 1.7) > 0.2;
        c.fillStyle = blink ? '#e6f0a0' : '#9cb87a';
        c.fillRect(x, y, 1, 1);
      }
    },
  };
  // =====================================================================
  // CAVE — кристальные пещеры: сталактиты, светящиеся друзы, глубина
  // =====================================================================
  // профиль из «шипов»: y = base ± max(spike), с периодическим расстоянием
  function spikeProfile(w, spikes, base, dir, noise) {
    return (x) => {
      let m = 0;
      for (const [sx, sw, len] of spikes) {
        let dx = x - sx; dx = ((dx % w) + w * 1.5) % w - w / 2;
        const t = Math.abs(dx) / sw;
        if (t < 1) m = Math.max(m, len * Math.pow(1 - t, 1.4));
      }
      const n = noise ? noise(x) : 0;
      return base + dir * (m + n);
    };
  }
  // заливка свисающего/растущего силуэта с объёмом: освещённые левые грани, кромка, трещины
  function rockFill(c, w, h, f, dir, col, rim, rimCol, tex) {
    for (let x = 0; x < w; x++) {
      const y = Math.round(f(x));
      const y0 = dir > 0 ? 0 : y, y1 = dir > 0 ? y : h;
      if (y1 <= y0) continue;
      fr(c, x, y0, 1, y1 - y0, col);
      if (tex) {
        const sl = f(x + 2) - f(x - 2);
        const lit = dir > 0 ? sl > 1.2 : sl < -1.2;
        const dark = dir > 0 ? sl < -1.2 : sl > 1.2;
        const band = 14;
        for (let k = 0; k < band; k++) {
          const yy = dir > 0 ? y - 1 - k : y + k;
          if (yy < y0 || yy >= y1) break;
          if (lit) { if (on(x, yy, 12 - k)) fr(c, x, yy, 1, 1, tex.lit); }
          else if (!dark && on(x, yy, 6 - k)) fr(c, x, yy, 1, 1, tex.mid);
        }
        if (dark) for (let k = 0; k < 4; k++) { const yy = dir > 0 ? y - 1 - k : y + k; if (yy >= y0 && yy < y1 && on(x, yy, 6)) fr(c, x, yy, 1, 1, tex.dark || col); }
        // слоистость породы
        for (let yy = y0 + ((x >> 3) % 4); yy < y1; yy += 9) if (hash(x >> 2, yy, 3) < 0.35) fr(c, x, yy, 1, 1, tex.mid);
      }
      if (rim) fr(c, x, dir > 0 ? y - rim : y, 1, rim, rimCol);
    }
  }
  function hangFill(c, w, f, col, rim, rimCol, tex) { rockFill(c, w, 0, f, 1, col, rim, rimCol, tex); }
  function floorFill(c, w, h, f, col, rim, rimCol, tex) { rockFill(c, w, h, f, -1, col, rim, rimCol, tex); }
  function crystal(c, x, base, hgt, wd, lean, cols) {
    const [dark, mid, lite, white] = cols;
    const tipX = x + lean, tipY = base - hgt, sh = Math.max(2, Math.round(wd * 0.9));
    P.poly(c, [[x - wd, base], [x + wd + 1, base], [tipX + wd + 1, tipY + sh], [tipX + 1, tipY], [tipX - wd, tipY + sh]], mid);
    P.poly(c, [[x - wd, base], [x, base], [tipX, tipY + sh], [tipX + 1, tipY], [tipX - wd, tipY + sh]], lite);
    P.poly(c, [[x + Math.ceil(wd * 0.5), base], [x + wd + 1, base], [tipX + wd + 1, tipY + sh], [tipX + Math.ceil(wd * 0.5), tipY + sh]], dark);
    P.line(c, tipX - wd + 1, tipY + sh, tipX, tipY + 1, white);
    fr(c, tipX, tipY, 1, 1, white);
  }
  function druse(c, x, base, s, cols, glowCol, seed) {
    if (glowCol) { glow(c, x, base - 8 * s, 34 * s, glowCol, 8, 24 * s); glow(c, x, base - 6 * s, 16 * s, cols[0], 6, 11 * s); }
    const n = 3 + Math.floor(hash(seed, 1) * 3);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1) - 0.5;
      const hh = Math.round((10 + hash(seed, i, 2) * 16) * s * (1 - Math.abs(t) * 0.9));
      crystal(c, Math.round(x + t * 18 * s), base, hh, Math.max(1, Math.round(2.4 * s)), Math.round(t * 10 * s), cols);
    }
    fr(c, x - 12 * s, base, 24 * s, 2, cols[0]);
  }
  const CY = ['#1a4e5e', '#2a8090', '#4cc0c4', '#c8fff4'];
  const PK = ['#4e1e58', '#8a3a86', '#c060b0', '#ffd0f0'];

  T.cave = {
    sky(c, w, h) {
      skyBands(c, w, h, [[0, '#07040e'], [40, '#0b0716'], [86, '#110a20'], [130, '#160d2a'], [176, '#140c26'], [220, '#100a1f']], 3);
      glow(c, 240, 150, 150, '#1a1130', 10, 70);
    },
    layers: [
      { // дальний зал: колонны-сталагнаты и мерцающие точки
        f: 0.05, w: 640, y: 0, h: 270,
        draw(c, w, h, rnd) {
          const col = '#1d1436', rim = '#291d48';
          const sp = [], fl = [];
          for (let i = 0; i < 16; i++) sp.push([rnd() * w, 8 + rnd() * 16, 14 + rnd() * 50]);
          for (let i = 0; i < 14; i++) fl.push([rnd() * w, 8 + rnd() * 18, 10 + rnd() * 40]);
          const n1 = fbm(rnd, w, 6, 3), n2 = fbm(rnd, w, 6, 3);
          hangFill(c, w, spikeProfile(w, sp, 26, 1, (x) => n1(x) * 16), col, 1, rim, { mid: '#211840', lit: '#2a1f4c' });
          floorFill(c, w, h, spikeProfile(w, fl, 214, -1, (x) => n2(x) * 18), col, 1, rim, { mid: '#211840', lit: '#2a1f4c' });
          // колонны
          for (const x of [90, 330, 520]) at(w, x, (X) => {
            for (let y = 20; y < 230; y++) {
              const t = Math.abs(y - 125) / 105;
              const hw = Math.round(4 + t * t * 14);
              fr(c, X - hw, y, hw * 2 + 1, 1, col);
              fr(c, X - hw, y, 1, 1, rim);
            }
          });
          // дальние огоньки кристаллов
          for (let i = 0; i < 22; i++) {
            const x = Math.floor(rnd() * w), y = 40 + Math.floor(rnd() * 170), cc = rnd() < 0.5 ? '#2c5a6a' : '#5a2f62';
            at(w, x, (X) => { fr(c, X - 1, y, 3, 1, cc); fr(c, X, y - 1, 1, 3, cc); fr(c, X, y, 1, 1, cc === '#2c5a6a' ? '#5aa0a8' : '#a060a0'); });
          }
          // гигантские дальние кристаллы-ориентиры
          for (const [x, base, sc, pk] of [[210, 214, 2.6, false], [450, 206, 2.0, true]]) {
            at(w, x, (X) => druse(c, X, base, sc, pk ? ['#2e1a44', '#4a2a62', '#644080', '#a07ac0'] : ['#1a2a48', '#25425e', '#346078', '#7ab0c0'], pk ? '#22163c' : '#18203c', x));
          }
          hazeUp(c, w, 190, 240, '#181030', 8);
        },
      },
      { // средний план: скалы с подсветкой и друзы
        f: 0.15, w: 960, y: 0, h: 270,
        draw(c, w, h, rnd) {
          const col = '#120b22', rim = '#33245a';
          const sp = [], fl = [];
          for (let i = 0; i < 20; i++) sp.push([rnd() * w, 6 + rnd() * 14, 16 + rnd() * 60]);
          for (let i = 0; i < 9; i++) fl.push([rnd() * w, 20 + rnd() * 40, 20 + rnd() * 60]);
          const n1 = fbm(rnd, w, 8, 3), n2 = fbm(rnd, w, 8, 3);
          hangFill(c, w, spikeProfile(w, sp, 12, 1, (x) => n1(x) * 14), col, 2, rim, { mid: '#1a1130', lit: '#261a44', dark: '#0c0718' });
          const ff = spikeProfile(w, fl, 226, -1, (x) => n2(x) * 20);
          floorFill(c, w, h, ff, col, 1, rim, { mid: '#1a1130', lit: '#261a44', dark: '#0c0718' });
          // друзы на полу и на уступах
          for (let i = 0; i < 9; i++) {
            const x = Math.floor((i + rnd() * 0.6) * (w / 9)), pk = i % 3 === 1;
            const base = Math.round(ff(x)) + 2, sd = i;
            const cols = pk ? ['#3a1a46', '#663070', '#8e4a90', '#d8a0d0'] : ['#163a48', '#225e6a', '#3a8a90', '#a8e0d8'];
            at(w, x, (X) => druse(c, X, base, 0.8 + hash(sd, 4) * 0.5, cols, pk ? '#2a1642' : '#122a3e', sd));
          }
          // кристаллы, растущие с потолка
          for (let i = 0; i < 5; i++) {
            const x = Math.floor(rnd() * w), sd = 40 + i, y = 24 + Math.floor(rnd() * 10);
            at(w, x, (X) => {
              for (let k = 0; k < 3; k++) {
                const xx = X + (k - 1) * 6, hh = 8 + Math.floor(hash(sd, k) * 10);
                P.poly(c, [[xx - 2, y - 4], [xx + 3, y - 4], [xx + 1, y + hh]], '#225e6a');
                P.poly(c, [[xx - 2, y - 4], [xx, y - 4], [xx + 1, y + hh]], '#3a8a90');
              }
            });
          }
        },
      },
      { // ближние сталактиты и яркие друзы
        f: 0.32, w: 960, y: 0, h: 270,
        draw(c, w, h, rnd) {
          const col = '#06030c', rim = '#181030';
          const sp = [];
          for (let i = 0; i < 11; i++) sp.push([rnd() * w, 12 + rnd() * 22, 30 + rnd() * 100]);
          const n1 = fbm(rnd, w, 6, 3);
          const fc = spikeProfile(w, sp, 4, 1, (x) => n1(x) * 10);
          hangFill(c, w, fc, col, 2, '#1e1438', { mid: '#0e0819', lit: '#160e28' });
          // капли на кончиках
          for (const [sx, , len] of sp) at(w, sx, (X) => fr(c, X, Math.round(4 + len + n1(sx) * 10), 1, 2, '#3a6e80'));
          const fl = [];
          for (let i = 0; i < 8; i++) fl.push([rnd() * w, 26 + rnd() * 46, 16 + rnd() * 56]);
          const n2 = fbm(rnd, w, 6, 3);
          const ff = spikeProfile(w, fl, 248, -1, (x) => n2(x) * 10);
          floorFill(c, w, h, ff, col, 2, '#1e1438', { mid: '#0e0819', lit: '#160e28' });
          for (let i = 0; i < 6; i++) {
            const x = Math.floor((i + 0.3 + rnd() * 0.4) * (w / 6)), pk = i % 2 === 0, base = Math.round(ff(x)) + 3, sd = 80 + i;
            at(w, x, (X) => druse(c, X, base, 1.3 + hash(sd, 1) * 0.6, pk ? ['#3a1440', '#6e2a74', '#a04a98', '#f0b0e0'] : ['#123444', '#1e5e6c', '#36949a', '#b0f0e4'], pk ? '#24102e' : '#0e2232', sd));
          }
        },
      },
    ],
    overlay(c, w, h, time, camX) {
      // светящиеся частицы, медленно всплывающие
      for (let i = 0; i < 24; i++) {
        const per = 10 + hash(i, 1) * 8;
        const t = ((time + hash(i, 2) * per) % per) / per;
        const x = Math.round((((hash(i, 3) * 560 - camX * 0.2 + Math.sin(time * 0.8 + i) * 6) % 560) + 560) % 560) - 40;
        const y = Math.round(240 - t * 200);
        const pk = i % 3 === 0;
        const tw = Math.sin(time * 3 + i) > 0;
        c.fillStyle = pk ? (tw ? '#e090d0' : '#8a4a86') : (tw ? '#90f0e0' : '#3a8a90');
        c.fillRect(x, y, 1, 1);
        if (tw && i % 4 === 1) { c.fillRect(x - 1, y, 3, 1); c.fillRect(x, y - 1, 1, 3); }
      }
    },
  };
  // =====================================================================
  // ICE — заснеженные хребты, сосновые леса, снегопад
  // =====================================================================
  // гора с освещённым левым склоном, снеговой линией и промоинами
  function snowRange(c, w, h, f, snowY, pal, seed) {
    const { snowL, snowD, rockL, rockD, crest } = pal;
    for (let x = 0; x < w; x++) {
      const y = Math.round(f(x));
      if (y >= h) continue;
      const sl = f(x + 1) - f(x - 1);
      const lit = sl <= 0; // склон, поднимающийся вправо — к свету слева
      const sLine = Math.round(snowY(x));
      const gp = (x % 24) / 24, gid = Math.floor(x / 24) % Math.floor(w / 24);
      const gully = hash(seed, gid) < 0.5 ? Math.round((1 - Math.abs(gp - 0.5) * 2) * (8 + hash(seed, gid, 2) * 26)) : 0;
      // снег
      const s1 = Math.max(y, Math.min(h, sLine + gully));
      fr(c, x, y, 1, s1 - y, lit ? snowL : snowD);
      // кулуары: диагональные полосы теней/света на склонах
      const P20 = Math.floor(w / 20);
      for (let yy = y + 5; yy < s1; yy++) {
        const u = lit ? x + Math.floor(yy * 0.8) : x - Math.floor(yy * 0.8) + 4000;
        const id = ((Math.floor(u / 20) % P20) + P20) % P20;
        if (u % 20 < 2 + (hash(seed, id, 5) < 0.4 ? 1 : 0) && hash(seed, id, 3) < 0.55) fr(c, x, yy, 1, 1, lit ? snowD : snowL);
      }
      // скала
      if (s1 < h) fr(c, x, s1, 1, h - s1, lit ? rockL : rockD);
      // переходная дизеринговая кромка снега
      for (let k = 0; k < 3; k++) if (on(x, s1 + k, 8 - k * 3)) fr(c, x, s1 + k, 1, 1, lit ? snowD : rockL);
      if (Math.abs(sl) < 0.6 || hash(seed, x, 7) < 0.1) fr(c, x, y, 1, 1, crest);
      else if (lit) fr(c, x, y, 1, 1, crest);
    }
  }
  function pine(c, x, base, hh, cols) {
    const [dark, mid, snow] = cols;
    const trunk = Math.max(2, Math.round(hh * 0.12)), len = hh - trunk;
    const maxW = Math.max(3, hh * 0.24), tierH = Math.max(4, Math.round(hh / 5));
    fr(c, x, base - trunk, 1, trunk, dark);
    for (let r = 0; r < len; r++) {
      const t = r / len, ph = (r % tierH) / tierH;
      const hw = Math.round(maxW * (0.15 + 0.85 * t) * (0.4 + 0.6 * ph));
      const y = base - hh + r;
      fr(c, x - hw, y, hw * 2 + 1, 1, dark);
      fr(c, x - hw, y, hw, 1, mid);
      if (ph < 0.2 || r === 0) fr(c, x - hw, y, Math.max(1, hw), 1, snow);
      else if (ph > 0.85) { fr(c, x - hw, y, 1, 1, snow); }
    }
  }
  function forest(c, w, base, n, hMin, hMax, cols, rnd) {
    const trees = [];
    for (let i = 0; i < n; i++) trees.push([Math.floor(rnd() * w), hMin + rnd() * (hMax - hMin), rnd() * 6]);
    trees.sort((a, b) => a[1] - b[1]);
    for (const [x, hh, dy] of trees) at(w, x, (X) => pine(c, X, base(x) + Math.round(dy), Math.round(hh), cols));
  }

  T.ice = {
    sky(c, w, h) {
      skyBands(c, w, h, [[0, '#26345a'], [30, '#2e3e66'], [60, '#384a72'], [90, '#44587e'], [118, '#536888'], [144, '#657a96'], [168, '#7a8ca4'], [192, '#909eb2'], [216, '#a4aebe']], 3);
      stars(c, w, 60, P.rng(9), 30, ['#4a5a84', '#6a7aa0']);
      // бледная луна
      glow(c, 110, 50, 30, '#4e6088', 8);
      P.circle(c, 110, 50, 9, '#c8d0e0'); P.circle(c, 113, 48, 7, '#dfe4ee'); fr(c, 106, 52, 2, 2, '#b0bad0');
    },
    layers: [
      { // дальний хребет
        f: 0.04, w: 960, y: 0, h: 270,
        draw(c, w, h, rnd) {
          const pk = [];
          for (let i = 0; i < 9; i++) pk.push([((i + 0.2 + rnd() * 0.6) * w) / 9, 50 + rnd() * 50, 50 + rnd() * 70]);
          for (let i = 0; i < 14; i++) pk.push([rnd() * w, 12 + rnd() * 20, 20 + rnd() * 40]);
          const n = fbm(rnd, w, 32, 3, 0.6), sn = fbm(rnd, w, 24, 2);
          const f = spikeProfile(w, pk, 206, -1, (x) => n(x) * 22);
          snowRange(c, w, h, f, (x) => 128 + sn(x) * 44, { snowL: '#b4bccc', snowD: '#939eb6', rockL: '#7a86a0', rockD: '#6a7592', crest: '#c6ccd8' }, 1);
          hazeUp(c, w, 170, 215, '#a0aabc', 8);
          fr(c, 0, 215, w, h - 215, '#9aa4b8');
        },
      },
      { // средний хребет
        f: 0.1, w: 960, y: 0, h: 270,
        draw(c, w, h, rnd) {
          const pk = [];
          for (let i = 0; i < 6; i++) pk.push([((i + rnd() * 0.8) * w) / 6, 40 + rnd() * 50, 40 + rnd() * 60]);
          for (let i = 0; i < 10; i++) pk.push([rnd() * w, 10 + rnd() * 16, 14 + rnd() * 30]);
          const n = fbm(rnd, w, 40, 3, 0.6), sn = fbm(rnd, w, 30, 2);
          const f = spikeProfile(w, pk, 230, -1, (x) => n(x) * 24);
          snowRange(c, w, h, f, (x) => 160 + sn(x) * 40, { snowL: '#98a4bc', snowD: '#76839e', rockL: '#5a6684', rockD: '#4c5674', crest: '#aab4c8' }, 2);
          hazeUp(c, w, 196, 232, '#7e8aa4', 6);
        },
      },
      { // холмы с хвойным лесом
        f: 0.22, w: 960, y: 0, h: 270,
        draw(c, w, h, rnd) {
          const n = fbm(rnd, w, 5, 3);
          const base = (x) => Math.round(206 + n(x) * 26);
          forest(c, w, base, 120, 12, 30, ['#2c3c54', '#3a4c66', '#7c8aa4'], rnd);
          for (let x = 0; x < w; x++) { const y = base(x); fr(c, x, y, 1, h - y, '#6e7c98'); fr(c, x, y, 1, 1, '#8894ac'); }
          hazeUp(c, w, 226, 250, '#64728e', 6);
        },
      },
      { // ближние сосны
        f: 0.42, w: 960, y: 0, h: 270,
        draw(c, w, h, rnd) {
          const n = fbm(rnd, w, 4, 3);
          const base = (x) => Math.round(238 + n(x) * 16);
          forest(c, w, base, 34, 40, 86, ['#141e2c', '#1c2a3a', '#4a5a72'], rnd);
          for (let x = 0; x < w; x++) { const y = base(x); fr(c, x, y, 1, h - y, '#3c4a62'); fr(c, x, y, 1, 1, '#56647c'); }
        },
      },
    ],
    overlay(c, w, h, time, camX) {
      // снегопад в двух планах с ветром
      for (let i = 0; i < 90; i++) {
        const near = i % 3 === 0;
        const sp = near ? 34 + hash(i, 1) * 16 : 16 + hash(i, 1) * 10;
        const par = near ? 0.7 : 0.35;
        const x0 = hash(i, 2) * (w + 40) - camX * par - time * (near ? 14 : 8) + Math.sin(time * 1.2 + i) * 4;
        const x = Math.round(((x0 % (w + 40)) + w + 40) % (w + 40)) - 20;
        const y = Math.round((((hash(i, 3) * (h + 20) + time * sp) % (h + 20)) + h + 20) % (h + 20)) - 10;
        c.fillStyle = near ? '#e8eef6' : '#aab6c8';
        if (near) c.fillRect(x, y, 2, 2); else c.fillRect(x, y, 1, 1);
      }
    },
  };
  // =====================================================================
  // VOLCANO — дымящийся вулкан, лавовые реки, базальтовые столбы, пепел
  // =====================================================================
  function lavaStream(c, x, y, len, drift, seed, cols, wd = 2) {
    const [crust, hot, core] = cols;
    for (let i = 0; i < len; i++) {
      const xx = Math.round(x + drift * i + Math.sin(i * 0.12 + seed) * 3);
      const ww = wd + Math.floor(i / 40);
      fr(c, xx - ww - 1, y + i, ww * 2 + 3, 1, crust);
      fr(c, xx - ww, y + i, ww * 2 + 1, 1, hot);
      if (hash(seed, i >> 2) < 0.7) fr(c, xx - (ww >> 1), y + i, Math.max(1, ww), 1, core);
    }
  }
  function smoke(c, x, y, s, n, drift, cols, rnd) {
    const [dark, mid, under] = cols;
    const puffs = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const spread = 6 + t * 40 * s;
      for (let k = 0; k < 3; k++) puffs.push([x + drift * t * t * 150 * s + (rnd() - 0.5) * spread * 2, y - t * 120 * s - rnd() * 8, (7 + t * 20) * s * (0.7 + rnd() * 0.5)]);
    }
    for (const [px, py, r] of puffs) P.ellipse(c, px, py + 2, r, r * 0.8, under);
    for (const [px, py, r] of puffs) P.ellipse(c, px + 1, py - 1, r * 0.98, r * 0.76, dark);
    for (const [px, py, r] of puffs) P.ellipse(c, px - r * 0.3, py - r * 0.35, r * 0.45, r * 0.3, mid);
  }

  T.volcano = {
    sky(c, w, h) {
      skyBands(c, w, h, [[0, '#100506'], [28, '#170708'], [56, '#20090a'], [86, '#2c0c0c'], [114, '#3c100e'], [140, '#521610'], [164, '#6c1e12'], [186, '#8a2a14'], [206, '#a63a18'], [226, '#be4c1c']], 3);
      // полосы пепельных туч
      for (const [x, y, len] of [[30, 40, 160], [260, 60, 200], [100, 86, 120], [380, 30, 90], [0, 112, 90], [300, 104, 150]]) {
        fr(c, x, y, len, 3, '#2a0e0e'); fr(c, x + 8, y + 3, len - 20, 1, '#3a1410'); fr(c, x + 14, y - 1, len - 40, 1, '#1c0808');
      }
    },
    layers: [
      { // огромный дымящийся вулкан
        f: 0.03, w: 960, y: 0, h: 270,
        draw(c, w, h, rnd) {
          const body = '#3a1612', lit = '#4a1c14', shade = '#2c100e';
          const cones = [[300, 86, 250, 1.0], [780, 140, 150, 0.6]];
          for (const [cx, top, half, sc] of cones) at(w, cx, (X) => {
            glow(c, X, top - 6, 70 * sc, '#5a1c10', 8, 40 * sc);
            const n = fbm(P.rng(cx), 960, 32, 2);
            const cr = 20 * sc;
            for (let x = -half; x <= half; x++) {
              const ax = Math.abs(x);
              let y;
              if (ax < cr) y = top + 4 * sc - Math.round((ax / cr) * 4 * sc) + (ax < cr * 0.6 ? 3 : 0);
              else { const t = (ax - cr) / (half - cr); y = Math.round(top + Math.pow(t, 0.62) * (226 - top) + n(x + cx) * 5 * t); }
              fr(c, X + x, y, 1, h - y, x < -cr * 0.4 ? lit : x > cr * 1.6 ? shade : body);
              if (ax >= cr && ax < cr + 2) fr(c, X + x, y, 1, 1, '#7a2a14');
              if (x < 0 && ax > cr && hash(cx, x) < 0.08) fr(c, X + x, y + 2, 1, 14 + hash(cx, x, 2) * 60, shade);
              if (x > cr && hash(cx, x, 4) < 0.07) fr(c, X + x, y + 2, 1, 10 + hash(cx, x, 5) * 40, '#240c0a');
            }
            // свечение кратера
            glow(c, X, top + 2, 30 * sc, '#b8441a', 12, 8 * sc);
            fr(c, X - cr * 0.6, top + 4 * sc + 2, cr * 1.2, 2, '#ff9a3a');
            fr(c, X - cr * 0.4, top + 4 * sc + 1, cr * 0.8, 1, '#ffd070');
            // лавовые потоки
            lavaStream(c, X - 6 * sc, top + 4, Math.round(120 * sc), -0.35, cx + 1, ['#461610', '#9a3616', '#e4742a'], 1);
            lavaStream(c, X + 8 * sc, top + 4, Math.round(90 * sc), 0.42, cx + 2, ['#461610', '#8e3214', '#d8682a'], 1);
            if (sc > 0.8) lavaStream(c, X - 1, top + 6, 70, 0.06, cx + 3, ['#461610', '#8e3214', '#d8682a'], 1);
            smoke(c, X, top - 4, sc, 8, 1, ['#2a0f0f', '#381614', '#5e2014'], P.rng(cx + 5));
          });
          hazeUp(c, w, 190, 226, '#6a2012', 7);
          fr(c, 0, 226, w, h - 226, '#5a1c12');
        },
      },
      { // зубчатые хребты и лавовая река
        f: 0.12, w: 960, y: 0, h: 270,
        draw(c, w, h, rnd) {
          const pk = [];
          for (let i = 0; i < 16; i++) pk.push([rnd() * w, 20 + rnd() * 40, 16 + rnd() * 50]);
          const n = fbm(rnd, w, 24, 3, 0.6);
          const f = spikeProfile(w, pk, 214, -1, (x) => n(x) * 14);
          for (let x = 0; x < w; x++) {
            const y = Math.round(f(x)), sl = f(x + 1) - f(x - 1);
            fr(c, x, y, 1, h - y, sl > 0 ? '#1e0c0c' : '#2a100e');
            fr(c, x, y, 1, 1, sl > 0 ? '#3a140e' : '#6a2612');
            if (sl <= 0) fr(c, x, y + 1, 1, 1, '#4a1a10');
          }
          // лавопады с уступов
          for (let i = 0; i < 4; i++) {
            const x = Math.floor((i + 0.5) * (w / 4) + (rnd() - 0.5) * 60), y0 = Math.round(f(x)) + 4;
            at(w, x, (X) => { glow(c, X, 220, 16, '#6a2210', 8, 14); lavaStream(c, X, y0, 222 - y0, 0, x, ['#3a120c', '#a83a18', '#ffa040'], 1); });
          }
          // река лавы
          fr(c, 0, 222, w, h - 222, '#8a2a12');
          for (let y = 222; y < h; y++) for (let x = 0; x < w; x += 2) {
            const v = Math.sin((x / w) * TAU * 8 + y * 0.6) + Math.sin((x / w) * TAU * 3 - y * 0.3);
            if (v > 1.1) fr(c, x, y, 2, 1, '#e06a20'); else if (v > 0.5) fr(c, x, y, 2, 1, '#b8461a'); else if (v < -1.2) fr(c, x, y, 2, 1, '#5a1a0e');
          }
          fr(c, 0, 222, w, 1, '#ff9a40');
          hazeDown(c, w, 210, 222, '#7a2812', 6);
        },
      },
      { // базальтовые столбы с раскалёнными трещинами
        f: 0.28, w: 960, y: 0, h: 270,
        draw(c, w, h, rnd) {
          const groups = [];
          for (let x = 0; x < w; x += 110 + Math.floor(rnd() * 90)) groups.push(x);
          for (const gx of groups) {
            const n = 3 + Math.floor(rnd() * 5), base = 186 + Math.floor(rnd() * 26);
            const cols = [];
            for (let i = 0; i < n; i++) cols.push([gx + i * 9, base - Math.floor(Math.sin((i / (n - 1)) * Math.PI) * 26 + rnd() * 14)]);
            for (const [x, top] of cols) at(w, x, (X) => {
              fr(c, X, top, 9, h - top, '#160909'); fr(c, X, top, 1, h - top, '#2a100c'); fr(c, X + 8, top, 1, h - top, '#0c0505');
              for (let k = 0; k < 9; k++) { const d = Math.round(k * (hash(x, 9) - 0.5) * 0.8); fr(c, X + k, top + d - 1, 1, 2, '#3a160e'); fr(c, X + k, top + d + 1, 1, 1, '#160909'); } fr(c, X + 1, top - 1, 3, 1, '#5a2010');
              for (let y = top + 10; y < h; y += 14 + ((x + y) % 9)) fr(c, X + 1, y, 7, 1, '#0c0505');
              if (hash(x, top) < 0.4) { const cy = top + 20 + Math.floor(hash(x, 2) * 40); P.line(c, X + 3, cy, X + 5, cy + 8, '#a83a14'); P.line(c, X + 5, cy + 8, X + 4, cy + 14, '#7a2810'); fr(c, X + 3, cy, 1, 1, '#ff8a30'); }
            });
          }
          fr(c, 0, 238, w, h - 238, '#120707');
        },
      },
      { // ближние чёрные скалы с трещинами
        f: 0.45, w: 960, y: 0, h: 270,
        draw(c, w, h, rnd) {
          const pk = [];
          for (let i = 0; i < 9; i++) pk.push([rnd() * w, 40 + rnd() * 40, 16 + rnd() * 34]);
          const n = fbm(rnd, w, 24, 3, 0.6);
          const f = spikeProfile(w, pk, 256, -1, (x) => n(x) * 12);
          for (let x = 0; x < w; x++) { const y = Math.round(f(x)); fr(c, x, y, 1, h - y, '#080303'); fr(c, x, y, 1, 1, '#2a0e0a'); }
          for (const [sx, , len] of pk) at(w, sx, (X) => { const y = Math.round(f(sx)) + 6; P.line(c, X, y, X - 3, y + 10, '#6a200c'); P.line(c, X - 3, y + 10, X + 1, y + 20, '#4a160a'); });
        },
      },
    ],
    overlay(c, w, h, time, camX) {
      // восходящие искры и падающий пепел
      for (let i = 0; i < 40; i++) {
        const per = 4 + hash(i, 1) * 5;
        const t = ((time + hash(i, 2) * per) % per) / per;
        const x = Math.round((((hash(i, 3) * 520 - camX * 0.35 + Math.sin(time * 2 + i) * 5 + t * 30) % 520) + 520) % 520) - 20;
        const y = Math.round(260 - t * 230);
        const hot = t < 0.5;
        c.fillStyle = Math.sin(time * 9 + i) > 0 ? (hot ? '#ffd060' : '#ff8030') : (hot ? '#ff9a3a' : '#a83a18');
        c.fillRect(x, y, 1, 1);
        if (hot && i % 5 === 0) c.fillRect(x, y + 1, 1, 1);
      }
      for (let i = 0; i < 46; i++) {
        const sp = 10 + hash(i, 5) * 10;
        const x = Math.round((((hash(i, 6) * 500 - camX * 0.25 - time * 6 + Math.sin(time + i) * 3) % 500) + 500) % 500) - 10;
        const y = Math.round(((hash(i, 7) * 280 + time * sp) % 280)) - 5;
        c.fillStyle = i % 2 ? '#5a4844' : '#3e302e';
        c.fillRect(x, y, 1, 1);
      }
    },
  };
  // =====================================================================
  // SKY — небесный храм: кучевые гряды, парящие мраморные острова, море облаков
  // =====================================================================
  function cloudBank(c, w, base, rnd, cols, rMin, rMax, step) {
    const [shadow, mid, lite, top] = cols;
    const puffs = [];
    for (let x = 0; x < w; x += step + Math.floor(rnd() * step)) {
      const r = rMin + rnd() * (rMax - rMin);
      puffs.push([x, base - r * (0.3 + rnd() * 0.6), r]);
    }
    for (const [x, y, r] of puffs) at(w, x, (X) => P.ellipse(c, X, y, r, r * 0.8, shadow));
    for (const [x, y, r] of puffs) at(w, x, (X) => P.ellipse(c, X - r * 0.04, y - r * 0.08, r * 0.96, r * 0.72, mid));
    for (const [x, y, r] of puffs) at(w, x, (X) => P.ellipse(c, X - r * 0.1, y - r * 0.26, r * 0.84, r * 0.52, lite));
    for (const [x, y, r] of puffs) at(w, x, (X) => { // светлая кромка сверху
      const ry = r * 0.8;
      for (let dx = -Math.round(r * 0.7); dx <= Math.round(r * 0.3); dx++) {
        const k = 1 - (dx * dx) / (r * r);
        if (k > 0) fr(c, X + dx, Math.round(y - ry * Math.sqrt(k)) + 1, 1, 2, top);
      }
    });
    // лёгкая тень между клубами внизу
    for (let x = 0; x < w; x++) if (on(x, Math.round(base) - 1, 8)) fr(c, x, Math.round(base) - 1, 1, 1, mid);
    fr(c, 0, Math.round(base), w, 400, shadow);
  }
  function island(c, cx, top, hw, depth, pal, seed) {
    const { grass, grassD, rockL, rock, rockD, vine } = pal;
    for (let x = -hw; x <= hw; x++) {
      const t = Math.abs(x) / hw;
      const edge = t > 0.85 ? Math.round((t - 0.85) * 20) : 0;
      const by = Math.round(top + depth * Math.pow(1 - t, 1.2) * (0.75 + hash(seed, (x + 999) >> 2) * 0.35)) + 3;
      const y0 = top + edge;
      if (by <= y0) continue;
      const col = x < -hw * 0.3 ? rockL : x > hw * 0.35 ? rockD : rock;
      fr(c, cx + x, y0, 1, by - y0, col);
      for (let yy = y0 + 6 + ((x >> 3) & 3); yy < by; yy += 7) fr(c, cx + x, yy, 1, 1, rockD);
      fr(c, cx + x, y0, 1, 3, grass); fr(c, cx + x, y0 + 3, 1, 1, grassD);
      if (hash(seed, x, 3) < 0.12) fr(c, cx + x, y0 + 3, 1, 3 + Math.floor(hash(seed, x, 4) * 8), vine);
    }
  }
  function temple(c, cx, base, tw, cols, pal, dome) {
    const { marbleL, marble, marbleD, gold, goldD, dark } = pal;
    // ступени
    fr(c, cx - tw / 2 - 4, base - 3, tw + 8, 3, marbleD); fr(c, cx - tw / 2 - 4, base - 3, tw + 8, 1, marbleL);
    fr(c, cx - tw / 2 - 2, base - 6, tw + 4, 3, marble); fr(c, cx - tw / 2 - 2, base - 6, tw + 4, 1, marbleL);
    const ch = Math.round(tw * 0.55), ct = base - 6 - ch;
    fr(c, cx - tw / 2 + 2, ct, tw - 4, ch, dark);
    for (let i = 0; i < cols; i++) {
      const x = Math.round(cx - tw / 2 + 1 + (i * (tw - 5)) / (cols - 1));
      fr(c, x, ct, 3, ch, marble); fr(c, x, ct, 1, ch, marbleL); fr(c, x + 2, ct, 1, ch, marbleD);
      fr(c, x - 1, ct, 5, 1, marbleL); fr(c, x - 1, base - 7, 5, 1, marbleD);
    }
    fr(c, cx - tw / 2 - 1, ct - 4, tw + 2, 4, marble); fr(c, cx - tw / 2 - 1, ct - 4, tw + 2, 1, marbleL);
    fr(c, cx - tw / 2 - 1, ct - 2, tw + 2, 1, gold);
    if (dome) {
      const r = Math.round(tw * 0.32);
      fr(c, cx - r - 1, ct - 7, r * 2 + 3, 3, marble);
      for (let y = 0; y <= r; y++) {
        const hw = Math.round(Math.sqrt(r * r - y * y));
        fr(c, cx - hw, ct - 7 - y, hw * 2 + 1, 1, goldD);
        fr(c, cx - hw, ct - 7 - y, Math.max(1, Math.round(hw * 0.9)), 1, gold);
      }
      fr(c, cx - Math.round(r * 0.5), ct - 7 - Math.round(r * 0.7), 2, 2, '#f0e0a0');
      fr(c, cx, ct - 9 - r - 4, 1, 4, goldD);
    } else {
      P.poly(c, [[cx - tw / 2 - 2, ct - 4], [cx + tw / 2 + 2, ct - 4], [cx, ct - 4 - Math.round(tw * 0.22)]], marble);
      P.poly(c, [[cx - tw / 2 + 3, ct - 5], [cx + tw / 2 - 3, ct - 5], [cx, ct - 3 - Math.round(tw * 0.18)]], marbleD);
      P.line(c, cx - tw / 2 - 2, ct - 4, cx, ct - 4 - Math.round(tw * 0.22), marbleL);
      fr(c, cx - 1, ct - 9, 3, 3, gold);
    }
  }
  function fallStream(c, x, y0, y1, ww, cols, seed) {
    const [d, m, l] = cols;
    for (let y = y0; y < y1; y++) {
      const t = (y - y0) / (y1 - y0);
      const lv = Math.round(16 * (1 - t * t));
      drow(c, x, x + ww - 1, y, m, lv);
      if (hash(seed, y >> 1) < 0.5) drow(c, x + Math.floor(hash(seed, y) * ww), x + Math.floor(hash(seed, y) * ww), y, l, lv);
      if (t < 0.6) { drow(c, x - 1, x - 1, y, d, lv); }
    }
  }

  T.sky = {
    sky(c, w, h) {
      skyBands(c, w, h, [[0, '#3664a8'], [30, '#3e6eb0'], [60, '#4a7cb8'], [90, '#5a8ac0'], [118, '#6c9ac8'], [144, '#80aad0'], [168, '#94b8d6'], [192, '#a8c4dc'], [214, '#bad0e2']], 3);
      glow(c, 90, 44, 70, '#5f8fc4', 8);
      glow(c, 90, 44, 40, '#88b0d8', 10);
      P.circle(c, 90, 44, 14, '#f4f0d8'); P.circle(c, 89, 43, 11, '#fffbea');
      // перистые полосы
      for (const [x, y, len] of [[200, 36, 120], [330, 52, 100], [150, 70, 80], [400, 90, 70]]) {
        fr(c, x, y, len, 1, '#8ab0d6'); fr(c, x + 10, y + 1, len - 26, 1, '#7aa2cc'); fr(c, x + 20, y - 1, len - 50, 1, '#a2c2de');
      }
    },
    layers: [
      { // гряда дальних кучевых облаков
        f: 0.03, w: 960, y: 0, h: 270,
        draw(c, w, h, rnd) {
          cloudBank(c, w, 190, rnd, ['#9ab6d6', '#acc6e0', '#c0d4e8', '#d2e0ee'], 16, 38, 22);
          // башни облаков
          for (const x of [140, 520, 800]) at(w, x, (X) => {
            const pf = [];
            for (let k = 0; k < 7; k++) { const r = 30 - k * 3 + hash(x, k) * 8; pf.push([X + (hash(x, k, 1) - 0.5) * 30, 176 - k * 14 - hash(x, k, 2) * 6, r]); }
            for (const [px, py, r] of pf) P.ellipse(c, px, py, r, r * 0.66, '#a2bcdc');
            for (const [px, py, r] of pf) P.ellipse(c, px - r * 0.12, py - r * 0.2, r * 0.82, r * 0.46, '#b6cce4');
            for (const [px, py, r] of pf) P.ellipse(c, px - r * 0.3, py - r * 0.36, r * 0.42, r * 0.2, '#c8daea');
          });
          hazeUp(c, w, 196, 226, '#bcd0e4', 8);
        },
      },
      { // дальние маленькие острова
        f: 0.08, w: 960, y: 0, h: 270,
        draw(c, w, h, rnd) {
          const pal = { grass: '#9ab8b4', grassD: '#86a4a8', rockL: '#9aaac4', rock: '#8a9ab8', rockD: '#7a8aaa', vine: '#86a4a8' };
          const tp = { marbleL: '#d4dcea', marble: '#bcc8dc', marbleD: '#a2b0c8', gold: '#c4b48a', goldD: '#a89a78', dark: '#8090ac' };
          for (const [x, y, hw, d, t] of [[80, 120, 26, 34, 1], [330, 92, 34, 46, 2], [610, 132, 22, 28, 0], [820, 104, 30, 40, 1]]) {
            at(w, x, (X) => {
              if (t === 2) fallStream(c, X + 20, y + 3, y + 90, 3, ['#9ab0c8', '#c0d2e4', '#e0eaf4'], x);
              island(c, X, y, hw, d, pal, x);
              if (t) temple(c, X - 4, y, 22, 4, tp, t === 2);
            });
          }
        },
      },
      { // средние острова с храмами и водопадами
        f: 0.18, w: 960, y: 0, h: 270,
        draw(c, w, h, rnd) {
          const pal = { grass: '#6a9e7e', grassD: '#4f7e68', rockL: '#7a7e9c', rock: '#686c8c', rockD: '#555878', vine: '#4f7e68' };
          const tp = { marbleL: '#e0e4ee', marble: '#c4cad8', marbleD: '#9ca2b8', gold: '#c8a858', goldD: '#9a7e44', dark: '#5a5e7a' };
          for (const [x, y, hw, d, cols, dome] of [[180, 108, 56, 74, 6, true], [560, 140, 44, 56, 4, false], [800, 80, 38, 50, 0, false]]) {
            at(w, x, (X) => {
              fallStream(c, X + hw - 14, y + 3, y + 130, 5, ['#8aa4c4', '#b6cce2', '#e2ecf6'], x);
              island(c, X, y, hw, d, pal, x + 1);
              if (cols) temple(c, X - 6, y, cols * 7, cols, tp, dome);
              else { // обломки колонн
                for (let k = 0; k < 3; k++) { const ch = 8 + k * 5; fr(c, X - 16 + k * 12, y - ch, 4, ch, tp.marble); fr(c, X - 16 + k * 12, y - ch, 1, ch, tp.marbleL); fr(c, X - 17 + k * 12, y - ch, 6, 1, tp.marbleL); }
              }
            });
          }
          // золотые парящие обломки
          for (let i = 0; i < 8; i++) {
            const x = Math.floor(rnd() * w), y = 60 + Math.floor(rnd() * 120), sz = 2 + Math.floor(rnd() * 3);
            at(w, x, (X) => { fr(c, X, y, sz + 2, sz, '#8a8eaa'); fr(c, X, y, sz + 2, 1, '#c4cad8'); });
          }
        },
      },
      { // море облаков у ног
        f: 0.4, w: 960, y: 0, h: 270,
        draw(c, w, h, rnd) {
          cloudBank(c, w, 246, rnd, ['#7e9cc4', '#98b4d6', '#b2c8e2', '#c8d8ea'], 18, 34, 20);
        },
      },
    ],
    overlay(c, w, h, time, camX) {
      // дрейфующие облачные пряди
      for (let i = 0; i < 5; i++) {
        const len = 24 + Math.floor(hash(i, 1) * 40), sp = 4 + hash(i, 2) * 6;
        const x = Math.round((((hash(i, 3) * (w + 160) - time * sp - camX * 0.6) % (w + 160)) + w + 160) % (w + 160)) - 80;
        const y = 176 + Math.floor(hash(i, 4) * 60);
        c.fillStyle = '#b4cae2'; c.fillRect(x, y, len, 1); c.fillRect(x + 8, y + 1, len - 12, 1);
        c.fillStyle = '#cadaec'; c.fillRect(x + 10, y - 1, Math.round(len * 0.45), 1);
      }
    },
  };
  // =====================================================================
  // TEMPLE — храм Заркуна: космос в стрельчатых окнах, знамёна с тремя глазами, жаровни
  // =====================================================================
  function eye(c, cx, cy, rw, rh, lid, iris, pupil, hl) {
    for (let y = -rh; y <= rh; y++) {
      const hw = Math.round(rw * (1 - Math.abs(y) / (rh + 0.5)));
      fr(c, cx - hw, cy + y, hw * 2 + 1, 1, lid);
    }
    for (let y = -rh + 1; y <= rh - 1; y++) {
      const hw = Math.round((rw - 1.5) * (1 - Math.abs(y) / rh));
      if (hw > 0) fr(c, cx - hw, cy + y, hw * 2 + 1, 1, iris);
    }
    fr(c, cx, cy - Math.max(0, rh - 2), 1, Math.max(1, rh * 2 - 3), pupil);
    if (hl) fr(c, cx - 1, cy - 1, 1, 1, hl);
  }
  // символ трёх глаз: кольцо + треугольник глаз
  function sigil(c, cx, cy, r, cols) {
    const [ring, lid, iris, pupil] = cols;
    for (let a = 0; a < 360; a += 1) {
      const t = (a * Math.PI) / 180;
      fr(c, Math.round(cx + Math.cos(t) * r), Math.round(cy + Math.sin(t) * r), 1, 1, ring);
      if (a % 30 === 0) fr(c, Math.round(cx + Math.cos(t) * (r + 3)), Math.round(cy + Math.sin(t) * (r + 3)), 1, 1, ring);
    }
    const k = r * 0.5;
    P.line(c, cx, cy - k * 1.1, cx - k, cy + k * 0.6, ring); P.line(c, cx, cy - k * 1.1, cx + k, cy + k * 0.6, ring); P.line(c, cx - k, cy + k * 0.6, cx + k, cy + k * 0.6, ring);
    const ew = Math.max(3, Math.round(r * 0.2)), eh = Math.max(1, Math.round(r * 0.09));
    eye(c, cx, Math.round(cy - k * 1.1), ew, eh, lid, iris, pupil);
    eye(c, Math.round(cx - k), Math.round(cy + k * 0.6), ew, eh, lid, iris, pupil);
    eye(c, Math.round(cx + k), Math.round(cy + k * 0.6), ew, eh, lid, iris, pupil);
  }
  function banner(c, x, y, bw, bh, cols) {
    const [cloth, clothD, gold, goldD, iris] = cols;
    fr(c, x - 2, y - 2, bw + 4, 2, goldD); fr(c, x - 3, y - 2, 1, 1, gold); fr(c, x + bw + 2, y - 2, 1, 1, gold);
    fr(c, x, y, bw, bh, cloth);
    fr(c, x + bw - 3, y, 3, bh, clothD);
    fr(c, x + 1, y, 1, bh, gold); fr(c, x + bw - 2, y, 1, bh, goldD);
    // зубчатый низ
    for (let i = 0; i < bw; i++) { const d = Math.abs(((i + 2) % 6) - 3); fr(c, x + i, y + bh, 1, 3 - d, i > bw - 4 ? clothD : cloth); }
    const cx = x + Math.floor(bw / 2), cy = y + Math.round(bh * 0.4);
    eye(c, cx, cy - 6, 4, 2, gold, iris, '#140818');
    eye(c, cx - 5, cy + 3, 4, 2, gold, iris, '#140818');
    eye(c, cx + 5, cy + 3, 4, 2, gold, iris, '#140818');
    fr(c, x + 3, y + bh - 8, bw - 6, 1, goldD);
  }
  const TEMPLE_BRAZIERS = [120, 360, 600, 840];

  T.temple = {
    sky(c, w, h) {
      skyBands(c, w, h, [[0, '#06030c'], [40, '#0a0516'], [80, '#10081f'], [120, '#170b2a'], [160, '#1e0e34'], [200, '#26113c'], [236, '#2e1444']], 3);
      // туманность: дизеринг по синусоидальному полю
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const v = Math.sin(x * 0.021 + y * 0.013) + Math.sin(x * 0.007 - y * 0.03 + 1.7) + Math.sin((x + y) * 0.043) * 0.4 - (Math.abs(y - 110) / 90);
        if (v > 0.9) { if (on(x, y, Math.min(16, Math.round((v - 0.9) * 14)))) fr(c, x, y, 1, 1, v > 1.5 ? '#4a1f62' : '#33164c'); }
      }
      stars(c, w, h, P.rng(77), 110, ['#3a2a5a', '#5a4a80', '#8a7ab0', '#c0b0e0']);
      // знак Заркуна в небе
      glow(c, 240, 86, 60, '#251040', 8);
      sigil(c, 240, 86, 34, ['#4a2a70', '#6a3a8a', '#8a3070', '#1a0a26']);
    },
    layers: [
      { // далёкие парящие руины-обелиски
        f: 0.04, w: 960, y: 0, h: 270,
        draw(c, w, h, rnd) {
          for (let i = 0; i < 9; i++) {
            const x = Math.floor(rnd() * w), y = 110 + Math.floor(rnd() * 70), ow = 6 + Math.floor(rnd() * 8), oh = 20 + Math.floor(rnd() * 40);
            at(w, x, (X) => {
              P.poly(c, [[X - ow * 1.6, y + oh], [X + ow * 1.6, y + oh], [X, y + oh + ow * 2]], '#1c1032');
              fr(c, X - ow, y + oh - 3, ow * 2, 3, '#24143e');
              P.poly(c, [[X - ow / 2, y + oh - 3], [X + ow / 2, y + oh - 3], [X + ow / 3, y + 4], [X, y], [X - ow / 3, y + 4]], '#22143c');
              fr(c, X - Math.round(ow / 3), y + 4, 1, oh - 7, '#34205a');
              fr(c, X, y + Math.round(oh * 0.4), 1, 1, '#a04a9a');
            });
          }
          // дальний зиккурат с горящим глазом
          at(w, 700, (X) => {
            for (let i = 0; i < 6; i++) { const ww = 140 - i * 22; fr(c, X - ww / 2, 220 - (i + 1) * 12, ww, 12, '#1e1236'); fr(c, X - ww / 2, 220 - (i + 1) * 12, ww, 1, '#2e1c4e'); }
            glow(c, X, 140, 14, '#4a1a5a', 10);
            eye(c, X, 140, 7, 3, '#7a4a3a', '#b03a8a', '#1a0a20', '#ffc0f0');
          });
          hazeUp(c, w, 200, 236, '#24123a', 8);
          fr(c, 0, 236, w, h - 236, '#1e0f32');
        },
      },
      { // стена храма со стрельчатыми окнами и знамёнами
        f: 0.14, w: 960, y: 0, h: 270,
        draw(c, w, h, rnd) {
          const wall = '#160d24', mortar = '#110a1d', hl = '#1d1230';
          const span = 240, hw = 46, wTop = 28, ah = 62, wBot = 212;
          for (let x = 0; x < w; x++) {
            const lx = (x % span) - span / 2;
            const ax = Math.abs(lx + 0.5);
            for (let y = 0; y < h; y++) {
              let inWin = false;
              if (ax < hw && y < wBot) {
                if (y >= wTop + ah) inWin = true;
                else if (y >= wTop) { const t = (y - wTop) / ah; inWin = ax < hw * Math.pow(t, 0.55); }
              }
              if (inWin) continue;
              // кладка
              const row = Math.floor(y / 8), bx = (x + (row % 2) * 10) % 20;
              fr(c, x, y, 1, 1, y % 8 === 0 || bx === 0 ? mortar : (y % 8 === 1 && hash(x >> 2, row) < 0.4 ? hl : wall));
            }
          }
          hazeDown(c, w, 14, 60, '#0c0614', 8);
          for (let i = 0; i < w / span; i++) {
            const cx = i * span + span / 2;
            // золотая рама окна
            for (let y = wTop - 3; y < wBot; y++) {
              let ww;
              if (y >= wTop + ah) ww = hw; else { const t = Math.max(0, (y - wTop) / ah); ww = Math.round(hw * Math.pow(t, 0.55)); }
              if (y < wTop) ww = 0;
              fr(c, cx - ww - 3, y, 3, 1, '#2a1a40'); fr(c, cx + ww, y, 3, 1, '#1e1232');
              fr(c, cx - ww - 1, y, 1, 1, '#7a6030'); fr(c, cx + ww, y, 1, 1, '#5a4424');
            }
            fr(c, cx - 1, wTop - 6, 3, 4, '#7a6030');
            // подоконник
            fr(c, cx - hw - 6, wBot, hw * 2 + 12, 5, '#24163a'); fr(c, cx - hw - 6, wBot, hw * 2 + 12, 1, '#3a2858'); fr(c, cx - hw - 6, wBot + 2, hw * 2 + 12, 1, '#6a5028');
            // переплёт окна
            fr(c, cx, wTop + 8, 1, wBot - wTop - 8, '#1a0f2a'); fr(c, cx - hw, wTop + ah + 30, hw * 2, 1, '#1a0f2a'); fr(c, cx - hw, wTop + ah + 80, hw * 2, 1, '#1a0f2a');
            // знамя между окнами
            at(w, i * span - 13, (X) => banner(c, X, 30, 26, 92, ['#3a1450', '#2a0e3c', '#a08440', '#6a5428', '#c04a9a']));
          }
          // фиолетовый отсвет из окон на подоконниках и стене
          for (let i = 0; i < w / span; i++) {
            const cx = i * span + span / 2;
            for (let y = wBot + 5; y < 226; y++) drow(c, cx - hw - 4, cx + hw + 4, y, '#22123a', Math.round(10 - (y - wBot - 5)));
          }
          // карниз сверху и пол
          fr(c, 0, 0, w, 12, '#100818'); fr(c, 0, 12, w, 2, '#5a4424'); fr(c, 0, 14, w, 1, '#2a1a40');
          fr(c, 0, 226, w, h - 226, '#120a1e'); fr(c, 0, 226, w, 1, '#3a2858');
        },
      },
      { // ближние обсидиановые колонны и жаровни
        f: 0.3, w: 960, y: 0, h: 270,
        draw(c, w, h, rnd) {
          const ob = '#0a0612', obL = '#1c1230', obM = '#120c20';
          for (let i = 0; i < 4; i++) {
            const x = i * 240 + 20;
            at(w, x, (X) => {
              fr(c, X, 0, 30, h, ob);
              fr(c, X + 3, 0, 2, h, obL); fr(c, X + 8, 0, 1, h, obM); fr(c, X + 16, 0, 1, h, obM); fr(c, X + 24, 0, 1, h, '#06030a');
              // капитель и база с золотом
              fr(c, X - 6, 30, 42, 8, ob); fr(c, X - 6, 30, 42, 1, '#6a5028'); fr(c, X - 6, 37, 42, 1, '#3a2c18');
              fr(c, X - 3, 38, 36, 4, obM);
              fr(c, X - 6, 222, 42, 10, ob); fr(c, X - 6, 222, 42, 1, '#6a5028');
              // вставка-глаз на колонне
              eye(c, X + 15, 70, 6, 3, '#6a5028', '#7a2a6a', '#0a0410');
            });
          }
          for (const x of TEMPLE_BRAZIERS) at(w, x, (X) => {
            // жаровня на треноге
            fr(c, X - 1, 200, 3, 34, '#140c20'); P.line(c, X, 222, X - 7, 234, '#140c20'); P.line(c, X, 222, X + 7, 234, '#140c20');
            fr(c, X - 9, 194, 19, 4, '#5a4424'); fr(c, X - 7, 198, 15, 3, '#3a2c18'); fr(c, X - 9, 194, 19, 1, '#8a6c34');
            glow(c, X, 184, 22, '#2a1040', 8);
          });
          fr(c, 0, 234, w, h - 234, '#08050e'); fr(c, 0, 234, w, 1, '#2a1a40');
          for (let x = 0; x < w; x += 48) fr(c, x, 235, 1, h - 235, '#140c20');
        },
      },
    ],
    overlay(c, w, h, time, camX) {
      // пламя жаровен (привязано к ближнему слою)
      for (const bx of TEMPLE_BRAZIERS) {
        const sx = Math.round(((bx - camX * 0.3) % 960 + 960) % 960);
        for (const X of [sx, sx - 960]) {
          if (X < -20 || X > w + 20) continue;
          for (let k = 0; k < 5; k++) {
            const fh = 6 + Math.round((Math.sin(time * 9 + k * 1.7 + bx) + 1) * 3) + (k === 2 ? 5 : 0);
            const fx = X - 4 + k * 2;
            c.fillStyle = '#6a2a9a'; c.fillRect(fx, 194 - fh, 2, fh);
            c.fillStyle = '#b060e0'; c.fillRect(fx, 194 - Math.round(fh * 0.6), 2, Math.round(fh * 0.6));
          }
          c.fillStyle = '#f0c0ff'; c.fillRect(X - 1, 190, 3, 3);
        }
      }
      // магические частицы
      for (let i = 0; i < 30; i++) {
        const per = 7 + hash(i, 1) * 6;
        const t = ((time + hash(i, 2) * per) % per) / per;
        const x = Math.round((((hash(i, 3) * 520 - camX * 0.25 + Math.sin(time * 1.5 + i) * 7) % 520) + 520) % 520) - 20;
        const y = Math.round(250 - t * 230);
        const tw = Math.sin(time * 4 + i * 2.3) > 0;
        c.fillStyle = i % 3 === 0 ? (tw ? '#ffb0f0' : '#a04a9a') : (tw ? '#c090ff' : '#6a3aa0');
        c.fillRect(x, y, 1, 1);
        if (tw && i % 6 === 0) { c.fillRect(x - 1, y, 3, 1); c.fillRect(x, y - 1, 1, 3); }
      }
    },
  };
})();
