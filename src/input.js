'use strict';
// Ввод: клавиатура, геймпад и сенсорные кнопки сводятся к набору «действий».
G.Input = (() => {
  const map = {
    left: ['ArrowLeft'],
    right: ['ArrowRight'],
    up: ['ArrowUp'],
    down: ['ArrowDown'],
    jump: ['KeyZ', 'Space', 'KeyK'],
    shoot: ['KeyX', 'KeyJ'],
    shootUp: ['KeyA', 'KeyU'],
    spear: ['KeyC', 'KeyL'],
    special: ['KeyV', 'KeyI'],
    dash: ['ShiftLeft', 'ShiftRight', 'KeyF'],
    pause: ['Escape', 'KeyP'],
    confirm: ['Enter', 'KeyZ', 'Space'],
    back: ['Escape', 'Backspace', 'KeyX'],
  };
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
    held.add(e.code);
    latched.add(e.code);
    anyKeyLatch = true;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => held.delete(e.code));
  window.addEventListener('pointerdown', () => { anyKeyLatch = true; window.focus(); });
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
      for (const a in map) {
        prev[a] = cur[a];
        let v = !!pad[a] || !!touch[a];
        let l = false;
        // ↑ — тоже прыжок (можно выключить в меню)
        const upJ = a === 'jump' && G.Save.data.upJump !== false;
        const codes = upJ ? map.jump.concat(map.up) : map[a];
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
