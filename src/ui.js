'use strict';
// Интерфейс: HUD, титульный экран, меню, магазин, экраны этапов и финал.
G.UI = (() => {
  const U = {};
  const X = G.Gfx;
  let banner = null;
  const hudShake = { hp: 0, lastHp: 0 };

  U.bossBanner = (name) => { banner = { name, t: 0 }; };

  // --- Магазин ---------------------------------------------------------------
  const SHOP = [
    { id: 'heart', name: 'СЕРДЦЕ +1', desc: 'Увеличивает запас здоровья', max: 4, price: (n) => 300 + n * 150, cur: (g) => g.stats.maxHp - 4, apply: (g) => g.stats.maxHp++ },
    { id: 'shot', name: 'ВЗГЛЯД+', desc: 'Двойной, затем тройной выстрел', max: 2, price: (n) => 450 + n * 300, cur: (g) => g.stats.shot - 1, apply: (g) => g.stats.shot++ },
    { id: 'charge', name: 'ФОКУС', desc: 'Заряженный выстрел быстрее', max: 3, price: (n) => 250 + n * 150, cur: (g) => g.stats.charge, apply: (g) => g.stats.charge++ },
    { id: 'spear', name: 'КОНДОР+', desc: 'Копьё сильнее и летит дальше', max: 3, price: (n) => 300 + n * 150, cur: (g) => g.stats.spear, apply: (g) => g.stats.spear++ },
    { id: 'shield', name: 'ОБЕРЕГ', desc: 'Поглощает один удар', max: 3, price: () => 200, cur: (g) => g.stats.shield, apply: (g) => g.stats.shield++ },
    { id: 'life', name: 'ЖИЗНЬ', desc: 'Дополнительная попытка', max: 9, price: (n) => 350 + n * 100, cur: (g) => g.bought.life || 0, apply: (g) => { g.lives++; g.bought.life = (g.bought.life || 0) + 1; } },
    { id: 'eye', name: 'ЗЕЛЬЕ ГЛАЗА', desc: 'Начать этап с полной шкалой', max: 1, price: () => 150, cur: (g) => (g.stats.eyeStart ? 1 : 0), apply: (g) => (g.stats.eyeStart = true) },
  ];

  // --- Обновление меню ----------------------------------------------------------
  function nav(game, n, horizontal = false) {
    const I = G.Input;
    const prevKey = horizontal ? 'left' : 'up', nextKey = horizontal ? 'right' : 'down';
    if (I.pressed(prevKey)) { game.menu.i = (game.menu.i - 1 + n) % n; G.Audio.play('select'); }
    if (I.pressed(nextKey)) { game.menu.i = (game.menu.i + 1) % n; G.Audio.play('select'); }
    return game.menu.i;
  }
  function titleItems() {
    const s = G.Save.data;
    const items = [{ id: 'new', label: 'НОВАЯ ИГРА' }];
    if (s.unlocked > 1) items.push({ id: 'select', label: 'ВЫБОР ЭТАПА' });
    items.push({ id: 'controls', label: 'УПРАВЛЕНИЕ' });
    items.push({ id: 'music', label: 'МУЗЫКА: ' + Math.round(s.music * 100) + '%' });
    items.push({ id: 'sfx', label: 'ЗВУКИ: ' + Math.round(s.sfx * 100) + '%' });
    items.push({ id: 'shake', label: 'ТРЯСКА: ' + (s.shake ? 'ВКЛ' : 'ВЫКЛ') });
    return items;
  }
  function cycleVol(key, dir) {
    const s = G.Save.data;
    s[key] = Math.round(G.clamp(s[key] + dir * 0.2, 0, 1) * 10) / 10;
    G.Audio.applyVolumes();
    G.Save.store();
    G.Audio.play('select');
  }

  U.update = (game) => {
    const I = G.Input;
    if (banner) { banner.t++; if (banner.t > 160) banner = null; }
    if (game.fadeCb) return;
    switch (game.state) {
      case 'boot':
        if (I.anyPressed() || I.pressed('confirm')) {
          G.Audio.init();
          game.setState('title');
        }
        break;
      case 'title': {
        const items = titleItems();
        const i = nav(game, items.length);
        const it = items[i];
        if (it.id === 'music' || it.id === 'sfx') {
          if (I.pressed('left')) cycleVol(it.id, -1);
          else if (I.pressed('right')) cycleVol(it.id, 1);
          else if (I.pressed('confirm')) {
            if (G.Save.data[it.id] >= 1) { G.Save.data[it.id] = 0; cycleVol(it.id, 0); } else cycleVol(it.id, 1);
          }
          break;
        }
        if (I.pressed('confirm')) {
          G.Audio.play('confirm');
          if (it.id === 'new') game.fadeTo(() => game.newGame(0));
          else if (it.id === 'select') { game.state = 'select'; game.menu = { i: 0 }; }
          else if (it.id === 'controls') { game.state = 'controls'; }
          else if (it.id === 'shake') { G.Save.data.shake = !G.Save.data.shake; G.Save.store(); }
        }
        break;
      }
      case 'select': {
        const n = G.Save.data.unlocked;
        const i = nav(game, n);
        if (I.pressed('confirm')) { G.Audio.play('confirm'); game.fadeTo(() => game.newGame(i)); }
        if (I.pressed('back') || I.pressed('pause')) { game.state = 'title'; game.menu = { i: 1 }; G.Audio.play('select'); }
        break;
      }
      case 'controls':
        if (I.pressed('back') || I.pressed('confirm') || I.pressed('pause')) { game.state = 'title'; game.menu = { i: 0 }; G.Audio.play('select'); }
        break;
      case 'pause': {
        const i = nav(game, 3);
        if (I.pressed('pause')) { game.state = 'play'; G.Audio.play('pause'); break; }
        if (I.pressed('confirm')) {
          G.Audio.play('confirm');
          if (i === 0) game.state = 'play';
          else if (i === 1) { game.fadeTo(() => { game.lives = Math.max(0, game.lives); game.startLevel(game.levelIdx, true); game.setState('intro'); }); game.state = 'play'; game.player.controlLocked = true; }
          else game.fadeTo(() => game.setState('title'));
        }
        break;
      }
      case 'gameover': {
        if (game.stateT < 60) break;
        const i = nav(game, 2);
        if (I.pressed('confirm')) {
          G.Audio.play('confirm');
          if (i === 0) game.fadeTo(() => {
            game.lives = 3;
            game.coins = Math.floor(game.coins / 2);
            game.startLevel(game.levelIdx);
            game.setState('intro');
          });
          else game.fadeTo(() => game.setState('title'));
        }
        break;
      }
      case 'clear':
        if (game.stateT > 90 && I.pressed('confirm')) {
          G.Audio.play('confirm');
          if (game.levelIdx >= G.LEVELS.length - 1) game.fadeTo(() => game.setState('ending'), 0.02);
          else game.fadeTo(() => game.setState('shop'));
        }
        break;
      case 'shop': {
        const n = SHOP.length + 1;
        const i = nav(game, n);
        if (I.pressed('confirm') && game.stateT > 20) {
          if (i === SHOP.length) {
            G.Audio.play('confirm');
            game.fadeTo(() => { game.startLevel(game.levelIdx + 1); game.setState('intro'); });
          } else {
            const it = SHOP[i];
            const cur = it.cur(game);
            const price = it.price(cur);
            if (cur >= it.max || game.coins < price) { G.Audio.play('deny'); U.shopMsg = cur >= it.max ? 'МАКСИМУМ!' : 'НЕ ХВАТАЕТ МОНЕТ'; U.shopMsgT = 60; }
            else {
              game.coins -= price;
              it.apply(game);
              G.Audio.play('buy');
              U.shopMsg = 'СПАСИБО!'; U.shopMsgT = 60;
              G.Particles.sparks(200, 120 + i * 26, 12, '#ffe060', 3);
            }
          }
        }
        if (U.shopMsgT > 0) U.shopMsgT--;
        G.Particles.update(null);
        break;
      }
      case 'ending':
        if (game.stateT > 600 && I.pressed('confirm')) game.fadeTo(() => game.setState('title'));
        break;
    }
  };

  // --- Отрисовка ------------------------------------------------------------------
  U.draw = (game) => {
    X.screen();
    const s = game.state;
    if (s === 'boot') drawBoot(game);
    else if (s === 'title' || s === 'select' || s === 'controls') drawTitle(game);
    else if (s === 'play' || s === 'pause') { drawHUD(game); if (s === 'pause') drawPause(game); }
    else if (s === 'intro') drawIntro(game);
    else if (s === 'gameover') drawGameOver(game);
    else if (s === 'clear') { drawHUD(game); drawClear(game); }
    else if (s === 'shop') drawShop(game);
    else if (s === 'ending') drawEnding(game);
  };

  function panel(x, y, w, h, a = 0.85) {
    const c = X.ctx;
    c.fillStyle = `rgba(14,8,26,${a})`;
    X.rr(c, x, y, w, h, 6); c.fill();
    c.strokeStyle = '#ffd86a'; c.lineWidth = 1.5; c.stroke();
    c.strokeStyle = 'rgba(255,216,106,0.3)'; c.lineWidth = 1;
    X.rr(c, x + 4, y + 4, w - 8, h - 8, 4); c.stroke();
  }

  function drawBoot(game) {
    const c = X.ctx;
    c.fillStyle = '#0a0614'; c.fillRect(0, 0, G.W, G.H);
    const t = game.time;
    G.drawEyeOrb(c, G.W / 2, G.H / 2 - 30, game.frame, 18);
    X.text('НАЖМИ ЛЮБУЮ КЛАВИШУ', G.W / 2, G.H / 2 + 20, { size: 10, align: 'center', color: '#fff3c8', alpha: 0.6 + Math.sin(t * 4) * 0.4 });
    X.text('(включает звук)', G.W / 2, G.H / 2 + 40, { size: 6, align: 'center', color: '#a090c0' });
  }

  function drawLogo(c, cx, cy, t) {
    // «ТРЕТИЙ ГЛАЗ» с раскрывающимся глазом над надписью
    const open = 0.5 + Math.sin(t * 1.2) * 0.5;
    G.Gfx.glow(c, cx, cy - 38, 60, '#4aff9a', 0.35 + open * 0.2);
    c.save();
    c.translate(cx, cy - 38);
    const hw = 34, hh = 18 * (0.25 + open * 0.75);
    c.beginPath(); c.moveTo(-hw, 0); c.quadraticCurveTo(0, -hh * 1.5, hw, 0); c.quadraticCurveTo(0, hh * 1.5, -hw, 0); c.closePath();
    c.fillStyle = '#fffff0'; c.fill();
    c.save(); c.clip();
    G.Gfx.circle(c, 0, 0, 13, '#2aff7a'); G.Gfx.circle(c, 0, 0, 8.5, '#0a8a3a'); G.Gfx.circle(c, 0, 0, 4.5, '#021a08');
    c.fillStyle = '#fff'; c.beginPath(); c.arc(-4, -4, 2.6, 0, 7); c.fill();
    c.restore();
    c.lineWidth = 3; c.strokeStyle = '#120a1c';
    c.beginPath(); c.moveTo(-hw, 0); c.quadraticCurveTo(0, -hh * 1.5, hw, 0); c.quadraticCurveTo(0, hh * 1.5, -hw, 0); c.stroke();
    c.lineWidth = 2;
    for (let i = -3; i <= 3; i++) {
      const a = -Math.PI / 2 + i * 0.35;
      c.beginPath(); c.moveTo(Math.cos(a) * 30, Math.sin(a) * (hh + 6)); c.lineTo(Math.cos(a) * 38, Math.sin(a) * (hh + 13)); c.stroke();
    }
    c.restore();
    const wob = (i) => Math.sin(t * 3 + i * 0.5) * 1.5;
    const title = 'ТРЕТИЙ ГЛАЗ';
    c.save();
    c.font = `28px ${X.font}`;
    const w = c.measureText(title).width;
    let x = cx - w / 2;
    for (let i = 0; i < title.length; i++) {
      const ch = title[i];
      const cw = c.measureText(ch).width;
      const y = cy + wob(i);
      c.textBaseline = 'middle';
      c.lineJoin = 'round';
      c.lineWidth = 8; c.strokeStyle = '#120a1c'; c.strokeText(ch, x, y + 3);
      c.strokeText(ch, x, y);
      const g = c.createLinearGradient(0, y - 14, 0, y + 14);
      g.addColorStop(0, '#fff6b0'); g.addColorStop(0.5, '#ffc030'); g.addColorStop(1, '#e05010');
      c.fillStyle = g; c.fillText(ch, x, y);
      x += cw;
    }
    c.restore();
    X.text('ПРИКЛЮЧЕНИЯ МИЦУ', cx, cy + 26, { size: 8, align: 'center', color: '#9affc8' });
  }

  function drawTitle(game) {
    const c = X.ctx;
    const t = game.time;
    G.Backgrounds.draw('city', game.cam.x, 0, t);
    X.screen();
    // дорожка с бегущим героем
    c.fillStyle = '#1a1024'; c.fillRect(0, 316, G.W, 44);
    c.fillStyle = '#c9b6a0'; c.fillRect(0, 312, G.W, 5);
    c.fillStyle = '#2a2230';
    for (let i = -((game.cam.x * 2) % 16); i < G.W; i += 16) c.fillRect(i, 314, 8, 3);
    const hx = 120;
    G.drawHero(c, hx, 312, 1, { state: 'run', t: game.frame, phase: game.frame * 0.3, hasSpear: true, eye3: 0.6 + Math.sin(t * 2) * 0.3, blink: Math.sin(t * 1.3) > 0.97 });
    if (game.frame % 6 === 0) G.Particles.dust(hx - 4, 312, 1);
    G.Particles.draw(c, 0);
    drawLogo(c, G.W / 2, 92, t);

    if (game.state === 'title') {
      const items = titleItems();
      panel(G.W / 2 - 110, 158, 220, 26 + items.length * 18);
      items.forEach((it, i) => {
        const sel = i === game.menu.i;
        const y = 172 + i * 18;
        X.text(it.label, G.W / 2, y, { size: 8, align: 'center', color: sel ? '#ffe060' : '#d8d0f0' });
        if (sel) {
          G.drawEyeOrb(c, G.W / 2 - 96, y + 4, game.frame, 4);
          if (it.id === 'music' || it.id === 'sfx') X.text('◄ ►', G.W / 2 + 88, y, { size: 6, color: '#ffe060', align: 'center' });
        }
      });
      X.text('© 2026 • ПЛАТФОРМЕР В ДУХЕ 90-Х', G.W / 2, 344, { size: 6, align: 'center', color: '#a090c0' });
      if (G.Save.data.cleared) X.text('★ ИГРА ПРОЙДЕНА ★  РЕКОРД: ' + G.Save.data.bestCoins, G.W / 2, 332, { size: 6, align: 'center', color: '#ffe060' });
    } else if (game.state === 'select') {
      const n = G.Save.data.unlocked;
      panel(G.W / 2 - 150, 150, 300, 30 + n * 20);
      X.text('ВЫБОР ЭТАПА', G.W / 2, 160, { size: 8, align: 'center', color: '#9affc8' });
      for (let i = 0; i < n; i++) {
        const sel = i === game.menu.i;
        X.text(`${i + 1}. ${G.LEVELS[i].title}`, G.W / 2 - 120, 180 + i * 20, { size: 8, color: sel ? '#ffe060' : '#d8d0f0' });
        if (sel) G.drawEyeOrb(c, G.W / 2 - 132, 184 + i * 20, game.frame, 4);
      }
    } else {
      panel(G.W / 2 - 200, 136, 400, 182);
      X.text('УПРАВЛЕНИЕ', G.W / 2, 150, { size: 8, align: 'center', color: '#9affc8' });
      const rows = [
        ['← →  / A D', 'ходьба'],
        ['↓', 'присесть (↓ + прыжок — спрыгнуть)'],
        ['Z / ПРОБЕЛ', 'прыжок (держи — выше)'],
        ['X', 'выстрел глазом (держи — заряд)'],
        ['↑ + X', 'стрельба по диагонали вверх'],
        ['C', 'бросить / вернуть копьё'],
        ['V', 'открыть третий глаз (шкала полна)'],
        ['ESC / P', 'пауза'],
      ];
      rows.forEach(([k, v], i) => {
        X.text(k, G.W / 2 - 180, 172 + i * 17, { size: 7, color: '#ffe060' });
        X.text(v, G.W / 2 - 60, 172 + i * 17, { size: 7, color: '#e8e0ff' });
      });
      X.text('Копьё втыкается в стену — на нём можно стоять!', G.W / 2, 304, { size: 6, align: 'center', color: '#ff9a8a' });
    }
  }

  // --- HUD -------------------------------------------------------------------------
  function drawHUD(game) {
    const c = X.ctx;
    const p = game.player;
    if (!p) return;
    if (p.hp < hudShake.lastHp) hudShake.hp = 14;
    hudShake.lastHp = p.hp;
    if (hudShake.hp > 0) hudShake.hp--;
    // подложка
    const g = c.createLinearGradient(0, 0, 0, 34);
    g.addColorStop(0, 'rgba(8,4,16,0.65)'); g.addColorStop(1, 'rgba(8,4,16,0)');
    c.fillStyle = g; c.fillRect(0, 0, G.W, 34);
    // сердца
    const sh = hudShake.hp > 0 ? Math.sin(hudShake.hp * 2) * 2 : 0;
    for (let i = 0; i < game.stats.maxHp; i++) {
      const full = i < p.hp;
      const x = 16 + i * 15 + sh, y = 14;
      const beat = full && p.hp <= 1 ? 1 + Math.sin(game.time * 10) * 0.12 : 1;
      G.drawHeart(c, x, y, 1.45 * beat, full ? '#ff3a5a' : '#3a2a40', full ? '#3a0812' : '#120a18');
    }
    if (game.stats.shield > 0) {
      for (let i = 0; i < game.stats.shield; i++) X.circle(c, 16 + game.stats.maxHp * 15 + i * 11, 14, 4.2, 'rgba(120,200,255,0.5)', '#bfe8ff', 1);
    }
    // жизни
    G.drawHead(c, 18, 33, 0.62);
    X.text('×' + Math.max(0, game.lives), 28, 29, { size: 7, color: '#ffffff' });
    // монеты
    G.drawCoin(c, G.W - 92, 14, game.frame);
    X.text(String(game.coins).padStart(5, '0'), G.W - 82, 10, { size: 8, color: '#ffe060' });
    // шкала третьего глаза
    const mx = G.W / 2 - 60, my = 9;
    const full = game.eyeMeter >= 100;
    c.fillStyle = 'rgba(0,0,0,0.5)';
    X.rr(c, mx, my, 120, 9, 4); c.fill();
    const k = game.eyeMode > 0 ? game.eyeMode / 600 : game.eyeMeter / 100;
    if (k > 0) {
      const gg = c.createLinearGradient(mx, 0, mx + 120, 0);
      gg.addColorStop(0, '#1a8a4a'); gg.addColorStop(1, full || game.eyeMode ? '#aaffd0' : '#3aff8a');
      c.fillStyle = gg;
      X.rr(c, mx + 1, my + 1, 118 * k, 7, 3.5); c.fill();
    }
    c.strokeStyle = full ? `rgba(200,255,220,${0.6 + Math.sin(game.time * 8) * 0.4})` : '#9affc8';
    c.lineWidth = 1;
    X.rr(c, mx, my, 120, 9, 4); c.stroke();
    G.drawEyeOrb(c, mx - 8, my + 4.5, game.frame, 5);
    if (full && game.eyeMode <= 0) X.text('V — ОТКРЫТЬ ГЛАЗ!', G.W / 2, 22, { size: 6, align: 'center', color: '#aaffd0', alpha: 0.6 + Math.sin(game.time * 6) * 0.4 });
    // название этапа в углу
    X.text(`ЭТАП ${game.levelIdx + 1}`, G.W - 16, 24, { size: 6, color: '#c0b0e0', align: 'right' });
    // полоса заряда над героем
    if (p.charge > 12 && game.eyeMode <= 0) {
      const ck = Math.min(1, p.charge / p.chargeMax(game));
      X.world(game.cam.x, game.cam.y);
      c.fillStyle = 'rgba(0,0,0,0.5)';
      c.fillRect(p.cx - 10, p.y - 14, 20, 3);
      c.fillStyle = ck >= 1 ? (game.frame % 6 < 3 ? '#ffffff' : '#9affc8') : '#3aff8a';
      c.fillRect(p.cx - 10, p.y - 14, 20 * ck, 3);
      X.screen();
    }
    // полоса босса
    const b = game.boss;
    if (b && !b.dead && game.bossStarted) {
      const intro = b.state === 'intro' ? Math.min(1, b.st / 80) : 1;
      const w = 300, x = G.W / 2 - w / 2, y = G.H - 22;
      c.fillStyle = 'rgba(8,4,16,0.75)';
      X.rr(c, x - 4, y - 12, w + 8, 22, 4); c.fill();
      X.text(b.name, G.W / 2, y - 9, { size: 6, align: 'center', color: '#ffb0b0' });
      c.fillStyle = '#2a0a14'; c.fillRect(x, y, w, 6);
      const hk = (b.hp / b.maxHp) * intro;
      const hg = c.createLinearGradient(0, y, 0, y + 6);
      hg.addColorStop(0, '#ff7a6a'); hg.addColorStop(1, '#c0102a');
      c.fillStyle = hg; c.fillRect(x, y, w * hk, 6);
      c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(x + w / 2, y, 1, 6);
      c.strokeStyle = '#ffd86a'; c.lineWidth = 1; c.strokeRect(x, y, w, 6);
    }
    // баннер босса
    if (banner) {
      const t = banner.t;
      const a = t < 20 ? t / 20 : t > 130 ? (160 - t) / 30 : 1;
      c.fillStyle = `rgba(120,0,20,${0.6 * a})`;
      c.fillRect(0, 140, G.W, 46);
      c.fillStyle = `rgba(255,200,100,${a})`;
      c.fillRect(0, 140, G.W, 1.5); c.fillRect(0, 184.5, G.W, 1.5);
      const off = (1 - G.easeOutCubic(Math.min(1, t / 30))) * 200;
      X.text('ОПАСНОСТЬ!', G.W / 2 - off, 148, { size: 7, align: 'center', color: '#ffd86a', alpha: a });
      X.text(banner.name, G.W / 2 + off, 162, { size: 14, align: 'center', color: '#ffffff', alpha: a });
    }
  }

  function drawPause(game) {
    const c = X.ctx;
    c.fillStyle = 'rgba(6,2,14,0.6)'; c.fillRect(0, 0, G.W, G.H);
    panel(G.W / 2 - 100, 110, 200, 124);
    X.text('ПАУЗА', G.W / 2, 124, { size: 12, align: 'center', color: '#9affc8' });
    ['ПРОДОЛЖИТЬ', 'С ЧЕКПОИНТА', 'В ГЛАВНОЕ МЕНЮ'].forEach((s, i) => {
      const sel = i === game.menu.i;
      X.text(s, G.W / 2, 156 + i * 20, { size: 8, align: 'center', color: sel ? '#ffe060' : '#d8d0f0' });
      if (sel) G.drawEyeOrb(c, G.W / 2 - 86, 160 + i * 20, game.frame, 4);
    });
    X.text(`Монеты: ${game.coins}   Жизни: ${game.lives}`, G.W / 2, 216, { size: 6, align: 'center', color: '#c0b0e0' });
  }

  function drawIntro(game) {
    const c = X.ctx;
    const t = game.stateT;
    const L = G.LEVELS[game.levelIdx];
    c.fillStyle = 'rgba(8,4,16,0.92)'; c.fillRect(0, 0, G.W, G.H);
    const k = G.easeOutBack(Math.min(1, t / 30));
    c.save();
    c.translate(G.W / 2, G.H / 2);
    c.scale(k, k);
    X.text(`ЭТАП ${game.levelIdx + 1}`, 0, -50, { size: 10, align: 'center', color: '#9affc8' });
    X.text(L.title, 0, -28, { size: 16, align: 'center', color: '#ffe060' });
    c.restore();
    G.drawHero(c, G.W / 2 - 20, G.H / 2 + 50, 1, { state: 'idle', t: game.frame, hasSpear: true, eye3: 0.5, blink: t % 120 < 6 });
    X.text('×  ' + game.lives, G.W / 2 + 6, G.H / 2 + 28, { size: 10, color: '#fff' });
    if (t > 30) X.text('ВПЕРЁД!', G.W / 2, G.H / 2 + 80, { size: 8, align: 'center', color: '#ffffff', alpha: 0.5 + Math.sin(t * 0.15) * 0.5 });
  }

  function drawGameOver(game) {
    const c = X.ctx;
    c.fillStyle = '#0a0410'; c.fillRect(0, 0, G.W, G.H);
    const t = game.stateT;
    const k = Math.min(1, t / 40);
    X.text('ИГРА ОКОНЧЕНА', G.W / 2, 110 - (1 - k) * 40, { size: 18, align: 'center', color: '#ff4a5a', alpha: k });
    G.drawHero(c, G.W / 2, 200, 1, { state: 'dead', t: game.frame, dead: true, eye3: 0 });
    if (t >= 60) {
      ['ПРОДОЛЖИТЬ (½ монет)', 'В ГЛАВНОЕ МЕНЮ'].forEach((s, i) => {
        const sel = i === game.menu.i;
        X.text(s, G.W / 2, 240 + i * 20, { size: 8, align: 'center', color: sel ? '#ffe060' : '#a098b8' });
        if (sel) G.drawEyeOrb(c, G.W / 2 - 110, 244 + i * 20, game.frame, 4);
      });
    }
  }

  function drawClear(game) {
    const c = X.ctx;
    const t = game.stateT;
    c.fillStyle = `rgba(8,4,16,${Math.min(0.85, t / 30)})`; c.fillRect(0, 0, G.W, G.H);
    const k = G.easeOutBack(Math.min(1, t / 30));
    c.save();
    c.translate(G.W / 2, 100);
    c.scale(k, k);
    X.text('ЭТАП ПРОЙДЕН!', 0, 0, { size: 18, align: 'center', color: '#ffe060' });
    c.restore();
    G.drawHero(c, G.W / 2, 220, 1, { state: 'win', t: game.frame, hasSpear: true, eye3: 1, shoot: true });
    if (t > 30) X.text(`Монет собрано на этапе: ${game.levelCoins}`, G.W / 2, 140, { size: 8, align: 'center', color: '#fff' });
    if (t > 50) X.text(`Всего монет: ${game.coins}`, G.W / 2, 158, { size: 8, align: 'center', color: '#ffd060' });
    if (t > 90) X.text(game.levelIdx >= G.LEVELS.length - 1 ? 'Нажми Enter...' : 'Enter — в лавку мастера', G.W / 2, 260, { size: 8, align: 'center', color: '#9affc8', alpha: 0.5 + Math.sin(t * 0.1) * 0.5 });
  }

  function drawShopkeeper(c, x, y, t) {
    // старый мастер в соломенной шляпе
    const O = '#1a1020';
    const bob = Math.sin(t * 0.05) * 1;
    c.save();
    c.translate(x, y + bob);
    // халат
    c.fillStyle = '#8a3a2a';
    c.beginPath(); c.moveTo(-26, 60); c.quadraticCurveTo(-24, 0, 0, -4); c.quadraticCurveTo(24, 0, 26, 60); c.closePath(); c.fill();
    c.strokeStyle = O; c.lineWidth = 1.5; c.stroke();
    c.fillStyle = '#e8c070'; c.fillRect(-3, -2, 6, 62);
    // голова
    G.Gfx.circle(c, 0, -16, 16, '#f0c098', O, 1.5);
    // борода
    c.fillStyle = '#f0f0f8';
    c.beginPath(); c.moveTo(-12, -10); c.quadraticCurveTo(0, 40 + Math.sin(t * 0.07) * 2, 12, -10); c.quadraticCurveTo(0, -4, -12, -10); c.fill(); c.stroke();
    // усы
    c.beginPath(); c.moveTo(0, -10); c.quadraticCurveTo(-10, -12, -16, -6); c.moveTo(0, -10); c.quadraticCurveTo(10, -12, 16, -6); c.lineWidth = 2.5; c.strokeStyle = '#f0f0f8'; c.stroke();
    // очки
    c.lineWidth = 1.4; c.strokeStyle = O;
    const blink = Math.sin(t * 0.03) > 0.97;
    for (const s of [-1, 1]) {
      G.Gfx.circle(c, s * 6, -18, 4.5, 'rgba(200,230,255,0.6)', O, 1.4);
      if (!blink) G.Gfx.circle(c, s * 6, -18, 1.4, O);
    }
    c.beginPath(); c.moveTo(-1.5, -18); c.lineTo(1.5, -18); c.stroke();
    // шляпа
    c.fillStyle = '#e8c860';
    c.beginPath(); c.moveTo(-34, -26); c.quadraticCurveTo(0, -60, 34, -26); c.quadraticCurveTo(0, -32, -34, -26); c.fill(); c.stroke();
    c.strokeStyle = '#b89030'; c.lineWidth = 0.8;
    for (let i = -24; i <= 24; i += 8) { c.beginPath(); c.moveTo(i * 0.4, -46); c.lineTo(i, -28); c.stroke(); }
    c.restore();
  }

  function shopIcon(c, id, x, y, t) {
    if (id === 'heart') G.drawHeart(c, x, y, 1.6);
    else if (id === 'shot') { for (const dy of [-4, 0, 4]) { G.Gfx.ellipse(c, x + 2, y + dy, 4, 1.8, 0, '#9affc8'); } G.Gfx.glow(c, x, y, 12, '#4aff9a', 0.4); }
    else if (id === 'charge') { G.Gfx.glow(c, x, y, 12, '#4aff9a', 0.6); G.Gfx.circle(c, x, y, 5, '#2aff7a'); G.Gfx.circle(c, x, y, 2.5, '#fff'); }
    else if (id === 'spear') { c.save(); c.translate(x, y); c.rotate(-0.6); G.drawSpearShape(c, -10, 0, 20, 0.9); c.restore(); }
    else if (id === 'shield') G.Gfx.circle(c, x, y, 6, 'rgba(120,200,255,0.5)', '#bfe8ff', 1.5);
    else if (id === 'life') G.drawHead(c, x, y + 1, 0.6);
    else if (id === 'eye') G.drawEyeOrb(c, x, y, t, 6);
  }

  function drawShop(game) {
    const c = X.ctx;
    const t = game.frame;
    // интерьер лавки
    const g = c.createLinearGradient(0, 0, 0, G.H);
    g.addColorStop(0, '#2a1630'); g.addColorStop(1, '#14080e');
    c.fillStyle = g; c.fillRect(0, 0, G.W, G.H);
    c.fillStyle = '#3a2028';
    for (let x = 0; x < G.W; x += 32) c.fillRect(x, 0, 2, G.H);
    c.fillStyle = '#5a3020'; c.fillRect(0, 280, G.W, 80);
    c.fillStyle = '#7a4a2a'; c.fillRect(0, 280, G.W, 4);
    // фонарики
    for (const lx of [60, 260, 460, 600]) {
      c.strokeStyle = '#1a0a0a'; c.lineWidth = 1; c.beginPath(); c.moveTo(lx, 0); c.lineTo(lx, 26); c.stroke();
      G.Gfx.glow(c, lx, 38, 40, '#ff8a40', 0.35 + Math.sin(t * 0.05 + lx) * 0.05);
      G.Gfx.ellipse(c, lx, 38, 9, 12, 0, '#e8402a', '#2a0a0a', 1);
      c.fillStyle = '#ffd060'; c.fillRect(lx - 9, 34, 18, 1.5); c.fillRect(lx - 9, 42, 18, 1.5);
    }
    drawShopkeeper(c, 530, 210, t);
    // прилавок
    c.fillStyle = '#6a3a1e'; c.fillRect(440, 262, 180, 30);
    c.fillStyle = '#8a5a2e'; c.fillRect(440, 262, 180, 4);
    panel(470, 110, 150, 46, 0.9);
    const msg = U.shopMsgT > 0 ? U.shopMsg : 'Что желаешь, юный?';
    X.text(msg, 545, 128, { size: 6, align: 'center', color: '#fff3c8', shadow: false });

    X.text('ЛАВКА МАСТЕРА', 230, 20, { size: 12, align: 'center', color: '#ffe060' });
    G.drawCoin(c, 26, 52, t);
    X.text(String(game.coins), 38, 48, { size: 8, color: '#ffe060' });
    panel(20, 66, 420, 26 + (SHOP.length + 1) * 26 - 8);
    SHOP.forEach((it, i) => {
      const y = 82 + i * 26;
      const sel = game.menu.i === i;
      const cur = it.cur(game);
      const maxed = cur >= it.max;
      const price = it.price(cur);
      if (sel) { c.fillStyle = 'rgba(255,224,96,0.12)'; c.fillRect(26, y - 4, 408, 24); }
      shopIcon(c, it.id, 42, y + 8, t);
      X.text(it.name, 60, y, { size: 8, color: maxed ? '#7a7090' : sel ? '#ffe060' : '#ffffff' });
      X.text(it.desc, 60, y + 11, { size: 5, color: '#b0a8c8', shadow: false });
      if (it.max > 1 && it.max < 9) for (let k = 0; k < it.max; k++) X.circle(c, 300 + k * 8, y + 4, 2.5, k < cur ? '#9affc8' : '#3a3050');
      if (maxed) X.text('МАКС', 420, y + 2, { size: 7, color: '#7a7090', align: 'right' });
      else {
        X.text(String(price), 420, y + 2, { size: 7, color: game.coins >= price ? '#ffe060' : '#ff6a6a', align: 'right' });
      }
    });
    const ny = 82 + SHOP.length * 26;
    const sel = game.menu.i === SHOP.length;
    X.text('► СЛЕДУЮЩИЙ ЭТАП', 230, ny + 2, { size: 8, align: 'center', color: sel ? '#9affc8' : '#ffffff' });
    G.Particles.draw(c, 0);
    X.text('↑↓ — выбор   Z / Enter — купить', 230, 340, { size: 6, align: 'center', color: '#a098b8' });
  }

  function drawEnding(game) {
    const c = X.ctx;
    const t = game.stateT;
    G.Backgrounds.draw('temple', game.cam.x, 0, game.time);
    X.screen();
    c.fillStyle = 'rgba(8,4,20,0.35)'; c.fillRect(0, 0, G.W, G.H);
    c.fillStyle = '#1e1238'; c.fillRect(0, 300, G.W, 60);
    c.fillStyle = '#e8c064'; c.fillRect(0, 300, G.W, 3);
    G.drawHero(c, G.W / 2, 300, 1, { state: 'win', t: game.frame, hasSpear: true, eye3: 1, eyeMode: true, shoot: true });
    G.Gfx.glow(c, G.W / 2, 270, 60, '#4aff9a', 0.25);
    const lines = [
      ['ПОБЕДА!', 18, '#ffe060'],
      ['', 8],
      ['Принц Заркун повержен,', 8, '#ffffff'],
      ['а древняя сила третьего глаза', 8, '#ffffff'],
      ['снова дремлет до поры.', 8, '#ffffff'],
      ['', 8],
      ['Мицу возвращается домой —', 8, '#ffffff'],
      ['к урокам, друзьям и закатам над городом.', 8, '#ffffff'],
      ['', 8],
      ['— ТРЕТИЙ ГЛАЗ —', 10, '#9affc8'],
      ['платформер в духе 90-х', 7, '#c0b0e0'],
      ['', 8],
      ['Код, графика и музыка: процедурно,', 7, '#c0b0e0'],
      ['на чистом JavaScript и WebAudio', 7, '#c0b0e0'],
      ['', 8],
      [`Монет за игру: ${game.totalCoins}`, 8, '#ffd060'],
      ['', 8],
      ['СПАСИБО ЗА ИГРУ!', 12, '#ffe060'],
    ];
    const total = lines.reduce((a, l) => a + l[1] * 2.4, 0);
    let y = Math.max(340 - t * 0.5, 250 - total);
    for (const [s, size, color] of lines) {
      if (s && y > -20 && y < 280) X.text(s, G.W / 2, y, { size, align: 'center', color, alpha: G.clamp((y - 10) / 40, 0, 1) * G.clamp((280 - y) / 40, 0, 1) });
      y += size * 2.4;
    }
    if (t > 600) X.text('Enter — в главное меню', G.W / 2, 330, { size: 6, align: 'center', color: '#a098b8', alpha: 0.5 + Math.sin(t * 0.1) * 0.5 });
    // фейерверки
    if (t % 40 === 0) {
      const fx = 80 + Math.random() * 480, fy = 60 + Math.random() * 120;
      G.Particles.sparks(fx, fy, 30, G.pick(['#ffe060', '#ff6af0', '#6af0ff', '#9affc8']), 3);
      G.Audio.play('stick');
    }
    G.Particles.draw(c, 0);
  }

  return U;
})();
