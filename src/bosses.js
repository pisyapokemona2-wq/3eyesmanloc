'use strict';
// Боссы. Общая логика (вступление, урон, взрывная гибель) — в базовом классе.
const BO = '#140c18';

G.Boss = class Boss extends G.Enemy {
  constructor(game, w, h, hp, kind) {
    super(0, 0, w, h, hp);
    this.isBoss = true;
    this.kind = kind;
    this.name = G.BOSS_NAMES[kind];
    this.stompable = false;
    this.arena = game.arena;
    this.st = 0;          // таймер текущего состояния
    this.state = 'intro';
    this.dying = false;
    this.dyingT = 0;
    this.active = true;
    this.facing = -1;
    this.dmgMul = 1;
  }
  get phase2() { return this.hp <= this.maxHp / 2; }
  set(state) { this.state = state; this.st = 0; }
  hurt(d, game, src) {
    if (this.dying || this.state === 'intro' || this.invulnerable) {
      if (!this.dying && src) G.Particles.sparks(src.cx || this.cx, src.cy || this.cy, 4, '#aaaaaa', 2);
      return;
    }
    const wasP2 = this.phase2;
    this.hp -= d * this.dmgMul;
    this.flash = 6;
    G.Audio.play('bossHit');
    if (this.hp <= 0) {
      this.hp = 0;
      this.dying = true;
      this.dyingT = 0;
      G.Audio.stopMusic(0.5);
      game.hitstop(14);
      game.shake(6, 30);
      game.clearHostiles();
    } else if (!wasP2 && this.phase2) this.onPhase2(game);
  }
  onPhase2(game) {
    G.Audio.play('roar');
    game.shake(4, 30);
    G.Particles.ring(this.cx, this.cy, '#ff5050', 60, 30);
  }
  updateDying(game) {
    this.dyingT++;
    this.flash = this.dyingT % 8 < 4 ? 4 : 0;
    if (this.dyingT % 7 === 0) {
      G.Particles.explosion(this.x + Math.random() * this.w, this.y + Math.random() * this.h, 0.9 + Math.random() * 0.6);
      G.Audio.play('explode');
      game.shake(3, 6);
    }
    if (this.dyingT === 150) {
      G.Particles.explosion(this.cx, this.cy, 2.5);
      G.Audio.play('explode');
      game.shake(8, 25);
      game.flashScreen('#ffffff', 20);
      this.dead = true;
      game.onBossDefeated(this);
    }
  }
  contact(game, dmg = 1) {
    const p = game.player;
    if (!p || !p.alive || this.dying || this.state === 'intro') return;
    if (this.hitTest(p.hurtbox())) {
      if (game.eyeMode > 0) return;
      p.hurt(dmg, game, this.cx);
    }
  }
  shootAt(game, x, y, speed, kind = 'fire', spread = 0, opts = {}) {
    const p = game.player;
    const a = Math.atan2(p.cy - y, p.cx - x) + spread;
    game.spawn(new G.EnemyShot(x, y, Math.cos(a) * speed, Math.sin(a) * speed, kind, opts));
  }
  ring(game, x, y, n, speed, kind = 'orb', off = 0, opts = {}) {
    for (let i = 0; i < n; i++) {
      const a = off + (i / n) * Math.PI * 2;
      game.spawn(new G.EnemyShot(x, y, Math.cos(a) * speed, Math.sin(a) * speed, kind, Object.assign({ ghost: true, life: 260 }, opts)));
    }
  }
  update(game) {
    this.t++;
    this.st++;
    if (this.flash > 0) this.flash--;
    if (this.dying) { this.updateDying(game); return; }
    if (this.state === 'intro') {
      if (this.st > 100) this.set('idle');
      this.introUpdate && this.introUpdate(game);
      return;
    }
    this.think(game);
  }
  drawFlash(c, fn) {
    fn();
    if (this.flash > 0) {
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = 0.65;
      fn();
      c.restore();
    }
  }
};

// =============================================================================
// 1. СТАЛЬНОЙ БЫК — разгоняется и таранит стены, прыгает с ударной волной
// =============================================================================
G.BossBull = class BossBull extends G.Boss {
  constructor(game) {
    super(game, 62, 44, 45, 'bull');
    this.x = this.arena.x + 470;
    this.y = this.arena.floor - this.h;
    this.legT = 0;
  }
  think(game) {
    const p = game.player, A = this.arena;
    const fast = this.phase2;
    const left = A.x + 17, right = A.x + 623;
    this.dmgMul = this.state === 'stun' ? 1.5 : 1;
    switch (this.state) {
      case 'idle':
        this.vx = 0;
        this.facing = p.cx < this.cx ? -1 : 1;
        if (this.st % 20 === 0) G.Particles.dust(this.cx + this.facing * 20, this.bottom, 3);
        if (this.st > (fast ? 28 : 50)) this.set(Math.random() < 0.6 ? 'prep' : 'jump');
        if (this.state === 'jump') {
          this.vy = -8.2;
          const tx = G.clamp(p.cx, left + 40, right - 40);
          this.vx = (tx - this.cx) / 54;
          G.Audio.play('jump');
        }
        break;
      case 'prep':
        if (this.st % 6 === 0) G.Particles.add({ x: this.cx + this.facing * 30, y: this.y + 14, vx: this.facing * 1.5, vy: -0.6, life: 25, size: 5, size2: 12, color: '#e8e8f0', alpha: 0.6, kind: 'puff' });
        if (this.st === 1) { G.Audio.play('roar'); game.spawn(new G.Warning(left, this.y, right - left, this.h, 34)); }
        if (this.st > 34) this.set('charge');
        break;
      case 'charge':
        this.vx = this.facing * (fast ? 6.6 : 5.4);
        this.legT += 0.6;
        if (this.st % 3 === 0) G.Particles.dust(this.cx - this.facing * 26, this.bottom, 2, '#c8b8a8');
        if ((this.facing < 0 && this.x <= left) || (this.facing > 0 && this.x + this.w >= right)) {
          this.x = this.facing < 0 ? left : right - this.w;
          this.set('stun');
          G.Audio.play('explode');
          game.shake(7, 22);
          G.Particles.debris(this.facing < 0 ? left : right, this.cy, 14, ['#8a8a9a', '#5a5a6a', '#c0c0d0'], 3);
          // с потолка сыплются обломки
          const n = fast ? 7 : 5;
          for (let i = 0; i < n; i++) {
            const rx = A.x + 40 + Math.random() * 560;
            game.spawn(new G.Warning(rx - 6, 0, 12, A.floor, 30 + i * 6));
            game.later(30 + i * 6, () => game.spawn(new G.EnemyShot(rx, -10, 0, 1, 'rock', { g: 0.22, r: 6, life: 200 })));
          }
        }
        break;
      case 'stun':
        this.vx = 0;
        if (this.st > 80) this.set('idle');
        break;
      case 'jump':
        this.vy += 0.3;
        this.legT += 0.2;
        if (this.y + this.h + this.vy >= A.floor && this.vy > 0) {
          this.y = A.floor - this.h;
          this.vy = 0;
          this.vx = 0;
          game.shake(5, 14);
          G.Audio.play('explode');
          G.Particles.dust(this.cx, this.bottom, 14);
          game.spawn(new G.Shockwave(this.cx - 20, A.floor, -1, fast ? 3.8 : 3));
          game.spawn(new G.Shockwave(this.cx + 20, A.floor, 1, fast ? 3.8 : 3));
          this.set('idle');
        }
        break;
    }
    this.x = G.clamp(this.x + this.vx, left, right - this.w);
    this.y += this.vy;
    this.contact(game, this.state === 'charge' ? 2 : 1);
  }
  draw(c) {
    this.drawFlash(c, () => {
      const x = this.cx, b = this.bottom;
      c.save();
      c.translate(x, b);
      c.scale(this.facing, 1);
      const charging = this.state === 'charge';
      const lt = this.legT;
      const shakeX = this.state === 'prep' ? Math.sin(this.t * 2) * 1.2 : 0;
      c.translate(shakeX, 0);
      // ноги-поршни
      const legs = [[-20, 0], [-10, Math.PI], [12, Math.PI / 2], [22, Math.PI * 1.5]];
      for (const [lx, ph] of legs) {
        const k = charging || this.state === 'jump' ? Math.sin(lt + ph) * 5 : 0;
        G.Gfx.limb(c, lx, -16, lx + k, -2, 6, '#4a4e66', BO);
        c.fillStyle = '#2a2c3a'; G.Gfx.rr(c, lx + k - 4.5, -4, 9, 4, 1.5); c.fill(); c.strokeStyle = BO; c.lineWidth = 1; c.stroke();
      }
      // корпус
      const grd = c.createLinearGradient(0, -44, 0, -12);
      grd.addColorStop(0, '#a8b0cc'); grd.addColorStop(1, '#5a6080');
      c.fillStyle = grd;
      G.Gfx.rr(c, -30, -40, 50, 26, 10); c.fill();
      c.strokeStyle = BO; c.lineWidth = 1.3; c.stroke();
      // броневые пластины и заклёпки
      c.strokeStyle = 'rgba(20,12,24,0.5)'; c.lineWidth = 0.9;
      c.beginPath(); c.moveTo(-14, -40); c.lineTo(-14, -14); c.moveTo(2, -40); c.lineTo(2, -14); c.stroke();
      c.fillStyle = '#e0e4f0';
      for (let i = -26; i < 18; i += 6) { c.beginPath(); c.arc(i, -36, 0.9, 0, 7); c.fill(); }
      c.fillStyle = 'rgba(255,255,255,0.4)'; c.fillRect(-24, -38, 36, 2);
      // горб с выхлопной трубой
      c.fillStyle = '#6a7090';
      G.Gfx.rr(c, -24, -47, 10, 9, 2); c.fill(); c.stroke();
      if (this.t % 10 === 0) G.Particles.add({ x: this.cx - this.facing * 19, y: this.y - 4, vy: -0.8, vx: -this.facing * 0.3, life: 30, size: 3, size2: 9, color: '#6a6a7a', alpha: 0.5, kind: 'puff' });
      // голова
      c.save();
      c.translate(24, -28 + (charging ? 6 : 0));
      c.rotate(charging ? 0.35 : 0);
      c.fillStyle = '#8890b0';
      G.Gfx.rr(c, -8, -10, 20, 18, 5); c.fill(); c.stroke();
      // рога
      c.fillStyle = '#ffcc40';
      for (const s of [-1, 1]) {
        c.beginPath();
        c.moveTo(-2, -8 + s * 0); c.quadraticCurveTo(-4, -20 - s * 2, 6 + s * 3, -24 + s * 2); c.lineTo(3, -16); c.lineTo(4, -8);
        c.closePath(); c.fill(); c.stroke();
        if (s > 0) break;
      }
      c.beginPath(); c.moveTo(2, -9); c.quadraticCurveTo(10, -20, 18, -20); c.lineTo(10, -13); c.lineTo(8, -8); c.closePath(); c.fill(); c.stroke();
      // глаза-визор
      const eyeC = this.state === 'stun' ? '#6a6a6a' : this.phase2 ? '#ff2a2a' : '#ff8a2a';
      c.fillStyle = '#1a1020'; c.fillRect(1, -6, 10, 4);
      G.Gfx.glow(c, 7, -4, 10, eyeC, 0.7);
      c.fillStyle = eyeC; c.fillRect(3, -5.2, 7, 2.2);
      // ноздри и кольцо
      c.fillStyle = '#5a6080'; G.Gfx.rr(c, 6, 1, 8, 6, 2); c.fill(); c.stroke();
      G.Gfx.circle(c, 11, 8, 2.6, null, '#ffcc40', 1.4);
      c.restore();
      // хвост-кабель
      c.strokeStyle = BO; c.lineWidth = 2.4;
      c.beginPath(); c.moveTo(-30, -30); c.quadraticCurveTo(-40, -26 + Math.sin(this.t * 0.2) * 3, -38, -16); c.stroke();
      c.strokeStyle = '#ffcc40'; c.lineWidth = 1; c.stroke();
      if (this.state === 'stun') {
        for (let i = 0; i < 3; i++) {
          const a = this.t * 0.12 + i * 2.1;
          c.fillStyle = '#ffe060';
          c.save(); c.translate(24 + Math.cos(a) * 12, -52 + Math.sin(a) * 4); c.rotate(a);
          c.beginPath(); for (let k = 0; k < 5; k++) { const aa = (k / 5) * Math.PI * 2; c.lineTo(Math.cos(aa) * 3, Math.sin(aa) * 3); c.lineTo(Math.cos(aa + 0.6) * 1.3, Math.sin(aa + 0.6) * 1.3); } c.fill();
          c.restore();
        }
      }
      c.restore();
    });
  }
};

// =============================================================================
// 2. КАМЕННЫЙ ИДОЛ — парящая маска: веер огня, удары о землю
// =============================================================================
G.BossIdol = class BossIdol extends G.Boss {
  constructor(game) {
    super(game, 64, 64, 55, 'idol');
    this.x = this.arena.x + 288;
    this.y = 40;
    this.hx = this.x; this.hy = this.y;
    this.cool = 60;
    this.introUpdate = () => { this.y = G.lerp(-80, 50, G.easeOutCubic(Math.min(1, this.st / 80))); this.hy = this.y; };
  }
  think(game) {
    const p = game.player, A = this.arena;
    const fast = this.phase2;
    switch (this.state) {
      case 'idle': {
        const tx = A.x + 320 + Math.sin(this.t * 0.013) * 210 - this.w / 2;
        const ty = 60 + Math.sin(this.t * 0.026) * 34;
        this.x = G.lerp(this.x, tx, 0.04);
        this.y = G.lerp(this.y, ty, 0.04);
        if (--this.cool <= 0) {
          const r = Math.random();
          if (r < 0.4) this.set('spread');
          else if (r < 0.75) this.set('slamAim');
          else this.set(fast ? 'ring' : 'spread');
        }
        break;
      }
      case 'spread':
        if (this.st === 20 || (fast && this.st === 50)) {
          G.Audio.play('enemyShot');
          for (let i = -2; i <= 2; i++) this.shootAt(game, this.cx, this.cy + 10, 2.6, 'fire', i * 0.22);
        }
        if (this.st > 70) { this.set('idle'); this.cool = fast ? 50 : 80; }
        break;
      case 'ring':
        if (this.st % 20 === 1 && this.st < 70) { this.ring(game, this.cx, this.cy, 10, 1.8, 'orb', this.st * 0.05); G.Audio.play('enemyShot'); }
        if (this.st > 90) { this.set('idle'); this.cool = 50; }
        break;
      case 'slamAim':
        this.x = G.lerp(this.x, G.clamp(p.cx - this.w / 2, A.x + 20, A.x + 620 - this.w), 0.08);
        this.y = G.lerp(this.y, 40, 0.08);
        if (this.st === 30) { G.Audio.play('roar'); game.spawn(new G.Warning(this.x, this.y, this.w, A.floor - this.y, 26)); }
        if (this.st > 56) { this.set('slam'); this.vy = 2; }
        break;
      case 'slam':
        this.vy += 0.9;
        this.y += this.vy;
        if (this.y + this.h >= A.floor) {
          this.y = A.floor - this.h;
          G.Audio.play('explode');
          game.shake(7, 20);
          G.Particles.dust(this.cx, A.floor, 20);
          G.Particles.debris(this.cx, A.floor - 4, 10, ['#8a7a5a', '#6a5a3a'], 3);
          game.spawn(new G.Shockwave(this.x - 4, A.floor, -1, fast ? 4 : 3.2));
          game.spawn(new G.Shockwave(this.x + this.w + 4, A.floor, 1, fast ? 4 : 3.2));
          this.set('rest');
        }
        break;
      case 'rest':
        this.dmgMul = 1.5;
        if (this.st > (fast ? 40 : 70)) { this.set('rise'); this.dmgMul = 1; }
        break;
      case 'rise':
        this.y = G.lerp(this.y, 60, 0.05);
        if (this.st > 50) { this.set('idle'); this.cool = 40; }
        break;
    }
    this.contact(game, this.state === 'slam' ? 2 : 1);
  }
  draw(c) {
    this.drawFlash(c, () => {
      const x = this.cx, y = this.cy;
      c.save();
      c.translate(x, y);
      const fl = Math.sin(this.t * 0.05) * 0.04;
      c.rotate(this.state === 'slam' ? 0 : fl);
      // аура
      G.Gfx.glow(c, 0, 0, 60, this.phase2 ? '#ff4030' : '#40e0ff', 0.25);
      // корона-лучи
      c.fillStyle = '#6a5a3a'; c.strokeStyle = BO; c.lineWidth = 1.2;
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + (i - 3) * 0.32;
        c.save(); c.rotate(a + Math.PI / 2);
        c.beginPath(); c.moveTo(-5, -26); c.lineTo(0, -44 - (i % 2) * 6); c.lineTo(5, -26); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = '#e8c040'; c.beginPath(); c.arc(0, -36 - (i % 2) * 3, 2, 0, 7); c.fill(); c.fillStyle = '#6a5a3a';
        c.restore();
      }
      // лицо
      const g = c.createLinearGradient(0, -32, 0, 32);
      g.addColorStop(0, '#b8a478'); g.addColorStop(1, '#6a5a3a');
      c.fillStyle = g;
      G.Gfx.rr(c, -30, -30, 60, 62, 14); c.fill(); c.stroke();
      // узоры
      c.strokeStyle = '#4a3e28'; c.lineWidth = 1.4;
      c.beginPath(); c.moveTo(-26, -6); c.lineTo(-18, 0); c.lineTo(-26, 6); c.moveTo(26, -6); c.lineTo(18, 0); c.lineTo(26, 6); c.stroke();
      c.fillStyle = '#e8c040';
      c.fillRect(-30, 18, 60, 3);
      // трещины по мере урона
      const dmg = 1 - this.hp / this.maxHp;
      c.strokeStyle = '#2a2014'; c.lineWidth = 1;
      if (dmg > 0.25) { c.beginPath(); c.moveTo(-20, -30); c.lineTo(-14, -18); c.lineTo(-18, -8); c.stroke(); }
      if (dmg > 0.5) { c.beginPath(); c.moveTo(22, 32); c.lineTo(14, 22); c.lineTo(18, 10); c.lineTo(12, 4); c.stroke(); }
      if (dmg > 0.75) { c.beginPath(); c.moveTo(4, -30); c.lineTo(0, -20); c.lineTo(6, -12); c.stroke(); }
      // три глаза
      const eyeCol = this.state === 'rest' ? '#5a5a5a' : this.phase2 ? '#ff3a2a' : '#40e8ff';
      const eyes = [[-13, -6, 7], [13, -6, 7], [0, -20, 5]];
      for (const [ex, ey, r] of eyes) {
        c.fillStyle = '#1a1208';
        c.beginPath(); c.ellipse(ex, ey, r + 1.5, r * 0.6 + 1.5, 0, 0, 7); c.fill();
        G.Gfx.glow(c, ex, ey, r * 2.6, eyeCol, 0.6);
        G.Gfx.ellipse(c, ex, ey, r, r * 0.55, 0, eyeCol);
        G.Gfx.circle(c, ex, ey, r * 0.3, '#ffffff');
      }
      // рот
      c.fillStyle = '#1a1208';
      G.Gfx.rr(c, -14, 6, 28, 9, 3); c.fill();
      c.fillStyle = '#d8c8a0';
      for (let i = -12; i < 12; i += 5) c.fillRect(i, 6, 3, 3);
      if (this.state === 'spread' && this.st < 26) G.Gfx.glow(c, 0, 10, 16, '#ff7a20', 0.8);
      c.restore();
    });
  }
};

// =============================================================================
// 3. КРИСТАЛЬНЫЙ ПАУК — висит на нити, плюётся паутиной, роняет паучат
// =============================================================================
G.Spiderling = class Spiderling extends G.Imp {
  constructor(x, y) { super(x, y); this.hp = this.maxHp = 2; this.speed = 1.1; this.coins = 1; }
  draw(c) {
    this.flashDraw(c, () => {
      const x = this.cx, b = this.bottom;
      c.save(); c.translate(x, b - 6);
      c.strokeStyle = BO; c.lineWidth = 1.4;
      for (let i = 0; i < 4; i++) {
        const k = Math.sin(this.t * 0.4 + i) * 2;
        for (const s of [-1, 1]) { c.beginPath(); c.moveTo(0, 0); c.lineTo(s * (5 + i), -4 + k); c.lineTo(s * (8 + i * 1.5), 6); c.stroke(); }
      }
      G.Gfx.ellipse(c, 0, 0, 6, 5, 0, '#6a3aa0', BO, 1);
      G.Gfx.circle(c, -2, -1, 1.2, '#5ef0ff'); G.Gfx.circle(c, 2, -1, 1.2, '#5ef0ff'); G.Gfx.circle(c, 0, -3, 0.9, '#5ef0ff');
      c.restore();
    });
  }
};

G.BossSpider = class BossSpider extends G.Boss {
  constructor(game) {
    super(game, 52, 36, 60, 'spider');
    this.x = this.arena.x + 300;
    this.y = -60;
    this.tx = this.x;
    this.cool = 60;
    this.introUpdate = () => { this.y = G.lerp(-60, 50, G.easeOutCubic(Math.min(1, this.st / 70))); };
  }
  think(game) {
    const p = game.player, A = this.arena;
    const fast = this.phase2;
    const topY = 50;
    switch (this.state) {
      case 'idle':
        this.y = G.lerp(this.y, topY + Math.sin(this.t * 0.05) * 6, 0.1);
        this.x = G.lerp(this.x, this.tx, 0.03);
        if (Math.abs(this.x - this.tx) < 6) this.tx = A.x + 40 + Math.random() * (560 - this.w);
        if (--this.cool <= 0) {
          const r = Math.random();
          const spiders = game.entities.filter((e) => e instanceof G.Spiderling && !e.dead).length;
          if (r < 0.35) this.set('web');
          else if (r < 0.7) this.set('dropAim');
          else if (spiders < 3) this.set('spawn');
          else this.set(fast ? 'shards' : 'web');
        }
        break;
      case 'web':
        if (this.st % 16 === 1 && this.st < 50) { this.shootAt(game, this.cx, this.bottom, 2.8, 'web', 0, { r: 5 }); G.Audio.play('enemyShot'); }
        if (fast && this.st === 40) this.shootAt(game, this.cx, this.bottom, 3, 'ice', 0, {});
        if (this.st > 60) { this.set('idle'); this.cool = fast ? 40 : 70; }
        break;
      case 'shards':
        if (this.st === 20 || this.st === 45) { this.ring(game, this.cx, this.cy, 12, 2.2, 'ice', this.st * 0.1, { ghost: false }); G.Audio.play('enemyShot'); }
        if (this.st > 70) { this.set('idle'); this.cool = 50; }
        break;
      case 'dropAim':
        this.x = G.lerp(this.x, G.clamp(p.cx - this.w / 2, A.x + 20, A.x + 620 - this.w), 0.1);
        if (this.st === 24) game.spawn(new G.Warning(this.x, this.y, this.w, A.floor - this.y, 24));
        if (this.st > 46) { this.set('drop'); this.vy = 3; }
        break;
      case 'drop':
        this.vy += 0.7;
        this.y += this.vy;
        if (this.bottom >= A.floor) {
          this.y = A.floor - this.h;
          game.shake(5, 12);
          G.Audio.play('stomp');
          G.Particles.dust(this.cx, A.floor, 12, '#b8a8f0');
          if (fast) { game.spawn(new G.Shockwave(this.x, A.floor, -1, 3.4)); game.spawn(new G.Shockwave(this.x + this.w, A.floor, 1, 3.4)); }
          this.set('floor');
        }
        break;
      case 'floor':
        this.dmgMul = 1.4;
        if (this.st > (fast ? 35 : 60)) { this.dmgMul = 1; this.set('climb'); }
        break;
      case 'climb':
        this.y = G.lerp(this.y, topY, 0.06);
        if (this.st > 50) { this.set('idle'); this.cool = 40; }
        break;
      case 'spawn':
        if (this.st === 20 || this.st === 40) {
          const s = new G.Spiderling(this.cx, this.bottom + 10);
          s.facing = Math.random() < 0.5 ? -1 : 1;
          s.active = true;
          game.spawn(s);
          G.Audio.play('enemyShot');
        }
        if (this.st > 60) { this.set('idle'); this.cool = 60; }
        break;
    }
    this.contact(game, this.state === 'drop' ? 2 : 1);
  }
  draw(c) {
    // нить
    c.strokeStyle = 'rgba(220,220,255,0.7)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(this.cx, -10); c.lineTo(this.cx, this.y + 4); c.stroke();
    this.drawFlash(c, () => {
      const x = this.cx, y = this.cy;
      c.save(); c.translate(x, y);
      // лапы
      for (let i = 0; i < 4; i++) {
        const k = Math.sin(this.t * 0.12 + i * 0.9) * 3;
        for (const s of [-1, 1]) {
          const kx = s * (16 + i * 3), ky = -12 + i * 4 + k * s;
          const fx = s * (24 + i * 4), fy = 14 + i * 2 - k * s * 0.5;
          G.Gfx.limb3(c, s * 6, -2 + i * 2, kx, ky, fx, fy, 3, '#4a2a7a', BO);
          c.fillStyle = '#5ef0ff'; c.beginPath(); c.arc(kx, ky, 1.4, 0, 7); c.fill();
        }
      }
      // брюшко с кристаллами
      G.Gfx.ellipse(c, 0, -6, 20, 15, 0, '#5a2a90', BO, 1.3);
      const cc = this.phase2 ? '#ff6af0' : '#5ef0ff';
      G.Gfx.glow(c, 0, -14, 28, cc, 0.4);
      for (const [ox, h, a] of [[-10, 12, -0.5], [-3, 18, -0.15], [5, 15, 0.2], [12, 10, 0.55]]) {
        c.save(); c.translate(ox, -14); c.rotate(a);
        c.beginPath(); c.moveTo(-3, 0); c.lineTo(-3, -h + 4); c.lineTo(0, -h); c.lineTo(3, -h + 4); c.lineTo(3, 0); c.closePath();
        c.fillStyle = G.rgba(cc, 0.9); c.fill(); c.strokeStyle = BO; c.lineWidth = 0.9; c.stroke();
        c.fillStyle = 'rgba(255,255,255,0.7)'; c.fillRect(-1.6, -h + 4, 1, h - 5);
        c.restore();
      }
      // голова
      G.Gfx.ellipse(c, 0, 9, 13, 9, 0, '#6a3aa0', BO, 1.2);
      // россыпь глаз
      const eyes = [[-6, 7, 2.6], [6, 7, 2.6], [0, 4, 3.4], [-10, 10, 1.6], [10, 10, 1.6], [-3, 12, 1.4], [3, 12, 1.4]];
      for (const [ex, ey, r] of eyes) {
        G.Gfx.circle(c, ex, ey, r, this.state === 'floor' ? '#5a5a6a' : '#ffe0ff');
        G.Gfx.circle(c, ex, ey + 0.3, r * 0.5, '#c0108a');
      }
      // жвалы
      const m = Math.sin(this.t * 0.3) * 0.3;
      c.fillStyle = '#2a1040';
      for (const s of [-1, 1]) { c.save(); c.translate(s * 4, 16); c.rotate(s * m); c.beginPath(); c.moveTo(-2, 0); c.lineTo(s * 1, 7); c.lineTo(2, 0); c.fill(); c.restore(); }
      c.restore();
    });
  }
};

// =============================================================================
// 4. ОГНЕННЫЙ ЗМЕЙ — выныривает из лавы дугами, уязвима только голова
// =============================================================================
G.BossSerpent = class BossSerpent extends G.Boss {
  constructor(game) {
    super(game, 30, 30, 65, 'serpent');
    const A = this.arena;
    this.lavaY = A.floor + 16;
    this.pits = [A.x + 10 * 16, A.x + 20 * 16, A.x + 30 * 16];
    this.hist = [];
    this.nseg = 13;
    this.x = this.pits[1] - 15;
    this.y = this.lavaY + 60;
    this.shotT = 0;
    this.invulnerable = false;
  }
  hitTest(b) {
    if (this.state === 'under' || this.state === 'intro') return false;
    return G.overlap({ x: this.x + 3, y: this.y + 3, w: this.w - 6, h: this.h - 6 }, b);
  }
  segPos(i) {
    const k = Math.min(this.hist.length - 1, (i + 1) * 5);
    return k >= 0 ? this.hist[k] : { x: this.cx, y: this.cy };
  }
  launch(game) {
    const from = G.pick(this.pits);
    let to = G.pick(this.pits);
    if (this.phase2 && Math.random() < 0.3) to = from;
    this.x = from - this.w / 2;
    this.y = this.lavaY + 40;
    this.vy = this.phase2 ? -8.1 : -7.7;
    this.g = 0.125;
    const T = (2 * -this.vy) / this.g;
    this.vx = (to - from) / T;
    this.facing = this.vx >= 0 ? 1 : -1;
    this.hist = [];
    this.set('arc');
    G.Audio.play('lava');
    for (let i = 0; i < 20; i++) G.Particles.add({ x: from + G.rand(-12, 12), y: this.lavaY, vx: G.rand(-2, 2), vy: G.rand(-5, -2), g: 0.2, life: G.randi(20, 40), size: G.rand(2, 4), color: '#ffb040', add: true });
  }
  think(game) {
    const p = game.player;
    const fast = this.phase2;
    switch (this.state) {
      case 'idle':
      case 'under':
        if (this.st === 1) {
          // подсказка: где вынырнет
        }
        if (this.st > (fast ? 40 : 70)) this.launch(game);
        if (fast && this.st === 20) {
          // огненный дождь
          for (let i = 0; i < 6; i++) {
            const rx = this.arena.x + 40 + Math.random() * 560;
            game.spawn(new G.Warning(rx - 5, 0, 10, this.lavaY, 36));
            game.later(36, () => game.spawn(new G.EnemyShot(rx, -10, 0, 2, 'fire', { g: 0.15, r: 5, ghost: true })));
          }
        }
        break;
      case 'arc':
        this.vy += this.g;
        this.x += this.vx;
        this.y += this.vy;
        if (++this.shotT > (fast ? 22 : 34) && this.y < this.lavaY - 40) {
          this.shotT = 0;
          this.shootAt(game, this.cx, this.cy, 3, 'fire');
          G.Audio.play('enemyShot');
        }
        if (this.vy > 0 && this.y > this.lavaY + 60 + this.nseg * 4) {
          const last = this.segPos(this.nseg - 1);
          if (last.y > this.lavaY + 10) this.set('under');
        }
        break;
    }
    if (this.state === 'arc' || this.state === 'under') {
      this.hist.unshift({ x: this.cx, y: this.cy });
      if (this.hist.length > this.nseg * 5 + 10) this.hist.pop();
    }
    // урон от головы и тела
    if (this.state === 'arc' || this.state === 'under') {
      const pl = p.hurtbox();
      if (!this.dying && p.alive && game.eyeMode <= 0) {
        if (this.hitTest(pl)) p.hurt(1, game, this.cx);
        for (let i = 0; i < this.nseg; i++) {
          const s = this.segPos(i);
          if (s.y > this.lavaY) continue;
          if (G.overlap({ x: s.x - 8, y: s.y - 8, w: 16, h: 16 }, pl)) { p.hurt(1, game, s.x); break; }
        }
      }
      if (this.state === 'arc' && this.t % 2 === 0) G.Particles.add({ x: this.cx + G.rand(-6, 6), y: this.cy + G.rand(-6, 6), vy: -0.5, life: 20, size: 5, size2: 0, color: '#ff7020', add: true });
    }
  }
  updateDying(game) {
    // при гибели змей застывает в воздухе
    super.updateDying(game);
  }
  draw(c) {
    if (this.state === 'intro') {
      // пузыри в лаве
      if (this.t % 5 === 0) G.Particles.add({ x: this.pits[1] + G.rand(-20, 20), y: this.lavaY + 2, vy: -1.5, g: 0.1, life: 20, size: 3, color: '#ffd060', add: true });
      return;
    }
    // тело — с хвоста к голове
    for (let i = this.nseg - 1; i >= 0; i--) {
      const s = this.segPos(i);
      if (s.y > this.lavaY + 20) continue;
      const r = 10 - i * 0.35;
      const n = this.segPos(Math.max(0, i - 1));
      const a = Math.atan2(n.y - s.y, n.x - s.x);
      c.save();
      c.translate(s.x, s.y);
      c.rotate(a);
      this.flashDraw ? 0 : 0;
      G.Gfx.circle(c, 0, 0, r, i % 2 ? '#d84010' : '#f05a14', BO, 1.1);
      c.fillStyle = '#ffb040';
      c.beginPath(); c.ellipse(0, r * 0.35, r * 0.7, r * 0.4, 0, 0, 7); c.fill();
      // спинной шип
      c.fillStyle = '#ffd060';
      c.beginPath(); c.moveTo(-3, -r + 1); c.lineTo(0, -r - 5); c.lineTo(3, -r + 1); c.fill();
      if (this.flash > 0) { c.globalCompositeOperation = 'lighter'; G.Gfx.circle(c, 0, 0, r, 'rgba(255,255,255,0.5)'); c.globalCompositeOperation = 'source-over'; }
      c.restore();
    }
    // голова
    if (this.y > this.lavaY + 20) return;
    this.drawFlash(c, () => {
      const a = this.state === 'arc' ? Math.atan2(this.vy, this.vx || 0.001) : -Math.PI / 2;
      c.save();
      c.translate(this.cx, this.cy);
      c.rotate(a);
      G.Gfx.glow(c, 0, 0, 34, '#ff6010', 0.5);
      // рога
      c.fillStyle = '#3a1a10'; c.strokeStyle = BO; c.lineWidth = 1;
      for (const s of [-1, 1]) { c.beginPath(); c.moveTo(-6, s * 6); c.quadraticCurveTo(-16, s * 14, -22, s * 10); c.lineTo(-10, s * 4); c.fill(); c.stroke(); }
      // череп
      G.Gfx.ellipse(c, 0, 0, 16, 12, 0, '#e84a10', BO, 1.3);
      // морда
      c.fillStyle = '#f06a20';
      c.beginPath(); c.moveTo(4, -9); c.lineTo(22, -5); c.lineTo(22, 5); c.lineTo(4, 9); c.closePath(); c.fill(); c.stroke();
      const jaw = 2 + Math.sin(this.t * 0.3) * 2;
      c.fillStyle = '#4a0a04';
      c.beginPath(); c.moveTo(8, 0); c.lineTo(22, -1); c.lineTo(22, jaw); c.closePath(); c.fill();
      c.fillStyle = '#fff';
      c.beginPath(); c.moveTo(14, -1); c.lineTo(15.5, 2); c.lineTo(17, -1); c.moveTo(18, -1); c.lineTo(19.3, 2); c.lineTo(20.5, -1); c.fill();
      // глаза
      for (const s of [-1, 1]) {
        G.Gfx.glow(c, 3, s * 6, 7, '#ffff60', 0.8);
        G.Gfx.ellipse(c, 3, s * 6, 3.4, 2, 0.3 * s, '#fff860', BO, 0.8);
        c.fillStyle = '#200'; c.fillRect(2.5, s * 6 - 1.6, 1.2, 3.2);
      }
      c.restore();
    });
  }
};

// =============================================================================
// 5. ПРИНЦ ЗАРКУН — колдун-телепортёр, во 2-й фазе — трёхглазый демон
// =============================================================================
G.Beam = class Beam extends G.Entity {
  constructor(x, warn = 50, life = 40, w = 18) {
    super(x - w / 2, 0, w, 400);
    this.warn = warn; this.life = life; this.layer = 2;
    this.played = false;
  }
  update(game) {
    this.t++;
    if (this.t === this.warn) { G.Audio.play('laser'); game.shake(3, this.life); }
    if (this.t > this.warn + this.life) this.dead = true;
    if (this.t > this.warn) {
      const p = game.player;
      if (p && p.alive && G.overlap({ x: this.x + 3, y: 0, w: this.w - 6, h: 400 }, p.hurtbox())) p.hurt(1, game, this.cx);
      if (this.t % 2 === 0) G.Particles.add({ x: this.cx + G.rand(-6, 6), y: game.arena.floor, vx: G.rand(-2, 2), vy: G.rand(-3, -1), g: 0.1, life: 20, size: 2, color: '#ff80e0', add: true, kind: 'spark' });
    }
  }
  draw(c) {
    if (this.t <= this.warn) {
      c.fillStyle = `rgba(255,60,200,${0.15 + (this.t % 8 < 4 ? 0.15 : 0)})`;
      c.fillRect(this.cx - 1.5, 0, 3, 400);
      c.fillStyle = 'rgba(255,60,200,0.08)';
      c.fillRect(this.x, 0, this.w, 400);
      return;
    }
    const k = 1 - (this.t - this.warn) / this.life;
    const w = this.w * (0.6 + Math.sin(this.t * 0.8) * 0.15) * Math.min(1, k * 3);
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = 'rgba(255,40,180,0.4)';
    c.fillRect(this.cx - w, 0, w * 2, 400);
    c.fillStyle = 'rgba(255,160,240,0.8)';
    c.fillRect(this.cx - w * 0.5, 0, w, 400);
    c.fillStyle = '#ffffff';
    c.fillRect(this.cx - w * 0.18, 0, w * 0.36, 400);
    c.restore();
  }
};

G.BossPrince = class BossPrince extends G.Boss {
  constructor(game) {
    super(game, 26, 44, 100, 'prince');
    const A = this.arena;
    this.x = A.x + 480;
    this.y = A.floor - 140;
    this.alpha = 0;
    this.form = 1;
    this.cool = 60;
    this.spots = [[A.x + 120, A.floor - 140], [A.x + 500, A.floor - 140], [A.x + 320, A.floor - 200], [A.x + 200, A.floor - 70], [A.x + 440, A.floor - 70], [A.x + 320, A.floor - 110]];
    this.introUpdate = () => { this.alpha = Math.min(1, this.st / 60); };
  }
  hitTest(b) {
    if (this.alpha < 0.5 || this.state === 'transform') return false;
    return G.overlap(this, b);
  }
  onPhase2(game) {
    super.onPhase2(game);
    this.set('transform');
    game.clearHostiles();
  }
  think(game) {
    const p = game.player, A = this.arena;
    this.facing = p.cx < this.cx ? -1 : 1;
    if (this.form === 1) {
      switch (this.state) {
        case 'idle':
          this.y += Math.sin(this.t * 0.06) * 0.4;
          if (--this.cool <= 0) {
            const r = Math.random();
            const ghosts = game.entities.filter((e) => e instanceof G.Ghost && !e.dead).length;
            if (r < 0.3) this.set('vanish');
            else if (r < 0.6) this.set('ring');
            else if (r < 0.85 || ghosts >= 2) this.set('aim');
            else this.set('summon');
          }
          break;
        case 'vanish':
          this.alpha = Math.max(0, 1 - this.st / 18);
          if (this.st === 1) G.Audio.play('teleport');
          if (this.st === 20) {
            const s = G.pick(this.spots.filter((s) => Math.abs(s[0] - this.cx) > 60));
            this.x = s[0] - this.w / 2; this.y = s[1] - this.h;
          }
          if (this.st > 20) this.alpha = Math.min(1, (this.st - 20) / 18);
          if (this.st > 40) { this.set('idle'); this.cool = 20; }
          break;
        case 'ring':
          if (this.st === 25 || this.st === 50) { this.ring(game, this.cx, this.cy, 12, 1.7, 'orb', this.st * 0.13); G.Audio.play('enemyShot'); }
          if (this.st > 70) { this.set('idle'); this.cool = 45; }
          break;
        case 'aim':
          if (this.st % 12 === 0 && this.st <= 36 && this.st > 0) { this.shootAt(game, this.cx, this.y + 8, 3.3, 'orb', 0, { ghost: true }); G.Audio.play('enemyShot'); }
          if (this.st > 55) { this.set('idle'); this.cool = 40; }
          break;
        case 'summon':
          if (this.st === 30) {
            for (const s of [-1, 1]) {
              const g = new G.Ghost(this.cx + s * 40, this.cy);
              g.active = true;
              game.spawn(g);
              G.Particles.ring(this.cx + s * 40, this.cy - 8, '#c0a0ff', 16, 20);
            }
            G.Audio.play('teleport');
          }
          if (this.st > 60) { this.set('idle'); this.cool = 50; }
          break;
        case 'transform': {
          this.alpha = 1;
          const tx = A.x + 320 - 45, ty = 40;
          this.x = G.lerp(this.x, tx + 32, 0.05);
          this.y = G.lerp(this.y, ty + 18, 0.05);
          if (this.st % 6 === 0) { G.Particles.ring(this.cx, this.cy, '#ff60d0', 30 + Math.random() * 20, 16); game.shake(2, 6); }
          if (this.st % 30 === 0) G.Audio.play('roar');
          if (this.st === 110) {
            this.form = 2;
            this.x = tx; this.y = ty; this.w = 90; this.h = 76;
            game.flashScreen('#ff80e0', 16);
            G.Audio.play('explode');
            G.Audio.music('boss', true);
            this.set('idle');
            this.cool = 60;
          }
          break;
        }
      }
    } else {
      // вторая форма — огромная трёхглазая голова
      switch (this.state) {
        case 'idle': {
          const tx = A.x + 320 + Math.sin(this.t * 0.015) * 190 - this.w / 2;
          this.x = G.lerp(this.x, tx, 0.05);
          this.y = G.lerp(this.y, 40 + Math.sin(this.t * 0.04) * 12, 0.05);
          if (--this.cool <= 0) {
            const r = Math.random();
            if (r < 0.35) this.set('lasers');
            else if (r < 0.65) this.set('spiral');
            else this.set('diveAim');
          }
          break;
        }
        case 'lasers':
          if (this.st === 1) {
            const n = 4;
            const off = Math.random() * 100;
            for (let i = 0; i < n; i++) game.spawn(new G.Beam(A.x + 60 + ((off + i * 150) % 540), 50, 40, 22));
          }
          if (this.st === 60) {
            game.spawn(new G.Beam(p.cx, 40, 30, 22));
          }
          if (this.st > 130) { this.set('idle'); this.cool = 40; }
          break;
        case 'spiral':
          if (this.st % 5 === 0 && this.st < 90) {
            const a = this.st * 0.21;
            for (const off of [0, Math.PI]) game.spawn(new G.EnemyShot(this.cx, this.cy + 6, Math.cos(a + off) * 2, Math.sin(a + off) * 2, 'orb', { ghost: true, life: 260 }));
            if (this.st % 15 === 0) G.Audio.play('enemyShot');
          }
          if (this.st > 110) { this.set('idle'); this.cool = 40; }
          break;
        case 'diveAim':
          this.x = G.lerp(this.x, G.clamp(p.cx - this.w / 2, A.x + 20, A.x + 620 - this.w), 0.08);
          if (this.st === 20) game.spawn(new G.Warning(this.x, this.y, this.w, A.floor - this.y, 26));
          if (this.st > 46) { this.set('dive'); this.vy = 2; }
          break;
        case 'dive':
          this.vy += 0.8;
          this.y += this.vy;
          if (this.bottom >= A.floor) {
            this.y = A.floor - this.h;
            game.shake(7, 20);
            G.Audio.play('explode');
            game.spawn(new G.Shockwave(this.x, A.floor, -1, 3.8));
            game.spawn(new G.Shockwave(this.x + this.w, A.floor, 1, 3.8));
            this.ring(game, this.cx, this.cy, 10, 2, 'orb', 0);
            this.set('rest');
          }
          break;
        case 'rest':
          this.dmgMul = 1.3;
          if (this.st > 50) { this.dmgMul = 1; this.set('rise'); }
          break;
        case 'rise':
          this.y = G.lerp(this.y, 40, 0.06);
          if (this.st > 50) { this.set('idle'); this.cool = 30; }
          break;
      }
    }
    if (this.alpha > 0.5 && this.state !== 'transform') this.contact(game, this.form === 2 && this.state === 'dive' ? 2 : 1);
  }
  draw(c) {
    if (this.form === 1) this.drawSorcerer(c);
    else this.drawDemon(c);
  }
  drawSorcerer(c) {
    c.save();
    c.globalAlpha = this.alpha;
    this.drawFlash(c, () => {
      const x = this.cx, b = this.bottom;
      c.save();
      c.translate(x, b);
      c.scale(this.facing, 1);
      const fl = Math.sin(this.t * 0.08);
      G.Gfx.glow(c, 0, -22, 40, '#c040ff', 0.3);
      // плащ
      c.fillStyle = '#3a1060'; c.strokeStyle = BO; c.lineWidth = 1.1;
      c.beginPath();
      c.moveTo(-6, -34);
      c.quadraticCurveTo(-16, -14, -14 + fl * 2, 2);
      for (let i = 0; i < 5; i++) c.lineTo(-14 + i * 7 + fl, (i % 2) * -4 + 2);
      c.quadraticCurveTo(16, -14, 6, -34);
      c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#ff60d0'; c.fillRect(-1, -30, 2, 30);
      // мантия
      c.fillStyle = '#6a2aa0';
      G.Gfx.rr(c, -7, -36, 14, 26, 4); c.fill(); c.stroke();
      c.fillStyle = '#ffd040'; c.fillRect(-7, -22, 14, 2);
      // руки с магией
      const cast = this.state === 'ring' || this.state === 'aim' || this.state === 'summon';
      G.Gfx.limb(c, 4, -32, cast ? 14 : 8, cast ? -38 : -22, 3, '#6a2aa0', BO);
      if (cast) { G.Gfx.glow(c, 14, -38, 14, '#ff60d0', 0.8); G.Gfx.circle(c, 14, -38, 2.5, '#ffd0f8'); }
      // голова
      G.Gfx.ellipse(c, 1, -42, 7, 7.5, 0, '#c8b8e8', BO, 1);
      // корона
      c.fillStyle = '#ffd040';
      c.beginPath(); c.moveTo(-6, -46); c.lineTo(-6, -53); c.lineTo(-3, -49); c.lineTo(0, -55); c.lineTo(3, -49); c.lineTo(6, -53); c.lineTo(7, -46); c.closePath(); c.fill(); c.stroke();
      G.Gfx.circle(c, 0.5, -50, 1.2, '#ff3060');
      // глаза — тоже три!
      G.Gfx.ellipse(c, 2, -42, 1.6, 1, 0, '#ff3070');
      G.Gfx.ellipse(c, 6, -42, 1.4, 1, 0, '#ff3070');
      G.Gfx.glow(c, 4, -46, 6, '#ff3070', 0.8);
      G.Gfx.ellipse(c, 4, -45.5, 1.6, 1.1, 0, '#ffe0f0');
      G.Gfx.circle(c, 4.2, -45.5, 0.6, '#a00030');
      c.strokeStyle = BO; c.lineWidth = 0.7;
      c.beginPath(); c.moveTo(3, -38.5); c.lineTo(7, -39.5); c.stroke();
      c.restore();
    });
    c.restore();
  }
  drawDemon(c) {
    this.drawFlash(c, () => {
      const x = this.cx, y = this.cy;
      c.save();
      c.translate(x, y);
      G.Gfx.glow(c, 0, 0, 90, '#ff40c0', 0.3);
      // рога
      c.fillStyle = '#2a0a3a'; c.strokeStyle = BO; c.lineWidth = 1.4;
      for (const s of [-1, 1]) {
        c.beginPath(); c.moveTo(s * 28, -26); c.quadraticCurveTo(s * 56, -40, s * 52, -70); c.quadraticCurveTo(s * 44, -44, s * 18, -34); c.closePath(); c.fill(); c.stroke();
      }
      // голова
      const g = c.createRadialGradient(0, -10, 10, 0, 0, 50);
      g.addColorStop(0, '#9a3ad0'); g.addColorStop(1, '#3a0a5a');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(-44, -16); c.quadraticCurveTo(-46, -40, 0, -40); c.quadraticCurveTo(46, -40, 44, -16);
      c.quadraticCurveTo(42, 22, 20, 36); c.lineTo(-20, 36); c.quadraticCurveTo(-42, 22, -44, -16);
      c.closePath(); c.fill(); c.stroke();
      // корона-пластина
      c.fillStyle = '#ffd040';
      c.beginPath(); c.moveTo(-30, -32); c.lineTo(-20, -48); c.lineTo(-8, -38); c.lineTo(0, -54); c.lineTo(8, -38); c.lineTo(20, -48); c.lineTo(30, -32); c.closePath(); c.fill(); c.stroke();
      // три глаза
      const rest = this.state === 'rest';
      const eyes = [[-18, -6, 9], [18, -6, 9], [0, -24, 8]];
      for (const [ex, ey, r] of eyes) {
        c.fillStyle = '#12021c';
        c.beginPath(); c.ellipse(ex, ey, r + 2, r * 0.65 + 2, 0, 0, 7); c.fill();
        G.Gfx.glow(c, ex, ey, r * 3, '#ff3090', rest ? 0.2 : 0.7);
        G.Gfx.ellipse(c, ex, ey, r, r * 0.6, 0, rest ? '#6a4a6a' : '#ffe0f0');
        const p = this.lookAt || { x: 0, y: 0 };
        G.Gfx.circle(c, ex + p.x, ey + p.y, r * 0.42, rest ? '#3a2a3a' : '#ff2a6a');
        G.Gfx.circle(c, ex + p.x, ey + p.y, r * 0.2, '#200010');
      }
      // пасть
      const open = this.state === 'spiral' ? 6 + Math.sin(this.t * 0.4) * 2 : 3;
      c.fillStyle = '#12021c';
      c.beginPath(); c.ellipse(0, 18, 20, open, 0, 0, 7); c.fill();
      c.fillStyle = '#fff';
      for (let i = -16; i <= 12; i += 7) { c.beginPath(); c.moveTo(i, 18 - open); c.lineTo(i + 2, 18 - open + 5); c.lineTo(i + 4, 18 - open); c.fill(); }
      c.restore();
    });
  }
  update(game) {
    const p = game.player;
    if (p) {
      const dx = p.cx - this.cx, dy = p.cy - this.cy, d = Math.hypot(dx, dy) || 1;
      this.lookAt = { x: (dx / d) * 2.5, y: (dy / d) * 1.5 };
    }
    super.update(game);
  }
};

G.makeBoss = (kind, game) => {
  switch (kind) {
    case 'bull': return new G.BossBull(game);
    case 'idol': return new G.BossIdol(game);
    case 'spider': return new G.BossSpider(game);
    case 'serpent': return new G.BossSerpent(game);
    case 'prince': return new G.BossPrince(game);
  }
};
