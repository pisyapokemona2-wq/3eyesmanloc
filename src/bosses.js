'use strict';
// Боссы. Арена — 30 тайлов (ровно экран), правая стена в последнем столбце.
G.Boss = class Boss extends G.Enemy {
  constructor(game, w, h, hp, kind) {
    super(0, 0, w, h, hp);
    this.isBoss = true;
    this.kind = kind;
    this.name = G.BOSS_NAMES[kind];
    this.stompable = false;
    this.arena = game.arena;
    this.st = 0;
    this.state = 'intro';
    this.dying = false;
    this.dyingT = 0;
    this.active = true;
    this.facing = -1;
    this.dmgMul = 1;
    this.L = this.arena.x + 17;
    this.R = this.arena.x + G.W - 17;
  }
  get phase2() { return this.hp <= this.maxHp / 2; }
  set(s) { this.state = s; this.st = 0; }
  hurt(d, game, src) {
    if (this.dying || this.state === 'intro' || this.invulnerable) {
      if (!this.dying && src && src.cx) G.Particles.sparks(src.cx, src.cy, 3, '#aaaaaa', 1.5);
      return;
    }
    const was = this.phase2;
    this.hp -= d * this.dmgMul;
    this.flash = 6;
    G.Audio.play('bossHit');
    if (this.dmgMul < 1 && src && src.cx) G.Particles.sparks(src.cx, src.cy, 3, '#c0e8ff', 1.4);
    if (this.hp <= 0) {
      this.hp = 0; this.dying = true; this.dyingT = 0;
      G.Audio.stopMusic(0.5);
      game.hitstop(14); game.shake(6, 30); game.clearHostiles();
    } else if (!was && this.phase2) this.onPhase2(game);
  }
  onPhase2(game) { G.Audio.play('roar'); game.shake(4, 30); G.Particles.fx('fx_ring', this.cx, this.cy); }
  updateDying(game) {
    this.dyingT++;
    this.flash = this.dyingT % 8 < 4 ? 2 : 0;
    if (this.dyingT % 7 === 0) { G.Particles.explosion(this.x + Math.random() * this.w, this.y + Math.random() * this.h); G.Audio.play('explode'); game.shake(3, 6); }
    if (this.dyingT === 150) {
      G.Particles.explosion(this.cx, this.cy, true);
      G.Audio.play('explode');
      game.shake(8, 25);
      game.flashScreen('#ffffff', 20);
      this.dead = true;
      game.onBossDefeated(this);
    }
  }
  contact(game, dmg = 1, box) {
    const p = game.player;
    if (!p || !p.alive || this.dying || this.state === 'intro' || game.eyeMode > 0) return;
    if (G.overlap(box || this, p.hurtbox())) p.hurt(dmg, game, this.cx);
  }
  shoot(game, x, y, speed, kind = 'fire', spread = 0, opts = {}) {
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
  rain(game, n, kind, delay = 32, opts = {}) {
    for (let i = 0; i < n; i++) {
      const rx = this.arena.x + 30 + Math.random() * (G.W - 60);
      game.spawn(new G.Warning(rx - 5, game.cam.y, 10, this.arena.floor - game.cam.y, delay + i * 5));
      game.later(delay + i * 5, () => game.spawn(new G.EnemyShot(rx, game.cam.y - 8, 0, 1, kind, Object.assign({ g: 0.2, r: 4, life: 200 }, opts))));
    }
  }
  update(game) {
    this.t++; this.st++;
    if (this.flash > 0) this.flash--;
    if (this.dying) { this.updateDying(game); return; }
    if (this.state === 'intro') { this.introUpdate && this.introUpdate(game); if (this.st > 100) this.set('idle'); return; }
    this.think(game);
  }
  spr(name, x, y, flip) { G.Gfx.spr(name, Math.round(x), Math.round(y), flip, this.flash > 0 && this.flash % 2 === 0); }
};

// 1. СТАЛЬНОЙ БЫК -------------------------------------------------------------
G.BossBull = class extends G.Boss {
  constructor(game) { super(game, 56, 40, 40, 'bull'); this.x = this.arena.x + 340; this.y = this.arena.floor - this.h; }
  think(game) {
    const p = game.player, A = this.arena, fast = this.phase2;
    this.dmgMul = this.state === 'stun' ? 1.5 : 1;
    switch (this.state) {
      case 'idle':
        this.vx = 0;
        this.facing = p.cx < this.cx ? -1 : 1;
        if (this.st > (fast ? 26 : 46)) {
          if (Math.random() < 0.6) this.set('prep');
          else { this.set('jump'); this.vy = -7.4; this.vx = (G.clamp(p.cx, this.L + 30, this.R - 30) - this.cx) / 48; G.Audio.play('jump'); }
        }
        break;
      case 'prep':
        if (this.st === 1) { G.Audio.play('roar'); game.spawn(new G.Warning(this.L, this.y, this.R - this.L, this.h, 32)); }
        if (this.st % 5 === 0) G.Particles.fx('fx_puff', this.cx + this.facing * 26, this.y + 10);
        if (this.st > 32) this.set('charge');
        break;
      case 'charge':
        this.vx = this.facing * (fast ? 5.4 : 4.4);
        if (this.st % 4 === 0) G.Particles.dust(this.cx - this.facing * 22, this.bottom, 1);
        if ((this.facing < 0 && this.x <= this.L) || (this.facing > 0 && this.x + this.w >= this.R)) {
          this.x = this.facing < 0 ? this.L : this.R - this.w;
          this.set('stun');
          G.Audio.play('explode');
          game.shake(7, 22);
          G.Particles.debris(this.facing < 0 ? this.L : this.R, this.cy, 12, ['#8a8a9a', '#5a5a6a', '#c0c0d0'], 2.4);
          this.rain(game, fast ? 6 : 4, 'rock', 28);
        }
        break;
      case 'stun': this.vx = 0; if (this.st > 80) this.set('idle'); break;
      case 'jump':
        this.vy += 0.3;
        if (this.bottom + this.vy >= A.floor && this.vy > 0) {
          this.y = A.floor - this.h; this.vy = 0; this.vx = 0;
          game.shake(5, 14); G.Audio.play('explode');
          G.Particles.dust(this.cx, this.bottom, 6);
          game.spawn(new G.Shockwave(this.cx - 18, A.floor, -1, fast ? 3.2 : 2.6));
          game.spawn(new G.Shockwave(this.cx + 18, A.floor, 1, fast ? 3.2 : 2.6));
          this.set('idle');
        }
        break;
    }
    this.x = G.clamp(this.x + this.vx, this.L, this.R - this.w);
    this.y += this.vy;
    this.contact(game, this.state === 'charge' ? 2 : 1);
  }
  draw() {
    const A = G.Art;
    let n = this.state === 'charge' || this.state === 'prep' ? A.frame('b_bull_charge', this.t) : this.state === 'stun' ? 'b_bull_stun0' : this.phase2 && this.state === 'idle' ? 'b_bull_angry0' : A.frame('b_bull_walk', this.state === 'idle' ? 0 : this.t);
    const shake = this.state === 'prep' && this.t % 2 ? 1 : 0;
    this.spr(n, this.cx + shake, this.bottom, this.facing < 0);
    if (this.state === 'stun') for (let i = 0; i < 3; i++) { const a = this.t * 0.12 + i * 2.1; G.Gfx.spr('fx_spark0', this.cx + this.facing * 20 + Math.cos(a) * 10, this.y - 4 + Math.sin(a) * 3); }
  }
};

// 2. КАНАЛИЗАЦИОННЫЙ КРОКОДИЛ ------------------------------------------------
G.BossCroc = class extends G.Boss {
  constructor(game) {
    super(game, 60, 30, 48, 'croc');
    const A = this.arena;
    // жижа — по центру арены; ищем её границы
    const L = game.level;
    let a = -1, b = -1;
    for (let tx = A.tx + 1; tx < A.tx + 29; tx++) { const t = L.get(tx, Math.floor(A.floor / 16)); if (t === G.T.LIQUID) { if (a < 0) a = tx; b = tx; } }
    this.poolL = (a < 0 ? A.tx + 8 : a) * 16; this.poolR = ((b < 0 ? A.tx + 21 : b) + 1) * 16;
    this.surface = A.floor;
    this.x = (this.poolL + this.poolR) / 2 - this.w / 2;
    this.y = this.surface + 20;
    this.under = true;
  }
  hitTest(b) { return !this.under && G.overlap({ x: this.x + 4, y: this.y, w: this.w - 8, h: this.h }, b); }
  think(game) {
    const p = game.player, fast = this.phase2;
    switch (this.state) {
      case 'idle': // плывёт под поверхностью к игроку
        this.under = true;
        this.facing = p.cx < this.cx ? -1 : 1;
        this.x = G.clamp(G.lerp(this.x, p.cx - this.w / 2, 0.02), this.poolL - 10, this.poolR - this.w + 10);
        this.y = this.surface - 6;
        if (this.st % 30 === 0) G.Particles.fx('fx_splash', this.cx, this.surface + 4);
        if (this.st > (fast ? 60 : 90)) this.set(Math.random() < 0.55 ? 'rise' : 'spit');
        break;
      case 'rise':
        this.under = false;
        this.y = G.lerp(this.y, this.surface - this.h + 4, 0.15);
        if (this.st === 1) { G.Audio.play('roar'); G.Particles.fx('fx_splash', this.cx, this.surface + 4); }
        if (this.st === 30) { this.set('bite'); this.vx = this.facing * (fast ? 3.4 : 2.6); }
        break;
      case 'bite':
        this.under = false;
        this.x += this.vx;
        this.vx *= 0.97;
        if (this.st > 50) this.set('rest');
        break;
      case 'rest':
        this.under = false;
        this.dmgMul = 1.3;
        if (this.st > (fast ? 40 : 70)) { this.dmgMul = 1; this.set('sink'); }
        break;
      case 'sink':
        this.y = G.lerp(this.y, this.surface + 10, 0.1);
        if (this.st > 24) { this.under = true; this.set('idle'); }
        break;
      case 'spit':
        this.under = false;
        this.y = G.lerp(this.y, this.surface - this.h + 10, 0.2);
        if (this.st === 20 || (fast && this.st === 40)) {
          for (const k of fast ? [-1, 0, 1] : [-0.5, 0.5]) {
            const dx = p.cx - this.cx;
            game.spawn(new G.EnemyShot(this.cx + this.facing * 20, this.y + 6, dx / 50 + k * 0.8, -4.4, 'bubble', { g: 0.18, r: 4 }));
          }
          G.Audio.play('enemyShot');
        }
        if (this.st > 60) this.set('sink');
        break;
    }
    this.x = G.clamp(this.x, this.L, this.R - this.w);
    if (!this.under) this.contact(game, this.state === 'bite' ? 2 : 1, { x: this.x + 6, y: this.y + 4, w: this.w - 12, h: this.h - 4 });
  }
  draw() {
    const A = G.Art;
    if (this.state === 'intro') return;
    let n = this.under ? A.frame('b_croc_swim', this.t) : this.state === 'bite' ? A.frame('b_croc_bite', this.t) : this.state === 'rest' ? 'b_croc_hurt0' : 'b_croc_rise0';
    this.spr(n, this.cx, this.under ? this.surface + 10 : this.bottom + 6, this.facing < 0);
  }
};

// 3. КАМЕННЫЙ ИДОЛ -------------------------------------------------------------
G.BossIdol = class extends G.Boss {
  constructor(game) {
    super(game, 56, 56, 52, 'idol');
    this.x = this.arena.x + 212; this.y = -80;
    this.cool = 60;
    this.introUpdate = (g) => { this.y = G.lerp(g.cam.y - 80, g.cam.y + 24, G.easeOutCubic(Math.min(1, this.st / 80))); };
  }
  think(game) {
    const p = game.player, A = this.arena, fast = this.phase2, top = game.cam.y + 24;
    switch (this.state) {
      case 'idle':
        this.x = G.lerp(this.x, A.x + 240 + Math.sin(this.t * 0.013) * 160 - this.w / 2, 0.04);
        this.y = G.lerp(this.y, top + 10 + Math.sin(this.t * 0.026) * 22, 0.04);
        if (--this.cool <= 0) { const r = Math.random(); this.set(r < 0.4 ? 'spread' : r < 0.75 ? 'slamAim' : fast ? 'ring' : 'spread'); }
        break;
      case 'spread':
        if (this.st === 20 || (fast && this.st === 50)) { G.Audio.play('enemyShot'); for (let i = -2; i <= 2; i++) this.shoot(game, this.cx, this.cy + 10, 2.2, 'fire', i * 0.22); }
        if (this.st > 70) { this.set('idle'); this.cool = fast ? 50 : 80; }
        break;
      case 'ring':
        if (this.st % 20 === 1 && this.st < 70) { this.ring(game, this.cx, this.cy, 10, 1.5, 'orb', this.st * 0.05); G.Audio.play('enemyShot'); }
        if (this.st > 90) { this.set('idle'); this.cool = 50; }
        break;
      case 'slamAim':
        this.x = G.lerp(this.x, G.clamp(p.cx - this.w / 2, this.L, this.R - this.w), 0.08);
        this.y = G.lerp(this.y, top, 0.08);
        if (this.st === 30) { G.Audio.play('roar'); game.spawn(new G.Warning(this.x, this.y, this.w, A.floor - this.y, 26)); }
        if (this.st > 56) { this.set('slam'); this.vy = 2; }
        break;
      case 'slam':
        this.vy += 0.8; this.y += this.vy;
        if (this.bottom >= A.floor) {
          this.y = A.floor - this.h;
          G.Audio.play('explode'); game.shake(7, 20);
          G.Particles.dust(this.cx, A.floor, 8);
          game.spawn(new G.Shockwave(this.x - 4, A.floor, -1, fast ? 3.2 : 2.6));
          game.spawn(new G.Shockwave(this.x + this.w + 4, A.floor, 1, fast ? 3.2 : 2.6));
          this.set('rest');
        }
        break;
      case 'rest': this.dmgMul = 1.5; if (this.st > (fast ? 40 : 70)) { this.set('rise'); this.dmgMul = 1; } break;
      case 'rise': this.y = G.lerp(this.y, top + 20, 0.05); if (this.st > 50) { this.set('idle'); this.cool = 40; } break;
    }
    this.contact(game, this.state === 'slam' ? 2 : 1, { x: this.x + 6, y: this.y + 6, w: this.w - 12, h: this.h - 10 });
  }
  draw() {
    G.Gfx.glow(this.cx, this.cy, 40, this.phase2 ? '#ff4030' : '#40e0ff', 0.25);
    const n = this.state === 'rest' ? 'b_idol_rest0' : this.state === 'spread' && this.st < 26 ? 'b_idol_open0' : this.phase2 ? 'b_idol_angry0' : 'b_idol0';
    this.spr(n, this.cx, this.cy);
    if (this.hp < this.maxHp * 0.6) G.Gfx.spr('b_idol_crack', Math.round(this.cx), Math.round(this.cy));
  }
};

// 4. КРИСТАЛЬНЫЙ ПАУК ------------------------------------------------------------
G.BossSpider = class extends G.Boss {
  constructor(game) {
    super(game, 48, 32, 56, 'spider');
    this.x = this.arena.x + 216; this.y = -60; this.tx = this.x; this.cool = 60;
    this.introUpdate = (g) => { this.y = G.lerp(g.cam.y - 60, g.cam.y + 30, G.easeOutCubic(Math.min(1, this.st / 70))); };
  }
  think(game) {
    const p = game.player, A = this.arena, fast = this.phase2, topY = game.cam.y + 30;
    switch (this.state) {
      case 'idle':
        this.y = G.lerp(this.y, topY + Math.sin(this.t * 0.05) * 5, 0.1);
        this.x = G.lerp(this.x, this.tx, 0.03);
        if (Math.abs(this.x - this.tx) < 6) this.tx = this.L + 10 + Math.random() * (this.R - this.L - 20 - this.w);
        if (--this.cool <= 0) {
          const r = Math.random(), n = game.entities.filter((e) => e instanceof G.Spiderling && !e.dead).length;
          this.set(r < 0.35 ? 'web' : r < 0.7 ? 'dropAim' : n < 3 ? 'spawn' : fast ? 'shards' : 'web');
        }
        break;
      case 'web':
        if (this.st % 16 === 1 && this.st < 50) { this.shoot(game, this.cx, this.bottom, 2.4, 'web', 0, { r: 5 }); G.Audio.play('enemyShot'); }
        if (fast && this.st === 40) this.shoot(game, this.cx, this.bottom, 2.6, 'ice');
        if (this.st > 60) { this.set('idle'); this.cool = fast ? 40 : 70; }
        break;
      case 'shards':
        if (this.st === 20 || this.st === 45) { this.ring(game, this.cx, this.cy, 12, 1.9, 'ice', this.st * 0.1, { ghost: false }); G.Audio.play('enemyShot'); }
        if (this.st > 70) { this.set('idle'); this.cool = 50; }
        break;
      case 'dropAim':
        this.x = G.lerp(this.x, G.clamp(p.cx - this.w / 2, this.L, this.R - this.w), 0.1);
        if (this.st === 24) game.spawn(new G.Warning(this.x, this.y, this.w, A.floor - this.y, 24));
        if (this.st > 46) { this.set('drop'); this.vy = 3; }
        break;
      case 'drop':
        this.vy += 0.6; this.y += this.vy;
        if (this.bottom >= A.floor) {
          this.y = A.floor - this.h; game.shake(5, 12); G.Audio.play('stomp');
          G.Particles.dust(this.cx, A.floor, 6);
          if (fast) { game.spawn(new G.Shockwave(this.x, A.floor, -1, 3)); game.spawn(new G.Shockwave(this.x + this.w, A.floor, 1, 3)); }
          this.set('floor');
        }
        break;
      case 'floor': this.dmgMul = 1.4; if (this.st > (fast ? 35 : 60)) { this.dmgMul = 1; this.set('climb'); } break;
      case 'climb': this.y = G.lerp(this.y, topY, 0.06); if (this.st > 50) { this.set('idle'); this.cool = 40; } break;
      case 'spawn':
        if (this.st === 20 || this.st === 40) { const s = new G.Spiderling(this.cx, this.bottom + 10); s.facing = Math.random() < 0.5 ? -1 : 1; s.active = true; game.spawn(s); G.Audio.play('enemyShot'); }
        if (this.st > 60) { this.set('idle'); this.cool = 60; }
        break;
    }
    this.contact(game, this.state === 'drop' ? 2 : 1);
  }
  draw(c) {
    c.fillStyle = '#d8d8f0';
    c.fillRect(Math.round(this.cx), Math.round(this.arena ? -20 : 0), 1, Math.max(0, Math.round(this.y + 4 + 20)));
    G.Gfx.glow(this.cx, this.cy - 8, 30, this.phase2 ? '#ff6af0' : '#5ef0ff', 0.35);
    const n = this.state === 'floor' ? 'b_spider_rest0' : this.state === 'drop' ? 'b_spider_drop0' : this.phase2 ? 'b_spider_angry0' : G.Art.frame('b_spider', this.t);
    this.spr(n, this.cx, this.cy);
  }
};

// 5. ЛЕДЯНОЙ ГОЛЕМ: бронирован, уязвим, когда раскрывает ядро ---------------------
G.BossGolem = class extends G.Boss {
  constructor(game) { super(game, 44, 64, 60, 'golem'); this.x = this.arena.x + 330; this.y = this.arena.floor - this.h; this.cool = 60; }
  think(game) {
    const p = game.player, A = this.arena, fast = this.phase2;
    this.dmgMul = this.state === 'rest' ? 2 : 0.35;
    switch (this.state) {
      case 'idle':
        this.facing = p.cx < this.cx ? -1 : 1;
        this.x += this.facing * (fast ? 0.7 : 0.45);
        if (--this.cool <= 0) {
          const near = Math.abs(p.cx - this.cx) < 70;
          this.set(near ? 'punch' : Math.random() < 0.5 ? 'slam' : fast ? 'throw' : 'slam');
        }
        break;
      case 'punch':
        if (this.st === 14) { this.x += this.facing * 18; G.Audio.play('stomp'); game.shake(2, 6); }
        if (this.st > 14 && this.st < 26) this.contact(game, 2, { x: this.facing > 0 ? this.x + this.w : this.x - 26, y: this.y + 20, w: 26, h: 20 });
        if (this.st > 40) { this.set('idle'); this.cool = 50; }
        break;
      case 'slam':
        if (this.st === 30) {
          G.Audio.play('explode'); game.shake(7, 20);
          game.spawn(new G.Shockwave(this.x - 4, A.floor, -1, fast ? 3.2 : 2.6));
          game.spawn(new G.Shockwave(this.x + this.w + 4, A.floor, 1, fast ? 3.2 : 2.6));
          this.rain(game, fast ? 7 : 5, 'ice', 20, { g: 0.25, r: 4 });
        }
        if (this.st > 50) this.set('rest');
        break;
      case 'throw':
        if (this.st === 20) { for (const s of [-1, 0, 1]) game.spawn(new G.EnemyShot(this.cx, this.y + 8, (p.cx - this.cx) / 60 + s * 0.9, -5, 'snow', { g: 0.2, r: 5, dmg: 1 })); G.Audio.play('enemyShot'); }
        if (this.st > 40) { this.set('idle'); this.cool = 40; }
        break;
      case 'rest':
        if (this.st % 10 === 0) G.Particles.add({ x: this.cx, y: this.cy, vy: -0.6, life: 20, color: '#80e0ff', kind: 'spark', add: true });
        if (this.st > (fast ? 70 : 100)) { this.set('idle'); this.cool = 40; }
        break;
    }
    this.x = G.clamp(this.x, this.L, this.R - this.w);
    this.contact(game, 1, { x: this.x + 6, y: this.y + 6, w: this.w - 12, h: this.h - 6 });
  }
  draw() {
    const n = this.state === 'punch' && this.st > 10 ? 'b_golem_punch0' : this.state === 'slam' && this.st < 32 ? 'b_golem_slam0' : this.state === 'rest' ? 'b_golem_rest0' : G.Art.frame('b_golem', this.t);
    if (this.state === 'rest') G.Gfx.glow(this.cx, this.cy, 26, '#60e0ff', 0.5);
    this.spr(n, this.cx, this.bottom, this.facing < 0);
  }
};

// 6. ОГНЕННЫЙ ЗМЕЙ ---------------------------------------------------------------
G.BossSerpent = class extends G.Boss {
  constructor(game) {
    super(game, 26, 22, 60, 'serpent');
    const A = this.arena, L = game.level;
    this.lavaY = A.floor + 16;
    this.pits = [];
    let run = null;
    for (let tx = A.tx + 1; tx < A.tx + 29; tx++) {
      const lava = L.get(tx, Math.floor(this.lavaY / 16)) === G.T.LIQUID;
      if (lava && !run) run = [tx, tx];
      else if (lava) run[1] = tx;
      if ((!lava || tx === A.tx + 28) && run) { this.pits.push(((run[0] + run[1] + 1) / 2) * 16); run = null; }
    }
    if (!this.pits.length) this.pits = [A.x + 240];
    this.hist = []; this.nseg = 12;
    this.x = this.pits[0] - 13; this.y = this.lavaY + 60;
  }
  hitTest(b) { return this.state === 'arc' && G.overlap({ x: this.x + 2, y: this.y + 2, w: this.w - 4, h: this.h - 4 }, b); }
  seg(i) { const k = Math.min(this.hist.length - 1, (i + 1) * 5); return k >= 0 ? this.hist[k] : { x: this.cx, y: this.cy }; }
  launch(game) {
    const from = G.pick(this.pits);
    let to = G.pick(this.pits);
    if (this.pits.length > 1 && to === from && Math.random() < 0.7) to = this.pits[(this.pits.indexOf(from) + 1) % this.pits.length];
    this.x = from - this.w / 2; this.y = this.lavaY + 40;
    this.vy = this.phase2 ? -7.4 : -7; this.g = 0.13;
    this.vx = (to - from) / ((2 * -this.vy) / this.g);
    this.facing = this.vx >= 0 ? 1 : -1;
    this.hist = [];
    this.set('arc');
    G.Audio.play('lava');
    G.Particles.fx('fx_splash', from, this.lavaY + 2);
    for (let i = 0; i < 14; i++) G.Particles.add({ x: from + G.rand(-10, 10), y: this.lavaY, vx: G.rand(-1.5, 1.5), vy: G.rand(-4, -1.5), g: 0.18, life: G.randi(20, 36), color: '#ffb040', add: true });
  }
  think(game) {
    const p = game.player, fast = this.phase2;
    if (this.state === 'idle' || this.state === 'under') {
      if (this.st > (fast ? 40 : 70)) this.launch(game);
      if (fast && this.st === 20) this.rain(game, 5, 'fire', 34, { ghost: true });
    } else if (this.state === 'arc') {
      this.vy += this.g; this.x += this.vx; this.y += this.vy;
      if (this.st % (fast ? 22 : 34) === 0 && this.y < this.lavaY - 30) { this.shoot(game, this.cx, this.cy, 2.6, 'fire'); G.Audio.play('enemyShot'); }
      if (this.vy > 0 && this.y > this.lavaY + 50 + this.nseg * 4 && this.seg(this.nseg - 1).y > this.lavaY + 10) this.set('under');
    }
    if (this.state === 'arc' || this.state === 'under') {
      this.hist.unshift({ x: this.cx, y: this.cy });
      if (this.hist.length > this.nseg * 5 + 10) this.hist.pop();
      if (p.alive && game.eyeMode <= 0) {
        const pl = p.hurtbox();
        if (this.hitTest(pl)) p.hurt(1, game, this.cx);
        for (let i = 0; i < this.nseg; i++) { const s = this.seg(i); if (s.y < this.lavaY && G.overlap({ x: s.x - 7, y: s.y - 7, w: 14, h: 14 }, pl)) { p.hurt(1, game, s.x); break; } }
      }
      if (this.state === 'arc' && this.t % 2 === 0) G.Particles.add({ x: this.cx + G.rand(-5, 5), y: this.cy + G.rand(-5, 5), vy: -0.4, life: 16, color: '#ff7020', add: true });
    }
  }
  draw() {
    if (this.state === 'intro') { if (this.t % 6 === 0) G.Particles.add({ x: this.pits[0] + G.rand(-12, 12), y: this.lavaY + 1, vy: -1.2, g: 0.08, life: 18, color: '#ffd060', add: true }); return; }
    for (let i = this.nseg - 1; i >= 0; i--) {
      const s = this.seg(i);
      if (s.y > this.lavaY + 16) continue;
      this.spr(i === this.nseg - 1 ? 'b_serpent_tail' : 'b_serpent_body', s.x, s.y, false);
    }
    if (this.y > this.lavaY + 16) return;
    G.Gfx.glow(this.cx, this.cy, 24, '#ff6010', 0.45);
    this.spr(this.t % 20 < 10 ? 'b_serpent_head0' : 'b_serpent_head1', this.cx, this.cy, this.vx < 0);
  }
};

// 7. МЕХАНИЧЕСКИЙ ГАРУДА ---------------------------------------------------------
G.BossGaruda = class extends G.Boss {
  constructor(game) {
    super(game, 64, 38, 64, 'garuda');
    this.x = this.arena.x + 200; this.y = -80; this.cool = 60;
    this.introUpdate = (g) => { this.y = G.lerp(g.cam.y - 80, g.cam.y + 30, G.easeOutCubic(Math.min(1, this.st / 80))); };
  }
  think(game) {
    const p = game.player, A = this.arena, fast = this.phase2, top = game.cam.y + 24;
    switch (this.state) {
      case 'idle':
        this.x = G.lerp(this.x, A.x + 240 + Math.sin(this.t * 0.011) * 170 - this.w / 2, 0.035);
        this.y = G.lerp(this.y, top + 8 + Math.sin(this.t * 0.03) * 14, 0.04);
        this.facing = p.cx < this.cx ? -1 : 1;
        if (--this.cool <= 0) { const r = Math.random(); this.set(r < 0.35 ? 'feathers' : r < 0.7 ? 'diveAim' : 'gust'); }
        break;
      case 'feathers':
        if (this.st % 18 === 1 && this.st < (fast ? 60 : 40)) { for (let i = -2; i <= 2; i++) this.shoot(game, this.cx, this.cy + 8, 2.6, 'feather', i * 0.18); G.Audio.play('enemyShot'); }
        if (this.st > 70) { this.set('idle'); this.cool = fast ? 40 : 70; }
        break;
      case 'diveAim':
        this.tx = p.cx; this.ty = A.floor - this.h - 4;
        if (this.st === 1) game.spawn(new G.Warning(Math.min(this.cx, p.cx) - 20, p.y - 10, Math.abs(p.cx - this.cx) + 40, 40, 30));
        if (this.st > 32) { this.set('dive'); this.sx = this.cx; this.sy = this.cy; G.Audio.play('roar'); }
        break;
      case 'dive': {
        const k = Math.min(1, this.st / 40);
        this.x = G.lerp(this.sx, this.tx, k) - this.w / 2;
        this.y = G.lerp(this.sy, this.ty, Math.sin(k * Math.PI / 2)) - this.h / 2;
        this.facing = this.tx < this.sx ? -1 : 1;
        if (k >= 1) { G.Audio.play('explode'); game.shake(6, 16); G.Particles.dust(this.cx, A.floor, 8); this.set('rest'); }
        break;
      }
      case 'rest': this.dmgMul = 1.5; if (this.st > (fast ? 45 : 75)) { this.dmgMul = 1; this.set('rise'); } break;
      case 'rise': this.y = G.lerp(this.y, top + 10, 0.05); if (this.st > 50) { this.set('idle'); this.cool = 40; } break;
      case 'gust':
        if (this.st === 1) G.Audio.play('laser');
        game.wind = this.facing * (fast ? 1.5 : 1.1);
        if (this.st % 2 === 0) G.Particles.add({ x: this.facing > 0 ? game.cam.x : game.cam.x + G.W, y: game.cam.y + G.rand(40, G.H - 20), vx: this.facing * 6, life: 80, color: '#ffffff', kind: 'dot' });
        if (fast && this.st % 30 === 15) this.shoot(game, this.cx, this.cy, 2.4, 'feather');
        if (this.st > 110) { game.wind = 0; this.set('idle'); this.cool = 50; }
        break;
    }
    this.contact(game, this.state === 'dive' ? 2 : 1, { x: this.x + 8, y: this.y + 6, w: this.w - 16, h: this.h - 10 });
  }
  draw() {
    const n = this.state === 'dive' || this.state === 'diveAim' ? 'b_garuda_dive0' : this.state === 'rest' ? 'b_garuda_rest0' : G.Art.frame('b_garuda_fly', this.t);
    if (this.state === 'rest' && this.t % 6 === 0) G.Particles.sparks(this.cx + G.rand(-20, 20), this.cy, 3, '#ffe070', 1.5);
    this.spr(n, this.cx, this.cy, this.facing < 0);
  }
};

// 8. ПРИНЦ ЗАРКУН ------------------------------------------------------------------
G.Beam = class Beam extends G.Entity {
  constructor(x, top, bottom, warn = 50, life = 40, w = 16) { super(x - w / 2, top, w, bottom - top); this.warn = warn; this.life = life; this.layer = 2; }
  update(game) {
    this.t++;
    if (this.t === this.warn) { G.Audio.play('laser'); game.shake(2, this.life); }
    if (this.t > this.warn + this.life) this.dead = true;
    if (this.t > this.warn) {
      const p = game.player;
      if (p && p.alive && G.overlap({ x: this.x + 3, y: this.y, w: this.w - 6, h: this.h }, p.hurtbox())) p.hurt(1, game, this.cx);
      if (this.t % 2 === 0) G.Particles.add({ x: this.cx + G.rand(-5, 5), y: this.bottom - 2, vx: G.rand(-1.5, 1.5), vy: G.rand(-2.5, -1), g: 0.1, life: 18, color: '#ff80e0', kind: 'spark', add: true });
    }
  }
  draw(c) {
    const x = Math.round(this.cx), y = Math.round(this.y), h = Math.round(this.h);
    if (this.t <= this.warn) { if (this.t % 8 < 4) { c.fillStyle = 'rgba(255,60,200,0.5)'; c.fillRect(x, y, 1, h); } return; }
    const w = this.t % 4 < 2 ? Math.round(this.w / 2) : Math.round(this.w / 2) - 1;
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = 'rgba(255,40,180,0.5)'; c.fillRect(x - w, y, w * 2, h);
    c.fillStyle = 'rgba(255,160,240,0.9)'; c.fillRect(x - Math.round(w / 2), y, w, h);
    c.fillStyle = '#ffffff'; c.fillRect(x - 1, y, 2, h);
    c.globalCompositeOperation = 'source-over';
  }
};

G.BossPrince = class extends G.Boss {
  constructor(game) {
    super(game, 22, 40, 96, 'prince');
    const A = this.arena, f = A.floor;
    this.x = A.x + 360; this.y = f - 120;
    this.alpha = 0; this.form = 1; this.cool = 60;
    this.spots = [[A.x + 90, f - 110], [A.x + 390, f - 110], [A.x + 240, f - 150], [A.x + 150, f - 50], [A.x + 330, f - 50], [A.x + 240, f - 90]];
    this.introUpdate = () => { this.alpha = Math.min(1, this.st / 60); };
  }
  hitTest(b) { return this.alpha > 0.5 && this.state !== 'transform' && G.overlap(this, b); }
  onPhase2(game) { super.onPhase2(game); this.set('transform'); game.clearHostiles(); }
  think(game) {
    const p = game.player, A = this.arena;
    this.facing = p.cx < this.cx ? -1 : 1;
    if (this.form === 1) {
      switch (this.state) {
        case 'idle':
          this.y += Math.sin(this.t * 0.06) * 0.3;
          if (--this.cool <= 0) {
            const r = Math.random(), ghosts = game.entities.filter((e) => e instanceof G.Ghost && !e.dead).length;
            this.set(r < 0.3 ? 'vanish' : r < 0.6 ? 'ring' : r < 0.85 || ghosts >= 2 ? 'aim' : 'summon');
          }
          break;
        case 'vanish':
          if (this.st === 1) G.Audio.play('teleport');
          this.alpha = this.st < 20 ? 1 - this.st / 18 : Math.min(1, (this.st - 20) / 18);
          if (this.st === 20) { const s = G.pick(this.spots.filter((s) => Math.abs(s[0] - this.cx) > 50)); this.x = s[0] - this.w / 2; this.y = s[1] - this.h; }
          if (this.st > 40) { this.set('idle'); this.cool = 20; }
          break;
        case 'ring':
          if (this.st === 25 || this.st === 50) { this.ring(game, this.cx, this.cy, 12, 1.5, 'orb', this.st * 0.13); G.Audio.play('enemyShot'); }
          if (this.st > 70) { this.set('idle'); this.cool = 45; }
          break;
        case 'aim':
          if (this.st % 12 === 0 && this.st > 0 && this.st <= 36) { this.shoot(game, this.cx, this.y + 8, 2.8, 'orb', 0, { ghost: true }); G.Audio.play('enemyShot'); }
          if (this.st > 55) { this.set('idle'); this.cool = 40; }
          break;
        case 'summon':
          if (this.st === 30) { for (const s of [-1, 1]) { const g = new G.Ghost(this.cx + s * 34, this.cy); g.active = true; game.spawn(g); G.Particles.fx('fx_ring', this.cx + s * 34, this.cy - 8); } G.Audio.play('teleport'); }
          if (this.st > 60) { this.set('idle'); this.cool = 50; }
          break;
        case 'transform': {
          this.alpha = 1;
          this.x = G.lerp(this.x, A.x + 240 - this.w / 2, 0.05);
          this.y = G.lerp(this.y, game.cam.y + 50, 0.05);
          if (this.st % 6 === 0) { G.Particles.fx('fx_ring', this.cx + G.rand(-10, 10), this.cy + G.rand(-10, 10)); game.shake(2, 6); }
          if (this.st % 30 === 0) G.Audio.play('roar');
          if (this.st === 110) {
            this.form = 2; this.w = 80; this.h = 66;
            this.x = A.x + 240 - 40; this.y = game.cam.y + 20;
            game.flashScreen('#ff80e0', 16); G.Audio.play('explode'); G.Audio.music('boss', true);
            this.set('idle'); this.cool = 60;
          }
          break;
        }
      }
    } else {
      const top = game.cam.y + 18;
      switch (this.state) {
        case 'idle':
          this.x = G.lerp(this.x, A.x + 240 + Math.sin(this.t * 0.015) * 150 - this.w / 2, 0.05);
          this.y = G.lerp(this.y, top + Math.sin(this.t * 0.04) * 8, 0.05);
          if (--this.cool <= 0) { const r = Math.random(); this.set(r < 0.35 ? 'lasers' : r < 0.65 ? 'spiral' : 'diveAim'); }
          break;
        case 'lasers':
          if (this.st === 1) { const off = Math.random() * 100; for (let i = 0; i < 4; i++) game.spawn(new G.Beam(A.x + 40 + ((off + i * 110) % 400), game.cam.y, A.floor, 50, 40, 18)); }
          if (this.st === 60) game.spawn(new G.Beam(p.cx, game.cam.y, A.floor, 40, 30, 18));
          if (this.st > 130) { this.set('idle'); this.cool = 40; }
          break;
        case 'spiral':
          if (this.st % 5 === 0 && this.st < 90) {
            const a = this.st * 0.21;
            for (const off of [0, Math.PI]) game.spawn(new G.EnemyShot(this.cx, this.cy + 6, Math.cos(a + off) * 1.7, Math.sin(a + off) * 1.7, 'orb', { ghost: true, life: 260 }));
            if (this.st % 15 === 0) G.Audio.play('enemyShot');
          }
          if (this.st > 110) { this.set('idle'); this.cool = 40; }
          break;
        case 'diveAim':
          this.x = G.lerp(this.x, G.clamp(p.cx - this.w / 2, this.L, this.R - this.w), 0.08);
          if (this.st === 20) game.spawn(new G.Warning(this.x, this.y, this.w, A.floor - this.y, 26));
          if (this.st > 46) { this.set('dive'); this.vy = 2; }
          break;
        case 'dive':
          this.vy += 0.7; this.y += this.vy;
          if (this.bottom >= A.floor) {
            this.y = A.floor - this.h; game.shake(7, 20); G.Audio.play('explode');
            game.spawn(new G.Shockwave(this.x, A.floor, -1, 3.2)); game.spawn(new G.Shockwave(this.x + this.w, A.floor, 1, 3.2));
            this.ring(game, this.cx, this.cy, 10, 1.7, 'orb', 0);
            this.set('rest');
          }
          break;
        case 'rest': this.dmgMul = 1.3; if (this.st > 50) { this.dmgMul = 1; this.set('rise'); } break;
        case 'rise': this.y = G.lerp(this.y, top, 0.06); if (this.st > 50) { this.set('idle'); this.cool = 30; } break;
      }
    }
    if (this.alpha > 0.5 && this.state !== 'transform') this.contact(game, this.form === 2 && this.state === 'dive' ? 2 : 1, this.form === 2 ? { x: this.x + 10, y: this.y + 8, w: this.w - 20, h: this.h - 14 } : this);
  }
  draw(c) {
    const pa = c.globalAlpha;
    c.globalAlpha = pa * this.alpha;
    if (this.form === 1) {
      G.Gfx.glow(this.cx, this.cy, 26, '#c040ff', 0.35);
      const n = ['ring', 'aim', 'summon'].includes(this.state) ? 'b_prince_cast0' : G.Art.frame('b_prince', this.t);
      this.spr(n, this.cx, this.bottom + Math.round(Math.sin(this.t * 0.08) * 2), this.facing < 0);
      if (this.state === 'transform' && this.t % 4 < 2) G.Gfx.glow(this.cx, this.cy, 40, '#ff60d0', 0.6);
    } else {
      G.Gfx.glow(this.cx, this.cy, 60, '#ff40c0', 0.3);
      const n = this.state === 'rest' ? 'b_demon_rest0' : this.state === 'spiral' ? 'b_demon_mouth0' : 'b_demon0';
      this.spr(n, this.cx, this.cy);
    }
    c.globalAlpha = pa;
  }
};

G.makeBoss = (kind, game) => {
  const B = { bull: G.BossBull, croc: G.BossCroc, idol: G.BossIdol, spider: G.BossSpider, golem: G.BossGolem, serpent: G.BossSerpent, garuda: G.BossGaruda, prince: G.BossPrince }[kind];
  return new B(game);
};
