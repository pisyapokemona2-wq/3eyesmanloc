'use strict';
// Отрисовка тайлов по темам. Статичные тайлы кэшируются в масштабе экрана,
// анимированные (бонус-блоки, лава, осыпающиеся плиты) рисуются каждый кадр.
G.Tiles = (() => {
  const PAL = {
    city: { base: '#5e4f66', dark: '#3a2f45', light: '#8b7896', top: '#c9b6a0', top2: '#e8d8b8', brick: '#b0503e', plat: '#c8463a', plat2: '#7a2a2a', spike: '#c8ccd8', accent: '#ffcc33', lava: '#7cff4a', lava2: '#2a9a20', outline: '#1a1224' },
    ruins: { base: '#7a6c52', dark: '#4c4232', light: '#a8977a', top: '#5fae48', top2: '#a8e070', brick: '#9a8456', plat: '#9a6436', plat2: '#5a3618', spike: '#d8d0b8', accent: '#e8c040', lava: '#58e0ff', lava2: '#1a6aa0', outline: '#1e1a12' },
    cave: { base: '#3e3460', dark: '#231c3c', light: '#5e5290', top: '#7a6cb0', top2: '#b8a8f0', brick: '#5a4a86', plat: '#6a5a96', plat2: '#2e2450', spike: '#b8f4ff', accent: '#5ef0ff', lava: '#a040ff', lava2: '#4a1080', outline: '#0e0a1c' },
    volcano: { base: '#3e2a28', dark: '#1e1414', light: '#5e403a', top: '#6e4a3c', top2: '#a0705a', brick: '#6e3a2a', plat: '#5a4440', plat2: '#2a1e1c', spike: '#c8b8b0', accent: '#ff7a20', lava: '#ff8a20', lava2: '#d0300a', outline: '#120a0a' },
    temple: { base: '#6e5e94', dark: '#43386a', light: '#9a8abf', top: '#e8c064', top2: '#fff0b0', brick: '#9478b8', plat: '#d8b058', plat2: '#806020', spike: '#f0e0ff', accent: '#ff70d0', lava: '#ff50c0', lava2: '#801870', outline: '#160e24' },
  };
  const cache = new Map();
  let cacheVer = -1;

  const S = {};
  S.pal = (theme) => PAL[theme] || PAL.city;

  function drawSolid(c, P, theme, mask, v, tx, ty) {
    const up = mask & 1, rt = mask & 2, dn = mask & 4, lf = mask & 8;
    const r = G.rng(Math.floor(v * 1e6) + 7);
    c.fillStyle = P.base;
    c.fillRect(0, 0, 16, 16);
    // фактура
    if (theme === 'city') {
      c.fillStyle = P.dark;
      c.fillRect(0, 7, 16, 1);
      c.fillRect(((tx + ty) % 2) * 8, 0, 1, 7);
      c.fillRect(((tx + ty + 1) % 2) * 8, 8, 1, 8);
      c.fillStyle = P.light;
      c.fillRect(0, 8, 16, 0.6);
      if (v < 0.3) { c.fillStyle = '#ffd86a'; c.globalAlpha = 0.5; c.fillRect(3, 10, 3, 3); c.globalAlpha = 1; }
    } else if (theme === 'ruins' || theme === 'temple') {
      const off = (ty % 2) * 8;
      c.fillStyle = P.dark;
      c.fillRect(0, 7.5, 16, 1);
      c.fillRect(off, 0, 1, 7.5);
      c.fillRect((off + 8) % 16, 8, 1, 8);
      c.fillStyle = P.light;
      c.globalAlpha = 0.5;
      c.fillRect(1, 0.5, 6, 1); c.fillRect(9, 8.5, 6, 1);
      c.globalAlpha = 1;
      if (theme === 'temple' && v < 0.25) {
        c.fillStyle = P.top; c.fillRect(6, 3, 4, 2); c.fillRect(7, 2, 2, 4);
      }
      if (theme === 'ruins' && v < 0.2) { c.fillStyle = '#4a8a3a'; c.fillRect(r() * 10, 10 + r() * 4, 4, 2); }
    } else if (theme === 'cave') {
      for (let i = 0; i < 4; i++) {
        c.fillStyle = i % 2 ? P.dark : P.light;
        c.globalAlpha = 0.6;
        c.beginPath();
        c.ellipse(r() * 16, r() * 16, 2 + r() * 3, 1.5 + r() * 2, r() * 3, 0, Math.PI * 2);
        c.fill();
      }
      c.globalAlpha = 1;
      if (v < 0.12) { c.fillStyle = P.accent; c.globalAlpha = 0.8; c.beginPath(); c.moveTo(8, 6); c.lineTo(10, 10); c.lineTo(8, 13); c.lineTo(6, 10); c.fill(); c.globalAlpha = 1; }
    } else if (theme === 'volcano') {
      c.strokeStyle = P.dark;
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(0, 5 + r() * 4); c.lineTo(6 + r() * 3, 8); c.lineTo(16, 4 + r() * 6);
      c.moveTo(8, 8); c.lineTo(7 + r() * 3, 16);
      c.stroke();
      if (v < 0.25) {
        c.strokeStyle = P.accent; c.lineWidth = 0.8; c.globalAlpha = 0.9;
        c.beginPath(); c.moveTo(2, 12); c.lineTo(6, 10); c.lineTo(9, 13); c.stroke();
        c.globalAlpha = 1;
      }
    }
    // грани
    if (lf) { c.fillStyle = G.rgba(P.light, 0.55); c.fillRect(0, 0, 1.5, 16); }
    if (rt) { c.fillStyle = G.rgba(P.dark, 0.9); c.fillRect(14.5, 0, 1.5, 16); }
    if (dn) { c.fillStyle = P.dark; c.fillRect(0, 13.5, 16, 2.5); c.fillStyle = P.outline; c.fillRect(0, 15.2, 16, 0.8); }
    if (!up) {
      // затемнение в глубину
      c.fillStyle = 'rgba(0,0,0,0.12)';
      c.fillRect(0, 0, 16, 16);
    }
    if (up) {
      if (theme === 'city') {
        c.fillStyle = P.top; c.fillRect(0, 0, 16, 4);
        c.fillStyle = P.top2; c.fillRect(0, 0, 16, 1.2);
        c.fillStyle = '#2a2230';
        for (let i = 0; i < 16; i += 4) { c.beginPath(); c.moveTo(i, 4); c.lineTo(i + 2, 4); c.lineTo(i + 4, 2.2); c.lineTo(i + 2, 2.2); c.fill(); }
        c.fillStyle = P.accent; c.globalAlpha = 0.85;
        for (let i = 2; i < 18; i += 4) { c.beginPath(); c.moveTo(i, 4); c.lineTo(i + 2, 4); c.lineTo(i + 4, 2.2); c.lineTo(i + 2, 2.2); c.fill(); }
        c.globalAlpha = 1;
      } else if (theme === 'ruins') {
        c.fillStyle = P.top; c.fillRect(0, 0, 16, 4);
        c.fillStyle = P.top2; c.fillRect(0, 0, 16, 1.2);
        c.fillStyle = P.top;
        for (let i = 0; i < 5; i++) { const x = r() * 16; c.beginPath(); c.moveTo(x - 1.5, 4); c.lineTo(x, 5.5 + r() * 3); c.lineTo(x + 1.5, 4); c.fill(); }
      } else if (theme === 'cave') {
        c.fillStyle = P.top; c.fillRect(0, 0, 16, 3);
        c.fillStyle = P.top2; c.fillRect(0, 0, 16, 1);
      } else if (theme === 'volcano') {
        c.fillStyle = P.top; c.fillRect(0, 0, 16, 3.5);
        c.fillStyle = P.top2; c.fillRect(0, 0, 16, 1);
        c.fillStyle = 'rgba(255,120,40,0.35)'; c.fillRect(0, 1, 16, 0.8);
      } else {
        c.fillStyle = P.top; c.fillRect(0, 0, 16, 4);
        c.fillStyle = P.top2; c.fillRect(0, 0, 16, 1.2);
        c.fillStyle = P.plat2; c.fillRect(0, 3.4, 16, 0.6);
        c.fillStyle = P.top2; c.fillRect(7, 1.6, 2, 1.2);
      }
      c.fillStyle = P.outline; c.fillRect(0, 0, 16, 0.6);
    }
    if (lf && up) { c.fillStyle = P.outline; c.fillRect(0, 0, 0.6, 16); }
    if (rt) { c.fillStyle = P.outline; c.fillRect(15.4, 0, 0.6, 16); }
    if (lf && !up) { c.fillStyle = P.outline; c.fillRect(0, 0, 0.6, 16); }
  }

  function drawBrick(c, P) {
    c.fillStyle = G.shade(P.brick, -0.45);
    c.fillRect(0, 0, 16, 16);
    const rows = [[0, 0, 7.5, 3.5], [8, 0, 7.5, 3.5], [-4, 4, 7.5, 3.5], [4, 4, 7.5, 3.5], [12, 4, 7.5, 3.5], [0, 8, 7.5, 3.5], [8, 8, 7.5, 3.5], [-4, 12, 7.5, 3.5], [4, 12, 7.5, 3.5], [12, 12, 7.5, 3.5]];
    for (const [x, y, w, h] of rows) {
      c.fillStyle = P.brick; c.fillRect(x + 0.5, y + 0.5, w, h);
      c.fillStyle = G.shade(P.brick, 0.25); c.fillRect(x + 0.5, y + 0.5, w, 1);
      c.fillStyle = G.shade(P.brick, -0.2); c.fillRect(x + 0.5, y + h - 0.5, w, 1);
    }
    c.strokeStyle = P.outline; c.lineWidth = 0.8; c.strokeRect(0.4, 0.4, 15.2, 15.2);
  }

  function drawOneway(c, P, theme) {
    c.fillStyle = P.plat2;
    c.fillRect(0, 0, 16, 6);
    c.fillStyle = P.plat;
    c.fillRect(0, 0, 16, 4.5);
    c.fillStyle = G.shade(P.plat, 0.3);
    c.fillRect(0, 0, 16, 1.2);
    if (theme === 'city' || theme === 'volcano') {
      c.fillStyle = P.plat2;
      c.beginPath(); c.arc(4, 2.6, 1.1, 0, 7); c.arc(12, 2.6, 1.1, 0, 7); c.fill();
      // фермы
      c.strokeStyle = G.rgba(P.plat2, 0.8); c.lineWidth = 1;
      c.beginPath(); c.moveTo(0, 6); c.lineTo(8, 11); c.lineTo(16, 6); c.stroke();
    } else {
      c.fillStyle = P.plat2;
      c.fillRect(7.6, 0, 0.8, 4.5);
      c.fillRect(2, 1.8, 2, 0.6); c.fillRect(11, 2.5, 3, 0.6);
    }
    c.fillStyle = P.outline; c.fillRect(0, 0, 16, 0.6); c.fillRect(0, 5.6, 16, 0.6);
  }

  function drawSpike(c, P, down) {
    c.save();
    if (down) { c.translate(0, 16); c.scale(1, -1); }
    c.fillStyle = G.shade(P.spike, -0.5);
    c.fillRect(0, 13, 16, 3);
    for (let i = 0; i < 4; i++) {
      const x = i * 4;
      c.beginPath(); c.moveTo(x, 13.5); c.lineTo(x + 2, 3); c.lineTo(x + 4, 13.5); c.closePath();
      c.fillStyle = P.spike; c.fill();
      c.lineWidth = 0.7; c.strokeStyle = P.outline; c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.7)';
      c.beginPath(); c.moveTo(x + 1.2, 12); c.lineTo(x + 2, 4.5); c.lineTo(x + 2, 12); c.fill();
    }
    c.restore();
  }

  function drawUsed(c, P) {
    c.fillStyle = G.shade(P.dark, 0.1);
    G.Gfx.rr(c, 0.5, 0.5, 15, 15, 2.5); c.fill();
    c.strokeStyle = P.outline; c.lineWidth = 0.9; c.stroke();
    c.fillStyle = G.shade(P.dark, 0.3);
    c.fillRect(2, 2, 12, 1);
    c.fillStyle = P.outline;
    for (const [x, y] of [[3, 3], [13, 3], [3, 13], [13, 13]]) { c.beginPath(); c.arc(x, y, 0.9, 0, 7); c.fill(); }
  }

  function drawGate(c, P) {
    c.fillStyle = 'rgba(20,10,30,0.6)';
    c.fillRect(0, 0, 16, 16);
    c.fillStyle = '#5a5a6a';
    for (let x = 2; x < 16; x += 5) { c.fillRect(x, 0, 2.4, 16); }
    c.fillStyle = '#9a9aaa';
    for (let x = 2; x < 16; x += 5) { c.fillRect(x, 0, 0.8, 16); }
    c.fillStyle = '#3a3a48'; c.fillRect(0, 6, 16, 2.5);
  }

  function getCached(key, fn) {
    let cv = cache.get(key);
    if (!cv) {
      cv = G.Gfx.makeCanvas(16, 16, fn);
      cache.set(key, cv);
    }
    return cv;
  }

  function maskOf(level, tx, ty, t) {
    const open = (x, y) => {
      const n = level.get(x, y);
      return n !== G.T.SOLID && n !== G.T.GATE && !(t === G.T.SOLID && n === G.T.USED && false);
    };
    return (open(tx, ty - 1) ? 1 : 0) | (open(tx + 1, ty) ? 2 : 0) | (open(tx, ty + 1) ? 4 : 0) | (open(tx - 1, ty) ? 8 : 0);
  }

  // Слой статичных тайлов — рисуется без мировой трансформации,
  // в целых физических пикселях, чтобы не было щелей между тайлами.
  S.drawLayer = (level, camX, camY) => {
    const X = G.Gfx, c = X.ctx, s = X.scale;
    if (cacheVer !== X.version) { cache.clear(); cacheVer = X.version; }
    const P = S.pal(level.theme);
    const theme = level.theme;
    const bx = Math.round(X.offX - camX * s), by = Math.round(X.offY - camY * s);
    const tx0 = Math.max(0, Math.floor(camX / 16)), tx1 = Math.min(level.w - 1, Math.floor((camX + G.W) / 16));
    const ty0 = Math.max(0, Math.floor(camY / 16)), ty1 = Math.min(level.h - 1, Math.floor((camY + G.H) / 16));
    c.setTransform(1, 0, 0, 1, 0, 0);
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const t = level.tiles[ty * level.w + tx];
        if (!t || t === G.T.BONUS || t === G.T.CRUMBLE || t === G.T.LAVA) continue;
        let img;
        if (t === G.T.SOLID) {
          const m = maskOf(level, tx, ty, t);
          const v = Math.floor(G.hash2(tx, ty) * 8) / 8;
          img = getCached(`${theme}s${m}_${v}_${(tx + ty) % 2}_${ty % 2}`, (cc) => drawSolid(cc, P, theme, m, v, tx, ty));
        } else if (t === G.T.BRICK) img = getCached(theme + 'b', (cc) => drawBrick(cc, P));
        else if (t === G.T.ONEWAY) img = getCached(theme + 'o', (cc) => drawOneway(cc, P, theme));
        else if (t === G.T.SPIKE) img = getCached(theme + '^', (cc) => drawSpike(cc, P, false));
        else if (t === G.T.SPIKE_DOWN) img = getCached(theme + 'v', (cc) => drawSpike(cc, P, true));
        else if (t === G.T.USED) img = getCached(theme + 'u', (cc) => drawUsed(cc, P));
        else if (t === G.T.GATE) img = getCached('gate', (cc) => drawGate(cc, P));
        if (!img) continue;
        const x0 = bx + Math.round(tx * 16 * s), x1 = bx + Math.round((tx + 1) * 16 * s);
        const y0 = by + Math.round(ty * 16 * s), y1 = by + Math.round((ty + 1) * 16 * s);
        const bump = t === G.T.USED ? (level.bump.get(ty * level.w + tx) || 0) : 0;
        const dy = bump ? Math.round(-Math.sin((bump / 10) * Math.PI) * 4 * s) : 0;
        c.drawImage(img, x0, y0 + dy, x1 - x0, y1 - y0);
      }
    }
  };

  // Анимированные тайлы — в мировых координатах
  S.drawAnimated = (c, level, camX, camY, time) => {
    const P = S.pal(level.theme);
    const tx0 = Math.max(0, Math.floor(camX / 16)), tx1 = Math.min(level.w - 1, Math.floor((camX + G.W) / 16));
    const ty0 = Math.max(0, Math.floor(camY / 16)), ty1 = Math.min(level.h - 1, Math.floor((camY + G.H) / 16));
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const t = level.tiles[ty * level.w + tx];
        const x = tx * 16, y = ty * 16;
        if (t === G.T.BONUS) {
          const sh = (Math.sin(time * 4 + tx) + 1) / 2;
          c.save();
          c.translate(x, y);
          c.fillStyle = '#7a4a10';
          G.Gfx.rr(c, 0.5, 0.5, 15, 15, 2.5); c.fill();
          c.fillStyle = G.mix('#e8a020', '#ffd860', sh);
          G.Gfx.rr(c, 0.5, 0.5, 15, 14, 2.5); c.fill();
          c.strokeStyle = '#3a2008'; c.lineWidth = 0.9; G.Gfx.rr(c, 0.5, 0.5, 15, 15, 2.5); c.stroke();
          c.fillStyle = '#fff6c0'; c.fillRect(2, 1.6, 12, 1);
          // символ — глаз
          const blink = Math.sin(time * 2 + tx * 1.3) > 0.97 ? 0.15 : 1;
          G.Gfx.ellipse(c, 8, 8, 5, 3.2 * blink, 0, '#fff8e0', '#3a2008', 0.8);
          if (blink > 0.5) { G.Gfx.circle(c, 8, 8, 2, '#3aa040'); G.Gfx.circle(c, 8, 8, 1, '#102010'); G.Gfx.circle(c, 7.3, 7.3, 0.5, '#fff'); }
          c.restore();
        } else if (t === G.T.CRUMBLE) {
          const cr = level.crumble.get(ty * level.w + tx);
          const k = cr ? Math.min(1, cr.t / 44) : 0;
          const ox = cr ? Math.sin(cr.t * 1.7) * k * 1.5 : 0;
          c.save();
          c.translate(x + ox, y + k * 2);
          c.fillStyle = P.dark; c.fillRect(0, 0, 16, 9);
          c.fillStyle = P.light; c.fillRect(0, 0, 16, 7);
          c.fillStyle = P.top2; c.fillRect(0, 0, 16, 1.2);
          c.strokeStyle = P.outline; c.lineWidth = 0.8;
          c.beginPath(); c.moveTo(5, 0); c.lineTo(7, 4); c.lineTo(5, 9); c.moveTo(11, 0); c.lineTo(10, 5); c.lineTo(12, 9); c.stroke();
          c.strokeRect(0.4, 0.4, 15.2, 8.2);
          c.restore();
        } else if (t === G.T.LAVA) {
          const surface = level.get(tx, ty - 1) !== G.T.LAVA;
          c.fillStyle = P.lava2;
          c.fillRect(x, y, 16.5, 16.5);
          if (surface) {
            c.fillStyle = P.lava;
            c.beginPath();
            c.moveTo(x, y + 16);
            for (let i = 0; i <= 16; i += 2) c.lineTo(x + i, y + 3 + Math.sin(time * 3 + (x + i) * 0.25) * 1.6);
            c.lineTo(x + 16, y + 16);
            c.fill();
            c.fillStyle = G.shade(P.lava, 0.5);
            for (let i = 0; i <= 16; i += 4) c.fillRect(x + i, y + 2.2 + Math.sin(time * 3 + (x + i) * 0.25) * 1.6, 2, 1);
          } else {
            const b = Math.sin(time * 2 + tx * 0.7 + ty) * 0.5 + 0.5;
            c.fillStyle = G.rgba(P.lava, 0.25 + b * 0.25);
            c.beginPath(); c.arc(x + 8 + Math.sin(tx) * 3, y + 8, 3 + b * 2, 0, 7); c.fill();
          }
        }
      }
    }
  };

  // Декор на поверхности: трава, кристаллы, тлеющие угли
  S.drawDeco = (c, level, camX, time) => {
    const P = S.pal(level.theme);
    for (const d of level.deco) {
      if (d.x < camX - 20 || d.x > camX + G.W + 20) continue;
      if (level.get(Math.floor(d.x / 16), Math.floor(d.y / 16) - 1) !== G.T.EMPTY) continue;
      if (!level.isSolid(Math.floor(d.x / 16), Math.floor(d.y / 16))) continue;
      if (d.kind === 'tuft') {
        const sway = Math.sin(time * 2 + d.x * 0.1) * 1.2;
        c.strokeStyle = level.theme === 'city' ? '#6a8a4a' : level.theme === 'volcano' ? '#4a3a30' : level.theme === 'temple' ? '#c0a0e0' : P.top2;
        c.lineWidth = 1;
        c.beginPath();
        for (let i = -2; i <= 2; i++) {
          c.moveTo(d.x + i * 1.4, d.y);
          c.quadraticCurveTo(d.x + i * 1.6, d.y - 3 * d.s, d.x + i * 2 + sway, d.y - (4 + Math.abs(i)) * d.s);
        }
        c.stroke();
        if (d.v < 0.25 && level.theme !== 'volcano') {
          G.Gfx.circle(c, d.x + sway, d.y - 6 * d.s, 1.3, d.v < 0.12 ? '#ff6a8a' : '#fff07a');
        }
      } else if (d.kind === 'crystal') {
        const glow = 0.6 + Math.sin(time * 2 + d.x) * 0.3;
        const col = d.hue < 0.5 ? '#5ef0ff' : '#ff6af0';
        G.Gfx.glow(c, d.x, d.y - 6, 18 * d.s, col, 0.35 * glow);
        c.save();
        c.translate(d.x, d.y);
        c.scale(d.s, d.s);
        for (const [ox, h, a] of [[-3, 9, -0.35], [0, 14, 0], [3.5, 8, 0.4]]) {
          c.save();
          c.rotate(a);
          c.beginPath();
          c.moveTo(ox - 2, 0); c.lineTo(ox - 2, -h + 3); c.lineTo(ox, -h); c.lineTo(ox + 2, -h + 3); c.lineTo(ox + 2, 0);
          c.closePath();
          c.fillStyle = G.rgba(col, 0.85); c.fill();
          c.strokeStyle = '#0e0a1c'; c.lineWidth = 0.6; c.stroke();
          c.fillStyle = 'rgba(255,255,255,0.7)'; c.fillRect(ox - 1.2, -h + 3, 0.8, h - 4);
          c.restore();
        }
        c.restore();
      } else if (d.kind === 'ember') {
        const g = 0.5 + Math.sin(time * 3 + d.x) * 0.5;
        G.Gfx.glow(c, d.x, d.y - 1, 8, '#ff7a20', 0.5 * g);
        G.Gfx.circle(c, d.x, d.y - 0.5, 1.2, '#ffd080');
      }
    }
  };
  return S;
})();
