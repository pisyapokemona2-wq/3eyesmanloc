'use strict';
// Герой — мальчик Мицу с третьим глазом. Рисуется векторно по «скелету»,
// поэтому анимации плавные и чёткие при любом разрешении.
const HERO = {
  skin: '#f8c89a', skinShade: '#d89a70', outline: '#1a1020', hair: '#1c1424', hairHi: '#3a2c48',
  coat: '#2e3e92', coatHi: '#4a5cc0', coatDark: '#1e2866', collar: '#eef0f8', shorts: '#26306a',
  sock: '#f2f2f2', shoe: '#e03a3a', shoeHi: '#ff8a7a', sole: '#ffffff', button: '#ffd040',
  eye3: '#3aff8a', eye3glow: '#8affc0', spear: '#d42a2a', spearHi: '#ff7a6a', gold: '#ffc83a',
};

function heroHead(c, hx, hy, p) {
  const O = HERO.outline;
  const X = G.Gfx;
  // волосы (задняя «шапка»)
  X.circle(c, hx - 1.3, hy - 1.2, 9.3, HERO.hair, O, 1);
  // торчащие пряди
  c.fillStyle = HERO.hair;
  c.strokeStyle = O; c.lineWidth = 0.9;
  c.beginPath();
  c.moveTo(hx - 9.5, hy - 2); c.lineTo(hx - 13, hy - 4.5); c.lineTo(hx - 9.6, hy - 5.6);
  c.lineTo(hx - 11.8, hy - 9); c.lineTo(hx - 7.4, hy - 8.6); c.lineTo(hx - 7.8, hy - 12.4); c.lineTo(hx - 3.6, hy - 10);
  c.closePath(); c.fill(); c.stroke();
  // лицо
  X.ellipse(c, hx + 1.4, hy + 1.2, 7.9, 7.6, 0, HERO.skin, O, 1);
  // чёлка поверх лба
  c.fillStyle = HERO.hair;
  c.beginPath();
  c.moveTo(hx - 6.5, hy - 3);
  c.quadraticCurveTo(hx - 3, hy - 9.6, hx + 4.5, hy - 8.4);
  c.lineTo(hx + 1.2, hy - 6.9);
  c.lineTo(hx - 0.5, hy - 5.2);
  c.lineTo(hx - 2.8, hy - 6.2);
  c.lineTo(hx - 4.6, hy - 2.4);
  c.closePath(); c.fill();
  c.fillStyle = HERO.hairHi;
  c.fillRect(hx - 4.5, hy - 8.2, 3, 0.9);
  // ухо
  X.ellipse(c, hx - 3.4, hy + 1.6, 1.8, 2.4, 0, HERO.skin, O, 0.8);
  c.strokeStyle = HERO.skinShade; c.lineWidth = 0.6;
  c.beginPath(); c.arc(hx - 3.3, hy + 1.6, 1, -1, 1.5); c.stroke();
  // румянец
  c.fillStyle = 'rgba(255,110,120,0.38)';
  c.beginPath(); c.ellipse(hx + 4.4, hy + 4.4, 1.9, 1.1, 0, 0, 7); c.fill();
  // обычные глаза
  const ex1 = hx + 3.2, ex2 = hx + 7.1, ey = hy + 1.1;
  if (p.dead || p.hurt) {
    c.strokeStyle = O; c.lineWidth = 1;
    for (const ex of [ex1, ex2]) {
      c.beginPath();
      if (p.dead) { c.moveTo(ex - 1.3, ey - 1.3); c.lineTo(ex + 1.3, ey + 1.3); c.moveTo(ex + 1.3, ey - 1.3); c.lineTo(ex - 1.3, ey + 1.3); }
      else { c.moveTo(ex - 1.2, ey - 1.4); c.lineTo(ex + 1, ey); c.lineTo(ex - 1.2, ey + 1.4); }
      c.stroke();
    }
  } else if (p.blink) {
    c.strokeStyle = O; c.lineWidth = 0.9;
    c.beginPath(); c.moveTo(ex1 - 1.4, ey + 0.4); c.quadraticCurveTo(ex1, ey + 1.2, ex1 + 1.4, ey + 0.4); c.stroke();
    c.beginPath(); c.moveTo(ex2 - 1.1, ey + 0.4); c.quadraticCurveTo(ex2, ey + 1.1, ex2 + 1.1, ey + 0.4); c.stroke();
  } else {
    X.ellipse(c, ex1, ey, 1.65, 2.35, 0, '#ffffff', O, 0.7);
    X.ellipse(c, ex2, ey, 1.3, 2.2, 0, '#ffffff', O, 0.7);
    const lx = p.lookY || 0;
    X.circle(c, ex1 + 0.5, ey + 0.2 + lx, 1.05, '#2a1a3a');
    X.circle(c, ex2 + 0.4, ey + 0.2 + lx, 0.95, '#2a1a3a');
    c.fillStyle = '#fff';
    c.fillRect(ex1 + 0.4, ey - 0.8 + lx, 0.6, 0.6);
    c.fillRect(ex2 + 0.3, ey - 0.8 + lx, 0.5, 0.5);
  }
  // брови
  c.strokeStyle = O; c.lineWidth = 0.8;
  const angry = p.charge > 0.2 || p.eyeMode;
  c.beginPath();
  c.moveTo(ex1 - 1.5, ey - 3.1 + (angry ? -0.4 : 0)); c.lineTo(ex1 + 1.4, ey - 3.3 + (angry ? 0.5 : 0));
  c.moveTo(ex2 - 1.1, ey - 3.3 + (angry ? 0.5 : 0)); c.lineTo(ex2 + 1.2, ey - 3.1 + (angry ? -0.3 : 0));
  c.stroke();
  // нос и рот
  c.beginPath(); c.moveTo(hx + 9.1, hy + 2.3); c.quadraticCurveTo(hx + 9.9, hy + 3.4, hx + 8.9, hy + 3.9); c.stroke();
  if (p.dead || p.hurt) {
    X.ellipse(c, hx + 6, hy + 5.6, 1.2, 1.5, 0, '#6a1a2a', O, 0.7);
  } else if (p.shoot || p.eyeMode) {
    c.fillStyle = '#6a1a2a';
    c.beginPath(); c.moveTo(hx + 4.2, hy + 5); c.lineTo(hx + 7.8, hy + 4.8); c.quadraticCurveTo(hx + 6.2, hy + 7.6, hx + 4.2, hy + 5); c.fill(); c.stroke();
  } else {
    c.beginPath(); c.moveTo(hx + 4.4, hy + 5.1); c.quadraticCurveTo(hx + 6, hy + 6.3, hx + 7.4, hy + 4.8); c.stroke();
  }
  // ТРЕТИЙ ГЛАЗ
  const tx = hx + 4.4, ty = hy - 4.4;
  let open = p.eye3 === undefined ? 0.45 : p.eye3;
  if (p.dead) open = 0;
  const glowA = Math.min(1, (p.charge || 0) * 0.8 + (p.shoot ? 0.6 : 0) + (p.eyeMode ? 0.9 : 0));
  if (glowA > 0.05) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    X.glow(c, tx, ty, 6 + glowA * 7, HERO.eye3glow, glowA * 0.45);
    c.restore();
  }
  if (open < 0.08) {
    c.strokeStyle = HERO.skinShade; c.lineWidth = 0.9;
    c.beginPath(); c.moveTo(tx - 2, ty); c.quadraticCurveTo(tx, ty + 0.8, tx + 2, ty); c.stroke();
  } else {
    const hw = 2.3, hh = 2.1 * open;
    c.beginPath();
    c.moveTo(tx - hw, ty);
    c.quadraticCurveTo(tx, ty - hh * 1.4, tx + hw, ty);
    c.quadraticCurveTo(tx, ty + hh * 1.4, tx - hw, ty);
    c.closePath();
    c.fillStyle = '#fffff4'; c.fill();
    c.save(); c.clip();
    X.circle(c, tx + 0.3, ty, 1.45, p.eyeMode ? '#ffffff' : HERO.eye3);
    X.circle(c, tx + 0.3, ty, 0.95, p.eyeMode ? HERO.eye3 : '#0f8a3a');
    X.circle(c, tx + 0.35, ty, 0.5, '#041a0a');
    c.fillStyle = '#fff'; c.fillRect(tx - 0.3, ty - 0.9, 0.55, 0.55);
    c.restore();
    c.strokeStyle = O; c.lineWidth = 0.75;
    c.beginPath();
    c.moveTo(tx - hw, ty);
    c.quadraticCurveTo(tx, ty - hh * 1.4, tx + hw, ty);
    c.quadraticCurveTo(tx, ty + hh * 1.4, tx - hw, ty);
    c.stroke();
    // ресницы-лучики при полном раскрытии
    if (open > 0.9) {
      c.lineWidth = 0.5;
      c.beginPath();
      for (const a of [-2.3, -1.57, -0.8]) { c.moveTo(tx + Math.cos(a) * 2.6, ty + Math.sin(a) * 2.4); c.lineTo(tx + Math.cos(a) * 3.6, ty + Math.sin(a) * 3.4); }
      c.stroke();
    }
  }
}

// Полная фигура. Начало координат — середина подошв, герой смотрит вправо.
G.drawHero = (c, x, y, facing, p) => {
  const X = G.Gfx, O = HERO.outline;
  c.save();
  c.translate(x, y);
  if (facing < 0) c.scale(-1, 1);
  if (p.rot) c.rotate(p.rot);
  c.scale(1 / (p.squash || 1), p.squash || 1);

  const t = p.t || 0;
  let bob = 0, lean = 0;
  // углы: бедро/голень от вертикали (+ вперёд), руки от вертикали (+ вперёд)
  let fl = [0.08, 0.15], bl = [-0.08, 0.15], fa = 0.15, ba = -0.2, fa2 = 0.4, ba2 = 0.4;
  let hipY = -10, crouch = 0;
  switch (p.state) {
    case 'run': {
      const ph = p.phase;
      fl = [Math.sin(ph) * 0.95, 0.15 + Math.max(0, -Math.cos(ph)) * 1.25];
      bl = [Math.sin(ph + Math.PI) * 0.95, 0.15 + Math.max(0, Math.cos(ph)) * 1.25];
      fa = -Math.sin(ph) * 0.9; ba = Math.sin(ph) * 0.9;
      fa2 = 1.2; ba2 = 1.2;
      bob = -Math.abs(Math.cos(ph)) * 1.6 + 0.6;
      lean = 0.1;
      break;
    }
    case 'jump':
      fl = [0.95, 1.5]; bl = [-0.35, 0.7]; fa = 2.5; ba = -2.0; fa2 = 0.3; ba2 = 0.5; lean = 0.05;
      break;
    case 'fall': {
      const w = Math.sin(t * 0.4) * 0.3;
      fl = [0.35, 0.3]; bl = [-0.25, 0.5]; fa = 2.0 + w; ba = -2.0 - w; fa2 = -0.4; ba2 = 0.5;
      break;
    }
    case 'crouch':
      fl = [1.45, 2.5]; bl = [1.0, 2.3]; fa = 0.9; ba = 0.4; fa2 = 1.1; ba2 = 1.0; hipY = -6.4; crouch = 1; lean = 0.15;
      break;
    case 'hurt':
      fl = [0.5, 0.6]; bl = [-0.4, 0.4]; fa = 2.6; ba = -2.6; fa2 = 0.2; ba2 = 0.2; lean = -0.3;
      break;
    case 'dead':
      fl = [0.6, 0.4]; bl = [-0.6, 0.4]; fa = 2.4; ba = -2.4; fa2 = 0; ba2 = 0;
      break;
    case 'win':
      fl = [0.05, 0.1]; bl = [-0.12, 0.1]; fa = 3.0; ba = -0.4; fa2 = 0.2; ba2 = 0.5;
      bob = -Math.abs(Math.sin(t * 0.15)) * 3;
      break;
    default: {
      const br = Math.sin(t * 0.06);
      bob = br * 0.45;
      fa = 0.15 + br * 0.05; ba = -0.2 - br * 0.05;
    }
  }
  if (p.throwT > 0) { fa = 1.65; fa2 = 0; }
  if (p.shoot && p.state !== 'run') lean -= 0.06;

  const hip = hipY + bob;
  const shY = hip - 8.6 + crouch * 0.6;
  const leg = (hx, a, len1, len2, col, dark) => {
    const kx = hx + Math.sin(a[0]) * len1, ky = hip + Math.cos(a[0]) * len1;
    const fx = kx + Math.sin(a[0] - a[1]) * len2, fy = ky + Math.cos(a[0] - a[1]) * len2;
    X.limb3(c, hx, hip, kx, ky, fx, fy, 3.1, dark ? G.shade(HERO.skin, -0.12) : HERO.skin, O);
    // носок
    X.limb(c, G.lerp(kx, fx, 0.55), G.lerp(ky, fy, 0.55), fx, fy, 3.2, HERO.sock, O);
    // кроссовок
    const ang = a[0] - a[1];
    c.save();
    c.translate(fx, fy);
    c.rotate(-ang * 0.5);
    X.ellipse(c, 1.4, 0.6, 3.4, 2.1, 0, dark ? G.shade(HERO.shoe, -0.2) : HERO.shoe, O, 0.9);
    c.fillStyle = HERO.sole; c.fillRect(-1.6, 1.6, 6.2, 1.1);
    c.fillStyle = HERO.shoeHi; c.fillRect(0.2, -0.8, 2.4, 0.8);
    c.restore();
  };
  const arm = (sx, a, a2, dark, front) => {
    const ex = sx + Math.sin(a) * 4.4, ey = shY + 1 + Math.cos(a) * 4.4;
    const hx = ex + Math.sin(a + a2) * 4, hy = ey + Math.cos(a + a2) * 4;
    X.limb3(c, sx, shY + 1, ex, ey, hx, hy, 3.2, dark ? HERO.coatDark : HERO.coat, O);
    X.circle(c, hx, hy, 1.85, dark ? G.shade(HERO.skin, -0.12) : HERO.skin, O, 0.8);
    return [hx, hy];
  };

  c.save();
  c.rotate(lean);
  // копьё за спиной
  if (p.hasSpear && !(p.throwT > 0)) {
    c.save();
    c.translate(-2, shY + 4);
    c.rotate(-0.55);
    drawSpearShape(c, -14, 0, 26, 0.85);
    c.restore();
  }
  // дальняя рука и нога
  arm(-1.6, ba, ba2, true, false);
  leg(-1.2, bl, 5, 5, null, true);
  leg(1.6, fl, 5, 5, null, false);
  // шорты
  c.fillStyle = HERO.shorts;
  X.rr(c, -4.6, hip - 3.2, 9.6, 5.4, 2); c.fill();
  c.strokeStyle = O; c.lineWidth = 0.9; c.stroke();
  // торс — школьный китель
  c.fillStyle = HERO.coat;
  X.rr(c, -5, shY - 1, 10.6, hip - shY + 0.8, 3); c.fill(); c.stroke();
  c.fillStyle = HERO.coatHi;
  c.fillRect(-3.8, shY + 0.4, 1.6, hip - shY - 2.2);
  c.fillStyle = HERO.coatDark;
  c.fillRect(3.8, shY + 0.4, 1.2, hip - shY - 2.2);
  // воротник и пуговицы
  c.fillStyle = HERO.collar;
  c.beginPath(); c.moveTo(-2.5, shY - 0.8); c.lineTo(1.6, shY + 2.6); c.lineTo(5, shY - 0.8); c.closePath(); c.fill();
  c.lineWidth = 0.7; c.stroke();
  X.circle(c, 2.6, shY + 4.4, 0.8, HERO.button, O, 0.5);
  X.circle(c, 2.6, shY + 7, 0.8, HERO.button, O, 0.5);
  // ближняя рука
  const hand = arm(2.4, fa, fa2, false, true);
  // голова
  c.save();
  const hy = shY - 8.3 + (p.shoot ? 0.6 : 0);
  const tilt = p.aimUp ? -0.32 : p.shoot ? -0.08 : p.state === 'hurt' ? -0.2 : 0;
  c.translate(0.6, hy);
  c.rotate(tilt);
  heroHead(c, 0, 0, p);
  c.restore();
  c.restore();
  c.restore();
  return hand;
};

// Голова героя отдельно (HUD, иконка жизни)
G.drawHead = (c, x, y, s = 1, extra = {}) => {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  heroHead(c, 0, 0, Object.assign({ eye3: 0.6 }, extra));
  c.restore();
};

// Копьё «Красный Кондор»: древко + золотой наконечник-клюв
function drawSpearShape(c, x, y, len, s = 1, glow = 0) {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  if (glow) G.Gfx.glow(c, len - 4, 0, 14, '#ff6a40', glow);
  G.Gfx.limb(c, 0, 0, len - 5, 0, 2.4, HERO.spear, HERO.outline);
  c.fillStyle = HERO.spearHi; c.fillRect(1, -0.9, len - 8, 0.6);
  // обмотка
  c.fillStyle = HERO.gold;
  c.fillRect(len - 9, -1.6, 1.4, 3.2);
  c.fillRect(2, -1.6, 1.2, 3.2);
  // наконечник
  c.beginPath();
  c.moveTo(len - 6, -2.8); c.lineTo(len + 2, 0); c.lineTo(len - 6, 2.8); c.lineTo(len - 4.5, 0); c.closePath();
  c.fillStyle = HERO.gold; c.fill();
  c.strokeStyle = HERO.outline; c.lineWidth = 0.8; c.stroke();
  c.fillStyle = '#fff6c0'; c.fillRect(len - 4.5, -1, 3, 0.7);
  // перо кондора
  c.fillStyle = '#f0f0f8';
  c.beginPath(); c.moveTo(1, 0); c.lineTo(-4, -3); c.lineTo(-2.5, 0); c.lineTo(-4, 3); c.closePath(); c.fill();
  c.stroke();
  c.restore();
}
G.drawSpearShape = drawSpearShape;

// --- Выстрел третьим глазом --------------------------------------------------
G.EyeShot = class EyeShot extends G.Entity {
  constructor(x, y, dir, opts = {}) {
    const r = opts.charged ? 8 : opts.beam ? 3.2 : 3.6;
    super(x - r, y - r, r * 2, r * 2);
    this.r = r;
    this.dir = dir;
    this.charged = !!opts.charged;
    this.beam = !!opts.beam;
    const sp = this.charged ? 6.4 : this.beam ? 9 : 7;
    const ang = opts.angle || 0;
    this.vx = Math.cos(ang) * sp * dir;
    this.vy = Math.sin(ang) * sp;
    this.dmg = opts.dmg || 1;
    this.life = this.charged ? 70 : 42;
    this.hitSet = new Set();
    this.friendly = true;
    this.layer = 2;
  }
  update(game) {
    this.t++;
    this.x += this.vx;
    this.y += this.vy;
    if (--this.life <= 0) { this.dead = true; return; }
    const L = game.level;
    const tx = Math.floor(this.cx / 16), ty = Math.floor(this.cy / 16);
    const tile = L.get(tx, ty);
    if (L.isSolid(tx, ty)) {
      if (tile === G.T.BRICK) { L.hitBlock(tx, ty, game, false); if (!this.charged) this.dead = true; }
      else if (tile === G.T.BONUS) { L.hitBlock(tx, ty, game, false); this.dead = true; }
      else { this.dead = true; G.Particles.sparks(this.cx - this.vx, this.cy, 5, '#9affc8', 2); }
      if (this.dead) G.Particles.ring(this.cx - this.vx, this.cy, '#9affc8', 6, 10);
    }
    if (this.dead) return;
    for (const e of game.targets()) {
      if (this.hitSet.has(e)) continue;
      if (e.hitTest(this)) {
        e.hurt(this.dmg, game, this);
        G.Particles.sparks(this.cx, this.cy, this.charged ? 10 : 5, '#c0ffe0', 2.5);
        if (this.charged) this.hitSet.add(e);
        else { this.dead = true; break; }
      }
    }
    if (this.t % 2 === 0) G.Particles.add({ x: this.cx - this.vx * 0.5, y: this.cy, life: this.charged ? 16 : 9, size: this.r * 1.4, size2: 0, color: '#4aff9a', add: true });
  }
  draw(c) {
    const x = this.cx, y = this.cy, r = this.r;
    G.Gfx.glow(c, x, y, r * 3.2, '#4aff9a', this.charged ? 0.7 : 0.5);
    c.save();
    c.translate(x, y);
    c.rotate(Math.atan2(this.vy, this.vx));
    if (this.charged) {
      const pul = 1 + Math.sin(this.t * 0.8) * 0.12;
      G.Gfx.ellipse(c, 0, 0, r * 1.25 * pul, r * pul, 0, '#2aff7a');
      G.Gfx.ellipse(c, 1, 0, r * 0.8, r * 0.6, 0, '#e8fff0');
      // глаз внутри сгустка
      G.Gfx.ellipse(c, 1, 0, r * 0.6, r * 0.32, 0, '#ffffff');
      G.Gfx.circle(c, 1.4, 0, r * 0.22, '#0a5a2a');
    } else {
      G.Gfx.ellipse(c, -r * 0.6, 0, r * 1.9, r * 0.75, 0, 'rgba(60,255,150,0.6)');
      G.Gfx.ellipse(c, 0, 0, r, r * 0.8, 0, '#9affc8');
      G.Gfx.circle(c, 0.5, 0, r * 0.45, '#ffffff');
    }
    c.restore();
  }
};

// --- Копьё «Красный Кондор» ---------------------------------------------------
G.Spear = class Spear extends G.Entity {
  constructor(owner, x, y, dir, power) {
    super(x - 11, y - 3, 22, 6);
    this.owner = owner;
    this.dir = dir;
    this.vx = dir * 7.5;
    this.state = 'fly';
    this.dmg = 3 + power;
    this.range = 44 + power * 8;
    this.dx = 0; this.dy = 0;
    this.isPlatform = false;
    this.hitSet = new Set();
    this.wob = 0;
    this.layer = 1;
  }
  recall() {
    if (this.state === 'return') return;
    this.state = 'return';
    this.isPlatform = false;
    G.Audio.play('recall');
  }
  update(game) {
    this.t++;
    const p = this.owner;
    this.wob *= 0.85;
    if (this.state === 'fly') {
      const L = game.level;
      const tipX = this.dir > 0 ? this.x + this.w + this.vx : this.x + this.vx;
      const tx = Math.floor(tipX / 16), ty = Math.floor(this.cy / 16);
      if (L.isSolid(tx, ty)) {
        const tile = L.get(tx, ty);
        if (tile === G.T.BRICK || tile === G.T.BONUS) {
          L.hitBlock(tx, ty, game, false);
          this.recall();
          return;
        }
        // втыкаемся: наконечник уходит в стену на 5 пикселей
        const wallX = this.dir > 0 ? tx * 16 : (tx + 1) * 16;
        this.x = this.dir > 0 ? wallX - this.w + 5 : wallX - 5;
        this.state = 'stuck';
        this.isPlatform = true;
        this.wob = 1;
        G.Audio.play('stick');
        G.Particles.debris(wallX, this.cy, 5, ['#d8c8b0', '#8a7a6a'], 1.2);
        G.Particles.sparks(wallX, this.cy, 6, '#ffe0a0', 2);
        game.shake(1.5, 4);
        // платформа — торчащая часть копья
        this.platY = this.y + 1;
        return;
      }
      this.x += this.vx;
      for (const e of game.targets()) {
        if (this.hitSet.has(e)) continue;
        if (e.hitTest(this)) {
          this.hitSet.add(e);
          e.hurt(this.dmg, game, this);
          G.Particles.sparks(this.cx, this.cy, 8, '#ffb0a0', 3);
          if (!e.dead && !e.isBoss) { this.recall(); return; }
          if (e.isBoss) { this.recall(); return; }
        }
      }
      if (this.t > this.range) this.recall();
      if (this.t % 2 === 0) G.Particles.add({ x: this.cx - this.dir * 10, y: this.cy, life: 10, size: 2, size2: 0, color: '#ff8a6a', add: true });
    } else if (this.state === 'stuck') {
      if (!p.alive || G.dist(this.cx, this.cy, p.cx, p.cy) > 520) this.recall();
    } else if (this.state === 'return') {
      const dx = p.cx - this.cx, dy = p.cy - 4 - this.cy;
      const d = Math.hypot(dx, dy) || 1;
      const sp = Math.min(10, 4 + this.t * 0.1);
      this.x += (dx / d) * sp;
      this.y += (dy / d) * sp;
      this.ang = Math.atan2(dy, dx);
      if (d < 14 || !p.alive) {
        this.dead = true;
        p.hasSpear = true;
        p.spear = null;
        G.Particles.sparks(p.cx, p.cy - 6, 5, '#ff9a8a', 1.5);
      }
    }
  }
  // платформенный интерфейс
  get platRect() {
    if (this.dir > 0) return { x: this.x - 1, y: this.platY, w: this.w - 4, h: 4 };
    return { x: this.x + 5, y: this.platY, w: this.w - 4, h: 4 };
  }
  draw(c) {
    c.save();
    if (this.state === 'return') {
      c.translate(this.cx, this.cy);
      c.rotate(this.ang + Math.sin(this.t * 0.6) * 0.2);
      drawSpearShape(c, -12, 0, 24, 1, 0.3);
    } else {
      c.translate(this.cx, this.cy);
      if (this.dir < 0) c.scale(-1, 1);
      if (this.wob > 0.02) c.rotate(Math.sin(this.t * 2.2) * this.wob * 0.12);
      drawSpearShape(c, -12, 0, 24, 1, this.state === 'fly' ? 0.35 : 0);
    }
    c.restore();
  }
};

// --- Игрок -------------------------------------------------------------------
G.Player = class Player extends G.Entity {
  constructor(x, y, stats) {
    super(x - 6, y - 30, 12, 30);
    this.isPlayer = true;
    this.stats = stats;
    this.hp = stats.maxHp;
    this.facing = 1;
    this.alive = true;
    this.coyote = 0;
    this.jumpBuf = 0;
    this.invuln = 0;
    this.stun = 0;
    this.shotCd = 0;
    this.charge = 0;
    this.shootAnim = 0;
    this.throwT = 0;
    this.hasSpear = true;
    this.spear = null;
    this.platform = null;
    this.phase = 0;
    this.squash = 1;
    this.blinkT = 120;
    this.eye3 = 0.45;
    this.crouching = false;
    this.slow = 0;
    this.deathT = 0;
    this.fellInPit = false;
    this.layer = 1;
    this.stepDust = 0;
    this.winT = 0;
    this.controlLocked = false;
  }
  hurtbox() { return { x: this.x + 2, y: this.y + 5, w: this.w - 4, h: this.h - 6 }; }

  setCrouch(on, level) {
    if (on === this.crouching) return;
    if (on) { this.y += 10; this.h = 20; this.crouching = true; }
    else {
      // встать можно, только если над головой свободно
      const y = this.y - 10;
      for (let x = this.x + 1; x < this.x + this.w; x += 5) if (level.solidAt(x, y + 1)) return;
      if (level.solidAt(this.x + this.w - 1, y + 1)) return;
      this.y = y; this.h = 30; this.crouching = false;
    }
  }

  hurt(dmg, game, fromX) {
    if (!this.alive || this.invuln > 0 || game.eyeMode > 0 || game.state !== 'play') return false;
    if (game.stats.shield > 0) {
      game.stats.shield--;
      this.invuln = 80;
      G.Audio.play('bump');
      G.Particles.ring(this.cx, this.cy, '#80d0ff', 20, 20);
      G.Particles.sparks(this.cx, this.cy, 12, '#a0e0ff', 3);
      return true;
    }
    this.hp -= dmg;
    const dir = fromX === undefined ? -this.facing : (this.cx < fromX ? -1 : 1);
    this.vx = dir * 2.6;
    this.vy = -4.2;
    this.stun = 18;
    this.invuln = 100;
    this.charge = 0;
    G.Audio.play('hurt');
    game.shake(3, 10);
    game.hitstop(5);
    G.Particles.sparks(this.cx, this.cy, 10, '#ffffff', 3);
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
    this.vy = pit ? 0 : -7;
    if (this.spear) this.spear.recall();
    G.Audio.stopMusic();
    G.Audio.play('die');
    game.shake(4, 12);
  }

  update(game) {
    this.t++;
    const L = game.level, I = G.Input;
    if (!this.alive) {
      this.deathT++;
      if (!this.fellInPit) {
        if (this.deathT > 20) { this.vy += 0.3; this.y += this.vy; }
      }
      if (this.deathT === 110) game.onPlayerDeath();
      return;
    }
    if (this.invuln > 0) this.invuln--;
    if (this.stun > 0) this.stun--;
    if (this.slow > 0) this.slow--;
    if (this.shotCd > 0) this.shotCd--;
    if (this.throwT > 0) this.throwT--;
    if (this.shootAnim > 0) this.shootAnim--;
    this.squash = G.lerp(this.squash, 1, 0.25);

    const locked = this.controlLocked || game.state !== 'play';
    const left = !locked && I.down('left'), right = !locked && I.down('right');
    const down = !locked && I.down('down');
    const can = this.stun <= 0 && !locked;

    // перенос платформой
    if (this.platform) {
      const pl = this.platform;
      if (!pl.dead && (pl.isPlatform)) {
        G.Physics.moveX(this, L, pl.dx || 0);
        if (pl.dy) G.Physics.moveY(this, L, pl.dy);
      }
    }

    // приседание
    this.setCrouch(can && down && this.onGround && !left && !right && !this.droppingThrough(L), L);
    if (this.crouching && (!down || !this.onGround)) this.setCrouch(false, L);

    // горизонталь
    const maxV = (this.slow ? 1.4 : 2.75) * (game.eyeMode ? 1.15 : 1);
    let target = 0;
    if (can && !this.crouching) {
      if (left) { target = -maxV; this.facing = -1; }
      if (right) { target = maxV; this.facing = 1; }
    } else if (this.crouching) {
      if (left) this.facing = -1;
      if (right) this.facing = 1;
    }
    if (this.stun <= 0) {
      const acc = this.onGround ? (target === 0 ? 0.5 : 0.42) : 0.3;
      this.vx = G.approach(this.vx, target, acc);
    } else this.vx *= 0.95;

    // прыжок: койот-время и буфер
    if (this.onGround) this.coyote = 6; else if (this.coyote > 0) this.coyote--;
    if (can && I.pressed('jump')) this.jumpBuf = 7; else if (this.jumpBuf > 0) this.jumpBuf--;
    this.dropping = false;
    if (this.jumpBuf > 0 && can && down && this.onGround && this.droppingThrough(L)) {
      // спрыгнуть с платформы-сквозняка
      this.dropping = true;
      this.y += 2;
      this.jumpBuf = 0;
      this.coyote = 0;
      this.platform = null;
      if (this.crouching) this.setCrouch(false, L);
    } else if (this.jumpBuf > 0 && this.coyote > 0) {
      if (this.crouching) this.setCrouch(false, L);
      this.vy = this.slow ? -5.8 : -8.0;
      this.jumpBuf = 0;
      this.coyote = 0;
      this.onGround = false;
      this.platform = null;
      this.jumpHeld = true;
      this.springBoost = false;
      this.squash = 1.18;
      G.Audio.play('jump');
      G.Particles.dust(this.cx, this.bottom, 5);
    }
    if (this.jumpHeld && !I.down('jump') && this.vy < -2.2 && !this.springBoost) { this.vy *= 0.5; this.jumpHeld = false; }
    if (this.vy >= 0) this.jumpHeld = false;

    // гравитация (у вершины прыжка чуть мягче — приятнее управлять)
    const g = Math.abs(this.vy) < 1.2 && I.down('jump') ? 0.28 : 0.42;
    this.vy = Math.min(this.vy + g, 7.5);

    // движение и столкновения
    const prevBottom = this.bottom;
    this.hitL = this.hitR = this.hitU = false;
    const wasGround = this.onGround;
    this.onGround = false;
    if (this.dropping) {
      // пропускаем проверку сквозняков на этот кадр
      this.dropThroughT = 10;
    }
    this.droppingFlag = this.dropThroughT > 0;
    if (this.dropThroughT > 0) this.dropThroughT--;
    const saved = this.dropping;
    this.dropping = this.droppingFlag;
    G.Physics.moveX(this, L, this.vx);
    const yHit = G.Physics.moveY(this, L, this.vy);
    this.dropping = saved;
    if (yHit) {
      if (this.hitU) {
        // удар головой по блокам
        for (const tx of this.headHits || []) L.hitBlock(tx, this.headTy, game, true);
        this.vy = 0.5;
      } else this.vy = 0;
    }
    // платформы-сущности
    this.platform = null;
    if (this.vy >= 0) {
      for (const pl of game.platforms()) {
        const r = pl.platRect || pl;
        const prevTop = r.y - (pl.dy || 0);
        if (this.x + this.w > r.x && this.x < r.x + r.w && prevBottom <= Math.max(r.y, prevTop) + 1.5 && this.bottom >= r.y - 0.5 && !this.droppingFlag) {
          if (this.bottom >= r.y - 0.5 && this.bottom <= r.y + Math.max(8, this.vy + 4)) {
            this.y = r.y - this.h;
            this.vy = 0;
            this.onGround = true;
            this.platform = pl;
            this.groundTile = -1;
          }
        }
      }
    }
    if (this.onGround && !wasGround) {
      if (prevBottom - this.vy < this.bottom - 10 || this.lastVy > 4) {
        this.squash = 0.8;
        G.Particles.dust(this.cx, this.bottom, 6);
        G.Audio.play('land');
      }
    }
    this.lastVy = this.vy;

    // опасности: шипы и лава
    this.checkHazards(game);
    if (this.y > L.h * 16 + 24) { this.die(game, true); return; }

    // стрельба третьим глазом
    if (!locked) this.handleShooting(game);
    // копьё
    if (!locked && I.pressed('spear') && this.stun <= 0) {
      if (this.hasSpear && this.throwT <= 0) {
        this.hasSpear = false;
        this.throwT = 14;
        const sy = this.y + (this.crouching ? 8 : 9);
        this.spear = new G.Spear(this, this.cx + this.facing * 8, sy, this.facing, game.stats.spear);
        game.spawn(this.spear);
        G.Audio.play('spear');
      } else if (this.spear) this.spear.recall();
    }
    if (!locked && I.pressed('special')) game.tryEyeMode();

    // анимация
    if (this.onGround && Math.abs(this.vx) > 0.2) {
      this.phase += Math.abs(this.vx) * 0.17;
      if (++this.stepDust > 14) { this.stepDust = 0; G.Particles.dust(this.cx - this.facing * 4, this.bottom, 2); }
    }
    if (--this.blinkT <= 0) this.blinkT = G.randi(150, 300);
    const wantEye = game.eyeMode ? 1.15 : this.charge > 0 ? 0.6 + Math.min(1, this.charge / this.chargeMax(game)) * 0.5 : this.shootAnim > 0 ? 1 : 0.45 + Math.sin(this.t * 0.03) * 0.08;
    this.eye3 = G.lerp(this.eye3, wantEye, 0.3);
  }

  droppingThrough(L) {
    const ty = Math.floor((this.bottom + 1) / 16);
    const a = L.get(Math.floor((this.x + 1) / 16), ty), b = L.get(Math.floor((this.x + this.w - 1) / 16), ty);
    return (a === G.T.ONEWAY || a === G.T.EMPTY) && (b === G.T.ONEWAY || b === G.T.EMPTY) && (a === G.T.ONEWAY || b === G.T.ONEWAY);
  }

  chargeMax(game) { return Math.round(62 / (1 + game.stats.charge * 0.35)); }

  handleShooting(game) {
    const I = G.Input;
    const st = game.stats;
    const eyeY = this.y + (this.crouching ? 4 : 5);
    const eyeX = this.cx + this.facing * 6;
    // ↑ — стрельба по диагонали вверх
    const up = I.down('up') && !this.crouching ? -Math.PI / 4 : 0;
    this.aimUp = up !== 0;
    if (game.eyeMode > 0) {
      // режим третьего глаза: беглый тройной огонь
      if (I.down('shoot') && this.shotCd <= 0) {
        for (const a of [-0.16, 0, 0.16]) game.spawn(new G.EyeShot(eyeX, eyeY, this.facing, { beam: true, angle: a + up, dmg: 2 }));
        this.shotCd = 7;
        this.shootAnim = 8;
        G.Audio.play('shoot');
      }
      return;
    }
    if (I.pressed('shoot') && this.shotCd <= 0 && this.stun <= 0) {
      const live = game.entities.filter((e) => e instanceof G.EyeShot && !e.charged).length;
      if (live < 3 + st.shot * 2) {
        if (st.shot >= 3) for (const a of [-0.14, 0, 0.14]) game.spawn(new G.EyeShot(eyeX, eyeY, this.facing, { angle: a + up, dmg: 1 }));
        else if (st.shot === 2) { game.spawn(new G.EyeShot(eyeX, eyeY - 3, this.facing, { angle: up, dmg: 1 })); game.spawn(new G.EyeShot(eyeX + (up ? 3 * this.facing : 0), eyeY + 3, this.facing, { angle: up, dmg: 1 })); }
        else game.spawn(new G.EyeShot(eyeX, eyeY, this.facing, { angle: up, dmg: 1 }));
        this.shotCd = 8;
        this.shootAnim = 10;
        G.Audio.play('shoot');
        G.Particles.ring(eyeX, eyeY, '#9affc8', 5, 8);
      }
    }
    if (I.down('shoot') && this.stun <= 0) {
      this.charge++;
      const m = this.chargeMax(game);
      if (this.charge === 14) G.Audio.play('charge');
      if (this.charge === m) { G.Audio.play('charged'); G.Particles.ring(this.cx, eyeY, '#9affc8', 18, 14); }
      if (this.charge > 12 && this.t % 3 === 0) {
        const a = Math.random() * Math.PI * 2, r = 16;
        G.Particles.add({ x: eyeX + Math.cos(a) * r, y: eyeY + Math.sin(a) * r, vx: -Math.cos(a) * 1.2, vy: -Math.sin(a) * 1.2, life: 13, size: 1.6, color: this.charge >= m ? '#ffffff' : '#7affb0', add: true, kind: 'spark' });
      }
    } else if (this.charge > 0) {
      if (this.charge >= this.chargeMax(game)) {
        game.spawn(new G.EyeShot(eyeX, eyeY, this.facing, { charged: true, angle: up, dmg: 5 + st.shot * 2 }));
        this.shootAnim = 16;
        this.vx -= this.facing * 1.5;
        G.Audio.play('bigshot');
        game.shake(2, 6);
        G.Particles.ring(eyeX, eyeY, '#ffffff', 16, 12);
      }
      this.charge = 0;
    }
  }

  checkHazards(game) {
    const L = game.level;
    const b = this.hurtbox();
    const x0 = Math.floor(b.x / 16), x1 = Math.floor((b.x + b.w) / 16);
    const y0 = Math.floor((b.y - 2) / 16), y1 = Math.floor((this.bottom + 1) / 16);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const t = L.get(tx, ty);
        if (t === G.T.SPIKE) {
          // шипы ранят при касании сверху/сбоку
          if (this.bottom >= ty * 16 - 0.5 && this.y < ty * 16 + 16) { this.hurt(1, game, tx * 16 + 8); if (this.alive && this.onGround) this.vy = -5.5; }
        } else if (t === G.T.SPIKE_DOWN) {
          if (this.y <= (ty + 1) * 16 + 0.5 && this.bottom > ty * 16) this.hurt(1, game, tx * 16 + 8);
        } else if (t === G.T.LAVA) {
          if (this.bottom > ty * 16 + 5) {
            if (this.invuln <= 0 && game.eyeMode <= 0) {
              G.Audio.play('lava');
              G.Particles.sparks(this.cx, this.bottom, 14, '#ffb040', 3);
            }
            this.hurt(1, game, this.cx - this.facing);
            if (this.alive) { this.vy = -9.5; this.onGround = false; this.stun = 0; }
            return;
          }
        }
      }
    }
  }

  pose(game) {
    let state = 'idle';
    if (!this.alive) state = this.fellInPit ? 'fall' : 'dead';
    else if (this.winT > 0) state = 'win';
    else if (this.stun > 0) state = 'hurt';
    else if (this.crouching) state = 'crouch';
    else if (!this.onGround) state = this.vy < 0 ? 'jump' : 'fall';
    else if (Math.abs(this.vx) > 0.3) state = 'run';
    return {
      state, t: this.t, phase: this.phase, squash: this.squash,
      blink: this.blinkT < 8, eye3: this.eye3, shoot: this.shootAnim > 0,
      charge: this.charge > 10 ? Math.min(1, this.charge / this.chargeMax(game)) : 0,
      throwT: this.throwT, hasSpear: this.hasSpear, eyeMode: game.eyeMode > 0,
      hurt: this.stun > 0, dead: !this.alive && !this.fellInPit,
      rot: !this.alive && !this.fellInPit && this.deathT > 20 ? (this.deathT - 20) * 0.15 : 0,
      lookY: this.aimUp ? -0.9 : this.vy > 3 ? 0.6 : this.vy < -3 ? -0.6 : 0,
      aimUp: this.aimUp,
    };
  }

  draw(c, game) {
    if (this.invuln > 0 && this.alive && Math.floor(this.invuln / 3) % 2 === 0) return;
    const x = this.cx, y = this.bottom + 0.5;
    if (game.eyeMode > 0) {
      const k = game.eyeMode < 120 && Math.floor(game.eyeMode / 6) % 2 ? 0.3 : 1;
      G.Gfx.glow(c, x, y - 16, 34, '#4aff9a', 0.35 * k);
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.strokeStyle = G.rgba('#7affb0', 0.5 * k);
      c.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const r = 18 + ((this.t * 0.8 + i * 8) % 24);
        c.globalAlpha = 1 - (r - 18) / 24;
        c.beginPath(); c.ellipse(x, y - 15, r * 0.7, r, 0, 0, 7); c.stroke();
      }
      c.restore();
    }
    // тень
    if (this.alive && this.onGround) {
      c.fillStyle = 'rgba(0,0,0,0.25)';
      c.beginPath(); c.ellipse(x, this.bottom, 8, 2, 0, 0, 7); c.fill();
    }
    if (game.stats.shield > 0 && this.alive) {
      G.Gfx.circle(c, x, y - 15, 20, null, G.rgba('#80d0ff', 0.4 + Math.sin(this.t * 0.1) * 0.15), 1.2);
    }
    G.drawHero(c, x, y, this.facing, this.pose(game));
    if (this.stun > 0 && this.stun % 4 < 2) {
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = 0.4;
      G.drawHero(c, x, y, this.facing, this.pose(game));
      c.restore();
    }
  }
};
