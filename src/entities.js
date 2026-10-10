'use strict';
// Базовые сущности: подбираемые предметы, платформы, снаряды, декор.
G.Entity = class Entity {
  constructor(x, y, w, h) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.vx = 0; this.vy = 0;
    this.dead = false;
    this.t = 0;
    this.layer = 1; // 0 — за игроком, 1 — обычный, 2 — поверх
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  get bottom() { return this.y + this.h; }
  update() { this.t++; }
  draw() {}
  onScreen(game, pad = 40) {
    return this.x + this.w > game.cam.x - pad && this.x < game.cam.x + G.W + pad;
  }
};

// --- Монеты -----------------------------------------------------------------
G.drawCoin = (c, x, y, t, big = false, alpha = 1) => {
  const r = big ? 7 : 4.5;
  const sx = Math.abs(Math.cos(t * 0.09)) * 0.85 + 0.15;
  c.save();
  c.globalAlpha = alpha;
  c.translate(x, y);
  G.Gfx.glow(c, 0, 0, r * 2.2, '#ffd040', 0.25);
  c.scale(sx, 1);
  G.Gfx.circle(c, 0, 0, r, '#b06a10', '#3a2000', 0.9);
  G.Gfx.circle(c, 0, -0.4, r - 1, '#ffd23a');
  G.Gfx.circle(c, 0, -0.4, r - 2.2, '#f0a820');
  c.fillStyle = '#fff6b0';
  if (big) {
    // глаз на большой монете
    G.Gfx.ellipse(c, 0, -0.4, 3, 1.8, 0, '#fff6c8');
    G.Gfx.circle(c, 0, -0.4, 1.1, '#6a3a00');
  } else {
    c.fillRect(-0.6, -2.6, 1.2, 4.4);
  }
  c.restore();
  if (sx > 0.8) {
    c.save(); c.globalAlpha = alpha * 0.9; c.fillStyle = '#fff';
    c.fillRect(x - r * 0.45, y - r * 0.55, 1.4, 1.4);
    c.restore();
  }
};

G.Coin = class Coin extends G.Entity {
  constructor(x, y, vx, vy, big = false, placed = false) {
    super(x - 5, y - 5, 10, 10);
    this.big = big;
    this.value = big ? 50 : 10;
    this.placed = placed;
    this.vx = vx || 0; this.vy = vy || 0;
    this.life = placed ? Infinity : 480;
    this.t = Math.random() * 100;
    this.baseY = this.y;
    this.delay = placed ? 0 : 16;
  }
  update(game) {
    this.t++;
    this.delay--;
    const p = game.player;
    const magnet = game.eyeMode ? 140 : 46;
    if (p && p.alive && this.delay <= 0) {
      const d = G.dist(this.cx, this.cy, p.cx, p.cy);
      if (d < magnet) {
        const k = 0.6 + (1 - d / magnet) * 2.4;
        this.x += ((p.cx - this.cx) / d) * k * 2;
        this.y += ((p.cy - this.cy) / d) * k * 2;
        this.placed = false;
        this.vx *= 0.8; this.vy *= 0.8;
      }
      if (G.overlap(this, p)) {
        this.dead = true;
        game.addCoins(this.value, this.cx, this.y);
        G.Audio.play(this.big ? 'bigcoin' : 'coin');
        G.Particles.sparks(this.cx, this.cy, this.big ? 10 : 5, '#ffe060', 2);
        return;
      }
    }
    if (this.placed) {
      this.y = this.baseY + Math.sin(this.t * 0.06) * 1.5;
      return;
    }
    this.vy = Math.min(this.vy + 0.3, 6);
    const wasVy = this.vy;
    G.Physics.step(this, game.level);
    if (this.onGround && wasVy > 1.2) { this.vy = -wasVy * 0.5; this.onGround = false; }
    if (this.onGround) this.vx *= 0.85;
    if (this.hitL || this.hitR) this.vx *= -0.6;
    if (--this.life <= 0 || this.y > game.level.h * 16 + 40) this.dead = true;
  }
  draw(c) {
    const blink = this.life < 120 && Math.floor(this.life / 5) % 2 === 0;
    if (blink) return;
    G.drawCoin(c, this.cx, this.cy, this.t, this.big);
  }
};

// Монета, выпрыгивающая из бонус-блока (только визуально — уже засчитана)
G.CoinPop = class CoinPop extends G.Entity {
  constructor(x, y) { super(x - 5, y - 10, 10, 10); this.vy = -4.5; this.layer = 0; }
  update() {
    this.t++;
    this.vy += 0.3;
    this.y += this.vy;
    if (this.t > 26) { this.dead = true; G.Particles.sparks(this.cx, this.cy, 5, '#ffe060', 1.5); }
  }
  draw(c) { G.drawCoin(c, this.cx, this.cy, this.t * 3); }
};

// --- Предметы: сердце, энергия глаза, жизнь --------------------------------
G.drawHeart = (c, x, y, s, fill = '#ff3a5a', outline = '#3a0812') => {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  c.beginPath();
  c.moveTo(0, 3.6);
  c.bezierCurveTo(-5.5, -0.5, -4.2, -5.2, 0, -2.6);
  c.bezierCurveTo(4.2, -5.2, 5.5, -0.5, 0, 3.6);
  c.closePath();
  c.fillStyle = fill; c.fill();
  c.lineWidth = 1 / s * 0.9; c.strokeStyle = outline; c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.7)';
  c.beginPath(); c.ellipse(-2, -2.2, 1, 0.7, -0.6, 0, 7); c.fill();
  c.restore();
};
G.drawEyeOrb = (c, x, y, t, r = 6) => {
  G.Gfx.glow(c, x, y, r * 2.6, '#60ff9a', 0.45);
  G.Gfx.circle(c, x, y, r, '#1a6a3a', '#08200f', 0.9);
  const open = Math.sin(t * 0.08) > -0.85 ? 1 : 0.2;
  G.Gfx.ellipse(c, x, y, r * 0.8, r * 0.5 * open, 0, '#f0fff4');
  if (open > 0.5) { G.Gfx.circle(c, x, y, r * 0.35, '#2aff7a'); G.Gfx.circle(c, x, y, r * 0.17, '#04140a'); }
};

G.Pickup = class Pickup extends G.Entity {
  constructor(kind, x, y, vy = 0, placed = false) {
    super(x - 6, y - 12, 12, 12);
    this.kind = kind;
    this.vy = vy;
    this.placed = placed;
    this.baseY = this.y;
    this.life = placed ? Infinity : 600;
  }
  update(game) {
    this.t++;
    if (this.placed) this.y = this.baseY + Math.sin(this.t * 0.07) * 2;
    else {
      this.vy = Math.min(this.vy + 0.25, 5);
      G.Physics.step(this, game.level);
      if (--this.life <= 0) this.dead = true;
    }
    const p = game.player;
    if (p && p.alive && G.overlap(this, p)) {
      this.dead = true;
      game.collect(this.kind, this.cx, this.cy);
    }
  }
  draw(c) {
    if (this.life < 120 && Math.floor(this.life / 5) % 2 === 0) return;
    const x = this.cx, y = this.cy;
    if (this.kind === 'heart') {
      G.Gfx.glow(c, x, y, 14, '#ff4a6a', 0.35);
      G.drawHeart(c, x, y, 1.4 + Math.sin(this.t * 0.2) * 0.08);
    } else if (this.kind === 'eye') {
      G.drawEyeOrb(c, x, y, this.t);
    } else if (this.kind === 'life') {
      G.Gfx.glow(c, x, y, 14, '#ffe040', 0.4);
      G.drawHead(c, x, y + 1, 0.55);
    }
  }
};

// --- Чекпоинт: статуя с глазом ----------------------------------------------
G.Checkpoint = class Checkpoint extends G.Entity {
  constructor(x, y) { super(x - 8, y - 32, 16, 32); this.active = false; this.layer = 0; this.anim = 0; }
  update(game) {
    this.t++;
    if (this.active) this.anim = Math.min(1, this.anim + 0.05);
    const p = game.player;
    if (!this.active && p && p.alive && p.cx > this.x) {
      this.active = true;
      game.setCheckpoint(this.cx, this.bottom);
      G.Audio.play('checkpoint');
      G.Particles.ring(this.cx, this.y + 8, '#70ffb0', 24, 24);
      G.Particles.sparks(this.cx, this.y + 8, 14, '#90ffc0', 3);
      G.Particles.text(this.cx, this.y - 6, 'ЧЕКПОИНТ', '#90ffc0', 6);
    }
  }
  draw(c, game) {
    const x = this.cx, b = this.bottom;
    // постамент
    c.fillStyle = '#4a4258';
    G.Gfx.rr(c, x - 9, b - 8, 18, 8, 1.5); c.fill();
    c.strokeStyle = '#140e1c'; c.lineWidth = 0.9; c.stroke();
    c.fillStyle = '#6a6080'; c.fillRect(x - 8, b - 7.5, 16, 1.5);
    // столб
    c.fillStyle = '#5a5270';
    c.fillRect(x - 5, b - 26, 10, 18);
    c.strokeRect(x - 5, b - 26, 10, 18);
    c.fillStyle = '#7a7090'; c.fillRect(x - 4, b - 26, 2, 18);
    // глаз-камень
    const k = this.anim;
    const col = G.mix('#4a4a5a', '#3aff9a', k);
    if (k > 0) G.Gfx.glow(c, x, b - 30, 22, '#3aff9a', 0.4 * k + Math.sin(this.t * 0.1) * 0.08 * k);
    G.Gfx.circle(c, x, b - 30, 6.5, '#3a3448', '#140e1c', 0.9);
    G.Gfx.ellipse(c, x, b - 30, 5, 3 * Math.max(0.15, k), 0, k > 0 ? '#f0fff4' : '#5a5468');
    if (k > 0.3) { G.Gfx.circle(c, x, b - 30, 2, col); G.Gfx.circle(c, x, b - 30, 0.9, '#04140a'); }
  }
};

// --- Пружина -----------------------------------------------------------------
G.Spring = class Spring extends G.Entity {
  constructor(x, y) { super(x - 8, y - 10, 16, 10); this.squash = 0; this.layer = 0; }
  update(game) {
    this.t++;
    this.squash *= 0.8;
    const p = game.player;
    if (p && p.alive && p.vy > 0 && G.overlap(p, this) && p.bottom - p.vy <= this.y + 4) {
      p.y = this.y - p.h;
      p.vy = G.Input.down('jump') ? -12.5 : -10.5;
      p.onGround = false;
      p.springBoost = true;
      p.jumpHeld = false;
      this.squash = 1;
      G.Audio.play('spring');
      G.Particles.dust(this.cx, this.y + 4, 6);
    }
  }
  draw(c) {
    const x = this.cx, b = this.bottom;
    const h = 10 - this.squash * 5;
    c.fillStyle = '#3a3a48'; c.fillRect(x - 7, b - 2.5, 14, 2.5);
    c.strokeStyle = '#a8a8b8'; c.lineWidth = 1.4;
    c.beginPath();
    for (let i = 0; i <= 4; i++) {
      const y = b - 2.5 - (i / 4) * (h - 4);
      c.lineTo(x + (i % 2 ? 5 : -5), y);
    }
    c.stroke();
    c.fillStyle = '#e83a3a';
    G.Gfx.rr(c, x - 8, b - h - 1.5, 16, 4, 1.5); c.fill();
    c.strokeStyle = '#2a0808'; c.lineWidth = 0.8; c.stroke();
    c.fillStyle = '#ff9a8a'; c.fillRect(x - 6, b - h - 1, 12, 1);
  }
};

// --- Табличка с подсказкой ---------------------------------------------------
G.Sign = class Sign extends G.Entity {
  constructor(x, y, text) { super(x - 8, y - 18, 16, 18); this.text = text; this.layer = 2; this.show = 0; }
  update(game) {
    this.t++;
    const p = game.player;
    const near = p && Math.abs(p.cx - this.cx) < 60 && Math.abs(p.cy - this.cy) < 50;
    this.show = G.approach(this.show, near ? 1 : 0, 0.1);
  }
  draw(c, game) {
    const x = this.cx, b = this.bottom;
    c.fillStyle = '#6a4220'; c.fillRect(x - 1.5, b - 10, 3, 10);
    c.fillStyle = '#c08850';
    G.Gfx.rr(c, x - 9, b - 19, 18, 11, 1.5); c.fill();
    c.strokeStyle = '#2a1608'; c.lineWidth = 0.9; c.stroke();
    c.fillStyle = '#2a1608';
    c.fillRect(x - 5, b - 16, 10, 1); c.fillRect(x - 5, b - 13.5, 7, 1);
    if (this.show > 0.01 && this.text) {
      const s = G.easeOutBack(this.show);
      const w = G.Gfx.textWidth(this.text, 6) + 14;
      // пузырь не выходит за край экрана
      const bx = G.clamp(x, game.cam.x + w / 2 + 6, game.cam.x + G.W - w / 2 - 6);
      c.save();
      c.translate(bx, b - 30);
      c.scale(s, s);
      c.fillStyle = 'rgba(16,10,28,0.9)';
      G.Gfx.rr(c, -w / 2, -16, w, 18, 3); c.fill();
      c.strokeStyle = '#ffd86a'; c.lineWidth = 1; c.stroke();
      const ax = G.clamp(x - bx, -w / 2 + 6, w / 2 - 6);
      c.beginPath(); c.moveTo(ax - 4, 2); c.lineTo(ax, 7); c.lineTo(ax + 4, 2); c.fill();
      G.Gfx.text(this.text, 0, -11, { size: 6, color: '#fff3c8', align: 'center', shadow: false, outline: null });
      c.restore();
    }
  }
};

// --- Факел ----------------------------------------------------------------------
G.Torch = class Torch extends G.Entity {
  constructor(x, y) { super(x - 3, y - 24, 6, 24); this.layer = 0; this.t = Math.random() * 100; }
  update() { this.t++; if (Math.random() < 0.05) G.Particles.add({ x: this.cx + G.rand(-1, 1), y: this.y + 2, vy: -0.6, vx: G.rand(-0.2, 0.2), life: 30, size: 1.2, color: '#ffb040', add: true, kind: 'spark' }); }
  draw(c) {
    const x = this.cx, b = this.bottom;
    c.fillStyle = '#4a3020'; c.fillRect(x - 1.2, b - 16, 2.4, 16);
    c.fillStyle = '#6a4a30'; c.fillRect(x - 3, b - 18, 6, 3);
    const f = Math.sin(this.t * 0.3) * 0.8 + Math.sin(this.t * 0.71) * 0.5;
    G.Gfx.glow(c, x, b - 21, 26, '#ff9a30', 0.4);
    c.fillStyle = '#ff6a10';
    c.beginPath(); c.moveTo(x - 3.5, b - 18); c.quadraticCurveTo(x - 3 + f, b - 24, x + f * 0.8, b - 29); c.quadraticCurveTo(x + 3, b - 23, x + 3.5, b - 18); c.fill();
    c.fillStyle = '#ffe070';
    c.beginPath(); c.moveTo(x - 1.6, b - 18); c.quadraticCurveTo(x - 1 + f * 0.5, b - 22, x + f * 0.5, b - 25); c.quadraticCurveTo(x + 1.6, b - 21, x + 1.6, b - 18); c.fill();
  }
};

// --- Движущиеся платформы ----------------------------------------------------
G.MovingPlatform = class MovingPlatform extends G.Entity {
  constructor(x, y, vertical) {
    super(x - 8, y - 16, 48, 8);
    this.isPlatform = true;
    this.vertical = vertical;
    this.ox = this.x; this.oy = this.y;
    this.dir = 1;
    this.speed = vertical ? 0.9 : 1.1;
    this.range = vertical ? 96 : 112;
    this.dx = 0; this.dy = 0;
    this.layer = 0;
  }
  update(game) {
    this.t++;
    const L = game.level;
    const px = this.x, py = this.y;
    if (this.vertical) {
      this.y += this.speed * this.dir;
      const blocked = this.dir > 0 ? (L.solidAt(this.x + 2, this.y + this.h) || L.solidAt(this.x + this.w - 2, this.y + this.h)) : (L.solidAt(this.x + 2, this.y) || L.solidAt(this.x + this.w - 2, this.y));
      if (Math.abs(this.y - this.oy) > this.range || blocked) { this.dir *= -1; this.y = py; }
    } else {
      this.x += this.speed * this.dir;
      const edge = this.dir > 0 ? this.x + this.w : this.x;
      const blocked = L.solidAt(edge, this.y + 2) || L.solidAt(edge, this.y + this.h - 1);
      if (Math.abs(this.x - this.ox) > this.range || blocked) { this.dir *= -1; this.x = px; }
    }
    this.dx = this.x - px;
    this.dy = this.y - py;
  }
  draw(c, game) {
    const P = G.Tiles.pal(game.level.theme);
    const x = this.x, y = this.y;
    c.fillStyle = P.plat2;
    G.Gfx.rr(c, x, y, this.w, this.h + 2, 2); c.fill();
    c.fillStyle = P.plat;
    G.Gfx.rr(c, x, y, this.w, this.h - 1, 2); c.fill();
    c.strokeStyle = P.outline; c.lineWidth = 0.9;
    G.Gfx.rr(c, x, y, this.w, this.h + 2, 2); c.stroke();
    c.fillStyle = G.shade(P.plat, 0.35); c.fillRect(x + 2, y + 1, this.w - 4, 1.2);
    // огоньки-моторчики
    const on = Math.floor(this.t / 10) % 2;
    G.Gfx.circle(c, x + 6, y + this.h / 2, 1.5, on ? '#7affb0' : '#2a6a4a');
    G.Gfx.circle(c, x + this.w - 6, y + this.h / 2, 1.5, on ? '#2a6a4a' : '#7affb0');
    if (this.vertical) {
      c.fillStyle = 'rgba(160,255,200,0.25)';
      c.fillRect(x + 10, y + this.h + 2, this.w - 20, 2 + Math.sin(this.t * 0.4));
    }
  }
};

// --- Вражеские снаряды -------------------------------------------------------
G.EnemyShot = class EnemyShot extends G.Entity {
  constructor(x, y, vx, vy, kind = 'fire', opts = {}) {
    const r = opts.r || (kind === 'orb' ? 5 : 4);
    super(x - r, y - r, r * 2, r * 2);
    this.r = r;
    this.vx = vx; this.vy = vy;
    this.kind = kind;
    this.grav = opts.g || 0;
    this.ghost = !!opts.ghost; // проходит сквозь стены
    this.life = opts.life || 300;
    this.dmg = opts.dmg || 1;
    this.hostile = true;
    this.layer = 2;
  }
  update(game) {
    this.t++;
    this.vy += this.grav;
    this.x += this.vx;
    this.y += this.vy;
    if (--this.life <= 0) this.dead = true;
    if (!this.ghost && game.level.solidAt(this.cx, this.cy)) {
      this.dead = true;
      G.Particles.sparks(this.cx, this.cy, 5, this.kind === 'web' ? '#e0e0ff' : '#ffa040', 2);
      if (this.kind === 'rock') G.Particles.debris(this.cx, this.cy, 4, ['#7a6a5a', '#5a4a3a'], 1.5);
    }
    if (this.t % 3 === 0 && this.kind !== 'rock' && this.kind !== 'web') {
      const col = this.kind === 'orb' ? '#ff70e0' : this.kind === 'ice' ? '#90e8ff' : '#ff8a30';
      G.Particles.add({ x: this.cx, y: this.cy, life: 14, size: this.r * 1.2, size2: 0, color: col, add: true });
    }
    const p = game.player;
    if (p && p.alive && G.overlap(this, p.hurtbox())) {
      if (p.hurt(this.dmg, game, this.cx)) this.dead = true;
      if (this.kind === 'web') { p.slow = 120; this.dead = true; }
    }
    if (this.x < game.cam.x - 200 || this.x > game.cam.x + G.W + 200 || this.y > game.level.h * 16 + 50) this.dead = true;
  }
  draw(c) {
    const x = this.cx, y = this.cy, r = this.r;
    if (this.kind === 'fire') {
      G.Gfx.glow(c, x, y, r * 3, '#ff6a20', 0.5);
      G.Gfx.circle(c, x, y, r, '#ff5a10');
      G.Gfx.circle(c, x - 0.5, y - 0.5, r * 0.6, '#ffd060');
    } else if (this.kind === 'orb') {
      G.Gfx.glow(c, x, y, r * 3, '#ff40d0', 0.55);
      G.Gfx.circle(c, x, y, r, '#c020a0');
      G.Gfx.circle(c, x, y, r * 0.55, '#ffd0f4');
    } else if (this.kind === 'ice') {
      G.Gfx.glow(c, x, y, r * 3, '#60d0ff', 0.5);
      c.save(); c.translate(x, y); c.rotate(this.t * 0.2);
      c.fillStyle = '#c8f4ff'; c.beginPath(); c.moveTo(0, -r); c.lineTo(r * 0.6, 0); c.lineTo(0, r); c.lineTo(-r * 0.6, 0); c.fill();
      c.restore();
    } else if (this.kind === 'web') {
      c.save(); c.translate(x, y); c.rotate(this.t * 0.1);
      c.strokeStyle = 'rgba(240,240,255,0.9)'; c.lineWidth = 0.8;
      for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-r * 1.3, 0); c.lineTo(r * 1.3, 0); c.stroke(); c.rotate(Math.PI / 4); }
      c.beginPath(); c.arc(0, 0, r * 0.8, 0, 7); c.stroke();
      c.restore();
    } else if (this.kind === 'rock') {
      c.save(); c.translate(x, y); c.rotate(this.t * 0.15);
      c.fillStyle = '#7a6a5a'; c.strokeStyle = '#1a140e'; c.lineWidth = 0.9;
      c.beginPath(); c.moveTo(-r, -r * 0.4); c.lineTo(-r * 0.3, -r); c.lineTo(r, -r * 0.5); c.lineTo(r * 0.8, r * 0.7); c.lineTo(-r * 0.5, r); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#9a8a7a'; c.fillRect(-r * 0.4, -r * 0.6, r * 0.6, r * 0.4);
      c.restore();
    }
  }
};

// Ударная волна по земле (для боссов)
G.Shockwave = class Shockwave extends G.Entity {
  constructor(x, groundY, dir, speed = 3.2) {
    super(x - 6, groundY - 18, 12, 18);
    this.vx = dir * speed;
    this.hostile = true;
    this.layer = 2;
  }
  update(game) {
    this.t++;
    this.x += this.vx;
    if (game.level.solidAt(this.cx + Math.sign(this.vx) * 6, this.y + 9) || this.t > 220) this.dead = true;
    if (this.t % 2 === 0) G.Particles.add({ x: this.cx, y: this.bottom - 2, vx: -this.vx * 0.2, vy: G.rand(-2, -0.5), g: 0.15, life: 20, size: 3, size2: 0, color: '#ffc070', add: true });
    const p = game.player;
    if (p && p.alive && G.overlap(this, p.hurtbox())) p.hurt(1, game, this.cx);
  }
  draw(c) {
    const h = 14 + Math.sin(this.t * 0.6) * 3;
    G.Gfx.glow(c, this.cx, this.bottom - 6, 18, '#ffa040', 0.5);
    c.fillStyle = '#ffd070';
    c.beginPath(); c.moveTo(this.x - 2, this.bottom); c.quadraticCurveTo(this.cx, this.bottom - h * 2, this.x + this.w + 2, this.bottom); c.fill();
    c.fillStyle = '#fff4c0';
    c.beginPath(); c.moveTo(this.x + 2, this.bottom); c.quadraticCurveTo(this.cx, this.bottom - h, this.x + this.w - 2, this.bottom); c.fill();
  }
};

// Предупреждение-«прицел» перед атакой
G.Warning = class Warning extends G.Entity {
  constructor(x, y, w, h, life = 50) { super(x, y, w, h); this.life = life; this.layer = 0; }
  update() { this.t++; if (this.t >= this.life) this.dead = true; }
  draw(c) {
    const a = 0.25 + Math.sin(this.t * 0.5) * 0.15;
    c.fillStyle = `rgba(255,40,60,${a})`;
    c.fillRect(this.x, this.y, this.w, this.h);
  }
};
