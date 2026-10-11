'use strict';
// Звук: всё синтезируется через WebAudio — эффекты и чиптюн-музыка в духе 90-х.
G.Audio = (() => {
  let ctx = null, master, sfxBus, musicBus, noiseBuf;
  const A = {};

  A.init = () => {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    master.connect(comp).connect(ctx.destination);
    sfxBus = ctx.createGain();
    musicBus = ctx.createGain();
    sfxBus.connect(master);
    musicBus.connect(master);
    A.applyVolumes();
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (pendingTrack) A.music(pendingTrack, true);
  };

  A.applyVolumes = () => {
    if (!ctx) return;
    sfxBus.gain.value = G.Save.data.sfx * 0.7;
    musicBus.gain.value = G.Save.data.music * 0.35;
  };

  // --- Эффекты -------------------------------------------------------------
  function tone({ type = 'square', f = 440, f2 = null, dur = 0.1, vol = 0.3, at = 0, attack = 0.002, bus = sfxBus, curve = 'exp' }) {
    if (!ctx) return;
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) {
      if (curve === 'exp') o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t + dur);
      else o.frequency.linearRampToValueAtTime(f2, t + dur);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  function noise({ dur = 0.2, vol = 0.3, at = 0, f = 2000, f2 = 200, q = 1, type = 'lowpass', bus = sfxBus }) {
    if (!ctx) return;
    const t = ctx.currentTime + at;
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    const fl = ctx.createBiquadFilter();
    fl.type = type;
    fl.Q.value = q;
    fl.frequency.setValueAtTime(f, t);
    fl.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl).connect(g).connect(bus);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  const sfx = {
    jump: () => tone({ type: 'square', f: 260, f2: 620, dur: 0.12, vol: 0.18 }),
    land: () => noise({ dur: 0.07, vol: 0.15, f: 900, f2: 200 }),
    shoot: () => { tone({ type: 'square', f: 1200, f2: 500, dur: 0.08, vol: 0.12 }); tone({ type: 'sine', f: 1800, f2: 900, dur: 0.06, vol: 0.08 }); },
    bigshot: () => { tone({ type: 'sawtooth', f: 300, f2: 80, dur: 0.35, vol: 0.2 }); tone({ type: 'square', f: 900, f2: 200, dur: 0.3, vol: 0.12 }); noise({ dur: 0.3, vol: 0.12, f: 3000, f2: 300 }); },
    charge: () => tone({ type: 'triangle', f: 400, f2: 900, dur: 0.5, vol: 0.06, curve: 'lin' }),
    charged: () => { tone({ type: 'square', f: 1320, dur: 0.06, vol: 0.08 }); tone({ type: 'square', f: 1760, dur: 0.08, vol: 0.08, at: 0.06 }); },
    spear: () => { noise({ dur: 0.18, vol: 0.18, f: 4000, f2: 800, type: 'bandpass', q: 2 }); tone({ type: 'triangle', f: 500, f2: 250, dur: 0.15, vol: 0.12 }); },
    stick: () => { tone({ type: 'square', f: 180, f2: 90, dur: 0.08, vol: 0.2 }); noise({ dur: 0.06, vol: 0.2, f: 3000, f2: 1000 }); },
    recall: () => tone({ type: 'triangle', f: 300, f2: 900, dur: 0.15, vol: 0.12 }),
    hit: () => { tone({ type: 'square', f: 220, f2: 60, dur: 0.1, vol: 0.2 }); noise({ dur: 0.08, vol: 0.18, f: 2500, f2: 400 }); },
    kill: () => { tone({ type: 'square', f: 600, f2: 80, dur: 0.25, vol: 0.18 }); noise({ dur: 0.3, vol: 0.25, f: 1800, f2: 100 }); },
    hurt: () => { tone({ type: 'sawtooth', f: 400, f2: 100, dur: 0.3, vol: 0.22 }); tone({ type: 'square', f: 300, f2: 80, dur: 0.3, vol: 0.12, at: 0.05 }); },
    coin: () => { tone({ type: 'square', f: 988, dur: 0.06, vol: 0.12 }); tone({ type: 'square', f: 1319, dur: 0.18, vol: 0.12, at: 0.06 }); },
    bigcoin: () => [1047, 1319, 1568, 2093].forEach((f, i) => tone({ type: 'square', f, dur: 0.1, vol: 0.11, at: i * 0.05 })),
    heart: () => [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'triangle', f, dur: 0.15, vol: 0.2, at: i * 0.07 })),
    bump: () => tone({ type: 'square', f: 150, f2: 100, dur: 0.08, vol: 0.2 }),
    brick: () => { noise({ dur: 0.25, vol: 0.3, f: 1500, f2: 150 }); tone({ type: 'square', f: 140, f2: 50, dur: 0.15, vol: 0.15 }); },
    stomp: () => { tone({ type: 'square', f: 500, f2: 150, dur: 0.1, vol: 0.18 }); },
    spring: () => tone({ type: 'sine', f: 200, f2: 1200, dur: 0.25, vol: 0.25 }),
    explode: () => { noise({ dur: 0.6, vol: 0.4, f: 1200, f2: 40 }); tone({ type: 'sine', f: 120, f2: 30, dur: 0.5, vol: 0.35 }); },
    bossHit: () => { tone({ type: 'square', f: 160, f2: 60, dur: 0.12, vol: 0.2 }); noise({ dur: 0.1, vol: 0.2, f: 1200, f2: 300 }); },
    roar: () => { tone({ type: 'sawtooth', f: 90, f2: 60, dur: 0.9, vol: 0.3, curve: 'lin' }); tone({ type: 'sawtooth', f: 93, f2: 55, dur: 0.9, vol: 0.25, curve: 'lin' }); noise({ dur: 0.9, vol: 0.2, f: 600, f2: 200 }); },
    enemyShot: () => tone({ type: 'triangle', f: 700, f2: 300, dur: 0.12, vol: 0.12 }),
    checkpoint: () => [659, 784, 988, 1319].forEach((f, i) => tone({ type: 'square', f, dur: 0.12, vol: 0.12, at: i * 0.08 })),
    select: () => tone({ type: 'square', f: 880, dur: 0.05, vol: 0.12 }),
    confirm: () => { tone({ type: 'square', f: 660, dur: 0.06, vol: 0.14 }); tone({ type: 'square', f: 990, dur: 0.12, vol: 0.14, at: 0.06 }); },
    deny: () => { tone({ type: 'square', f: 200, dur: 0.1, vol: 0.15 }); tone({ type: 'square', f: 150, dur: 0.15, vol: 0.15, at: 0.1 }); },
    buy: () => [784, 988, 1175, 1568].forEach((f, i) => tone({ type: 'square', f, dur: 0.08, vol: 0.12, at: i * 0.05 })),
    pause: () => { tone({ type: 'square', f: 988, dur: 0.06, vol: 0.12 }); tone({ type: 'square', f: 659, dur: 0.1, vol: 0.12, at: 0.07 }); },
    eyeOpen: () => { tone({ type: 'sawtooth', f: 100, f2: 1600, dur: 0.8, vol: 0.18 }); tone({ type: 'square', f: 200, f2: 2400, dur: 0.8, vol: 0.08 }); },
    crumble: () => noise({ dur: 0.3, vol: 0.2, f: 800, f2: 100 }),
    lava: () => { noise({ dur: 0.4, vol: 0.3, f: 600, f2: 3000 }); tone({ type: 'sawtooth', f: 300, f2: 900, dur: 0.3, vol: 0.12 }); },
    die: () => [784, 698, 622, 523, 466, 392, 330, 262].forEach((f, i) => tone({ type: 'square', f, dur: 0.12, vol: 0.15, at: i * 0.1 })),
    teleport: () => { tone({ type: 'sine', f: 1500, f2: 200, dur: 0.3, vol: 0.15 }); tone({ type: 'sine', f: 1000, f2: 3000, dur: 0.3, vol: 0.1 }); },
    ability: () => [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => { tone({ type: 'square', f, dur: 0.18, vol: 0.12, at: i * 0.09 }); tone({ type: 'triangle', f: f / 2, dur: 0.2, vol: 0.15, at: i * 0.09 }); }),
    dash: () => { noise({ dur: 0.15, vol: 0.2, f: 3000, f2: 600, type: 'bandpass', q: 1.5 }); tone({ type: 'sine', f: 600, f2: 200, dur: 0.12, vol: 0.12 }); },
    pound: () => { tone({ type: 'sawtooth', f: 900, f2: 120, dur: 0.25, vol: 0.15 }); },
    laser: () => { tone({ type: 'sawtooth', f: 80, f2: 120, dur: 1.2, vol: 0.18, curve: 'lin' }); noise({ dur: 1.2, vol: 0.12, f: 3000, f2: 2000, type: 'bandpass', q: 3 }); },
  };
  let lastPlay = {};
  A.play = (name) => {
    if (!ctx || !sfx[name]) return;
    const now = ctx.currentTime;
    if (lastPlay[name] && now - lastPlay[name] < 0.03) return; // без «пулемёта» одинаковых звуков
    lastPlay[name] = now;
    sfx[name]();
  };

  // --- Музыка --------------------------------------------------------------
  // Каждый трек — набор каналов, где ноты записаны токенами по 1/16:
  // "C4" — нота, "-" — тянуть предыдущую, "." — пауза; барабаны: k s h.
  const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
  function freq(tok) {
    const m = /^([A-G]#?)(\d)$/.exec(tok);
    if (!m) return 0;
    const midi = NOTE[m[1]] + (parseInt(m[2], 10) + 1) * 12;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }
  const P = (s) => s.trim().split(/\s+/);
  const rep = (s, n) => Array(n).fill(s).join(' ');

  const tracks = {
    title: {
      bpm: 112,
      ch: [
        { w: 'square', v: 0.16, n: P('E5 - - - B4 - D5 - E5 - G5 - F#5 - E5 - D5 - - - A4 - B4 - D5 - - - B4 - - - E5 - - - B4 - D5 - E5 - G5 - A5 - B5 - A5 - G5 - F#5 - D5 - E5 - - - - - - -') },
        { w: 'triangle', v: 0.3, n: P(rep('E2 - E3 - E2 - E3 -', 2) + ' ' + rep('D2 - D3 - D2 - D3 -', 2) + ' ' + rep('C2 - C3 - C2 - C3 -', 2) + ' ' + rep('B1 - B2 - B1 - B2 -', 2)) },
        { w: 'drum', v: 0.5, n: P(rep('k . h . s . h . k . k . s . h h', 4)) },
      ],
    },
    city: {
      bpm: 140,
      ch: [
        { w: 'square', v: 0.13, n: P('A4 - C5 - E5 - A5 - G5 - E5 - D5 - E5 - . . C5 - D5 - E5 - - - - - G5 - E5 - D5 - C5 - D5 - . . B4 - C5 - D5 - - - - - A4 - C5 - E5 - A5 - B5 - C6 - B5 - A5 - G5 - E5 - G5 - A5 - - - - - - - - - - - - - - -') },
        { w: 'square', v: 0.06, n: P(rep('A3 . E4 . A3 . E4 .', 2) + ' ' + rep('G3 . D4 . G3 . D4 .', 2) + ' ' + rep('F3 . C4 . F3 . C4 .', 2) + ' ' + rep('E3 . B3 . E3 . G#3 .', 2)) },
        { w: 'triangle', v: 0.32, n: P(rep('A2 - A2 A3 A2 - A2 A3', 2) + ' ' + rep('G2 - G2 G3 G2 - G2 G3', 2) + ' ' + rep('F2 - F2 F3 F2 - F2 F3', 2) + ' ' + rep('E2 - E2 E3 E2 - E2 E3', 2)) },
        { w: 'drum', v: 0.5, n: P(rep('k . h . s . h k k . h . s . h h', 8)) },
      ],
    },
    ruins: {
      bpm: 120,
      ch: [
        { w: 'square', v: 0.13, n: P('D5 - - - F5 - G5 - A5 - - - C6 - A5 - G5 - F5 - G5 - - - - - - - D5 - - - F5 - G5 - A5 - - - G5 - F5 - D5 - C5 - D5 - - - - - - - F5 - - - G5 - A5 - C6 - - - D6 - C6 - A5 - G5 - A5 - - - - - - - G5 - F5 - D5 - C5 - D5 - - - - - - - - - - - - - - -') },
        { w: 'triangle', v: 0.32, n: P(rep('D2 - . D2 A2 - D3 -', 4) + ' ' + rep('A#1 - . A#1 F2 - A#2 -', 2) + ' ' + rep('C2 - . C2 G2 - C3 -', 2)) },
        { w: 'drum', v: 0.45, n: P(rep('k . . h s . h . k k . h s . h .', 8)) },
      ],
    },
    cave: {
      bpm: 96,
      ch: [
        { w: 'triangle', v: 0.22, n: P('E5 - - - - - B4 - - - - - G5 - F#5 - E5 - - - - - D5 - - - B4 - - - - - E5 - - - - - B4 - - - - - A5 - G5 - F#5 - - - D5 - - - E5 - - - - - - - - - - -') },
        { w: 'square', v: 0.05, n: P(rep('E4 B4 G4 B4', 4) + ' ' + rep('D4 A4 F#4 A4', 4) + ' ' + rep('C4 G4 E4 G4', 4) + ' ' + rep('B3 F#4 D#4 F#4', 4)) },
        { w: 'triangle', v: 0.3, n: P('E2 - - - - - - - E2 - - - - - - - D2 - - - - - - - D2 - - - - - - - C2 - - - - - - - C2 - - - - - - - B1 - - - - - - - B1 - - - - - - -') },
        { w: 'drum', v: 0.35, n: P(rep('k . . . h . . . s . . . h . . h', 4)) },
      ],
    },
    volcano: {
      bpm: 150,
      ch: [
        { w: 'square', v: 0.13, n: P('E5 - E5 - G5 - E5 - A#5 - A5 - G5 - E5 - D5 - E5 - - - . . E5 - G5 - A5 - - - B5 - A5 - G5 - E5 - G5 - - - A5 - - - B5 - - - E6 - D6 - B5 - A5 - G5 - A5 - B5 - - - - - - - - - - - - - - -') },
        { w: 'sawtooth', v: 0.05, n: P(rep('E3 E3 E4 E3', 4) + ' ' + rep('C3 C3 C4 C3', 4) + ' ' + rep('D3 D3 D4 D3', 4) + ' ' + rep('B2 B2 B3 B2', 4)) },
        { w: 'triangle', v: 0.32, n: P(rep('E2 E2 E3 E2', 4) + ' ' + rep('C2 C2 C3 C2', 4) + ' ' + rep('D2 D2 D3 D2', 4) + ' ' + rep('B1 B1 B2 B1', 4)) },
        { w: 'drum', v: 0.5, n: P(rep('k h s h k k s h k h s h k k s s', 4)) },
      ],
    },
    temple: {
      bpm: 108,
      ch: [
        { w: 'square', v: 0.12, n: P('B4 - - - D5 - F#5 - - - E5 - D5 - C#5 - D5 - - - - - B4 - - - G5 - - - F#5 - E5 - D5 - - - E5 - - - F#5 - - - - - - - - - - - B4 - - - D5 - F#5 - - - B5 - A5 - G5 - F#5 - - - E5 - D5 - E5 - - - F#5 - - - - - - - - - - - - - - -') },
        { w: 'triangle', v: 0.3, n: P(rep('B1 - B2 - F#2 - B2 -', 2) + ' ' + rep('G1 - G2 - D2 - G2 -', 2) + ' ' + rep('E2 - E3 - B2 - E3 -', 2) + ' ' + rep('F#1 - F#2 - C#2 - F#2 -', 2)) },
        { w: 'square', v: 0.04, n: P(rep('F#4 B4 D5 B4', 4) + ' ' + rep('D4 G4 B4 G4', 4) + ' ' + rep('E4 G4 B4 G4', 4) + ' ' + rep('C#4 F#4 A#4 F#4', 4)) },
        { w: 'drum', v: 0.45, n: P(rep('k . h . s . h . k . h k s . h h', 4)) },
      ],
    },
    sewer: {
      bpm: 126,
      ch: [
        { w: 'square', v: 0.11, n: P('E4 - . E4 G4 - A4 - . . A#4 - A4 - G4 - E4 - . E4 G4 - A4 - . . D5 - C5 - A4 - E4 - . E4 G4 - A4 - . . A#4 - A4 - G4 - E5 - D5 - C5 - A4 - G4 - E4 - - - - - - -') },
        { w: 'triangle', v: 0.32, n: P(rep('E2 . E2 . G2 . E2 A2', 4) + ' ' + rep('C2 . C2 . D2 . C2 D2', 2) + ' ' + rep('E2 . E2 . G2 . B1 D2', 2)) },
        { w: 'drum', v: 0.45, n: P(rep('k . h k s . h . k k h . s . h h', 4)) },
      ],
    },
    ice: {
      bpm: 112,
      ch: [
        { w: 'triangle', v: 0.24, n: P('A5 - - - E5 - - - C6 - B5 - A5 - E5 - F5 - - - E5 - D5 - E5 - - - - - - - A5 - - - E5 - - - C6 - D6 - E6 - C6 - B5 - - - G5 - A5 - - - - - - -') },
        { w: 'square', v: 0.05, n: P(rep('A4 C5 E5 C5', 4) + ' ' + rep('F4 A4 C5 A4', 2) + ' ' + rep('G4 B4 D5 B4', 2) + ' ' + rep('A4 C5 E5 C5', 4) + ' ' + rep('E4 G#4 B4 G#4', 4)) },
        { w: 'triangle', v: 0.28, n: P(rep('A2 - - - A2 - E2 -', 2) + ' ' + rep('F2 - - - G2 - - -', 1) + ' ' + rep('A2 - - - A2 - E2 -', 2) + ' ' + rep('E2 - - - E2 - B1 -', 2)) },
        { w: 'drum', v: 0.35, n: P(rep('k . . h s . . h k . h . s . h .', 4)) },
      ],
    },
    sky: {
      bpm: 132,
      ch: [
        { w: 'square', v: 0.11, n: P('G5 - D5 - G5 - A5 - B5 - - - A5 - G5 - E5 - - - D5 - E5 - G5 - - - - - C6 - B5 - A5 - G5 - A5 - B5 - D6 - - - B5 - A5 - G5 - - - - - - -') },
        { w: 'square', v: 0.05, n: P(rep('G4 B4 D5 B4', 4) + ' ' + rep('C4 E4 G4 E4', 4) + ' ' + rep('A3 C4 E4 C4', 4) + ' ' + rep('D4 F#4 A4 F#4', 4)) },
        { w: 'triangle', v: 0.3, n: P(rep('G2 - G3 - D3 - G3 -', 2) + ' ' + rep('C2 - C3 - G2 - C3 -', 2) + ' ' + rep('A1 - A2 - E2 - A2 -', 2) + ' ' + rep('D2 - D3 - A2 - D3 -', 2)) },
        { w: 'drum', v: 0.45, n: P(rep('k . h . s . h k k . h . s h h h', 4)) },
      ],
    },
    boss: {
      bpm: 160,
      ch: [
        { w: 'square', v: 0.13, n: P('A4 A4 C5 A4 D#5 - D5 - C5 - A4 - G4 - A4 - A4 A4 C5 A4 D#5 - D5 - C5 - D5 - E5 - - - A5 - G5 - D#5 - D5 - C5 - D5 - D#5 - D5 - C5 - A4 - G4 - A4 - - - - -') },
        { w: 'sawtooth', v: 0.06, n: P(rep('A2 A3 A2 A3', 8) + ' ' + rep('F2 F3 F2 F3', 4) + ' ' + rep('G2 G3 G2 G3', 4)) },
        { w: 'triangle', v: 0.32, n: P(rep('A1 A1 A2 A1', 8) + ' ' + rep('F1 F1 F2 F1', 4) + ' ' + rep('G1 G1 G2 G1', 4)) },
        { w: 'drum', v: 0.55, n: P(rep('k k s . k h s h k k s . k s s s', 4)) },
      ],
    },
    shop: {
      bpm: 104,
      ch: [
        { w: 'square', v: 0.11, n: P('C5 - E5 - G5 - E5 - F5 - A5 - G5 - - - E5 - G5 - C6 - B5 - A5 - G5 - E5 - D5 - C5 - E5 - G5 - E5 - F5 - A5 - C6 - - - B5 - G5 - D5 - F5 - E5 - - - - - - -') },
        { w: 'triangle', v: 0.3, n: P('C3 - G2 - C3 - G2 - F2 - C3 - F2 - C3 - C3 - G2 - C3 - G2 - F2 - C3 - G2 - B2 - C3 - G2 - C3 - G2 - F2 - C3 - F2 - A2 - G2 - D3 - G2 - B2 - C3 - G2 - C3 - - -') },
        { w: 'drum', v: 0.35, n: P(rep('k . h . s . h .', 8)) },
      ],
    },
    ending: {
      bpm: 92,
      ch: [
        { w: 'triangle', v: 0.25, n: P('E5 - - - D5 - C5 - D5 - - - G4 - - - C5 - - - D5 - E5 - G5 - - - E5 - - - A5 - - - G5 - E5 - D5 - - - C5 - D5 - E5 - - - D5 - - - C5 - - - - - - - - - - - - - - -') },
        { w: 'square', v: 0.05, n: P(rep('C4 E4 G4 E4', 4) + ' ' + rep('A3 C4 E4 C4', 4) + ' ' + rep('F3 A3 C4 A3', 4) + ' ' + rep('G3 B3 D4 B3', 4)) },
        { w: 'triangle', v: 0.25, n: P('C2 - - - - - - - C3 - - - - - - - A1 - - - - - - - A2 - - - - - - - F1 - - - - - - - F2 - - - - - - - G1 - - - - - - - G2 - - - - - - -') },
      ],
    },
  };

  let curTrack = null, pendingTrack = null, step = 0, nextTime = 0, timer = null, trackGain = null;
  function playNote(ch, i, t, stepDur, out) {
    const tok = ch.n[i % ch.n.length];
    if (tok === '.' || tok === '-') return;
    if (ch.w === 'drum') {
      const g = ctx.createGain();
      g.connect(out);
      if (tok === 'k') {
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(150, t);
        o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
        const og = ctx.createGain();
        og.gain.setValueAtTime(ch.v * 1.4, t);
        og.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        o.connect(og).connect(out);
        o.start(t); o.stop(t + 0.16);
      } else {
        const s = ctx.createBufferSource();
        s.buffer = noiseBuf;
        const f = ctx.createBiquadFilter();
        f.type = tok === 'h' ? 'highpass' : 'bandpass';
        f.frequency.value = tok === 'h' ? 7000 : 1800;
        const dur = tok === 'h' ? 0.04 : 0.12;
        g.gain.setValueAtTime(ch.v * (tok === 'h' ? 0.35 : 0.8), t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        s.connect(f).connect(g);
        s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.01);
      }
      return;
    }
    let len = 1;
    while (ch.n[(i + len) % ch.n.length] === '-' && len < 32) len++;
    const f = freq(tok);
    if (!f) return;
    const o = ctx.createOscillator();
    o.type = ch.w;
    o.frequency.value = f;
    const g = ctx.createGain();
    const end = t + len * stepDur * 0.92;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(ch.v, t + 0.008);
    g.gain.setValueAtTime(ch.v, Math.max(t + 0.01, end - 0.04));
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    o.connect(g).connect(out);
    o.start(t); o.stop(end + 0.02);
  }
  function scheduler() {
    if (!ctx || !curTrack) return;
    const tr = tracks[curTrack];
    const stepDur = 60 / tr.bpm / 4;
    while (nextTime < ctx.currentTime + 0.12) {
      for (const ch of tr.ch) playNote(ch, step, nextTime, stepDur, trackGain);
      step++;
      nextTime += stepDur;
    }
  }
  A.music = (name, force) => {
    pendingTrack = name;
    if (!ctx) return;
    if (curTrack === name && !force) return;
    A.stopMusic();
    pendingTrack = name;
    curTrack = name;
    if (!name || !tracks[name]) return;
    trackGain = ctx.createGain();
    trackGain.connect(musicBus);
    step = 0;
    nextTime = ctx.currentTime + 0.05;
    timer = setInterval(scheduler, 25);
    scheduler();
  };
  A.stopMusic = (fade = 0.15) => {
    if (timer) clearInterval(timer);
    timer = null;
    if (trackGain && ctx) {
      const g = trackGain;
      g.gain.setValueAtTime(g.gain.value, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0, ctx.currentTime + fade);
      setTimeout(() => g.disconnect(), fade * 1000 + 300);
    }
    trackGain = null;
    curTrack = null;
    pendingTrack = null;
  };
  A.current = () => curTrack;
  return A;
})();
