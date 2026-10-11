'use strict';
// Мир: тайловая карта, сборка уровня из кусков и физика столкновений.
const T_ = G.TILE;
G.T = {
  EMPTY: 0, SOLID: 1, ONEWAY: 2, BRICK: 3, SPIKE: 4, SPIKE_DOWN: 5, BONUS: 6, USED: 7,
  CRUMBLE: 8, LIQUID: 9, GATE: 10, HEAVY: 11, CRACKED: 12, ICE: 13,
};
const TT = G.T;
const SOLID_SET = new Set([TT.SOLID, TT.BRICK, TT.SPIKE, TT.SPIKE_DOWN, TT.BONUS, TT.USED, TT.CRUMBLE, TT.GATE, TT.HEAVY, TT.CRACKED, TT.ICE]);
G.SOLID_SET = SOLID_SET;

// Темы: жидкость (hurt — ранит, swim — можно плавать) и цвета обломков
G.THEMES = {
  city: { liquid: null, debris: ['#8a7c86', '#5e5262', '#c9b6a0'], dark: false },
  sewer: { liquid: 'hurt', debris: ['#3e6a62', '#2a4a44', '#6a8a6a'], dark: false },
  ruins: { liquid: 'swim', debris: ['#8a7c5a', '#5a5040', '#6aa048'], dark: false },
  cave: { liquid: 'hurt', debris: ['#5a4a86', '#3a2e5a', '#5ef0ff'], dark: true },
  ice: { liquid: 'hurt', debris: ['#c8e0f0', '#8ab0d0', '#ffffff'], dark: false },
  volcano: { liquid: 'hurt', debris: ['#4e3430', '#2a1c1a', '#ff7a20'], dark: false },
  sky: { liquid: null, debris: ['#f0ecf8', '#c8c0d8', '#e8c060'], dark: false },
  temple: { liquid: 'hurt', debris: ['#5e4e84', '#3a3060', '#e8c060'], dark: false },
};

const ENEMY_CHARS = {
  w: 'imp', b: 'bat', f: 'frog', t: 'head', h: 'hedgehog', g: 'ghost', p: 'flame', r: 'rat', l: 'slime',
  y: 'yeti', q: 'penguin', k: 'knight', m: 'monk', n: 'drone', a: 'harpy', x: 'crow', j: 'fish', c: 'crystal', s: 'spiderling',
};
const ITEM_CHARS = { o: 'coin', O: 'bigcoin', '$': 'bigcoin', H_: 'heart', e: 'eye', K: 'checkpoint', S: 'spring', M: 'hplat', N: 'vplat', L: 'life', U: 'fan' };

G.Level = class Level {
  constructor(def) {
    this.def = def;
    this.theme = def.theme;
    this.cfg = G.THEMES[def.theme];
    const parts = def.chunks.map((n) => {
      const rows = G.CHUNKS[n];
      if (!rows) throw new Error('Нет куска ' + n);
      return { name: n, rows, w: Math.max(...rows.map((r) => r.length)) };
    });
    const H = (this.h = Math.max(17, ...parts.map((p) => p.rows.length)));
    const W = (this.w = parts.reduce((a, p) => a + p.w, 0));
    this.tiles = new Uint8Array(W * H);
    this.bg = new Uint8Array(W * H);
    this.spawns = [];
    this.bonus = new Map();
    this.bump = new Map();
    this.crumble = new Map();
    this.lights = [];
    this.props = [];
    this.start = { x: 32, y: (H - 3) * T_ };
    this.arena = null;
    let ox = 0, sign = 0;
    for (const p of parts) {
      const oy = H - p.rows.length;
      if (p.name.startsWith('arena')) this.arena = { x: ox * T_, tx: ox, w: p.w };
      p.rows.forEach((row, ry) => {
        for (let rx = 0; rx < p.w; rx++) {
          const ch = row[rx] || '.';
          const tx = ox + rx, ty = oy + ry, i = ty * W + tx;
          const wx = tx * T_, wy = ty * T_;
          const set = (t) => (this.tiles[i] = t);
          switch (ch) {
            case '#': set(TT.SOLID); break;
            case '=': set(TT.ONEWAY); break;
            case 'B': set(TT.BRICK); break;
            case 'X': set(TT.HEAVY); break;
            case 'Z': set(TT.CRACKED); break;
            case 'I': set(TT.ICE); break;
            case '^': set(TT.SPIKE); break;
            case 'v': set(TT.SPIKE_DOWN); break;
            case 'F': set(TT.CRUMBLE); break;
            case '~': set(TT.LIQUID); break;
            case ':': this.bg[i] = 1; break;
            case '?': set(TT.BONUS); this.bonus.set(i, 'coin'); break;
            case '!': set(TT.BONUS); this.bonus.set(i, 'heart'); break;
            case '*': set(TT.BONUS); this.bonus.set(i, 'eye'); break;
            case '&': set(TT.BONUS); this.bonus.set(i, 'life'); break;
            case 'P': this.start = { x: wx + 8, y: wy + T_ }; break;
            case '@': if (this.arena) this.arena.trigger = wx; break;
            case 'T': this.spawns.push({ type: 'sign', x: wx + 8, y: wy + T_, text: (def.signs || [])[sign++] || '' }); break;
            case 'i': this.spawns.push({ type: 'torch', x: wx + 8, y: wy + T_ }); this.lights.push({ x: wx + 8, y: wy + 2, r: 60 }); break;
            case 'D': this.spawns.push({ type: 'prop', x: wx + 8, y: wy + T_ }); break;
            case 'H': this.spawns.push({ type: 'heart', x: wx + 8, y: wy + T_ }); break;
            case '.': break;
            default:
              if (ENEMY_CHARS[ch]) this.spawns.push({ type: ENEMY_CHARS[ch], x: wx + 8, y: wy + T_, tx, ty, enemy: true });
              else if (ITEM_CHARS[ch]) this.spawns.push({ type: ITEM_CHARS[ch], x: wx + 8, y: wy + T_, tx, ty });
          }
        }
      });
      ox += p.w;
    }
    // задняя стена под сущностями внутри «интерьеров»: пустые клетки между клетками стены
    for (let ty = 0; ty < H; ty++) {
      for (let tx = 1; tx < W - 1; tx++) {
        const i = ty * W + tx;
        if (this.bg[i]) continue;
        let l = tx - 1, r = tx + 1;
        while (l >= 0 && !this.bg[ty * W + l] && !SOLID_SET.has(this.tiles[ty * W + l]) && tx - l < 4) l--;
        while (r < W && !this.bg[ty * W + r] && !SOLID_SET.has(this.tiles[ty * W + r]) && r - tx < 4) r++;
        const lb = l >= 0 && (this.bg[ty * W + l] || SOLID_SET.has(this.tiles[ty * W + l]));
        const rb = r < W && (this.bg[ty * W + r] || SOLID_SET.has(this.tiles[ty * W + r]));
        const lw = l >= 0 && this.bg[ty * W + l], rw = r < W && this.bg[ty * W + r];
        if (lb && rb && (lw || rw) && (this.bg[(ty - 1) * W + tx] || this.bg[(ty + 1) * W + tx])) this.bg[i] = 2;
      }
    }
    for (let i = 0; i < this.bg.length; i++) if (this.bg[i] === 2) this.bg[i] = 1;
    this.decorate();
  }

  // Случайные пропсы на поверхностях (детерминированно)
  decorate() {
    const names = Object.keys(G.Art.defs).filter((n) => n.startsWith(`d_${this.theme}_`));
    const r = G.rng(this.def.id * 7919 + 13);
    const taken = new Set(this.spawns.map((s) => Math.floor(s.x / T_) + ',' + Math.floor((s.y - 1) / T_)));
    const place = (tx, ty, forced) => {
      if (!names.length) return;
      const name = names[Math.floor(r() * names.length)];
      const [w, h] = G.Art.size(name);
      const need = Math.ceil(h / T_);
      for (let k = 1; k <= need; k++) if (this.get(tx, ty - k) !== TT.EMPTY && !forced) return;
      if (w > 20 && (this.get(tx - 1, ty) !== TT.SOLID || this.get(tx + 1, ty) !== TT.SOLID) && !forced) return;
      this.props.push({ name, x: tx * T_ + 8, y: ty * T_, flip: r() < 0.5 });
      if (/crystal|torch|lamp|neon|brazier|candle|glow|fire|ember|mushroom/.test(name)) this.lights.push({ x: tx * T_ + 8, y: ty * T_ - h / 2, r: 50 });
    };
    for (const s of this.spawns) if (s.type === 'prop') place(Math.floor(s.x / T_), Math.floor(s.y / T_), true);
    const density = this.def.decor || 0.09;
    let last = -10;
    for (let tx = 2; tx < this.w - 2; tx++) {
      if (this.arena && tx >= this.arena.tx) break;
      for (let ty = 2; ty < this.h; ty++) {
        if (this.get(tx, ty) !== TT.SOLID || this.get(tx, ty - 1) !== TT.EMPTY) continue;
        if (taken.has(tx + ',' + (ty - 1)) || tx - last < 3) continue;
        if (r() < density) { place(tx, ty, false); last = tx; }
      }
    }
  }

  idx(tx, ty) { return ty * this.w + tx; }
  get(tx, ty) {
    if (tx < 0 || tx >= this.w) return TT.SOLID;
    if (ty < 0) return TT.EMPTY;
    if (ty >= this.h) return this.get(tx, this.h - 1) === TT.LIQUID ? TT.LIQUID : TT.EMPTY;
    return this.tiles[ty * this.w + tx];
  }
  set(tx, ty, t) { if (tx >= 0 && tx < this.w && ty >= 0 && ty < this.h) this.tiles[ty * this.w + tx] = t; }
  isSolid(tx, ty) { return SOLID_SET.has(this.get(tx, ty)); }
  solidAt(px, py) { return this.isSolid(Math.floor(px / T_), Math.floor(py / T_)); }
  tileAt(px, py) { return this.get(Math.floor(px / T_), Math.floor(py / T_)); }
  isBg(tx, ty) { return tx >= 0 && tx < this.w && ty >= 0 && ty < this.h && this.bg[ty * this.w + tx] === 1; }

  // разрушение тайла с обломками
  breakTile(tx, ty, game) {
    this.set(tx, ty, TT.EMPTY);
    G.Particles.debris(tx * T_ + 8, ty * T_ + 8, 8, this.cfg.debris);
    G.Particles.fx('fx_puff', tx * T_ + 8, ty * T_ + 8);
    G.Audio.play('brick');
    game.shake(2, 6);
  }
  // Удар по блоку: by — 'head' | 'shot' | 'spear' | 'pound' | 'dash'
  hitBlock(tx, ty, game, by) {
    const t = this.get(tx, ty), i = this.idx(tx, ty);
    if (t === TT.BONUS) {
      this.set(tx, ty, TT.USED);
      this.bump.set(i, 10);
      const what = this.bonus.get(i) || 'coin';
      const x = tx * T_ + 8, y = ty * T_;
      if (what === 'coin') { game.addCoins(10, x, y - 8); game.spawn(new G.CoinPop(x, y)); G.Audio.play('coin'); }
      else { game.spawn(new G.Pickup(what, x, y - 2, -3.2)); G.Audio.play('heart'); }
      G.Particles.sparks(x, y, 5, '#ffe890', 1.6);
      return true;
    }
    if (t === TT.BRICK && by !== 'dash') {
      this.breakTile(tx, ty, game);
      // копьё и выстрел обрушивают и соседние кирпичи сверху/снизу
      if (by === 'spear' || by === 'shot') for (const dy of [-1, 1]) if (this.get(tx, ty + dy) === TT.BRICK) this.breakTile(tx, ty + dy, game);
      if (G.hash2(tx, ty) < 0.3) game.spawn(new G.Coin(tx * T_ + 8, ty * T_ + 8, G.rand(-1, 1), -2.6));
      return true;
    }
    if (t === TT.HEAVY && by === 'pound') { this.breakTile(tx, ty, game); game.shake(4, 10); return true; }
    if (t === TT.CRACKED && (by === 'dash' || by === 'pound')) { this.breakTile(tx, ty, game); return true; }
    if (by === 'head' && SOLID_SET.has(t)) G.Audio.play('bump');
    return false;
  }

  touchCrumble(tx, ty) {
    const i = this.idx(tx, ty);
    if (!this.crumble.has(i)) { this.crumble.set(i, { t: 0, tx, ty, gone: false }); G.Audio.play('crumble'); }
  }

  update(game) {
    for (const [i, v] of this.bump) { if (v <= 1) this.bump.delete(i); else this.bump.set(i, v - 1); }
    for (const [i, c] of this.crumble) {
      c.t++;
      if (!c.gone && c.t === 44) {
        c.gone = true;
        this.set(c.tx, c.ty, TT.EMPTY);
        G.Particles.debris(c.tx * T_ + 8, c.ty * T_ + 4, 6, this.cfg.debris, 1.2);
      }
      if (c.gone && c.t > 44 + 220) {
        const p = game.player;
        if (!p || !G.overlap(p, { x: c.tx * T_, y: c.ty * T_, w: T_, h: T_ })) { this.set(c.tx, c.ty, TT.CRUMBLE); this.crumble.delete(i); }
      }
    }
  }

  closeGate() {
    const a = this.arena;
    if (!a) return;
    for (let ty = 0; ty < this.h; ty++) if (this.get(a.tx, ty) === TT.EMPTY) this.set(a.tx, ty, TT.GATE);
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
          b.groundTy = ty;
          if (b.isPlayer) for (let k = x0; k <= x1; k++) {
            const tk = level.get(k, ty);
            if (tk === TT.CRUMBLE) level.touchCrumble(k, ty);
            if (tk === TT.ICE) b.groundTile = TT.ICE;
          }
          return true;
        }
      }
    } else {
      const ty = Math.floor(b.y / T_);
      b.headHits = [];
      let up = false;
      for (let tx = x0; tx <= x1; tx++) if (level.isSolid(tx, ty)) { b.headHits.push(tx); up = true; }
      if (up) { b.hitU = true; b.y = (ty + 1) * T_; b.headTy = ty; return true; }
    }
    return false;
  },
  step(b, level) {
    b.hitL = b.hitR = b.hitU = false;
    b.wasGround = b.onGround;
    b.onGround = false;
    this.moveX(b, level, b.vx);
    if (this.moveY(b, level, b.vy)) b.vy = 0;
  },
  groundAhead(b, level, dir) {
    const t = level.tileAt(dir > 0 ? b.x + b.w + 1 : b.x - 1, b.y + b.h + 2);
    return SOLID_SET.has(t) || t === TT.ONEWAY;
  },
};
