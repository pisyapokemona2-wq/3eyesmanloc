'use strict';
// Базовые сущности на спрайтах: предметы, чекпоинты, платформы, снаряды.
const SPR = (n, x, y, f, w) => G.Gfx.spr(n, x, y, f, w);
const FR = (a, t) => G.Art.frame(a, t);

G.Entity = class Entity {
  constructor(x, y, w, h) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.vx = 0; this.vy = 0;
    this.dead = false;
    this.t = 0;
    this.layer = 1;
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  get bottom() { return this.y + this.h; }
  update() { this.t++; }
  draw() {}
  onScreen(game, pad = 40) {
    return this.x + this.w > game.cam.x - pad && this.x < game.cam.x + G.W + pad && this.y + this.h > game.cam.y - pad && this.y < game.cam.y + G.H + pad;
  }
};

// --- Монеты -----------------------------------------------------------------
G.Coin = class Coin extends G.Entity {
  constructor(x, y, vx, vy, big = false, placed = false) {
    super(x - 4, y - 4, 8, 8);
    this.big = big;
    this.value = big ? 50 : 10;
    this.placed = placed;
    this.vx = vx || 0; this.vy = vy || 0;
    this.life = placed ? Infinity : 480;
    this.t = Math.floor(Math.random() * 60);
    this.baseY = this.y;
    this.delay = placed ? 0 : 14;
  }
  update(game) {
    this.t++;
    this.delay--;
    const p = game.player;
    const magnet = game.eyeMode ? 110 : 34;
    if (p && p.alive && this.delay <= 0) {
      const d = G.dist(this.cx, this.cy, p.cx, p.cy);
      if (d < magnet) {
        const k = 0.8 + (1 - d / magnet) * 2.5;
        this.x += ((p.cx - this.cx) / d) * k;
        this.y += ((p.cy - this.cy) / d) * k;
        this.placed = false;
        this.vx *= 0.8; this.vy *= 0.8;
      }
      if (G.overlap(this, p)) {
        this.dead = true;
        game.addCoins(this.value);
        G.Audio.play(this.big ? 'bigcoin' : 'coin');
        G.Particles.fx('fx_spark', this.cx, this.cy);
        return;
      }
    }
    if (this.placed) { this.y = this.baseY + (Math.floor(this.t / 20) % 2); return; }
    this.vy = Math.min(this.vy + 0.25, 5);
    const wv = this.vy;
    G.Physics.step(this, game.level);
    if (this.onGround && wv > 1) { this.vy = -wv * 0.5; this.onGround = false; }
    if (this.onGround) this.vx *= 0.85;
    if (this.hitL || this.hitR) this.vx *= -0.6;
    if (--this.life <= 0 || this.y > game.level.h * 16 + 40) this.dead = true;
  }
  draw() {
    if (this.life < 120 && Math.floor(this.life / 4) % 2 === 0) return;
    SPR(FR(this.big ? 'i_bigcoin' : 'i_coin', this.t), this.cx, this.cy);
  }
};

G.CoinPop = class CoinPop extends G.Entity {
  constructor(x, y) { super(x - 4, y - 10, 8, 8); this.vy = -4; this.layer = 0; }
  update() {
    this.t++; this.vy += 0.28; this.y += this.vy;
    if (this.t > 24) { this.dead = true; G.Particles.fx('fx_spark', this.cx, this.cy); }
  }
  draw() { SPR(FR('i_coin', this.t * 3), this.cx, this.cy); }
};

// --- Подбираемые предметы ---------------------------------------------------
G.Pickup = class Pickup extends G.Entity {
  constructor(kind, x, y, vy = 0, placed = false) {
    super(x - 6, y - 12, 12, 12);
    this.kind = kind;
    this.vy = vy;
    this.placed = placed;
    this.baseY = this.y;
    this.life = placed || kind === 'ability' ? Infinity : 600;
  }
  update(game) {
    this.t++;
    if (this.placed || this.kind === 'ability') this.y = this.baseY + Math.round(Math.sin(this.t * 0.06) * 2);
    else {
      this.vy = Math.min(this.vy + 0.22, 4);
      G.Physics.step(this, game.level);
      if (--this.life <= 0) this.dead = true;
    }
    if (this.kind === 'ability' && this.t % 4 === 0) G.Particles.add({ x: this.cx + G.rand(-8, 8), y: this.cy + G.rand(-8, 8), vy: -0.4, life: 24, color: G.pick(['#ffe060', '#9affc8', '#ff9af0']), kind: 'spark', add: true });
    const p = game.player;
    if (p && p.alive && G.overlap(this, p)) { this.dead = true; game.collect(this.kind, this.cx, this.cy, this); }
  }
  draw(c) {
    if (this.life < 120 && Math.floor(this.life / 4) % 2 === 0) return;
    const x = this.cx, y = this.cy;
    if (this.kind === 'heart') SPR(FR('i_heart', this.t), x, this.bottom);
    else if (this.kind === 'eye') { G.Gfx.glow(x, y, 12, '#3aff8a', 0.6); SPR(FR('i_eye', this.t), x, y); }
    else if (this.kind === 'life') SPR('i_life', x, this.bottom);
    else if (this.kind === 'ability') { G.Gfx.glow(x, y, 26, '#ffe060', 0.7); SPR(FR('i_ability', this.t), x, y); }
  }
};

// --- Чекпоинт ------------------------------------------------------------------
G.Checkpoint = class Checkpoint extends G.Entity {
  constructor(x, y) { super(x - 8, y - 32, 16, 32); this.active = false; this.layer = 0; }
  update(game) {
    this.t++;
    const p = game.player;
    if (!this.active && p && p.alive && p.cx > this.x) {
      this.active = true;
      game.setCheckpoint(this.cx, this.bottom);
      G.Audio.play('checkpoint');
      G.Particles.fx('fx_ring', this.cx, this.y + 6);
      G.Particles.sparks(this.cx, this.y + 6, 12, '#90ffc0', 2.4);
      G.Particles.text(this.cx, this.y - 10, 'ЧЕКПОИНТ', '#90ffc0');
    }
  }
  draw() {
    if (this.active) { G.Gfx.glow(this.cx, this.y + 6, 16, '#3aff8a', 0.5); SPR(FR('i_checkpoint_on', this.t), this.cx, this.bottom); }
    else SPR('i_checkpoint0', this.cx, this.bottom);
  }
};

// --- Пружина -----------------------------------------------------------------
G.Spring = class Spring extends G.Entity {
  constructor(x, y) { super(x - 8, y - 10, 16, 10); this.squash = 0; this.layer = 0; }
  update(game) {
    this.t++;
    if (this.squash > 0) this.squash--;
    const p = game.player;
    if (p && p.alive && p.vy > 0 && G.overlap(p, this) && p.bottom - p.vy <= this.y + 5) {
      p.y = this.y - p.h;
      p.vy = G.Input.down('jump') ? -11 : -9.5;
      p.onGround = false;
      p.springBoost = true;
      p.airJumps = 0;
      p.canDash = true;
      this.squash = 8;
      G.Audio.play('spring');
      G.Particles.dust(this.cx, this.y + 4);
    }
  }
  draw() { SPR(this.squash > 0 ? 'i_spring1' : 'i_spring0', this.cx, this.bottom); }
};

// --- Табличка ----------------------------------------------------------------
G.Sign = class Sign extends G.Entity {
  constructor(x, y, text) { super(x - 8, y - 18, 16, 18); this.text = text; this.layer = 0; this.show = 0; }
  update(game) {
    this.t++;
    const p = game.player;
    const near = p && Math.abs(p.cx - this.cx) < 44 && Math.abs(p.cy - this.cy) < 40;
    this.show = G.approach(this.show, near ? 1 : 0, 0.15);
  }
  draw(c, game) {
    SPR('i_sign', this.cx, this.bottom);
    if (this.show > 0.5 && this.text) game.bubbles.push({ x: this.cx, y: this.y - 6, text: this.text });
  }
};

G.Torch = class Torch extends G.Entity {
  constructor(x, y) { super(x - 4, y - 22, 8, 22); this.layer = 0; this.t = Math.floor(Math.random() * 100); }
  update() { this.t++; if (this.t % 9 === 0) G.Particles.add({ x: this.cx + G.rand(-1, 1), y: this.y + 2, vy: -0.5, life: 24, color: '#ffb040', kind: 'spark', add: true }); }
  draw() { G.Gfx.glow(this.cx, this.y + 4, 22, '#ff9a30', 0.45); SPR(FR('i_torch', this.t), this.cx, this.bottom); }
};

// --- Платформы ----------------------------------------------------------------
G.MovingPlatform = class MovingPlatform extends G.Entity {
  constructor(x, y, vertical) {
    super(x - 8, y - 16, 48, 8);
    this.isPlatform = true;
    this.vertical = vertical;
    this.ox = this.x; this.oy = this.y;
    this.dir = 1;
    this.speed = vertical ? 0.8 : 1;
    this.range = vertical ? 96 : 112;
    this.dx = 0; this.dy = 0;
    this.layer = 0;
  }
  update(game) {
    this.t++;
    const L = game.level, px = this.x, py = this.y;
    if (this.vertical) {
      this.y += this.speed * this.dir;
      const blocked = this.dir > 0 ? L.solidAt(this.x + 2, this.y + this.h) || L.solidAt(this.x + this.w - 2, this.y + this.h) : L.solidAt(this.x + 2, this.y) || L.solidAt(this.x + this.w - 2, this.y);
      if (Math.abs(this.y - this.oy) > this.range || blocked) { this.dir *= -1; this.y = py; }
    } else {
      this.x += this.speed * this.dir;
      const edge = this.dir > 0 ? this.x + this.w : this.x;
      if (Math.abs(this.x - this.ox) > this.range || L.solidAt(edge, this.y + 2)) { this.dir *= -1; this.x = px; }
    }
    this.dx = this.x - px;
    this.dy = this.y - py;
  }
  draw() { G.Art.draw(G.Gfx.ctx, 'i_platform', Math.round(this.x), Math.round(this.y)); }
};

// Восходящий поток (вентилятор): поднимает героя
G.Fan = class Fan extends G.Entity {
  constructor(x, y, level) {
    super(x - 12, y - 6, 24, 6);
    this.layer = 0;
    let top = Math.floor(y / 16) - 1, n = 0;
    while (n < 9 && !level.isSolid(Math.floor(x / 16), top)) { top--; n++; }
    this.top = (top + 1) * 16;
  }
  update(game) {
    this.t++;
    if (this.t % 3 === 0) G.Particles.add({ x: this.x + G.rand(2, 22), y: this.y, vy: -2.2 - Math.random(), life: Math.round((this.y - this.top) / 2.6), color: '#e8f4ff', kind: 'dot' });
    const p = game.player;
    if (p && p.alive && p.cx > this.x && p.cx < this.x + this.w && p.bottom > this.top && p.y < this.y) {
      p.vy = Math.max(p.vy - 0.75, -4.2);
      p.inWind = true;
    }
  }
  draw(c) {
    const x = Math.round(this.x), y = Math.round(this.y);
    c.fillStyle = '#2a2632'; c.fillRect(x, y, 24, 6);
    c.fillStyle = '#8a8698'; c.fillRect(x + 1, y + 1, 22, 1);
    c.fillStyle = '#5a5668';
    const s = Math.floor(this.t / 2) % 3;
    for (let i = 2 + s; i < 22; i += 3) c.fillRect(x + i, y + 2, 1, 3);
    c.fillStyle = 'rgba(220,240,255,0.08)'; c.fillRect(x + 2, this.top, 20, y - this.top);
  }
};

// --- Вражеские снаряды -------------------------------------------------------
const SHOT_ANIM = { fire: 'p_fire', orb: 'p_orb', web: 'p_web', ice: 'p_ice', rock: 'p_rock', snow: 'p_snow', feather: 'p_feather', bubble: 'p_bubble' };
const SHOT_GLOW = { fire: '#ff7020', orb: '#ff40d0', ice: '#80e0ff', bubble: '#a0ff60' };
G.EnemyShot = class EnemyShot extends G.Entity {
  constructor(x, y, vx, vy, kind = 'fire', opts = {}) {
    const r = opts.r || 3;
    super(x - r, y - r, r * 2, r * 2);
    this.vx = vx; this.vy = vy;
    this.kind = kind;
    this.grav = opts.g || 0;
    this.ghost = !!opts.ghost;
    this.life = opts.life || 300;
    this.dmg = opts.dmg || 1;
    this.hostile = true;
    this.layer = 2;
  }
  update(game) {
    this.t++;
    this.vy += this.grav;
    this.x += this.vx; this.y += this.vy;
    if (--this.life <= 0) this.dead = true;
    if (!this.ghost && game.level.solidAt(this.cx, this.cy)) {
      this.dead = true;
      G.Particles.fx('fx_hit', this.cx, this.cy);
      if (this.kind === 'rock' || this.kind === 'snow') G.Particles.debris(this.cx, this.cy, 4, this.kind === 'snow' ? ['#ffffff', '#c8e0f0'] : ['#7a6a5a', '#5a4a3a'], 1.2);
    }
    const p = game.player;
    if (p && p.alive && G.overlap(this, p.hurtbox())) {
      if (this.kind === 'web') { p.slow = 120; this.dead = true; G.Audio.play('bump'); }
      else if (p.hurt(this.dmg, game, this.cx)) this.dead = true;
    }
    const cam = game.cam;
    if (this.x < cam.x - 120 || this.x > cam.x + G.W + 120 || this.y > cam.y + G.H + 120 || this.y < cam.y - 200) this.dead = true;
  }
  draw() {
    if (SHOT_GLOW[this.kind]) G.Gfx.glow(this.cx, this.cy, 9, SHOT_GLOW[this.kind], 0.6);
    SPR(FR(SHOT_ANIM[this.kind] || 'p_fire', this.t), this.cx, this.cy, this.vx < 0);
  }
};

// Ударная волна по земле
G.Shockwave = class Shockwave extends G.Entity {
  constructor(x, groundY, dir, speed = 2.6) {
    super(x - 5, groundY - 14, 10, 14);
    this.vx = dir * speed;
    this.hostile = true;
    this.layer = 2;
  }
  update(game) {
    this.t++;
    this.x += this.vx;
    if (game.level.solidAt(this.cx + Math.sign(this.vx) * 6, this.y + 7) || this.t > 200) this.dead = true;
    if (this.t % 2 === 0) G.Particles.add({ x: this.cx, y: this.bottom - 1, vx: -this.vx * 0.2, vy: G.rand(-2, -0.6), g: 0.12, life: 18, color: G.pick(['#ffd070', '#ff9040', '#fff4c0']), add: true });
    const p = game.player;
    if (p && p.alive && G.overlap(this, p.hurtbox())) p.hurt(1, game, this.cx);
  }
  draw(c) {
    const h = 8 + (this.t % 6 < 3 ? 2 : 0), x = Math.round(this.x), b = Math.round(this.bottom);
    G.Gfx.glow(this.cx, b - 5, 12, '#ff9040', 0.6);
    c.fillStyle = '#ff9a30'; c.fillRect(x, b - h, 10, h);
    c.fillStyle = '#ffd870'; c.fillRect(x + 2, b - h + 2, 6, h - 2);
    c.fillStyle = '#fff4d0'; c.fillRect(x + 4, b - h + 3, 2, h - 3);
  }
};

G.Warning = class Warning extends G.Entity {
  constructor(x, y, w, h, life = 50) { super(x, y, w, h); this.life = life; this.layer = 0; }
  update() { this.t++; if (this.t >= this.life) this.dead = true; }
  draw(c) {
    if (this.t % 8 < 4) return;
    c.fillStyle = 'rgba(255,40,60,0.28)';
    c.fillRect(Math.round(this.x), Math.round(this.y), Math.round(this.w), Math.round(this.h));
  }
};

// Зона подсказки: пока герой в ней — внизу экрана крупная плашка с клавишами
G.HintZone = class HintZone extends G.Entity {
  constructor(x, y, text) { super(x - 40, y - 400, 230, 420); this.text = text; this.layer = 0; this.done = false; }
  update(game) {
    const p = game.player;
    if (!this.done && p && p.alive && p.cx > this.x && p.cx < this.x + this.w) game.hint = this.text;
  }
  onScreen() { return false; }
};
// Мишень на стене: «брось копьё сюда»
G.SpearTarget = class SpearTarget extends G.Entity {
  constructor(x, y) { super(x - 6, y - 6, 12, 12); this.layer = 2; this.hidden = false; }
  update(game) {
    this.t++;
    const sp = game.player && game.player.spear;
    if (sp && sp.state === 'stuck' && Math.abs(sp.cy - this.cy) < 24 && Math.abs((sp.dir > 0 ? sp.x + sp.w : sp.x) - this.cx) < 16) this.hidden = true;
  }
  draw(c) {
    if (this.hidden) return;
    const k = Math.floor(this.t / 8) % 2, x = Math.round(this.cx), y = Math.round(this.cy);
    G.Gfx.glow(x, y, 12, '#ffe060', 0.5);
    c.fillStyle = k ? '#ffe060' : '#ff9a30';
    // кольцо-мишень 9×9
    c.fillRect(x - 2, y - 5, 5, 1); c.fillRect(x - 2, y + 4, 5, 1); c.fillRect(x - 5, y - 2, 1, 5); c.fillRect(x + 4, y - 2, 1, 5);
    c.fillRect(x - 4, y - 4, 2, 1); c.fillRect(x + 3, y - 4, 2, 1); c.fillRect(x - 4, y + 3, 2, 1); c.fillRect(x + 3, y + 3, 2, 1);
    c.fillRect(x - 4, y - 3, 1, 1); c.fillRect(x + 4, y - 3, 1, 1); c.fillRect(x - 4, y + 3, 1, 1); c.fillRect(x + 4, y + 3, 1, 1);
    c.fillRect(x, y, 1, 1);
    // стрелка слева «бросай сюда»
    const ax = x - 14 - (this.t % 30 < 15 ? 0 : 2);
    c.fillRect(ax, y, 6, 1); c.fillRect(ax + 4, y - 2, 1, 5); c.fillRect(ax + 5, y - 1, 1, 3);
  }
};
