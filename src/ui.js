'use strict';
// Интерфейс в пиксельном разрешении 480×270.
G.UI = (() => {
  const U = {};
  const X = G.Gfx;
  const W = G.W, H = G.H;
  let banner = null;
  U.bossBanner = (name) => { banner = { name, t: 0 }; };

  const SHOP = [
    { id: 'heart', icon: 'ui_shop_heart', name: 'СЕРДЦЕ +1', desc: 'Больше здоровья', max: 4, price: (n) => 300 + n * 150, cur: (g) => g.stats.maxHp - 4, apply: (g) => g.stats.maxHp++ },
    { id: 'shot', icon: 'ui_shop_shot', name: 'ВЗГЛЯД+', desc: 'Двойной, затем тройной выстрел', max: 2, price: (n) => 450 + n * 300, cur: (g) => g.stats.shot - 1, apply: (g) => g.stats.shot++, need: 'shot' },
    { id: 'charge', icon: 'ui_shop_potion', name: 'ФОКУС', desc: 'Заряд выстрела быстрее', max: 3, price: (n) => 250 + n * 150, cur: (g) => g.stats.charge, apply: (g) => g.stats.charge++, need: 'charge' },
    { id: 'spear', icon: 'ui_shop_spear', name: 'КОНДОР+', desc: 'Копьё сильнее и дальше', max: 3, price: (n) => 300 + n * 150, cur: (g) => g.stats.spear, apply: (g) => g.stats.spear++ },
    { id: 'shield', icon: 'ui_shop_shield', name: 'ОБЕРЕГ', desc: 'Поглощает один удар', max: 3, price: () => 200, cur: (g) => g.stats.shield, apply: (g) => g.stats.shield++ },
    { id: 'life', icon: 'ui_shop_life', name: 'ЖИЗНЬ', desc: 'Ещё одна попытка', max: 9, price: (n) => 350 + n * 100, cur: (g) => g.bought.life || 0, apply: (g) => { g.lives++; g.bought.life = (g.bought.life || 0) + 1; } },
  ];
  const shopItems = (g) => SHOP.filter((it) => !it.need || g.abil.has(it.need));

  function nav(game, n) {
    const I = G.Input;
    if (I.pressed('up')) { game.menu.i = (game.menu.i - 1 + n) % n; G.Audio.play('select'); }
    if (I.pressed('down')) { game.menu.i = (game.menu.i + 1) % n; G.Audio.play('select'); }
    return game.menu.i;
  }
  function titleItems() {
    const s = G.Save.data;
    const items = [{ id: 'new', label: 'НОВАЯ ИГРА' }];
    if (s.unlocked > 1) items.push({ id: 'select', label: 'ВЫБОР ЭТАПА' });
    items.push({ id: 'controls', label: 'УПРАВЛЕНИЕ' });
    items.push({ id: 'music', label: 'МУЗЫКА  ' + Math.round(s.music * 100) + '%' });
    items.push({ id: 'sfx', label: 'ЗВУКИ   ' + Math.round(s.sfx * 100) + '%' });
    items.push({ id: 'shake', label: 'ТРЯСКА  ' + (s.shake ? 'ВКЛ' : 'ВЫКЛ') });
    return items;
  }
  function vol(key, dir) {
    const s = G.Save.data;
    let v = Math.round((s[key] + dir * 0.2) * 10) / 10;
    if (v > 1.001) v = 0;
    s[key] = G.clamp(v, 0, 1);
    G.Audio.applyVolumes(); G.Save.store(); G.Audio.play('select');
  }

  U.update = (game) => {
    const I = G.Input;
    if (banner && ++banner.t > 160) banner = null;
    if (game.fadeCb) return;
    switch (game.state) {
      case 'boot':
        if (I.anyPressed() || I.pressed('confirm')) { G.Audio.init(); game.setState('title'); }
        break;
      case 'title': {
        const items = titleItems(), i = nav(game, items.length), it = items[i];
        if (it.id === 'music' || it.id === 'sfx') {
          if (I.pressed('left')) vol(it.id, -1);
          else if (I.pressed('right') || I.pressed('confirm')) vol(it.id, 1);
          break;
        }
        if (I.pressed('confirm')) {
          G.Audio.play('confirm');
          if (it.id === 'new') game.fadeTo(() => game.newGame(0));
          else if (it.id === 'select') { game.state = 'select'; game.menu = { i: 0 }; }
          else if (it.id === 'controls') game.state = 'controls';
          else if (it.id === 'shake') { G.Save.data.shake = !G.Save.data.shake; G.Save.store(); }
        }
        break;
      }
      case 'select': {
        const i = nav(game, G.Save.data.unlocked);
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
          else if (i === 1) { game.state = 'play'; game.player.controlLocked = true; game.fadeTo(() => { game.startLevel(game.levelIdx, true); game.setState('intro'); }); }
          else game.fadeTo(() => game.setState('title'));
        }
        break;
      }
      case 'story': {
        const lines = game.endingStory ? G.ENDING_STORY : G.LEVELS[game.levelIdx].story;
        game.storyT++;
        const full = lines[game.storyI][2].length;
        if (game.storyT % 2 === 0 && game.storyT / 2 <= full) G.Audio.play('text');
        if (I.pressed('pause')) game.storyI = lines.length;
        else if (I.pressed('confirm') || I.pressed('shoot')) {
          if (game.storyT / 2 < full) game.storyT = full * 2;
          else { game.storyI++; game.storyT = 0; G.Audio.play('select'); }
        }
        if (game.storyI >= lines.length) {
          if (game.endingStory) { game.endingStory = false; game.fadeTo(() => game.setState('ending'), 0.03); }
          else game.setState('intro');
          game.storyI = 0;
        }
        break;
      }
      case 'ability':
        if (game.stateT > 50 && I.pressed('confirm')) { G.Audio.play('confirm'); game.state = 'play'; }
        break;
      case 'gameover': {
        if (game.stateT < 60) break;
        const i = nav(game, 2);
        if (I.pressed('confirm')) {
          G.Audio.play('confirm');
          if (i === 0) game.fadeTo(() => { game.lives = 3; game.coins = Math.floor(game.coins / 2); game.startLevel(game.levelIdx); game.setState('intro'); });
          else game.fadeTo(() => game.setState('title'));
        }
        break;
      }
      case 'clear':
        if (game.stateT > 90 && I.pressed('confirm')) {
          G.Audio.play('confirm');
          if (game.levelIdx >= G.LEVELS.length - 1) game.fadeTo(() => { game.endingStory = true; game.setState('story'); }, 0.03);
          else game.fadeTo(() => game.setState('shop'));
        }
        break;
      case 'shop': {
        const items = shopItems(game), n = items.length + 1, i = nav(game, n);
        if (I.pressed('confirm') && game.stateT > 20) {
          if (i === items.length) { G.Audio.play('confirm'); game.fadeTo(() => { game.startLevel(game.levelIdx + 1); game.beginStage(); }); }
          else {
            const it = items[i], cur = it.cur(game), price = it.price(cur);
            if (cur >= it.max || game.coins < price) { G.Audio.play('deny'); U.msg = cur >= it.max ? 'Больше не могу дать.' : 'Не хватает монет, юный.'; U.msgT = 90; }
            else { game.coins -= price; it.apply(game); G.Audio.play('buy'); U.msg = 'Пусть служит тебе!'; U.msgT = 90; }
          }
        }
        if (U.msgT > 0) U.msgT--;
        break;
      }
      case 'ending':
        if (game.stateT > 700 && I.pressed('confirm')) game.fadeTo(() => game.setState('title'));
        break;
    }
  };

  U.toast = (text) => { toastMsg = text ? { text, t: 0 } : null; };
  let toastMsg = null;
  function drawToast() {
    if (!toastMsg) return;
    const t = ++toastMsg.t;
    if (t > 150) { toastMsg = null; return; }
    if (t > 120 && t % 4 < 2) return;
    T(toastMsg.text, W / 2, 46, { align: 'center', color: '#ffe060', outline: '#2a1000' });
  }
  function drawStory(game) {
    const lines = game.endingStory ? G.ENDING_STORY : G.LEVELS[game.levelIdx].story;
    const ln = lines[Math.min(game.storyI, lines.length - 1)];
    if (!ln) return;
    const [por, name, text] = ln;
    X.rect(0, 0, W, H, 'rgba(8,4,16,0.55)');
    const bx = 16, by = H - 86, bw = W - 32, bh = 70;
    X.frame(bx, by, bw, bh);
    // портрет
    const s = G.Art.get(por);
    if (s) {
      X.rect(bx + 8, by + 8, 52, 52, '#0c0614');
      const k = s.w <= 32 ? 1.5 : 1;
      X.ctx.drawImage(s.img, Math.round(bx + 34 - (s.w * k) / 2), Math.round(by + 34 - (s.h * k) / 2), Math.round(s.w * k), Math.round(s.h * k));
    }
    T(name, bx + 68, by + 9, { color: name === 'Мицу' ? '#9affc8' : name === 'Заркун' ? '#ff80c0' : '#ffd060' });
    // печать текста по буквам с переносом
    const shown = text.slice(0, Math.floor(game.storyT / 2));
    const maxW = bw - 80;
    const words = shown.split(' ');
    let line = '', y = by + 24;
    for (const w of words) {
      if (X.textWidth(line + w) > maxW) { T(line, bx + 68, y, { color: '#fff3c8' }); y += 11; line = ''; }
      line += w + ' ';
    }
    T(line, bx + 68, y, { color: '#fff3c8' });
    if (game.storyT / 2 >= text.length && game.frame % 40 < 28) T('Z ▼', bx + bw - 12, by + bh - 14, { align: 'right', color: '#ffe060' });
    T('ESC — пропустить', W - 20, 8, { align: 'right', color: '#a098b8', shadow: false });
  }

  U.draw = (game) => {
    X.screen();
    if (game.state === 'play') drawToast();
    switch (game.state) {
      case 'story': return drawStory(game);
      case 'boot': return drawBoot(game);
      case 'title': case 'select': case 'controls': return drawTitle(game);
      case 'play': case 'pause': case 'ability':
        drawHUD(game);
        if (game.state === 'pause') drawPause(game);
        if (game.state === 'ability') drawAbility(game);
        return;
      case 'intro': return drawIntro(game);
      case 'gameover': return drawGameOver(game);
      case 'clear': drawHUD(game); return drawClear(game);
      case 'shop': return drawShop(game);
      case 'ending': return drawEnding(game);
    }
  };

  const T = (s, x, y, o) => X.text(s, x, y, o);
  function cursor(game, x, y) { X.spr(G.Art.frame('ui_cursor', game.frame), x, y); }

  function drawBoot(game) {
    X.rect(0, 0, W, H, '#0a0614');
    X.spr(G.Art.frame('ui_logo_eye', Math.min(game.frame, 40)), W / 2, H / 2 - 24);
    if (Math.floor(game.frame / 30) % 2 === 0) T('НАЖМИ ЛЮБУЮ КЛАВИШУ', W / 2, H / 2 + 14, { align: 'center', color: '#fff3c8' });
    T('(включает звук)', W / 2, H / 2 + 28, { align: 'center', color: '#8070a8' });
  }

  function drawLogo(game, cx, cy) {
    const t = game.frame;
    X.glow(cx, cy - 26, 40, '#3aff8a', 0.5);
    X.spr(G.Art.frame('ui_logo_eye', t % 240 < 200 ? Math.min(t % 240, 40) : 0), cx, cy - 26);
    T('ТРЕТИЙ ГЛАЗ', cx, cy - 6, { align: 'center', scale: 3, color: '#ffc838', outline: '#2a0a10', shadow: '#000000' });
    T('ПРИКЛЮЧЕНИЯ МИЦУ', cx, cy + 22, { align: 'center', color: '#9affc8' });
  }

  function drawTitle(game) {
    G.Backgrounds.draw(X.ctx, 'city', game.cam.x, 0, game.time);
    X.screen();
    // дорожка с бегущим героем
    X.rect(0, 238, W, 32, '#1a1024');
    X.rect(0, 236, W, 3, '#c9b6a0');
    for (let i = -Math.floor(game.cam.x * 2) % 12; i < W; i += 12) X.rect(i, 237, 6, 1, '#ffcc33');
    X.spr(G.Art.frame('hero_run', game.frame), 90, 236);
    drawLogo(game, W / 2, 62);
    if (game.state === 'title') {
      const items = titleItems();
      const h = 14 + items.length * 13;
      X.frame(W / 2 - 80, 104, 160, h);
      items.forEach((it, i) => {
        const sel = i === game.menu.i;
        T(it.label, W / 2 - 54, 112 + i * 13, { color: sel ? '#ffe060' : '#d8d0f0' });
        if (sel) cursor(game, W / 2 - 68, 111 + i * 13);
      });
      if (G.Save.data.cleared) T('★ ПРОЙДЕНО ★ РЕКОРД ' + G.Save.data.bestCoins, W / 2, 248, { align: 'center', color: '#ffe060' });
      T('Z/ENTER — выбор', W / 2, 259, { align: 'center', color: '#8070a8', shadow: false });
    } else if (game.state === 'select') {
      const n = G.Save.data.unlocked;
      X.frame(W / 2 - 120, 100, 240, 22 + n * 13);
      T('ВЫБОР ЭТАПА', W / 2, 108, { align: 'center', color: '#9affc8' });
      for (let i = 0; i < n; i++) {
        const sel = i === game.menu.i;
        T(`${i + 1}. ${G.LEVELS[i].title}`, W / 2 - 96, 122 + i * 13, { color: sel ? '#ffe060' : '#d8d0f0' });
        if (sel) cursor(game, W / 2 - 110, 121 + i * 13);
      }
    } else {
      X.frame(W / 2 - 170, 96, 340, 150);
      T('УПРАВЛЕНИЕ', W / 2, 104, { align: 'center', color: '#9affc8' });
      const rows = [['← →', 'ходьба'], ['↓', 'присесть'], ['Z', 'прыжок'], ['C', 'копьё: бросить / вернуть'], ['X', 'выстрел глазом *'], ['↑ + X', 'выстрел вверх *'], ['SHIFT', 'рывок *'], ['↓ + Z', 'удар сверху (в прыжке) *'], ['V', 'пробуждение глаза *'], ['ESC', 'пауза']];
      rows.forEach(([k, v], i) => { T(k, W / 2 - 154, 118 + i * 11, { color: '#ffe060' }); T(v, W / 2 - 80, 118 + i * 11, { color: '#e8e0ff' }); });
      T('* — способности открываются по ходу игры', W / 2, 233, { align: 'center', color: '#ff9a8a', shadow: false });
    }
  }

  function drawHUD(game) {
    const p = game.player;
    if (!p) return;
    const c = X.ctx;
    // сердца
    for (let i = 0; i < game.stats.maxHp; i++) X.spr(i < p.hp ? 'ui_heart' : 'ui_heart_empty', 6 + i * 10, 6);
    for (let i = 0; i < game.stats.shield; i++) X.spr('ui_shield', 8 + game.stats.maxHp * 10 + i * 9, 6);
    X.spr('hero_life', 12, 30);
    T('×' + Math.max(0, game.lives), 20, 20, { color: '#ffffff' });
    // монеты
    X.spr('ui_coin', W - 58, 6);
    T(String(game.coins).padStart(5, '0'), W - 48, 6, { color: '#ffe060' });
    // шкала третьего глаза
    if (game.abil.has('eye')) {
      const mx = W / 2 - 30, my = 7, full = game.eyeMeter >= 100;
      X.spr('ui_eye', mx - 14, my - 1);
      X.rect(mx, my, 62, 6, '#1a0e24');
      const k = game.eyeMode > 0 ? game.eyeMode / 600 : game.eyeMeter / 100;
      X.rect(mx + 1, my + 1, Math.round(60 * k), 4, full || game.eyeMode ? (game.frame % 10 < 5 ? '#aaffd0' : '#3aff8a') : '#22b860');
      X.rect(mx + 1, my + 1, Math.round(60 * k), 1, '#c8ffe0');
      if (full && game.eyeMode <= 0 && game.frame % 40 < 28) T('V!', mx + 66, my - 1, { color: '#aaffd0' });
    }
    // полоска заряда над героем
    if (p.charge > 12 && game.eyeMode <= 0) {
      const ck = Math.min(1, p.charge / p.chargeMax(game));
      X.world(game.cam.x, game.cam.y);
      X.rect(p.cx - 9, p.y - 10, 18, 3, '#10081a');
      X.rect(p.cx - 8, p.y - 9, Math.round(16 * ck), 1, ck >= 1 ? (game.frame % 6 < 3 ? '#ffffff' : '#9affc8') : '#3aff8a');
      X.screen();
    }
    // босс
    const b = game.boss;
    if (b && !b.dead && game.bossStarted) {
      const intro = b.state === 'intro' ? Math.min(1, b.st / 80) : 1;
      const w = 200, x = W / 2 - w / 2, y = H - 14;
      T(b.name, W / 2, y - 11, { align: 'center', color: '#ffb0b0' });
      X.rect(x - 2, y - 2, w + 4, 8, '#10081a');
      X.rect(x, y, w, 4, '#3a0a18');
      X.rect(x, y, Math.round(w * (b.hp / b.maxHp) * intro), 4, '#e8203a');
      X.rect(x, y, Math.round(w * (b.hp / b.maxHp) * intro), 1, '#ff9a8a');
      X.rect(x + w / 2, y, 1, 4, '#ffffff');
    }
    if (game.hint && game.state === 'play') drawHint(game.hint, game);
    if (banner) {
      const t = banner.t;
      if (t > 10 && t < 150) {
        const off = Math.round((1 - G.easeOutCubic(Math.min(1, (t - 10) / 30))) * 300);
        X.rect(0, 104, W, 34, 'rgba(90,0,20,0.75)');
        X.rect(0, 103, W, 1, '#ffd86a'); X.rect(0, 138, W, 1, '#ffd86a');
        T('ОПАСНОСТЬ!', W / 2 - off, 108, { align: 'center', color: '#ffd86a' });
        T(banner.name, W / 2 + off, 120, { align: 'center', scale: 2, color: '#ffffff', outline: '#3a0010' });
      }
    }
  }

  // Плашка подсказки: текст, где [X] — клавиши в «колпачках»
  function drawHint(text, game) {
    const parts = text.split(/(\[[^\]]+\])/).filter(Boolean);
    let w = 0;
    for (const p of parts) w += p[0] === '[' ? X.textWidth(p.slice(1, -1)) + 8 : X.textWidth(p);
    const bw = w + 24, bx = Math.round(W / 2 - bw / 2), by = H - 44;
    X.frame(bx, by, bw, 24);
    let x = bx + 12;
    for (const p of parts) {
      if (p[0] === '[') {
        const k = p.slice(1, -1), kw = X.textWidth(k) + 6;
        const up = Math.floor(game.frame / 20) % 2;
        X.rect(x - 1, by + 6 + up, kw + 2, 12, '#120a1c');
        X.rect(x, by + 6 + up, kw, 10, '#f0e8d8');
        X.rect(x, by + 15 + up, kw, 1, '#a89880');
        X.text(k, x + 3, by + 8 + up, { color: '#2a1838', shadow: false });
        x += kw + 2;
      } else { X.text(p, x, by + 8, { color: '#fff3c8' }); x += X.textWidth(p); }
    }
  }

  function drawPause(game) {
    X.rect(0, 0, W, H, 'rgba(6,2,14,0.6)');
    X.frame(W / 2 - 80, 80, 160, 92);
    T('ПАУЗА', W / 2, 90, { align: 'center', scale: 2, color: '#9affc8' });
    ['ПРОДОЛЖИТЬ', 'С ЧЕКПОИНТА', 'В МЕНЮ'].forEach((s, i) => {
      const sel = i === game.menu.i;
      T(s, W / 2 - 46, 116 + i * 13, { color: sel ? '#ffe060' : '#d8d0f0' });
      if (sel) cursor(game, W / 2 - 60, 115 + i * 13);
    });
    // открытые способности
    let x = W / 2 - game.abil.size * 9;
    for (const a of G.ABILITIES) if (game.abil.has(a.id)) { X.spr('ui_ab_' + a.id, x, 180); x += 18; }
  }

  function drawAbility(game) {
    const a = G.ABILITIES.find((q) => q.id === game.newAbility);
    if (!a) return;
    const t = game.stateT;
    X.rect(0, 0, W, H, `rgba(6,2,14,${Math.min(0.8, t / 30)})`);
    const k = G.easeOutBack(Math.min(1, t / 30));
    X.glow(W / 2, 80, 40 + Math.sin(t * 0.1) * 4, '#ffe060', 0.6 * k);
    const s = G.Art.get('ui_ab_' + a.id);
    if (s) X.ctx.drawImage(s.img, Math.round(W / 2 - s.w * 2 * k), Math.round(80 - s.h * 2 * k), Math.round(s.w * 4 * k), Math.round(s.h * 4 * k));
    if (t > 20) {
      T('НОВАЯ СПОСОБНОСТЬ', W / 2, 122, { align: 'center', color: '#9affc8' });
      T(a.name, W / 2, 136, { align: 'center', scale: 2, color: '#ffe060', outline: '#2a1000' });
      a.desc.forEach((l, i) => T(l, W / 2, 162 + i * 12, { align: 'center', color: '#e8e0ff' }));
      T('Клавиша: ' + a.key, W / 2, 168 + a.desc.length * 12, { align: 'center', color: '#ffb070' });
    }
    if (t > 50 && game.frame % 40 < 28) T('Z — дальше', W / 2, 240, { align: 'center', color: '#ffffff' });
  }

  function drawIntro(game) {
    const t = game.stateT, L = G.LEVELS[game.levelIdx];
    X.rect(0, 0, W, H, 'rgba(8,4,16,0.94)');
    const k = G.easeOutBack(Math.min(1, t / 30));
    T(`ЭТАП ${game.levelIdx + 1}`, W / 2, 80, { align: 'center', color: '#9affc8', alpha: k });
    T(L.title, W / 2, 96, { align: 'center', scale: 2, color: '#ffe060', outline: '#2a1000', alpha: k });
    X.spr(G.Art.frame('hero_idle', game.frame), W / 2 - 14, 160);
    T('× ' + game.lives, W / 2 + 4, 140, { color: '#ffffff' });
    let x = W / 2 - game.abil.size * 9;
    for (const a of G.ABILITIES) if (game.abil.has(a.id)) { X.spr('ui_ab_' + a.id, x, 176); x += 18; }
    if (t > 30 && game.frame % 40 < 28) T('ВПЕРЁД!', W / 2, 206, { align: 'center' });
  }

  function drawGameOver(game) {
    X.rect(0, 0, W, H, '#0a0410');
    const t = game.stateT, k = Math.min(1, t / 40);
    T('ИГРА ОКОНЧЕНА', W / 2, 70 - (1 - k) * 30, { align: 'center', scale: 2, color: '#ff4a5a', outline: '#200008', alpha: k });
    X.spr('hero_dead1', W / 2, 150);
    if (t >= 60) ['ПРОДОЛЖИТЬ (½ МОНЕТ)', 'В МЕНЮ'].forEach((s, i) => {
      const sel = i === game.menu.i;
      T(s, W / 2 - 80, 176 + i * 14, { color: sel ? '#ffe060' : '#a098b8' });
      if (sel) cursor(game, W / 2 - 94, 175 + i * 14);
    });
  }

  function drawClear(game) {
    const t = game.stateT;
    X.rect(0, 0, W, H, `rgba(8,4,16,${Math.min(0.85, t / 30)})`);
    const k = G.easeOutBack(Math.min(1, t / 30));
    T('ЭТАП ПРОЙДЕН!', W / 2, 60, { align: 'center', scale: 2, color: '#ffe060', outline: '#2a1000', alpha: k });
    X.spr(G.Art.frame('hero_win', game.frame), W / 2, 150);
    if (t > 30) T(`Монет на этапе: ${game.levelCoins}`, W / 2, 92, { align: 'center' });
    if (t > 70 && game.level && game.level.glyphCount) {
      const n = [...Array(8).keys()].filter((k) => (game.levelGlyphs || 0) & (1 << k)).length;
      T(`Секретные медальоны: ${n} / ${game.level.glyphCount}`, W / 2, 116, { align: 'center', color: n === game.level.glyphCount ? '#9affc8' : '#c0b0e0' });
    }
    if (t > 50) T(`Всего монет: ${game.coins}`, W / 2, 104, { align: 'center', color: '#ffd060' });
    if (t > 90 && game.frame % 40 < 28) T(game.levelIdx >= G.LEVELS.length - 1 ? 'Z — дальше' : 'Z — в лавку мастера', W / 2, 190, { align: 'center', color: '#9affc8' });
  }

  function drawShop(game) {
    const t = game.frame;
    G.Pix.bands(X.ctx, 0, 0, W, H, ['#2a1430', '#22102a', '#1a0c22', '#140818'], 2);
    for (let x = 0; x < W; x += 24) X.rect(x, 0, 1, 200, '#341a38');
    X.rect(0, 200, W, 70, '#4a2618'); X.rect(0, 200, W, 2, '#7a4a2a');
    for (const lx of [40, 200, 360, 440]) { X.rect(lx, 0, 1, 16, '#120608'); X.glow(lx, 26, 22, '#ff8a40', 0.5); X.rect(lx - 6, 18, 12, 16, '#e8402a'); X.rect(lx - 6, 21, 12, 1, '#ffd060'); X.rect(lx - 6, 30, 12, 1, '#ffd060'); X.rect(lx - 6, 18, 2, 16, '#ff7a5a'); }
    X.spr(G.Art.frame('ui_master', t), 376, 144);
    X.frame(326, 104, 148, 30);
    T(U.msgT > 0 ? U.msg : 'Что желаешь, юный?', 400, 115, { align: 'center', color: '#fff3c8', shadow: false });
    T('ЛАВКА МАСТЕРА', 160, 8, { align: 'center', scale: 2, color: '#ffe060', outline: '#2a1000' });
    X.spr('ui_coin', 12, 30); T(String(game.coins), 22, 30, { color: '#ffe060' });
    const items = shopItems(game);
    X.frame(8, 42, 312, 22 + (items.length + 1) * 22);
    items.forEach((it, i) => {
      const y = 52 + i * 22, sel = game.menu.i === i, cur = it.cur(game), maxed = cur >= it.max, price = it.price(cur);
      if (sel) X.rect(14, y - 3, 300, 20, 'rgba(255,224,96,0.14)');
      X.spr(it.icon, 20, y - 1);
      T(it.name, 42, y, { color: maxed ? '#7a7090' : sel ? '#ffe060' : '#ffffff' });
      T(it.desc, 42, y + 9, { color: '#a098c0', shadow: false });
      if (it.max < 9) for (let k = 0; k < it.max; k++) X.rect(224 + k * 6, y + 2, 4, 4, k < cur ? '#9affc8' : '#3a3050');
      T(maxed ? 'МАКС' : String(price), 308, y, { align: 'right', color: maxed ? '#7a7090' : game.coins >= price ? '#ffe060' : '#ff6a6a' });
    });
    const ny = 52 + items.length * 22, sel = game.menu.i === items.length;
    T('► СЛЕДУЮЩИЙ ЭТАП', 164, ny + 2, { align: 'center', color: sel ? '#9affc8' : '#ffffff' });
    if (sel) cursor(game, 70, ny + 1);
    T('↑↓ — выбор   Z — купить', 240, 258, { align: 'center', color: '#a098b8', shadow: false });
  }

  function drawEnding(game) {
    const t = game.stateT;
    G.Backgrounds.draw(X.ctx, 'temple', game.cam.x, 0, game.time);
    X.screen();
    X.rect(0, 0, W, H, 'rgba(8,4,20,0.35)');
    X.rect(0, 226, W, 44, '#1e1238'); X.rect(0, 226, W, 2, '#e8c064');
    X.glow(W / 2, 210, 40, '#3aff8a', 0.4);
    X.spr(G.Art.frame('hero_win', game.frame), W / 2, 226);
    const lines = [
      ['ПОБЕДА!', 2, '#ffe060'], ['', 1],
      ['Принц Заркун повержен,', 1, '#ffffff'], ['а древняя сила третьего глаза', 1, '#ffffff'], ['снова дремлет до поры.', 1, '#ffffff'], ['', 1],
      ['Мицу возвращается домой —', 1, '#ffffff'], ['к урокам, друзьям и закатам.', 1, '#ffffff'], ['', 1],
      ['— ТРЕТИЙ ГЛАЗ —', 1, '#9affc8'], ['ремейк в духе 3 Eyes Boy (NES, 1992)', 1, '#c0b0e0'], ['', 1],
      [`Монет за игру: ${game.totalCoins}`, 1, '#ffd060'], ['', 1], ['СПАСИБО ЗА ИГРУ!', 2, '#ffe060'],
    ];
    const total = lines.reduce((a, l) => a + l[1] * 13, 0);
    let y = Math.max(270 - t * 0.4, 30 + 150 - total);
    for (const [s, sc, col] of lines) {
      if (s && y > -10 && y < 190) T(s, W / 2, Math.round(y), { align: 'center', scale: sc, color: col, outline: sc > 1 ? '#2a1000' : undefined });
      y += sc * 13;
    }
    if (t > 700 && game.frame % 40 < 28) T('Z — в меню', W / 2, 252, { align: 'center', color: '#a098b8' });
    if (t % 45 === 0) { G.Particles.sparks(G.rand(60, 420), G.rand(30, 120), 24, G.pick(['#ffe060', '#ff6af0', '#6af0ff', '#9affc8']), 2.4); G.Audio.play('stick'); }
    G.Particles.draw(X.ctx, 1);
  }
  return U;
})();
