'use strict';
// Мир: тайловая карта, сборка уровня из кусков и физика столкновений.
const T_ = G.TILE;
G.T = {
  EMPTY: 0, SOLID: 1, ONEWAY: 2, BRICK: 3, SPIKE: 4, SPIKE_DOWN: 5,
  BONUS: 6, USED: 7, CRUMBLE: 8, LAVA: 9, GATE: 10,
};
const TT = G.T;
const SOLID_SET = new Set([TT.SOLID, TT.BRICK, TT.SPIKE, TT.SPIKE_DOWN, TT.BONUS, TT.USED, TT.CRUMBLE, TT.GATE]);

G.Level = class Level {
  constructor(def) {
    this.def = def;
    this.theme = def.theme;
    const H = (this.h = G.LEVEL_H);
    const parts = def.chunks.map((n) => {
      const rows = G.CHUNKS[n];
      if (!rows) throw new Error('Нет куска ' + n);
      return { name: n, rows, w: Math.max(...rows.map((r) => r.length)) };
    });
    const W = (this.w = parts.reduce((a, p) => a + p.w, 0));
    this.tiles = new Uint8Array(W * H);
    this.spawns = [];
    this.bonus = new Map();   // содержимое бонус-блоков
    this.bump = new Map();    // анимация подскока блоков
    this.crumble = new Map(); // таймеры осыпающихся плит
    this.lights = [];         // факелы и кристаллы
    this.start = { x: 32, y: 0 };
    this.arena = null;
    let ox = 0, sign = 0;
    for (const p of parts) {
      const oy = H - p.rows.length;
      if (p.name.startsWith('arena')) this.arena = { x: ox * T_, tx: ox, w: p.w };
      p.rows.forEach((row, ry) => {
        for (let rx = 0; rx < p.w; rx++) {
          const ch = row[rx] || '.';
          const tx = ox + rx, ty = oy + ry;
          const wx = tx * T_, wy = ty * T_;
          const set = (t) => (this.tiles[ty * W + tx] = t);
          switch (ch) {
            case '#': set(TT.SOLID); break;
            case '=': set(TT.ONEWAY); break;
            case 'B': set(TT.BRICK); break;
            case '^': set(TT.SPIKE); break;
            case 'v': set(TT.SPIKE_DOWN); break;
            case 'F': set(TT.CRUMBLE); break;
            case '~': set(TT.LAVA); break;
            case '?': set(TT.BONUS); this.bonus.set(ty * W + tx, 'coin'); break;
            case '!': set(TT.BONUS); this.bonus.set(ty * W + tx, 'heart'); break;
            case '*': set(TT.BONUS); this.bonus.set(ty * W + tx, 'eye'); break;
            case 'P': this.start = { x: wx + 8, y: wy + T_ }; break;
            case 'X': this.arena && (this.arena.trigger = wx); break;
            case 'T': this.spawns.push({ type: 'sign', x: wx + 8, y: wy + T_, text: (def.signs || [])[sign++] || '' }); break;
            case 'i': this.lights.push({ x: wx + 8, y: wy + 8, r: 70, kind: 'torch' }); this.spawns.push({ type: 'torch', x: wx + 8, y: wy + T_ }); break;
            case '.': break;
            default: {
              const types = { o: 'coin', O: 'bigcoin', H: 'heart', e: 'eye', K: 'checkpoint', S: 'spring', M: 'hplat', N: 'vplat', w: 'imp', b: 'bat', f: 'frog', t: 'head', h: 'hedgehog', g: 'ghost', p: 'flame' };
              if (types[ch]) this.spawns.push({ type: types[ch], x: wx + 8, y: wy + T_, tx, ty });
            }
          }
        }
      });
      ox += p.w;
    }
    this.decorate();
  }

  // Случайный декор (трава, кристаллы, факелы) — детерминированно по координатам
  decorate() {
    this.deco = [];
    const r = G.rng(this.def.id * 977);
    for (let tx = 0; tx < this.w; tx++) {
      for (let ty = 1; ty < this.h; ty++) {
        if (this.get(tx, ty) !== TT.SOLID || this.get(tx, ty - 1) !== TT.EMPTY) continue;
        const v = r();
        if (this.theme === 'cave' && v < 0.08) {
          this.deco.push({ kind: 'crystal', x: tx * T_ + 8, y: ty * T_, s: 0.7 + r() * 0.8, hue: r() });
          this.lights.push({ x: tx * T_ + 8, y: ty * T_ - 6, r: 60, kind: 'crystal' });
        } else if ((this.theme === 'ruins' || this.theme === 'temple') && v < 0.025 && ty > 12) {
          this.spawns.push({ type: 'torch', x: tx * T_ + 8, y: ty * T_ });
          this.lights.push({ x: tx * T_ + 8, y: ty * T_ - 20, r: 70, kind: 'torch' });
        } else if (this.theme === 'volcano' && v < 0.05) {
          this.deco.push({ kind: 'ember', x: tx * T_ + 8, y: ty * T_ });
        } else if (v < 0.22 && this.theme !== 'cave') {
          this.deco.push({ kind: 'tuft', x: tx * T_ + r() * 16, y: ty * T_, s: 0.6 + r() * 0.6, v: r() });
        }
      }
    }
  }

  idx(tx, ty) { return ty * this.w + tx; }
  get(tx, ty) {
    if (tx < 0 || tx >= this.w) return TT.SOLID;
    if (ty < 0 || ty >= this.h) return TT.EMPTY;
    return this.tiles[ty * this.w + tx];
  }
  set(tx, ty, t) {
    if (tx < 0 || tx >= this.w || ty < 0 || ty >= this.h) return;
    this.tiles[ty * this.w + tx] = t;
  }
  isSolid(tx, ty) { return SOLID_SET.has(this.get(tx, ty)); }
  solidAt(px, py) { return this.isSolid(Math.floor(px / T_), Math.floor(py / T_)); }
  tileAt(px, py) { return this.get(Math.floor(px / T_), Math.floor(py / T_)); }

  // Удар головой или выстрелом по блоку
  hitBlock(tx, ty, game, byHead) {
    const t = this.get(tx, ty);
    const i = this.idx(tx, ty);
    if (t === TT.BONUS) {
      this.set(tx, ty, TT.USED);
      this.bump.set(i, 10);
      const what = this.bonus.get(i) || 'coin';
      const x = tx * T_ + 8, y = ty * T_;
      if (what === 'coin') {
        game.addCoins(10, x, y - 8);
        game.spawn(new G.CoinPop(x, y));
      } else if (what === 'heart') game.spawn(new G.Pickup('heart', x, y - 2, -3.5));
      else game.spawn(new G.Pickup('eye', x, y - 2, -3.5));
      G.Audio.play(what === 'coin' ? 'coin' : 'heart');
      G.Particles.sparks(x, y, 6, '#ffe890', 2);
      return true;
    }
    if (t === TT.BRICK) {
      this.set(tx, ty, TT.EMPTY);
      const pal = G.Tiles.pal(this.theme);
      G.Particles.debris(tx * T_ + 8, ty * T_ + 8, 8, [pal.brick, G.shade(pal.brick, -0.3), G.shade(pal.brick, 0.2)]);
      G.Audio.play('brick');
      game.shake(2, 6);
      // кирпич иногда прячет монетку
      if (G.hash2(tx, ty) < 0.3) game.spawn(new G.Coin(tx * T_ + 8, ty * T_ + 8, G.rand(-1, 1), -3));
      return true;
    }
    if (byHead && (t === TT.USED || t === TT.SOLID)) G.Audio.play('bump');
    return false;
  }

  touchCrumble(tx, ty) {
    const i = this.idx(tx, ty);
    if (!this.crumble.has(i)) {
      this.crumble.set(i, { t: 0, tx, ty, gone: false });
      G.Audio.play('crumble');
    }
  }

  update(game) {
    for (const [i, v] of this.bump) {
      if (v <= 1) this.bump.delete(i);
      else this.bump.set(i, v - 1);
    }
    for (const [i, c] of this.crumble) {
      c.t++;
      if (!c.gone && c.t === 44) {
        c.gone = true;
        this.set(c.tx, c.ty, TT.EMPTY);
        const pal = G.Tiles.pal(this.theme);
        G.Particles.debris(c.tx * T_ + 8, c.ty * T_ + 6, 6, [pal.base, pal.dark, pal.top], 1.5);
      }
      if (c.gone && c.t > 44 + 220) {
        const p = game.player;
        const box = { x: c.tx * T_, y: c.ty * T_, w: T_, h: T_ };
        if (!p || !G.overlap(p, box)) {
          this.set(c.tx, c.ty, TT.CRUMBLE);
          this.crumble.delete(i);
          G.Particles.ring(c.tx * T_ + 8, c.ty * T_ + 8, '#ffffff', 10, 14);
        }
      }
    }
  }

  closeGate() {
    const a = this.arena;
    if (!a) return;
    for (let ty = 0; ty < this.h; ty++) {
      if (this.get(a.tx, ty) === TT.EMPTY) this.set(a.tx, ty, TT.GATE);
    }
  }
  openGate() {
    const a = this.arena;
    if (!a) return;
    for (let ty = 0; ty < this.h; ty++) if (this.get(a.tx, ty) === TT.GATE) this.set(a.tx, ty, TT.EMPTY);
  }
};

// --- Физика тел -------------------------------------------------------------
G.Physics = {
  moveX(b, level, dx) {
    if (!dx) return;
    b.x += dx;
    const y0 = Math.floor(b.y / T_), y1 = Math.floor((b.y + b.h - 0.01) / T_);
    if (dx > 0) {
      const tx = Math.floor((b.x + b.w - 0.001) / T_);
      for (let ty = y0; ty <= y1; ty++) if (level.isSolid(tx, ty)) { b.x = tx * T_ - b.w; b.hitR = true; b.wallTile = [tx, ty]; return; }
    } else {
      const tx = Math.floor(b.x / T_);
      for (let ty = y0; ty <= y1; ty++) if (level.isSolid(tx, ty)) { b.x = (tx + 1) * T_; b.hitL = true; b.wallTile = [tx, ty]; return; }
    }
  },
  moveY(b, level, dy) {
    const prevBottom = b.y + b.h;
    b.y += dy;
    const x0 = Math.floor(b.x / T_), x1 = Math.floor((b.x + b.w - 0.01) / T_);
    if (dy >= 0) {
      const ty = Math.floor((b.y + b.h) / T_);
      for (let tx = x0; tx <= x1; tx++) {
        const t = level.get(tx, ty);
        if (SOLID_SET.has(t) || (t === TT.ONEWAY && prevBottom <= ty * T_ + 0.5 && !b.dropping)) {
          b.y = ty * T_ - b.h;
          b.onGround = true;
          b.groundTile = t;
          b.groundTx = tx;
          b.groundTy = ty;
          if (t === TT.CRUMBLE && b.isPlayer) level.touchCrumble(tx, ty);
          // если хотя бы под одной ногой не плита — всё равно отметим её
          if (t !== TT.CRUMBLE && b.isPlayer) {
            for (let k = tx + 1; k <= x1; k++) if (level.get(k, ty) === TT.CRUMBLE) level.touchCrumble(k, ty);
          }
          return true;
        }
      }
    } else {
      const ty = Math.floor(b.y / T_);
      b.headHits = [];
      let up = false;
      for (let tx = x0; tx <= x1; tx++) {
        if (level.isSolid(tx, ty)) {
          b.headHits.push(tx);
          up = true;
        }
      }
      if (up) { b.hitU = true; b.y = (ty + 1) * T_; b.headTy = ty; return true; }
    }
    return false;
  },
  // Полный шаг тела с гравитацией
  step(b, level) {
    b.hitL = b.hitR = b.hitU = false;
    b.wasGround = b.onGround;
    b.onGround = false;
    this.moveX(b, level, b.vx);
    const hit = this.moveY(b, level, b.vy);
    if (hit) b.vy = 0;
  },
  // Проверка «есть ли земля впереди» — чтобы враги не падали с обрывов
  groundAhead(b, level, dir) {
    const fx = dir > 0 ? b.x + b.w + 1 : b.x - 1;
    const fy = b.y + b.h + 2;
    const t = level.tileAt(fx, fy);
    return SOLID_SET.has(t) || t === TT.ONEWAY;
  },
};
