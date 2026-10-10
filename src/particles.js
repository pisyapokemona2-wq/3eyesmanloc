'use strict';
// Частицы: пыль, искры, обломки, кольца, всплывающий текст.
G.Particles = (() => {
  const list = [];
  const P = {};
  P.list = list;
  P.clear = () => (list.length = 0);

  P.add = (o) => {
    const p = Object.assign({
      x: 0, y: 0, vx: 0, vy: 0, g: 0, drag: 1, life: 30, t: 0, size: 2, size2: null,
      color: '#fff', color2: null, kind: 'dot', add: false, rot: 0, vr: 0, bounce: false, alpha: 1,
    }, o);
    p.max = p.life;
    list.push(p);
    if (list.length > 900) list.shift();
    return p;
  };

  P.dust = (x, y, n = 6, color = '#d8c8b0') => {
    for (let i = 0; i < n; i++) {
      P.add({ x: x + G.rand(-6, 6), y: y - G.rand(0, 3), vx: G.rand(-1, 1), vy: G.rand(-0.9, -0.1), drag: 0.92, life: G.randi(18, 30), size: G.rand(2, 4), size2: 0.5, color, alpha: 0.7, kind: 'puff' });
    }
  };
  P.sparks = (x, y, n = 8, color = '#ffe070', speed = 3) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = G.rand(0.5, 1) * speed;
      P.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, drag: 0.9, life: G.randi(12, 22), size: G.rand(1, 2.2), color, add: true, kind: 'spark' });
    }
  };
  P.debris = (x, y, n, colors, speed = 3) => {
    for (let i = 0; i < n; i++) {
      P.add({ x: x + G.rand(-4, 4), y: y + G.rand(-4, 4), vx: G.rand(-1, 1) * speed, vy: G.rand(-1.5, -0.3) * speed, g: 0.25, life: G.randi(30, 60), size: G.rand(2, 4), color: G.pick(colors), kind: 'chunk', rot: G.rand(6), vr: G.rand(-0.3, 0.3) });
    }
  };
  P.ring = (x, y, color = '#fff', r = 16, life = 18) => P.add({ x, y, life, size: 1, size2: r, color, kind: 'ring', add: true });
  P.explosion = (x, y, scale = 1) => {
    P.ring(x, y, '#fff2c0', 26 * scale, 16);
    for (let i = 0; i < 14 * scale; i++) {
      const a = Math.random() * Math.PI * 2, s = G.rand(0.5, 3) * scale;
      P.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, drag: 0.88, life: G.randi(18, 34), size: G.rand(4, 9) * scale, size2: 0, color: G.pick(['#fff3b0', '#ffb040', '#ff6020']), color2: '#5a3a3a', kind: 'fire', add: true });
    }
    for (let i = 0; i < 6 * scale; i++) {
      P.add({ x: x + G.rand(-8, 8) * scale, y: y + G.rand(-8, 8) * scale, vx: G.rand(-0.6, 0.6), vy: G.rand(-1, -0.3), drag: 0.95, life: G.randi(30, 50), size: G.rand(4, 8) * scale, size2: 12 * scale, color: '#3a3040', alpha: 0.5, kind: 'puff' });
    }
    P.sparks(x, y, 10 * scale, '#ffe080', 4 * scale);
  };
  P.text = (x, y, str, color = '#fff', size = 8) => P.add({ x, y, vy: -0.7, drag: 0.96, life: 50, str, color, size, kind: 'text' });

  P.update = (level) => {
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.t++;
      p.vy += p.g;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      if (p.kind === 'chunk' && level && p.vy > 0 && level.solidAt(p.x, p.y)) {
        p.y -= p.vy;
        p.vy *= -0.4;
        p.vx *= 0.7;
      }
      if (p.t >= p.max) list.splice(i, 1);
    }
  };

  P.draw = (c, layer = 0) => {
    for (const p of list) {
      if ((p.layer || 0) !== layer) continue;
      const k = p.t / p.max;
      const size = p.size2 === null ? p.size : G.lerp(p.size, p.size2, k);
      const a = p.alpha * (p.kind === 'ring' || p.kind === 'text' ? 1 - k * k : 1 - k);
      c.globalAlpha = Math.max(0, a);
      c.globalCompositeOperation = p.add ? 'lighter' : 'source-over';
      const col = p.color2 && k > 0.5 ? p.color2 : p.color;
      switch (p.kind) {
        case 'ring':
          c.strokeStyle = col;
          c.lineWidth = 2 * (1 - k) + 0.5;
          c.beginPath(); c.arc(p.x, p.y, size, 0, Math.PI * 2); c.stroke();
          break;
        case 'chunk':
          c.save();
          c.translate(p.x, p.y); c.rotate(p.rot);
          c.fillStyle = col; c.fillRect(-size / 2, -size / 2, size, size);
          c.restore();
          break;
        case 'text':
          c.globalCompositeOperation = 'source-over';
          c.globalAlpha = 1;
          G.Gfx.ctx.save();
          G.Gfx.text(p.str, p.x, p.y, { size: p.size, color: p.color, align: 'center', alpha: Math.max(0, a), shadow: false });
          G.Gfx.ctx.restore();
          break;
        case 'spark':
          c.strokeStyle = col;
          c.lineWidth = size;
          c.lineCap = 'round';
          c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 1.5, p.y - p.vy * 1.5); c.stroke();
          break;
        default:
          c.fillStyle = col;
          c.beginPath(); c.arc(p.x, p.y, Math.max(0.1, size / 2), 0, Math.PI * 2); c.fill();
      }
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  };
  return P;
})();
