'use strict';
// Ввод: клавиатура, геймпад и сенсорные кнопки сводятся к набору «действий».
G.Input = (() => {
  // Схемы управления. Игровые действия можно переназначить в меню «Управление» (хранится в сохранении).
  const SCHEMES = {
    classic: {
      left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'],
      jump: ['KeyZ', 'Space'], shoot: ['KeyX'], shootUp: ['KeyA'], spear: ['KeyC'],
      special: ['KeyV'], dash: ['ShiftLeft', 'ShiftRight'], pause: ['Escape', 'KeyP'],
    },
    mouse: {
      left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'],
      jump: ['Space'], shoot: ['Mouse0'], shootUp: [], spear: ['Mouse2'],
      special: ['KeyE'], dash: ['ShiftLeft', 'ShiftRight'], pause: ['Escape', 'KeyP'],
    },
  };
  const ACTIONS = ['left', 'right', 'up', 'down', 'jump', 'shoot', 'shootUp', 'spear', 'dash', 'special', 'pause'];
  // меню управляются всегда стрелками/Enter/Esc (и мышью), независимо от схемы
  const FIXED = {
    confirm: ['Enter', 'KeyZ', 'Space', 'Mouse0'],
    back: ['Escape', 'Backspace'],
    mUp: ['ArrowUp', 'KeyW'], mDown: ['ArrowDown', 'KeyS'], mLeft: ['ArrowLeft', 'KeyA'], mRight: ['ArrowRight', 'KeyD'],
  };
  const scheme = () => (G.Save.data.scheme === 'mouse' ? 'mouse' : 'classic');
  const binds = () => {
    const d = G.Save.data;
    if (!d.binds || d.binds._scheme !== scheme()) { d.binds = JSON.parse(JSON.stringify(SCHEMES[scheme()])); d.binds._scheme = scheme(); }
    return d.binds;
  };
  const map = new Proxy({}, { get: (_, a) => (FIXED[a] || binds()[a] || []), ownKeys: () => [...ACTIONS, ...Object.keys(FIXED)], getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }) });
  // мышь: позиция в координатах буфера 480×270
  const mouse = { x: G.W / 2, y: G.H / 2, moved: false };
  let capture = null;
  // Кнопки стандартного геймпада
  const padMap = {
    jump: [0], shoot: [2], shootUp: [4, 6], spear: [1], special: [3], dash: [5, 7], pause: [9],
    confirm: [0, 9], back: [1], up: [12], down: [13], left: [14], right: [15],
  };
  const held = new Set();
  const latched = new Set();
  const touch = {};
  const cur = {}, prev = {};
  let anyKeyLatch = false;

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    // F1 — бессмертие (бесконечные жизни, с флажка), F2 — неуязвимость (урон не проходит)
    if (e.code === 'F1' || e.code === 'F2') {
      e.preventDefault();
      const d = G.Save.data, k = e.code === 'F1' ? 'revive' : 'god';
      d[k] = !d[k]; G.Save.store();
      G.UI.toast((k === 'revive' ? 'БЕССМЕРТИЕ ' : 'НЕУЯЗВИМОСТЬ ') + (d[k] ? 'ВКЛЮЧЕНО' : 'ВЫКЛЮЧЕНО'));
      G.Audio.play('select');
      return;
    }
    if (capture) { e.preventDefault(); const cb = capture; capture = null; cb(e.code); return; }
    held.add(e.code);
    latched.add(e.code);
    anyKeyLatch = true;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => held.delete(e.code));
  window.addEventListener('pointerdown', () => { anyKeyLatch = true; window.focus(); });
  window.addEventListener('mousedown', (e) => {
    const code = 'Mouse' + e.button;
    if (capture) { e.preventDefault(); const cb = capture; capture = null; cb(code); return; }
    held.add(code); latched.add(code);
  });
  window.addEventListener('mouseup', (e) => held.delete('Mouse' + e.button));
  window.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('mousemove', (e) => {
    const X = G.Gfx, dpr = window.devicePixelRatio || 1;
    if (!X) return;
    mouse.x = (e.clientX * dpr - X.offX) / X.scale;
    mouse.y = (e.clientY * dpr - X.offY) / X.scale;
    mouse.moved = true;
  });
  window.addEventListener('blur', () => held.clear());

  function padState() {
    const out = {};
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      for (const a in padMap) for (const b of padMap[a]) if (p.buttons[b] && p.buttons[b].pressed) out[a] = true;
      const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
      if (ax < -0.4) out.left = true;
      if (ax > 0.4) out.right = true;
      if (ay < -0.5) out.up = true;
      if (ay > 0.5) out.down = true;
    }
    return out;
  }

  return {
    map,
    touch,
    update() {
      const pad = padState();
      for (const a of [...ACTIONS, ...Object.keys(FIXED)]) {
        prev[a] = cur[a];
        let v = !!pad[a] || !!touch[a];
        let l = false;
        // ↑ — тоже прыжок (можно выключить в меню)
        const upJ = a === 'jump' && G.Save.data.upJump !== false;
        const codes = upJ ? map.jump.concat(map.up) : map[a];
        if (FIXED[a] && a.startsWith('m')) { const base = { mUp: 'up', mDown: 'down', mLeft: 'left', mRight: 'right' }[a]; if (pad[base] || touch[base]) v = true; }
        if (upJ && (touch.up || pad.up)) v = true;
        for (const c of codes) {
          if (held.has(c)) v = true;
          if (latched.has(c)) l = true;
        }
        // «защёлка» ловит нажатия короче одного кадра
        cur[a] = v || l;
        if (l && prev[a]) prev[a] = false;
      }
      latched.clear();
      if (Object.keys(pad).length) anyKeyLatch = anyKeyLatch || Object.values(pad).some(Boolean);
    },
    down: (a) => !!cur[a],
    pressed: (a) => !!cur[a] && !prev[a],
    released: (a) => !cur[a] && !!prev[a],
    anyPressed() {
      const v = anyKeyLatch;
      anyKeyLatch = false;
      return v;
    },
    clearAny() { anyKeyLatch = false; },
    mouse,
    SCHEMES, ACTIONS,
    scheme,
    usingMouse: () => scheme() === 'mouse',
    binds,
    // ожидание клавиши для переназначения
    capture(cb) { capture = cb; },
    cancelCapture() { capture = null; },
    rebind(action, code) {
      const b = binds();
      for (const a of ACTIONS) if (a !== action) b[a] = b[a].filter((c) => c !== code); // одна клавиша — одно действие
      b[action] = [code];
      G.Save.store();
    },
    setScheme(name) { G.Save.data.scheme = name; G.Save.data.binds = null; binds(); G.Save.store(); },
    resetBinds() { G.Save.data.binds = null; binds(); G.Save.store(); },
    keyName(code) {
      if (!code) return '—';
      const N = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Space: 'ПРОБЕЛ', ShiftLeft: 'SHIFT', ShiftRight: 'R-SHIFT', ControlLeft: 'CTRL', ControlRight: 'R-CTRL', AltLeft: 'ALT', AltRight: 'R-ALT', Escape: 'ESC', Enter: 'ENTER', Backspace: 'BACKSPACE', Tab: 'TAB', CapsLock: 'CAPS', Mouse0: 'ЛКМ', Mouse1: 'СКМ', Mouse2: 'ПКМ', Mouse3: 'МЫШЬ-4', Mouse4: 'МЫШЬ-5' };
      if (N[code]) return N[code];
      if (code.startsWith('Key')) return code.slice(3);
      if (code.startsWith('Digit')) return code.slice(5);
      if (code.startsWith('Numpad')) return 'NUM ' + code.slice(6);
      return code.toUpperCase();
    },
  };
})();

// Сенсорное управление: появляется только на устройствах с тачскрином
G.setupTouch = () => {
  if (!('ontouchstart' in window) && !navigator.maxTouchPoints) return;
  const wrap = document.getElementById('touch');
  wrap.style.display = 'block';
  wrap.querySelectorAll('[data-a]').forEach((el) => {
    const acts = el.dataset.a.split(',');
    const on = (e) => { e.preventDefault(); acts.forEach((a) => (G.Input.touch[a] = true)); el.classList.add('on'); };
    const off = (e) => { e.preventDefault(); acts.forEach((a) => (G.Input.touch[a] = false)); el.classList.remove('on'); };
    el.addEventListener('touchstart', on, { passive: false });
    el.addEventListener('touchend', off, { passive: false });
    el.addEventListener('touchcancel', off, { passive: false });
  });
};
