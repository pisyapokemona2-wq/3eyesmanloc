'use strict';
// Параллакс-фоны: каждый слой рисуется процедурно в бесшовную полосу
// и кэшируется в разрешении экрана.
G.Backgrounds = (() => {
  const B = {};
  const LW = 960; // ширина бесшовного слоя
  let cache = {}, ver = -1;

  const themes = {
    city: {
      sky: [[0, '#140b2e'], [0.4, '#3d1d58'], [0.68, '#b13f6a'], [0.86, '#ff8a5a'], [1, '#ffcf7a']],
      layers: [
        { f: 0, draw: (c, r) => sun(c, 480, 230, 70, '#ffe28a', '#ff6a7a') },
        { f: 0.08, draw: (c, r) => skyline(c, r, 250, 40, 110, '#4a2558', 0.15, '#ff9ab0') },
        { f: 0.2, draw: (c, r) => skyline(c, r, 270, 60, 170, '#2c1640', 0.4, '#ffd27a') },
        { f: 0.42, draw: (c, r) => cranes(c, r, '#160b22') },
      ],
      stars: 80,
    },
    ruins: {
      sky: [[0, '#2a6a8a'], [0.45, '#5aa8b0'], [0.75, '#c8e0b0'], [1, '#f0e8b8']],
      layers: [
        { f: 0, draw: (c, r) => { sun(c, 700, 90, 34, '#fffbe0', '#fff2a0', false); clouds(c, r, 6, 'rgba(255,255,255,0.55)', 40, 150); } },
        { f: 0.08, draw: (c, r) => mountains(c, r, 220, 90, '#6a9aa8', 6) },
        { f: 0.2, draw: (c, r) => { mountains(c, r, 260, 70, '#4a7a78', 9); pyramid(c, 600, 300, 140, '#3e6a5e'); } },
        { f: 0.45, draw: (c, r) => jungle(c, r, '#1e4a34', 300) },
      ],
      stars: 0,
    },
    cave: {
      sky: [[0, '#07040f'], [0.5, '#140c26'], [1, '#22163a']],
      layers: [
        { f: 0.06, draw: (c, r) => caveWall(c, r, '#1c1430', 0.5) },
        { f: 0.2, draw: (c, r) => { caveWall(c, r, '#251a40', 0.9); crystalsBg(c, r, 10); } },
        { f: 0.4, draw: (c, r) => stalactites(c, r, '#0d0918') },
      ],
      stars: 0,
    },
    volcano: {
      sky: [[0, '#1a0606'], [0.4, '#4a0e0a'], [0.75, '#b8320e'], [1, '#ff8a2a']],
      layers: [
        { f: 0.03, draw: (c, r) => { clouds(c, r, 8, 'rgba(40,10,10,0.5)', 20, 120); } },
        { f: 0.08, draw: (c, r) => volcano(c, 480, '#2e0e0c') },
        { f: 0.22, draw: (c, r) => mountains(c, r, 280, 80, '#220a0a', 12, true) },
        { f: 0.45, draw: (c, r) => spires(c, r, '#120505') },
      ],
      stars: 0,
    },
    temple: {
      sky: [[0, '#0a0620'], [0.5, '#2a1450'], [0.8, '#5a2a7a'], [1, '#a04a8a']],
      layers: [
        { f: 0, draw: (c, r) => { moon(c, 760, 80, 40); aurora(c, r); } },
        { f: 0.08, draw: (c, r) => islands(c, r, '#2a1a4a', 0.6) },
        { f: 0.22, draw: (c, r) => pillars(c, r, '#1e1238') },
        { f: 0.42, draw: (c, r) => clouds(c, r, 7, 'rgba(120,80,170,0.35)', 260, 340) },
      ],
      stars: 140,
    },
  };

  // --- примитивы фонов ---
  function sun(c, x, y, rad, c1, c2, stripes = true) {
    const g = c.createRadialGradient(x, y, rad * 0.5, x, y, rad * 2.6);
    g.addColorStop(0, G.rgba(c1, 0.5)); g.addColorStop(1, G.rgba(c1, 0));
    c.fillStyle = g; c.fillRect(x - rad * 3, y - rad * 3, rad * 6, rad * 6);
    const lg = c.createLinearGradient(0, y - rad, 0, y + rad);
    lg.addColorStop(0, c1); lg.addColorStop(1, c2);
    c.fillStyle = lg;
    c.beginPath(); c.arc(x, y, rad, 0, Math.PI * 2); c.fill();
    if (stripes) {
      c.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 7; i++) {
        const yy = y + rad * 0.15 + i * i * 1.6 + i * 4;
        c.fillRect(x - rad, yy, rad * 2, 1.5 + i * 0.6);
      }
      c.globalCompositeOperation = 'source-over';
    }
  }
  function moon(c, x, y, rad) {
    G.Gfx.glow(c, x, y, rad * 3, '#d8c8ff', 0.35);
    G.Gfx.circle(c, x, y, rad, '#f0e8ff');
    c.fillStyle = 'rgba(160,140,200,0.5)';
    for (const [a, b, s] of [[-12, -8, 7], [10, 6, 9], [-5, 16, 5], [16, -14, 4]]) { c.beginPath(); c.arc(x + a, y + b, s, 0, 7); c.fill(); }
  }
  function skyline(c, r, base, minH, maxH, col, winChance, winCol) {
    let x = -10;
    while (x < LW) {
      const w = 26 + r() * 50, h = minH + r() * (maxH - minH);
      c.fillStyle = col;
      c.fillRect(x, base + 110 - h, w, h + 200);
      if (r() < 0.3) c.fillRect(x + w * 0.3, base + 110 - h - 14, w * 0.4, 14);
      if (r() < 0.25) { c.fillRect(x + w / 2 - 0.6, base + 110 - h - 32, 1.2, 32); }
      for (let wy = base + 118 - h; wy < base + 200; wy += 7) {
        for (let wx = x + 4; wx < x + w - 4; wx += 6) {
          if (r() < winChance) { c.fillStyle = G.rgba(winCol, 0.3 + r() * 0.6); c.fillRect(wx, wy, 2.5, 3); }
        }
      }
      c.fillStyle = col;
      x += w + r() * 6;
    }
  }
  function cranes(c, r, col) {
    c.fillStyle = col;
    c.strokeStyle = col;
    for (let i = 0; i < 2; i++) {
      const x = 150 + i * 480 + r() * 80;
      c.fillRect(x, 120, 6, 260);
      c.lineWidth = 1;
      for (let y = 120; y < 380; y += 10) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + 6, y + 10); c.stroke(); }
      c.fillRect(x - 60, 116, 200, 5);
      c.fillRect(x - 60, 121, 20, 10);
      c.beginPath(); c.moveTo(x + 3, 98); c.lineTo(x - 50, 117); c.lineTo(x + 130, 117); c.closePath(); c.lineWidth = 1.2; c.stroke();
      c.fillRect(x + 100, 121, 1, 50 + r() * 40);
      c.fillRect(x + 94, 170, 13, 8);
    }
    // ближние крыши
    let x = 0;
    while (x < LW) {
      const w = 70 + r() * 90, h = 30 + r() * 60;
      c.fillRect(x, 360 - h, w, h);
      c.fillRect(x + 10, 360 - h - 12, 14, 12);
      x += w + 20 + r() * 40;
    }
  }
  function mountains(c, r, base, amp, col, n, jag) {
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(0, 400);
    const pts = [];
    for (let i = 0; i <= n; i++) pts.push(base - r() * amp);
    pts[n] = pts[0];
    for (let i = 0; i <= n; i++) {
      const x = (i / n) * LW;
      if (jag) { c.lineTo(x - LW / n / 2, pts[i] + 30); }
      c.lineTo(x, pts[i]);
    }
    c.lineTo(LW, 400);
    c.fill();
  }
  function pyramid(c, x, base, w, col) {
    c.fillStyle = col;
    for (let i = 0; i < 7; i++) {
      const ww = w - i * (w / 7);
      c.fillRect(x - ww / 2, base - i * 14, ww, 14);
    }
    c.fillRect(x - 8, base - 7 * 14 - 12, 16, 12);
    c.fillStyle = G.shade(col, -0.25);
    c.fillRect(x - 5, base - 7 * 14 - 8, 10, 8);
  }
  function jungle(c, r, col, base) {
    c.fillStyle = col;
    for (let x = -20; x < LW + 20; x += 18 + r() * 16) {
      const h = 40 + r() * 70;
      c.fillRect(x + 6, base - h, 4, h + 100);
      for (let k = 0; k < 5; k++) {
        c.beginPath();
        c.ellipse(x + 8 + (r() - 0.5) * 30, base - h + (r() - 0.3) * 20, 14 + r() * 10, 7 + r() * 5, r() - 0.5, 0, 7);
        c.fill();
      }
    }
    c.fillRect(0, base + 10, LW, 100);
    // лианы
    c.strokeStyle = G.shade(col, 0.15);
    c.lineWidth = 1.2;
    for (let i = 0; i < 18; i++) {
      const x = r() * LW, len = 40 + r() * 90;
      c.beginPath(); c.moveTo(x, 0);
      c.quadraticCurveTo(x + 10 * (r() - 0.5), len / 2, x + 6 * (r() - 0.5), len);
      c.stroke();
      c.fillStyle = G.shade(col, 0.15);
      c.beginPath(); c.ellipse(x, len, 3, 5, 0, 0, 7); c.fill();
    }
  }
  function caveWall(c, r, col, density) {
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(0, 0);
    for (let x = 0; x <= LW; x += 30) c.lineTo(x, 30 + r() * 60 * density);
    c.lineTo(LW, 0); c.fill();
    c.beginPath();
    c.moveTo(0, 360);
    for (let x = 0; x <= LW; x += 30) c.lineTo(x, 280 - r() * 80 * density);
    c.lineTo(LW, 360); c.fill();
    for (let i = 0; i < 12 * density; i++) {
      const x = r() * LW, w = 10 + r() * 20, h = 40 + r() * 100;
      c.beginPath(); c.moveTo(x - w, 0); c.lineTo(x, h); c.lineTo(x + w, 0); c.fill();
      const x2 = r() * LW, h2 = 30 + r() * 80;
      c.beginPath(); c.moveTo(x2 - w, 360); c.lineTo(x2, 360 - h2); c.lineTo(x2 + w, 360); c.fill();
    }
  }
  function crystalsBg(c, r, n) {
    for (let i = 0; i < n; i++) {
      const x = r() * LW, y = 200 + r() * 120, s = 0.7 + r() * 1.5;
      const col = r() < 0.5 ? '#3ad0ff' : '#e040ff';
      G.Gfx.glow(c, x, y, 40 * s, col, 0.18);
      c.fillStyle = G.rgba(col, 0.45);
      for (let k = 0; k < 3; k++) {
        c.save(); c.translate(x + (k - 1) * 6 * s, y); c.rotate((k - 1) * 0.4);
        c.beginPath(); c.moveTo(-3 * s, 0); c.lineTo(0, -18 * s * (k === 1 ? 1.4 : 1)); c.lineTo(3 * s, 0); c.fill();
        c.restore();
      }
    }
  }
  function stalactites(c, r, col) {
    c.fillStyle = col;
    for (let x = -10; x < LW + 10; x += 14 + r() * 30) {
      const h = 20 + r() * 70, w = 6 + r() * 12;
      c.beginPath(); c.moveTo(x - w, 0); c.quadraticCurveTo(x - 2, h * 0.6, x, h); c.quadraticCurveTo(x + 2, h * 0.6, x + w, 0); c.fill();
    }
    c.fillRect(0, 0, LW, 8);
  }
  function volcano(c, x, col) {
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(x - 330, 360); c.lineTo(x - 70, 150); c.lineTo(x - 40, 160); c.lineTo(x + 40, 155); c.lineTo(x + 70, 148); c.lineTo(x + 330, 360);
    c.fill();
    G.Gfx.glow(c, x, 150, 120, '#ff5a10', 0.45);
    c.strokeStyle = 'rgba(255,110,30,0.7)';
    c.lineWidth = 3;
    for (const [dx, k] of [[-30, -1], [10, 0.3], [35, 1]]) {
      c.beginPath(); c.moveTo(x + dx, 156);
      c.quadraticCurveTo(x + dx + k * 40, 230, x + dx + k * 90, 330);
      c.stroke();
    }
  }
  function spires(c, r, col) {
    c.fillStyle = col;
    for (let x = 0; x < LW; x += 40 + r() * 60) {
      const h = 60 + r() * 120, w = 14 + r() * 20;
      c.beginPath(); c.moveTo(x - w, 360); c.lineTo(x - w * 0.3, 360 - h); c.lineTo(x + w * 0.2, 360 - h * 0.9); c.lineTo(x + w, 360); c.fill();
    }
  }
  function islands(c, r, col, scale) {
    for (let i = 0; i < 6; i++) {
      const x = r() * LW, y = 120 + r() * 140, w = (40 + r() * 70) * scale;
      c.fillStyle = col;
      c.beginPath();
      c.moveTo(x - w, y); c.lineTo(x + w, y);
      c.lineTo(x + w * 0.5, y + w * 0.5); c.lineTo(x, y + w * 0.9); c.lineTo(x - w * 0.6, y + w * 0.4); c.closePath(); c.fill();
      c.fillStyle = G.shade(col, 0.2);
      c.fillRect(x - w, y - 2, w * 2, 3);
      // маленький храм
      if (r() < 0.6) {
        c.fillStyle = col;
        c.fillRect(x - 12, y - 18, 24, 16);
        c.beginPath(); c.moveTo(x - 16, y - 18); c.lineTo(x, y - 30); c.lineTo(x + 16, y - 18); c.fill();
        c.fillStyle = 'rgba(255,200,120,0.6)'; c.fillRect(x - 2, y - 12, 4, 6);
      }
    }
  }
  function pillars(c, r, col) {
    c.fillStyle = col;
    for (let x = 30; x < LW; x += 120 + r() * 60) {
      const h = 120 + r() * 130, w = 22;
      const broken = r() < 0.4;
      c.fillRect(x, 360 - h, w, h);
      c.fillRect(x - 5, 360 - h, w + 10, 8);
      if (!broken) c.fillRect(x - 5, 360 - h - 10, w + 10, 6);
      c.fillStyle = G.shade(col, 0.12);
      for (let k = 4; k < w; k += 6) c.fillRect(x + k, 360 - h + 10, 1.5, h);
      c.fillStyle = col;
    }
  }
  function aurora(c, r) {
    for (let k = 0; k < 3; k++) {
      const col = ['#40ffc0', '#a060ff', '#ff60c0'][k];
      c.strokeStyle = G.rgba(col, 0.12);
      c.lineWidth = 18;
      c.beginPath();
      for (let x = 0; x <= LW; x += 20) {
        const y = 60 + k * 26 + Math.sin(x * 0.012 + k * 2) * 24 + Math.sin(x * 0.031) * 8;
        x === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
      }
      c.stroke();
    }
  }
  function clouds(c, r, n, col, y0, y1) {
    c.fillStyle = col;
    for (let i = 0; i < n; i++) {
      const x = r() * LW, y = y0 + r() * (y1 - y0), s = 0.6 + r();
      for (let k = 0; k < 5; k++) {
        c.beginPath();
        c.ellipse(x + (k - 2) * 16 * s, y + Math.abs(k - 2) * 3 * s, 18 * s, 9 * s, 0, 0, 7);
        c.fill();
      }
    }
  }

  function build(theme) {
    const T = themes[theme];
    const sc = G.Gfx.scale;
    const out = { sky: null, layers: [] };
    out.sky = G.Gfx.makeCanvas(G.W, G.H, (c, w, h) => {
      const g = c.createLinearGradient(0, 0, 0, h);
      for (const [o, col] of T.sky) g.addColorStop(o, col);
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
    }, Math.min(sc, 1.5));
    T.layers.forEach((L, i) => {
      const r = G.rng(theme.length * 131 + i * 7919);
      const w = L.f === 0 ? G.W * 1.5 : LW;
      out.layers.push({ f: L.f, w, img: G.Gfx.makeCanvas(w, G.H, (c) => L.draw(c, r), sc) });
    });
    const r = G.rng(99);
    out.stars = [];
    for (let i = 0; i < T.stars; i++) out.stars.push({ x: r() * G.W, y: r() * G.H * 0.55, s: r() * 1.3 + 0.3, p: r() * 6 });
    return out;
  }

  B.draw = (theme, camX, camY, time) => {
    if (ver !== G.Gfx.version) { cache = {}; ver = G.Gfx.version; }
    if (!cache[theme]) cache[theme] = build(theme);
    const bg = cache[theme];
    const c = G.Gfx.ctx;
    G.Gfx.screen();
    c.drawImage(bg.sky, 0, 0, G.W, G.H);
    for (const s of bg.stars) {
      c.globalAlpha = 0.4 + Math.sin(time * 2 + s.p) * 0.4;
      c.fillStyle = '#fff';
      c.fillRect(s.x, s.y, s.s, s.s);
    }
    c.globalAlpha = 1;
    for (const L of bg.layers) {
      if (L.f === 0) {
        c.drawImage(L.img, -camX * 0.01 - 80, 0, L.w, G.H);
        continue;
      }
      let ox = -((camX * L.f) % L.w);
      const oy = -camY * L.f;
      for (let x = ox; x < G.W; x += L.w) c.drawImage(L.img, x, oy, L.w + 0.5, G.H);
    }
  };
  B.prewarm = (theme) => {
    if (ver !== G.Gfx.version) { cache = {}; ver = G.Gfx.version; }
    if (!cache[theme]) cache[theme] = build(theme);
  };
  return B;
})();
