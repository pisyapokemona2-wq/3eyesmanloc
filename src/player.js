'use strict';
// Герой Мицу: движение, способности, копьё «Красный Кондор» и выстрелы третьим глазом.
// Способности открываются по ходу игры (см. G.ABILITIES).
G.ABILITIES = [
  { id: 'spear', name: 'КРАСНЫЙ КОНДОР', key: 'C', desc: ['Брось копьё — оно поражает врагов,', 'а воткнувшись в стену, становится ступенькой.', 'C ещё раз — вернуть копьё.'] },
  { id: 'shot', name: 'ВЗГЛЯД ТРЕТЬЕГО ГЛАЗА', key: 'X', desc: ['Третий глаз стреляет сгустками энергии.', 'A — стрельба по диагонали вверх.'] },
  { id: 'djump', name: 'ДВОЙНОЙ ПРЫЖОК', key: 'Z', desc: ['Прыгни ещё раз прямо в воздухе.'] },
  { id: 'dash', name: 'РЫВОК', key: 'SHIFT', desc: ['Стремительный рывок, неуязвимый для атак.', 'Пробивает треснувшие стены.'] },
  { id: 'charge', name: 'ЗАРЯД ВЗГЛЯДА', key: 'X', desc: ['Удерживай X, чтобы зарядить', 'пробивающий выстрел огромной силы.'] },
  { id: 'wall', name: 'ПРЫЖОК ОТ СТЕН', key: 'Z', desc: ['Скользи по стенам и отталкивайся от них.'] },
  { id: 'pound', name: 'УДАР С НЕБЕС', key: '↓+Z', desc: ['В прыжке ↓ + Z — удар сверху.', 'Крушит окованные блоки и оглушает врагов.'] },
  { id: 'eye', name: 'ПРОБУЖДЕНИЕ ГЛАЗА', key: 'V', desc: ['Когда шкала полна — нажми V:', 'неуязвимость и шквальный огонь.'] },
];

// --- Выстрел глазом ------------------------------------------------------------
G.EyeShot = class EyeShot extends G.Entity {
  constructor(x, y, dir, opts = {}) {
    const r = opts.charged ? 7 : 3;
    super(x - r, y - r, r * 2, r * 2);
    this.dir = dir;
    this.charged = !!opts.charged;
    this.beam = !!opts.beam;
    const sp = this.charged ? 5.2 : this.beam ? 7.5 : 5.8;
    const a = opts.angle || 0;
    this.vx = Math.cos(a) * sp * dir;
    this.vy = Math.sin(a) * sp;
    this.dmg = opts.dmg || 1;
    this.life = this.charged ? 70 : 40;
    this.hitSet = new Set();
    this.layer = 2;
  }
  update(game) {
    this.t++;
    this.x += this.vx; this.y += this.vy;
    if (--this.life <= 0) { this.dead = true; return; }
    const L = game.level, tx = Math.floor(this.cx / 16), ty = Math.floor(this.cy / 16);
    if (L.isSolid(tx, ty)) {
      const t = L.get(tx, ty);
      if (t === G.T.BRICK || t === G.T.BONUS) { L.hitBlock(tx, ty, game, 'shot'); if (!this.charged || t === G.T.BONUS) this.dead = true; }
      else { this.dead = true; }
      if (this.dead) G.Particles.fx('fx_hit', this.cx - this.vx, this.cy);
      if (this.dead) return;
    }
    for (const e of game.targets()) {
      if (this.hitSet.has(e) || !e.hitTest(this)) continue;
      e.hurt(this.dmg, game, this);
      G.Particles.fx('fx_hit', this.cx, this.cy);
      if (this.charged) this.hitSet.add(e);
      else { this.dead = true; break; }
    }
    if (this.t % 2 === 0) G.Particles.add({ x: this.cx - this.vx, y: this.cy, life: 8, color: '#3aff8a', add: true });
  }
  draw() {
    G.Gfx.glow(this.cx, this.cy, this.charged ? 18 : 8, '#3aff8a', 0.7);
    const n = this.charged ? G.Art.frame('i_bigshot', this.t) : this.beam ? 'i_beam' : G.Art.frame('i_shot', this.t);
    G.Gfx.spr(n, this.cx, this.cy, this.vx < 0);
  }
};

// --- Копьё «Красный Кондор» ---------------------------------------------------
G.Spear = class Spear extends G.Entity {
  constructor(owner, x, y, dir, power) {
    super(x - 12, y - 3, 24, 6);
    this.owner = owner;
    this.dir = dir;
    this.vx = dir * 6.4;
    this.state = 'fly';
    this.dmg = 2 + power;
    this.range = 34 + power * 6;
    this.dx = 0; this.dy = 0;
    this.isPlatform = false;
    this.hitSet = new Set();
    this.wob = 0;
  }
  recall() {
    if (this.state === 'return') return;
    this.state = 'return';
    this.isPlatform = false;
    this.t = 0;
    G.Audio.play('recall');
  }
  update(game) {
    this.t++;
    const p = this.owner;
    if (this.wob > 0) this.wob--;
    if (this.state === 'fly') {
      const L = game.level;
      const tipX = this.dir > 0 ? this.x + this.w + this.vx : this.x + this.vx;
      const tx = Math.floor(tipX / 16), ty = Math.floor(this.cy / 16);
      if (L.isSolid(tx, ty)) {
        const tile = L.get(tx, ty);
        if (tile === G.T.BRICK || tile === G.T.BONUS) { L.hitBlock(tx, ty, game, 'spear'); this.recall(); return; }
        if (tile === G.T.SPIKE || tile === G.T.SPIKE_DOWN || tile === G.T.GATE) { G.Particles.fx('fx_hit', tipX, this.cy); this.recall(); return; }
        const wallX = this.dir > 0 ? tx * 16 : (tx + 1) * 16;
        this.x = this.dir > 0 ? wallX - this.w + 5 : wallX - 5;
        this.state = 'stuck';
        this.isPlatform = true;
        this.wob = 12;
        this.platY = Math.round(this.y + 1);
        G.Audio.play('stick');
        G.Particles.debris(wallX, this.cy, 4, game.level.cfg.debris, 1);
        G.Particles.fx('fx_hit', wallX, this.cy);
        game.shake(1, 4);
        return;
      }
      this.x += this.vx;
      for (const e of game.targets()) {
        if (this.hitSet.has(e) || !e.hitTest(this)) continue;
        this.hitSet.add(e);
        e.hurt(this.dmg, game, this);
        G.Particles.fx('fx_hit', this.cx + this.dir * 10, this.cy);
        this.recall();
        return;
      }
      if (this.t > this.range) this.recall();
      if (this.t % 2 === 0) G.Particles.add({ x: this.cx - this.dir * 12, y: this.cy, life: 8, color: '#ff8a6a', add: true });
    } else if (this.state === 'stuck') {
      if (!p.alive || G.dist(this.cx, this.cy, p.cx, p.cy) > 420) this.recall();
    } else {
      const dx = p.cx - this.cx, dy = p.y + 12 - this.cy, d = Math.hypot(dx, dy) || 1;
      const sp = Math.min(9, 3.5 + this.t * 0.25);
      this.x += (dx / d) * sp; this.y += (dy / d) * sp;
      this.dirDraw = dx < 0;
      if (d < 12 || !p.alive) { this.dead = true; p.hasSpear = true; p.spear = null; }
    }
  }
  get platRect() {
    return this.dir > 0 ? { x: this.x - 1, y: this.platY, w: this.w - 4, h: 4 } : { x: this.x + 5, y: this.platY, w: this.w - 4, h: 4 };
  }
  draw(c) {
    const flip = this.state === 'return' ? this.dirDraw : this.dir < 0;
    const wob = this.wob > 0 && this.wob % 4 < 2 ? 1 : 0;
    if (this.state === 'fly') G.Gfx.glow(this.cx, this.cy, 10, '#ff6040', 0.35);
    G.Gfx.spr('i_spear', this.cx, this.cy + wob, flip);
  }
};

// --- Игрок -------------------------------------------------------------------
G.Player = class Player extends G.Entity {
  constructor(x, y, game) {
    super(x - 6, y - 28, 12, 28);
    this.game = game;
    this.isPlayer = true;
    this.hp = game.stats.maxHp;
    this.facing = 1;
    this.alive = true;
    this.coyote = 0; this.jumpBuf = 0;
    this.invuln = 0; this.stun = 0;
    this.shotCd = 0; this.charge = 0; this.shootAnim = 0;
    this.throwT = 0;
    this.hasSpear = true; this.spear = null;
    this.platform = null;
    this.animT = 0; this.anim = 'idle';
    this.crouching = false;
    this.slow = 0;
    this.deathT = 0;
    this.airJumps = 0; this.flipT = 0;
    this.dashT = 0; this.canDash = true; this.dashCd = 0;
    this.downHold = 0;
    this.wallDir = 0; this.wallLock = 0;
    this.pounding = false;
    this.inWater = false;
    this.winT = 0;
    this.controlLocked = false;
    this.landT = 0;
  }
  has(a) { return this.game.abil.has(a); }
  hurtbox() { return { x: this.x + 2, y: this.y + 4, w: this.w - 4, h: this.h - 5 }; }

  setCrouch(on, L) {
    if (on === this.crouching) return;
    if (on) { this.y += 10; this.h = 18; this.crouching = true; }
    else {
      for (let x = this.x + 1; x <= this.x + this.w - 1; x += 5) if (L.solidAt(x, this.y - 9)) return;
      if (L.solidAt(this.x + this.w - 1, this.y - 9)) return;
      this.y -= 10; this.h = 28; this.crouching = false;
    }
  }

  hurt(dmg, game, fromX) {
    if (!this.alive || this.invuln > 0 || this.dashT > 0 || game.eyeMode > 0 || game.state !== 'play') return false;
    if (game.stats.shield > 0) {
      game.stats.shield--;
      this.invuln = 80;
      G.Audio.play('bump');
      G.Particles.fx('fx_ring', this.cx, this.cy);
      return true;
    }
    this.hp -= dmg;
    const dir = fromX === undefined ? -this.facing : this.cx < fromX ? -1 : 1;
    this.vx = dir * 2.2;
    this.vy = -3.6;
    this.stun = 18;
    this.invuln = 100 + (game.stats.armor || 0) * 30;
    this.charge = 0;
    this.pounding = false;
    G.Audio.play('hurt');
    game.shake(3, 10);
    game.hitstop(5);
    G.Particles.fx('fx_hit', this.cx, this.cy);
    if (this.hp <= 0) this.die(game);
    return true;
  }

  die(game, pit = false) {
    if (!this.alive) return;
    this.alive = false;
    this.hp = 0;
    this.deathT = 0;
    this.fellInPit = pit;
    this.vx = 0;
    this.vy = pit ? 0 : -6;
    if (this.crouching) { this.crouching = false; this.y -= 10; this.h = 28; }
    if (this.spear) this.spear.recall();
    G.Audio.stopMusic();
    G.Audio.play('die');
    game.shake(4, 12);
  }

  update(game) {
    this.t++; this.animT++;
    const L = game.level, I = G.Input;
    if (!this.alive) {
      this.deathT++;
      if (!this.fellInPit && this.deathT > 24) { this.vy += 0.28; this.y += this.vy; }
      if (this.deathT === 110) game.onPlayerDeath();
      return;
    }
    for (const k of ['invuln', 'stun', 'slow', 'shotCd', 'throwT', 'shootAnim', 'wallLock', 'dashCd', 'flipT', 'landT']) if (this[k] > 0) this[k]--;

    const locked = this.controlLocked || game.state !== 'play' || this.winT > 0;
    const can = this.stun <= 0 && !locked;
    const left = can && I.down('left'), right = can && I.down('right'), down = can && I.down('down');

    // перенос платформой
    if (this.platform && !this.platform.dead && this.platform.isPlatform) {
      G.Physics.moveX(this, L, this.platform.dx || 0);
      if (this.platform.dy) G.Physics.moveY(this, L, this.platform.dy);
    }

    // конвейер
    if (this.onGround && (this.groundTile === G.T.CONV_L || this.groundTile === G.T.CONV_R)) G.Physics.moveX(this, L, this.groundTile === G.T.CONV_R ? 0.9 : -0.9);
    // вода
    const midT = L.tileAt(this.cx, this.y + 10);
    const wasWater = this.inWater;
    this.inWater = midT === G.T.LIQUID && L.cfg.liquid === 'swim';
    if (this.inWater && !wasWater) { G.Particles.fx('fx_splash', this.cx, this.y + 10); G.Audio.play('land'); this.vy *= 0.3; }

    // --- РЫВОК
    if (this.has('dash') && can && I.pressed('dash') && this.canDash && this.dashCd <= 0 && !this.crouching) {
      this.dashT = 13 + (game.stats.dash || 0) * 3;
      this.canDash = false;
      this.dashCd = 24 - (game.stats.dash || 0) * 6;
      this.pounding = false;
      if (left) this.facing = -1; else if (right) this.facing = 1;
      G.Audio.play('dash');
      G.Particles.dust(this.cx, this.bottom);
    }
    if (this.dashT > 0) {
      this.vx = this.facing * 4.6;
      this.vy = 0;
      if (this.t % 2 === 0) game.spawnAfterimage(this);
      // пробиваем треснувшие стены
      const fx = this.facing > 0 ? this.x + this.w + 7 : this.x - 7;
      for (const yy of [this.y + 4, this.y + this.h - 4]) {
        const tx = Math.floor(fx / 16), ty = Math.floor(yy / 16);
        if (L.get(tx, ty) === G.T.CRACKED) L.hitBlock(tx, ty, game, 'dash');
      }
      if (this.dashT === 1) this.vx = this.facing * 2;
    }

    // приседание
    const onOneway = this.onGround && L.get(Math.floor(this.cx / 16), Math.floor((this.bottom + 1) / 16)) === G.T.ONEWAY;
    this.setCrouch(can && down && this.onGround && !left && !right && !onOneway && this.dashT <= 0, L);
    if (this.crouching && (!down || !this.onGround)) this.setCrouch(false, L);

    // горизонталь
    if (this.dashT <= 0) {
      const ice = this.onGround && this.groundTile === G.T.ICE;
      const maxV = (this.slow ? 1.2 : this.inWater ? 1.5 : 2.1) * (game.eyeMode ? 1.15 : 1) * (1 + (game.stats.speed || 0) * 0.06);
      let target = 0;
      if (can && !this.crouching && !this.pounding) {
        if (left && !(this.wallLock > 0 && this.wallKick < 0)) { target = -maxV; this.facing = -1; }
        if (right && !(this.wallLock > 0 && this.wallKick > 0)) { target = maxV; this.facing = 1; }
      } else if (this.crouching) { if (left) this.facing = -1; if (right) this.facing = 1; }
      if (this.stun <= 0) {
        let acc = this.onGround ? (target === 0 ? 0.42 : 0.32) : 0.24;
        if (ice) acc *= 0.18;
        if (this.wallLock > 0) acc *= 0.3;
        this.vx = G.approach(this.vx, target, acc);
      } else this.vx *= 0.94;
    }

    // стена рядом (для скольжения и отскока)
    this.wallDir = 0;
    if (this.has('wall') && !this.onGround && !this.inWater && this.dashT <= 0) {
      const probe = (dx) => L.solidAt(dx > 0 ? this.x + this.w + 1 : this.x - 1, this.y + 6) && L.solidAt(dx > 0 ? this.x + this.w + 1 : this.x - 1, this.y + this.h - 4);
      if (right && probe(1)) this.wallDir = 1;
      else if (left && probe(-1)) this.wallDir = -1;
    }

    // --- ПРЫЖКИ
    if (this.onGround || this.inWater) { this.coyote = 6; this.airJumps = 0; this.canDash = true; }
    else if (this.coyote > 0) this.coyote--;
    const jumpPress = can && I.pressed('jump');
    if (jumpPress) this.jumpBuf = 7; else if (this.jumpBuf > 0) this.jumpBuf--;
    this.dropping = false;
    // удар сверху: просто ↓ в воздухе (или ↓+прыжок)
    const poundIn = can && !this.onGround && (I.pressed('down') || (this.jumpBuf > 0 && down)) && this.coyote <= 0;
    // спуск с платформы: ↓+прыжок или просто подержать ↓
    this.downHold = down && onOneway && !left && !right ? (this.downHold || 0) + 1 : 0;
    if (poundIn && this.has('pound') && !this.inWater && !this.pounding && this.dashT <= 0) {
      // удар сверху
      this.pounding = true;
      this.jumpBuf = 0;
      this.vy = -2;
      this.vx = 0;
      this.dashT = 0;
      G.Audio.play('pound');
    } else if ((this.jumpBuf > 0 && can && down && onOneway) || this.downHold > 12) {
      this.downHold = 0;
      this.dropT = 10;
      this.y += 2;
      this.jumpBuf = 0; this.coyote = 0; this.platform = null;
    } else if (this.jumpBuf > 0 && this.inWater) {
      // гребок вверх; у поверхности — выпрыгиваем
      const surface = L.tileAt(this.cx, this.y - 2) !== G.T.LIQUID;
      this.vy = surface ? -6.2 : -2.8;
      this.jumpBuf = 0;
      G.Audio.play('jump');
      G.Particles.add({ x: this.cx, y: this.y, vy: -0.6, life: 30, color: '#d0f0ff', kind: 'dot' });
    } else if (this.jumpBuf > 0 && this.coyote > 0 && this.dashT <= 0) {
      if (this.crouching) this.setCrouch(false, L);
      this.vy = this.slow ? -5.4 : -7.1;
      this.jumpBuf = 0; this.coyote = 0;
      this.onGround = false; this.platform = null;
      this.jumpHeld = true; this.springBoost = false;
      G.Audio.play('jump');
      G.Particles.dust(this.cx, this.bottom, 2);
    } else if (this.jumpBuf > 0 && this.wallDir !== 0) {
      // отскок от стены
      this.wallKick = -this.wallDir;
      this.vx = -this.wallDir * 2.6;
      this.vy = -6.6;
      this.facing = -this.wallDir;
      this.wallLock = 12;
      this.jumpBuf = 0; this.jumpHeld = true; this.airJumps = 0;
      G.Audio.play('jump');
      G.Particles.dust(this.wallDir > 0 ? this.x + this.w : this.x, this.y + this.h - 6, 2);
    } else if (this.jumpBuf > 0 && this.has('djump') && this.airJumps < 1 && !this.onGround && this.dashT <= 0 && !this.pounding) {
      this.airJumps++;
      this.vy = -6.4;
      this.jumpBuf = 0; this.jumpHeld = true;
      this.flipT = 22;
      G.Audio.play('spring');
      G.Particles.fx('fx_ring', this.cx, this.bottom);
    }
    if (this.jumpHeld && !I.down('jump') && this.vy < -2 && !this.springBoost) { this.vy *= 0.5; this.jumpHeld = false; }
    if (this.vy >= 0) this.jumpHeld = false;

    // гравитация
    if (this.dashT <= 0) {
      if (this.pounding) this.vy = Math.min(this.vy + 0.9, 9);
      else if (this.inWater) this.vy = Math.min(this.vy + 0.12, 1.4);
      else {
        const g = Math.abs(this.vy) < 1.1 && I.down('jump') ? 0.24 : 0.36;
        this.vy = Math.min(this.vy + g, 6.6);
        if (this.wallDir !== 0 && this.vy > 1.1) { this.vy = 1.1; if (this.t % 5 === 0) G.Particles.add({ x: this.wallDir > 0 ? this.x + this.w : this.x, y: this.y + 8, vy: 0.3, life: 14, color: '#d8ccbc' }); }
      }
    }
    this.inWind = false;

    // движение и столкновения
    const prevBottom = this.bottom;
    this.hitL = this.hitR = this.hitU = false;
    const wasGround = this.onGround;
    this.onGround = false;
    if (this.dropT > 0) this.dropT--;
    this.dropping = this.dropT > 0;
    const fallV = this.vy;
    G.Physics.moveX(this, L, this.vx);
    if (G.Physics.moveY(this, L, this.vy)) {
      if (this.hitU) {
        for (const tx of this.headHits || []) L.hitBlock(tx, this.headTy, game, 'head');
        this.vy = 0.5;
      } else this.vy = 0;
    }
    if ((this.hitL || this.hitR) && this.dashT > 0) { this.dashT = 0; }
    // платформы-сущности
    this.platform = null;
    if (this.vy >= 0 && !this.dropping) {
      for (const pl of game.platforms()) {
        const r = pl.platRect || pl;
        const prevTop = r.y - (pl.dy || 0);
        if (this.x + this.w > r.x && this.x < r.x + r.w && prevBottom <= Math.max(r.y, prevTop) + 1.5 && this.bottom >= r.y - 0.5 && this.bottom <= r.y + Math.max(8, this.vy + 4)) {
          this.y = r.y - this.h; this.vy = 0; this.onGround = true; this.platform = pl; this.groundTile = -1;
        }
      }
    }
    // приземление
    if (this.onGround && !wasGround) {
      if (this.pounding) this.poundLand(game);
      else if (fallV > 3.5) { this.landT = 6; G.Particles.dust(this.cx, this.bottom, 3); G.Audio.play('land'); }
    }

    this.checkHazards(game);
    if (this.y > L.h * 16 + 24) { this.die(game, true); return; }

    if (!locked) {
      this.handleShooting(game);
      if (I.pressed('spear') && this.stun <= 0 && this.dashT <= 0) {
        if (this.hasSpear && this.throwT <= 0) {
          this.hasSpear = false;
          this.throwT = 14;
          this.animT = 0;
          this.spear = game.spawn(new G.Spear(this, this.cx + this.facing * 8, this.y + (this.crouching ? 7 : 11), this.facing, game.stats.spear));
          G.Audio.play('spear');
        } else if (this.spear) this.spear.recall();
      }
      if (I.pressed('special') && this.has('eye')) game.tryEyeMode();
    }
    this.updateAnim();
  }

  poundLand(game) {
    const L = game.level;
    this.pounding = false;
    this.vy = -3;
    this.onGround = false;
    game.shake(4, 10);
    G.Audio.play('explode');
    G.Particles.dust(this.cx - 6, this.bottom, 4);
    G.Particles.dust(this.cx + 6, this.bottom, 4);
    game.spawn(new G.PoundWave(this.cx, this.bottom, -1));
    game.spawn(new G.PoundWave(this.cx, this.bottom, 1));
    const ty = Math.floor((this.bottom + 2) / 16);
    for (let tx = Math.floor(this.x / 16); tx <= Math.floor((this.x + this.w - 1) / 16); tx++) {
      const t = L.get(tx, ty);
      if (t === G.T.HEAVY || t === G.T.BRICK || t === G.T.CRACKED || t === G.T.BONUS) L.hitBlock(tx, ty, game, 'pound');
    }
    for (const e of game.targets()) if (G.dist(e.cx, e.bottom, this.cx, this.bottom) < 34) e.hurt(3, game, { vx: Math.sign(e.cx - this.cx) });
  }

  chargeMax(game) { return Math.round(56 / (1 + game.stats.charge * 0.35)); }

  handleShooting(game) {
    if (!this.has('shot')) return;
    const I = G.Input, st = game.stats;
    const ey = this.y + (this.crouching ? 2 : 4), ex = this.cx + this.facing * 5;
    const fireDown = I.down('shoot') || I.down('shootUp'), firePressed = I.pressed('shoot') || I.pressed('shootUp');
    if (fireDown) this.chargeUp = I.down('shootUp'); // заряженный выстрел летит туда, куда его копили
    const up = (I.down('up') || I.down('shootUp') || (!fireDown && this.charge > 0 && this.chargeUp)) && !this.crouching ? -Math.PI / 4 : 0;
    this.aimUp = up !== 0;
    if (game.eyeMode > 0) {
      if (fireDown && this.shotCd <= 0) {
        for (const a of [-0.16, 0, 0.16]) game.spawn(new G.EyeShot(ex, ey, this.facing, { beam: true, angle: a + up, dmg: 2 }));
        this.shotCd = 7; this.shootAnim = 8;
        G.Audio.play('shoot');
      }
      return;
    }
    if (firePressed && this.shotCd <= 0 && this.stun <= 0) {
      const live = game.entities.filter((e) => e instanceof G.EyeShot && !e.charged).length;
      if (live < 3 + st.shot * 2) {
        if (st.shot >= 3) for (const a of [-0.14, 0, 0.14]) game.spawn(new G.EyeShot(ex, ey, this.facing, { angle: a + up }));
        else if (st.shot === 2) { game.spawn(new G.EyeShot(ex, ey - 2, this.facing, { angle: up })); game.spawn(new G.EyeShot(ex, ey + 3, this.facing, { angle: up })); }
        else game.spawn(new G.EyeShot(ex, ey, this.facing, { angle: up }));
        this.shotCd = 8; this.shootAnim = 12;
        G.Audio.play('shoot');
      }
    }
    if (!this.has('charge')) { this.charge = 0; return; }
    if (fireDown && this.stun <= 0) {
      this.charge++;
      const m = this.chargeMax(game);
      if (this.charge === 14) G.Audio.play('charge');
      if (this.charge === m) { G.Audio.play('charged'); G.Particles.fx('fx_ring', ex, ey); }
      if (this.charge > 12 && this.t % 3 === 0) {
        const a = Math.random() * Math.PI * 2;
        G.Particles.add({ x: ex + Math.cos(a) * 12, y: ey + Math.sin(a) * 12, vx: -Math.cos(a), vy: -Math.sin(a), life: 11, color: this.charge >= m ? '#ffffff' : '#7affb0', kind: 'spark', add: true });
      }
    } else if (this.charge > 0) {
      if (this.charge >= this.chargeMax(game)) {
        game.spawn(new G.EyeShot(ex, ey, this.facing, { charged: true, angle: up, dmg: 5 + st.shot * 2 }));
        this.shootAnim = 16;
        this.vx -= this.facing * 1.2;
        G.Audio.play('bigshot');
        game.shake(2, 6);
      }
      this.charge = 0;
    }
  }

  checkHazards(game) {
    const L = game.level, b = this.hurtbox();
    const x0 = Math.floor(b.x / 16), x1 = Math.floor((b.x + b.w) / 16);
    const y0 = Math.floor((b.y - 2) / 16), y1 = Math.floor((this.bottom + 1) / 16);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const t = L.get(tx, ty);
      if (t === G.T.SPIKE) {
        if (this.bottom >= ty * 16 - 0.5 && this.y < ty * 16 + 16 && this.hurt(1, game, tx * 16 + 8) && this.alive) this.vy = -5;
      } else if (t === G.T.SPIKE_DOWN) {
        if (this.y <= (ty + 1) * 16 + 0.5 && this.bottom > ty * 16) this.hurt(1, game, tx * 16 + 8);
      } else if (t === G.T.LIQUID && L.cfg.liquid === 'hurt' && this.bottom > ty * 16 + 5) {
        if (this.invuln <= 0 && game.eyeMode <= 0) { G.Audio.play('lava'); G.Particles.fx('fx_splash', this.cx, ty * 16 + 4); }
        this.hurt(1, game, this.cx - this.facing);
        if (this.alive) { this.vy = -8.2; this.onGround = false; this.stun = 0; this.pounding = false; this.airJumps = 0; this.canDash = true; }
        return;
      }
    }
  }

  // выбор кадра
  updateAnim() {
    let a;
    if (this.winT > 0) a = 'win';
    else if (this.stun > 0) a = 'hurt';
    else if (this.dashT > 0) a = 'dash';
    else if (this.pounding) a = 'pound';
    else if (this.throwT > 0) a = 'throw';
    else if (this.crouching) a = 'crouch';
    else if (this.wallDir !== 0 && this.vy > 0) a = 'wall';
    else if (this.flipT > 0) a = 'djump';
    else if (!this.onGround) a = this.vy < 0 ? 'jump' : 'fall';
    else if (this.shootAnim > 0 && Math.abs(this.vx) < 0.4) a = this.aimUp ? 'shootUp' : 'shoot';
    else if (Math.abs(this.vx) > 0.3) a = 'run';
    else a = 'idle';
    if (a !== this.anim) { this.anim = a; this.animT = 0; }
  }
  frameName() {
    const t = this.animT, A = G.Art;
    switch (this.anim) {
      case 'idle': return A.frame('hero_idle', this.t);
      case 'run': return A.frame('hero_run', this.t);
      case 'jump': return A.frame('hero_jump', t);
      case 'fall': return A.frame('hero_fall', t);
      case 'djump': return A.frame('hero_djump', t);
      case 'throw': return A.frame('hero_throw', t);
      case 'dash': return A.frame('hero_dash', t);
      case 'win': return A.frame('hero_win', t);
      case 'wall': return 'hero_wall0';
      case 'pound': return 'hero_pound0';
      case 'crouch': return 'hero_crouch0';
      case 'hurt': return 'hero_hurt0';
      case 'shoot': return 'hero_shoot0';
      case 'shootUp': return 'hero_shootUp0';
    }
    return 'hero_idle0';
  }
  // мировые координаты третьего глаза для текущего кадра
  eyePos(name, x, y, flip) {
    const s = G.Art.get(name), d = G.Art.defs[name];
    if (!s || !d || !d.opts.eye) return [x + this.facing * 4, y - 26];
    const ex = flip ? s.w - 1 - d.opts.eye[0] : d.opts.eye[0];
    return [x - (flip ? s.w - s.ox : s.ox) + ex + 0.5, y - s.oy + d.opts.eye[1] + 0.5];
  }

  draw(c, game) {
    const x = Math.round(this.cx), y = Math.round(this.bottom);
    let name, flip;
    if (!this.alive) {
      name = this.fellInPit ? 'hero_fall0' : G.Art.frame('hero_dead', this.deathT);
      flip = this.facing < 0;
    } else {
      name = this.frameName();
      flip = this.anim === 'wall' ? this.wallDir < 0 : this.facing < 0;
    }
    if (this.invuln > 0 && this.alive && Math.floor(this.invuln / 3) % 2 === 0) return;
    if (game.eyeMode > 0) {
      const k = game.eyeMode < 120 && Math.floor(game.eyeMode / 6) % 2 ? 0.3 : 1;
      G.Gfx.glow(x, y - 14, 28, '#3aff8a', 0.4 * k);
    }
    if (game.stats.shield > 0 && this.alive) G.Gfx.glow(x, y - 14, 20, '#80d0ff', 0.25);
    const white = this.stun > 0 && this.stun % 4 < 2;
    G.Gfx.spr(name, x, y, flip, white);
    // свечение третьего глаза
    const glowK = Math.min(1, (this.charge > 10 ? this.charge / this.chargeMax(game) : 0) + (this.shootAnim > 0 ? 0.6 : 0) + (game.eyeMode > 0 ? 0.8 : 0));
    if (glowK > 0.05 && this.alive) {
      const [ex, ey] = this.eyePos(name, x, y, flip);
      G.Gfx.glow(ex, ey, 5 + glowK * 7, '#3aff8a', 0.4 + glowK * 0.5);
    }
  }
};

// Волна от удара сверху (бьёт врагов, ломает блоки по пути)
G.PoundWave = class PoundWave extends G.Entity {
  constructor(x, y, dir) { super(x - 4, y - 8, 8, 8); this.vx = dir * 3.2; this.layer = 2; this.hit = new Set(); }
  update(game) {
    this.t++;
    this.x += this.vx;
    if (this.t > 14 || game.level.solidAt(this.cx, this.y + 3)) { this.dead = true; return; }
    if (this.t % 2 === 0) G.Particles.add({ x: this.cx, y: this.bottom - 1, vy: G.rand(-1.4, -0.3), g: 0.1, life: 14, color: '#ffe8a0', add: true });
    for (const e of game.targets()) if (!this.hit.has(e) && e.hitTest(this)) { this.hit.add(e); e.hurt(2, game, this); }
  }
};
