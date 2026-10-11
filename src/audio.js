'use strict';
// Звук: синтез в духе NES/SNES. Музыка строится от аккордовой сетки:
// бас, арпеджио и барабаны генерируются из аккордов, мелодия написана вручную.
// Все каналы одной длины — гармония никогда не «разъезжается».
G.Audio = (() => {
  let ctx = null, master, sfxBus, musicBus, echoIn, noiseBuf, pulses = {};
  const A = {};

  A.init = () => {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    // мастер: мягкий срез верхов + компрессор
    master = ctx.createGain();
    master.gain.value = 0.8;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 7500; lp.Q.value = 0.5;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.2;
    master.connect(lp).connect(comp).connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.connect(master);
    // эхо для ведущих партий
    echoIn = ctx.createGain();
    const delay = ctx.createDelay(1); delay.delayTime.value = 0.28;
    const fb = ctx.createGain(); fb.gain.value = 0.3;
    const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2600;
    const wet = ctx.createGain(); wet.gain.value = 0.32;
    echoIn.connect(delay); delay.connect(dlp).connect(fb).connect(delay); dlp.connect(wet).connect(musicBus);
    A.echoDelay = delay;
    // пульс-волны с ограниченным числом гармоник (мягче «сырых» квадратов)
    for (const d of [0.125, 0.25, 0.5]) {
      const N = 24, re = new Float32Array(N), im = new Float32Array(N);
      for (let n = 1; n < N; n++) re[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * d) * Math.pow(0.92, n);
      pulses[d] = ctx.createPeriodicWave(re, im);
    }
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    A.applyVolumes();
    if (pendingTrack) A.music(pendingTrack, true);
  };
  A.applyVolumes = () => {
    if (!ctx) return;
    sfxBus.gain.value = G.Save.data.sfx * 0.55;
    musicBus.gain.value = G.Save.data.music * 0.42;
  };

  // --- примитивы ---------------------------------------------------------------
  function osc(type, f, t) {
    const o = ctx.createOscillator();
    if (type === 'p12' || type === 'p25' || type === 'p50') o.setPeriodicWave(pulses[{ p12: 0.125, p25: 0.25, p50: 0.5 }[type]]);
    else o.type = type;
    o.frequency.setValueAtTime(f, t);
    return o;
  }
  function tone({ type = 'p25', f = 440, f2 = null, dur = 0.1, vol = 0.2, at = 0, attack = 0.004, curve = 'exp', vib = 0, out }) {
    if (!ctx) return;
    const t = ctx.currentTime + at;
    const o = osc(type, f, t), g = ctx.createGain();
    if (f2) curve === 'exp' ? o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur) : o.frequency.linearRampToValueAtTime(f2, t + dur);
    if (vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 18; lg.gain.value = vib; l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + dur + 0.05); }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out || sfxBus);
    o.start(t); o.stop(t + dur + 0.03);
  }
  function noise({ dur = 0.2, vol = 0.2, at = 0, f = 2000, f2 = 300, q = 0.8, type = 'lowpass', out }) {
    if (!ctx) return;
    const t = ctx.currentTime + at;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.Q.value = q;
    fl.frequency.setValueAtTime(f, t);
    fl.frequency.exponentialRampToValueAtTime(Math.max(30, f2), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl).connect(g).connect(out || sfxBus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03);
  }
  const N = (name) => { const m = /^([A-G])(#|b)?(-?\d)$/.exec(name); const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]]; return 12 * (+m[3] + 1) + base + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); };
  const HZ = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
  const seq = (notes, step, opts) => notes.forEach((n, i) => n && tone(Object.assign({ f: HZ(N(n)), dur: step * 1.1, at: i * step }, opts)));

  // --- Звуковые эффекты (мягкие, «приставочные») -----------------------------------
  const sfx = {
    jump: () => tone({ type: 'p25', f: 300, f2: 620, dur: 0.11, vol: 0.13 }),
    land: () => noise({ dur: 0.05, vol: 0.1, f: 500, f2: 120 }),
    shoot: () => { tone({ type: 'p12', f: 1100, f2: 700, dur: 0.07, vol: 0.09 }); tone({ type: 'triangle', f: 1600, f2: 1200, dur: 0.05, vol: 0.06 }); },
    bigshot: () => { tone({ type: 'triangle', f: 260, f2: 90, dur: 0.32, vol: 0.22 }); tone({ type: 'p25', f: 700, f2: 180, dur: 0.25, vol: 0.08 }); noise({ dur: 0.25, vol: 0.08, f: 2500, f2: 300 }); },
    charge: () => tone({ type: 'triangle', f: 330, f2: 660, dur: 0.45, vol: 0.06, curve: 'lin' }),
    charged: () => seq(['E6', 'B6'], 0.05, { type: 'p25', vol: 0.06 }),
    spear: () => { noise({ dur: 0.13, vol: 0.1, f: 3500, f2: 900, type: 'bandpass', q: 1.2 }); tone({ type: 'triangle', f: 520, f2: 300, dur: 0.12, vol: 0.1 }); },
    stick: () => { tone({ type: 'triangle', f: 220, f2: 110, dur: 0.08, vol: 0.16 }); noise({ dur: 0.05, vol: 0.1, f: 2200, f2: 800 }); },
    recall: () => tone({ type: 'p25', f: 400, f2: 800, dur: 0.12, vol: 0.07 }),
    hit: () => { tone({ type: 'p25', f: 260, f2: 120, dur: 0.07, vol: 0.12 }); noise({ dur: 0.05, vol: 0.08, f: 1800, f2: 600 }); },
    kill: () => { tone({ type: 'p25', f: 520, f2: 130, dur: 0.18, vol: 0.12 }); noise({ dur: 0.2, vol: 0.12, f: 1400, f2: 150 }); },
    hurt: () => { tone({ type: 'p50', f: 520, f2: 160, dur: 0.22, vol: 0.12, vib: 25 }); },
    coin: () => { tone({ type: 'p25', f: 988, dur: 0.05, vol: 0.09 }); tone({ type: 'p25', f: 1319, dur: 0.16, vol: 0.09, at: 0.05 }); },
    bigcoin: () => seq(['C6', 'E6', 'G6', 'C7'], 0.045, { type: 'p25', vol: 0.08 }),
    heart: () => seq(['C5', 'E5', 'G5', 'C6'], 0.07, { type: 'triangle', vol: 0.2 }),
    bump: () => tone({ type: 'triangle', f: 160, f2: 110, dur: 0.07, vol: 0.18 }),
    brick: () => { noise({ dur: 0.2, vol: 0.18, f: 1200, f2: 120 }); tone({ type: 'triangle', f: 130, f2: 60, dur: 0.12, vol: 0.15 }); },
    stomp: () => tone({ type: 'p25', f: 420, f2: 180, dur: 0.09, vol: 0.12 }),
    spring: () => tone({ type: 'triangle', f: 200, f2: 900, dur: 0.22, vol: 0.18, vib: 30 }),
    explode: () => { noise({ dur: 0.5, vol: 0.22, f: 900, f2: 60 }); tone({ type: 'sine', f: 110, f2: 40, dur: 0.45, vol: 0.3 }); },
    bossHit: () => { tone({ type: 'triangle', f: 150, f2: 80, dur: 0.1, vol: 0.18 }); noise({ dur: 0.07, vol: 0.1, f: 1000, f2: 300 }); },
    roar: () => { tone({ type: 'sawtooth', f: 110, f2: 70, dur: 0.8, vol: 0.12, curve: 'lin', vib: 6 }); noise({ dur: 0.8, vol: 0.1, f: 500, f2: 180 }); },
    enemyShot: () => tone({ type: 'triangle', f: 640, f2: 320, dur: 0.1, vol: 0.09 }),
    checkpoint: () => seq(['E5', 'G5', 'B5', 'E6'], 0.07, { type: 'p25', vol: 0.09 }),
    select: () => tone({ type: 'p25', f: 880, dur: 0.04, vol: 0.07 }),
    confirm: () => seq(['A5', 'E6'], 0.05, { type: 'p25', vol: 0.09 }),
    deny: () => seq(['C4', 'B3'], 0.08, { type: 'p50', vol: 0.09 }),
    buy: () => seq(['G5', 'B5', 'D6', 'G6'], 0.05, { type: 'p25', vol: 0.08 }),
    pause: () => seq(['E6', 'B5'], 0.06, { type: 'p25', vol: 0.08 }),
    eyeOpen: () => { tone({ type: 'triangle', f: 150, f2: 1200, dur: 0.7, vol: 0.15 }); seq(['E5', 'A5', 'C6', 'E6', 'A6'], 0.1, { type: 'p25', vol: 0.06, at: 0 }); },
    crumble: () => noise({ dur: 0.25, vol: 0.12, f: 700, f2: 100 }),
    lava: () => { noise({ dur: 0.3, vol: 0.15, f: 500, f2: 2000 }); tone({ type: 'triangle', f: 300, f2: 700, dur: 0.25, vol: 0.08 }); },
    die: () => seq(['B4', 'A#4', 'A4', 'G#4', null, 'G4', null, 'E4'], 0.11, { type: 'p25', vol: 0.11 }),
    teleport: () => { tone({ type: 'sine', f: 1300, f2: 250, dur: 0.25, vol: 0.1 }); tone({ type: 'sine', f: 900, f2: 2400, dur: 0.25, vol: 0.06 }); },
    laser: () => { tone({ type: 'p12', f: 90, f2: 130, dur: 1, vol: 0.08, curve: 'lin', vib: 4 }); noise({ dur: 1, vol: 0.06, f: 2600, f2: 1800, type: 'bandpass', q: 2 }); },
    ability: () => { seq(['C5', 'E5', 'G5', 'C6', 'E6', 'G6'], 0.08, { type: 'p25', vol: 0.09 }); seq(['C4', null, 'G4', null, 'C5'], 0.08, { type: 'triangle', vol: 0.2 }); },
    dash: () => { noise({ dur: 0.14, vol: 0.12, f: 2600, f2: 500, type: 'bandpass', q: 1 }); tone({ type: 'triangle', f: 500, f2: 200, dur: 0.1, vol: 0.08 }); },
    pound: () => tone({ type: 'p25', f: 900, f2: 160, dur: 0.22, vol: 0.09 }),
    text: () => tone({ type: 'p12', f: 1200 + Math.random() * 200, dur: 0.025, vol: 0.03 }),
    secret: () => seq(['G5', 'F#5', 'D#5', 'A4', 'G#4', 'E5', 'G#5', 'C6'], 0.07, { type: 'p25', vol: 0.08 }),
    clear: () => { seq(['C5', 'C5', 'C5', 'C5', 'G#4', 'A#4', 'C5', null, 'A#4', 'C5'], 0.11, { type: 'p25', vol: 0.1 }); seq(['C4', null, null, null, 'G#3', 'A#3', 'C4'], 0.11, { type: 'triangle', vol: 0.22 }); },
  };
  const last = {};
  A.play = (name) => {
    if (!ctx || !sfx[name]) return;
    const now = ctx.currentTime;
    if (last[name] && now - last[name] < 0.035) return;
    last[name] = now;
    sfx[name]();
  };

  // --- Музыка --------------------------------------------------------------------------
  // Аккорды: 'Am', 'F', 'G7', 'Cmaj7', 'Esus4', 'Bdim', с длительностью 'Am:8' (в шестнадцатых)
  const QUAL = { '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], sus4: [0, 5, 7], dim: [0, 3, 6], aug: [0, 4, 8] };
  function parseChord(s) {
    const [name, len] = s.split(':');
    const m = /^([A-G][#b]?)(maj7|m7|sus4|dim|aug|m|7)?$/.exec(name);
    const root = N(m[1] + '3');
    return { root, iv: QUAL[m[2] || ''], len: len ? +len : 16 };
  }
  // мелодия: 'E5/4 A5/2 r/2 ...' — нота/длительность в шестнадцатых (по умолчанию 2)
  function parseMelody(s) {
    const ev = [];
    let t = 0;
    for (const tok of s.trim().split(/\s+/)) {
      const [n, d] = tok.split('/');
      const len = d ? +d : 2;
      if (n !== 'r') ev.push({ t, len, midi: N(n) });
      t += len;
    }
    return { ev, len: t };
  }
  const DRUMS = {
    rock: 'k.h.s.h.k.k.s.h.', groove: 'k..hs.h.k.kh.s.h', march: 'k.h.s.h.k.h.s.hh', fast: 'k.hks.hkk.hks.hs',
    soft: 'k.......h.......', half: 'k.h.h.h.s.h.h.h.', shuffle: 'k..h..s..h.k..h.', none: '................',
    tribal: 'k..k..s.k.k..s.h',
  };

  function build(song) {
    const chords = song.chords.map(parseChord);
    const total = chords.reduce((a, c) => a + c.len, 0);
    const events = [];
    // мелодия (и вторая партия) повторяется до полной длины сетки
    for (const [key, inst, vol, oct] of [['lead', song.leadInst || 'p25', song.leadVol || 0.15, 0], ['counter', song.counterInst || 'p12', song.counterVol || 0.07, 0]]) {
      if (!song[key]) continue;
      const m = parseMelody(song[key]);
      for (let off = 0; off < total; off += m.len) for (const e of m.ev) if (off + e.t < total) events.push({ t: off + e.t, len: e.len, midi: e.midi + oct, inst, vol, echo: key === 'lead', vib: song.vib !== false });
    }
    let t = 0;
    for (const c of chords) {
      const tones = c.iv.map((i) => c.root + i);
      // бас (треугольник)
      const bv = song.bassVol || 0.34;
      const B = (st, len, midi) => events.push({ t: t + st, len, midi, inst: 'triangle', vol: bv });
      const r = c.root - 12 + (song.bassShift || 0);
      for (let s = 0; s < c.len; ) {
        switch (song.bass) {
          case 'pulse8': B(s, 2, s % 4 === 0 ? r : r + 12); s += 2; break;
          case 'walk': B(s, 4, [r, r + 7, r + 12, r + 7][(s / 4) % 4]); s += 4; break;
          case 'gallop': B(s, 1, r); B(s + 1, 1, r); B(s + 2, 2, r + 12); s += 4; break;
          case 'syncop': B(s, 3, r); B(s + 3, 3, r); B(s + 6, 2, r + 7); s += 8; break;
          case 'whole': B(s, Math.min(8, c.len - s), r); s += 8; break;
          default: B(s, 4, r); s += 4;
        }
      }
      // арпеджио / аккорды
      const av = song.arpVol || 0.05, ai = song.arpInst || 'p12', ao = 12 + (song.arpShift || 0);
      if (song.arp === 'up' || song.arp === 'up8') {
        const step = song.arp === 'up' ? 1 : 2;
        const seqn = [...tones, tones[0] + 12, ...tones.slice(1).reverse()];
        for (let s = 0, k = 0; s < c.len; s += step, k++) events.push({ t: t + s, len: step, midi: seqn[k % seqn.length] + ao, inst: ai, vol: av });
      } else if (song.arp === 'stab') {
        for (let s = 2; s < c.len; s += 4) for (const n of tones.slice(0, 3)) events.push({ t: t + s, len: 1, midi: n + ao, inst: ai, vol: av });
      } else if (song.arp === 'pad') {
        for (const n of tones.slice(0, 3)) events.push({ t, len: c.len, midi: n + ao, inst: 'pad', vol: av });
      }
      t += c.len;
    }
    // барабаны
    const pat = DRUMS[song.drums || 'none'];
    for (let s = 0; s < total; s++) {
      let ch = pat[s % 16];
      if (song.fill && s % (16 * 4) >= 16 * 4 - 4 && ch === '.') ch = 's';
      if (ch !== '.') events.push({ t: s, drum: ch, vol: song.drumVol || 0.5 });
    }
    events.sort((a, b) => a.t - b.t);
    return { events, total, stepDur: 60 / song.bpm / 4 };
  }

  function playEvent(e, time, stepDur, out) {
    if (e.drum) {
      const g = ctx.createGain(); g.connect(out);
      if (e.drum === 'k') {
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(120, time); o.frequency.exponentialRampToValueAtTime(42, time + 0.11);
        const og = ctx.createGain();
        og.gain.setValueAtTime(e.vol * 0.9, time); og.gain.exponentialRampToValueAtTime(0.001, time + 0.16);
        o.connect(og).connect(out); o.start(time); o.stop(time + 0.17);
      } else {
        const s = ctx.createBufferSource(); s.buffer = noiseBuf;
        const f = ctx.createBiquadFilter();
        const isHat = e.drum === 'h';
        f.type = isHat ? 'highpass' : 'bandpass'; f.frequency.value = isHat ? 8000 : 1500; f.Q.value = isHat ? 0.7 : 0.9;
        const dur = isHat ? 0.035 : 0.14;
        g.gain.setValueAtTime(e.vol * (isHat ? 0.16 : 0.42), time);
        g.gain.exponentialRampToValueAtTime(0.001, time + dur);
        s.connect(f).connect(g); s.start(time, Math.random() * 0.5); s.stop(time + dur + 0.01);
        if (!isHat) {
          const o = ctx.createOscillator(), og = ctx.createGain();
          o.type = 'triangle'; o.frequency.setValueAtTime(220, time); o.frequency.exponentialRampToValueAtTime(140, time + 0.06);
          og.gain.setValueAtTime(e.vol * 0.25, time); og.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
          o.connect(og).connect(out); o.start(time); o.stop(time + 0.09);
        }
      }
      return;
    }
    const f = HZ(e.midi);
    const dur = e.len * stepDur;
    const end = time + dur * (e.inst === 'triangle' ? 0.95 : 0.9);
    const isPad = e.inst === 'pad';
    const o = osc(isPad ? 'triangle' : e.inst, f, time);
    const g = ctx.createGain();
    const att = isPad ? 0.12 : 0.006;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(e.vol, time + att);
    if (!isPad && e.inst !== 'triangle') g.gain.exponentialRampToValueAtTime(e.vol * 0.7, time + Math.min(0.15, dur * 0.6));
    g.gain.setValueAtTime(isPad || e.inst === 'triangle' ? e.vol : e.vol * 0.7, Math.max(time + att + 0.001, end - 0.04));
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    if (e.vib && dur > 0.25) {
      const l = ctx.createOscillator(), lg = ctx.createGain();
      l.frequency.value = 5.5; lg.gain.setValueAtTime(0, time); lg.gain.linearRampToValueAtTime(f * 0.006, time + 0.25);
      l.connect(lg).connect(o.frequency); l.start(time); l.stop(end + 0.05);
    }
    o.connect(g).connect(out);
    if (e.echo) g.connect(echoIn);
    o.start(time); o.stop(end + 0.03);
  }

  // ---- Песни -----------------------------------------------------------------------
  const SONGS = {
    title: {
      bpm: 120, chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'E'], bass: 'walk', arp: 'up', drums: 'march', fill: true,
      lead: 'E5/4 A5/4 G5/2 E5/2 C5/4  C5/4 F5/4 A5/2 G5/2 F5/4  G4/2 C5/2 E5/4 G5/4 E5/4  D5/8 B4/4 G4/4  E5/4 A5/4 B5/2 C6/2 B5/4  A5/4 F5/4 A5/2 G5/2 F5/4  G5/4 D5/4 B4/4 D5/4  E5/12 r/4',
    },
    city: {
      bpm: 138, chords: ['Em', 'C', 'D', 'Bm', 'Em', 'C', 'D', 'D'], bass: 'pulse8', arp: 'up8', arpVol: 0.04, drums: 'rock', fill: true,
      lead: 'B4/2 E5/2 G5/2 B5/4 A5/2 G5/2 F#5/2  G5/4 E5/4 C5/2 E5/2 G5/4  F#5/2 A5/2 D6/4 C6/2 A5/2 F#5/4  D5/4 B4/4 F#5/6 r/2  B4/2 E5/2 G5/2 B5/4 D6/2 B5/2 G5/2  C6/4 B5/2 G5/2 E5/4 G5/4  A5/4 F#5/2 D5/2 E5/2 F#5/2 A5/4  D5/10 r/6',
    },
    sewer: {
      bpm: 112, chords: ['Dm', 'Bb', 'Gm', 'A', 'Dm', 'Bb', 'Gm', 'A'], bass: 'syncop', arp: 'stab', arpVol: 0.035, drums: 'groove', leadInst: 'p12', leadVol: 0.13,
      lead: 'D5/2 r/2 F5/2 r/2 A5/4 G5/2 F5/2  D5/4 F5/2 D5/2 Bb4/8  G4/2 Bb4/2 D5/4 Bb4/2 A4/2 G4/4  C#5/4 E5/4 A5/8  A5/4 F5/2 A5/2 D6/4 C6/2 A5/2  Bb5/4 A5/2 F5/2 D5/8  G5/2 F5/2 D5/2 Bb4/2 D5/4 G5/4  E5/2 C#5/2 A4/4 r/8',
    },
    ruins: {
      bpm: 124, chords: ['G', 'F', 'C', 'G', 'G', 'F', 'C', 'D'], bass: 'pulse8', arp: 'up8', arpVol: 0.04, drums: 'tribal', fill: true,
      lead: 'D5/2 G5/2 B5/4 A5/2 G5/2 D5/4  C5/2 F5/2 A5/4 G5/2 F5/2 C5/4  E5/4 G5/4 C6/4 B5/2 G5/2  B5/8 A5/4 G5/4  D6/4 B5/2 G5/2 D5/4 G5/4  F5/4 A5/2 C6/2 A5/4 F5/4  G5/4 E5/2 C5/2 E5/2 G5/2 C6/4  A5/4 F#5/4 D5/8',
    },
    cave: {
      bpm: 84, chords: ['Em', 'Cmaj7', 'Am', 'B', 'Em', 'Cmaj7', 'Am', 'B'], bass: 'whole', arp: 'up8', arpInst: 'triangle', arpVol: 0.07, drums: 'soft', drumVol: 0.35, leadInst: 'p12', leadVol: 0.12,
      lead: 'B5/6 G5/2 E5/8  B5/4 G5/4 E5/4 C5/4  A5/6 C6/2 E5/8  D#5/4 F#5/4 B5/8  E6/6 D6/2 B5/8  C6/4 B5/4 G5/8  A5/4 E5/4 C5/4 A4/4  B4/16',
    },
    ice: {
      bpm: 100, chords: ['F#m', 'D', 'A', 'E', 'F#m', 'D', 'A', 'E'], bass: 'whole', arp: 'up', arpInst: 'p12', arpVol: 0.035, arpShift: 12, drums: 'half', drumVol: 0.35, leadInst: 'triangle', leadVol: 0.24,
      lead: 'C#6/4 A5/4 F#5/4 A5/4  F#5/6 E5/2 D5/8  E5/4 A5/4 C#6/4 B5/4  B5/8 G#5/4 E5/4  F#5/2 A5/2 C#6/4 E6/4 C#6/4  D6/4 C#6/2 A5/2 F#5/8  E5/4 A5/4 B5/4 C#6/4  B5/12 r/4',
    },
    volcano: {
      bpm: 148, chords: ['Cm', 'Ab', 'Bb', 'G', 'Cm', 'Ab', 'Bb', 'G'], bass: 'gallop', arp: 'stab', arpVol: 0.04, drums: 'fast', fill: true,
      lead: 'C5/2 C5/2 Eb5/2 G5/2 C6/4 G5/2 Eb5/2  Ab5/4 G5/2 Eb5/2 C5/8  D5/2 F5/2 Bb5/4 F5/2 Bb5/2 D6/4  B5/8 D6/4 G5/4  G5/2 C6/2 Eb6/4 D6/2 C6/2 G5/4  Ab5/4 C6/4 Eb6/4 C6/4  D6/4 Bb5/4 F5/4 D5/4  B4/2 D5/2 G5/4 B5/8',
    },
    sky: {
      bpm: 128, chords: ['D', 'G', 'Bm', 'A', 'G', 'A', 'D', 'D'], bass: 'pulse8', arp: 'up', arpVol: 0.035, drums: 'rock', fill: true,
      lead: 'A5/4 F#5/2 A5/2 D6/8  B5/4 G5/2 B5/2 D6/4 B5/4  F#5/4 D5/2 F#5/2 B5/6 A5/2  E5/4 C#6/4 A5/8  D6/4 B5/4 G5/4 B5/4  C#6/4 A5/4 E5/4 A5/4  F#5/2 A5/2 D6/4 E6/4 F#6/4  D6/12 r/4',
    },
    temple: {
      bpm: 100, chords: ['Bm', 'G', 'Em', 'F#', 'Bm', 'G', 'Em', 'F#'], bass: 'walk', arp: 'pad', arpVol: 0.06, drums: 'half', drumVol: 0.4, leadInst: 'p25', leadVol: 0.13,
      lead: 'B4/4 D5/4 F#5/6 E5/2  D5/4 B4/4 G4/8  E5/4 G5/4 B5/4 A5/2 G5/2  A#5/8 F#5/4 C#5/4  F#5/4 B5/4 D6/6 C#6/2  B5/4 G5/4 D5/8  E5/2 G5/2 B5/4 E6/4 D6/4  C#6/4 A#5/4 F#5/8',
    },
    boss: {
      bpm: 160, chords: ['Am', 'Am', 'F', 'G', 'Am', 'Am', 'F', 'E'], bass: 'gallop', arp: 'up', arpVol: 0.035, drums: 'fast', fill: true,
      lead: 'A4/2 A4/2 C5/2 A4/2 E5/4 D5/2 C5/2  A4/2 A4/2 C5/2 E5/2 A5/4 G5/4  F5/4 E5/2 C5/2 A4/4 C5/4  B4/4 D5/4 G5/4 F5/4  A5/2 A5/2 G5/2 E5/2 C6/4 B5/2 A5/2  E5/2 A5/2 C6/2 E6/2 C6/4 A5/4  C6/4 A5/2 F5/2 A5/4 C6/4  B5/4 G#5/4 E5/8',
    },
    shop: {
      bpm: 96, chords: ['F', 'Dm', 'Bb', 'C', 'F', 'Dm', 'Bb', 'C'], bass: 'walk', arp: 'up8', arpInst: 'triangle', arpVol: 0.06, drums: 'shuffle', drumVol: 0.35, leadInst: 'p12', leadVol: 0.12,
      lead: 'C5/2 F5/2 A5/4 G5/2 F5/2 C5/4  D5/4 F5/4 A5/6 G5/2  F5/4 D5/2 F5/2 Bb5/4 A5/4  G5/8 E5/4 C5/4  A5/4 C6/4 A5/2 F5/2 C5/4  D5/2 F5/2 A5/4 D6/4 C6/4  Bb5/4 A5/4 F5/4 D5/4  E5/4 G5/4 C6/8',
    },
    ending: {
      bpm: 84, chords: ['C', 'Am', 'F', 'G', 'C', 'Am', 'F', 'G'], bass: 'whole', arp: 'pad', arpVol: 0.06, drums: 'soft', drumVol: 0.3, leadInst: 'triangle', leadVol: 0.26,
      lead: 'E5/8 D5/4 C5/4  C5/4 E5/4 A5/8  A5/6 G5/2 F5/8  G5/8 B4/4 D5/4  C6/8 B5/4 G5/4  A5/8 E5/4 C5/4  F5/4 A5/4 C6/4 A5/4  G5/16',
    },
  };

  let cur = null, pendingTrack = null, built = null, step = 0, nextTime = 0, timer = null, trackGain = null, evIdx = 0;
  function scheduler() {
    if (!ctx || !built) return;
    const { events, total, stepDur } = built;
    while (nextTime < ctx.currentTime + 0.15) {
      const s = step % total;
      if (s === 0) evIdx = 0;
      while (evIdx < events.length && events[evIdx].t === s) { playEvent(events[evIdx], nextTime, stepDur, trackGain); evIdx++; }
      step++;
      nextTime += stepDur;
    }
  }
  A.music = (name, force) => {
    pendingTrack = name;
    if (!ctx) return;
    if (cur === name && !force) return;
    A.stopMusic(0.1);
    pendingTrack = name;
    cur = name;
    if (!SONGS[name]) return;
    built = build(SONGS[name]);
    A.echoDelay.delayTime.value = built.stepDur * 3;
    trackGain = ctx.createGain();
    trackGain.connect(musicBus);
    step = 0; evIdx = 0;
    nextTime = ctx.currentTime + 0.06;
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
    trackGain = null; cur = null; built = null; pendingTrack = null;
  };
  A.current = () => cur;
  A._songs = SONGS; A._build = build;
  return A;
})();
