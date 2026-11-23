(() => {
  'use strict';
  const UBG = (window.UBG = window.UBG || {});

  UBG.rand = (a, b) => a + Math.random() * (b - a);
  UBG.clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  UBG.soundOn = true;
  UBG.shakeOn = true;
  UBG.volume = 0.7;
  UBG.bgmStep = 0;

  let audio = null;
  let masterGain = null;
  let bgmTimer = null;

  try {
    UBG.soundOn = localStorage.getItem('ubg_sound') !== '0';
    UBG.shakeOn = localStorage.getItem('ubg_shake') !== '0';
    const savedVol = Number(localStorage.getItem('ubg_volume'));
    if (!Number.isNaN(savedVol)) UBG.volume = UBG.clamp(savedVol, 0, 1);
  } catch (e) {}

  function ensureAudio() {
    if (audio) {
      if (audio.state === 'suspended') audio.resume().catch(() => {});
      if (masterGain) masterGain.gain.value = UBG.soundOn ? UBG.volume : 0;
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      audio = new AC();
      masterGain = audio.createGain();
      masterGain.gain.value = UBG.soundOn ? UBG.volume : 0;
      masterGain.connect(audio.destination);
      if (audio.state === 'suspended') audio.resume().catch(() => {});
      return true;
    } catch (e) {
      return false;
    }
  }

  UBG.syncVolumeUI = function () {
    const volSlider = document.getElementById('ubg-volume');
    const volLabel = document.getElementById('ubg-vol-label');
    if (!volSlider || !volLabel) return;
    const pct = Math.round(UBG.volume * 100);
    volSlider.value = String(pct);
    volLabel.textContent = pct + '%';
    volLabel.style.color = UBG.soundOn && pct > 0 ? '#22d3ee' : '#94a3b8';
    if (masterGain) {
      masterGain.gain.setTargetAtTime(UBG.soundOn ? UBG.volume : 0, audio?.currentTime || 0, 0.02);
    }
  };

  UBG.sound = function (type) {
    if (!UBG.soundOn || UBG.volume <= 0 || !ensureAudio()) return;
    try {
      const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime;
      o.connect(g);
      g.connect(masterGain);
      const cfg = {
        shot: [760, 170, 0.07, 'sawtooth', 0.038],
        hit: [240, 110, 0.09, 'triangle', 0.055],
        boom: [130, 28, 0.34, 'square', 0.115],
        turretBoom: [165, 24, 0.44, 'sawtooth', 0.125],
        pickup: [480, 1050, 0.2, 'sine', 0.1],
        warning: [170, 340, 0.4, 'sawtooth', 0.08],
        boss: [100, 55, 0.5, 'sawtooth', 0.09],
        combo: [500, 950, 0.13, 'sine', 0.08],
        boost: [240, 1120, 0.24, 'sawtooth', 0.085],
        laser: [980, 420, 0.08, 'sawtooth', 0.035],
        graze: [1180, 1560, 0.05, 'sine', 0.04],
        telegraph: [320, 640, 0.18, 'sawtooth', 0.06],
        upgrade: [420, 1260, 0.26, 'triangle', 0.09],
        clutch: [620, 140, 0.38, 'sine', 0.09],
        missile: [340, 880, 0.16, 'sawtooth', 0.05],
        chrono: [520, 68, 0.48, 'sine', 0.11],
        nova: [185, 30, 0.5, 'square', 0.12]
      };
      const c = cfg[type] || cfg.hit;
      o.type = c[3];
      o.frequency.setValueAtTime(c[0], t);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, c[1]), t + c[2]);
      g.gain.setValueAtTime(Math.max(0.0002, c[4]), t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + c[2]);
      o.start(t);
      o.stop(t + c[2]);
    } catch (e) {}
  };

  UBG.playBgmStep = function () {
    if (UBG.state !== 'PLAYING' || !UBG.soundOn || UBG.volume <= 0 || !ensureAudio()) return;
    try {
      const t = audio.currentTime;
      const step = UBG.bgmStep % 16;
      const isBoss = Boolean(UBG.boss);
      const bassNotes = isBoss
        ? [55, 55, 65.41, 55, 73.42, 73.42, 65.41, 49]
        : [55, 55, 55, 65.41, 73.42, 73.42, 82.41, 65.41];
      const arpNotes = isBoss
        ? [220, 261.63, 329.63, 392, 440, 392, 329.63, 261.63]
        : [220, 277.18, 329.63, 440, 329.63, 277.18, 329.63, 493.88];

      if (step % 4 === 0 || (isBoss && step === 10)) {
        const kickOsc = audio.createOscillator(), kickGain = audio.createGain();
        kickOsc.type = 'sine';
        kickOsc.frequency.setValueAtTime(isBoss ? 145 : 130, t);
        kickOsc.frequency.exponentialRampToValueAtTime(34, t + 0.12);
        kickGain.gain.setValueAtTime(0.24, t);
        kickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
        kickOsc.connect(kickGain);
        kickGain.connect(masterGain);
        kickOsc.start(t);
        kickOsc.stop(t + 0.14);
      }

      const bassOsc = audio.createOscillator(), bassGain = audio.createGain(), bassFilter = audio.createBiquadFilter();
      bassOsc.type = 'sawtooth';
      const bFreq = bassNotes[step % bassNotes.length] * (step % 2 === 1 ? 1 : 0.5);
      bassOsc.frequency.setValueAtTime(bFreq, t);
      bassFilter.type = 'lowpass';
      bassFilter.frequency.setValueAtTime(isBoss ? 620 : 460, t);
      bassGain.gain.setValueAtTime(0.085, t);
      bassGain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      bassOsc.connect(bassFilter);
      bassFilter.connect(bassGain);
      bassGain.connect(masterGain);
      bassOsc.start(t);
      bassOsc.stop(t + 0.15);

      const arpOsc = audio.createOscillator(), arpGain = audio.createGain();
      arpOsc.type = isBoss ? 'square' : 'triangle';
      arpOsc.frequency.setValueAtTime(arpNotes[step % arpNotes.length], t);
      arpGain.gain.setValueAtTime(isBoss ? 0.035 : 0.045, t);
      arpGain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
      arpOsc.connect(arpGain);
      arpGain.connect(masterGain);
      arpOsc.start(t);
      arpOsc.stop(t + 0.12);

      if (step % 2 === 1 || step === 4 || step === 12) {
        const len = Math.floor(audio.sampleRate * 0.045);
        const buf = audio.createBuffer(1, len, audio.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.35));
        const noise = audio.createBufferSource();
        noise.buffer = buf;
        const filter = audio.createBiquadFilter();
        filter.type = (step === 4 || step === 12) ? 'bandpass' : 'highpass';
        filter.frequency.setValueAtTime((step === 4 || step === 12) ? 1400 : 6500, t);
        const nGain = audio.createGain();
        nGain.gain.setValueAtTime((step === 4 || step === 12) ? 0.09 : 0.032, t);
        nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
        noise.connect(filter);
        filter.connect(nGain);
        nGain.connect(masterGain);
        noise.start(t);
      }

      UBG.bgmStep++;
    } catch (e) {}
  };

  UBG.updateBgmLoop = function () {
    if (bgmTimer) {
      clearInterval(bgmTimer);
      bgmTimer = null;
    }
    if (UBG.state === 'PLAYING' && UBG.soundOn && UBG.volume > 0) {
      const tempoMs = UBG.boss ? 115 : 132;
      UBG.playBgmStep();
      bgmTimer = setInterval(UBG.playBgmStep, tempoMs);
    }
  };
})();
