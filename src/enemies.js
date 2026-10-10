'use strict';
// Враги. Каждый — отдельный класс с поведением и векторной анимацией.
const EO = '#160e1c'; // контур

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
  }
  hitTest(b) { return G.overlap(this, b); }
  hurt(d, game, src) {
    if (this.dead) return;
    this.hp -= d;
    this.flash = 7;
    if (src && src.vx) this.vx += Math.sign(src.vx) * 0.8;
    G.Audio.play('hit');
    if (this.hp <= 0) this.die(game);
    else game.hitstop(1);
  }
  die(game) {
    this.dead = true;
    G.Audio.play('kill');
    G.Particles.explosion(this.cx, this.cy, 0.7);
    game.shake(2, 6);
    game.hitstop(3);
    game.dropCoins(this.cx, this.cy, this.coins);
    game.onEnemyKilled(this);
  }
  // общий шаг: активируемся рядом с камерой
  wake(game) {
    if (!this.active) {
      if (this.x < game.cam.x + G.W + 40 && this.x + this.w > game.cam.x - 40) this.active = true;
      else return false;
    }
    if (this.flash > 0) this.flash--;
    return true;
  }
  touchPlayer(game) {
    const p = game.player;
    if (!p || !p.alive || this.dead) return;
    if (!G.overlap(this, p)) return;
    // прыжок сверху
    if (this.stompable && p.vy > 0.5 && p.bottom - p.vy <= this.y + 6) {
      p.vy = G.Input.down('jump') ? -8 : -5.5;
      p.jumpHeld = G.Input.down('jump');
      G.Audio.play('stomp');
      G.Particles.ring(p.cx, p.bottom, '#ffffff', 10, 10);
      this.hurt(2, game, null);
      return;
    }
    if (game.eyeMode > 0) { this.hurt(3, game, { vx: p.facing }); return; }
    p.hurt(this.dmg, game, this.cx);
  }
  // мигание белым при попадании
  flashDraw(c, fn) {
    fn();
    if (this.flash > 0) {
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = this.flash / 7;
      fn();
      c.restore();
    }
  }
};

// --- Бесёнок: ходит туда-сюда ---------------------------------------------------
G.Imp = class Imp extends G.Enemy {
  constructor(x, y) { super(x, y, 14, 15, 2); this.speed = 0.7; this.coins = 2; }
  update(game) {
    this.t++;
    if (!this.wake(game)) return;
    const L = game.level;
    this.vx = G.approach(this.vx, this.facing * this.speed, 0.1);
    this.vy = Math.min(this.vy + 0.4, 6);
    G.Physics.step(this, L);
    if (this.hitL || this.hitR || (this.onGround && !G.Physics.groundAhead(this, L, this.facing))) this.facing *= -1;
    if (this.y > L.h * 16) this.dead = true;
    this.touchPlayer(game);
  }
  draw(c) {
    this.flashDraw(c, () => {
      const x = this.cx, b = this.bottom, t = this.t;
      const step = Math.sin(t * 0.25);
      c.save();
      c.translate(x, b);
      c.scale(this.facing, 1);
      // ножки
      G.Gfx.limb(c, -3, -4, -3 + step * 2, 0, 2.6, '#7a1a3a', EO);
      G.Gfx.limb(c, 3, -4, 3 - step * 2, 0, 2.6, '#7a1a3a', EO);
      // хвост
      c.strokeStyle = EO; c.lineWidth = 2.2;
      c.beginPath(); c.moveTo(-5, -6); c.quadraticCurveTo(-11, -8 + step, -9, -13); c.stroke();
      c.strokeStyle = '#c0305a'; c.lineWidth = 1.2; c.stroke();
      c.fillStyle = '#c0305a'; c.beginPath(); c.moveTo(-9, -15); c.lineTo(-11, -12); c.lineTo(-7.5, -12.5); c.fill();
      // тело
      const by = Math.abs(step) * -1;
      G.Gfx.ellipse(c, 0, -9 + by, 7, 6.5, 0, '#d83a6a', EO, 1);
      G.Gfx.ellipse(c, 1, -7.5 + by, 4.5, 3.5, 0, '#f07a9a');
      // рожки
      c.fillStyle = '#ffe0a0'; c.strokeStyle = EO; c.lineWidth = 0.8;
      for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 2.5 + 1, -14.5 + by); c.lineTo(s * 4.5 + 1, -19 + by); c.lineTo(s * 5 + 1, -13.5 + by); c.fill(); c.stroke(); }
      // глаз
      G.Gfx.ellipse(c, 3, -10 + by, 2.6, 2.8, 0, '#fff', EO, 0.7);
      G.Gfx.circle(c, 3.8, -10 + by, 1.3, '#200810');
      // клыки
      c.fillStyle = '#fff';
      c.beginPath(); c.moveTo(2, -6 + by); c.lineTo(3, -4.2 + by); c.lineTo(4, -6 + by); c.fill();
      c.restore();
    });
  }
};

// --- Летучая мышь: висит, потом пикирует к игроку ------------------------------
G.Bat = class Bat extends G.Enemy {
  constructor(x, y) { super(x, y - 2, 14, 10, 1); this.state = 'hang'; this.home = { x: this.x, y: this.y }; this.coins = 1; this.stompable = true; }
  update(game) {
    this.t++;
    if (!this.wake(game)) return;
    const p = game.player;
    if (this.state === 'hang') {
      if (p && p.alive && Math.abs(p.cx - this.cx) < 110 && p.cy > this.cy - 20) { this.state = 'swoop'; this.t = 0; G.Audio.play('enemyShot'); }
    } else {
      const tx = p ? p.cx : this.cx, ty = p ? p.cy - 6 : this.cy;
      const dx = tx - this.cx, dy = ty - this.cy;
      const d = Math.hypot(dx, dy) || 1;
      this.vx = G.lerp(this.vx, (dx / d) * 1.7, 0.04);
      this.vy = G.lerp(this.vy, (dy / d) * 1.7 + Math.sin(this.t * 0.15) * 1.2, 0.06);
      this.x += this.vx;
      this.y += this.vy;
      this.facing = this.vx > 0 ? 1 : -1;
    }
    this.touchPlayer(game);
  }
  draw(c) {
    this.flashDraw(c, () => {
      const x = this.cx, y = this.cy;
      c.save();
      c.translate(x, y);
      if (this.state === 'hang') {
        // висит вниз головой, завернувшись в крылья
        const sw = Math.sin(this.t * 0.05) * 0.1;
        c.rotate(sw);
        G.Gfx.ellipse(c, 0, 0, 5, 6.5, 0, '#4a2a6a', EO, 1);
        c.strokeStyle = EO; c.lineWidth = 0.8;
        c.beginPath(); c.moveTo(-2, -6); c.lineTo(-2, -9); c.moveTo(2, -6); c.lineTo(2, -9); c.stroke();
        G.Gfx.circle(c, -1.8, 2.5, 1, '#ffd040');
        G.Gfx.circle(c, 1.8, 2.5, 1, '#ffd040');
      } else {
        c.scale(this.facing, 1);
        const f = Math.sin(this.t * 0.6);
        c.fillStyle = '#5a2a7a'; c.strokeStyle = EO; c.lineWidth = 0.9;
        for (const s of [-1, 1]) {
          c.beginPath();
          c.moveTo(s * 3, -1);
          c.quadraticCurveTo(s * 9, -8 * f - 2, s * 13, -3 * f);
          c.lineTo(s * 10, 1); c.lineTo(s * 8, -0.5); c.lineTo(s * 6, 2);
          c.closePath(); c.fill(); c.stroke();
        }
        G.Gfx.ellipse(c, 0, 0, 5, 4.5, 0, '#6a3a8a', EO, 1);
        c.fillStyle = '#6a3a8a';
        c.beginPath(); c.moveTo(-3, -3); c.lineTo(-2.5, -7); c.lineTo(-0.8, -3.8); c.moveTo(3, -3); c.lineTo(2.5, -7); c.lineTo(0.8, -3.8); c.fill();
        G.Gfx.circle(c, 1.8, -0.5, 1.4, '#ffe040');
        G.Gfx.circle(c, 2.2, -0.5, 0.6, '#300');
        c.fillStyle = '#fff'; c.fillRect(0.4, 1.8, 0.8, 1.4); c.fillRect(2.2, 1.8, 0.8, 1.4);
      }
      c.restore();
    });
  }
};

// --- Лягушка: прыгает в сторону игрока -----------------------------------------
G.Frog = class Frog extends G.Enemy {
  constructor(x, y) { super(x, y, 16, 12, 3); this.cool = G.randi(40, 90); this.coins = 3; }
  update(game) {
    this.t++;
    if (!this.wake(game)) return;
    const L = game.level, p = game.player;
    this.vy = Math.min(this.vy + 0.35, 6);
    if (this.onGround) {
      this.vx *= 0.7;
      if (p) this.facing = p.cx < this.cx ? -1 : 1;
      if (--this.cool <= 0) {
        this.vy = -6.2;
        this.vx = this.facing * 2.1;
        this.cool = G.randi(60, 100);
        G.Particles.dust(this.cx, this.bottom, 3, '#9ad070');
      }
    }
    G.Physics.step(this, L);
    if (this.hitL || this.hitR) this.vx *= -1;
    if (this.y > L.h * 16) this.dead = true;
    this.touchPlayer(game);
  }
  draw(c) {
    this.flashDraw(c, () => {
      const x = this.cx, b = this.bottom;
      const air = !this.onGround;
      const crouch = this.onGround && this.cool < 12 ? 1 - this.cool / 12 : 0;
      c.save();
      c.translate(x, b);
      c.scale(this.facing, 1 - crouch * 0.2);
      // задние лапы
      if (air) { G.Gfx.limb3(c, -4, -5, -8, -1, -11, 2, 2.6, '#3a9a3a', EO); }
      else { G.Gfx.limb3(c, -4, -4, -8, -6, -7, 0, 2.8, '#3a9a3a', EO); }
      G.Gfx.ellipse(c, 0, -6, 8, 6, 0, '#4ab84a', EO, 1);
      G.Gfx.ellipse(c, 1, -3.5, 5.5, 3, 0, '#c8f0a0');
      // пятна
      G.Gfx.circle(c, -3, -9, 1.3, '#2a7a2a'); G.Gfx.circle(c, 0, -10.5, 1, '#2a7a2a');
      // передняя лапа
      G.Gfx.limb(c, 4, -3, air ? 7 : 5, 0, 2.2, '#3a9a3a', EO);
      // глаза-шарики
      G.Gfx.circle(c, 2.5, -11.5, 2.8, '#4ab84a', EO, 0.9);
      G.Gfx.circle(c, 6, -10.5, 2.6, '#4ab84a', EO, 0.9);
      G.Gfx.circle(c, 3, -11.8, 1.8, '#fff'); G.Gfx.circle(c, 3.5, -11.8, 0.9, '#100');
      G.Gfx.circle(c, 6.4, -10.8, 1.6, '#fff'); G.Gfx.circle(c, 6.9, -10.8, 0.8, '#100');
      c.strokeStyle = EO; c.lineWidth = 0.8;
      c.beginPath(); c.moveTo(3, -6); c.quadraticCurveTo(6, -4, 8, -6.5); c.stroke();
      c.restore();
    });
  }
};

// --- Каменная голова: стреляет огнём ----------------------------------------------
G.StoneHead = class StoneHead extends G.Enemy {
  constructor(x, y) { super(x, y, 18, 18, 5); this.cool = 90; this.stompable = false; this.coins = 4; this.open = 0; this.meter = 15; }
  update(game) {
    this.t++;
    if (!this.wake(game)) return;
    const p = game.player;
    if (p) this.facing = p.cx < this.cx ? -1 : 1;
    this.open = G.approach(this.open, this.cool < 20 ? 1 : 0, 0.1);
    if (p && p.alive && Math.abs(p.cx - this.cx) < 300 && --this.cool <= 0) {
      this.cool = 110;
      const dx = p.cx - this.cx, dy = p.cy - this.cy;
      const d = Math.hypot(dx, dy) || 1;
      game.spawn(new G.EnemyShot(this.cx + this.facing * 6, this.cy + 2, (dx / d) * 2.6, (dy / d) * 2.6, 'fire'));
      G.Audio.play('enemyShot');
    }
    this.touchPlayer(game);
  }
  draw(c, game) {
    this.flashDraw(c, () => {
      const x = this.cx, b = this.bottom;
      const P = G.Tiles.pal(game.level.theme);
      c.save();
      c.translate(x, b);
      c.scale(this.facing, 1);
      c.fillStyle = G.shade(P.light, -0.1);
      G.Gfx.rr(c, -9, -18, 18, 18, 3); c.fill();
      c.strokeStyle = EO; c.lineWidth = 1; c.stroke();
      c.fillStyle = P.dark; c.fillRect(-9, -3, 18, 3);
      c.fillStyle = G.shade(P.light, 0.25); c.fillRect(-7, -17, 12, 1.5);
      // брови и глаза
      c.fillStyle = P.dark; c.fillRect(-6, -14, 5, 2); c.fillRect(2, -14, 5, 2);
      const glow = 0.5 + this.open * 0.5;
      G.Gfx.glow(c, 3.5, -10.5, 6, '#ff6020', glow * 0.6);
      G.Gfx.circle(c, -3.5, -10.5, 1.6, G.mix('#5a1a0a', '#ffb040', glow));
      G.Gfx.circle(c, 4.5, -10.5, 1.6, G.mix('#5a1a0a', '#ffb040', glow));
      // рот
      c.fillStyle = '#1a0a08';
      c.fillRect(-1, -7, 8, 1.5 + this.open * 3);
      if (this.open > 0.5) G.Gfx.glow(c, 3, -5, 6, '#ff8030', 0.8);
      c.restore();
    });
  }
};

// --- Ёж: колючий, прыгать сверху нельзя -----------------------------------------
G.Hedgehog = class Hedgehog extends G.Enemy {
  constructor(x, y) { super(x, y, 16, 12, 3); this.stompable = false; this.speed = 0.55; this.roll = 0; this.coins = 3; }
  update(game) {
    this.t++;
    if (!this.wake(game)) return;
    const L = game.level, p = game.player;
    // иногда сворачивается в шар и катится
    if (this.roll > 0) {
      this.roll--;
      this.vx = G.approach(this.vx, this.facing * 2.6, 0.15);
    } else {
      this.vx = G.approach(this.vx, this.facing * this.speed, 0.1);
      if (p && Math.abs(p.cx - this.cx) < 120 && Math.abs(p.cy - this.cy) < 30 && this.t % 160 === 0) {
        this.facing = p.cx < this.cx ? -1 : 1;
        this.roll = 70;
      }
    }
    this.vy = Math.min(this.vy + 0.4, 6);
    G.Physics.step(this, L);
    if (this.hitL || this.hitR || (this.onGround && !G.Physics.groundAhead(this, L, this.facing))) { this.facing *= -1; this.vx = 0; }
    if (this.y > L.h * 16) this.dead = true;
    this.touchPlayer(game);
  }
  draw(c) {
    this.flashDraw(c, () => {
      const x = this.cx, b = this.bottom;
      c.save();
      c.translate(x, b - 6);
      c.scale(this.facing, 1);
      if (this.roll > 0) c.rotate(this.t * 0.5 * this.facing);
      // иглы
      c.fillStyle = '#5a3a2a'; c.strokeStyle = EO; c.lineWidth = 0.8;
      c.beginPath();
      const n = 11;
      for (let i = 0; i <= n; i++) {
        const a = this.roll > 0 ? (i / n) * Math.PI * 2 : Math.PI + (i / n) * Math.PI;
        const r1 = 6.5, r2 = 10.5;
        c.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
        c.lineTo(Math.cos(a + 0.14) * r2, Math.sin(a + 0.14) * r2);
      }
      c.closePath(); c.fill(); c.stroke();
      G.Gfx.ellipse(c, 0, 0, 7.5, 6, 0, '#8a5a3a', EO, 0.9);
      if (this.roll <= 0) {
        G.Gfx.ellipse(c, 5, 2, 4, 3.5, 0, '#e8c098', EO, 0.8);
        G.Gfx.circle(c, 8.6, 1.4, 1, '#200');
        G.Gfx.circle(c, 5, 0, 1, '#100');
        const st = Math.sin(this.t * 0.3) * 1.5;
        G.Gfx.limb(c, -3, 4, -3 + st, 6, 2, '#5a3a2a', EO);
        G.Gfx.limb(c, 3, 4, 3 - st, 6, 2, '#5a3a2a', EO);
      }
      c.restore();
    });
  }
};

// --- Призрак: летит сквозь стены ---------------------------------------------------
G.Ghost = class Ghost extends G.Enemy {
  constructor(x, y) { super(x, y, 16, 18, 2); this.coins = 3; this.alpha = 0.85; this.baseY = this.y; }
  update(game) {
    this.t++;
    if (!this.wake(game)) return;
    const p = game.player;
    if (p && p.alive) {
      const dx = p.cx - this.cx, dy = p.cy - this.cy;
      // приближается, только когда игрок смотрит в другую сторону
      const looking = Math.sign(dx) === -p.facing;
      this.alpha = G.lerp(this.alpha, looking ? 0.35 : 0.9, 0.1);
      const sp = looking ? 0.15 : 0.75;
      const d = Math.hypot(dx, dy) || 1;
      this.vx = G.lerp(this.vx, (dx / d) * sp, 0.05);
      this.vy = G.lerp(this.vy, (dy / d) * sp, 0.05);
      this.facing = dx < 0 ? -1 : 1;
    }
    this.x += this.vx;
    this.y += this.vy + Math.sin(this.t * 0.07) * 0.3;
    this.touchPlayer(game);
  }
  draw(c) {
    c.save();
    c.globalAlpha = this.alpha;
    this.flashDraw(c, () => {
      const x = this.cx, y = this.cy;
      c.save();
      c.translate(x, y);
      c.scale(this.facing, 1);
      G.Gfx.glow(c, 0, 0, 18, '#a0b0ff', 0.25);
      c.fillStyle = '#e8ecff'; c.strokeStyle = '#3a3a6a'; c.lineWidth = 1;
      c.beginPath();
      c.moveTo(-8, 9);
      c.lineTo(-8, -2);
      c.arc(0, -2, 8, Math.PI, 0);
      c.lineTo(8, 9);
      for (let i = 0; i < 4; i++) {
        const xx = 8 - (i + 1) * 4;
        c.lineTo(xx + 2, 6 + Math.sin(this.t * 0.2 + i) * 1.5);
        c.lineTo(xx, 9);
      }
      c.closePath(); c.fill(); c.stroke();
      G.Gfx.ellipse(c, 1, -3, 2, 3, 0, '#2a2a5a');
      G.Gfx.ellipse(c, 5.5, -3, 1.8, 2.8, 0, '#2a2a5a');
      G.Gfx.ellipse(c, 3.5, 3, 1.6, 2, 0, '#2a2a5a');
      c.fillStyle = 'rgba(255,140,180,0.5)'; c.beginPath(); c.ellipse(-1, 1, 1.6, 1, 0, 0, 7); c.fill();
      c.restore();
    });
    c.restore();
  }
};

// --- Огненный дух: выпрыгивает из лавы, неуязвим --------------------------------
G.Flame = class Flame extends G.Enemy {
  constructor(x, y) {
    super(x, y + 20, 12, 14, 999);
    this.stompable = false;
    this.home = this.y;
    this.cool = G.randi(30, 120);
    this.invulnerable = true;
    this.coins = 0;
  }
  hitTest() { return false; }
  update(game) {
    this.t++;
    if (!this.wake(game)) return;
    if (this.y >= this.home) {
      this.y = this.home;
      this.vy = 0;
      if (--this.cool <= 0) { this.vy = -6.8; this.cool = G.randi(70, 130); G.Particles.sparks(this.cx, this.y, 8, '#ffb040', 2); }
    } else this.vy += 0.25;
    this.y = Math.min(this.home, this.y + this.vy);
    if (this.y < this.home - 2 && this.t % 2 === 0) G.Particles.add({ x: this.cx + G.rand(-3, 3), y: this.bottom, vy: 0.5, life: 16, size: 4, size2: 0, color: '#ff8020', add: true });
    if (this.y < this.home - 4) this.touchPlayer(game);
  }
  draw(c) {
    if (this.y >= this.home - 1) return;
    const x = this.cx, y = this.cy;
    const up = this.vy < 0;
    c.save();
    c.translate(x, y);
    if (!up) c.scale(1, -1);
    G.Gfx.glow(c, 0, 0, 20, '#ff6010', 0.6);
    const f = Math.sin(this.t * 0.5);
    c.fillStyle = '#ff5010';
    c.beginPath(); c.moveTo(-6, -2); c.quadraticCurveTo(-5 + f, 8, 0, 11); c.quadraticCurveTo(5 - f, 8, 6, -2); c.arc(0, -2, 6, 0, Math.PI, true); c.fill();
    c.fillStyle = '#ffd050';
    c.beginPath(); c.moveTo(-3.5, -1); c.quadraticCurveTo(-3, 5, 0, 7); c.quadraticCurveTo(3, 5, 3.5, -1); c.arc(0, -1, 3.5, 0, Math.PI, true); c.fill();
    c.restore();
    c.save();
    c.translate(x, y);
    G.Gfx.circle(c, -2, -1, 1.2, '#300');
    G.Gfx.circle(c, 2, -1, 1.2, '#300');
    c.restore();
  }
};

G.makeEnemy = (s) => {
  switch (s.type) {
    case 'imp': return new G.Imp(s.x, s.y);
    case 'bat': return new G.Bat(s.x, s.y);
    case 'frog': return new G.Frog(s.x, s.y);
    case 'head': return new G.StoneHead(s.x, s.y);
    case 'hedgehog': return new G.Hedgehog(s.x, s.y);
    case 'ghost': return new G.Ghost(s.x, s.y);
    case 'flame': return new G.Flame(s.x, s.y);
  }
  return null;
};
