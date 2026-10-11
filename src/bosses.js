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
    this.phases = 3;
    this.ph = 1;
  }
  // Фазы: здоровье делится на равные части, на каждой границе — сцена ярости
  get stage() { return Math.max(1, Math.min(this.phases, 1 + Math.floor((1 - this.hp / this.maxHp) * this.phases + 1e-6))); }
  get marks() { const m = []; for (let k = 1; k < this.phases; k++) m.push(k / this.phases); return m; }
  get phase2() { return this.ph >= 2; }
  get phase3() { return this.ph >= 3; }
  canRage() { return !['jump', 'slam', 'drop', 'dive', 'skyjump', 'fall', 'arc', 'charge', 'bite', 'roll', 'leap', 'reborn'].includes(this.state); }
  rageText(ph) { return ph >= this.phases ? `${this.name}: ПОСЛЕДНЯЯ ЯРОСТЬ!` : `${this.name} В ЯРОСТИ!`; }
  onRage() {}
  rageMove() { this.vx = 0; this.vy = 0; }
  rageUpdate(game) {
    if (this.st === 1) {
      G.Audio.play('roar'); game.flashScreen(this.ph >= this.phases ? '#ff6020' : '#ffffff', 12); game.clearHostiles(); game.wind = 0;
      G.UI.toast(this.rageText(this.ph));
      this.onRage(game, this.ph);
    }
    this.rageMove(game);
    if (this.st % 12 === 0) game.shake(4, 10);
    if (this.st % 6 === 0) G.Particles.fx('fx_puff', this.cx + G.rand(-this.w / 2, this.w / 2), this.y + G.rand(0, this.h / 2));
    if (this.st % 9 === 0) G.Particles.sparks(this.cx, this.cy, 4, this.ph >= this.phases ? '#ff6020' : '#ffe080', 2);
    if (this.st > 80) { this.set('idle'); this.st = 10; this.cool = 30; }
  }
  set(s) { this.state = s; this.st = 0; }
  hurt(d, game, src) {
    if (this.dying || this.state === 'intro' || this.invulnerable) {
      if (!this.dying && src && src.cx) G.Particles.sparks(src.cx, src.cy, 3, '#aaaaaa', 1.5);
      return;
    }
    this.hp -= d * this.dmgMul;
    this.flash = 6;
    G.Audio.play('bossHit');
    if (this.dmgMul < 1 && src && src.cx) G.Particles.sparks(src.cx, src.cy, 3, '#c0e8ff', 1.4);
    if (this.hp <= 0) {
      this.hp = 0; this.dying = true; this.dyingT = 0;
      G.Audio.stopMusic(0.5);
      game.hitstop(14); game.shake(6, 30); game.clearHostiles();
    }
  }
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
    if (this.stage > this.ph && this.canRage()) { this.ph = this.stage; this.set('rage'); }
    this.invulnerable = this.state === 'rage' || this.state === 'reborn';
    if (this.state === 'rage') { this.rageUpdate(game); return; }
    this.think(game);
  }
  spr(name, x, y, flip) { G.Gfx.spr(name, Math.round(x), Math.round(y), flip, this.flash >= 4 && !this.dying); }
};

// 1. СТАЛЬНОЙ БЫК -------------------------------------------------------------
// Три фазы: 1) таран и прыжок; 2) двойной таран с отскоком, серия прыжков;
// 3) перегрев: огненный след, плевки огнём и прыжок с высоты по тени.
G.BossBull = class extends G.Boss {
  constructor(game) { super(game, 56, 40, 54, 'bull'); this.x = this.arena.x + 340; this.y = this.arena.floor - this.h; this.bounces = 0; this.hops = 0; }
  onRage(game, ph) { if (ph === 3) game.later(40, () => G.Particles.debris(this.cx, this.cy, 16, ['#8a8a9a', '#5a5a6a', '#c0c0d0'], 2.6)); } // слетает броня
  rageText(ph) { return ph === 3 ? 'БЫК ПЕРЕГРЕЛСЯ!' : 'БЫК В ЯРОСТИ!'; }
  rageMove() { this.vx = 0; this.vy = 0; this.y = this.arena.floor - this.h; }
  pick(game) {
    const p = game.player, r = Math.random();
    this.facing = p.cx < this.cx ? -1 : 1;
    if (this.ph === 1) {
      if (r < 0.6) this.set('prep'); else this.leap(p);
    } else if (this.ph === 2) {
      if (r < 0.45) { this.bounces = 2; this.set('prep'); } else if (r < 0.8) { this.hops = 3; this.set('hop'); } else this.leap(p);
    } else {
      if (r < 0.35) { this.bounces = 3; this.set('prep'); } else if (r < 0.6) this.set('breath'); else if (r < 0.8) this.set('skyjump'); else { this.hops = 4; this.set('hop'); }
    }
  }
  leap(p) { this.set('jump'); this.vy = -7.4; this.vx = (G.clamp(p.cx, this.L + 30, this.R - 30) - this.cx) / 48; G.Audio.play('jump'); }
  land(game, power) {
    const A = this.arena;
    this.y = A.floor - this.h; this.vy = 0; this.vx = 0;
    game.shake(4 + power, 12 + power * 2); G.Audio.play('explode');
    G.Particles.dust(this.cx, this.bottom, 6);
    const sp = 2.4 + power * 0.4;
    game.spawn(new G.Shockwave(this.cx - 18, A.floor, -1, sp));
    game.spawn(new G.Shockwave(this.cx + 18, A.floor, 1, sp));
  }
  think(game) {
    const p = game.player, A = this.arena;
    this.dmgMul = this.state === 'stun' ? 1.5 : 1;
    const hot = this.ph === 3;
    switch (this.state) {
      case 'idle':
        this.vx = 0;
        this.facing = p.cx < this.cx ? -1 : 1;
        if (this.st > [0, 46, 32, 22][this.ph]) this.pick(game);
        break;
      case 'prep':
        if (this.st === 1) { G.Audio.play('roar'); game.spawn(new G.Warning(this.L, this.y, this.R - this.L, this.h, 30)); }
        if (this.st % 5 === 0) G.Particles.fx('fx_puff', this.cx + this.facing * 26, this.y + 10);
        if (this.st > (this.ph === 1 ? 32 : 24)) this.set('charge');
        break;
      case 'charge': {
        this.vx = this.facing * [0, 4.4, 5.2, 6][this.ph];
        if (this.st % 4 === 0) G.Particles.dust(this.cx - this.facing * 22, this.bottom, 1);
        if (hot && this.st % 7 === 0) game.spawn(new G.EnemyShot(this.cx - this.facing * 24, A.floor - 5, 0, 0, 'fire', { ghost: true, life: 80, r: 4 }));
        const hitWall = (this.facing < 0 && this.x <= this.L) || (this.facing > 0 && this.x + this.w >= this.R);
        if (hitWall) {
          this.x = this.facing < 0 ? this.L : this.R - this.w;
          game.shake(5, 14); G.Audio.play('explode');
          G.Particles.debris(this.facing < 0 ? this.L : this.R, this.cy, 10, ['#8a8a9a', '#5a5a6a', '#c0c0d0'], 2.4);
          if (this.bounces > 0) {
            // отскок: разворот и новый таран без оглушения
            this.bounces--; this.facing = -this.facing; this.set('turn');
            this.rain(game, 2, 'rock', 24);
          } else {
            this.set('stun');
            this.rain(game, [0, 4, 5, 7][this.ph], 'rock', 28);
          }
        }
        break;
      }
      case 'turn': this.vx = 0; if (this.st % 4 === 0) G.Particles.fx('fx_puff', this.cx, this.y + 8); if (this.st > 16) this.set('charge'); break;
      case 'stun': this.vx = 0; if (this.st > [0, 80, 70, 60][this.ph]) this.set('idle'); break;
      case 'hop':
        // серия коротких прыжков к герою с волнами
        if (this.st === 1) { this.vy = -5; this.vx = G.clamp((p.cx - this.cx) / 40, -3, 3); this.facing = p.cx < this.cx ? -1 : 1; G.Audio.play('jump'); }
        this.vy += 0.32;
        if (this.st > 2 && this.bottom + this.vy >= A.floor && this.vy > 0) {
          this.land(game, 0);
          this.hops--;
          if (this.hops > 0) this.st = 0; else { this.set('idle'); }
        }
        break;
      case 'breath':
        // огненные плевки веером
        this.vx = 0;
        this.facing = p.cx < this.cx ? -1 : 1;
        if (this.st % 6 === 0 && this.st < 30) G.Particles.fx('fx_puff', this.cx + this.facing * 26, this.y + 8);
        if (this.st === 30 || this.st === 50 || this.st === 70) {
          G.Audio.play('lava');
          const k = (this.st - 30) / 20;
          for (let i = 0; i < 3; i++) game.spawn(new G.EnemyShot(this.cx + this.facing * 26, this.y + 10, this.facing * (2.2 + i * 1.1 + k * 0.4), -4.2 + i * 0.6, 'fire', { g: 0.18, r: 4 }));
        }
        if (this.st > 96) this.set('idle');
        break;
      case 'skyjump':
        // прыжок за пределы экрана и падение по тени
        if (this.st === 1) { this.vy = -12; this.vx = 0; G.Audio.play('jump'); game.shake(3, 8); }
        this.vy += 0.15;
        if (this.bottom < game.cam.y - 20) { this.set('fall'); this.vy = 0; this.y = game.cam.y - this.h - 120; this.tx = G.clamp(p.cx - this.w / 2, this.L, this.R - this.w); }
        break;
      case 'fall':
        if (this.st < 50) {
          this.tx = G.clamp(p.cx - this.w / 2, this.L, this.R - this.w);
          this.x += (this.tx - this.x) * 0.12;
          if (this.st === 1) game.spawn(new G.Warning(this.x - 4, A.floor - 70, this.w + 8, 70, 50));
        } else {
          this.vy += 0.6;
          if (this.bottom + this.vy >= A.floor) { this.land(game, 3); this.rain(game, 4, 'rock', 20); this.set('stun'); this.st = 30; }
        }
        break;
      case 'jump':
        this.vy += 0.3;
        if (this.bottom + this.vy >= A.floor && this.vy > 0) { this.land(game, this.ph - 1); this.set('idle'); }
        break;
    }
    this.x = G.clamp(this.x + this.vx, this.L, this.R - this.w);
    this.y += this.vy;
    if (this.state !== 'fall' || this.st >= 50) this.contact(game, this.state === 'charge' || this.state === 'fall' ? 2 : 1);
  }
  draw() {
    const A = G.Art;
    const st = this.state;
    if (this.ph === 3 && !this.dying) G.Gfx.glow(this.cx, this.cy, 34 + Math.sin(this.t * 0.2) * 3, '#ff5020', 0.5);
    let n = st === 'charge' || st === 'prep' || st === 'turn' ? A.frame('b_bull_charge', this.t) : st === 'stun' ? 'b_bull_stun0' : (this.ph > 1 && (st === 'idle' || st === 'breath')) || st === 'rage' ? 'b_bull_angry0' : A.frame('b_bull_walk', st === 'idle' ? 0 : this.t);
    const shake = (st === 'prep' || st === 'rage' || st === 'breath') && this.t % 2 ? 1 : 0;
    this.spr(n, this.cx + shake, this.bottom, this.facing < 0);
    if (this.state === 'stun') for (let i = 0; i < 3; i++) { const a = this.t * 0.12 + i * 2.1; G.Gfx.spr('fx_spark0', this.cx + this.facing * 20 + Math.cos(a) * 10, this.y - 4 + Math.sin(a) * 3); }
  }
};

// 2. КАНАЛИЗАЦИОННЫЙ КРОКОДИЛ ------------------------------------------------
G.BossCroc = class extends G.Boss {
  constructor(game) {
    super(game, 60, 30, 60, 'croc');
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
  canRage() { return ['idle', 'rest', 'spit', 'sink'].includes(this.state); }
  rageText(ph) { return ph === 3 ? 'КРОКОДИЛ ВЫБИРАЕТСЯ НА СУШУ!' : 'КРОКОДИЛ В ЯРОСТИ!'; }
  rageMove() { this.under = false; this.y = G.lerp(this.y, this.surface - this.h + 4, 0.15); }
  think(game) {
    const p = game.player, fast = this.phase2, A = this.arena;
    switch (this.state) {
      case 'idle': // плывёт под поверхностью к игроку
        this.under = true;
        this.facing = p.cx < this.cx ? -1 : 1;
        this.x = G.clamp(G.lerp(this.x, p.cx - this.w / 2, 0.02), this.poolL - 10, this.poolR - this.w + 10);
        this.y = this.surface - 6;
        if (this.st % 30 === 0) G.Particles.fx('fx_splash', this.cx, this.surface + 4);
        if (this.st > [0, 90, 60, 45][this.ph]) {
          const r = Math.random();
          this.set(this.phase3 && r < 0.4 ? 'leap' : r < 0.6 ? 'rise' : 'spit');
        }
        break;
      case 'leap': // прыжок из жижи к герою
        this.under = false;
        if (this.st === 1) { this.y = this.surface - this.h; this.vy = -7.6; this.vx = G.clamp((p.cx - this.cx) / 48, -3.6, 3.6); this.facing = this.vx < 0 ? -1 : 1; G.Audio.play('roar'); G.Particles.fx('fx_splash', this.cx, this.surface + 4); }
        this.vy += 0.3; this.x += this.vx; this.y += this.vy;
        if (this.vy > 0 && this.bottom >= A.floor) {
          this.y = A.floor - this.h; this.vy = 0;
          if (this.cx > this.poolL && this.cx < this.poolR) {
            G.Particles.fx('fx_splash', this.cx, this.surface + 4); G.Audio.play('lava');
            this.ring(game, this.cx, this.surface - 4, 10, 1.8, 'bubble', 0, { life: 140 });
            this.set('sink');
          } else {
            G.Audio.play('explode'); game.shake(6, 16); G.Particles.dust(this.cx, A.floor, 8);
            game.spawn(new G.Shockwave(this.x - 4, A.floor, -1, 3)); game.spawn(new G.Shockwave(this.x + this.w + 4, A.floor, 1, 3));
            this.set('beached');
          }
        }
        break;
      case 'beached': // на суше — беззащитен
        this.dmgMul = 1.6;
        if (this.st % 8 === 0) G.Particles.fx('fx_puff', this.cx + G.rand(-20, 20), this.y + 6);
        if (this.st > 70) { this.dmgMul = 1; this.set('crawl'); }
        break;
      case 'crawl': { // ползёт обратно в жижу
        const mid = (this.poolL + this.poolR) / 2;
        this.facing = mid < this.cx ? -1 : 1;
        this.x += this.facing * 2.2;
        if (Math.abs(this.cx - mid) < 30) { G.Particles.fx('fx_splash', this.cx, this.surface + 4); this.set('sink'); }
        break;
      }
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
        if (this.st === 20 || (fast && this.st === 40) || (this.phase3 && this.st === 55)) {
          for (const k of this.phase3 ? [-1.5, -0.75, 0, 0.75, 1.5] : fast ? [-1, 0, 1] : [-0.5, 0.5]) {
            const dx = p.cx - this.cx;
            game.spawn(new G.EnemyShot(this.cx + this.facing * 20, this.y + 6, dx / 50 + k * 0.8, -4.4, 'bubble', { g: 0.18, r: 4 }));
          }
          G.Audio.play('enemyShot');
        }
        if (this.st > (this.phase3 ? 75 : 60)) this.set('sink');
        break;
    }
    this.x = G.clamp(this.x, this.L, this.R - this.w);
    if (!this.under) this.contact(game, this.state === 'bite' || this.state === 'leap' ? 2 : 1, { x: this.x + 6, y: this.y + 4, w: this.w - 12, h: this.h - 4 });
  }
  draw() {
    const A = G.Art;
    if (this.state === 'intro') return;
    const st = this.state;
    if (this.phase3 && !this.under) G.Gfx.glow(this.cx, this.cy, 34, '#80ff60', 0.3);
    let n = this.under ? A.frame('b_croc_swim', this.t) : st === 'bite' || st === 'leap' ? A.frame('b_croc_bite', this.t) : st === 'rest' || st === 'beached' ? 'b_croc_hurt0' : st === 'crawl' ? A.frame('b_croc_swim', this.t) : 'b_croc_rise0';
    this.spr(n, this.cx, this.under ? this.surface + 10 : this.bottom + 6, this.facing < 0);
  }
};

// 3. КАМЕННЫЙ ИДОЛ -------------------------------------------------------------
G.BossIdol = class extends G.Boss {
  constructor(game) {
    super(game, 56, 56, 66, 'idol');
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
        if (--this.cool <= 0) {
          const r = Math.random();
          if (this.phase3 && r < 0.4) this.set(Math.random() < 0.5 ? 'sweep' : 'meteor');
          else this.set(r < 0.55 ? 'spread' : r < 0.8 ? 'slamAim' : fast ? 'ring' : 'spread');
        }
        break;
      case 'sweep': { // лучи из глаз прочёсывают арену
        const dir = this.dir || (this.dir = p.cx < A.x + 240 ? 1 : -1);
        if (this.st % 9 === 1 && this.st < 80) {
          const k = (this.st - 1) / 9, x = dir > 0 ? A.x + 30 + k * 50 : A.x + G.W - 30 - k * 50;
          game.spawn(new G.Beam(x, game.cam.y, A.floor, 30, 16, 16));
        }
        if (this.st > 120) { this.dir = 0; this.set('idle'); this.cool = 40; }
        break;
      }
      case 'meteor': // поднимается и обрушивает каменный дождь
        this.y = G.lerp(this.y, top - 10, 0.08);
        if (this.st === 20) { G.Audio.play('roar'); game.shake(5, 40); this.rain(game, 9, 'rock', 26); }
        if (this.st === 60) { this.ring(game, this.cx, this.cy, 12, 1.6, 'orb', 0.2); G.Audio.play('enemyShot'); }
        if (this.st > 90) { this.set('idle'); this.cool = 50; }
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
          if (this.phase3) this.rain(game, 4, 'rock', 22);
          this.set('rest');
        }
        break;
      case 'rest': this.dmgMul = 1.5; if (this.st > [0, 70, 40, 34][this.ph]) { this.set('rise'); this.dmgMul = 1; } break;
      case 'rise': this.y = G.lerp(this.y, top + 20, 0.05); if (this.st > 50) { this.set('idle'); this.cool = 40; } break;
    }
    this.contact(game, this.state === 'slam' ? 2 : 1, { x: this.x + 6, y: this.y + 6, w: this.w - 12, h: this.h - 10 });
  }
  rageText(ph) { return ph === 3 ? 'ИДОЛ РАСКАЛЫВАЕТСЯ!' : 'ИДОЛ ПРОБУЖДАЕТСЯ!'; }
  draw() {
    G.Gfx.glow(this.cx, this.cy, this.phase3 ? 52 : 40, this.phase3 ? '#ffa020' : this.phase2 ? '#ff4030' : '#40e0ff', this.phase3 ? 0.4 : 0.25);
    const n = this.state === 'rest' ? 'b_idol_rest0' : this.state === 'spread' && this.st < 26 ? 'b_idol_open0' : this.phase2 ? 'b_idol_angry0' : 'b_idol0';
    this.spr(n, this.cx, this.cy);
    if (this.hp < this.maxHp * 0.6) G.Gfx.spr('b_idol_crack', Math.round(this.cx), Math.round(this.cy));
  }
};

// 4. КРИСТАЛЬНЫЙ ПАУК ------------------------------------------------------------
G.BossSpider = class extends G.Boss {
  constructor(game) {
    super(game, 48, 32, 70, 'spider');
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
          if (this.phase3 && r < 0.35) this.set(Math.random() < 0.5 ? 'storm' : 'cage');
          else this.set(r < 0.45 ? 'web' : r < 0.75 ? 'dropAim' : n < 3 ? 'spawn' : fast ? 'shards' : 'web');
        }
        break;
      case 'storm': // спираль из кристальных осколков
        if (this.st % 5 === 0 && this.st < 90) {
          const a = this.st * 0.19;
          for (const off of [0, Math.PI * 2 / 3, Math.PI * 4 / 3]) game.spawn(new G.EnemyShot(this.cx, this.cy, Math.cos(a + off) * 1.6, Math.sin(a + off) * 1.6, 'ice', { ghost: true, life: 220 }));
          if (this.st % 15 === 0) G.Audio.play('enemyShot');
        }
        if (this.st > 110) { this.set('idle'); this.cool = 40; }
        break;
      case 'cage': // паутина веером + кристаллы с потолка
        if (this.st === 10) { for (let i = -3; i <= 3; i++) this.shoot(game, this.cx, this.bottom, 2.2, 'web', i * 0.28, { r: 5 }); G.Audio.play('enemyShot'); }
        if (this.st === 30) this.rain(game, 7, 'ice', 30);
        if (this.st > 80) { this.set('idle'); this.cool = 50; }
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
          if (this.phase3) this.ring(game, this.cx, this.cy, 10, 1.8, 'ice', 0, { ghost: false });
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
  rageText(ph) { return ph === 3 ? 'ПАУК РАСКАЛЯЕТ КРИСТАЛЛЫ!' : 'ПАУК В ЯРОСТИ!'; }
  rageMove(game) { this.y = G.lerp(this.y, game.cam.y + 30, 0.08); }
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
  constructor(game) { super(game, 44, 64, 75, 'golem'); this.x = this.arena.x + 330; this.y = this.arena.floor - this.h; this.cool = 60; }
  think(game) {
    const p = game.player, A = this.arena, fast = this.phase2;
    this.dmgMul = this.state === 'rest' ? 2 : 0.35;
    if (this.state !== 'blizzard') game.wind = 0;
    switch (this.state) {
      case 'idle':
        this.facing = p.cx < this.cx ? -1 : 1;
        this.x += this.facing * (fast ? 0.7 : 0.45);
        if (--this.cool <= 0) {
          const near = Math.abs(p.cx - this.cx) < 70, r = Math.random();
          if (this.phase3 && r < 0.4) this.set(Math.random() < 0.55 ? 'roll' : 'blizzard');
          else this.set(near ? 'punch' : r < 0.6 ? 'slam' : fast ? 'throw' : 'slam');
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
      case 'roll': // сворачивается в ледяной ком и катится, отскакивая от стен
        if (this.st === 1) { G.Audio.play('roar'); this.bounces = 2; this.vx = 0; }
        if (this.st < 30) { if (this.st % 4 === 0) G.Particles.fx('fx_puff', this.cx, this.bottom - 6); break; }
        if (this.st === 30) { this.vx = (p.cx < this.cx ? -1 : 1) * 5; G.Audio.play('dash'); }
        this.x += this.vx;
        if (this.st % 3 === 0) G.Particles.dust(this.cx, this.bottom, 1);
        if (this.x <= this.L || this.x + this.w >= this.R) {
          this.x = G.clamp(this.x, this.L, this.R - this.w);
          G.Audio.play('explode'); game.shake(6, 14);
          this.rain(game, 3, 'ice', 18, { g: 0.25, r: 4 });
          if (this.bounces-- > 0) this.vx = -this.vx; else { this.vx = 0; this.set('rest'); }
        }
        break;
      case 'blizzard': // метель сдувает героя, сверху летят сосульки
        if (this.st === 1) { G.Audio.play('laser'); this.windDir = p.cx < this.cx ? 1 : -1; }
        game.wind = this.windDir * 0.9;
        if (this.st % 2 === 0) G.Particles.add({ x: this.windDir > 0 ? game.cam.x : game.cam.x + G.W, y: game.cam.y + G.rand(30, G.H - 20), vx: this.windDir * 5, vy: 0.6, life: 90, color: '#ffffff', kind: 'dot' });
        if (this.st % 24 === 12) this.rain(game, 2, 'ice', 22, { g: 0.25, r: 4 });
        if (this.st > 130) { game.wind = 0; this.set('idle'); this.cool = 40; }
        break;
      case 'rest':
        if (this.st % 10 === 0) G.Particles.add({ x: this.cx, y: this.cy, vy: -0.6, life: 20, color: '#80e0ff', kind: 'spark', add: true });
        if (this.st > [0, 100, 70, 60][this.ph]) { this.set('idle'); this.cool = 40; }
        break;
    }
    this.x = G.clamp(this.x, this.L, this.R - this.w);
    this.contact(game, this.state === 'roll' && this.st > 30 ? 2 : 1, { x: this.x + 6, y: this.y + 6, w: this.w - 12, h: this.h - 6 });
  }
  rageText(ph) { return ph === 3 ? 'ГОЛЕМ ВЫЗЫВАЕТ МЕТЕЛЬ!' : 'ГОЛЕМ В ЯРОСТИ!'; }
  draw() {
    if (this.state === 'roll') {
      // ледяной ком
      G.Gfx.glow(this.cx, this.cy + 10, 30, '#a0e8ff', 0.5);
      this.spr('b_golem_rest0', this.cx + (this.st < 30 && this.t % 2 ? 1 : 0), this.bottom, (Math.floor(this.x / 8) % 2) === 0);
      return;
    }
    if (this.phase3) G.Gfx.glow(this.cx, this.cy, 36, '#a0e8ff', 0.25);
    const n = this.state === 'punch' && this.st > 10 ? 'b_golem_punch0' : this.state === 'slam' && this.st < 32 ? 'b_golem_slam0' : this.state === 'rest' ? 'b_golem_rest0' : G.Art.frame('b_golem', this.t);
    if (this.state === 'rest') G.Gfx.glow(this.cx, this.cy, 26, '#60e0ff', 0.5);
    this.spr(n, this.cx, this.bottom, this.facing < 0);
  }
};

// 6. ОГНЕННЫЙ ЗМЕЙ ---------------------------------------------------------------
G.BossSerpent = class extends G.Boss {
  constructor(game) {
    super(game, 26, 22, 75, 'serpent');
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
  canRage() { return this.state === 'idle' || this.state === 'under'; }
  rageText(ph) { return ph === 3 ? 'ВУЛКАН ИЗВЕРГАЕТСЯ!' : 'ЗМЕЙ В ЯРОСТИ!'; }
  rageMove(game) { if (this.st % 4 === 0) for (const px of this.pits) G.Particles.add({ x: px + G.rand(-12, 12), y: this.lavaY, vx: G.rand(-1, 1), vy: G.rand(-4, -2), g: 0.15, life: 30, color: '#ffb040', add: true }); }
  eruption(game) {
    // фонтаны огня из всех лавовых ям
    G.Audio.play('lava'); game.shake(3, 10);
    for (const px of this.pits) for (let i = 0; i < 4; i++) game.spawn(new G.EnemyShot(px + G.rand(-8, 8), this.lavaY - 4, G.rand(-1.4, 1.4), G.rand(-7.5, -5.5), 'fire', { g: 0.16, r: 4, ghost: true, life: 160 }));
  }
  think(game) {
    const p = game.player, fast = this.phase2;
    if (this.state === 'idle' || this.state === 'under') {
      if (this.st > [0, 70, 40, 30][this.ph]) this.launch(game);
      if (this.phase3) { if (this.st === 6 || this.st === 22) this.eruption(game); }
      else if (fast && this.st === 20) this.rain(game, 5, 'fire', 34, { ghost: true });
    } else if (this.state === 'arc') {
      this.vy += this.g; this.x += this.vx; this.y += this.vy;
      if (this.st % (fast ? 22 : 34) === 0 && this.y < this.lavaY - 30) {
        for (const k of this.phase3 ? [-0.3, 0, 0.3] : [0]) this.shoot(game, this.cx, this.cy, 2.6, 'fire', k);
        G.Audio.play('enemyShot');
      }
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
    G.Gfx.glow(this.cx, this.cy, this.phase3 ? 34 : 24, this.phase3 ? '#ffe040' : '#ff6010', 0.45);
    this.spr(this.t % 20 < 10 ? 'b_serpent_head0' : 'b_serpent_head1', this.cx, this.cy, this.vx < 0);
  }
};

// 7. МЕХАНИЧЕСКИЙ ГАРУДА ---------------------------------------------------------
G.BossGaruda = class extends G.Boss {
  constructor(game) {
    super(game, 64, 38, 80, 'garuda');
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
        if (--this.cool <= 0) {
          const r = Math.random();
          if (this.phase3 && r < 0.4) this.set(Math.random() < 0.5 ? 'bombRun' : 'eyes');
          else this.set(r < 0.45 ? 'feathers' : r < 0.75 ? 'diveAim' : 'gust');
        }
        break;
      case 'bombRun': { // пролёт над ареной с бомбами
        if (this.st === 1) { this.dir = p.cx < A.x + 240 ? 1 : -1; this.x = this.dir > 0 ? A.x - this.w : A.x + G.W; G.Audio.play('roar'); }
        this.x += this.dir * 4;
        this.y = G.lerp(this.y, A.floor - 130, 0.1);
        this.facing = this.dir;
        if (this.st % 10 === 0 && this.cx > A.x + 20 && this.cx < A.x + G.W - 20) {
          game.spawn(new G.EnemyShot(this.cx, this.bottom, this.dir * 0.6, 1, 'rock', { g: 0.22, r: 5 }));
          G.Audio.play('enemyShot');
        }
        if ((this.dir > 0 && this.x > A.x + G.W) || (this.dir < 0 && this.x + this.w < A.x)) { this.x = A.x + 240 - this.w / 2; this.y = game.cam.y - 60; this.set('rise'); }
        break;
      }
      case 'eyes': // лазерный взгляд по герою трижды
        if (this.st === 1 || this.st === 30 || this.st === 60) game.spawn(new G.Beam(p.cx, game.cam.y, A.floor, 34, 20, 18));
        if (this.st % 6 === 0) G.Particles.sparks(this.cx + this.facing * 20, this.cy, 2, '#ff60c0', 1);
        if (this.st > 110) { this.set('idle'); this.cool = 40; }
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
    if (this.state !== 'gust') game.wind = 0;
    this.contact(game, this.state === 'dive' ? 2 : 1, { x: this.x + 8, y: this.y + 6, w: this.w - 16, h: this.h - 10 });
  }
  rageText(ph) { return ph === 3 ? 'ГАРУДА ПЕРЕГРУЖАЕТ ДВИГАТЕЛИ!' : 'ГАРУДА В ЯРОСТИ!'; }
  rageMove(game) { this.y = G.lerp(this.y, game.cam.y + 40, 0.06); this.x = G.lerp(this.x, this.arena.x + 240 - this.w / 2, 0.05); }
  draw() {
    if (this.phase3) G.Gfx.glow(this.cx, this.cy, 40, '#ff8040', 0.3);
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

// Горизонтальный луч над полом: спасают только платформы
G.HBeam = class HBeam extends G.Entity {
  constructor(x, y, w, h = 26, warn = 60, life = 36) { super(x, y, w, h); this.warn = warn; this.life = life; this.layer = 2; }
  update(game) {
    this.t++;
    if (this.t === this.warn) { G.Audio.play('laser'); game.shake(3, this.life); }
    if (this.t > this.warn + this.life) this.dead = true;
    if (this.t > this.warn) {
      const p = game.player;
      if (p && p.alive && G.overlap({ x: this.x, y: this.y + 3, w: this.w, h: this.h - 6 }, p.hurtbox())) p.hurt(1, game, p.cx);
      if (this.t % 2 === 0) G.Particles.add({ x: this.x + Math.random() * this.w, y: this.y + this.h / 2, vx: G.rand(-1, 1), vy: G.rand(-2, -0.5), life: 16, color: '#ff80e0', kind: 'spark', add: true });
    }
  }
  draw(c) {
    const x = Math.round(this.x), y = Math.round(this.y), w = Math.round(this.w), h = Math.round(this.h);
    if (this.t <= this.warn) {
      if (this.t % 8 < 4) { c.fillStyle = 'rgba(255,60,200,0.45)'; c.fillRect(x, y, w, 1); c.fillRect(x, y + h - 1, w, 1); }
      if (this.t % 16 < 8) G.Gfx.text('!', x + w / 2, y + h / 2 - 4, { align: 'center', color: '#ff80e0' });
      return;
    }
    const k = this.t % 4 < 2 ? 0 : 1;
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = 'rgba(255,40,180,0.45)'; c.fillRect(x, y + k, w, h - k * 2);
    c.fillStyle = 'rgba(255,160,240,0.85)'; c.fillRect(x, y + h / 2 - 5 + k, w, 10 - k * 2);
    c.fillStyle = '#ffffff'; c.fillRect(x, Math.round(y + h / 2 - 1), w, 2);
    c.globalCompositeOperation = 'source-over';
  }
};

// 8. ПРИНЦ ЗАРКУН: принц (1 фаза) → «смерть» → демон (2 фазы) → «смерть» → Истинный Глаз (4 фазы)
const PRINCE_FORMS = {
  1: { w: 22, h: 40, hp: 40, phases: 1, name: 'ПРИНЦ ЗАРКУН' },
  2: { w: 80, h: 66, hp: 72, phases: 2, name: 'ДЕМОН ЗАРКУН' },
  3: { w: 56, h: 56, hp: 124, phases: 4, name: 'ИСТИННЫЙ ГЛАЗ ЗАРКУНА' },
};
G.BossPrince = class extends G.Boss {
  constructor(game) {
    super(game, 22, 40, 40, 'prince');
    const A = this.arena, f = A.floor;
    this.alpha = 0; this.cool = 60;
    this.spots = [[A.x + 90, f - 110], [A.x + 390, f - 110], [A.x + 240, f - 150], [A.x + 150, f - 50], [A.x + 330, f - 50], [A.x + 240, f - 90]];
    this.setupForm(game.finalStartForm || 1, game, true);
  }
  setupForm(form, game, first) {
    const F = PRINCE_FORMS[form], A = this.arena;
    this.form = form; this.w = F.w; this.h = F.h; this.maxHp = this.hp = F.hp; this.phases = F.phases; this.ph = 1; this.name = F.name;
    this.cool = 60; this.dmgMul = 1; game.bossDark = false;
    if (form === 1) { this.x = A.x + 360; this.y = A.floor - 120; this.alpha = 0; this.introUpdate = () => { this.alpha = Math.min(1, this.st / 60); }; }
    else { this.x = A.x + 240 - this.w / 2; this.y = game.cam.y + (form === 2 ? 20 : 30); this.alpha = 1; this.introUpdate = null; }
    if (!first) {
      G.UI.bossBanner(this.name);
      G.Audio.music(form === 3 ? 'final3' : 'final', true);
      game.flashScreen(form === 3 ? '#ffffff' : '#ff80e0', 20); G.Audio.play('explode'); game.shake(8, 30);
      this.set('idle');
    }
    game.onFinalForm && game.onFinalForm(form);
  }
  hitTest(b) { return this.alpha > 0.5 && this.state !== 'reborn' && !this.closed && G.overlap(this, b); }
  canRage() { return super.canRage() && this.state !== 'blink'; }
  rageText(ph) {
    if (this.form === 2) return 'ДЕМОН ОБНАЖАЕТ КЛЫКИ!';
    return ['', '', 'ГЛАЗ ПРИЗЫВАЕТ БУРЮ!', 'МИР ПОГРУЖАЕТСЯ ВО ТЬМУ!', 'ПОСЛЕДНЯЯ ЯРОСТЬ ЗАРКУНА!'][ph];
  }
  onRage(game, ph) { if (this.form === 3) game.bossDark = ph === 3; this.closed = false; }
  rageMove(game) { this.x = G.lerp(this.x, this.arena.x + 240 - this.w / 2, 0.05); this.y = G.lerp(this.y, game.cam.y + 30, 0.05); }
  // «смерть» первых двух форм — ложная
  updateDying(game) {
    if (this.form >= 3) { game.bossDark = false; super.updateDying(game); return; }
    this.dyingT++;
    this.flash = this.dyingT % 8 < 4 ? 2 : 0;
    if (this.dyingT % 7 === 0 && this.dyingT < 110) { G.Particles.explosion(this.x + Math.random() * this.w, this.y + Math.random() * this.h); G.Audio.play('explode'); game.shake(3, 6); }
    if (this.dyingT === 120) {
      G.Particles.explosion(this.cx, this.cy, true); G.Audio.play('explode');
      game.shake(8, 25); game.flashScreen('#ffffff', 20);
      this.dying = false; this.alpha = 0; this.set('reborn');
    }
  }
  reborn(game) {
    const A = this.arena, cx = A.x + 240, cy = game.cam.y + 80, next = this.form + 1;
    const T = next === 2 ? 220 : 280;
    // тишина... потом тьма стягивается в центр
    if (this.st > 60 && this.st % 3 === 0) {
      const a = Math.random() * Math.PI * 2, r = 120 + Math.random() * 60;
      G.Particles.add({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, vx: -Math.cos(a) * 3, vy: -Math.sin(a) * 3, life: 38, color: next === 3 ? '#ffffff' : '#ff60d0', kind: 'spark', add: true });
    }
    if (this.st === 70) { G.Audio.play('teleport'); G.UI.toast(next === 2 ? 'Ха-ха-ха... ЭТО ЕЩЁ НЕ КОНЕЦ!' : 'ВЫ НЕ ПОНИМАЕТЕ... Я — САМ ТРЕТИЙ ГЛАЗ!'); }
    if (this.st > 120 && this.st % 20 === 0) { G.Audio.play('roar'); game.shake(3 + (this.st - 120) / 30, 12); }
    if (next === 3 && this.st === 150) game.bossDark = true;
    if (this.st >= T) { game.bossDark = false; this.setupForm(next, game, false); }
  }

  think(game) {
    const p = game.player;
    this.facing = p.cx < this.cx ? -1 : 1;
    if (this.state === 'reborn') { this.reborn(game); return; }
    if (this.form === 1) this.form1(game, p);
    else if (this.form === 2) this.form2(game, p);
    else this.form3(game, p);
    if (this.alpha > 0.5 && !this.closed) this.contact(game, this.state === 'dive' || this.state === 'crash' ? 2 : 1, this.form === 2 ? { x: this.x + 10, y: this.y + 8, w: this.w - 20, h: this.h - 14 } : this.form === 3 ? { x: this.x + 8, y: this.y + 8, w: this.w - 16, h: this.h - 16 } : this);
  }
  form1(game, p) {
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
        if (this.st === 20) { const sp = G.pick(this.spots.filter((q) => Math.abs(q[0] - this.cx) > 50)); this.x = sp[0] - this.w / 2; this.y = sp[1] - this.h; }
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
        if (this.st === 30) { for (const sd of [-1, 1]) { const g = new G.Ghost(this.cx + sd * 34, this.cy); g.active = true; game.spawn(g); G.Particles.fx('fx_ring', this.cx + sd * 34, this.cy - 8); } G.Audio.play('teleport'); }
        if (this.st > 60) { this.set('idle'); this.cool = 50; }
        break;
    }
  }
  form2(game, p) {
    const A = this.arena, top = game.cam.y + 18, two = this.ph >= 2;
    switch (this.state) {
      case 'idle':
        this.x = G.lerp(this.x, A.x + 240 + Math.sin(this.t * 0.015) * 150 - this.w / 2, 0.05);
        this.y = G.lerp(this.y, top + Math.sin(this.t * 0.04) * 8, 0.05);
        if (--this.cool <= 0) {
          const r = Math.random();
          if (two && r < 0.4) this.set(Math.random() < 0.5 ? 'crossfire' : 'ghostStorm');
          else this.set(r < 0.5 ? 'lasers' : r < 0.75 ? 'spiral' : 'diveAim');
        }
        break;
      case 'lasers':
        if (this.st === 1) { const off = Math.random() * 100; for (let i = 0; i < 4; i++) game.spawn(new G.Beam(A.x + 40 + ((off + i * 110) % 400), game.cam.y, A.floor, 50, 40, 18)); }
        if (this.st === 60) game.spawn(new G.Beam(p.cx, game.cam.y, A.floor, 40, 30, 18));
        if (this.st > 130) { this.set('idle'); this.cool = two ? 25 : 40; }
        break;
      case 'crossfire': // два залпа лучей «ёлочкой», между ними — луч по герою
        if (this.st === 1) for (let i = 0; i < 5; i++) game.spawn(new G.Beam(A.x + 30 + i * 100, game.cam.y, A.floor, 44, 30, 18));
        if (this.st === 45) for (let i = 0; i < 4; i++) game.spawn(new G.Beam(A.x + 80 + i * 100, game.cam.y, A.floor, 44, 30, 18));
        if (this.st === 30 || this.st === 90) game.spawn(new G.Beam(p.cx, game.cam.y, A.floor, 36, 24, 18));
        if (this.st > 150) { this.set('idle'); this.cool = 30; }
        break;
      case 'ghostStorm':
        if (this.st === 20) { for (const sd of [-1, 0, 1]) { const g = new G.Ghost(this.cx + sd * 50, this.cy + 20); g.active = true; game.spawn(g); G.Particles.fx('fx_ring', this.cx + sd * 50, this.cy + 12); } G.Audio.play('teleport'); }
        if (this.st === 50 || this.st === 80) { this.ring(game, this.cx, this.cy + 10, 14, 1.6, 'orb', this.st * 0.1); G.Audio.play('enemyShot'); }
        if (this.st > 110) { this.set('idle'); this.cool = 40; }
        break;
      case 'spiral':
        if (this.st % (two ? 4 : 5) === 0 && this.st < 90) {
          const a = this.st * 0.21;
          for (const off of two ? [0, Math.PI * 2 / 3, Math.PI * 4 / 3] : [0, Math.PI]) game.spawn(new G.EnemyShot(this.cx, this.cy + 6, Math.cos(a + off) * 1.7, Math.sin(a + off) * 1.7, 'orb', { ghost: true, life: 260 }));
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
      case 'rest': this.dmgMul = 1.3; if (this.st > (two ? 40 : 50)) { this.dmgMul = 1; this.set('rise'); } break;
      case 'rise': this.y = G.lerp(this.y, top, 0.06); if (this.st > 50) { this.set('idle'); this.cool = 30; } break;
    }
  }
  // Истинный Глаз: 1 — Взгляд, 2 — Буря, 3 — Тьма, 4 — Ярость
  form3(game, p) {
    const A = this.arena, top = game.cam.y + 26, ph = this.ph;
    const cd = [0, 50, 40, 40, 26][ph];
    switch (this.state) {
      case 'idle': {
        const sp = [0, 0.012, 0.022, 0.016, 0.026][ph];
        this.x = G.lerp(this.x, A.x + 240 + Math.sin(this.t * sp) * 160 - this.w / 2, 0.05);
        this.y = G.lerp(this.y, top + Math.sin(this.t * 0.05) * 10, 0.05);
        if (--this.cool <= 0) {
          const pool = [null, ['stare', 'tears', 'tears'], ['meteors', 'spiral', 'stare'], ['blink', 'ghosts', 'tears', 'blink'], ['hbeam', 'crash', 'spiral', 'stare', 'hbeam']][ph];
          this.set(G.pick(pool));
        }
        break;
      }
      case 'stare': // лучи из зрачка по герою
        for (const k of [1, 28, 55]) if (this.st === k) game.spawn(new G.Beam(p.cx, game.cam.y, A.floor, ph >= 4 ? 26 : 34, 20, 18));
        if (this.st > 100) { this.set('idle'); this.cool = cd; }
        break;
      case 'tears': // прицельные очереди
        if (this.st % 14 === 0 && this.st <= 56) { for (const k of [-0.2, 0, 0.2]) this.shoot(game, this.cx, this.cy, 2.7, 'orb', k, { ghost: true }); G.Audio.play('enemyShot'); }
        if (this.st > 80) { this.set('idle'); this.cool = cd; }
        break;
      case 'meteors':
        if (this.st === 10) { G.Audio.play('roar'); game.shake(5, 50); this.rain(game, 9, 'rock', 26); }
        if (this.st === 50) { this.ring(game, this.cx, this.cy, 14, 1.6, 'orb', 0.3); G.Audio.play('enemyShot'); }
        if (this.st > 90) { this.set('idle'); this.cool = cd; }
        break;
      case 'spiral':
        if (this.st % 4 === 0 && this.st < 96) {
          const a = this.st * (ph >= 4 ? 0.25 : 0.19);
          for (const off of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) game.spawn(new G.EnemyShot(this.cx, this.cy, Math.cos(a + off) * 1.6, Math.sin(a + off) * 1.6, 'orb', { ghost: true, life: 240 }));
          if (this.st % 16 === 0) G.Audio.play('enemyShot');
        }
        if (this.st > 116) { this.set('idle'); this.cool = cd; }
        break;
      case 'blink': // глаз закрывается, исчезает во тьме и открывается в другом месте
        this.closed = this.st < 50;
        if (this.st === 1) G.Audio.play('teleport');
        if (this.st === 25) { const sp = G.pick(this.spots); this.x = sp[0] - this.w / 2; this.y = Math.min(sp[1] - this.h, A.floor - 100); }
        if (this.st === 50) { this.ring(game, this.cx, this.cy, 16, 1.7, 'orb', Math.random()); G.Audio.play('enemyShot'); }
        if (this.st > 80) { this.closed = false; this.set('idle'); this.cool = cd; }
        break;
      case 'ghosts':
        if (this.st === 20) { for (const sd of [-1, 1]) { const g = new G.Ghost(this.cx + sd * 60, this.cy + 10); g.active = true; game.spawn(g); } G.Audio.play('teleport'); }
        if (this.st > 60) { this.set('idle'); this.cool = cd; }
        break;
      case 'hbeam': // луч над полом — спасайся на платформах
        if (this.st === 1) { game.spawn(new G.HBeam(A.x + 16, A.floor - 30, G.W - 32, 30, 66, 40)); G.UI.toast('НАВЕРХ, НА ПЛАТФОРМЫ!'); }
        if (this.st === 70) { this.ring(game, this.cx, this.cy, 12, 1.5, 'orb', 0.5); G.Audio.play('enemyShot'); }
        if (this.st > 120) { this.set('idle'); this.cool = cd; }
        break;
      case 'crash': // падает на арену и снова взлетает
        if (this.st < 30) { this.x = G.lerp(this.x, G.clamp(p.cx - this.w / 2, this.L, this.R - this.w), 0.1); if (this.st === 6) game.spawn(new G.Warning(this.x, this.y, this.w, A.floor - this.y, 24)); this.vy = 2; break; }
        if (this.bottom < A.floor) { this.vy += 0.8; this.y = Math.min(this.y + this.vy, A.floor - this.h); break; }
        if (this.vy > 0) {
          this.vy = 0; game.shake(8, 20); G.Audio.play('explode');
          game.spawn(new G.Shockwave(this.x, A.floor, -1, 3.4)); game.spawn(new G.Shockwave(this.x + this.w, A.floor, 1, 3.4));
          this.ring(game, this.cx, this.cy, 12, 1.8, 'orb', 0);
          this.restT = 0;
        }
        this.dmgMul = 1.3;
        if (++this.restT > 40) { this.dmgMul = 1; this.y = G.lerp(this.y, top, 0.08); if (this.restT > 90) { this.set('idle'); this.cool = cd; } }
        break;
    }
  }

  draw(c) {
    const pa = c.globalAlpha;
    c.globalAlpha = pa * this.alpha;
    if (this.state === 'reborn') { c.globalAlpha = pa; return; }
    if (this.form === 1) {
      G.Gfx.glow(this.cx, this.cy, 26, '#c040ff', 0.35);
      const n = ['ring', 'aim', 'summon'].includes(this.state) ? 'b_prince_cast0' : G.Art.frame('b_prince', this.t);
      this.spr(n, this.cx, this.bottom + Math.round(Math.sin(this.t * 0.08) * 2), this.facing < 0);
    } else if (this.form === 2) {
      G.Gfx.glow(this.cx, this.cy, 60, this.ph >= 2 ? '#ff3060' : '#ff40c0', 0.3);
      const n = this.state === 'rest' ? 'b_demon_rest0' : this.state === 'spiral' || this.state === 'ghostStorm' ? 'b_demon_mouth0' : 'b_demon0';
      this.spr(n, this.cx, this.cy);
    } else this.drawEye(c);
    c.globalAlpha = pa;
  }
  // Истинный Глаз рисуется процедурно, пиксельными дисками
  drawEye(c) {
    const cx = Math.round(this.cx), cy = Math.round(this.cy), ph = this.ph, t = this.t;
    const IRIS = [null, '#b040ff', '#ff8a20', '#30e0c0', '#ff2040'][ph];
    const disc = (x, y, r, col) => { c.fillStyle = col; for (let dy = -r; dy <= r; dy++) { const w = Math.round(Math.sqrt(r * r - dy * dy)); c.fillRect(x - w, y + dy, w * 2 + 1, 1); } };
    G.Gfx.glow(cx, cy, 52 + Math.sin(t * 0.1) * 4, IRIS, 0.45);
    // вращающиеся осколки-кристаллы
    for (let i = 0; i < 6; i++) {
      const a = t * 0.03 * (ph >= 4 ? 2 : 1) + (i * Math.PI) / 3, r = 40 + Math.sin(t * 0.05 + i) * 4;
      const x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r * 0.8);
      c.fillStyle = '#2a1040'; c.fillRect(x - 3, y - 4, 6, 8);
      c.fillStyle = IRIS; c.fillRect(x - 2, y - 3, 4, 6);
      c.fillStyle = '#ffffff'; c.fillRect(x - 1, y - 2, 1, 2);
    }
    const white = this.flash >= 4 && !this.dying;
    disc(cx, cy, 28, '#2a0a30');
    disc(cx, cy, 26, white ? '#ffffff' : '#f0d8e8');
    if (!white) {
      // прожилки
      c.fillStyle = '#d04060';
      for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4 + 0.3; for (let k = 16; k < 25; k++) c.fillRect(Math.round(cx + Math.cos(a + k * 0.02) * k), Math.round(cy + Math.sin(a + k * 0.02) * k), 1, 1); }
      c.fillStyle = '#c8a8c0';
      for (let dy = 14; dy <= 26; dy++) { const w = Math.round(Math.sqrt(26 * 26 - dy * dy)); c.fillRect(cx - w, cy + dy, w * 2 + 1, 1); }
    }
    // зрачок следит за героем
    const p = G.game.player, ang = Math.atan2(p.cy - cy, p.cx - cx), d = Math.min(9, Math.hypot(p.cx - cx, p.cy - cy) / 12);
    const ix = Math.round(cx + Math.cos(ang) * d), iy = Math.round(cy + Math.sin(ang) * d);
    disc(ix, iy, 13, '#140818');
    disc(ix, iy, 12, white ? '#ffffff' : IRIS);
    disc(ix, iy, 8, white ? '#ffffff' : '#ffffff');
    disc(ix, iy, 7, IRIS);
    c.fillStyle = '#0a0410';
    const slit = ph >= 4 ? 2 : 3;
    c.fillRect(ix - slit + 1, iy - 8, slit * 2 - 1, 17);
    c.fillStyle = '#ffffff'; c.fillRect(ix - 6, iy - 6, 3, 3); c.fillRect(ix + 4, iy + 3, 1, 1);
    // веки: закрытый глаз
    const lid = this.closed ? 1 : this.state === 'blink' && this.st < 60 ? 1 - (this.st - 50) / 10 : 0;
    if (lid > 0) {
      const h = Math.round(28 * Math.min(1, lid));
      c.fillStyle = '#3a1450';
      for (let dy = -28; dy < -28 + h; dy++) { const w = Math.round(Math.sqrt(Math.max(0, 28 * 28 - dy * dy))); c.fillRect(cx - w, cy + dy, w * 2 + 1, 1); }
      for (let dy = 28; dy > 28 - h; dy--) { const w = Math.round(Math.sqrt(Math.max(0, 28 * 28 - dy * dy))); c.fillRect(cx - w, cy + dy, w * 2 + 1, 1); }
      if (lid >= 1) { c.fillStyle = '#ff60d0'; c.fillRect(cx - 24, cy, 49, 1); }
    }
  }
};

G.makeBoss = (kind, game) => {
  const B = { bull: G.BossBull, croc: G.BossCroc, idol: G.BossIdol, spider: G.BossSpider, golem: G.BossGolem, serpent: G.BossSerpent, garuda: G.BossGaruda, prince: G.BossPrince }[kind];
  return new B(game);
};
