'use strict';
// Частицы: пиксельные точки, искры, обломки и спрайтовые эффекты (fx_*).
G.Particles = (() => {
  const list = [];
  const P = { list };
  P.clear = () => (list.length = 0);
  P.add = (o) => {
    const p = Object.assign({ x: 0, y: 0, vx: 0, vy: 0, g: 0, drag: 1, life: 30, t: 0, size: 1, color: '#fff', kind: 'dot', add: false, bounce: false, layer: 1 }, o);
    p.max = p.life;
    list.push(p);
    if (list.length > 700) list.shift();
    return p;
  };
  // спрайтовый эффект: анимация fx_* проигрывается один раз
  P.fx = (anim, x, y, o = {}) => {
    const a = G.Art.anims[anim];
    const life = a ? Math.ceil((a.frames.length * 60) / a.fps) : 20;
    return P.add(Object.assign({ x, y, kind: 'fx', anim, life }, o));
  };
  P.dust = (x, y, n = 3) => {
    P.fx('fx_puff', x, y - 3, { vy: -0.2 });
    for (let i = 0; i < n; i++) P.add({ x: x + G.rand(-5, 5), y: y - 1, vx: G.rand(-0.6, 0.6), vy: G.rand(-0.8, -0.2), drag: 0.9, life: G.randi(10, 18), color: '#d8ccbc' });
  };
  P.sparks = (x, y, n = 6, color = '#ffe070', speed = 2.2) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = G.rand(0.4, 1) * speed;
      P.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, drag: 0.9, life: G.randi(10, 20), color, kind: 'spark', add: true });
    }
  };
  P.debris = (x, y, n, colors, speed = 2) => {
    for (let i = 0; i < n; i++) P.add({ x: x + G.rand(-4, 4), y: y + G.rand(-4, 4), vx: G.rand(-1, 1) * speed, vy: G.rand(-1.6, -0.4) * speed, g: 0.2, life: G.randi(30, 50), size: G.randi(1, 3), color: G.pick(colors), kind: 'chunk', bounce: true });
  };
  P.explosion = (x, y, big = false) => {
    P.fx('fx_explode', x, y);
    if (big) { P.fx('fx_explode', x + G.rand(-10, 10), y + G.rand(-10, 10)); P.fx('fx_ring', x, y); }
    P.sparks(x, y, big ? 14 : 8, '#ffd070', big ? 3 : 2.2);
  };
  P.text = (x, y, str, color = '#ffffff') => P.add({ x, y, vy: -0.5, drag: 0.96, life: 45, str, color, kind: 'text', layer: 2 });

  P.update = (level) => {
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.t++;
      p.vy += p.g;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.x += p.vx;
      p.y += p.vy;
      if (p.bounce && level && p.vy > 0 && level.solidAt(p.x, p.y)) { p.y -= p.vy; p.vy *= -0.35; p.vx *= 0.6; }
      if (p.t >= p.max) list.splice(i, 1);
    }
  };

  P.draw = (c, layer = 1) => {
    for (const p of list) {
      if (p.layer !== layer) continue;
      const k = p.t / p.max;
      if (p.kind === 'fx') {
        if (p.add) c.globalCompositeOperation = 'lighter';
        G.Art.has(G.Art.frame(p.anim, p.t)) && G.Art.draw(c, G.Art.frame(p.anim, p.t), p.x, p.y, !!p.flip);
        c.globalCompositeOperation = 'source-over';
        continue;
      }
      if (p.kind === 'spr') {
        c.globalAlpha = (1 - k) * 0.45;
        c.globalCompositeOperation = 'lighter';
        G.Art.draw(c, p.name, p.x, p.y, p.flip);
        c.globalCompositeOperation = 'source-over';
        c.globalAlpha = 1;
        continue;
      }
      if (p.kind === 'text') {
        if (k > 0.7 && p.t % 4 < 2) continue;
        G.Gfx.text(p.str, p.x, p.y, { align: 'center', color: p.color });
        continue;
      }
      // мерцание в конце жизни
      if (k > 0.75 && p.t % 3 === 0) continue;
      c.globalCompositeOperation = p.add ? 'lighter' : 'source-over';
      c.fillStyle = p.color;
      const s = p.kind === 'spark' && k < 0.4 ? 2 : p.size;
      c.fillRect(Math.round(p.x), Math.round(p.y), s, s);
      if (p.kind === 'spark' && k < 0.5) c.fillRect(Math.round(p.x - p.vx), Math.round(p.y - p.vy), 1, 1);
    }
    c.globalCompositeOperation = 'source-over';
  };
  return P;
})();
