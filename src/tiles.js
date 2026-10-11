'use strict';
// Отрисовка тайлов из спрайтов t_<theme>_* с автотайлингом по соседям.
G.Tiles = (() => {
  const S = {};
  const TT = G.T;
  const A = G.Art;
  const isGround = (t) => t === TT.SOLID || t === TT.GATE || t === TT.ICE || t === TT.CRACKED || t === TT.CONV_L || t === TT.CONV_R;

  function part(theme, name) { return `t_${theme}_${name}`; }
  function blit(c, name, x, y) {
    const s = A.get(name);
    if (s) c.drawImage(s.img, x, y);
    return !!s;
  }
  function groundPart(L, tx, ty, h) {
    const open = (x, y) => { const t = L.get(x, y); return !isGround(t) && t !== TT.LIQUID && !L.covered(x, y); };
    const u = open(tx, ty - 1), d = open(tx, ty + 1), l = open(tx - 1, ty), r = open(tx + 1, ty);
    if (u) return l && r ? 'topLR' : l ? 'topL' : r ? 'topR' : h < 0.5 ? 'top0' : 'top1';
    if (d) return l && r ? 'bottomLR' : l ? 'bottomL' : r ? 'bottomR' : 'bottom';
    if (l && r) return 'LR';
    if (l) return 'left';
    if (r) return 'right';
    return h < 0.6 ? 'fill0' : h < 0.85 ? 'fill1' : 'fill2';
  }

  // Слой задних стен (до сущностей)
  S.drawBack = (c, L, camX, camY) => {
    const th = L.theme;
    const tx0 = Math.max(0, Math.floor(camX / 16)), tx1 = Math.min(L.w - 1, Math.floor((camX + G.W) / 16));
    const ty0 = Math.max(0, Math.floor(camY / 16)), ty1 = Math.min(L.h - 1, Math.floor((camY + G.H) / 16));
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (!L.isBg(tx, ty)) continue;
      const t = L.get(tx, ty);
      if (isGround(t)) continue;
      const top = !L.isBg(tx, ty - 1) && !G.SOLID_SET.has(L.get(tx, ty - 1));
      const name = top ? 'bgTop' : G.hash2(tx, ty) < 0.7 ? 'bg0' : 'bg1';
      blit(c, part(th, name), tx * 16, ty * 16) || blit(c, part(th, 'bg0'), tx * 16, ty * 16);
    }
  };

  // Основной слой тайлов (после задних сущностей)
  S.drawFront = (c, L, camX, camY, frame) => {
    const th = L.theme;
    const tx0 = Math.max(0, Math.floor(camX / 16) - 1), tx1 = Math.min(L.w - 1, Math.floor((camX + G.W) / 16) + 1);
    const ty0 = Math.max(0, Math.floor(camY / 16) - 1), ty1 = Math.min(L.h - 1, Math.floor((camY + G.H) / 16) + 1);
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const t = L.tiles[ty * L.w + tx];
        if (!t) continue;
        const x = tx * 16, y = ty * 16, h = G.hash2(tx, ty);
        switch (t) {
          case TT.CONV_L: case TT.CONV_R: {
            blit(c, part(th, groundPart(L, tx, ty, h)), x, y);
            const f = G.Art.frame('h_conveyor', frame + tx * 0);
            if (t === TT.CONV_R) G.Art.draw(c, f, x, y); else G.Art.draw(c, f, x + 16, y, true);
            break;
          }
          case TT.SOLID: case TT.GATE: case TT.ICE: case TT.CRACKED: {
            if (t === TT.GATE) { G.Gfx.spr('i_gate', x, y); break; }
            if (t === TT.ICE && A.has(part(th, 'ice'))) { blit(c, part(th, 'ice'), x, y); break; }
            blit(c, part(th, groundPart(L, tx, ty, h)), x, y);
            if (t === TT.ICE) { c.fillStyle = 'rgba(200,240,255,0.35)'; c.fillRect(x, y, 16, 16); c.fillStyle = '#ffffff'; c.fillRect(x + 3, y + 3, 4, 1); c.fillRect(x + 3, y + 4, 1, 3); }
            if (t === TT.CRACKED) drawCracks(c, x, y);
            break;
          }
          case TT.ONEWAY: {
            const l = L.get(tx - 1, ty) !== TT.ONEWAY, r = L.get(tx + 1, ty) !== TT.ONEWAY;
            blit(c, part(th, l && !r ? 'platL' : r && !l ? 'platR' : 'plat'), x, y);
            break;
          }
          case TT.BRICK: blit(c, part(th, 'brick'), x, y); break;
          case TT.HEAVY: drawHeavy(c, th, x, y); break;
          case TT.USED: {
            const b = L.bump.get(ty * L.w + tx) || 0;
            blit(c, part(th, 'used'), x, y - Math.round(Math.sin((b / 10) * Math.PI) * 4));
            break;
          }
          case TT.BONUS: {
            const b = L.bump.get(ty * L.w + tx) || 0;
            blit(c, A.frame(part(th, 'bonus'), frame + tx * 7), x, y - Math.round(Math.sin((b / 10) * Math.PI) * 4));
            break;
          }
          case TT.SPIKE: blit(c, part(th, 'spike'), x, y); break;
          case TT.SPIKE_DOWN: blit(c, part(th, 'spikeDown'), x, y); break;
          case TT.CRUMBLE: {
            const cr = L.crumble.get(ty * L.w + tx);
            const k = cr ? Math.min(1, cr.t / 44) : 0;
            const ox = cr ? (cr.t % 4 < 2 ? 1 : -1) * Math.round(k * 1.5) : 0;
            blit(c, part(th, 'crumble'), x + ox, y + Math.round(k * 2));
            break;
          }
          case TT.LIQUID: {
            const surf = L.get(tx, ty - 1) !== TT.LIQUID;
            if (surf) blit(c, A.frame(part(th, 'liquid'), frame + tx * 3), x, y);
            else blit(c, part(th, 'liquidFill'), x, y);
            break;
          }
        }
      }
    }
    // нависающая трава/снег и свисающие корни/сосульки
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const t = L.tiles[ty * L.w + tx];
      if (t !== TT.SOLID) continue;
      if (L.get(tx, ty - 1) === TT.EMPTY && G.hash2(tx, ty + 99) < 0.75) blit(c, part(th, 'over'), tx * 16, ty * 16 - 6);
      if (L.get(tx, ty + 1) === TT.EMPTY && G.hash2(tx + 5, ty) < 0.5) blit(c, part(th, 'hang'), tx * 16, ty * 16 + 16);
    }
  };

  function drawHeavy(c, th, x, y) {
    blit(c, part(th, 'fill1'), x, y);
    // окованный блок — разбивается только ударом сверху
    c.fillStyle = '#2a2632'; c.fillRect(x, y, 16, 3); c.fillRect(x, y + 13, 16, 3); c.fillRect(x, y, 3, 16); c.fillRect(x + 13, y, 3, 16);
    c.fillStyle = '#8a8698'; c.fillRect(x + 1, y + 1, 14, 1); c.fillRect(x + 1, y + 1, 1, 14);
    c.fillStyle = '#5a5668'; c.fillRect(x + 1, y + 14, 14, 1); c.fillRect(x + 14, y + 1, 1, 14);
    c.fillStyle = '#c8c4d8';
    for (const [a, b] of [[1, 1], [13, 1], [1, 13], [13, 13]]) c.fillRect(x + a, y + b, 2, 2);
    // стрелка вниз
    c.fillStyle = '#ffd040';
    c.fillRect(x + 7, y + 5, 2, 3); c.fillRect(x + 5, y + 8, 6, 1); c.fillRect(x + 6, y + 9, 4, 1); c.fillRect(x + 7, y + 10, 2, 1);
  }
  function drawCracks(c, x, y) {
    c.fillStyle = 'rgba(10,6,16,0.85)';
    const pts = [[8, 0], [7, 3], [9, 5], [6, 8], [8, 11], [7, 14], [8, 16]];
    for (const [a, b] of pts) c.fillRect(x + a, y + b, 1, 2);
    c.fillRect(x + 9, y + 5, 3, 1); c.fillRect(x + 11, y + 6, 2, 1); c.fillRect(x + 3, y + 8, 3, 1); c.fillRect(x + 2, y + 9, 2, 1);
    c.fillStyle = 'rgba(255,240,200,0.35)';
    c.fillRect(x + 9, y + 1, 1, 2); c.fillRect(x + 7, y + 9, 1, 2);
  }

  // Ложные стены поверх всего: выглядят как земля, становятся полупрозрачными, когда найдены
  S.drawSecrets = (c, L, camX, camY, frame) => {
    if (!L.secrets.length) return;
    const th = L.theme;
    const tx0 = Math.max(0, Math.floor(camX / 16)), tx1 = Math.min(L.w - 1, Math.floor((camX + G.W) / 16));
    const ty0 = Math.max(0, Math.floor(camY / 16)), ty1 = Math.min(L.h - 1, Math.floor((camY + G.H) / 16));
    const pa = c.globalAlpha;
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (!L.covered(tx, ty)) continue;
      const rv = L.secretReveal(tx, ty);
      if (rv >= 1) continue;
      const x = tx * 16, y = ty * 16, h = G.hash2(tx, ty);
      c.globalAlpha = pa * (1 - rv);
      blit(c, part(th, groundPart(L, tx, ty, h)), x, y);
      // редкий блик — подсказка внимательному игроку
      const g = (frame + Math.floor(h * 400)) % 300;
      if (!rv && g < 14) {
        c.fillStyle = 'rgba(255,250,220,0.6)';
        for (let q = 0; q < 3; q++) { const px = g + 1 - q, py = 14 - g + q; if (px >= 0 && px < 16 && py >= 0 && py < 16) c.fillRect(x + px, y + py, 1, 1); }
      }
    }
    c.globalAlpha = pa;
  };

  S.drawProps = (c, L, camX) => {
    for (const p of L.props) {
      if (p.x < camX - 40 || p.x > camX + G.W + 40) continue;
      G.Art.draw(c, p.name, p.x, p.y, p.flip);
    }
  };
  return S;
})();
