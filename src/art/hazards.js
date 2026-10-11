'use strict';
// Ловушки и опасности (h_), секретный медальон (i_glyph), сюжетные портреты (por_).
// Спрайты сгенерированы кодом (только G.Art). Свет сверху-слева, контур 1 px тёмный.
(function () {
  const A = G.Art;
  const P = 'hazards';
  A.pal(P, {
    k: '#1c1426', '0': '#0a0612', w: '#ffffff',
    // сталь
    U: '#2a3444', W: '#4c5c70', X: '#7c90a6', Y: '#b8cad8',
    // огонь
    E: '#6a1410', F: '#c8381a', H: '#f8801c', I: '#ffcc3a', J: '#fff6c8',
    // камень
    f: '#2c2a3a', g: '#484656', h: '#6c6878', i: '#9894a6', j: '#cdc8d4',
    // мох
    l: '#1e4a2a', m: '#3a7a34', n: '#78b040', '&': '#b8dc6a',
    // золото
    o: '#3b1d16', '1': '#6e3418', '2': '#a85a1c', '3': '#dc9426', '4': '#f8cc48', '5': '#fff4b8',
    // вода / лёд
    A: '#1e3a6a', B: '#3a74b4', C: '#74b8ec', D: '#c8ecff',
    // красный
    Z: '#6a1020', z: '#9a1a34', r: '#dc3448', R: '#ff6a6a',
    // кожа
    s: '#f6cfa4', S: '#d8956e', t: '#9a5a4a', '^': '#ffe8c8', '+': '#ff9aa8',
    // тёмные волосы
    a: '#12122a', b: '#262444', c: '#3e3a66', '%': '#6e68a0',
    // тёмно-синий (матроска, кимоно)
    '<': '#141e44', '>': '#24387a', '=': '#3e5ca8', '@': '#6a8ad0',
    // белая ткань / борода / седина
    M: '#8a84a0', N: '#a29cac', O: '#cfcad6', '8': '#ece6f2',
    // пурпур (плащ принца)
    p: '#24123a', q: '#44206a', u: '#6a3a9a', v: '#9460c8', x: '#c49aee',
    // бледная кожа принца
    P: '#eee6f8', Q: '#c8b8e0', T: '#8c78ac',
    // солома
    K: '#6c3e22', y: '#a0662e', L: '#d29a52', '7': '#f0c884',
    // предупреждающий жёлтый
    '6': '#f0c020',
    // изумруд
    d: '#3aff8a', e: '#b4ffd2', V: '#127a4c',
    // карие глаза
    '(': '#3a1c18', ')': '#7a3c24', ']': '#c47a3c',
  });

  // ---------------------------------------------------------------- утилиты
  const mk = (w, h) => { const g = []; for (let y = 0; y < h; y++) g.push(new Array(w).fill('.')); return g; };
  const inb = (g, x, y) => x >= 0 && y >= 0 && y < g.length && x < g[0].length;
  const at = (g, x, y) => (inb(g, x, y) ? g[y][x] : '.');
  const put = (g, x, y, ch) => { x = Math.floor(x); y = Math.floor(y); if (ch && inb(g, x, y)) g[y][x] = ch; };
  const rows = (g) => g.map((r) => r.join(''));
  const clone = (g) => g.map((r) => r.slice());
  const each = (g, fn) => { for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++) { const ch = fn(x, y, g[y][x]); if (ch) g[y][x] = ch; } };
  const hash = (x, y, s) => { let n = (x * 374761393 + y * 668265263 + s * 982451653) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const dith = (x, y, t) => t * 16 > BAYER[(y & 3) * 4 + (x & 3)] + 0.5;
  const LX = -0.5, LY = -0.62, LZ = 0.6;
  const lit = (nx, ny, nz) => (nx * LX + ny * LY + nz * LZ) / 0.9506;
  function outline(g, k, diag) {
    const add = [];
    each(g, (x, y, ch) => {
      if (ch !== '.') return;
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      if (diag) nb.push([1, 1], [-1, 1], [1, -1], [-1, -1]);
      for (const [dx, dy] of nb) { const c2 = at(g, x + dx, y + dy); if (c2 !== '.' && c2 !== k) { add.push([x, y]); break; } }
    });
    for (const [x, y] of add) g[y][x] = k;
    return g;
  }
  function rim(g, k, skip) {
    const add = [];
    each(g, (x, y, ch) => {
      if (ch === '.' || (skip && skip.includes(ch))) return;
      if (at(g, x + 1, y) === '.' || at(g, x - 1, y) === '.' || at(g, x, y + 1) === '.' || at(g, x, y - 1) === '.') add.push([x, y]);
    });
    for (const [x, y] of add) g[y][x] = k;
    return g;
  }
  function ball(g, cx, cy, r, fn) {
    each(g, (x, y) => {
      const nx = (x + 0.5 - cx) / r, ny = (y + 0.5 - cy) / r, d2 = nx * nx + ny * ny;
      if (d2 <= 1) return fn(nx, ny, Math.sqrt(1 - d2), x, y);
    });
  }
  function rect(g, x, y, w, h, ch) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) put(g, xx, yy, ch); }
  function line(g, x0, y0, x1, y1, ch) {
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      put(g, x0, y0, typeof ch === 'function' ? ch(x0, y0) : ch);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  // штамп из строк: '.' пропускается
  function stamp(g, x0, y0, rs) { rs.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] !== '.') put(g, x0 + x, y0 + y, r[x]); }); }
  const S = (name, g, opts) => A.sprite(name, P, Array.isArray(g[0]) ? rows(g) : g, opts || {});
  const C = (w, h) => ({ ox: Math.floor(w / 2), oy: Math.floor(h / 2) });

  // ================================================================= ОГНЕННЫЙ ШЕСТ
  function hub() {
    const g = mk(12, 12);
    ball(g, 6, 6, 5.6, (nx, ny, nz) => { const l = lit(nx, ny, nz); return l > 0.75 ? 'Y' : l > 0.3 ? 'X' : l > -0.2 ? 'W' : 'U'; });
    // кольцевая фаска
    each(g, (x, y, ch) => { const d = Math.hypot(x + 0.5 - 6, y + 0.5 - 6); if (ch !== '.' && d > 3.1 && d < 3.9) return y + x < 11 ? 'U' : 'W'; });
    // заклёпки
    for (const [x, y] of [[2, 5], [9, 5], [5, 2], [5, 9]]) { put(g, x, y, '5'); put(g, x + 1, y, x === 9 ? '3' : '4'); put(g, x, y + 1, '3'); put(g, x + 1, y + 1, '2'); }
    // ось
    put(g, 5, 5, 'Y'); put(g, 6, 5, 'X'); put(g, 5, 6, 'X'); put(g, 6, 6, 'U');
    outline(g, 'k');
    return g;
  }
  S('h_firebar_hub', hub(), C(12, 12));

  function fireball(f) {
    const g = mk(10, 10);
    each(g, (x, y) => {
      const px = x + 0.5 - 5, py = y + 0.5 - 5;
      const ang = Math.atan2(py, px);
      const R = 3.9 + 0.55 * Math.sin(ang * 5 + f * 2.2) + (py < 0 ? 0.3 : 0);
      const d = Math.hypot(px + 0.4, py + 0.6);
      if (Math.hypot(px, py) > R) return;
      const t = d / R;
      return t < 0.32 ? 'J' : t < 0.6 ? 'I' : t < 0.85 ? 'H' : 'F';
    });
    outline(g, 'E');
    if (f === 1) { put(g, 1, 1, 'I'); put(g, 8, 0, 'H'); } else { put(g, 0, 2, 'H'); put(g, 9, 1, 'I'); }
    return g;
  }
  S('h_firebar_ball0', fireball(0), C(10, 10));
  S('h_firebar_ball1', fireball(1), C(10, 10));
  A.anim('h_firebar_ball', ['h_firebar_ball0', 'h_firebar_ball1'], 12);

  // ================================================================= КАМЕННЫЙ ДАВИЛЬЩИК
  function crusher(slam) {
    const g = mk(32, 32);
    // тело блока
    each(g, (x, y) => {
      if (y > 25) return;
      const t = (x * 0.8 + y) / 50;
      let ch = t < 0.22 ? 'i' : t < 0.62 ? 'h' : 'g';
      if (x === 1 || y === 1) ch = 'j';
      if (x === 30 || y === 24) ch = 'g';
      return ch;
    });
    // сколы / фактура камня
    for (const [x, y, ch] of [[6, 6, 'g'], [7, 6, 'i'], [24, 15, 'g'], [25, 15, 'i'], [3, 18, 'g'], [27, 9, 'g'], [14, 21, 'g'], [15, 21, 'i']]) put(g, x, y, ch);
    // железные пояса
    const band = (y0) => {
      for (let x = 0; x < 32; x++) { put(g, x, y0, 'Y'); put(g, x, y0 + 1, 'X'); put(g, x, y0 + 2, 'W'); put(g, x, y0 + 3, 'U'); }
      for (let x = 3; x < 32; x += 6) { put(g, x, y0 + 1, 'w'); put(g, x + 1, y0 + 1, 'Y'); put(g, x, y0 + 2, 'X'); put(g, x + 1, y0 + 2, 'U'); }
    };
    band(1); band(21);
    // брови (выпуклые, сведены — злость)
    for (let i = 0; i < 9; i++) {
      const yl = 6 + Math.floor(i * 0.45) + (slam ? 0 : 0);
      for (const [x, s] of [[3 + i, 1], [28 - i, -1]]) {
        put(g, x, yl, 'j'); put(g, x, yl + 1, 'i'); put(g, x, yl + 2, s > 0 ? 'f' : 'f');
      }
    }
    // глазницы
    const eye = (cx) => {
      each(g, (x, y) => {
        const dx = x + 0.5 - cx, dy = y + 0.5 - 12.6;
        const by = 6 + Math.floor((cx < 16 ? x - 3 : 28 - x) * 0.45) + 3;
        if (y < by) return;
        if (slam) {
          const d = Math.hypot(dx / 3.4, dy / 2.4);
          if (d > 1) return;
          return d < 0.35 ? 'J' : d < 0.6 ? 'I' : d < 0.85 ? 'H' : 'F';
        }
        const d = Math.hypot(dx / 3.2, dy / 1.5);
        if (d > 1) return;
        return d < 0.4 ? 'r' : d < 0.7 ? 'z' : '0';
      });
    };
    eye(9.5); eye(22.5);
    if (slam) { put(g, 8, 11, 'w'); put(g, 21, 11, 'w'); }
    // нос
    put(g, 15, 12, 'i'); put(g, 16, 12, 'h'); put(g, 15, 13, 'i'); put(g, 16, 13, 'g'); put(g, 14, 14, 'g'); put(g, 15, 14, 'f'); put(g, 16, 14, 'f'); put(g, 17, 14, 'g');
    // рот
    if (!slam) {
      rect(g, 8, 16, 16, 4, 'f');
      for (let x = 9; x < 23; x++) { put(g, x, 17, (x - 9) % 3 === 2 ? 'g' : 'j'); put(g, x, 18, (x - 9) % 3 === 2 ? 'g' : 'i'); }
      put(g, 7, 19, 'f'); put(g, 24, 19, 'f'); put(g, 7, 20, 'f'); put(g, 24, 20, 'f');
    } else {
      rect(g, 7, 15, 18, 6, '0');
      for (let x = 8; x < 24; x++) { put(g, x, 18, 'E'); put(g, x, 19, x > 11 && x < 20 ? 'F' : 'E'); }
      for (let x = 8; x < 24; x += 3) { put(g, x, 15, 'j'); put(g, x + 1, 15, 'i'); put(g, x, 16, 'i'); put(g, x + 1, 20, 'i'); put(g, x + 2, 20, 'h'); put(g, x + 1, 19, 'h'); }
      put(g, 6, 15, 'f'); put(g, 25, 15, 'f');
    }
    // шипы снизу
    for (let y = 25; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        const ci = Math.floor(x / 8) * 8 + 4;
        const hw = 4 - (y - 25) * 0.62;
        const dx = x + 0.5 - ci;
        if (Math.abs(dx) >= hw) { if (y > 25) continue; }
        if (y === 25) { put(g, x, y, 'U'); continue; }
        put(g, x, y, dx < -1 ? 'Y' : dx < 0 ? 'X' : dx < 1.2 ? 'W' : 'U');
      }
    }
    for (let i = 0; i < 4; i++) put(g, i * 8 + 3, 30, 'w');
    rim(g, 'k');
    return g;
  }
  S('h_crusher0', crusher(false), { anchor: 'tl' });
  S('h_crusher1', crusher(true), { anchor: 'tl' });

  // ================================================================= ПИЛА
  function saw(f) {
    const g = mk(16, 16);
    const rot = (f * Math.PI) / 8;
    each(g, (x, y) => {
      const px = x + 0.5 - 8, py = y + 0.5 - 8, r = Math.hypot(px, py);
      let u = (((Math.atan2(py, px) - rot) / (2 * Math.PI)) * 8) % 1;
      if (u < 0) u += 1;
      const R = 5.0 + 2.4 * Math.pow(u, 0.8);
      if (r > R) return;
      const l = -(px * 0.62 + py * 0.78) / 7;
      if (r > 5.3) return u > 0.75 ? (l > -0.3 ? 'w' : 'Y') : l > 0.2 ? 'Y' : l > -0.3 ? 'X' : 'W';
      if (r > 4.5) return l > 0.3 ? 'X' : 'W';
      if (r < 1.0) return '4';
      if (r < 1.9) return 'U';
      for (let k = 0; k < 3; k++) {
        const a = (k * 2 * Math.PI) / 3 + f * (Math.PI / 3) + 0.3;
        if (Math.hypot(px - Math.cos(a) * 3.1, py - Math.sin(a) * 3.1) < 0.9) return 'k';
      }
      const shine = Math.abs(px - py * 0.2 + 1.2) < 0.9 && py < 0;
      return shine ? 'w' : l > 0.15 ? 'Y' : l > -0.3 ? 'X' : 'W';
    });
    outline(g, 'k');
    return g;
  }
  S('h_saw0', saw(0), C(16, 16));
  S('h_saw1', saw(1), C(16, 16));
  A.anim('h_saw', ['h_saw0', 'h_saw1'], 16);

  // ================================================================= СОСУЛЬКА
  const ICICLE = [
    'kkkkkkkk',
    'kDwDCCBk',
    'kDwDCBAk',
    '.kwDCBk.',
    '.kDDCAk.',
    '.kDCCAk.',
    '.kwCBAk.',
    '..kDBk..',
    '..kDBk..',
    '..kwAk..',
    '..kDBk..',
    '..kCAk..',
    '..kCAk..',
    '...kBk..',
    '...kAk..',
    '....k...',
  ];
  S('h_icicle', ICICLE, { ox: 4, oy: 0 });
  const ICICLE_SH = [
    'BBBBBBBB',
    'BwwDDCCB',
    'BwwkDCBB',
    '.BwDkCB.',
    '.BDwkCB.',
    '.BwDDkB.',
    '.BwDkCB.',
    '..BwkB..',
    '..BwDB..',
    '..BwDB..',
    '..BDkB..',
    '..BwCB..',
    '..BDCB..',
    '...BDB..',
    '...BCB..',
    '....B...',
  ];
  S('h_icicle_shake', ICICLE_SH, { ox: 4, oy: 0 });

  // ================================================================= ВАЛУН
  function boulder(f) {
    const g = mk(24, 24);
    const rot = (f * Math.PI) / 4; // 45° за кадр, узор симметричен на 180°
    each(g, (x, y) => {
      const px = x + 0.5 - 12, py = y + 0.5 - 12;
      const th = Math.atan2(py, px) - rot;
      const R = 10.9 + 0.45 * Math.cos(2 * th) + 0.35 * Math.cos(4 * th + 1);
      const r = Math.hypot(px, py);
      if (r > R) return;
      const nx = px / R, ny = py / R, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      const l = lit(nx, ny, nz);
      // локальные координаты (вращаются)
      const cr = Math.cos(-rot), sr = Math.sin(-rot);
      let u = px * cr - py * sr, v = px * sr + py * cr;
      if (u < 0 || (u === 0 && v < 0)) { u = -u; v = -v; } // симметрия на 180°
      // мох
      const moss = Math.hypot(u - 4, v + 5.5) < 3.6 || Math.hypot(u - 1.5, v + 8) < 2.4 || Math.hypot(u - 7, v + 2) < 1.6;
      if (moss) return l > 0.45 ? '&' : l > 0.0 ? 'n' : l > -0.4 ? 'm' : 'l';
      // трещина
      if (Math.abs(v - 0.6 * u - 2.2) < 0.55 && u > 1.5 && u < 8) return 'f';
      if (Math.abs(v + u * 0.2 - 5.5) < 0.5 && u > 3 && u < 6.5) return 'g';
      // выемка
      if (Math.hypot(u - 5.5, v - 6) < 1.3) return l > 0.2 ? 'g' : 'f';
      return l > 0.72 ? 'j' : l > 0.32 ? 'i' : l > -0.08 ? 'h' : l > -0.5 ? 'g' : 'f';
    });
    outline(g, 'k');
    return g;
  }
  for (let f = 0; f < 4; f++) S('h_boulder' + f, boulder(f), C(24, 24));
  A.anim('h_boulder', ['h_boulder0', 'h_boulder1', 'h_boulder2', 'h_boulder3'], 10);

  // ================================================================= КОНВЕЙЕР
  function conveyor(f) {
    const g = mk(16, 16);
    // лента
    for (let x = 0; x < 16; x++) { put(g, x, 0, 'X'); put(g, x, 1, 'W'); put(g, x, 2, 'W'); put(g, x, 3, 'k'); }
    for (let k = 0; k < 2; k++) {
      const x0 = (2 * f + k * 8) % 16;
      const pts = [[x0, 0, '4'], [x0 + 1, 1, '6'], [x0, 2, '3'], [x0 - 1, 0, '6'], [x0, 1, '6'], [x0 - 1, 2, '2']];
      for (const [x, y, ch] of pts) put(g, (x + 16) % 16, y, ch);
    }
    // корпус
    for (let y = 4; y < 16; y++) for (let x = 0; x < 16; x++) put(g, x, y, 'U');
    for (let x = 0; x < 16; x++) { put(g, x, 4, '0'); }
    // ролики (по центру и половинки по краям — для бесшовности)
    const rot = (f * Math.PI) / 4;
    for (const cx of [4, 12]) {
      ball(g, cx, 8.5, 3.5, (nx, ny, nz) => {
        const r = Math.hypot(nx, ny);
        if (r > 0.8) return 'k';
        const l = lit(nx, ny, nz);
        const ax = Math.cos(rot), ay = Math.sin(rot);
        if (Math.abs(nx * ay - ny * ax) < 0.2 && r > 0.25) return 'W';
        if (r < 0.3) return 'U';
        return l > 0.5 ? 'Y' : l > 0.0 ? 'X' : 'W';
      });
    }
    // рама снизу
    for (let x = 0; x < 16; x++) { put(g, x, 13, 'k'); put(g, x, 14, 'X'); put(g, x, 15, 'W'); }
    for (const x of [4, 12]) { put(g, x, 14, 'w'); put(g, x, 15, 'U'); }
    // предупреждающие полосы на раме
    for (let x = 0; x < 16; x++) if ((x + 16) % 4 < 2 && x !== 4 && x !== 12) put(g, x, 15, '6');
    return g;
  }
  for (let f = 0; f < 4; f++) S('h_conveyor' + f, conveyor(f), { anchor: 'tl' });
  A.anim('h_conveyor', ['h_conveyor0', 'h_conveyor1', 'h_conveyor2', 'h_conveyor3'], 12);

  // ================================================================= БУЛАВА И ЦЕПЬ
  function mace() {
    const g = mk(16, 16);
    const dirs = [];
    for (let k = 0; k < 8; k++) dirs.push([(k * Math.PI) / 4, k % 2 ? 7.3 : 7.95]);
    each(g, (x, y) => {
      const px = x + 0.5 - 8, py = y + 0.5 - 8, r = Math.hypot(px, py);
      if (r < 4.3) return;
      for (const [a, L] of dirs) {
        const ca = Math.cos(a), sa = Math.sin(a);
        const along = px * ca + py * sa, perp = -px * sa + py * ca;
        if (along < 3.5 || along > L) continue;
        const hw = ((L - along) / (L - 3.2)) * 1.9;
        if (Math.abs(perp) < hw) {
          const side = perp * (-sa * LX + ca * LY) > 0; // освещённая половина
          return side ? (along > L - 1.6 ? 'Y' : 'X') : 'W';
        }
      }
    });
    ball(g, 8, 8, 4.6, (nx, ny, nz) => { const l = lit(nx, ny, nz); return l > 0.9 ? 'w' : l > 0.6 ? 'Y' : l > 0.15 ? 'X' : l > -0.35 ? 'W' : 'U'; });
    outline(g, 'k');
    return g;
  }
  S('h_mace', mace(), C(16, 16));
  S('h_chain', ['.kk.', 'kYXk', 'kXUk', '.kk.'], C(4, 4));

  // ================================================================= ГЕЙЗЕР
  function geyser(f) {
    const g = mk(16, 48);
    const H = [18, 36, 48][f];
    const top = 48 - H;
    const headY = top + 5;
    each(g, (x, y) => {
      if (y < top) return;
      const t = (y - top) / H;
      const cx = 8 + Math.sin((y + f * 5) * 0.45) * 0.7;
      let hw = 2.4 + 1.4 * t + (y > 43 ? (y - 43) * 0.9 : 0);
      const dx = x + 0.5 - cx;
      const hr = f === 0 ? 4.2 : 5.6 + (f === 2 ? 0.6 : 0);
      const dh = Math.hypot(dx * 0.95, (y + 0.5 - headY) * 1.1);
      const inHead = dh < hr;
      if (Math.abs(dx) > hw && !inHead) return;
      const sx = inHead ? Math.max(Math.min(Math.abs(dx) / hw, 1), dh / hr) : Math.abs(dx) / hw;
      // прозрачные «просветы»
      const st = hash(x, Math.floor((y + f * 7) / 3), 11);
      if (sx > 0.72 && st < 0.4) return;
      if (sx > 0.85 && !dith(x, y, 0.6)) return;
      // струи (вертикальные полосы с фазой)
      const streak = ((x * 5 + Math.floor((y + f * 6) / 4)) % 5) === 0;
      if (sx < 0.3) return streak ? 'D' : 'w';
      if (sx < 0.62) return streak ? 'C' : 'D';
      return dx > 0 ? 'B' : 'C';
    });
    // капли вокруг шапки
    const drops = [[[2, 3], [13, 4], [4, 1]], [[1, 2], [14, 5], [3, 0], [12, 0]], [[0, 4], [15, 2], [5, 0], [11, 1], [2, 9]]][f];
    for (const [x, y] of drops) { put(g, x, top + y, 'C'); if (y > 0) put(g, x, top + y - 1, 'D'); }
    // всплеск у основания
    for (const [x, y, ch] of [[0, 47, 'C'], [15, 47, 'C'], [1, 46, 'D'], [14, 46, 'D'], [0, 45, 'C'], [15, 44, 'B']]) put(g, x, y, ch);
    return g;
  }
  for (let f = 0; f < 3; f++) S('h_geyser' + f, geyser(f));
  A.anim('h_geyser', ['h_geyser0', 'h_geyser1', 'h_geyser2', 'h_geyser1', 'h_geyser2', 'h_geyser1', 'h_geyser2', 'h_geyser1', 'h_geyser2'], 10);
  A.anim('h_geyser_loop', ['h_geyser1', 'h_geyser2'], 10);

  // ================================================================= ПАДАЮЩИЙ БЛОК
  function fallblock() {
    const g = mk(16, 16);
    each(g, (x, y) => {
      const t = (x + y) / 30;
      let ch = t < 0.3 ? 'i' : t < 0.7 ? 'h' : 'g';
      if (y === 1 || x === 1) ch = 'j';
      if (y === 14 || x === 14) ch = 'g';
      return ch;
    });
    // предупреждающая полоса
    for (let x = 1; x < 15; x++) for (let y = 2; y < 5; y++) put(g, x, y, (x + y) % 4 < 2 ? '6' : '0');
    for (let x = 1; x < 15; x++) put(g, x, 5, 'f');
    // трещины
    line(g, 6, 6, 8, 9, 'f'); line(g, 8, 9, 7, 12, 'f'); line(g, 7, 12, 9, 14, 'f');
    line(g, 8, 9, 11, 10, 'f'); line(g, 11, 10, 13, 13, 'f');
    line(g, 3, 9, 5, 11, 'f');
    for (const [x, y] of [[5, 6], [7, 9], [6, 12], [10, 9], [12, 12], [2, 9]]) put(g, x, y, 'j');
    // отколотые углы
    put(g, 15, 15, '.'); put(g, 14, 15, '.'); put(g, 15, 14, '.'); put(g, 0, 15, '.');
    rim(g, 'k');
    // ссыпающаяся крошка
    put(g, 3, 15, '.'); put(g, 11, 15, '.');
    return g;
  }
  S('h_fallblock', fallblock(), { anchor: 'tl' });

  // ================================================================= МЕДАЛЬОН
  // эмблема лицевой стороны (14×14): три глаза треугольником
  const GLYPH_EMB = [
    '..............',
    '..............',
    '..............',
    '.....1111.....',
    '....1edV1.....',
    '.....1111.....',
    '..............',
    '..1111..1111..',
    '.1edV1..1edV1.',
    '..1111..1111..',
    '..............',
    '..............',
    '..............',
    '..............',
  ];
  function glyph(f) {
    const N = 14, c = 7, rf = 6.6;
    const g = mk(N, N);
    const s = [1, 0.6, 0.16, 0.6][f];
    const th = [0, 1.6, 2.2, 1.6][f] * (f === 3 ? -1 : 1);
    const back = f === 3;
    each(g, (x, y) => {
      const px = x + 0.5 - c, py = y + 0.5 - c;
      if (Math.abs(py) > rf) return;
      const hy = Math.sqrt(rf * rf - py * py);
      const a = rf * s;
      const fw = (a * hy) / rf;
      const fx0 = -th / 2;
      const dxf = px - fx0;
      if (Math.abs(dxf) <= fw + 0.3) {
        const U = (dxf * rf) / Math.max(a, 0.5), V = py;
        const rr = Math.hypot(U, V);
        const l = -(U * 0.6 + V * 0.8) / rf + (back ? -0.25 : 0);
        if (rr > rf - 1.2) return l > 0.35 ? '5' : l > -0.1 ? '4' : l > -0.55 ? '3' : '2';
        if (s < 0.3) return l > 0 ? '4' : '3';
        const ex = Math.floor(U + 7), ey = Math.floor(V + 7);
        const em = GLYPH_EMB[ey] ? GLYPH_EMB[ey][ex] : '.';
        if (!back && em && em !== '.') return em;
        if (back && rr < 1.3) return '2';
        return l > 0.3 ? '4' : l > -0.35 ? '3' : '2';
      }
      // ребро
      if (th !== 0 && Math.abs(px - (fx0 + Math.sign(th) * (fw + 0.8))) < Math.abs(th) / 2 + 0.6) return py < -2 ? '3' : '2';
    });
    if (f === 0) { put(g, 3, 4, 'w'); put(g, 4, 3, '5'); }
    if (f === 1) { put(g, 5, 3, 'w'); }
    if (f === 2) { put(g, 6, 2, 'w'); }
    outline(g, 'o');
    return g;
  }
  for (let f = 0; f < 4; f++) S('i_glyph' + f, glyph(f), C(14, 14));
  A.anim('i_glyph', ['i_glyph0', 'i_glyph1', 'i_glyph2', 'i_glyph3'], 8);

  // ================================================================= ПОРТРЕТЫ
  // Голова: функция-маска лица с сужением к подбородку.
  function faceMask(cx, cy, rx, ry, chin) {
    return (x, y) => {
      const v = (y + 0.5 - cy) / ry;
      if (Math.abs(v) > 1) return null;
      let hw = rx * Math.sqrt(1 - v * v);
      let c0 = cx;
      if (v > 0) { hw *= 1 - 0.42 * v * v; c0 += v * v * chin; }
      const u = (x + 0.5 - c0) / hw;
      if (Math.abs(u) > 1) return null;
      return [u, v];
    };
  }

  // ---- Тиё
  function chiyo(mood) {
    const g = mk(48, 48);
    const bc = 24;
    const bodyHW = (y) => Math.min(21, 7 + (y - 37) * 2.3);
    // туловище: белая блуза
    for (let y = 37; y < 48; y++) {
      const hw = bodyHW(y);
      for (let x = 0; x < 48; x++) {
        const dx = x + 0.5 - bc;
        if (Math.abs(dx) > hw) continue;
        const l = -dx / hw;
        g[y][x] = l > 0.45 ? '8' : l > -0.6 ? 'O' : 'N';
      }
    }
    // шея
    for (let y = 31; y < 39; y++) for (let x = 22; x < 28; x++) put(g, x, y, y < 34 ? 'S' : x < 24 ? 's' : 'S');
    // матросский воротник (V к узлу шарфа)
    for (let y = 37; y < 48; y++) {
      const inner = Math.max(0, (45 - y) * 0.8);
      const hw = bodyHW(y);
      for (let x = 0; x < 48; x++) {
        const dx = x + 0.5 - bc, ad = Math.abs(dx);
        if (ad > hw) continue;
        if (ad >= inner && ad < inner + 6 && y < 46) {
          const e = ad - inner;
          g[y][x] = e >= 4 && e < 5 ? '8' : e >= 5 ? '<' : dx < 0 ? '=' : '>';
        } else if (y >= 46 && ad < 8) g[y][x] = dx < 0 ? '=' : '>';
      }
      if (inner > 0) for (let x = 0; x < 48; x++) { const ad = Math.abs(x + 0.5 - bc); if (ad < inner) g[y][x] = y === 37 ? 'S' : 'O'; }
    }
    // красный шарф-бант
    stamp(g, 19, 41, [
      '.kk.....kk.',
      'kRrk...krrk',
      'kRrzkkkzrzk',
      'kRrzkRkzrzk',
      '.kzk.kz.kzk',
      '..kRrkrzk..',
      '..kRrkrzk..',
    ]);
    // волосы: затылок + каре
    const hair = faceMask(23.5, 20, 14.2, 15.2, -0.5);
    each(g, (x, y) => {
      const m = hair(x, y);
      if (!m || y > 33) return;
      if (y > 30 && x > 31) return;
      const [u, v] = m;
      const l = -(u * 0.75 + v * 0.65);
      return l > 0.6 ? 'c' : l > -0.15 ? 'b' : 'a';
    });
    // лицо
    const face = faceMask(25.5, 23.8, 10.2, 11.2, 1.4);
    each(g, (x, y) => {
      const m = face(x, y);
      if (!m) return;
      const [u, v] = m;
      if (u > 0.84 || v > 0.9) return 'S';
      return u < -0.35 && v < 0.55 && v > -0.4 ? '^' : 's';
    });
    // чёлка
    for (let x = 10; x < 38; x++) {
      const jag = [0, 1, 1, 0, 1, 2, 1, 0][x % 8];
      let yb = 14 + jag;
      if (x < 16) yb += (16 - x) * 1.6;
      if (x > 34) yb += (x - 34) * 2;
      for (let y = 3; y <= yb; y++) {
        if (!hair(x, y) && !face(x, y)) continue;
        const l = -((x - 22) / 14) * 0.7 - (y - 9) / 10;
        put(g, x, y, l > 0.5 ? 'c' : l > -0.4 ? 'b' : 'a');
      }
      if (face(x, Math.floor(yb) + 1) && at(g, x, Math.floor(yb) + 1) !== '.') put(g, x, Math.floor(yb) + 1, 'S');
    }
    // прядь у правого виска
    for (let y = 14; y < 31; y++) {
      const x0 = 34 + Math.floor((y - 14) * 0.08);
      for (let x = x0; x < x0 + 3; x++) put(g, x, y, x === x0 ? 'b' : 'a');
    }
    put(g, 35, 31, 'a'); put(g, 34, 31, 'b');
    // блик на волосах (кольцо)
    each(g, (x, y, ch) => {
      if (ch !== 'b' && ch !== 'c' && ch !== 'a') return;
      const d = Math.hypot(x + 0.5 - 24, (y + 0.5 - 19) * 1.15);
      const ang = Math.atan2(y + 0.5 - 19, x + 0.5 - 24);
      if (d > 11.0 && d < 12.2 && ang < -0.45 && ang > -2.75) return (x * 3 + y) % 5 === 0 ? 'c' : '%';
    });
    // заколка
    stamp(g, 29, 8, ['..kkk', '.kRwk', 'kRrzk', 'kzZk.', '.kk..']);
    // брови
    if (mood === 'happy') {
      stamp(g, 18, 16, ['.bbbb.', 'b....b']); stamp(g, 29, 16, ['bbb.', '...b']);
    } else {
      stamp(g, 18, 15, ['....bb', '..bb..', 'bb....']); stamp(g, 29, 16, ['bb..', '..bb']);
    }
    // глаза (взгляд вправо): ближний — слева, крупнее
    const nearEye = [
      '..kkkkk.',
      '.kkkkkkk',
      'k.8ww((k',
      '..8ww0(k',
      '..8)(00(',
      '..8))(()',
      '...]))w)',
      '....]]].',
    ];
    const farEye = [
      '.kkkk..',
      'kkkkkkk',
      '8ww((k.',
      '8w(0(..',
      '8)(0)..',
      '.))))..',
      '.]]w...',
      '..]]...',
    ];
    stamp(g, 17, 19, nearEye);
    stamp(g, 29, 19, farEye);
        // нос
    put(g, 31, 28, 'S'); put(g, 30, 29, 'S');
    // румянец
    for (const [x, y] of [[17, 28], [18, 28], [19, 28], [32, 28], [33, 28]]) put(g, x, y, '+');
    // рот
    if (mood === 'happy') stamp(g, 25, 31, ['kkkkk', '.zRRk', '..kk.']);
    else { stamp(g, 26, 31, ['.ttt.', 't...t']); stamp(g, 38, 17, ['.D', 'DC', 'CB']); }
    outline(g, 'k');
    for (let x = 0; x < 48; x++) if (g[47][x] === 'k') g[47][x] = '.';
    return g;
  }
  S('por_chiyo_happy', chiyo('happy'), { anchor: 'tl' });
  S('por_chiyo_worried', chiyo('worried'), { anchor: 'tl' });

  // ---- Мастер-лавочник (как ui_master, но 48×48 и вполоборота вправо)
  function master() {
    const g = mk(48, 48);
    const D = -2; // сдвиг вверх
    const F = 2; // сдвиг черт лица вправо
    for (let y = 38; y < 48; y++) {
      const hw = Math.min(23.5, 12 + (y - 38) * 1.3);
      for (let x = 0; x < 48; x++) {
        const dx = x + 0.5 - 24;
        if (Math.abs(dx) > hw) continue;
        const l = -dx / hw;
        g[y][x] = l > 0.78 ? '@' : l > 0.2 ? '=' : l > -0.45 ? '>' : '<';
      }
    }
    for (let y = 39; y < 48; y++) {
      const k = y - 39;
      for (let x = 24 - 2 - Math.floor(k * 0.55); x <= 24 - Math.floor(k * 0.55); x++) put(g, x + 1, y, x === 24 - 2 - Math.floor(k * 0.55) ? 'O' : '8');
      for (let x = 23 + Math.floor(k * 0.55); x <= 25 + Math.floor(k * 0.55); x++) put(g, x + 1, y, x === 25 + Math.floor(k * 0.55) ? 'N' : 'O');
    }
    // борода
    for (let y = 30 + D; y < 47; y++) {
      const k = (y - 28) / 19;
      const yy = y - D;
      const hw = yy < 38 ? 8 + (yy - 30) * 0.15 : 9.2 * Math.pow(Math.max(0, 1 - (yy - 38) / 16), 0.7);
      for (let x = 0; x < 48; x++) {
        const dx = x + 0.5 - 24 - F * 0.6 - Math.sin(y * 0.35) * 0.6 * k;
        if (Math.abs(dx) > hw) continue;
        const strand = (x + Math.floor(y / 3)) % 4 === 0;
        const l = (-dx / Math.max(hw, 1)) * 0.8 - k * 0.4;
        g[y][x] = strand ? (l > 0 ? 'N' : 'M') : l > 0.35 ? '8' : l > -0.25 ? 'O' : 'N';
      }
    }
    // ухо (левое, дальнее у края — видно; правое скрыто)
    ball(g, 14.5, 25.5, 2.6, (nx, ny, nz) => (lit(nx, ny, nz) > 0.3 ? 's' : 'S'));
    put(g, 14, 25, 't');
    // лицо
    ball(g, 24 + 1, 25, 9.4, (nx, ny, nz, x, y) => {
      if (y > 31 && Math.abs(nx) < 0.75) return;
      const l = lit(nx, ny * 0.8, nz);
      return l > 0.2 ? 's' : l > -0.2 ? 'S' : 't';
    });
    for (let x = 15; x < 35; x++) { if (g[18][x] !== '.') g[18][x] = 't'; if (g[19][x] === 's') g[19][x] = 'S'; if (g[20][x] === 's' && dith(x, 20, 0.5)) g[20][x] = 'S'; }
    // шляпа
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 48; x++) {
        const dx = x + 0.5 - 24, yy = y;
        const hw = yy * 1.28 + 0.6;
        const droop = (Math.abs(dx) / 23) ** 2 * 2.5;
        const bottom = 16.5 + droop;
        if (Math.abs(dx) > hw || y > bottom || Math.abs(dx) > 23.5) continue;
        const ang = Math.atan2(dx, yy + 3);
        const stripe = Math.floor(ang * 9 + 100) % 2;
        const l = -dx / 23;
        let ch = l > 0.35 ? '7' : l > -0.15 ? 'L' : l > -0.6 ? 'y' : 'K';
        if (stripe && ch !== 'K') ch = ch === '7' ? 'L' : ch === 'L' ? 'y' : 'K';
        if (y >= bottom - 1.2) ch = l > 0.2 ? 'y' : 'K';
        if (y === 7) ch = 'z';
        if (y === 8) ch = 'Z';
        g[y][x] = ch;
      }
    }
    // брови
    for (const [x, y, ch] of [[17, 20, 'O'], [18, 20, '8'], [19, 20, '8'], [20, 20, '8'], [21, 20, 'O'], [16, 21, 'N'], [22, 21, 'N'],
      [27, 20, 'O'], [28, 20, '8'], [29, 20, '8'], [30, 20, 'O'], [31, 20, 'O'], [32, 21, 'N'], [33, 21, 'M']]) put(g, x + F - 1, y, ch);
    // очки
    const lens = (cx, cy, rr) => {
      for (let y = cy - 4; y <= cy + 4; y++) for (let x = cx - 4; x <= cx + 4; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d < rr - 1) g[y][x] = x - cx + y - cy < -2 ? 'D' : 'Y';
        else if (d < rr) g[y][x] = y < cy ? '3' : '2';
      }
    };
    lens(20 + F - 1, 24, 3.6); lens(30 + F - 1, 24, 3.9);
    for (const x of [24, 25, 26]) put(g, x + F - 1, 23, '3');
    put(g, 15, 23, '2'); put(g, 16, 23, '3');
    // глаза
    for (const cx of [20 + F - 1, 30 + F - 1]) { put(g, cx, 24, 'k'); put(g, cx + 1, 24, 'k'); put(g, cx, 25, 'k'); put(g, cx + 1, 25, 'k'); put(g, cx, 24, 'w'); put(g, cx - 1, 26, 'X'); }
    put(g, 18 + F - 1, 22, 'w'); put(g, 28 + F - 1, 22, 'w'); put(g, 29 + F - 1, 22, 'w');
    // нос (повёрнут вправо)
    ball(g, 26.5 + F - 1, 28.4, 2.4, (nx, ny, nz) => { const l = lit(nx, ny, nz); return l > 0.85 ? '8' : l > 0.35 ? 's' : 'S'; });
    put(g, 26 + F - 1, 30, 't'); put(g, 28 + F - 1, 30, 't');
    put(g, 18, 28, 'R'); put(g, 19, 28, '+'); put(g, 33, 28, 'R'); put(g, 34, 28, '+');
    // усы
    for (let i = 0; i < 9; i++) {
      const cx = 25 + F - 1;
      put(g, cx - 1 - i, 31 + Math.floor(i * 0.5), i < 2 ? '8' : 'O'); put(g, cx - 1 - i, 32 + Math.floor(i * 0.5), 'N');
      put(g, cx + i, 31 + Math.floor(i * 0.5), i < 2 ? 'O' : 'N'); put(g, cx + i, 32 + Math.floor(i * 0.5), 'M');
    }
    put(g, 25, 33, 't'); put(g, 26, 33, 't'); put(g, 24, 33, 'Z'); put(g, 27, 33, 'Z');
    outline(g, 'k');
    for (let x = 0; x < 48; x++) if (g[47][x] === 'k') g[47][x] = '.';
    return g;
  }
  S('por_master', master(), { anchor: 'tl' });

  // ---- Принц Заркун
  function prince() {
    const g = mk(48, 48);
    const bc = 24;
    // стоячий воротник плаща (за головой)
    for (let y = 24; y < 40; y++) {
      for (let x = 0; x < 48; x++) {
        const dx = x + 0.5 - bc, ad = Math.abs(dx);
        const top = 24 + Math.max(0, 15 - ad) * 0.9;
        if (ad > 15 || ad < 7 || y < top) continue;
        g[y][x] = ad > 13.8 ? (dx < 0 ? '4' : '3') : dx < 0 ? (ad > 11 ? 'v' : 'u') : ad > 11 ? 'q' : 'p';
      }
    }
    // плащ
    for (let y = 36; y < 48; y++) {
      const hw = Math.min(22, 11 + (y - 36) * 2.2);
      for (let x = 0; x < 48; x++) {
        const dx = x + 0.5 - bc;
        if (Math.abs(dx) > hw) continue;
        const l = -dx / 22;
        g[y][x] = l > 0.55 ? 'v' : l > 0.05 ? 'u' : l > -0.45 ? 'q' : 'p';
      }
    }
    // шея и одеяние под плащом
    for (let y = 31; y < 39; y++) for (let x = 21; x < 28; x++) put(g, x, y, y < 34 ? 'T' : x < 23 ? 'P' : 'Q');
    for (let y = 37; y < 48; y++) {
      const w = Math.floor((y - 37) * 0.7) + 2;
      for (let x = bc - w; x < bc + w; x++) put(g, x, y, 'p');
      put(g, bc - w - 1, y, '4'); put(g, bc + w, y, '3');
    }
    stamp(g, 22, 40, ['.kk.', 'k5Rk', 'kRZk', '.kk.']);
    // длинные седые волосы
    const hair = faceMask(24, 21, 12.6, 13.6, -0.5);
    each(g, (x, y) => {
      let m = hair(x, y);
      let u, v;
      if (m) { [u, v] = m; } else if (y > 20 && y < 37 && x >= 12 + Math.max(0, y - 30) * 0.5 && x < 21) { u = -0.9 + (x - 12) * 0.08; v = 0.6; } else return;
      const strand = (x * 2 + Math.floor(y / 3)) % 5 === 0;
      const l = -(u * 0.7 + v * 0.5);
      return strand ? (l > 0.2 ? 'N' : 'T') : l > 0.6 ? '8' : l > 0.1 ? 'O' : l > -0.5 ? 'N' : 'M';
    });
    // лицо
    const face = faceMask(25.5, 24.5, 9.4, 11, 1.6);
    each(g, (x, y) => {
      const m = face(x, y);
      if (!m) return;
      const [u, v] = m;
      return u > 0.82 || v > 0.9 ? 'Q' : 'P';
    });
    const edge = [];
    each(g, (x, y, ch) => {
      if ((ch !== 'P' && ch !== 'Q') || y < 17) return;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, 1]]) if ('8ONM'.includes(at(g, x + dx, y + dy))) { edge.push([x, y]); return; }
    });
    for (const [x, y] of edge) g[y][x] = 'T';
    // чёлка, разделённая пробором над третьим глазом
    for (let x = 12; x < 38; x++) {
      let yb = x < 27 ? 13 + Math.floor((27 - x) * 0.35) + ((x & 1) ? 1 : 0) : 13 + Math.floor((x - 27) * 0.7);
      if (x === 26 || x === 27 || x === 28) yb = 11;
      for (let y = 9; y <= yb; y++) {
        if (!face(x, y) && !hair(x, y)) continue;
        const l = -(x - 22) / 12 - (y - 10) / 12;
        put(g, x, y, (x * 2 + y) % 5 === 0 ? 'N' : l > 0.4 ? '8' : l > -0.3 ? 'O' : 'N');
      }
    }
    // прядь у правой щеки
    for (let y = 14; y < 31; y++) { put(g, 35, y, 'O'); put(g, 36, y, 'N'); if (y > 18) put(g, 37, y, 'M'); }
    // корона
    stamp(g, 15, 2, [
      '.k........k........k..',
      'k5k......k5k......k4k.',
      'k43k....k454k....k432k',
      'k432k..k43R32k..k4332k',
      'k4332kk43RZR34kk43332k',
      'k54444444434444444332k',
      'k3R343434333434343R32k',
      'k2Z22222222222222Z221k',
      '.kkkkkkkkkkkkkkkkkkkk.',
    ]);
    // третий глаз
    stamp(g, 26, 12, ['.k.', 'kRk', 'krk', 'kZk', '.k.']);
    // брови: правая (дальняя) надменно приподнята
    stamp(g, 18, 18, ['.kkkkk', 'k.....']);
    stamp(g, 30, 16, ['.kk.', 'k..k']);
    // глаза — полуприкрытые, красные
    stamp(g, 17, 20, ['.kkkkkkk', 'kQRrrrZk', '..rRRZk.', '...QQQ..']);
    stamp(g, 30, 20, ['kkkkk.', 'RrrZkk', 'RRZk..', 'QQ....']);
    put(g, 21, 21, 'w'); put(g, 31, 21, 'w');
    // нос
    put(g, 31, 25, 'Q'); put(g, 31, 26, 'T'); put(g, 30, 26, 'Q');
    // ухмылка (уголок вверх справа)
    stamp(g, 25, 29, ['.....k', 'kkkkk.', '..TT..']);
    outline(g, 'k');
    for (let x = 0; x < 48; x++) if (g[47][x] === 'k') g[47][x] = '.';
    return g;
  }
  S('por_prince', prince(), { anchor: 'tl' });
})();
