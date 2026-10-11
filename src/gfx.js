'use strict';
// Пиксельный конвейер: вся сцена рисуется в буфер 480×270 без сглаживания,
// затем буфер выводится на экран с целым масштабом (на 1080p — ровно ×4).
G.Gfx = (() => {
  const X = {};
  const screen = document.getElementById('game');
  const sctx = screen.getContext('2d');
  const buf = document.createElement('canvas');
  buf.width = G.W;
  buf.height = G.H;
  const ctx = buf.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  X.canvas = screen;
  X.buf = buf;
  X.ctx = ctx;
  X.scale = 1;
  X.offX = 0;
  X.offY = 0;

  X.resize = () => {
    const dpr = window.devicePixelRatio || 1;
    const cw = window.innerWidth, ch = window.innerHeight;
    screen.width = Math.floor(cw * dpr);
    screen.height = Math.floor(ch * dpr);
    screen.style.width = cw + 'px';
    screen.style.height = ch + 'px';
    const fit = Math.min(screen.width / G.W, screen.height / G.H);
    // целый масштаб, если он не слишком мельчит картинку
    X.scale = fit >= 2 ? Math.floor(fit) : fit;
    X.offX = Math.floor((screen.width - G.W * X.scale) / 2);
    X.offY = Math.floor((screen.height - G.H * X.scale) / 2);
    sctx.imageSmoothingEnabled = false;
  };
  window.addEventListener('resize', X.resize);
  X.resize();

  X.present = () => {
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.fillStyle = '#000';
    sctx.fillRect(0, 0, screen.width, screen.height);
    sctx.imageSmoothingEnabled = false;
    sctx.drawImage(buf, X.offX, X.offY, G.W * X.scale, G.H * X.scale);
  };

  X.screen = () => ctx.setTransform(1, 0, 0, 1, 0, 0);
  X.world = (camX, camY) => ctx.setTransform(1, 0, 0, 1, -Math.round(camX), -Math.round(camY));

  X.rect = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };

  // --- Свечение: заранее отрисованные радиальные пятна с полосами (без сглаживания) ---
  const glows = {};
  X.glow = (x, y, r, color, a = 1) => {
    r = Math.max(2, Math.round(r));
    const key = color + r;
    let g = glows[key];
    if (!g) {
      g = document.createElement('canvas');
      g.width = g.height = r * 2;
      const c = g.getContext('2d');
      const [cr, cg, cb] = G.hexToRgb(color);
      const img = c.createImageData(r * 2, r * 2);
      for (let yy = 0; yy < r * 2; yy++) for (let xx = 0; xx < r * 2; xx++) {
        const d = Math.hypot(xx + 0.5 - r, yy + 0.5 - r) / r;
        if (d >= 1) continue;
        // ступенчатое затухание — «пиксельный» ореол
        const k = Math.ceil((1 - d) * 4) / 4;
        const i = (yy * r * 2 + xx) * 4;
        img.data[i] = cr; img.data[i + 1] = cg; img.data[i + 2] = cb; img.data[i + 3] = Math.round(k * k * 150);
      }
      c.putImageData(img, 0, 0);
      glows[key] = g;
    }
    const prev = ctx.globalCompositeOperation, pa = ctx.globalAlpha;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = pa * a;
    ctx.drawImage(g, Math.round(x - r), Math.round(y - r));
    ctx.globalCompositeOperation = prev;
    ctx.globalAlpha = pa;
  };

  // --- Текст: собственный битовый шрифт (src/font.js), одинаково чёткий везде ---
  const textCache = new Map();
  const glyphOf = (c) => G.FONT[c] || G.FONT[c.toUpperCase()] || G.FONT['?'];
  function measure(str) {
    let w = 0;
    for (const c of str) w += glyphOf(c).w + 1;
    return Math.max(0, w - 1);
  }
  function glyphs(str, color) {
    const key = color + '|' + str;
    let img = textCache.get(key);
    if (img) return img;
    const w = measure(str) + 2, h = 12;
    img = document.createElement('canvas');
    img.width = Math.max(1, w); img.height = h;
    const c = img.getContext('2d');
    c.fillStyle = color;
    let x = 1;
    for (const ch of str) {
      const gl = glyphOf(ch);
      for (let r = 0; r < gl.rows.length; r++) {
        const row = gl.rows[r];
        for (let i = 0; i < row.length; i++) if (row[i] === '#') c.fillRect(x + i, 1 + gl.top + r, 1, 1);
      }
      x += gl.w + 1;
    }
    if (textCache.size > 800) textCache.clear();
    textCache.set(key, img);
    return img;
  }
  X.textWidth = (str) => measure(String(str));
  // opts: color, align ('left'|'center'|'right'), shadow (цвет или false), outline (цвет), scale (1|2), alpha
  X.text = (str, x, y, o = {}) => {
    str = String(str);
    const sc = o.scale || 1;
    const img = glyphs(str, o.color || '#ffffff');
    const w = (img.width - 2) * sc;
    let dx = Math.round(o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x) - sc;
    const dy = Math.round(y) - sc;
    const pa = ctx.globalAlpha;
    if (o.alpha !== undefined) ctx.globalAlpha = pa * o.alpha;
    const dw = img.width * sc, dh = img.height * sc;
    if (o.outline) {
      const ol = glyphs(str, o.outline);
      for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) ctx.drawImage(ol, dx + ox * sc, dy + oy * sc, dw, dh);
    }
    if (o.shadow !== false) {
      const sh = glyphs(str, o.shadow || '#120a1c');
      ctx.drawImage(sh, dx + sc, dy + sc, dw, dh);
    }
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.globalAlpha = pa;
    return w;
  };

  // 9-slice рамка из ui_frame_* (8×8 каждая часть)
  X.frame = (x, y, w, h) => {
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    const A = G.Art;
    if (!A.has('ui_frame_c')) {
      X.rect(x, y, w, h, '#140c22');
      ctx.strokeStyle = '#e8b84a'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      return;
    }
    const part = (n) => A.get('ui_frame_' + n).img;
    for (let yy = y + 8; yy < y + h - 8; yy += 8) {
      const hh = Math.min(8, y + h - 8 - yy);
      ctx.drawImage(part('l'), 0, 0, 8, hh, x, yy, 8, hh);
      ctx.drawImage(part('r'), 0, 0, 8, hh, x + w - 8, yy, 8, hh);
      for (let xx = x + 8; xx < x + w - 8; xx += 8) {
        const ww = Math.min(8, x + w - 8 - xx);
        ctx.drawImage(part('c'), 0, 0, ww, hh, xx, yy, ww, hh);
      }
    }
    for (let xx = x + 8; xx < x + w - 8; xx += 8) {
      const ww = Math.min(8, x + w - 8 - xx);
      ctx.drawImage(part('t'), 0, 0, ww, 8, xx, y, ww, 8);
      ctx.drawImage(part('b'), 0, 0, ww, 8, xx, y + h - 8, ww, 8);
    }
    ctx.drawImage(part('tl'), x, y);
    ctx.drawImage(part('tr'), x + w - 8, y);
    ctx.drawImage(part('bl'), x, y + h - 8);
    ctx.drawImage(part('br'), x + w - 8, y + h - 8);
  };

  // Отрисовка спрайта (обёртка над G.Art с заглушкой для отсутствующих)
  const warned = new Set();
  X.spr = (name, x, y, flip = false, white = false) => {
    if (!G.Art.has(name)) {
      if (!warned.has(name)) { warned.add(name); console.warn('нет спрайта', name); }
      ctx.fillStyle = '#ff00ff';
      ctx.fillRect(Math.round(x) - 4, Math.round(y) - 8, 8, 8);
      return;
    }
    G.Art.draw(ctx, name, x, y, flip, white);
  };
  X.missing = () => [...warned];
  return X;
})();
