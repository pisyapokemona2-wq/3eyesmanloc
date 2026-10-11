'use strict';
// Враги на спрайтах. Каждый класс — поведение + имя анимации.
G.Enemy = class Enemy extends G.Entity {
  constructor(x, y, w, h, hp) {
    super(x - w / 2, y - h, w, h);
    this.hp = this.maxHp = hp;
    this.isEnemy = true;
    this.dmg = 1;
    this.stompable = true;
    this.coins = 2;
    this.flash = 0;
    this.facing = -1;
    this.active = false;
    this.meter = 10;
    this.alpha = 1;
  }
  hitTest(b) { return G.overlap(this, b); }
  hurt(d, game, src) {
    if (this.dead) return;
    if (this.guard && this.guard(src)) return;
    this.hp -= d;
    this.flash = 6;
    if (src && src.vx) this.vx += Math.sign(src.vx) * 0.6;
    G.Audio.play('hit');
    if (this.hp <= 0) this.die(game); else game.hitstop(1);
  }
  die(game) {
    this.dead = true;
    G.Audio.play('kill');
    G.Particles.explosion(this.cx, this.cy);
    game.shake(2, 6);
    game.hitstop(3);
    game.dropCoins(this.cx, this.cy, this.coins);
    game.onEnemyKilled(this);
  }
  wake(game) {
    if (!this.active) {
      if (this.onScreen(game, 30)) this.active = true; else return false;
    }
    if (this.flash > 0) this.flash--;
    return true;
  }
  touchPlayer(game) {
    const p = game.player;
    if (!p || !p.alive || this.dead || !G.overlap(this, p)) return;
    if (p.pounding) { this.hurt(4, game, null); p.vy = -5; p.pounding = false; return; }
    if (this.stompable && p.vy > 0.5 && p.bottom - p.vy <= this.y + 6) {
      p.vy = G.Input.down('jump') ? -7.2 : -5;
      p.jumpHeld = G.Input.down('jump');
      p.airJumps = 0; p.canDash = true;
      G.Audio.play('stomp');
      G.Particles.fx('fx_hit', p.cx, p.bottom);
      this.hurt(2, game, null);
      return;
    }
    if (game.eyeMode > 0 || p.dashT > 0) { if (game.eyeMode > 0) this.hurt(3, game, { vx: p.facing }); return; }
    p.hurt(this.dmg, game, this.cx);
  }
  walk(game, speed, turnAtEdges = true) {
    const L = game.level;
    this.vx = G.approach(this.vx, this.facing * speed, 0.1);
    this.vy = Math.min(this.vy + 0.35, 5.5);
    G.Physics.step(this, L);
    if (this.hitL || this.hitR || (turnAtEdges && this.onGround && !G.Physics.groundAhead(this, L, this.facing))) { this.facing *= -1; this.vx = 0; }
    if (this.y > L.h * 16) this.dead = true;
  }
  sprite() { return 'e_imp_walk0'; }
  draw(c) {
    const pa = c.globalAlpha;
    c.globalAlpha = pa * this.alpha;
    G.Gfx.spr(this.sprite(), Math.round(this.cx), Math.round(this.bottom), this.facing < 0, this.flash > 0 && this.flash % 2 === 0);
    c.globalAlpha = pa;
  }
  playerDist(game) { const p = game.player; return p ? G.dist(p.cx, p.cy, this.cx, this.cy) : 9999; }
  aimAt(game, x, y, speed, kind, spread = 0, opts) {
    const p = game.player;
    const a = Math.atan2(p.cy - y, p.cx - x) + spread;
    game.spawn(new G.EnemyShot(x, y, Math.cos(a) * speed, Math.sin(a) * speed, kind, opts));
  }
};
const EA = (a, t) => G.Art.frame(a, t);

G.Imp = class Imp extends G.Enemy {
  constructor(x, y) { super(x, y, 12, 14, 2); }
  update(game) { this.t++; if (!this.wake(game)) return; this.walk(game, 0.6); this.touchPlayer(game); }
  sprite() { return EA('e_imp_walk', this.t); }
};

G.Rat = class Rat extends G.Enemy {
  constructor(x, y) { super(x, y, 16, 10, 2); this.coins = 2; }
  update(game) {
    this.t++; if (!this.wake(game)) return;
    const p = game.player;
    const sp = p && Math.abs(p.cy - this.cy) < 24 && Math.abs(p.cx - this.cx) < 120 && Math.sign(p.cx - this.cx) === this.facing ? 1.8 : 1.1;
    this.walk(game, sp); this.touchPlayer(game);
  }
  sprite() { return EA('e_rat_run', this.t); }
};

G.Frog = class Frog extends G.Enemy {
  constructor(x, y) { super(x, y, 14, 12, 3); this.cool = G.randi(40, 90); this.coins = 3; }
  update(game) {
    this.t++; if (!this.wake(game)) return;
    const p = game.player;
    this.vy = Math.min(this.vy + 0.32, 5.5);
    if (this.onGround) {
      this.vx *= 0.7;
      if (p) this.facing = p.cx < this.cx ? -1 : 1;
      if (--this.cool <= 0) { this.vy = -5.6; this.vx = this.facing * 1.8; this.cool = G.randi(60, 100); G.Particles.dust(this.cx, this.bottom, 1); }
    }
    G.Physics.step(this, game.level);
    if (this.hitL || this.hitR) this.vx *= -1;
    if (this.y > game.level.h * 16) this.dead = true;
    this.touchPlayer(game);
  }
  sprite() { return this.onGround ? 'e_frog_idle0' : 'e_frog_jump0'; }
};

G.Hedgehog = class Hedgehog extends G.Enemy {
  constructor(x, y) { super(x, y, 14, 12, 3); this.stompable = false; this.roll = 0; this.coins = 3; }
  update(game) {
    this.t++; if (!this.wake(game)) return;
    const p = game.player;
    if (this.roll > 0) this.roll--;
    else if (p && Math.abs(p.cx - this.cx) < 100 && Math.abs(p.cy - this.cy) < 24 && this.t % 150 === 0) { this.facing = p.cx < this.cx ? -1 : 1; this.roll = 70; }
    this.walk(game, this.roll > 0 ? 2.3 : 0.5);
    this.touchPlayer(game);
  }
  sprite() { return this.roll > 0 ? EA('e_hedgehog_roll', this.t) : EA('e_hedgehog_walk', this.t); }
};

G.StoneHead = class StoneHead extends G.Enemy {
  constructor(x, y) { super(x, y, 16, 16, 5); this.cool = 90; this.stompable = false; this.coins = 4; this.meter = 15; }
  update(game) {
    this.t++; if (!this.wake(game)) return;
    const p = game.player;
    if (p) this.facing = p.cx < this.cx ? -1 : 1;
    if (p && p.alive && Math.abs(p.cx - this.cx) < 240 && --this.cool <= 0) {
      this.cool = 110;
      this.aimAt(game, this.cx + this.facing * 6, this.cy, 2.2, 'fire');
      G.Audio.play('enemyShot');
    }
    this.touchPlayer(game);
  }
  sprite() { return this.cool < 20 ? 'e_head_fire0' : 'e_head_idle0'; }
};

G.Slime = class Slime extends G.Enemy {
  constructor(x, y) { super(x, y, 14, 9, 2); this.coins = 1; }
  update(game) {
    this.t++; if (!this.wake(game)) return;
    this.walk(game, 0.35);
    if (this.flash === 5 && this.onGround) this.vy = -3;
    this.touchPlayer(game);
  }
  sprite() { return EA('e_slime_crawl', this.t); }
};

G.Yeti = class Yeti extends G.Enemy {
  constructor(x, y) { super(x, y, 20, 26, 8); this.cool = 100; this.coins = 6; this.meter = 20; this.throwT = 0; }
  update(game) {
    this.t++; if (!this.wake(game)) return;
    const p = game.player;
    if (this.throwT > 0) {
      this.throwT--;
      this.vx = 0;
      if (this.throwT === 10) {
        const dx = p.cx - this.cx;
        game.spawn(new G.EnemyShot(this.cx + this.facing * 8, this.y + 4, G.clamp(dx / 45, -3, 3), -4.6, 'snow', { g: 0.2, r: 4 }));
        G.Audio.play('enemyShot');
      }
      this.vy = Math.min(this.vy + 0.35, 5.5);
      G.Physics.step(this, game.level);
    } else {
      this.walk(game, 0.45);
      if (p && p.alive && Math.abs(p.cx - this.cx) < 200 && --this.cool <= 0) { this.cool = 120; this.throwT = 24; this.facing = p.cx < this.cx ? -1 : 1; }
    }
    this.touchPlayer(game);
  }
  sprite() { return this.throwT > 0 ? 'e_yeti_throw0' : EA('e_yeti_walk', this.t); }
};

G.Penguin = class Penguin extends G.Enemy {
  constructor(x, y) { super(x, y, 14, 14, 3); this.slide = 0; this.coins = 3; }
  update(game) {
    this.t++; if (!this.wake(game)) return;
    const p = game.player;
    if (this.slide > 0) {
      this.slide--;
      this.vx = this.facing * 3.2;
      this.vy = Math.min(this.vy + 0.35, 5.5);
      G.Physics.step(this, game.level);
      if (this.hitL || this.hitR) { this.facing *= -1; this.slide = 0; }
      if (this.t % 3 === 0) G.Particles.add({ x: this.cx - this.facing * 6, y: this.bottom - 1, vy: -0.4, life: 12, color: '#ffffff' });
    } else {
      this.walk(game, 0.5);
      if (p && Math.abs(p.cy - this.cy) < 20 && Math.abs(p.cx - this.cx) < 140 && this.t % 90 === 0) { this.facing = p.cx < this.cx ? -1 : 1; this.slide = 60; }
    }
    this.touchPlayer(game);
  }
  sprite() { return this.slide > 0 ? 'e_penguin_slide0' : EA('e_penguin_walk', this.t); }
};

// Страж со щитом: спереди неуязвим для выстрелов и копья (кроме заряда)
G.Knight = class Knight extends G.Enemy {
  constructor(x, y) { super(x, y, 14, 24, 5); this.coins = 5; this.meter = 15; this.guardT = 0; }
  guard(src) {
    if (!src || src.charged) return false;
    const from = src.vx ? -Math.sign(src.vx) : 0;
    if (from === this.facing) {
      this.guardT = 12;
      G.Audio.play('bump');
      G.Particles.sparks(this.cx + this.facing * 8, this.cy, 4, '#ffffff', 1.6);
      if (src instanceof G.Spear) src.recall();
      return true;
    }
    return false;
  }
  update(game) {
    this.t++; if (!this.wake(game)) return;
    if (this.guardT > 0) this.guardT--;
    const p = game.player;
    if (p && this.t % 60 === 0 && Math.abs(p.cy - this.cy) < 30) this.facing = p.cx < this.cx ? -1 : 1;
    this.walk(game, this.guardT > 0 ? 0 : 0.4);
    this.touchPlayer(game);
  }
  sprite() { return this.guardT > 0 ? 'e_knight_guard0' : EA('e_knight_walk', this.t); }
};

G.Bat = class Bat extends G.Enemy {
  constructor(x, y) { super(x, y - 2, 14, 10, 1); this.state = 'hang'; this.coins = 1; }
  update(game) {
    this.t++; if (!this.wake(game)) return;
    const p = game.player;
    if (this.state === 'hang') {
      if (p && p.alive && Math.abs(p.cx - this.cx) < 90 && p.cy > this.cy - 16) { this.state = 'swoop'; G.Audio.play('enemyShot'); }
    } else {
      const dx = p.cx - this.cx, dy = p.cy - 6 - this.cy, d = Math.hypot(dx, dy) || 1;
      this.vx = G.lerp(this.vx, (dx / d) * 1.5, 0.04);
      this.vy = G.lerp(this.vy, (dy / d) * 1.5 + Math.sin(this.t * 0.15), 0.06);
      this.x += this.vx; this.y += this.vy;
      this.facing = this.vx > 0 ? 1 : -1;
    }
    this.touchPlayer(game);
  }
  sprite() { return this.state === 'hang' ? 'e_bat_hang0' : EA('e_bat_fly', this.t); }
};

G.Crow = class Crow extends G.Enemy {
  constructor(x, y) { super(x, y - 4, 16, 12, 2); this.baseY = this.y; this.coins = 2; this.dive = 0; }
  update(game) {
    this.t++; if (!this.wake(game)) return;
    const p = game.player;
    if (this.dive > 0) {
      this.dive--;
      this.x += this.facing * 2.4;
      this.y += this.dive > 30 ? 2.2 : -2.2;
    } else {
      this.x += this.facing * 1.1;
      this.y = G.lerp(this.y, this.baseY + Math.sin(this.t * 0.06) * 10, 0.1);
      if (p && Math.abs(p.cx - this.cx) < 60 && p.cy > this.cy + 20 && Math.sign(p.cx - this.cx) === this.facing && this.t % 30 === 0) this.dive = 60;
      if (Math.abs(this.x - this.baseX0()) > 140) this.facing *= -1;
    }
    this.touchPlayer(game);
  }
  baseX0() { if (this.x0 === undefined) this.x0 = this.x; return this.x0; }
  sprite() { return EA('e_crow_fly', this.t); }
};

G.Ghost = class Ghost extends G.Enemy {
  constructor(x, y) { super(x, y, 14, 16, 2); this.coins = 3; this.alpha = 0.85; }
  update(game) {
    this.t++; if (!this.wake(game)) return;
    const p = game.player;
    if (p && p.alive) {
      const dx = p.cx - this.cx, dy = p.cy - this.cy, d = Math.hypot(dx, dy) || 1;
      const looking = Math.sign(dx) === -p.facing;
      this.alpha = G.lerp(this.alpha, looking ? 0.4 : 0.9, 0.1);
      const sp = looking ? 0.12 : 0.6;
      this.vx = G.lerp(this.vx, (dx / d) * sp, 0.05);
      this.vy = G.lerp(this.vy, (dy / d) * sp, 0.05);
      this.facing = dx < 0 ? -1 : 1;
    }
    this.x += this.vx; this.y += this.vy + Math.sin(this.t * 0.07) * 0.25;
    this.touchPlayer(game);
  }
  sprite() { return EA('e_ghost_float', this.t); }
};

// Прыгает из жидкости. flame — неуязвим, fish — уязвим
G.Jumper = class Jumper extends G.Enemy {
  constructor(x, y, kind) {
    super(x, y + 22, 12, 14, kind === 'flame' ? 999 : 1);
    this.kind = kind;
    this.stompable = kind === 'fish';
    this.home = this.y;
    this.cool = G.randi(30, 110);
    this.coins = kind === 'fish' ? 2 : 0;
  }
  hitTest(b) { return this.kind === 'fish' && this.y < this.home - 6 && G.overlap(this, b); }
  update(game) {
    this.t++; if (!this.wake(game)) return;
    if (this.y >= this.home) {
      this.y = this.home; this.vy = 0;
      if (--this.cool <= 0) { this.vy = -6.6; this.cool = G.randi(70, 130); G.Particles.fx('fx_splash', this.cx, this.home - 18); }
    } else this.vy += 0.24;
    this.y = Math.min(this.home, this.y + this.vy);
    if (this.kind === 'flame' && this.y < this.home - 2 && this.t % 2 === 0) G.Particles.add({ x: this.cx + G.rand(-3, 3), y: this.bottom, vy: 0.4, life: 14, color: '#ff8020', add: true });
    if (this.y < this.home - 6) this.touchPlayer(game);
  }
  draw(c) {
    if (this.y >= this.home - 4) return;
    if (this.kind === 'flame') G.Gfx.glow(this.cx, this.cy, 14, '#ff6010', 0.6);
    const n = this.kind === 'flame' ? EA('e_flame', this.t) : EA('e_fish_jump', this.t);
    G.Gfx.spr(n, Math.round(this.cx), Math.round(this.bottom), this.vy > 0 ? this.facing > 0 : this.facing < 0, this.flash > 0);
  }
};

G.Monk = class Monk extends G.Enemy {
  constructor(x, y) { super(x, y, 14, 22, 4); this.cool = 120; this.cast = 0; this.coins = 5; this.meter = 15; }
  update(game) {
    this.t++; if (!this.wake(game)) return;
    const p = game.player;
    if (this.cast > 0) {
      this.cast--;
      if (this.cast === 12) { this.aimAt(game, this.cx + this.facing * 6, this.y + 6, 2, 'orb', 0, { ghost: true, life: 200 }); G.Audio.play('teleport'); }
      this.vy = Math.min(this.vy + 0.35, 5.5); G.Physics.step(this, game.level);
    } else {
      this.walk(game, 0.4);
      if (p && p.alive && Math.abs(p.cx - this.cx) < 200 && --this.cool <= 0) { this.cool = 140; this.cast = 30; this.facing = p.cx < this.cx ? -1 : 1; }
    }
    this.touchPlayer(game);
  }
  sprite() { return this.cast > 0 ? 'e_monk_cast0' : EA('e_monk_walk', this.t); }
};

G.Drone = class Drone extends G.Enemy {
  constructor(x, y) { super(x, y - 20, 14, 12, 3); this.cool = 90; this.coins = 3; }
  update(game) {
    this.t++; if (!this.wake(game)) return;
    const p = game.player;
    if (p) {
      this.facing = p.cx < this.cx ? -1 : 1;
      this.x = G.lerp(this.x, p.cx - 7 - this.facing * 40, 0.012);
      this.y = G.lerp(this.y, p.y - 70 + Math.sin(this.t * 0.05) * 8, 0.02);
      if (--this.cool <= 0 && p.alive) { this.cool = 110; this.aimAt(game, this.cx, this.bottom, 2.4, 'orb', 0, { ghost: true }); G.Audio.play('enemyShot'); }
    }
    this.touchPlayer(game);
  }
  sprite() { return EA('e_drone_fly', this.t); }
};

G.Harpy = class Harpy extends G.Enemy {
  constructor(x, y) { super(x, y - 10, 18, 14, 3); this.home = { x: this.x, y: this.y }; this.phase = Math.random() * 6; this.coins = 4; this.cool = 80; }
  update(game) {
    this.t++; if (!this.wake(game)) return;
    const p = game.player;
    this.phase += 0.02;
    const tx = (p ? p.cx : this.home.x) + Math.cos(this.phase) * 90 - 9;
    const ty = (p ? p.y : this.home.y) - 60 + Math.sin(this.phase * 2) * 30;
    this.x = G.lerp(this.x, tx, 0.025);
    this.y = G.lerp(this.y, ty, 0.03);
    this.facing = p && p.cx < this.cx ? -1 : 1;
    if (p && --this.cool <= 0) { this.cool = 100; for (const s of [-0.2, 0, 0.2]) this.aimAt(game, this.cx, this.cy, 2.2, 'feather', s); G.Audio.play('enemyShot'); }
    this.touchPlayer(game);
  }
  sprite() { return EA('e_harpy_fly', this.t); }
};

G.Spiderling = class Spiderling extends G.Enemy {
  constructor(x, y) { super(x, y, 12, 8, 1); this.coins = 1; }
  update(game) { this.t++; if (!this.wake(game)) return; this.walk(game, 1.2); this.touchPlayer(game); }
  sprite() { return EA('e_spiderling_walk', this.t); }
};

// Кристалл на потолке: висит, стреляет осколками веером вниз
G.Crystal = class Crystal extends G.Enemy {
  constructor(x, y, level) {
    super(x, y, 10, 14, 4);
    // прикрепляемся к потолку над точкой
    let ty = Math.floor((y - 1) / 16);
    while (ty > 0 && !level.isSolid(Math.floor(x / 16), ty - 1)) ty--;
    this.y = ty * 16;
    this.cool = 80; this.stompable = false; this.coins = 4; this.facing = 1;
  }
  update(game) {
    this.t++; if (!this.wake(game)) return;
    const p = game.player;
    if (p && p.alive && Math.abs(p.cx - this.cx) < 130 && p.cy > this.y && --this.cool <= 0) {
      this.cool = 100;
      for (const a of [-0.5, 0, 0.5]) game.spawn(new G.EnemyShot(this.cx, this.bottom, Math.sin(a) * 2.2, Math.cos(a) * 2.2, 'ice'));
      G.Audio.play('enemyShot');
    }
    this.touchPlayer(game);
  }
  draw(c) {
    G.Gfx.glow(this.cx, this.y + 8, 14, '#5ef0ff', 0.4);
    G.Gfx.spr(EA('e_crystal', this.t), Math.round(this.cx), Math.round(this.y), false, this.flash > 0);
  }
};

G.makeEnemy = (s, level) => {
  switch (s.type) {
    case 'imp': return new G.Imp(s.x, s.y);
    case 'rat': return new G.Rat(s.x, s.y);
    case 'frog': return new G.Frog(s.x, s.y);
    case 'hedgehog': return new G.Hedgehog(s.x, s.y);
    case 'head': return new G.StoneHead(s.x, s.y);
    case 'slime': return new G.Slime(s.x, s.y);
    case 'yeti': return new G.Yeti(s.x, s.y);
    case 'penguin': return new G.Penguin(s.x, s.y);
    case 'knight': return new G.Knight(s.x, s.y);
    case 'bat': return new G.Bat(s.x, s.y);
    case 'crow': return new G.Crow(s.x, s.y);
    case 'ghost': return new G.Ghost(s.x, s.y);
    case 'flame': return new G.Jumper(s.x, s.y, 'flame');
    case 'fish': return new G.Jumper(s.x, s.y, 'fish');
    case 'monk': return new G.Monk(s.x, s.y);
    case 'drone': return new G.Drone(s.x, s.y);
    case 'harpy': return new G.Harpy(s.x, s.y);
    case 'spiderling': return new G.Spiderling(s.x, s.y);
    case 'crystal': return new G.Crystal(s.x, s.y, level);
  }
  return null;
};
