'use strict';
// Ловушки и механики: огненная вертушка, давилка, пила, сосулька, валуны,
// маятник-булава, гейзер, поднимающаяся лава, секретные медальоны.
const HZ = (n, x, y, f, w) => G.Gfx.spr(n, x, y, f, w);
const hitP = (game, box, dmg = 1, fromX) => {
  const p = game.player;
  if (p && p.alive && G.overlap(box, p.hurtbox())) p.hurt(dmg, game, fromX === undefined ? box.x + box.w / 2 : fromX);
};

G.FireBar = class FireBar extends G.Entity {
  constructor(x, y, dir = 1, n = 4) { super(x - 6, y - 6, 12, 12); this.n = n; this.a = Math.random() * 6; this.sp = 0.028 * dir; this.layer = 2; }
  balls() { const out = []; for (let i = 1; i <= this.n; i++) out.push([this.cx + Math.cos(this.a) * i * 9, this.cy + Math.sin(this.a) * i * 9]); return out; }
  update(game) {
    this.t++; this.a += this.sp;
    if (!this.onScreen(game, 80)) return;
    for (const [x, y] of this.balls()) hitP(game, { x: x - 3, y: y - 3, w: 6, h: 6 });
  }
  onScreen(game, pad = 80) { return super.onScreen(game, pad); }
  draw() {
    HZ('h_firebar_hub', this.cx, this.cy);
    for (const [x, y] of this.balls()) { G.Gfx.glow(x, y, 8, '#ff7020', 0.5); HZ(G.Art.frame('h_firebar_ball', this.t), x, y); }
  }
};

// Давилка: ждёт героя под собой, падает, отдыхает (на ней можно стоять), поднимается
G.Crusher = class Crusher extends G.Entity {
  constructor(x, y) { super(x - 8, y - 16, 32, 32); this.oy = this.y; this.state = 'idle'; this.st = 0; this.isPlatform = true; this.dx = 0; this.dy = 0; this.layer = 1; }
  update(game) {
    this.t++; this.st++;
    const p = game.player, L = game.level, py = this.y;
    switch (this.state) {
      case 'idle':
        if (p && p.alive && p.cx > this.x - 4 && p.cx < this.x + this.w + 4 && p.y > this.y && p.y - this.bottom < 160) { this.state = 'shake'; this.st = 0; }
        break;
      case 'shake': if (this.st > 22) { this.state = 'fall'; this.st = 0; this.vy = 1; } break;
      case 'fall':
        this.vy = Math.min(this.vy + 0.7, 9);
        this.y += this.vy;
        hitP(game, this, 2);
        for (const e of game.targets()) if (!e.isBoss && G.overlap(e, this)) e.hurt(10, game, null);
        if (L.solidAt(this.x + 2, this.bottom) || L.solidAt(this.x + this.w - 2, this.bottom) || this.y > L.h * 16) {
          this.y = Math.floor(this.bottom / 16) * 16 - this.h;
          this.state = 'rest'; this.st = 0;
          game.shake(4, 10); G.Audio.play('explode');
          G.Particles.dust(this.x + 4, this.bottom, 3); G.Particles.dust(this.x + this.w - 4, this.bottom, 3);
        }
        break;
      case 'rest': if (this.st > 60) { this.state = 'rise'; this.st = 0; } break;
      case 'rise':
        this.y = Math.max(this.oy, this.y - 0.8);
        if (this.y <= this.oy) { this.state = 'idle'; this.st = 0; }
        break;
    }
    this.dx = 0; this.dy = this.state === 'rise' ? this.y - py : 0;
    this.isPlatform = this.state !== 'fall';
    // боковое касание тоже больно, когда падает
  }
  draw() {
    const sx = this.state === 'shake' && this.t % 4 < 2 ? 1 : 0;
    G.Art.draw(G.Gfx.ctx, this.state === 'fall' || this.state === 'shake' ? 'h_crusher1' : 'h_crusher0', Math.round(this.x + sx), Math.round(this.y));
  }
};

G.Saw = class Saw extends G.Entity {
  constructor(x, y, level) { super(x - 7, y - 15, 14, 14); this.ox = this.x; this.dir = 1; this.sp = 1.3; this.range = 80; this.layer = 1; this.level = level; }
  update(game) {
    this.t++;
    this.x += this.dir * this.sp;
    const edge = this.dir > 0 ? this.x + this.w : this.x;
    if (Math.abs(this.x - this.ox) > this.range || game.level.solidAt(edge, this.cy)) { this.dir *= -1; this.x += this.dir * this.sp * 2; }
    if (this.t % 4 === 0) G.Particles.add({ x: this.cx, y: this.bottom, vx: -this.dir * G.rand(0.5, 1.5), vy: G.rand(-1.5, -0.5), g: 0.1, life: 12, color: '#ffd070', kind: 'spark', add: true });
    hitP(game, { x: this.x + 2, y: this.y + 2, w: this.w - 4, h: this.h - 4 });
  }
  draw(c) {
    HZ(G.Art.frame('h_saw', this.t), this.cx, this.cy);
  }
};

// Сосулька: висит под потолком, падает, когда герой рядом, и вырастает снова
G.Icicle = class Icicle extends G.Entity {
  constructor(x, y, level) {
    super(x - 4, y, 8, 16);
    let ty = Math.floor((y - 1) / 16);
    while (ty > 0 && !level.isSolid(Math.floor(x / 16), ty - 1)) ty--;
    this.oy = this.y = ty * 16;
    this.state = 'hang'; this.st = 0; this.layer = 1;
  }
  update(game) {
    this.t++; this.st++;
    const p = game.player;
    if (this.state === 'hang') { if (p && p.alive && Math.abs(p.cx - this.cx) < 28 && p.y > this.y) { this.state = 'shake'; this.st = 0; } }
    else if (this.state === 'shake') { if (this.st > 20) { this.state = 'fall'; this.vy = 0; } }
    else if (this.state === 'fall') {
      this.vy = Math.min(this.vy + 0.4, 7); this.y += this.vy;
      hitP(game, this);
      if (game.level.solidAt(this.cx, this.bottom)) {
        G.Particles.debris(this.cx, this.bottom - 4, 6, ['#d8f4ff', '#a0d8f0', '#ffffff'], 1.4);
        G.Audio.play('crumble');
        this.state = 'gone'; this.st = 0;
      }
    } else if (this.state === 'gone' && this.st > 240) { this.state = 'grow'; this.st = 0; this.y = this.oy; }
    else if (this.state === 'grow' && this.st > 40) this.state = 'hang';
  }
  draw(c) {
    if (this.state === 'gone') return;
    if (this.state === 'grow') { const k = this.st / 40; c.globalAlpha = k; }
    const ox = this.state === 'shake' && this.t % 4 < 2 ? 1 : 0;
    G.Art.draw(G.Gfx.ctx, this.state === 'shake' ? 'h_icicle_shake' : 'h_icicle', Math.round(this.cx + ox), Math.round(this.y));
    c.globalAlpha = 1;
  }
};

G.Boulder = class Boulder extends G.Entity {
  constructor(x, y, dir) { super(x - 10, y - 20, 20, 20); this.vx = dir * 1.8; this.layer = 1; }
  update(game) {
    this.t++;
    this.vy = Math.min(this.vy + 0.3, 6);
    const was = this.vy;
    G.Physics.step(this, game.level);
    if (this.onGround && was > 2) { this.vy = -was * 0.35; game.shake(1, 4); }
    if (this.hitL || this.hitR || this.y > game.level.h * 16) {
      this.dead = true;
      G.Particles.debris(this.cx, this.cy, 8, game.level.cfg.debris, 2);
      G.Audio.play('brick');
      return;
    }
    hitP(game, this, 1);
    for (const e of game.targets()) if (!e.isBoss && G.overlap(e, this)) e.hurt(5, game, this);
  }
  draw() { const k = ((Math.floor(this.x / 5) % 4) + 4) % 4; HZ('h_boulder' + (this.vx > 0 ? k : 3 - k), this.cx, this.cy); }
};
G.BoulderSpawner = class BoulderSpawner extends G.Entity {
  constructor(x, y, dir) { super(x - 8, y - 16, 16, 16); this.dir = dir; this.layer = 0; this.t = 120; }
  update(game) {
    this.t++;
    if (this.t % 200 === 0 && Math.abs(game.player.cx - this.cx) < 420) { game.spawn(new G.Boulder(this.cx, this.bottom, this.dir)); G.Audio.play('stomp'); }
  }
  onScreen() { return false; }
};

// Маятник-булава на цепи
G.Mace = class Mace extends G.Entity {
  constructor(x, y, level) {
    super(x - 2, y - 16, 4, 4);
    let ty = Math.floor((y - 1) / 16);
    while (ty > 0 && !level.isSolid(Math.floor(x / 16), ty - 1)) ty--;
    this.px = x; this.py = ty * 16; this.len = 58; this.ph = Math.random() * 6; this.layer = 2;
  }
  ball() { const a = Math.sin(this.t * 0.035 + this.ph) * 1.15; return [this.px + Math.sin(a) * this.len, this.py + Math.cos(a) * this.len]; }
  update(game) { this.t++; const [x, y] = this.ball(); hitP(game, { x: x - 6, y: y - 6, w: 12, h: 12 }); }
  onScreen(game) { return Math.abs(this.px - game.cam.x - G.W / 2) < G.W; }
  draw() {
    const [bx, by] = this.ball();
    for (let i = 0; i <= 6; i++) HZ('h_chain', G.lerp(this.px, bx, i / 7), G.lerp(this.py, by, i / 7));
    HZ('h_mace', bx, by);
  }
};

// Гейзер: периодически бьёт струёй и подбрасывает героя
G.Geyser = class Geyser extends G.Entity {
  constructor(x, y) { super(x - 8, y - 96, 16, 96); this.base = y; this.t = Math.floor(Math.random() * 120); this.layer = 0; }
  get on() { return this.t % 180 > 110; }
  update(game) {
    this.t++;
    const p = game.player;
    if (this.on && p && p.alive && p.cx > this.x && p.cx < this.x + this.w && p.bottom > this.base - 96 && p.y < this.base) { p.vy = Math.min(p.vy, -7.8); p.onGround = false; p.airJumps = 0; p.canDash = true; }
    if (this.t % 180 === 111) { G.Audio.play('spring'); G.Particles.fx('fx_splash', this.cx, this.base); }
    if (!this.on && this.t % 10 === 0) G.Particles.add({ x: this.cx + G.rand(-3, 3), y: this.base - 2, vy: -0.6, life: 20, color: '#e8f4ff' });
  }
  draw() {
    const k = this.t % 180;
    if (k <= 110) { G.Gfx.spr('h_geyser0', this.cx, this.base); return; }
    const f = k < 118 ? 'h_geyser1' : G.Art.frame('h_geyser', this.t);
    // столб из двух сегментов 48 px
    G.Gfx.spr(f, this.cx, this.base);
    if (k >= 118) G.Gfx.spr(f, this.cx, this.base - 46);
  }
};

// Поднимающаяся жидкость: включается, когда герой входит в зону
G.RisingLiquid = class RisingLiquid extends G.Entity {
  constructor(x, level) { super(x, 0, 16, 16); this.level = level; this.level0 = level.h * 16 + 8; this.yLevel = this.level0; this.active = false; this.layer = 2; this.stop = 3 * 16; }
  update(game) {
    this.t++;
    const p = game.player;
    if (!this.active && p.cx > this.x && p.alive) { this.active = true; G.Audio.play('roar'); game.shake(3, 30); G.UI.toast('ЛАВА ПОДНИМАЕТСЯ! ВВЕРХ!'); }
    if (!this.active) return;
    if (game.bossStarted || p.cx > this.x + 40 * 16) { this.yLevel += 2; if (this.yLevel > this.level0) this.dead = true; return; }
    this.yLevel = Math.max(this.stop, this.yLevel - 0.42);
    if (p.alive && p.bottom > this.yLevel + 4) {
      p.hurt(1, game, p.cx);
      if (p.alive) { p.vy = -8.5; p.onGround = false; p.airJumps = 0; p.canDash = true; }
    }
    if (this.t % 6 === 0) G.Particles.add({ x: game.cam.x + Math.random() * G.W, y: this.yLevel, vy: -1, g: 0.05, life: 20, color: '#ffb040', kind: 'spark', add: true });
  }
  onScreen() { return this.active; }
  draw(c, game) {
    const th = game.level.theme, y = Math.round(this.yLevel);
    const x0 = Math.floor(game.cam.x / 16) * 16;
    G.Gfx.glow(game.cam.x + G.W / 2, y, 120, '#ff5010', 0.25);
    for (let x = x0; x < game.cam.x + G.W + 16; x += 16) {
      G.Art.draw(c, G.Art.frame(`t_${th}_liquid`, game.frame + x / 16 * 3), x, y);
      for (let yy = y + 16; yy < game.cam.y + G.H + 16; yy += 16) G.Art.draw(c, `t_${th}_liquidFill`, x, yy);
    }
  }
};

// Секретный медальон (3 на этап)
G.Glyph = class Glyph extends G.Entity {
  constructor(x, y, idx) { super(x - 7, y - 14, 14, 14); this.idx = idx; this.baseY = this.y; this.layer = 1; }
  update(game) {
    this.t++;
    this.y = this.baseY + Math.round(Math.sin(this.t * 0.07) * 2);
    if (this.t % 5 === 0) G.Particles.add({ x: this.cx + G.rand(-7, 7), y: this.cy + G.rand(-7, 7), vy: -0.3, life: 20, color: '#ffe060', kind: 'spark', add: true });
    const p = game.player;
    if (p && p.alive && G.overlap(this, p)) {
      this.dead = true;
      game.collectGlyph(this.idx, this.cx, this.cy);
    }
  }
  draw() { G.Gfx.glow(this.cx, this.cy, 14, '#ffe060', 0.6); HZ(G.Art.frame('i_glyph', this.t), this.cx, this.cy); }
};
