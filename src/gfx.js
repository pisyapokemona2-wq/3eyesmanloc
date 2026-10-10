'use strict';
// Рендер: холст во всё окно с реальным разрешением экрана (devicePixelRatio),
// логическая сцена 640×360 масштабируется с сохранением 16:9.
G.Gfx = (() => {
  const X = {};
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  X.canvas = canvas;
  X.ctx = ctx;
  X.scale = 1;
  X.offX = 0;
  X.offY = 0;
  X.version = 0; // меняется при ресайзе — сигнал перестроить кэши

  X.resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const cw = window.innerWidth, ch = window.innerHeight;
    canvas.width = Math.floor(cw * dpr);
    canvas.height = Math.floor(ch * dpr);
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    X.scale = Math.min(canvas.width / G.W, canvas.height / G.H);
    X.offX = Math.floor((canvas.width - G.W * X.scale) / 2);
    X.offY = Math.floor((canvas.height - G.H * X.scale) / 2);
    X.version++;
  };
  window.addEventListener('resize', X.resize);
  X.resize();

  // Экранная система координат (UI)
  X.screen = () => ctx.setTransform(X.scale, 0, 0, X.scale, X.offX, X.offY);
  // Мировая система с камерой; координаты камеры округляются до физических пикселей
  X.world = (camX, camY) => {
    const s = X.scale;
    ctx.setTransform(s, 0, 0, s, Math.round(X.offX - camX * s), Math.round(X.offY - camY * s));
  };

  // Вспомогательные фигуры
  X.rr = (c, x, y, w, h, r) => {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  };
  X.circle = (c, x, y, r, fill, stroke, lw = 1) => {
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.lineWidth = lw; c.strokeStyle = stroke; c.stroke(); }
  };
  X.ellipse = (c, x, y, rx, ry, rot, fill, stroke, lw = 1) => {
    c.beginPath();
    c.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, Math.PI * 2);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.lineWidth = lw; c.strokeStyle = stroke; c.stroke(); }
  };
  // «Конечность» — скруглённая линия с обводкой
  X.limb = (c, x1, y1, x2, y2, w, color, outline = '#1a1020') => {
    c.lineCap = 'round';
    c.strokeStyle = outline;
    c.lineWidth = w + 1.6;
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    c.strokeStyle = color;
    c.lineWidth = w;
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
  };
  X.limb3 = (c, x1, y1, x2, y2, x3, y3, w, color, outline = '#1a1020') => {
    c.lineCap = 'round';
    c.lineJoin = 'round';
    for (const [lw, col] of [[w + 1.6, outline], [w, color]]) {
      c.strokeStyle = col;
      c.lineWidth = lw;
      c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.lineTo(x3, y3); c.stroke();
    }
  };
  X.glow = (c, x, y, r, color, a = 1) => {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, G.rgba(color, a));
    g.addColorStop(1, G.rgba(color, 0));
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  };

  // Текст: пиксельный шрифт с обводкой и тенью
  X.font = '"Press Start 2P", "Courier New", monospace';
  X.text = (str, x, y, { size = 8, color = '#fff', align = 'left', outline = '#120a1c', shadow = true, alpha = 1, base = 'top' } = {}) => {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.font = `${size}px ${X.font}`;
    ctx.textAlign = align;
    ctx.textBaseline = base;
    if (shadow) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillText(str, x + size * 0.18, y + size * 0.22);
    }
    if (outline) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(2, size * 0.32);
      ctx.strokeStyle = outline;
      ctx.strokeText(str, x, y);
    }
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
    ctx.restore();
  };
  X.textWidth = (str, size = 8) => {
    ctx.save();
    ctx.font = `${size}px ${X.font}`;
    const w = ctx.measureText(str).width;
    ctx.restore();
    return w;
  };

  // Отрисовка во внеэкранный холст с учётом текущего масштаба —
  // кэшированные спрайты остаются чёткими на любом экране.
  X.makeCanvas = (w, h, fn, sc = X.scale) => {
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.ceil(w * sc));
    cv.height = Math.max(1, Math.ceil(h * sc));
    const c = cv.getContext('2d');
    c.scale(cv.width / w, cv.height / h);
    fn(c, w, h);
    return cv;
  };
  return X;
})();
