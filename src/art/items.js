'use strict';
// Предметы, интерфейс и эффекты (префиксы i_, ui_, fx_).
// Часть спрайтов нарисована строками, часть — сгенерирована кодом ниже (только G.Art).
(function () {
  const A = G.Art;
  const P = 'items';
  A.pal(P, {
    k: '#1c1426', // общий контур
    '0': '#0a0612', // глубокая тень / зрачок
    w: '#ffffff',
    '8': '#ece6f2', // почти белый
    // золото
    o: '#3b1d16', '1': '#6e3418', '2': '#a85a1c', '3': '#dc9426', '4': '#f8cc48', '5': '#fff4b8',
    // изумрудная энергия
    a: '#0b3b2c', b: '#127a4c', c: '#22c46a', d: '#3aff8a', e: '#b4ffd2',
    // красный
    m: '#4a0c26', n: '#9a1a34', r: '#dc3448', R: '#ff6a6a', p: '#ffb4a8', Z: '#6a1020',
    // кожа
    s: '#f6cfa4', S: '#d8956e', t: '#9a5a4a',
    // фиолетовый интерфейс
    u: '#140c26', v: '#24183e', V: '#3a2a5e', x: '#5c4890', '6': '#8a74c4',
    // камень
    f: '#2c2a3a', g: '#484656', h: '#6c6878', i: '#9894a6', j: '#cdc8d4',
    // дерево / солома
    l: '#3c2016', q: '#6c3e22', y: '#a0662e', z: '#d29a52', '7': '#f0c884',
    // вода
    A: '#1e3a6a', B: '#3a74b4', C: '#74b8ec', D: '#c8ecff',
    // огонь
    E: '#6a1410', F: '#c8381a', H: '#f8801c', I: '#ffcc3a', J: '#fff6c8',
    // дым
    K: '#2e2836', L: '#4e4658', M: '#766e80', N: '#a29cac', O: '#cfcad6',
    // радуга
    Q: '#7a4ae0', T: '#3ab8e8', '9': '#e04ab4',
    // сталь
    U: '#2a3444', W: '#4c5c70', X: '#7c90a6', Y: '#b8cad8',
    '<': '#141e44', '>': '#24387a', '=': '#3e5ca8', '@': '#6a8ad0', // индиго (кимоно)
    '^': '#ffe8c8', '~': '#b8a4bc', // свет кожи, щетина
  });

  // ---------------------------------------------------------------- утилиты
  const mk = (w, h) => { const g = []; for (let y = 0; y < h; y++) g.push(new Array(w).fill('.')); return g; };
  const inb = (g, x, y) => x >= 0 && y >= 0 && y < g.length && x < g[0].length;
  const at = (g, x, y) => (inb(g, x, y) ? g[y][x] : '.');
  const put = (g, x, y, ch) => { x = Math.floor(x); y = Math.floor(y); if (ch && inb(g, x, y)) g[y][x] = ch; };
  const rows = (g) => g.map((r) => r.join(''));
  const parse = (rs) => rs.map((r) => r.split(''));
  const clone = (g) => g.map((r) => r.slice());
  const each = (g, fn) => { for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++) { const ch = fn(x, y, g[y][x]); if (ch) g[y][x] = ch; } };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const ramp = (s, t) => s[clamp(Math.floor(t * s.length), 0, s.length - 1)];
  const hash = (x, y, s) => { let n = (x * 374761393 + y * 668265263 + s * 982451653) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  const rnd = (seed) => { let st = seed >>> 0 || 1; return () => ((st = (Math.imul(st, 1664525) + 1013904223) >>> 0) / 4294967296); };
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const dith = (x, y, t) => t * 16 > BAYER[(y & 3) * 4 + (x & 3)] + 0.5;
  const LX = -0.5, LY = -0.62, LZ = 0.6; // свет сверху-слева
  const lit = (nx, ny, nz) => (nx * LX + ny * LY + nz * LZ) / 0.9506;
  // внешний контур: прозрачные пиксели рядом с заполненными
  function outline(g, k, diag, only) {
    const add = [];
    each(g, (x, y, ch) => {
      if (ch !== '.') return;
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      if (diag) nb.push([1, 1], [-1, 1], [1, -1], [-1, -1]);
      for (const [dx, dy] of nb) { const c2 = at(g, x + dx, y + dy); if (c2 !== '.' && c2 !== k && (!only || only.includes(c2))) { add.push([x, y]); break; } }
    });
    for (const [x, y] of add) g[y][x] = k;
    return g;
  }
  // внутренний контур: крайние пиксели фигуры
  function rim(g, k) {
    const add = [];
    each(g, (x, y, ch) => {
      if (ch === '.') return;
      if (at(g, x + 1, y) === '.' || at(g, x - 1, y) === '.' || at(g, x, y + 1) === '.' || at(g, x, y - 1) === '.') add.push([x, y]);
    });
    for (const [x, y] of add) g[y][x] = k;
    return g;
  }
  // шар: fn(nx, ny, nz, x, y) → символ
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
  function blit(dst, src, ox, oy) { each(src, (x, y, ch) => { if (ch !== '.') put(dst, x + ox, y + oy, ch); }); }
  // скос-шейдинг для маски: свет на кромках сверху/слева, тень снизу/справа
  function bevel(g, mark, hi, mid, lo, top, isOut) {
    const o = isOut || ((c) => c === '.' || c === 'k' || c === 'o');
    const res = clone(g);
    each(g, (x, y, ch) => {
      if (ch !== mark) return;
      const u = o(at(g, x, y - 1)), l = o(at(g, x - 1, y)), dn = o(at(g, x, y + 1)), r = o(at(g, x + 1, y));
      const sc = (u ? 1 : 0) + (l ? 1 : 0) - (dn ? 1 : 0) - (r ? 1 : 0);
      res[y][x] = u && l && top ? top : sc > 0 ? hi : sc < 0 ? lo : mid;
    });
    for (let y = 0; y < g.length; y++) g[y] = res[y];
    return g;
  }
  const S = (name, g, opts) => A.sprite(name, P, Array.isArray(g[0]) ? rows(g) : g, opts || {});

  // ================================================================= МОНЕТЫ
  // Вращение: 6 фаз по 30°, толщина ребра видна сбоку, блик скользит по грани.
  function coin(N, f, emblem) {
    const g = mk(N, N), c = N / 2, rf = N / 2 - 1;
    const th = (f * Math.PI) / 6;
    const s = Math.abs(Math.cos(th)), sn = Math.sin(th);
    const side = th < Math.PI / 2 ? -1 : 1;
    const t = (N > 12 ? 2.4 : 1.7) * sn;
    const a = rf * s;
    const fx0 = (-side * t) / 2;
    const glint = [-2.6, 0.2, 1.6, 9, -9, -1.3][f] * (rf / 4);
    const tone = [0, 0.15, 0.25, 0, -0.25, -0.1][f];
    each(g, (x, y) => {
      const px = x + 0.5 - c, py = y + 0.5 - c;
      if (Math.abs(py) > rf) return;
      const hy = Math.sqrt(rf * rf - py * py);
      const fw = (a * hy) / rf;
      const dxf = px - fx0;
      if (Math.abs(dxf) <= fw + 0.3 && a > 0.4) {
        const U = (dxf * rf) / Math.max(a, 0.5), V = py;
        const rr = Math.sqrt(U * U + V * V);
        if (rr > rf - 1.05) {
          const l = -(U * 0.66 + V * 0.75) / rf + tone;
          return l > 0.45 ? '5' : l > -0.05 ? '4' : l > -0.55 ? '2' : '1';
        }
        if (emblem === 'hole') {
          const ux = Math.abs(U), vy = Math.abs(V);
          if (ux < 1 && vy < 1) return 'o';
          if (ux < 2 && vy < 1) return U > 0 ? '4' : '2';
          if (vy < 2 && ux < 1) return V > 0 ? '4' : '2';
        } else if (emblem === 'eye') {
          const lid = 2.3 * (1 - (U / 3.9) * (U / 3.9));
          const ir = U * U + (V + 0.1) * (V + 0.1);
          if (Math.abs(U) < 3.9 && Math.abs(V) < lid) {
            if (ir < 0.5) return '0';
            if (ir < 3.2) return U < -0.3 && V < -0.3 ? 'e' : U + V < 0.6 ? 'd' : 'c';
            return V < -0.6 ? 'O' : '8';
          }
          if (Math.abs(U) < 4.9 && Math.abs(V) < lid + 1.1) return 'o';
        }
        const gl = U * 0.7 + V * 0.7 - glint;
        if (Math.abs(gl) < 0.5 && (N > 12 || Math.abs(U) > 1.5 || Math.abs(V) > 1.5)) return '5';
        const l2 = -(U * 0.4 + V * 0.6) / rf + tone;
        return l2 > 0.35 ? '4' : l2 < -0.45 ? '2' : '3';
      }
      if (side * dxf > 0 && side * dxf <= fw + t + 0.3 && (a > 0.4 ? side * dxf > fw : true)) {
        if (py < -rf * 0.55) return '4';
        if (py > rf * 0.55) return '1';
        return y % 2 ? '2' : '3';
      }
    });
    outline(g, 'o');
    return g;
  }
  const COIN = [
    ['...oooo...', '.oo5554oo.', '.o544443o.', 'o54322332o', 'o542oo432o', 'o432oo421o', 'o43344321o', '.o333221o.', '.oo2211oo.', '...oooo...'],
    ['...oooo...', '..o5554o..', '.o255443o.', '.o252233o.', '.o24oo43o.', '.o23oo42o.', '.o234432o.', '.o133321o.', '..o1221o..', '...oooo...'],
    ['...oooo...', '..o3554o..', '..o2543o..', '..o2523o..', '..o24o4o..', '..o23o3o..', '..o2342o..', '..o1321o..', '..o1221o..', '...oooo...'],
    ['....oo....', '...o45o...', '...o34o...', '...o23o...', '...o32o...', '...o23o...', '...o32o...', '...o12o...', '...o11o...', '....oo....'],
    ['...oooo...', '..o5543o..', '..o5432o..', '..o4232o..', '..o4o42o..', '..o3o31o..', '..o3431o..', '..o2321o..', '..o2211o..', '...oooo...'],
    ['...oooo...', '..o5554o..', '.o544432o.', '.o542232o.', '.o52oo42o.', '.o42oo41o.', '.o434421o.', '.o233211o.', '..o2211o..', '...oooo...'],
  ];
  for (let f = 0; f < 6; f++) S('i_coin' + f, COIN[f], { ox: 5, oy: 5 });
  for (let f = 0; f < 6; f++) S('i_bigcoin' + f, coin(14, f, 'eye'), { ox: 7, oy: 7 });
  A.anim('i_coin', ['i_coin0', 'i_coin1', 'i_coin2', 'i_coin3', 'i_coin4', 'i_coin5'], 12);
  A.anim('i_bigcoin', ['i_bigcoin0', 'i_bigcoin1', 'i_bigcoin2', 'i_bigcoin3', 'i_bigcoin4', 'i_bigcoin5'], 10);

  // ================================================================= СЕРДЦЕ
  function heartShape(w, h, cx, cy, sc, cols, out) {
    const g = mk(w, h);
    const sx = sc / 1.14, sy = sc / 1.12;
    each(g, (x, y) => {
      const X = (x + 0.5 - cx) / sx, Y = 0.12 - (y + 0.5 - cy) / sy;
      const q = X * X + Y * Y - 1;
      if (q * q * q - X * X * Y * Y * Y > 0) return;
      const lx = X < 0 ? -0.52 : 0.52;
      const nx = (X - lx) / 0.8, ny = -(Y - 0.42) / 1.25;
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      const l = lit(nx, ny, nz) + (X < 0 ? 0.05 : -0.08);
      return l > 0.93 ? cols[4] : l > 0.72 ? cols[3] : l > 0.35 ? cols[2] : l > 0.05 ? cols[1] : cols[0];
    });
    rim(g, out);
    return g;
  }
  S('i_heart0', heartShape(13, 12, 6.5, 6, 6.5, 'nnrRw', 'm'));
  S('i_heart1', heartShape(13, 12, 6.5, 6.5, 5.6, 'nnrRw', 'm'));
  A.anim('i_heart', ['i_heart0', 'i_heart1'], 4);

  // ================================================================= СФЕРА ГЛАЗА
  function eyeOrb(N, r, glow) {
    const g = mk(N, N), c = N / 2;
    ball(g, c, c, r, (nx, ny, nz) => {
      const d = Math.sqrt(nx * nx + ny * ny);
      const l = lit(nx, ny, nz);
      // радужка/зрачок смотрят чуть вперёд
      const ix = nx - 0.08, iy = ny - 0.05, id = Math.sqrt(ix * ix + iy * iy);
      if (id < 0.2) return '0';
      if (id < 0.3) return 'a';
      if (l > 0.9 && d > 0.25) return 'w';
      if (d > 0.82) return l > 0.3 ? 'c' : 'b';
      return l > 0.62 ? 'e' : l > 0.25 ? 'd' : l > -0.2 ? 'c' : 'b';
    });
    rim(g, 'a');
    if (glow) { put(g, 0, Math.floor(c), '.'); }
    return g;
  }
  const eo0 = eyeOrb(12, 5.0), eo1 = eyeOrb(12, 5.6);
  // пульс: во втором кадре — искорки по краям
  S('i_eye0', eo0, { ox: 6, oy: 6 });
  put(eo1, 10, 1, 'e'); put(eo1, 1, 10, 'd');
  S('i_eye1', eo1, { ox: 6, oy: 6 });
  A.anim('i_eye', ['i_eye0', 'i_eye1'], 5);

  // ================================================================= ЖИЗНЬ (голова героя в золотом круге)
  const LIFE = [
    '....oooooo....',
    '..oo455443oo..',
    '.o54vvvvvv32o.',
    'o54vvkkkkvv32o',
    'o4vvk^~~~kvv2o',
    'o4vk~^ss~~kv2o',
    'o4vks^dcsSkv2o',
    'o4kssssssSSk2o',
    'o4kSskssksSk2o',
    'o4vkRssssRkv2o',
    '.o3vkSttSkv2o.',
    '.o3vvkkkkvv1o.',
    '..oo322221oo..',
    '....oooooo....',
  ];
  // фон внутри кольца — тёмно-изумрудный, чтобы голова читалась
  S('i_life', LIFE.map((r) => r.replace(/v/g, 'a')));

  // ================================================================= СФЕРА СПОСОБНОСТИ
  function abilityOrb(ph) {
    const g = mk(20, 20);
    const RB = ['9', 'Q', 'T', 'd', '4', 'H'];
    ball(g, 10, 10, 9.5, (nx, ny, nz, x, y) => {
      const d = Math.sqrt(nx * nx + ny * ny), l = lit(nx, ny, nz);
      if (d > 0.79) {
        const ang = Math.atan2(ny, nx) / (Math.PI * 2) + 0.5 + ph;
        const ci = Math.floor(ang * 6) % 6;
        return RB[(ci + 6) % 6];
      }
      if (l > 0.97) return 'w';
      return l > 0.8 ? '5' : l > 0.5 ? '4' : l > 0.1 ? '3' : l > -0.3 ? '2' : '1';
    });
    rim(g, 'o');
    // знак глаза
    for (let x = 4; x <= 15; x++) for (let y = 6; y <= 14; y++) {
      const U = x + 0.5 - 10, V = y + 0.5 - 10.3;
      const lid = 2.7 * (1 - (U / 5.6) * (U / 5.6));
      if (Math.abs(U) < 5.6 && Math.abs(V) < lid) {
        const ir = U * U + V * V;
        g[y][x] = ir < 0.8 ? '0' : ir < 4.4 ? (U < 0 && V < 0 ? 'd' : 'c') : V < -0.7 ? 'O' : '8';
      } else if (Math.abs(U) < 6.6 && Math.abs(V) < lid + 1.1 && Math.abs(V) < 4) g[y][x] = 'o';
    }
    put(g, 9, 9, 'w');
    return g;
  }
  S('i_ability', abilityOrb(0), { ox: 10, oy: 10 });
  S('i_ability1', abilityOrb(1 / 6), { ox: 10, oy: 10 });
  A.anim('i_ability', ['i_ability', 'i_ability1'], 6);

  // ================================================================= КОПЬЁ «КРАСНЫЙ КОНДОР»
  S('i_spear', [
    '......................ooooooo.',
    '.....................oo44445o.',
    '.kkkkkkkkkkkkkkkkkkoo33ooooo..',
    'k4RRRRRRRRRRRRRRRRR54444445o..',
    'k3rrrrrrrrrrrrrrrrr4333333345o',
    'k2nnnnnnnnnnnnnnnnn32222222o..',
    '.kkkkkkkkkkkkkk8888oo22ooooo..',
    '...........kONNNNk...oo22222o.',
    '............kkkkk.....ooooooo.',
  ], { ox: 15, oy: 4 });

  // ================================================================= ВЫСТРЕЛЫ
  function shot(w, h, hx, hy, hr, f, eye) {
    const g = mk(w, h);
    // хвост: штрихи разной длины
    const lanes = eye ? [[-0.55, 0.55], [-0.2, 0.95], [0.2, 0.8], [0.55, 0.5]] : [[-0.5, 0.5], [0, 1], [0.5, 0.6]];
    lanes.forEach(([dy, len], li) => {
      const y = Math.floor(hy + dy * hr);
      const L = Math.round(hx * len * (0.75 + 0.25 * Math.sin(f * 2.1 + li * 1.7)));
      for (let k = 0; k < L; k++) {
        const x = Math.floor(hx) - k;
        const tt = k / Math.max(L, 1);
        if (tt > 0.8 && (k + f) % 2) continue;
        put(g, x, y, tt < 0.35 ? 'e' : tt < 0.7 ? 'd' : 'c');
      }
      if (li % 2 === f % 2) put(g, Math.floor(hx) - L - 2, y, 'b');
    });
    ball(g, hx, hy, hr, (nx, ny, nz) => {
      const d = Math.sqrt(nx * nx + ny * ny);
      if (eye) {
        const ex = nx * hr, ey = ny * hr;
        const lid = hr * 0.42 * (1 - (ex / (hr * 0.75)) ** 2);
        if (Math.abs(ex) < hr * 0.75 && Math.abs(ey) < lid) {
          const ir = ex * ex + ey * ey;
          return ir < 1.2 ? '0' : ir < 4.5 ? 'b' : 'w';
        }
        if (Math.abs(ex) < hr * 0.75 + 1 && Math.abs(ey) < lid + 1) return 'a';
      }
      const l = lit(nx, ny, nz);
      if (d < 0.45) return l > 0.5 ? 'w' : 'e';
      return d > 0.85 ? 'c' : l > 0.4 ? 'e' : 'd';
    });
    return g;
  }
  {
    const s0 = shot(12, 7, 8.5, 3.5, 3.3, 0), s1 = shot(12, 7, 8.5, 3.5, 3.4, 1);
    S('i_shot0', s0, { ox: 6, oy: 3 });
    S('i_shot1', s1, { ox: 6, oy: 3 });
    A.anim('i_shot', ['i_shot0', 'i_shot1'], 12);
    for (let f = 0; f < 3; f++) {
      const g = shot(20, 16, 12.5, 8, 6.4 + (f === 1 ? 0.5 : 0), f, true);
      // искры вокруг
      const R = rnd(31 + f * 17);
      for (let i = 0; i < 4; i++) { const ang = R() * 6.28, rr = 7.2 + R() * 1.2; put(g, 12.5 + Math.cos(ang) * rr, 8 + Math.sin(ang) * rr, R() < 0.5 ? 'e' : 'd'); }
      S('i_bigshot' + f, g, { ox: 10, oy: 8 });
    }
    A.anim('i_bigshot', ['i_bigshot0', 'i_bigshot1', 'i_bigshot2'], 12);
    S('i_beam', [
      '..cccdddddccc.',
      'cddeeewwweeedc',
      'cddeeewwweeedc',
      '..bbbcccccbbb.',
    ], { ox: 7, oy: 2 });
  }

  // ================================================================= ЧЕКПОИНТ (статуя с глазом)
  const GLY = [[4, 19], [11, 19], [5, 20], [10, 20], [6, 21], [9, 21], [7, 22], [8, 22], [6, 3], [9, 3]];
  function checkpoint(state) {
    const g = mk(16, 32);
    // постамент
    rect(g, 0, 27, 16, 5, 'P');
    rect(g, 1, 25, 14, 2, 'P');
    // столб
    rect(g, 2, 8, 12, 17, 'P');
    // навершие
    rect(g, 1, 5, 14, 3, 'P');
    rect(g, 3, 2, 10, 3, 'P');
    rect(g, 5, 0, 6, 2, 'P');
    outline(g, 'k');
    // перекрасить край (k) в рамку: мы заполнили до края, поэтому — внутренний контур
    each(g, (x, y, ch) => (ch === 'k' ? '.' : undefined));
    rim(g, 'k');
    // скос
    bevel(g, 'P', 'i', 'h', 'g', 'j');
    // уступы-тени под карнизами
    for (const yy of [8, 25, 27]) for (let x = 0; x < 16; x++) if (g[yy][x] !== 'k' && g[yy][x] !== '.') g[yy][x] = g[yy][x] === 'i' ? 'h' : 'g';
    // вертикальная фактура камня
    for (let y = 9; y < 25; y++) { if (g[y][4] !== 'k') g[y][4] = y % 5 === 2 ? 'h' : 'i'; if (g[y][11] !== 'k') g[y][11] = 'g'; if (g[y][12] !== 'k') g[y][12] = 'f'; }
    // трещины и мох
    line(g, 9, 17, 10, 20, 'f'); line(g, 10, 20, 9, 23, 'f');
    put(g, 3, 24, 'b'); put(g, 4, 24, 'c'); put(g, 2, 24, 'b'); put(g, 13, 26, 'b'); put(g, 1, 27, 'c'); put(g, 2, 27, 'b');
    // глаз
    const on = state > 0;
    const cx = 8, cy = 13;
    const EYE = [
      '..kkkk..',
      '.k....k.',
      'k......k',
      '.k....k.',
      '..kkkk..',
    ];
    EYE.forEach((r, yy) => r.split('').forEach((ch, xx) => { if (ch === 'k') put(g, cx - 4 + xx, cy - 2 + yy, 'f'); }));
    for (let yy = -1; yy <= 1; yy++) for (let xx = -3 + Math.abs(yy); xx <= 2 - Math.abs(yy); xx++) {
      const X = cx + xx, Y = cy + yy;
      if (!on) g[Y][X] = yy === 0 ? 'f' : 'g';
      else {
        const ir = Math.abs(xx + 0.5) <= 1 && true;
        g[Y][X] = ir ? (state === 2 ? 'e' : 'd') : 'c';
      }
    }
    if (on) {
      put(g, cx - 1, cy, '0'); put(g, cx, cy, '0');
      put(g, cx - 1, cy - 1, 'w');
      // светящиеся глифы
      const gl = state === 2 ? 'd' : 'c';
      for (const [x, y] of GLY) put(g, x, y, gl);
      if (state === 2) { put(g, cx - 5, cy, 'c'); put(g, cx + 4, cy, 'c'); put(g, cx - 1, cy - 4, 'e'); }
    } else {
      for (const [x, y] of GLY) put(g, x, y, 'f');
    }
    return g;
  }
  S('i_checkpoint0', checkpoint(0));
  S('i_checkpoint1', checkpoint(1));
  S('i_checkpoint2', checkpoint(2));
  A.anim('i_checkpoint_on', ['i_checkpoint1', 'i_checkpoint2'], 4);

  // ================================================================= ПРУЖИНА
  S('i_spring0', [
    '.kkkkkkkkkkkkkk.',
    'kpRRRRRRRRRRRRrk',
    'knnnnnnnnnnnnnnk',
    '.kkkkkkkkkkkkkk.',
    '...kYYYYYYYYXk..',
    '..kWWWWWWWWWWk..',
    '...kXYYYYYYYXk..',
    '..kWWWWWWWWWWk..',
    '...kXYYYYYYYXk..',
    '.kkkkkkkkkkkkkk.',
    'kXYYYYYYYYYYYXWk',
    'kkkkkkkkkkkkkkkk',
  ]);
  S('i_spring1', [
    '................',
    '................',
    '................',
    '.kkkkkkkkkkkkkk.',
    'kpRRRRRRRRRRRRrk',
    'knnnnnnnnnnnnnnk',
    '.kkkkkkkkkkkkkk.',
    '..kXYYYYYYYYXWk.',
    '..kWWXYYYYYXWWk.',
    '.kkkkkkkkkkkkkk.',
    'kXYYYYYYYYYYYXWk',
    'kkkkkkkkkkkkkkkk',
  ]);

  // ================================================================= ТАБЛИЧКА
  S('i_sign', [
    '.kkkkkkkkkkkkkk.',
    'k7zzzzzzzzzzzzyk',
    'kzyyyyyyyyyyyyqk',
    'kz2yqyqqyqyyy2qk',
    'kzyqqqqqqqqqqyqk',
    'kllllllllllllllk',
    'k7zzzzzzzzzzzzyk',
    'kzyyyyyyyyyyyyqk',
    'kzyyyyqqqqyyyyqk',
    'k2yyyyyyyyyyyy2k',
    'kllllllllllllllk',
    '.kkkkkk7ykkkkkk.',
    '......kzqk......',
    '......kzqk......',
    '......kyqk......',
    '......kzqk......',
    '.....kkyqkk.....',
    '....kbbcbbbk....',
  ]);

  // ================================================================= ФАКЕЛ-ЖАРОВНЯ
  function torch(f) {
    const g = mk(10, 22);
    // пламя
    const top = 1;
    for (let y = 0; y < 13; y++) {
      const hh = (12 - y) / 11; // 0 у основания, 1 сверху
      const sway = Math.sin(y * 0.7 + f * 1.6) * (1 - hh * 0.2) * hh * 1.4;
      const half = 3.6 * Math.pow(1 - hh, 0.55) + 0.3;
      for (let x = 0; x < 10; x++) {
        const dx = x + 0.5 - 5 - sway;
        const nn = hash(x, y, f * 3 + 1) * 0.9;
        const edge = half - Math.abs(dx) - (hh > 0.6 ? nn * 0.9 : nn * 0.3);
        if (y < top || edge < 0) continue;
        const core = edge / Math.max(half, 0.5) - hh * 0.35;
        g[y][x] = core > 0.75 ? 'J' : core > 0.5 ? 'I' : core > 0.22 ? 'H' : 'F';
      }
    }
    // язычки-искры
    const R = rnd(91 + f * 13);
    for (let i = 0; i < 2; i++) { const xx = 2 + Math.floor(R() * 6), yy = Math.floor(R() * 4); put(g, xx, yy, R() < 0.5 ? 'I' : 'H'); }
    // чаша
    const bowl = [
      'k22222222k',
      'k34455432k',
      '.k333322k.',
      '..k2221k..',
      '...kook...',
    ];
    bowl.forEach((r, yy) => r.split('').forEach((ch, xx) => { if (ch !== '.') g[11 + yy][xx] = ch; }));
    // угли
    for (let x = 1; x < 9; x++) if (g[11][x] === '2') g[11][x] = x % 3 ? 'E' : 'H';
    const stem = [
      '...kXWk...',
      '...kXWk...',
      '..kYXXWk..',
      '..kXWWUk..',
      '...kXWk...',
      '...kXUk...',
      '...kkkk...',
    ];
    stem.forEach((r, yy) => r.split('').forEach((ch, xx) => { if (ch !== '.') g[15 + yy][xx] = ch; }));
    outline(g, 'E', false, 'F');
    return g;
  }
  for (let f = 0; f < 4; f++) S('i_torch' + f, torch(f));
  A.anim('i_torch', ['i_torch0', 'i_torch1', 'i_torch2', 'i_torch3'], 10);

  // ================================================================= ЛЕТАЮЩАЯ ПЛАТФОРМА
  {
    const g = mk(48, 10);
    for (let x = 0; x < 48; x++) {
      const edge = x < 2 || x > 45;
      g[0][x] = x === 0 || x === 47 ? '.' : 'k';
      // доски
      const plank = Math.floor((x - 2) / 7);
      const seam = (x - 2) % 7 === 0 && !edge;
      g[1][x] = seam ? 'q' : '7';
      g[2][x] = seam ? 'q' : 'z';
      g[3][x] = seam ? 'l' : plank % 2 ? 'y' : 'z';
      g[4][x] = 'l';
      // стальная балка
      g[5][x] = 'Y';
      g[6][x] = (x % 6 === 3) ? 'w' : 'X';
      g[7][x] = 'W';
      g[8][x] = 'U';
      g[9][x] = 'k';
      if (edge) { for (let y = 1; y < 9; y++) g[y][x] = x === 0 || x === 47 ? 'k' : g[y][x]; }
    }
    // металлические торцы с огоньками
    for (const ex of [1, 42]) {
      for (let y = 1; y < 9; y++) for (let x = ex; x < ex + 5; x++) g[y][x] = y < 4 ? (x === ex ? 'Y' : 'X') : y < 7 ? 'W' : 'U';
      g[1][ex] = 'Y'; g[4][ex + 1] = 'k'; g[4][ex + 3] = 'k';
      g[3][ex + 2] = 'H'; g[2][ex + 2] = 'I'; g[2][ex + 1] = 'w'; g[3][ex + 1] = 'I'; g[3][ex + 3] = 'F'; g[2][ex + 3] = 'H';
    }
    // заклёпки
    for (let x = 9; x < 40; x += 6) g[6][x] = 'Y', g[7][x] = 'U';
    // нижние огни-двигатели
    g[9][12] = 'T'; g[9][13] = 'T'; g[9][34] = 'T'; g[9][35] = 'T';
    g[0][0] = '.'; g[9][0] = '.'; g[9][47] = '.';
    for (let y = 1; y < 9; y++) { g[y][0] = 'k'; g[y][47] = 'k'; }
    S('i_platform', g, { anchor: 'tl' });
  }

  // ================================================================= РЕШЁТКА ВОРОТ
  {
    const g = mk(16, 16);
    for (const bx of [1, 9]) for (let y = 0; y < 16; y++) {
      g[y][bx] = 'k'; g[y][bx + 1] = 'X'; g[y][bx + 2] = 'W'; g[y][bx + 3] = 'U'; g[y][bx + 4] = 'k';
    }
    for (let x = 0; x < 16; x++) { g[5][x] = 'k'; g[6][x] = 'Y'; g[7][x] = 'X'; g[8][x] = 'W'; g[9][x] = 'k'; }
    for (const bx of [3, 11]) { g[7][bx] = 'w'; g[8][bx] = 'U'; g[6][bx] = 'Y'; }
    for (const bx of [2, 10]) { g[1][bx] = 'Y'; g[13][bx] = 'Y'; }
    S('i_gate', g, { anchor: 'tl' });
  }

  // ================================================================= ВЗРЫВ
  {
    const R = rnd(1234);
    const blobs = [];
    for (let i = 0; i < 11; i++) {
      const ang = (i / 11) * Math.PI * 2 + R() * 0.5;
      blobs.push({ ax: Math.cos(ang), ay: Math.sin(ang), d: i === 0 ? 0 : 0.35 + R() * 0.65, r: 0.45 + R() * 0.35 });
    }
    blobs[0].r = 0.75;
    const P_ = [
      // spread, size, rise, heat, erode
      [0.0, 0, 0, 1.0, 0],
      [3.0, 7.5, 0, 0.72, 0],
      [5.0, 9.5, 0.5, 0.66, 0],
      [6.5, 10.5, 1.5, 0.62, 0.05],
      [8, 10.5, 3, 0.34, 0.15],
      [9, 9.5, 4.5, 0.12, 0.38],
      [10, 8, 6, 0.05, 0.62],
    ];
    for (let f = 0; f < 7; f++) {
      const g = mk(32, 32);
      const [sp, sz, rise, heat, ero] = P_[f];
      if (f === 0) {
        ball(g, 16, 16, 6, (nx, ny, nz) => (Math.hypot(nx, ny) < 0.6 ? 'w' : 'J'));
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let k = 6; k < 13; k++) put(g, 16 + dx * k - (dx < 0 ? 1 : 0), 16 + dy * k - (dy < 0 ? 1 : 0), k < 9 ? 'J' : 'I');
        for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) for (let k = 4; k < 8; k++) put(g, 16 + dx * k - (dx < 0 ? 1 : 0), 16 + dy * k - (dy < 0 ? 1 : 0), k < 6 ? 'J' : 'H');
        rim(g, 'I');
        S('fx_explode0', g, { ox: 16, oy: 16 });
        continue;
      }
      each(g, (x, y) => {
        const px = x + 0.5, py = y + 0.5;
        let best = -1, bn = null;
        for (const b of blobs) {
          const bx = 16 + b.ax * b.d * sp, by = 16 + b.ay * b.d * sp - rise * (0.5 + b.d * 0.6);
          const br = b.r * sz * (f > 4 ? 0.85 : 1);
          const dx = (px - bx) / br, dy = (py - by) / br;
          const v = 1 - Math.sqrt(dx * dx + dy * dy);
          if (v > best) { best = v; bn = [dx, dy]; }
        }
        const noise = hash(x >> 1, y >> 1, f) * 0.25 + hash(x, y, f + 50) * 0.12;
        if (best - ero * (0.6 + noise * 2) <= 0.02) return;
        const nz = Math.sqrt(Math.max(0, 1 - bn[0] * bn[0] - bn[1] * bn[1]));
        const l = lit(bn[0], bn[1], nz);
        const temp = heat * (best * 1.5 + 0.15) + noise * 0.3 + (l - 0.45) * [0, 0.12, 0.12, 0.3, 0.15, 0, 0][f] - (f === 4 && best < 0.3 ? 0.2 : 0);
        if (temp > 1.05) return 'w';
        if (temp > 0.85) return 'J';
        if (temp > 0.62) return 'I';
        if (temp > 0.42) return 'H';
        if (temp > 0.27) return 'F';
        if (temp > 0.2 && f < 5) return 'E';
        return l > 0.7 ? 'O' : l > 0.4 ? 'N' : l > 0.05 ? 'M' : l > -0.3 ? 'L' : 'K';
      });
      if (f >= 2) {
        // контур снизу-справа тёмный
        const add = [];
        each(g, (x, y, ch) => { if (ch === '.' && (at(g, x - 1, y) !== '.' || at(g, x, y - 1) !== '.')) add.push([x, y]); });
        for (const [x, y] of add) g[y][x] = f < 4 ? 'E' : 'K';
      }
      S('fx_explode' + f, g, { ox: 16, oy: 16 });
    }
    A.anim('fx_explode', ['fx_explode0', 'fx_explode1', 'fx_explode2', 'fx_explode3', 'fx_explode4', 'fx_explode5', 'fx_explode6'], 16, false);
  }

  // ================================================================= ПЫЛЬ
  {
    const sets = [
      [[5, 6, 2.2], [3.5, 6.5, 1.6], [6.6, 6.6, 1.6]],
      [[5, 5.3, 3], [2.8, 6.5, 2.2], [7.3, 6.4, 2.2]],
      [[5, 4.6, 3.1], [2.2, 6.2, 2.2], [7.9, 6.0, 2.3]],
      [[5, 3.6, 2.0], [1.7, 5.6, 1.5], [8.4, 5.4, 1.5]],
    ];
    sets.forEach((bl, f) => {
      const g = mk(10, 10);
      each(g, (x, y) => {
        let best = -1, bn;
        for (const [cx, cy, r] of bl) { const dx = (x + 0.5 - cx) / r, dy = (y + 0.5 - cy) / r, v = 1 - Math.hypot(dx, dy); if (v > best) { best = v; bn = [dx, dy]; } }
        if (best <= 0) return;
        if (f === 3 && best < 0.45 && dith(x, y, 0.5)) return;
        if (f === 2 && best < 0.18 && dith(x, y, 0.5)) return;
        const nz = Math.sqrt(Math.max(0, 1 - bn[0] ** 2 - bn[1] ** 2));
        const l = lit(bn[0], bn[1], nz) - f * 0.08;
        return l > 0.72 ? '8' : l > 0.4 ? 'O' : l > 0 ? 'N' : 'M';
      });
      S('fx_puff' + f, g, { ox: 5, oy: 5 });
    });
    A.anim('fx_puff', ['fx_puff0', 'fx_puff1', 'fx_puff2', 'fx_puff3'], 12, false);
  }

  // ================================================================= ИСКРА
  S('fx_spark0', [
    '.......',
    '.......',
    '...I...',
    '..IwI..',
    '...I...',
    '.......',
    '.......',
  ], { ox: 3, oy: 3 });
  S('fx_spark1', [
    '...I...',
    '...J...',
    '.J.J.J.',
    'IJJwJJI',
    '.J.J.J.',
    '...J...',
    '...I...',
  ], { ox: 3, oy: 3 });
  S('fx_spark2', [
    '...H...',
    '.......',
    '.I...I.',
    'H..I..H',
    '.I...I.',
    '.......',
    '...H...',
  ], { ox: 3, oy: 3 });
  A.anim('fx_spark', ['fx_spark0', 'fx_spark1', 'fx_spark2'], 18, false);

  // ================================================================= ВСПЫШКА УДАРА
  for (let f = 0; f < 2; f++) {
    const g = mk(16, 16);
    each(g, (x, y) => {
      const dx = x + 0.5 - 8, dy = y + 0.5 - 8, r = Math.hypot(dx, dy), th = Math.atan2(dy, dx) + 0.39;
      const spike = Math.pow(Math.abs(Math.cos(th * 2)), 6);
      const spike2 = Math.pow(Math.abs(Math.cos(th * 2 + Math.PI / 4 * 2)), 10) * 0.5;
      const R = f === 0 ? 3.2 + 4.8 * Math.max(spike, spike2) : 4.5 + 3.5 * Math.max(spike, spike2);
      if (r > R) return;
      if (f === 1 && r < R - 2.2 && r < 4.5) return r < 1.2 ? 'J' : undefined;
      const t = r / R;
      if (f === 0) return t < 0.35 ? 'w' : t < 0.6 ? 'J' : t < 0.85 ? 'I' : 'H';
      return t < 0.75 ? 'I' : t < 0.9 ? 'H' : 'F';
    });
    S('fx_hit' + f, g, { ox: 8, oy: 8 });
  }
  A.anim('fx_hit', ['fx_hit0', 'fx_hit1'], 20, false);

  // ================================================================= КОЛЬЦО ЭНЕРГИИ
  [[4.8, 2.4], [8, 2.2], [10.8, 1.5]].forEach(([R0, th], f) => {
    const g = mk(24, 24);
    each(g, (x, y) => {
      const dx = x + 0.5 - 12, dy = y + 0.5 - 12, r = Math.hypot(dx, dy);
      const d = Math.abs(r - R0);
      if (d > th / 2 + 0.25) {
        return;
      }
      if (f === 2 && hash(Math.floor(Math.atan2(dy, dx) * 5), 0, 9) < 0.3) return;
      const l = -(dx * 0.6 + dy * 0.8) / r;
      const inner = r < R0;
      if (f === 0) return d < 0.6 ? 'w' : inner ? 'e' : 'd';
      if (f === 1) return d < 0.5 ? (l > 0.3 ? 'w' : 'e') : inner ? 'd' : 'c';
      return d < 0.45 ? 'd' : l > 0 ? 'c' : 'b';
    });
    S('fx_ring' + f, g, { ox: 12, oy: 12 });
  });
  A.anim('fx_ring', ['fx_ring0', 'fx_ring1', 'fx_ring2'], 14, false);

  // ================================================================= ВСПЛЕСК
  {
    // [высота стенок, наклон наружу, полуширина основания, высота центр. столба, капли [x,y]]
    const FR = [
      [4, 0.8, 1.5, 6, [[7, 3], [4, 6], [11, 5]]],
      [7, 2.6, 2.2, 3, [[2, 2], [13, 1], [8, 0], [5, 3], [10, 2]]],
      [4, 3.6, 3.2, 0, [[1, 5], [14, 4], [8, 4], [4, 8], [11, 7]]],
      [1, 4.5, 5.0, 0, [[0, 10], [15, 10], [8, 9]]],
    ];
    FR.forEach(([H, lean, bw, col, drops], f) => {
      const g = mk(16, 12);
      // основание-лужица
      for (let x = 0; x < 16; x++) {
        const dx = Math.abs(x + 0.5 - 8);
        if (dx < bw + 2.2) g[11][x] = dx < bw + 1 ? 'C' : 'B';
        if (dx < bw + 0.8 && dx > bw - 0.8 - (f === 3 ? 2 : 0) && f > 0) g[10][x] = 'D';
      }
      // стенки короны
      for (let k = 1; k <= H; k++) {
        const tt = k / H, y = 11 - k;
        const off = bw + lean * Math.pow(tt, 1.4);
        const th = k > H - 2 ? 1 : 2;
        for (let i = 0; i < th; i++) {
          put(g, Math.floor(8 - off) - i, y, i === th - 1 ? 'D' : 'C');
          put(g, Math.floor(8 + off) - 1 + i, y, i === th - 1 ? 'B' : 'C');
        }
        if (k === H) { put(g, Math.floor(8 - off) - th + 1, y, 'w'); put(g, Math.floor(8 + off) - 2 + th, y, 'D'); }
      }
      // центральный столб
      for (let k = 1; k <= col; k++) { put(g, 7, 11 - k, k === col ? 'w' : 'D'); put(g, 8, 11 - k, k === col ? 'D' : 'C'); }
      outline(g, 'A', false, 'BCDw');
      for (const [x, y] of drops) { put(g, x, y, f < 2 ? 'D' : 'C'); if (f < 3 && y < 10) put(g, x, y + 1, 'B'); }
      S('fx_splash' + f, g);
    });
    A.anim('fx_splash', ['fx_splash0', 'fx_splash1', 'fx_splash2', 'fx_splash3'], 12, false);
  }

  // ================================================================= ИНТЕРФЕЙС: сердца, монета, щит, глаз
  const HEART9 = [
    '.kkk.kkk.',
    'kpRrkRrnk',
    'kRprrrrnk',
    'krrrrrrnk',
    '.krrrrnk.',
    '..krrnk..',
    '...knk...',
    '....k....',
  ];
  const EMPTY = { p: 'x', R: 'V', r: 'v', n: 'u' };
  S('ui_heart', HEART9, { anchor: 'tl' });
  S('ui_heart_empty', HEART9.map((r) => r.replace(/[pRrn]/g, (c) => EMPTY[c])), { anchor: 'tl' });
  S('ui_heart_half', HEART9.map((r) => r.split('').map((c, x) => (x >= 4 && EMPTY[c] ? EMPTY[c] : c)).join('')), { anchor: 'tl' });
  S('ui_coin', [
    '..oooo..',
    '.o5443o.',
    'o542232o',
    'o43oo42o',
    'o32oo41o',
    'o334431o',
    '.o3221o.',
    '..oooo..',
  ], { anchor: 'tl' });
  S('ui_shield', [
    'kkkkkkkk',
    'k544432k',
    'k4DCCB2k',
    'k4CDCA2k',
    'k4CCBA2k',
    '.k4CA2k.',
    '.k3BA2k.',
    '..k32k..',
    '...kk...',
  ], { anchor: 'tl' });
  S('ui_eye', [
    '....kkk....',
    '..kk888kk..',
    '.k8NcdcN8k.',
    'k88cw0dc88k',
    'k88cd0bc88k',
    '.k88cbc88k.',
    '..kk888kk..',
    '....kkk....',
  ], { anchor: 'tl' });

  // ================================================================= 9-SLICE РАМКА
  {
    const N = 24, g = mk(N, N);
    each(g, (x, y) => {
      const a = Math.min(y, N - 1 - y), b = Math.min(x, N - 1 - x);
      const m = Math.min(a, b);
      if (a <= 5 && b <= 5) {
        if (a === 0 && b === 0) return '.';
        if (a === 0 || b === 0 || a === 5 || b === 5) return 'k';
        if (a >= 2 && a <= 3 && b >= 2 && b <= 3) return 'G';
        return 'P';
      }
      if (m === 0) return 'k';
      if (m <= 3) return 'P';
      if (m === 4) return 'k';
      if (m === 5 && (y === 5 || x === 5)) return 'u';
      return 'v';
    });
    bevel(g, 'P', '4', '3', '2', '5');
    // самоцвет-глаз в углах
    each(g, (x, y, ch) => {
      if (ch !== 'G') return;
      const lx = Math.min(x, N - 1 - x) === 2, ly = Math.min(y, N - 1 - y) === 2;
      const left = x < N / 2 ? lx : !lx, up = y < N / 2 ? ly : !ly;
      return up && left ? 'e' : up || left ? 'd' : 'b';
    });
    // мелкие «насечки» на планках каждые 8 px
    for (const [x, y] of [[11, 2], [2, 11], [11, 21], [21, 11]]) put(g, x, y, '5');
    const parts = { tl: [0, 0], t: [8, 0], tr: [16, 0], l: [0, 8], c: [8, 8], r: [16, 8], bl: [0, 16], b: [8, 16], br: [16, 16] };
    for (const [n, [ox, oy]] of Object.entries(parts)) {
      const pg = mk(8, 8);
      each(pg, (x, y) => g[oy + y][ox + x]);
      S('ui_frame_' + n, pg, { anchor: 'tl' });
    }
  }

  // ================================================================= КУРСОР
  {
    const C = [
      'kk.....',
      'k5kk...',
      'k443kk.',
      'k3wd32k',
      'k3db22k',
      'k222kk.',
      'k2kk...',
      'kk.....',
    ];
    S('ui_cursor0', C.map((r) => r + '.'), { anchor: 'tl' });
    S('ui_cursor1', C.map((r) => '.' + r), { anchor: 'tl' });
    A.anim('ui_cursor', ['ui_cursor0', 'ui_cursor1'], 4);
  }

  // ================================================================= ИКОНКИ СПОСОБНОСТЕЙ
  function badge() {
    const g = mk(16, 16);
    each(g, (x, y) => {
      const a = Math.min(y, 15 - y), b = Math.min(x, 15 - x);
      if (a + b < 2) return a + b === 1 ? '.' : '.';
      if (a === 0 || b === 0 || (a + b === 2)) return 'k';
      if (a === 1 || b === 1 || a + b === 3) return (y < 8 && a === 1) || (x < 8 && b === 1) ? 'x' : 'u';
      return y < 6 ? 'V' : 'v';
    });
    return g;
  }
  function icon(name, draw, bg) {
    const g = bg ? badge() : mk(16, 16);
    const sym = mk(16, 16);
    draw(sym);
    const so = clone(sym);
    outline(so, 'k');
    each(so, (x, y, ch) => { if (ch !== '.' && (!bg || (g[y][x] !== 'k' && g[y][x] !== '.') || ch !== 'k')) g[y][x] = ch; });
    S(name, g, { anchor: 'tl' });
  }
  const spearDiag = (s, x0, y0, len) => {
    for (let i = 0; i < len; i++) { put(s, x0 + i, y0 - i, i % 2 ? 'r' : 'R'); put(s, x0 + i + 1, y0 - i, 'n'); }
  };
  function trident(s) {
    for (let i = 0; i < 7; i++) { put(s, 3 + i, 12 - i, i % 3 === 0 ? 'R' : 'r'); put(s, 3 + i, 13 - i, 'n'); }
    put(s, 2, 13, '4'); put(s, 2, 14, '2'); put(s, 3, 14, '2');
    // перекладина
    for (const [x, y, ch] of [[8, 3, '5'], [9, 4, '4'], [10, 5, '4'], [11, 6, '3'], [12, 7, '2']]) put(s, x, y, ch);
    // зубцы
    for (const [x, y, ch] of [[9, 2, '4'], [10, 1, '5'], [11, 4, '4'], [12, 3, '4'], [13, 2, '5'], [14, 1, 'w'], [13, 6, '3'], [14, 5, '4']]) put(s, x, y, ch);
    // перо
    put(s, 5, 11, '8'); put(s, 4, 11, 'N'); put(s, 5, 12, 'N'); put(s, 4, 12, '8');
  }
  icon('ui_ab_spear', trident, true);
  icon('ui_ab_shot', (s) => {
    for (const [x, y] of [[2, 7], [3, 7], [2, 9], [4, 9], [5, 9]]) put(s, x, y, 'c');
    for (let x = 3; x < 7; x++) put(s, x, 8, x < 5 ? 'b' : 'c');
    ball(s, 9.5, 8.5, 4, (nx, ny, nz) => { const l = lit(nx, ny, nz); return l > 0.85 ? 'w' : l > 0.55 ? 'e' : l > 0.15 ? 'd' : 'c'; });
    put(s, 10, 8, '0'); put(s, 10, 9, 'a');
  }, true);
  icon('ui_ab_djump', (s) => {
    const chev = (yy, c1, c2) => { for (let i = 0; i < 5; i++) { put(s, 7 - i, yy + i, c1); put(s, 8 + i, yy + i, c2); put(s, 7 - i, yy + i + 1, '2'); put(s, 8 + i, yy + i + 1, '2'); } };
    chev(2, '5', '4');
    chev(7, '4', '3');
    // облачко
    for (const [x, y] of [[5, 13], [6, 13], [7, 12], [8, 12], [9, 13], [10, 13], [6, 12]]) put(s, x, y, '8');
  }, true);
  icon('ui_ab_dash', (s) => {
    for (let y = 5; y <= 10; y++) { const w = 3 - Math.abs(y - 7.5) + 0.5; for (let x = 9; x < 9 + w * 1.6; x++) put(s, x, y, y < 8 ? '4' : '3'); }
    rect(s, 5, 6, 5, 4, '4'); rect(s, 5, 8, 5, 2, '3');
    put(s, 13, 7, '3'); put(s, 13, 8, '2');
    for (const [y, x0, x1] of [[4, 2, 6], [7, 1, 3], [11, 2, 6]]) for (let x = x0; x <= x1; x++) put(s, x, y, 'N');
  }, true);
  icon('ui_ab_charge', (s) => {
    ball(s, 8, 8, 4.4, (nx, ny, nz) => { const l = lit(nx, ny, nz); return l > 0.85 ? 'w' : l > 0.5 ? 'e' : l > 0.1 ? 'd' : 'c'; });
    put(s, 8, 8, '0'); put(s, 7, 8, '0');
    for (const [x, y] of [[8, 1], [8, 2], [14, 8], [13, 8], [8, 14], [8, 13], [1, 8], [2, 8]]) put(s, x, y, 'e');
    for (const [x, y] of [[3, 3], [12, 3], [3, 12], [12, 12]]) put(s, x, y, 'd');
  }, true);
  icon('ui_ab_wall', (s) => {
    for (let y = 2; y < 14; y++) for (let x = 10; x < 14; x++) put(s, x, y, (y % 4 === 1) || (x === 12 && y % 8 < 4) || (x === 10 && y % 8 >= 4 && y % 4 !== 1) ? 'g' : x === 10 ? 'i' : 'h');
    // стрелка вверх
    for (let i = 0; i < 4; i++) for (let x = 6 - i; x <= 6 + i; x++) put(s, x, 3 + i, i === 0 || x === 6 - i ? '5' : '4');
    rect(s, 5, 7, 3, 6, '3'); for (let y = 7; y < 13; y++) put(s, 5, y, '4');
  }, true);
  icon('ui_ab_pound', (s) => {
    rect(s, 6, 2, 4, 6, '3'); for (let y = 2; y < 8; y++) put(s, 6, y, '4');
    for (let i = 0; i < 4; i++) for (let x = 4 + i; x <= 11 - i; x++) put(s, x, 8 + i, i === 0 ? '4' : '3');
    for (const [x, y] of [[2, 13], [3, 12], [13, 13], [12, 12], [7, 13], [8, 13]]) put(s, x, y, 'I');
  }, true);
  icon('ui_ab_eye', (s) => {
    for (let y = 3; y < 13; y++) for (let x = 1; x < 15; x++) {
      const U = x + 0.5 - 8, V = y + 0.5 - 8, lid = 3.6 * (1 - (U / 6.6) ** 2);
      if (Math.abs(U) < 6.6 && Math.abs(V) < lid) {
        const ir = U * U + V * V;
        s[y][x] = ir < 1.3 ? '0' : ir < 7 ? (U + V < -1 ? 'e' : U + V < 1.5 ? 'd' : 'c') : V < -1.2 ? 'O' : '8';
      }
    }
    put(s, 7, 6, 'w');
    for (const [x, y] of [[3, 4], [8, 2], [13, 4]]) put(s, x, y, 'k');
  }, true);

  // ================================================================= ТОВАРЫ ЛАВКИ
  icon('ui_shop_heart', (s) => {
    const h = heartShape(14, 13, 7, 6.5, 7, 'nnrRw', 'm');
    // убрать собственный контур — его даст icon()
    each(h, (x, y, ch) => (ch === 'm' ? 'n' : undefined));
    blit(s, h, 1, 1);
  });
  icon('ui_shop_shot', (s) => {
    blit(s, eyeOrb(12, 5.5), 1, 2);
    rect(s, 12, 1, 1, 5, '4'); rect(s, 10, 3, 5, 1, '4'); put(s, 12, 3, '5');
  });
  icon('ui_shop_spear', trident);
  icon('ui_shop_shield', (s) => {
    const SH = [
      '.44444444444.',
      '4553333333332',
      '45DDCCCCCBB32',
      '45DCCCwCCBA32',
      '45CCCwdwCBA32',
      '45CCCCwCCBA32',
      '.4CCCCCCBBA2.',
      '.43CCCCCBA22.',
      '..43CCCBA22..',
      '...43CBA22...',
      '....432 2....'.replace(' ', '2'),
      '.....422.....',
    ];
    SH.forEach((r, yy) => r.split('').forEach((ch, xx) => { if (ch !== '.') put(s, 1 + xx, 2 + yy, ch); }));
  });
  icon('ui_shop_life', (s) => {
    const cx = 8, cy = 8;
    ball(s, 2.2, 9.2, 1.7, (nx, ny, nz) => (lit(nx, ny, nz) > 0.5 ? 's' : 'S'));
    ball(s, 13.8, 9.2, 1.7, () => 'S');
    ball(s, cx, cy, 5.9, (nx, ny, nz) => {
      const l = lit(nx, ny, nz);
      if (ny < -0.3) return l > 0.75 ? '^' : '~';
      return l > 0.72 ? '^' : l > 0.15 ? 's' : 'S';
    });
    for (const [x, y, ch] of [[5, 8, 'k'], [5, 9, 'k'], [10, 8, 'k'], [10, 9, 'k'], [7, 5, 'k'], [8, 5, 'k'], [7, 6, 'd'], [8, 6, 'c'], [6, 6, 'k'], [9, 6, 'k'], [7, 7, 'k'], [8, 7, 'k'],
      [4, 10, 'R'], [11, 10, 'R'], [7, 11, 't'], [8, 11, 't'], [6, 10, 'S'], [9, 10, 'S'], [2, 9, 't'], [13, 9, 't']]) put(s, x, y, ch);
  });
  icon('ui_shop_potion', (s) => {
    ball(s, 8, 10, 4.8, (nx, ny, nz) => {
      const l = lit(nx, ny, nz);
      if (l > 0.88) return 'w';
      if (ny < -0.15) return l > 0.5 ? 'D' : 'C';
      return l > 0.55 ? 'p' : l > 0.2 ? 'R' : l > -0.15 ? 'r' : 'n';
    });
    rect(s, 7, 3, 3, 3, 'C'); put(s, 7, 3, 'D'); put(s, 7, 4, 'D');
    rect(s, 6, 1, 5, 2, 'y'); put(s, 6, 1, 'z'); put(s, 7, 1, '7'); put(s, 10, 2, 'q'); put(s, 9, 2, 'q');
    put(s, 6, 9, 'w'); put(s, 6, 8, 'D');
  });

  // ================================================================= ПОРТРЕТ МАСТЕРА-ЛАВОЧНИКА
  function master(blink) {
    const g = mk(48, 56);
    // кимоно
    for (let y = 40; y < 56; y++) {
      const hw = Math.min(23.5, 12 + (y - 40) * 1.3);
      for (let x = 0; x < 48; x++) {
        const dx = x + 0.5 - 24;
        if (Math.abs(dx) > hw) continue;
        const l = -dx / hw;
        g[y][x] = l > 0.78 ? '@' : l > 0.2 ? '=' : l > -0.45 ? '>' : '<';
      }
    }
    // ворот (белая нижняя рубаха и запах)
    for (let y = 41; y < 56; y++) {
      const k = y - 41;
      for (let x = 24 - 2 - Math.floor(k * 0.55); x <= 24 - Math.floor(k * 0.55); x++) put(g, x, y, x === 24 - 2 - Math.floor(k * 0.55) ? 'j' : 'O');
      for (let x = 23 + Math.floor(k * 0.55); x <= 25 + Math.floor(k * 0.55); x++) put(g, x, y, x === 25 + Math.floor(k * 0.55) ? 'N' : 'O');
    }
    // герб-глаз на груди
    for (const [x, y, ch] of [[9, 47, '4'], [10, 46, '4'], [11, 46, '4'], [12, 47, '3'], [10, 48, '3'], [11, 48, '2'], [10, 47, 'd'], [11, 47, '0'], [38, 47, '3'], [37, 46, '4'], [36, 46, '4'], [35, 47, '4'], [37, 48, '2'], [36, 48, '3'], [37, 47, '0'], [36, 47, 'd']]) put(g, x, y, ch);
    // борода
    for (let y = 30; y < 54; y++) {
      const k = (y - 30) / 23;
      const hw = y < 38 ? 8 + (y - 30) * 0.15 : 9.2 * Math.pow(1 - (y - 38) / 16, 0.7);
      for (let x = 0; x < 48; x++) {
        const dx = x + 0.5 - 24 - Math.sin(y * 0.35) * 0.6 * k;
        if (Math.abs(dx) > hw) continue;
        const strand = ((x + Math.floor(y / 3)) % 4 === 0);
        const l = -dx / Math.max(hw, 1) * 0.8 - k * 0.4;
        g[y][x] = strand ? (l > 0 ? 'N' : 'M') : l > 0.35 ? '8' : l > -0.25 ? 'O' : 'N';
      }
    }
    // уши
    ball(g, 14.5, 27.5, 2.6, (nx, ny, nz) => (lit(nx, ny, nz) > 0.3 ? 's' : 'S'));
    ball(g, 33.5, 27.5, 2.6, (nx, ny, nz) => (lit(nx, ny, nz) > 0.6 ? 's' : 'S'));
    put(g, 14, 27, 't'); put(g, 33, 28, 't');
    // лицо
    ball(g, 24, 27, 9.4, (nx, ny, nz, x, y) => {
      if (y > 33 && Math.abs(nx) < 0.75) return;
      const l = lit(nx, ny * 0.8, nz);
      return l > 0.72 ? 's' : l > 0.2 ? 's' : l > -0.2 ? 'S' : 't';
    });
    // тень от шляпы на лице
    for (let x = 15; x < 34; x++) { if (g[20][x] !== '.') g[20][x] = 't'; if (g[21][x] === 's') g[21][x] = 'S'; if (g[22][x] === 's' && dith(x, 22, 0.5)) g[22][x] = 'S'; }
    // шляпа (сугэгаса)
    for (let y = 2; y < 22; y++) {
      for (let x = 0; x < 48; x++) {
        const dx = x + 0.5 - 24, yy = y - 2;
        const hw = yy * 1.28 + 0.6;
        const droop = (Math.abs(dx) / 23) ** 2 * 2.5;
        const bottom = 18.5 + droop;
        if (Math.abs(dx) > hw || y > bottom || Math.abs(dx) > 23.5) continue;
        const ang = Math.atan2(dx, yy + 3);
        const stripe = Math.floor(ang * 9 + 100) % 2;
        const l = -dx / 23;
        let ch = l > 0.35 ? '7' : l > -0.15 ? 'z' : l > -0.6 ? 'y' : 'q';
        if (stripe && ch !== 'q') ch = ch === '7' ? 'z' : ch === 'z' ? 'y' : 'q';
        if (y >= bottom - 1.2) ch = l > 0.2 ? 'y' : 'q';
        if (y === 9 || y === 10) ch = y === 9 ? (l > 0 ? 'Z' : 'Z') : 'n';
        g[y][x] = ch;
      }
    }
    put(g, 24, 1, 'y'); put(g, 23, 2, 'z'); put(g, 24, 2, 'y');
    // брови (пушистые, белые, свисают)
    for (const [x, y, ch] of [[16, 22, 'O'], [17, 22, '8'], [18, 22, '8'], [19, 22, '8'], [20, 22, 'O'], [21, 23, 'N'], [15, 23, 'O'], [16, 23, 'N'],
      [27, 22, 'O'], [28, 22, '8'], [29, 22, 'O'], [30, 22, 'O'], [31, 22, 'N'], [26, 23, 'N'], [32, 23, 'N'], [31, 23, 'M']]) put(g, x, y, ch);
    // очки
    const lens = (cx, cy) => {
      for (let y = cy - 4; y <= cy + 4; y++) for (let x = cx - 4; x <= cx + 4; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d < 2.9) g[y][x] = (x - cx + y - cy < -2) ? 'D' : 'Y';
        else if (d < 3.9) g[y][x] = y < cy ? '3' : '2';
      }
    };
    lens(19, 26); lens(29, 26);
    for (const x of [23, 24, 25]) put(g, x, 25, '3');
    put(g, 14, 25, '2'); put(g, 15, 25, '3'); put(g, 33, 25, '2'); put(g, 32, 25, '3');
    // глаза за стёклами
    if (!blink) {
      for (const cx of [19, 29]) { put(g, cx - 1, 26, 'k'); put(g, cx, 26, 'k'); put(g, cx - 1, 27, 'k'); put(g, cx, 27, 'k'); put(g, cx - 1, 26, 'w'); put(g, cx - 2, 28, 'X'); put(g, cx + 1, 28, 'X'); }
    } else {
      for (const cx of [19, 29]) { put(g, cx - 2, 26, 'k'); put(g, cx - 1, 27, 'k'); put(g, cx, 27, 'k'); put(g, cx + 1, 26, 'k'); }
    }
    // блики на стёклах
    put(g, 17, 24, 'w'); put(g, 27, 24, 'w'); put(g, 18, 24, 'w');
    // нос
    ball(g, 24, 30.6, 2.4, (nx, ny, nz) => { const l = lit(nx, ny, nz); return l > 0.85 ? '8' : l > 0.35 ? 's' : 'S'; });
    put(g, 23, 32, 't'); put(g, 25, 32, 't');
    // щёки
    put(g, 16, 30, 'R'); put(g, 17, 30, 'p'); put(g, 31, 30, 'R'); put(g, 32, 30, 'R');
    // морщины
    put(g, 14, 27, 'S'); put(g, 34, 27, 'S'); put(g, 16, 29, 'S'); put(g, 32, 29, 'S');
    // усы
    for (let i = 0; i < 9; i++) {
      put(g, 23 - i, 33 + Math.floor(i * 0.5), i < 2 ? '8' : 'O'); put(g, 23 - i, 34 + Math.floor(i * 0.5), 'N');
      put(g, 24 + i, 33 + Math.floor(i * 0.5), i < 2 ? 'O' : 'N'); put(g, 24 + i, 34 + Math.floor(i * 0.5), 'M');
    }
    // рот (улыбка под усами)
    put(g, 23, 35, 't'); put(g, 24, 35, 't'); put(g, 22, 35, 'm'); put(g, 25, 35, 'm');
    outline(g, 'k');
    // подчистить: контур кимоно/бороды
    return g;
  }
  S('ui_master0', master(false), { anchor: 'tl' });
  S('ui_master1', master(true), { anchor: 'tl' });
  A.anim('ui_master', ['ui_master0', 'ui_master0', 'ui_master0', 'ui_master0', 'ui_master0', 'ui_master0', 'ui_master0', 'ui_master1'], 3);

  // ================================================================= ГЛАЗ ДЛЯ ЛОГОТИПА
  function logoEye(f) {
    const g = mk(48, 24);
    const W = 21, cx = 24, cy = 12;
    const Hs = [0, 3.4, 7.6, 8][f];
    const iris = 7.2;
    each(g, (x, y) => {
      const U = x + 0.5 - cx, V = y + 0.5 - cy, q = 1 - (U / W) ** 2;
      if (q <= 0) return;
      if (f === 0) {
        const lidY = 5 * q - 3;
        if (V >= lidY - 0.8 && V < lidY + 1.0) return 'k';
        if (V < lidY - 0.8 && V >= lidY - 0.8 - (1 + 2.5 * q)) return V < lidY - 2 - 1.5 * q ? '6' : 'x';
        return;
      }
      const up = -Hs * Math.pow(q, 0.8), dn = Hs * 0.8 * Math.pow(q, 0.9);
      const fold = 1 + 2 * q;
      if (V < up - 1.2 - fold || V > dn + 1.2) return;
      if (V < up - 1.2) return V < up - 1.2 - fold * 0.5 ? '6' : 'x';
      if (V < up + 0.8 || V > dn - 0.4) return 'k';
      const ir = Math.hypot(U, V + 0.3);
      if (ir < iris) {
        if (ir < (f === 3 ? 1.9 : 2.5) && Math.abs(U) < 1.6) return '0';
        if (ir > iris - 1) return 'a';
        const ang = Math.atan2(V, U);
        const rad = Math.floor((ang + Math.PI) * 4.5) % 2 === 0;
        const l = -(U * 0.6 + V * 0.8) / iris;
        if (f === 3) return l > 0.15 ? 'e' : rad ? 'd' : 'c';
        return l > 0.35 ? 'd' : rad && ir > 3.5 ? 'b' : 'c';
      }
      if (V < up + 2.2) return 'N';
      return U > 7 || V > dn - 1.6 ? 'O' : '8';
    });
    if (f === 0) {
      // ресницы
      for (const U of [-13, -7, 0, 7, 13]) {
        const x = Math.floor(cx + U), q = 1 - (U / W) ** 2, y = Math.floor(cy + 5 * q - 3 + 1.0);
        const sx = U < 0 ? -1 : U > 0 ? 1 : 0;
        put(g, x, y, 'k'); put(g, x + sx, y + 1, 'k'); put(g, x + sx, y + 2, 'k');
      }
    }
    if (f >= 2) for (const [x, y] of [[21, 8], [22, 8], [21, 9], [27, 14]]) if (g[y][x] !== 'k' && g[y][x] !== '.') put(g, x, y, 'w');
    if (f === 3) {
      const rays = [[0, 12, 1, 0, 3], [47, 12, -1, 0, 3], [24, 0, 0, 1, 2], [9, 2, 1, 1, 2], [38, 2, -1, 1, 2], [9, 21, 1, -1, 2], [38, 21, -1, -1, 2], [24, 23, 0, -1, 1]];
      for (const [x0, y0, dx, dy, n] of rays) for (let k = 0; k < n; k++) { const X = x0 + dx * k, Y = y0 + dy * k; if (at(g, X, Y) === '.') put(g, X, Y, k === n - 1 ? 'e' : 'c'); }
    }
    return g;
  }
  for (let f = 0; f < 4; f++) S('ui_logo_eye' + f, logoEye(f), { ox: 24, oy: 12 });
  A.anim('ui_logo_eye', ['ui_logo_eye0', 'ui_logo_eye1', 'ui_logo_eye2', 'ui_logo_eye3'], 6, false);
})();
