'use strict';
// Игровое состояние, главный цикл и связка всех систем.
G.Game = class Game {
  constructor() {
    this.state = 'boot';
    this.stateT = 0;
    this.time = 0;
    this.frame = 0;
    this.cam = { x: 0, y: 0, lx: 0 };
    this.shakeAmt = 0; this.shakeT = 0;
    this.stopT = 0;
    this.entities = [];
    this.timers = [];
    this.fadeA = 1; this.fadeTarget = 0; this.fadeCb = null;
    this.flash = { color: '#fff', t: 0, max: 1 };
    this.menu = { i: 0 };
    this.lightCv = null; this.lightVer = -1;
    this.resetRun();
  }

  resetRun() {
    this.stats = { maxHp: 4, shot: 1, charge: 0, spear: 0, shield: 0, eyeStart: false };
    this.lives = 3;
    this.coins = 0;
    this.levelIdx = 0;
    this.bought = {};
    this.totalCoins = 0;
  }

  // ---------------------------------------------------------------- уровни
  startLevel(i, keepCheckpoint = false) {
    this.levelIdx = i;
    const def = G.LEVELS[i];
    this.level = new G.Level(def);
    this.entities = [];
    this.timers = [];
    G.Particles.clear();
    this.boss = null;
    this.bossStarted = false;
    this.bossDoneT = 0;
    this.eyeMode = 0;
    if (!keepCheckpoint) {
      this.checkpoint = null;
      this.levelCoins = 0;
      this.eyeMeter = this.stats.eyeStart ? 100 : (this.eyeMeter || 0);
      this.stats.eyeStart = false;
    }
    const L = this.level;
    // арена: высота пола у входа
    if (L.arena) {
      let fy = L.h * 16;
      const col = L.arena.tx + 2;
      for (let ty = 0; ty < L.h; ty++) if (L.isSolid(col, ty)) { fy = ty * 16; break; }
      L.arena.floor = fy;
      this.arena = L.arena;
    }
    for (const s of L.spawns) {
      let e = null;
      switch (s.type) {
        case 'coin': e = new G.Coin(s.x, s.y - 8, 0, 0, false, true); break;
        case 'bigcoin': e = new G.Coin(s.x, s.y - 8, 0, 0, true, true); break;
        case 'heart': e = new G.Pickup('heart', s.x, s.y - 2, 0, true); break;
        case 'eye': e = new G.Pickup('eye', s.x, s.y - 2, 0, true); break;
        case 'checkpoint': e = new G.Checkpoint(s.x, s.y); break;
        case 'spring': e = new G.Spring(s.x, s.y); break;
        case 'hplat': e = new G.MovingPlatform(s.x, s.y, false); break;
        case 'vplat': e = new G.MovingPlatform(s.x, s.y, true); break;
        case 'sign': e = new G.Sign(s.x, s.y, s.text); break;
        case 'torch': e = new G.Torch(s.x, s.y); break;
        default: e = G.makeEnemy(s);
      }
      if (e) this.entities.push(e);
    }
    const st = this.checkpoint || L.start;
    this.player = new G.Player(st.x, st.y, this.stats);
    if (this.checkpoint) {
      for (const e of this.entities) {
        if (e instanceof G.Checkpoint && e.cx <= this.checkpoint.x + 1) { e.active = true; e.anim = 1; }
        // враги прямо у точки возрождения не нужны
        if (e.isEnemy && Math.abs(e.cx - st.x) < 90) e.dead = true;
      }
    }
    this.cam.x = G.clamp(this.player.cx - G.W / 2, 0, L.w * 16 - G.W);
    this.cam.y = G.clamp(this.player.cy - G.H * 0.55, 0, L.h * 16 - G.H);
    this.cam.lx = 0;
    G.Backgrounds.prewarm(L.theme);
  }

  // ---------------------------------------------------------------- API для сущностей
  spawn(e) { this.entities.push(e); return e; }
  later(frames, fn) { this.timers.push({ t: frames, fn }); }
  shake(a, t) { if (!G.Save.data.shake) return; this.shakeAmt = Math.max(this.shakeAmt, a); this.shakeT = Math.max(this.shakeT, t); }
  hitstop(n) { this.stopT = Math.max(this.stopT, n); }
  flashScreen(color, t) { this.flash = { color, t, max: t }; }
  targets() {
    const out = [];
    for (const e of this.entities) if (e.isEnemy && !e.dead && !e.dying && e.active !== false) out.push(e);
    return out;
  }
  platforms() {
    const out = [];
    for (const e of this.entities) if (e.isPlatform && !e.dead) out.push(e);
    return out;
  }
  addCoins(n, x, y) {
    this.coins += n;
    this.levelCoins += n;
    this.totalCoins += n;
    if (x !== undefined) G.Particles.text(x, y, '+' + n, '#ffe060', 6);
  }
  dropCoins(x, y, n) {
    for (let i = 0; i < n; i++) {
      const big = n >= 6 && i % 5 === 0;
      this.spawn(new G.Coin(x, y, G.rand(-1.8, 1.8), G.rand(-4.5, -2), big));
    }
  }
  collect(kind, x, y) {
    if (kind === 'heart') {
      const p = this.player;
      if (p.hp < this.stats.maxHp) p.hp = Math.min(this.stats.maxHp, p.hp + 2);
      else this.addCoins(50, x, y - 6);
      G.Audio.play('heart');
      G.Particles.ring(x, y, '#ff6a8a', 16, 16);
    } else if (kind === 'eye') {
      this.eyeMeter = Math.min(100, this.eyeMeter + 40);
      G.Audio.play('heart');
      G.Particles.ring(x, y, '#6aff9a', 16, 16);
      G.Particles.text(x, y - 8, 'ЭНЕРГИЯ!', '#8affb0', 6);
    } else if (kind === 'life') {
      this.lives++;
      G.Audio.play('heart');
      G.Particles.text(x, y - 8, '1UP', '#ffe060', 8);
    }
  }
  setCheckpoint(x, y) { this.checkpoint = { x, y }; if (this.player.hp < this.stats.maxHp) this.player.hp = Math.min(this.stats.maxHp, this.player.hp + 1); }
  onEnemyKilled(e) {
    if (this.eyeMode <= 0) this.eyeMeter = Math.min(100, this.eyeMeter + (e.meter || 10));
    // редкое сердце из врага
    if (!e.isBoss && Math.random() < 0.06) this.spawn(new G.Pickup('heart', e.cx, e.cy, -3));
  }
  tryEyeMode() {
    if (this.eyeMode > 0) return;
    if (this.eyeMeter < 100) { G.Audio.play('deny'); return; }
    this.eyeMeter = 0;
    this.eyeMode = 600;
    G.Audio.play('eyeOpen');
    this.flashScreen('#9affc8', 14);
    this.shake(3, 14);
    G.Particles.ring(this.player.cx, this.player.y + 5, '#ffffff', 40, 24);
    G.Particles.sparks(this.player.cx, this.player.y + 5, 20, '#9affc8', 4);
  }
  clearHostiles() {
    for (const e of this.entities) {
      if (e.hostile || (e.isEnemy && !e.isBoss)) {
        if (!e.dead) G.Particles.sparks(e.cx, e.cy, 4, '#ffffff', 2);
        if (e.isEnemy && !e.isBoss) { e.dead = true; G.Particles.explosion(e.cx, e.cy, 0.5); }
        else e.dead = true;
      }
    }
  }
  onPlayerDeath() {
    this.lives--;
    if (this.lives < 0) {
      this.fadeTo(() => this.setState('gameover'));
    } else {
      this.fadeTo(() => {
        this.startLevel(this.levelIdx, true);
        this.setState('intro');
      });
    }
  }
  onBossDefeated(b) {
    this.bossDoneT = 1;
    this.dropCoins(b.cx, b.cy, 30);
    this.level.openGate();
  }

  // ---------------------------------------------------------------- состояния
  setState(s) {
    this.state = s;
    this.stateT = 0;
    this.menu = { i: 0 };
    G.Input.clearAny();
    if (['title', 'shop', 'ending', 'gameover'].includes(s)) G.Particles.clear();
    switch (s) {
      case 'title': G.Audio.music('title'); break;
      case 'intro': G.Audio.stopMusic(); break;
      case 'play':
        G.Audio.music(this.bossStarted ? 'boss' : G.LEVELS[this.levelIdx].music);
        break;
      case 'gameover': G.Audio.stopMusic(); break;
      case 'clear': G.Audio.stopMusic(); G.Audio.play('checkpoint'); break;
      case 'shop': G.Audio.music('shop'); break;
      case 'ending': G.Audio.music('ending'); break;
    }
  }
  fadeTo(cb, speed = 0.06) {
    if (this.fadeCb) return;
    this.fadeTarget = 1;
    this.fadeSpeed = speed;
    this.fadeCb = cb;
  }

  newGame(idx = 0) {
    this.resetRun();
    // при выборе этапа — компенсация за пропущенные магазины
    if (idx > 0) {
      this.coins = 400 * idx;
      this.stats.maxHp += Math.min(2, idx);
      this.stats.shot = Math.min(3, 1 + Math.floor(idx / 2));
    }
    this.eyeMeter = 0;
    this.startLevel(idx);
    this.setState('intro');
  }

  // ---------------------------------------------------------------- шаг симуляции
  step() {
    this.frame++;
    this.time += G.STEP;
    this.stateT++;
    // во время хит-стопа ввод не считываем — нажатия «защёлкнуты» и сработают после
    const frozen = this.state === 'play' && this.stopT > 0;
    if (!frozen) G.Input.update();

    if (this.fadeTarget !== this.fadeA) {
      this.fadeA = G.approach(this.fadeA, this.fadeTarget, this.fadeSpeed || 0.06);
      if (this.fadeA === 1 && this.fadeCb) {
        const cb = this.fadeCb;
        this.fadeCb = null;
        cb();
        this.fadeTarget = 0;
      }
    }
    if (this.flash.t > 0) this.flash.t--;

    const was = this.state;
    G.UI.update(this);
    // кадр выхода из паузы не обрабатываем — иначе то же нажатие снова поставит паузу
    if (this.state === 'play' && was === 'play') this.updatePlay();
    else if (this.state === 'intro') {
      if (this.stateT > 150 || (this.stateT > 30 && G.Input.pressed('confirm'))) this.setState('play');
    } else if (this.state === 'title' || this.state === 'ending') {
      // фоновая «прокрутка» камеры
      this.cam.x += 0.6;
      G.Particles.update(null);
    }
  }

  updatePlay() {
    const I = G.Input;
    if (this.stopT > 0) { this.stopT--; return; }
    if (I.pressed('pause') && this.player.alive && !this.fadeCb) {
      this.state = 'pause';
      this.menu = { i: 0 };
      G.Audio.play('pause');
      return;
    }
    const L = this.level;
    L.update(this);

    for (let i = this.timers.length - 1; i >= 0; i--) {
      if (--this.timers[i].t <= 0) { const f = this.timers[i].fn; this.timers.splice(i, 1); f(); }
    }
    if (this.eyeMode > 0) {
      this.eyeMode--;
      if (this.eyeMode === 0) G.Audio.play('recall');
    }

    // платформы обновляются первыми, чтобы игрок ехал вместе с ними
    for (const e of this.entities) if (e instanceof G.MovingPlatform) e.update(this);
    this.player.update(this);
    for (const e of this.entities) if (!(e instanceof G.MovingPlatform) && !e.dead) e.update(this);
    this.entities = this.entities.filter((e) => !e.dead);
    G.Particles.update(L);

    // вход на арену босса
    const A = this.arena;
    if (A && !this.bossStarted && A.trigger !== undefined && this.player.alive && this.player.x > A.trigger + 16) {
      this.bossStarted = true;
      this.level.closeGate();
      this.boss = this.spawn(G.makeBoss(G.LEVELS[this.levelIdx].boss, this));
      G.Audio.music('boss');
      G.Audio.play('roar');
      this.shake(4, 30);
      G.UI.bossBanner(this.boss.name);
      // убираем врагов с арены
      for (const e of this.entities) if (e.isEnemy && !e.isBoss && e.x > A.x) e.dead = true;
    }
    if (this.bossDoneT > 0) {
      this.bossDoneT++;
      if (this.bossDoneT === 100) { this.player.winT = 1; G.Audio.music('ending'); }
      if (this.player.winT > 0) this.player.winT++;
      if (this.bossDoneT === 260) {
        this.fadeTo(() => {
          this.setState('clear');
          const s = G.Save.data;
          s.unlocked = Math.max(s.unlocked, Math.min(G.LEVELS.length, this.levelIdx + 2));
          if (this.levelIdx === G.LEVELS.length - 1) s.cleared = true;
          s.bestCoins = Math.max(s.bestCoins, this.totalCoins);
          G.Save.store();
        });
      }
    }
    this.updateCamera();
    if (this.shakeT > 0) this.shakeT--; else this.shakeAmt = 0;
  }

  updateCamera() {
    const p = this.player, L = this.level, A = this.arena;
    this.cam.lx = G.lerp(this.cam.lx, p.facing * 46 + p.vx * 8, 0.04);
    let tx = p.cx - G.W / 2 + this.cam.lx;
    if (this.bossStarted && A) tx = A.x;
    tx = G.clamp(tx, 0, L.w * 16 - G.W);
    if (!this.bossStarted && A) tx = Math.min(tx, A.x);
    const ty = G.clamp(p.cy - G.H * 0.56, 0, L.h * 16 - G.H);
    this.cam.x = G.lerp(this.cam.x, tx, this.bossStarted ? 0.08 : 0.14);
    this.cam.y = G.lerp(this.cam.y, ty, 0.1);
  }

  // ---------------------------------------------------------------- отрисовка
  render() {
    const X = G.Gfx, c = X.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#000';
    c.fillRect(0, 0, X.canvas.width, X.canvas.height);
    // область игры
    c.save();
    c.beginPath();
    c.rect(X.offX, X.offY, G.W * X.scale, G.H * X.scale);
    c.clip();

    if (this.level && ['play', 'pause', 'intro', 'clear'].includes(this.state)) this.renderWorld();
    G.UI.draw(this);

    // вспышка и затемнение
    X.screen();
    if (this.flash.t > 0) {
      c.globalAlpha = (this.flash.t / this.flash.max) * 0.7;
      c.fillStyle = this.flash.color;
      c.fillRect(0, 0, G.W, G.H);
      c.globalAlpha = 1;
    }
    if (this.fadeA > 0) {
      c.fillStyle = `rgba(6,2,12,${this.fadeA})`;
      c.fillRect(0, 0, G.W, G.H);
    }
    c.restore();
  }

  renderWorld() {
    const X = G.Gfx, c = X.ctx, L = this.level;
    let sx = 0, sy = 0;
    if (this.shakeT > 0 && this.state === 'play') {
      sx = (Math.random() - 0.5) * this.shakeAmt * 2;
      sy = (Math.random() - 0.5) * this.shakeAmt * 2;
    }
    const cx = this.cam.x + sx, cy = this.cam.y + sy;
    G.Backgrounds.draw(L.theme, cx, cy, this.time);
    X.world(cx, cy);
    for (const e of this.entities) if (e.layer === 0 && e.onScreen(this)) e.draw(c, this);
    G.Tiles.drawLayer(L, cx, cy);
    X.world(cx, cy);
    G.Tiles.drawAnimated(c, L, cx, cy, this.time);
    G.Tiles.drawDeco(c, L, cx, this.time);
    for (const e of this.entities) if (e.layer === 1 && e.onScreen(this, 80)) e.draw(c, this);
    this.player.draw(c, this);
    for (const e of this.entities) if (e.layer === 2 && e.onScreen(this, 80)) e.draw(c, this);
    if (this.boss && !this.boss.dead && !this.entities.includes(this.boss)) this.boss.draw(c, this);
    G.Particles.draw(c, 0);
    this.renderLighting(cx, cy);
    // свечение режима третьего глаза
    if (this.eyeMode > 0) {
      X.screen();
      const g = c.createRadialGradient(G.W / 2, G.H / 2, G.H * 0.3, G.W / 2, G.H / 2, G.H * 0.9);
      g.addColorStop(0, 'rgba(60,255,150,0)');
      g.addColorStop(1, `rgba(60,255,150,${0.22 + Math.sin(this.time * 6) * 0.05})`);
      c.fillStyle = g;
      c.fillRect(0, 0, G.W, G.H);
    }
    if (L.theme === 'volcano') {
      X.screen();
      const g = c.createLinearGradient(0, G.H, 0, G.H * 0.5);
      g.addColorStop(0, 'rgba(255,90,20,0.18)'); g.addColorStop(1, 'rgba(255,90,20,0)');
      c.fillStyle = g; c.fillRect(0, 0, G.W, G.H);
      // пепел
      for (let i = 0; i < 40; i++) {
        const x = (G.hash2(i, 1) * G.W + this.time * 12 * (0.5 + G.hash2(i, 3)) - cx * 0.3) % G.W;
        const y = (G.hash2(i, 2) * G.H + this.time * 20 * (0.5 + G.hash2(i, 4))) % G.H;
        c.fillStyle = i % 3 ? 'rgba(80,60,60,0.6)' : 'rgba(255,140,60,0.7)';
        c.fillRect((x + G.W) % G.W, y, 1.5, 1.5);
      }
    }
  }

  // Освещение для пещер: тёмная маска с «дырками» от источников света
  renderLighting(cx, cy) {
    const L = this.level;
    if (L.theme !== 'cave') return;
    const X = G.Gfx;
    if (!this.lightCv || this.lightVer !== X.version) {
      this.lightCv = document.createElement('canvas');
      this.lightCv.width = Math.ceil(G.W * X.scale / 2);
      this.lightCv.height = Math.ceil(G.H * X.scale / 2);
      this.lightVer = X.version;
    }
    const cv = this.lightCv, lc = cv.getContext('2d');
    const k = cv.width / G.W;
    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.globalCompositeOperation = 'source-over';
    lc.clearRect(0, 0, cv.width, cv.height);
    lc.fillStyle = 'rgba(4,0,14,0.86)';
    lc.fillRect(0, 0, cv.width, cv.height);
    lc.globalCompositeOperation = 'destination-out';
    const hole = (x, y, r, a = 1) => {
      const sx = (x - cx) * k, sy = (y - cy) * k, sr = r * k;
      if (sx < -sr || sx > cv.width + sr) return;
      const g = lc.createRadialGradient(sx, sy, 0, sx, sy, sr);
      g.addColorStop(0, `rgba(0,0,0,${a})`);
      g.addColorStop(0.6, `rgba(0,0,0,${a * 0.6})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      lc.fillStyle = g;
      lc.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
    };
    const p = this.player;
    hole(p.cx, p.cy - 4, 130 + (this.eyeMode > 0 ? 60 : 0) + Math.sin(this.time * 3) * 4);
    for (const l of L.lights) hole(l.x, l.y, l.r, 0.85);
    for (const e of this.entities) {
      if (e instanceof G.EyeShot) hole(e.cx, e.cy, e.charged ? 70 : 40, 0.8);
      else if (e instanceof G.EnemyShot) hole(e.cx, e.cy, 30, 0.7);
      else if (e.isBoss) hole(e.cx, e.cy, 140, 0.9);
      else if (e instanceof G.Coin) hole(e.cx, e.cy, 16, 0.5);
    }
    for (const pt of G.Particles.list) if (pt.kind === 'fire' || pt.kind === 'ring') hole(pt.x, pt.y, 30, 0.4);
    const c = X.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(cv, X.offX, X.offY, G.W * X.scale, G.H * X.scale);
  }
};
