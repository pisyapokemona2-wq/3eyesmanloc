'use strict';
// Реестр пиксельных спрайтов. Спрайт задаётся массивом строк, где каждый символ —
// индекс в палитре ('.' и ' ' — прозрачный). Холсты строятся лениво при первом обращении.
(function () {
  const G = (window.G = window.G || {});
  const pals = {}, defs = {}, anims = {}, built = {};
  const A = (G.Art = { pals, defs, anims, errors: [] });

  A.pal = (name, map) => { pals[name] = Object.assign({}, pals[name] || {}, map); };
  // opts: ox, oy — точка привязки (по умолчанию низ-центр); anchor: 'tl' — левый верхний угол
  A.sprite = (name, pal, rows, opts = {}) => {
    if (defs[name]) A.errors.push('Повтор имени спрайта: ' + name);
    defs[name] = { name, pal, rows, opts };
  };
  A.anim = (name, frames, fps = 8, loop = true) => { anims[name] = { name, frames, fps, loop }; };
  A.has = (name) => !!defs[name];

  function palOf(d) { return typeof d.pal === 'string' ? pals[d.pal] : d.pal; }
  function hex(c) {
    if (c.length === 4) c = '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
    const n = parseInt(c.slice(1, 7), 16);
    const a = c.length === 9 ? parseInt(c.slice(7, 9), 16) : 255;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
  }
  function build(name) {
    const d = defs[name];
    if (!d) return null;
    const p = palOf(d) || {};
    const h = d.rows.length, w = Math.max(...d.rows.map((r) => r.length));
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const c = cv.getContext('2d');
    const img = c.createImageData(w, h);
    const memo = {};
    for (let y = 0; y < h; y++) {
      const row = d.rows[y];
      for (let x = 0; x < w; x++) {
        const ch = row[x];
        if (ch === undefined || ch === '.' || ch === ' ') continue;
        let col = memo[ch];
        if (!col) {
          if (!p[ch]) { A.errors.push(`${name}: символ '${ch}' нет в палитре`); col = [255, 0, 255, 255]; }
          else col = hex(p[ch]);
          memo[ch] = col;
        }
        const i = (y * w + x) * 4;
        img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = col[3];
      }
    }
    c.putImageData(img, 0, 0);
    const o = d.opts;
    const tl = o.anchor === 'tl';
    const s = { name, img: cv, w, h, ox: o.ox !== undefined ? o.ox : tl ? 0 : Math.floor(w / 2), oy: o.oy !== undefined ? o.oy : tl ? 0 : h, flip: null, white: null };
    built[name] = s;
    return s;
  }
  A.get = (name) => built[name] || build(name);
  function flipped(s) {
    if (!s.flip) {
      const cv = document.createElement('canvas');
      cv.width = s.w; cv.height = s.h;
      const c = cv.getContext('2d');
      c.translate(s.w, 0); c.scale(-1, 1); c.drawImage(s.img, 0, 0);
      s.flip = cv;
    }
    return s.flip;
  }
  // белый силуэт для вспышки при попадании
  A.white = (name, flip) => {
    const s = A.get(name);
    if (!s) return null;
    const key = flip ? 'whiteF' : 'white';
    if (!s[key]) {
      const cv = document.createElement('canvas');
      cv.width = s.w; cv.height = s.h;
      const c = cv.getContext('2d');
      c.drawImage(flip ? flipped(s) : s.img, 0, 0);
      c.globalCompositeOperation = 'source-in';
      c.fillStyle = '#ffffff';
      c.fillRect(0, 0, s.w, s.h);
      s[key] = cv;
    }
    return s[key];
  };
  // Отрисовка с учётом точки привязки; flip — зеркально по горизонтали
  A.draw = (ctx, name, x, y, flip = false, white = false) => {
    const s = A.get(name);
    if (!s) return;
    const img = white ? A.white(name, flip) : flip ? flipped(s) : s.img;
    const ax = flip ? s.w - s.ox : s.ox;
    ctx.drawImage(img, Math.round(x - ax), Math.round(y - s.oy));
  };
  // Кадр анимации по времени в кадрах (60 в секунду)
  A.frame = (animName, t) => {
    const a = anims[animName];
    if (!a) return animName;
    const i = Math.floor((t * a.fps) / 60);
    return a.frames[a.loop ? i % a.frames.length : Math.min(i, a.frames.length - 1)];
  };
  A.animDone = (animName, t) => {
    const a = anims[animName];
    return !a || Math.floor((t * a.fps) / 60) >= a.frames.length;
  };
  A.size = (name) => { const s = A.get(name); return s ? [s.w, s.h] : [0, 0]; };
})();
