'use strict';
// Игровое состояние, главный цикл и связка всех систем.
G.ABILITY_ORDER = ['spear', 'shot', 'djump', 'dash', 'charge', 'wall', 'pound', 'eye'];

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
    this.bubbles = [];
    this.fadeA = 1; this.fadeTarget = 0; this.fadeCb = null;
    this.flash = { color: '#fff', t: 0, max: 1 };
    this.menu = { i: 0 };
    this.wind = 0;
    this.lightCv = document.createElement('canvas');
    this.lightCv.width = G.W; this.lightCv.height = G.H;
    this.resetRun();
  }

  resetRun() {
    this.stats = { maxHp: 4, shot: 1, charge: 0, spear: 0, shield: 0 };
    this.lives = 3;
    this.coins = 0;
    this.levelIdx = 0;
    this.bought = {};
    this.totalCoins = 0;
    this.eyeMeter = 0;
    this.abil = new Set(['spear']);
  }

  // способности на старте этапа i — всё, что открыто боссами предыдущих этапов
  abilitiesFor(i) {
    const s = new Set(['spear']);
    for (let k = 0; k < i; k++) if (G.LEVELS[k].unlock) s.add(G.LEVELS[k].unlock);
    return s;
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
    this.wind = 0;
    G.UI.toast(null);
    for (const a of this.abilitiesFor(i)) this.abil.add(a);
    if (!keepCheckpoint) { this.checkpoint = null; this.levelCoins = 0; this.levelGlyphs = 0; }
    this.levelSecrets = 0;
    const L = this.level;
    this.arena = null;
    if (L.arena) {
      let fy = L.h * 16;
      for (let ty = 0; ty < L.h; ty++) if (L.isSolid(L.arena.tx + 2, ty)) { fy = ty * 16; break; }
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
        case 'life': e = this.lifeTaken(s) ? null : new G.Pickup('life', s.x, s.y - 2, 0, true); if (e) e.spawnKey = s.tx + ':' + s.ty; break;
        case 'checkpoint': e = new G.Checkpoint(s.x, s.y); break;
        case 'spring': e = new G.Spring(s.x, s.y); break;
        case 'hplat': e = new G.MovingPlatform(s.x, s.y, false); break;
        case 'vplat': e = new G.MovingPlatform(s.x, s.y, true); break;
        case 'fan': e = new G.Fan(s.x, s.y, L); break;
        case 'sign': e = new G.Sign(s.x, s.y, s.text); break;
        case 'hint': e = new G.HintZone(s.x, s.y, s.text); break;
        case 'target': e = new G.SpearTarget(s.x, s.y); break;
        case 'firebar': e = new G.FireBar(s.x, s.y, G.hash2(s.x, s.y) < 0.5 ? 1 : -1); break;
        case 'crusher': e = new G.Crusher(s.x, s.y); break;
        case 'saw': e = new G.Saw(s.x, s.y, L); break;
        case 'icicle': e = new G.Icicle(s.x, s.y, L); break;
        case 'boulders': e = new G.BoulderSpawner(s.x, s.y, s.dir); break;
        case 'mace': e = new G.Mace(s.x, s.y, L); break;
        case 'geyser': e = new G.Geyser(s.x, s.y); break;
        case 'rising': e = new G.RisingLiquid(s.x, L); break;
        case 'glyph': e = this.glyphTaken(s.idx) ? null : new G.Glyph(s.x, s.y, s.idx); break;
        case 'torch': e = new G.Torch(s.x, s.y); break;
        case 'prop': break;
        default: if (s.enemy) e = G.makeEnemy(s, L);
      }
      if (e) this.entities.push(e);
    }
    const st = this.checkpoint || L.start;
    this.player = new G.Player(st.x, st.y, this);
    if (this.checkpoint) for (const e of this.entities) {
      if (e instanceof G.Checkpoint && e.cx <= this.checkpoint.x + 1) e.active = true;
      if (e.isEnemy && Math.abs(e.cx - st.x) < 80) e.dead = true;
    }
    this.cam.x = G.clamp(this.player.cx - G.W / 2, 0, L.w * 16 - G.W);
    this.cam.y = G.clamp(this.player.cy - G.H * 0.6, 0, L.h * 16 - G.H);
    this.cam.lx = 0;
    G.Backgrounds.prewarm(L.theme);
  }
  glyphTaken(i) { const m = (G.Save.data.secrets || {})[this.levelIdx] || 0; return !!(m & (1 << i)) && this.levelGlyphs !== undefined && false; }
  collectGlyph(i, x, y) {
    this.levelGlyphs = (this.levelGlyphs || 0) | (1 << i);
    const s = G.Save.data;
    s.secrets = s.secrets || {};
    s.secrets[this.levelIdx] = (s.secrets[this.levelIdx] || 0) | (1 << i);
    G.Save.store();
    this.addCoins(100, x, y - 8);
    G.Audio.play('secret');
    G.Particles.fx('fx_ring', x, y);
    const n = [...Array(8).keys()].filter((k) => this.levelGlyphs & (1 << k)).length;
    G.UI.toast(`СЕКРЕТНЫЙ МЕДАЛЬОН ${n}/${this.level.glyphCount}`);
  }
  foundSecret(reg) {
    this.levelSecrets = (this.levelSecrets || 0) + 1;
    G.Audio.play('secret');
    const j = reg.tiles[0], L = this.level;
    G.Particles.sparks((j % L.w) * 16 + 8, ((j / L.w) | 0) * 16 + 8, 12, '#fff3a0', 2);
    G.UI.toast(`ТАЙНИК НАЙДЕН! ${this.levelSecrets}/${L.secrets.length}`);
  }
  bossTrack() { return this.levelIdx === G.LEVELS.length - 1 ? 'final' : 'boss'; }
  lifeTaken(s) { return !!(this.takenLives && this.takenLives.has(this.levelIdx + ':' + s.tx + ':' + s.ty)); }

  // ---------------------------------------------------------------- API для сущностей
  spawn(e) { this.entities.push(e); return e; }
  later(frames, fn) { this.timers.push({ t: frames, fn }); }
  shake(a, t) { if (!G.Save.data.shake) return; this.shakeAmt = Math.max(this.shakeAmt, a); this.shakeT = Math.max(this.shakeT, t); }
  hitstop(n) { this.stopT = Math.max(this.stopT, n); }
  flashScreen(color, t) { this.flash = { color, t, max: t }; }
  targets() { return this.entities.filter((e) => e.isEnemy && !e.dead && !e.dying && e.active !== false); }
  platforms() { return this.entities.filter((e) => e.isPlatform && !e.dead); }
  spawnAfterimage(p) {
    G.Particles.add({ kind: 'spr', name: p.frameName(), flip: p.facing < 0, x: p.cx, y: p.bottom, life: 12, layer: 0 });
  }
  addCoins(n, x, y) {
    this.coins += n; this.levelCoins += n; this.totalCoins += n;
    if (x !== undefined) G.Particles.text(x, y, '+' + n, '#ffe060');
  }
  dropCoins(x, y, n) { for (let i = 0; i < n; i++) this.spawn(new G.Coin(x, y, G.rand(-1.6, 1.6), G.rand(-4, -1.8), n >= 6 && i % 5 === 0)); }
  collect(kind, x, y, ent) {
    if (kind === 'heart') {
      const p = this.player;
      if (p.hp < this.stats.maxHp) p.hp = Math.min(this.stats.maxHp, p.hp + 2); else this.addCoins(50, x, y - 6);
      G.Audio.play('heart'); G.Particles.fx('fx_ring', x, y);
    } else if (kind === 'eye') {
      this.eyeMeter = Math.min(100, this.eyeMeter + 40);
      G.Audio.play('heart'); G.Particles.fx('fx_ring', x, y);
    } else if (kind === 'life') {
      this.lives++;
      if (ent && ent.spawnKey) (this.takenLives = this.takenLives || new Set()).add(this.levelIdx + ':' + ent.spawnKey);
      G.Audio.play('heart'); G.Particles.text(x, y - 8, '1UP', '#ffe060');
    } else if (kind === 'ability') {
      const id = G.LEVELS[this.levelIdx].unlock;
      this.abil.add(id);
      this.newAbility = id;
      this.state = 'ability';
      this.stateT = 0;
      G.Audio.play('ability');
      this.flashScreen('#ffe060', 20);
      if (id === 'eye') this.eyeMeter = 100;
    }
  }
  setCheckpoint(x, y) { this.checkpoint = { x, y }; const p = this.player; if (p.hp < this.stats.maxHp) p.hp++; }
  onEnemyKilled(e) {
    if (this.eyeMode <= 0 && this.abil.has('eye')) this.eyeMeter = Math.min(100, this.eyeMeter + (e.meter || 10));
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
    G.Particles.fx('fx_ring', this.player.cx, this.player.y + 4);
  }
  clearHostiles() {
    for (const e of this.entities) {
      if (e.hostile) e.dead = true;
      else if (e.isEnemy && !e.isBoss && !e.dead) { e.dead = true; G.Particles.explosion(e.cx, e.cy); }
    }
  }
  onPlayerDeath() {
    this.lives--;
    if (this.lives < 0) this.fadeTo(() => this.setState('gameover'));
    else this.fadeTo(() => { this.startLevel(this.levelIdx, true); this.setState('intro'); });
  }
  onBossDefeated(b) {
    this.dropCoins(b.cx, b.cy, 30);
    this.level.openGate();
    const def = G.LEVELS[this.levelIdx];
    if (def.unlock && !this.abil.has(def.unlock)) {
      // сфера новой способности появляется в центре арены
      const orb = new G.Pickup('ability', this.arena.x + G.W / 2, this.arena.floor - 40, 0, true);
      orb.baseY = orb.y;
      this.spawn(orb);
      this.waitAbility = true;
    } else this.bossDoneT = 1;
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
      case 'story': G.Audio.music('story'); this.storyI = 0; this.storyT = 0; break;
      case 'play': G.Audio.music(this.bossStarted ? this.bossTrack() : G.LEVELS[this.levelIdx].music); break;
      case 'gameover': G.Audio.stopMusic(); break;
      case 'clear': G.Audio.stopMusic(); G.Audio.play('clear'); break;
      case 'shop': G.Audio.music('shop'); break;
      case 'ending': G.Audio.music('ending'); break;
    }
  }
  fadeTo(cb, speed = 0.06) {
    if (this.fadeCb) return;
    this.fadeTarget = 1; this.fadeSpeed = speed; this.fadeCb = cb;
  }
  newGame(idx = 0) {
    this.resetRun();
    if (idx > 0) {
      // при выборе этапа — компенсация за пропущенные магазины
      this.coins = 350 * idx;
      this.stats.maxHp += Math.min(3, Math.floor(idx / 2));
      this.stats.shot = Math.min(3, 1 + Math.floor(idx / 3));
    }
    this.startLevel(idx);
    this.beginStage();
  }
  beginStage() { this.setState(G.LEVELS[this.levelIdx].story ? 'story' : 'intro'); }

  // ---------------------------------------------------------------- шаг
  step() {
    this.frame++;
    this.time += G.STEP;
    this.stateT++;
    const frozen = this.state === 'play' && this.stopT > 0;
    if (!frozen) G.Input.update();
    if (this.fadeTarget !== this.fadeA) {
      this.fadeA = G.approach(this.fadeA, this.fadeTarget, this.fadeSpeed || 0.06);
      if (this.fadeA === 1 && this.fadeCb) { const cb = this.fadeCb; this.fadeCb = null; cb(); this.fadeTarget = 0; }
    }
    if (this.flash.t > 0) this.flash.t--;
    const was = this.state;
    G.UI.update(this);
    if (this.state === 'play' && was === 'play') this.updatePlay();
    else if (this.state === 'intro') { if (this.stateT > 140 || (this.stateT > 30 && G.Input.pressed('confirm'))) this.setState('play'); }
    else if (this.state === 'title' || this.state === 'ending' || this.state === 'shop') { this.cam.x += 0.5; G.Particles.update(null); }
  }

  updatePlay() {
    const I = G.Input;
    if (this.stopT > 0) { this.stopT--; return; }
    if (I.pressed('pause') && this.player.alive && !this.fadeCb) { this.state = 'pause'; this.menu = { i: 0 }; G.Audio.play('pause'); return; }
    const L = this.level;
    L.update(this);
    for (let i = this.timers.length - 1; i >= 0; i--) if (--this.timers[i].t <= 0) { const f = this.timers[i].fn; this.timers.splice(i, 1); f(); }
    if (this.eyeMode > 0 && --this.eyeMode === 0) G.Audio.play('recall');

    this.hint = null;
    for (const e of this.entities) if (e instanceof G.MovingPlatform) e.update(this);
    if (this.wind && this.player.alive) G.Physics.moveX(this.player, L, this.wind * (this.player.onGround ? 0.6 : 1));
    this.player.update(this);
    for (const e of this.entities) if (!(e instanceof G.MovingPlatform) && !e.dead) e.update(this);
    this.entities = this.entities.filter((e) => !e.dead);
    G.Particles.update(L);

    // вход на арену
    const A = this.arena;
    if (A && !this.bossStarted && A.trigger !== undefined && this.player.alive && this.player.x > A.trigger + 16) {
      this.bossStarted = true;
      L.closeGate();
      this.boss = this.spawn(G.makeBoss(G.LEVELS[this.levelIdx].boss, this));
      G.Audio.music(this.bossTrack());
      G.Audio.play('roar');
      this.shake(4, 30);
      G.UI.bossBanner(this.boss.name);
      for (const e of this.entities) if (e.isEnemy && !e.isBoss && e.x > A.x) e.dead = true;
    }
    if (this.waitAbility && this.abil.has(G.LEVELS[this.levelIdx].unlock)) { this.waitAbility = false; this.bossDoneT = 1; }
    if (this.bossDoneT > 0) {
      this.bossDoneT++;
      if (this.bossDoneT === 40) { this.player.winT = 1; G.Audio.music('ending'); }
      if (this.player.winT > 0) this.player.winT++;
      if (this.bossDoneT === 200) this.fadeTo(() => {
        this.setState('clear');
        const s = G.Save.data;
        s.unlocked = Math.max(s.unlocked, Math.min(G.LEVELS.length, this.levelIdx + 2));
        if (this.levelIdx === G.LEVELS.length - 1) s.cleared = true;
        s.bestCoins = Math.max(s.bestCoins, this.totalCoins);
        G.Save.store();
      });
    }
    this.stuckCheck();
    this.updateCamera();
    if (this.shakeT > 0) this.shakeT--; else this.shakeAmt = 0;
  }

  // Если герой долго не может продвинуться — подсказываем, что делать
  stuckCheck() {
    const p = this.player, L = this.level;
    if (!p.alive || this.bossStarted) { this.stuckT = 0; return; }
    if (p.x > (this.bestX || 0) + 24 || this.stuckX === undefined) { this.bestX = Math.max(this.bestX || 0, p.x); this.stuckX = p.x; this.stuckT = 0; }
    if (Math.abs(p.x - this.stuckX) > 80) { this.stuckX = p.x; this.stuckT = 0; }
    this.stuckT = (this.stuckT || 0) + 1;
    if (this.stuckT < 360 || this.hint) return;
    // что впереди: высокая стена или пропасть?
    const dir = p.facing, fx = dir > 0 ? p.x + p.w + 8 : p.x - 8;
    let wall = 0;
    const ty0 = Math.floor((p.bottom - 1) / 16);
    for (let k = 0; k < 10; k++) { if (L.isSolid(Math.floor(fx / 16), ty0 - k)) wall++; else break; }
    let pit = true;
    for (let k = 0; k < 6; k++) if (L.isSolid(Math.floor((fx + dir * 16) / 16), ty0 + 1 + k)) { pit = false; break; }
    const has = (a) => this.abil.has(a);
    if (wall >= 5 && has('wall')) this.hint = 'Высокая стена: прыгай [Z] от стены к стене';
    else if (wall >= 5 && has('djump') && wall <= 8) this.hint = 'Двойной прыжок: [Z], в воздухе ещё раз [Z]';
    else if (wall >= 5) this.hint = '[C] — брось копьё в стену, запрыгни на него [Z]';
    else if (pit && has('dash')) this.hint = 'Пропасть: прыжок [Z], затем рывок [SHIFT]';
    else if (pit && has('djump')) this.hint = 'Пропасть: разбегись, [Z] и ещё раз [Z] в воздухе';
    else if (pit) this.hint = 'Разбегись и прыгай [Z] — держи дольше, чтобы прыгнуть дальше';
  }

  updateCamera() {
    const p = this.player, L = this.level, A = this.arena;
    this.cam.lx = G.lerp(this.cam.lx, p.facing * 36 + p.vx * 6, 0.04);
    let tx = p.cx - G.W / 2 + this.cam.lx;
    if (this.bossStarted && A) tx = A.x;
    tx = G.clamp(tx, 0, L.w * 16 - G.W);
    if (!this.bossStarted && A) tx = Math.min(tx, A.x);
    // вертикаль: мёртвая зона, чтобы камера не дёргалась на каждом прыжке
    let ty = this.cam.y;
    const top = this.cam.y + G.H * 0.3, bot = this.cam.y + G.H * 0.68;
    if (p.cy < top) ty = p.cy - G.H * 0.3;
    else if (p.cy > bot || (p.onGround && p.cy > this.cam.y + G.H * 0.62)) ty = p.cy - G.H * 0.62;
    if (this.bossStarted) ty = L.h * 16 - G.H;
    ty = G.clamp(ty, 0, L.h * 16 - G.H);
    this.cam.x = G.lerp(this.cam.x, tx, this.bossStarted ? 0.08 : 0.15);
    this.cam.y = G.lerp(this.cam.y, ty, 0.1);
  }

  // ---------------------------------------------------------------- отрисовка
  render() {
    const X = G.Gfx, c = X.ctx;
    X.screen();
    c.fillStyle = '#000';
    c.fillRect(0, 0, G.W, G.H);
    if (this.level && ['play', 'pause', 'intro', 'clear', 'ability', 'story'].includes(this.state)) this.renderWorld();
    G.UI.draw(this);
    X.screen();
    if (this.flash.t > 0) {
      c.globalAlpha = (this.flash.t / this.flash.max) * 0.6;
      c.fillStyle = this.flash.color; c.fillRect(0, 0, G.W, G.H);
      c.globalAlpha = 1;
    }
    if (this.fadeA > 0) {
      // пиксельное затемнение ступенями
      const a = Math.round(this.fadeA * 8) / 8;
      c.fillStyle = `rgba(6,2,12,${a})`; c.fillRect(0, 0, G.W, G.H);
    }
    X.present();
  }

  renderWorld() {
    const X = G.Gfx, c = X.ctx, L = this.level;
    let sx = 0, sy = 0;
    if (this.shakeT > 0 && this.state === 'play') { sx = Math.round((Math.random() - 0.5) * this.shakeAmt * 2); sy = Math.round((Math.random() - 0.5) * this.shakeAmt * 2); }
    const cx = Math.round(this.cam.x) + sx, cy = Math.round(this.cam.y) + sy;
    G.Backgrounds.draw(c, L.theme, cx, cy - (L.h * 16 - G.H), this.time);
    X.world(cx, cy);
    G.Tiles.drawBack(c, L, cx, cy);
    G.Tiles.drawProps(c, L, cx);
    for (const e of this.entities) if (e.layer === 0 && e.onScreen(this)) e.draw(c, this);
    G.Particles.draw(c, 0);
    G.Tiles.drawFront(c, L, cx, cy, this.frame);
    this.bubbles = [];
    for (const e of this.entities) if (e.layer === 1 && e.onScreen(this, 60)) e.draw(c, this);
    this.player.draw(c, this);
    for (const e of this.entities) if (e.layer === 2 && e.onScreen(this, 60)) e.draw(c, this);
    G.Tiles.drawSecrets(c, L, cx, cy, this.frame);
    G.Particles.draw(c, 1);
    this.renderLighting(cx, cy);
    G.Backgrounds.overlay(c, L.theme, cx, this.time);
    X.world(cx, cy);
    G.Particles.draw(c, 2);
    for (const b of this.bubbles) this.drawBubble(b);
    X.screen();
    if (this.eyeMode > 0) {
      // зелёная рамка-виньетка режима глаза
      c.fillStyle = 'rgba(60,255,150,0.18)';
      c.fillRect(0, 0, G.W, 4); c.fillRect(0, G.H - 4, G.W, 4); c.fillRect(0, 0, 4, G.H); c.fillRect(G.W - 4, 0, 4, G.H);
    }
  }

  drawBubble(b) {
    const X = G.Gfx;
    const w = X.textWidth(b.text) + 14;
    const bx = Math.round(G.clamp(b.x - w / 2, this.cam.x + 4, this.cam.x + G.W - w - 4));
    const by = Math.round(b.y - 22);
    X.frame(bx, by, w, 20);
    X.text(b.text, bx + 7, by + 6, { color: '#fff3c8', shadow: false });
  }

  // Темнота пещер: маска 480×270 с «дырками» от источников света
  renderLighting(cx, cy) {
    const L = this.level;
    if (!L.cfg.dark) return;
    const cv = this.lightCv, lc = cv.getContext('2d');
    lc.globalCompositeOperation = 'source-over';
    lc.clearRect(0, 0, G.W, G.H);
    lc.fillStyle = 'rgba(4,0,14,0.72)';
    lc.fillRect(0, 0, G.W, G.H);
    lc.globalCompositeOperation = 'destination-out';
    const hole = (x, y, r, a = 1) => {
      const sx = Math.round(x - cx), sy = Math.round(y - cy);
      if (sx < -r || sx > G.W + r || sy < -r || sy > G.H + r) return;
      // ступенчатые кольца — пиксельный свет без гладких градиентов
      for (let k = 4; k >= 1; k--) {
        lc.fillStyle = `rgba(0,0,0,${(a * (5 - k)) / 5})`;
        lc.beginPath();
        lc.arc(sx, sy, (r * k) / 4, 0, Math.PI * 2);
        lc.fill();
      }
    };
    const p = this.player;
    hole(p.cx, p.cy - 4, 96 + (this.eyeMode > 0 ? 40 : 0));
    for (const l of L.lights) hole(l.x, l.y, l.r, 0.85);
    for (const e of this.entities) {
      if (e instanceof G.EyeShot) hole(e.cx, e.cy, e.charged ? 50 : 30, 0.8);
      else if (e instanceof G.EnemyShot) hole(e.cx, e.cy, 22, 0.7);
      else if (e.isBoss) hole(e.cx, e.cy, 110, 0.9);
      else if (e instanceof G.Crystal || e instanceof G.Torch) hole(e.cx, e.cy, 40, 0.8);
    }
    const c = G.Gfx.ctx;
    G.Gfx.screen();
    c.drawImage(cv, 0, 0);
    G.Gfx.world(cx, cy);
  }
};
