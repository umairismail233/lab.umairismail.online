// audio.js. All SFX and music are synthesized with WebAudio. No audio files.
export class AudioSys {
  constructor() {
    this.ctx = null; this.master = null; this.musicGain = null; this.sfxGain = null;
    this.worldGain = null; this.musicTimer = null; this.mode = 'off';
    this.step = 0; this.nextTime = 0; this.muted = false; this.paused = false;
    this.noiseBuf = null;
  }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.8; this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = 0.30; this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = 0.9; this.sfxGain.connect(this.master);
    this.worldGain = this.ctx.createGain(); this.worldGain.gain.value = 0.5; this.worldGain.connect(this.master);
    const len = this.ctx.sampleRate * 1.2;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  now() { return this.ctx ? this.ctx.currentTime : 0; }
  blip(freq, dur, type, vol, dest, slideTo) {
    if (!this.ctx) return;
    const t = this.now();
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol || 0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(dest || this.sfxGain); o.start(t); o.stop(t + dur + 0.02);
  }
  noise(dur, vol, freq, q, dest) {
    if (!this.ctx) return;
    const t = this.now();
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq || 1200; f.Q.value = q || 0.8;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(vol || 0.4, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || this.sfxGain); s.start(t); s.stop(t + dur + 0.02);
  }
  shot(kind) {
    if (!this.ctx || this.paused) return;
    // Randomised pitch per shot, so repeated fire never sounds like a
    // looped sample: each shot is a few percent higher or lower.
    const p = 0.94 + Math.random() * 0.12;
    if (kind === 'rifle') { this.noise(0.09, 0.55, 1800 * p, 0.6); this.blip(160 * p, 0.08, 'square', 0.22, this.sfxGain, 60 * p); }
    else if (kind === 'shotgun') {
      this.noise(0.22, 0.7, 700 * p, 0.5); this.blip(110 * p, 0.18, 'square', 0.3, this.sfxGain, 45 * p);
      // Low boom tail: a sub thump that rings after the crack, so the
      // shotgun reads heavier than the rifle instead of just louder.
      this.blip(55 * p, 0.45, 'sine', 0.5, this.sfxGain, 30);
      this.noise(0.4, 0.35, 160, 0.4);
    }
    else if (kind === 'rocket') { this.noise(0.5, 0.5, 500 * p, 0.4); this.blip(90 * p, 0.4, 'sawtooth', 0.25, this.sfxGain, 200 * p); }
    else if (kind === 'enemy') { this.noise(0.07, 0.25, 1400 * p, 0.7); }
    else if (kind === 'dog') { this.noise(0.05, 0.3, 2400 * p, 1.2); }
  }
  explosion(big) {
    if (!this.ctx || this.paused) return;
    this.noise(big ? 1.1 : 0.7, 0.9, 220, 0.4); this.blip(70, big ? 0.9 : 0.5, 'sine', 0.7, this.sfxGain, 28);
  }
  reload() { this.blip(500, 0.06, 'square', 0.12); setTimeout(() => this.blip(700, 0.06, 'square', 0.12), 180); setTimeout(() => this.blip(420, 0.08, 'square', 0.15), 420); }
  pickup() { this.blip(660, 0.09, 'sine', 0.25); setTimeout(() => this.blip(990, 0.14, 'sine', 0.25), 80); }
  hitmarker(head) { this.blip(head ? 1500 : 1100, 0.05, 'square', 0.18); }
  headshot() { this.blip(1800, 0.07, 'square', 0.22); setTimeout(() => this.blip(2400, 0.1, 'square', 0.2), 60); }
  hurt() { this.blip(140, 0.18, 'sawtooth', 0.3, this.sfxGain, 70); this.noise(0.12, 0.25, 300, 0.5); }
  armorBreak() { this.noise(0.35, 0.5, 3200, 2); this.blip(300, 0.3, 'square', 0.25, this.sfxGain, 90); }
  armorRecharge() { this.blip(520, 0.25, 'sine', 0.10); }
  footstep(run) { if (!this.ctx || this.paused) return; this.noise(0.05, run ? 0.12 : 0.07, 400, 0.6, this.worldGain); }
  uiClick() { this.blip(880, 0.06, 'sine', 0.2); }
  uiHover() { this.blip(620, 0.03, 'sine', 0.07); }
  waveHorn() { this.blip(196, 0.5, 'sawtooth', 0.2, this.sfxGain, 196); this.blip(294, 0.5, 'sawtooth', 0.15, this.sfxGain, 294); }
  overdrive() { this.blip(440, 0.15, 'sawtooth', 0.2, this.sfxGain, 880); setTimeout(() => this.blip(880, 0.2, 'sawtooth', 0.2, this.sfxGain, 1320), 120); }
  sting(win) {
    if (!this.ctx) return;
    const notes = win ? [523, 659, 784, 1046] : [392, 311, 233, 155];
    notes.forEach((n, i) => setTimeout(() => this.blip(n, 0.5, 'triangle', 0.25), i * 160));
  }
  melee() { this.noise(0.14, 0.3, 2600, 1.5); }
  grenadePin() { this.blip(1200, 0.04, 'square', 0.15); }
  // Music: small step sequencer. mode: title, combat, boss, off.
  startMusic(mode) {
    if (!this.ctx) return;
    this.stopMusic(); this.mode = mode; this.step = 0; this.nextTime = this.now() + 0.1;
    const spb = mode === 'boss' ? 0.21 : mode === 'combat' ? 0.26 : 0.5;
    const chords = { title: [[220, 261, 329], [174, 220, 261], [196, 246, 293], [164, 220, 261]], combat: [[110, 130, 164], [98, 123, 146], [110, 130, 164], [123, 146, 185]], boss: [[116, 138, 174], [110, 130, 164], [103, 123, 155], [116, 138, 174]] };
    const seq = chords[mode] || chords.title;
    this.musicTimer = setInterval(() => {
      if (this.paused || !this.ctx) return;
      while (this.nextTime < this.now() + 0.25) {
        const s = this.step % 16; const bar = Math.floor(this.step / 16) % seq.length;
        const chord = seq[bar];
        const t = this.nextTime;
        if (mode === 'title' && s === 0) {
          chord.forEach((f) => { const o = this.ctx.createOscillator(); const g = this.ctx.createGain(); o.type = 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.09, t + 0.4); g.gain.linearRampToValueAtTime(0.0001, t + spb * 16); o.connect(g); g.connect(this.musicGain); o.start(t); o.stop(t + spb * 16); });
        }
        if (mode !== 'title') {
          if (s % 4 === 0) { const o = this.ctx.createOscillator(); const g = this.ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.16); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2); o.connect(g); g.connect(this.musicGain); o.start(t); o.stop(t + 0.22); }
          if (s % 2 === 0) { const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf; const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000; const g = this.ctx.createGain(); g.gain.setValueAtTime(s % 4 === 2 ? 0.10 : 0.05, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.04); src.connect(f); f.connect(g); g.connect(this.musicGain); src.start(t); src.stop(t + 0.05); }
          const bassNotes = [0, 0, 1, 0, 2, 0, 1, 3];
          if (s % 2 === 0) { const f = chord[bassNotes[(s / 2) | 0] % chord.length] / 2; const o = this.ctx.createOscillator(); const g = this.ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = f; const fl = this.ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 420; g.gain.setValueAtTime(0.16, t); g.gain.exponentialRampToValueAtTime(0.001, t + spb * 1.8); o.connect(fl); fl.connect(g); g.connect(this.musicGain); o.start(t); o.stop(t + spb * 2); }
        }
        this.step++; this.nextTime += spb;
      }
    }, 90);
  }
  stopMusic() { if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; } this.mode = 'off'; }
  setPaused(p) {
    this.paused = p;
    if (!this.ctx) return;
    const t = this.now();
    this.musicGain.gain.cancelScheduledValues(t); this.musicGain.gain.setValueAtTime(p ? 0 : 0.30, t);
    this.worldGain.gain.cancelScheduledValues(t); this.worldGain.gain.setValueAtTime(p ? 0 : 0.5, t);
    this.sfxGain.gain.cancelScheduledValues(t); this.sfxGain.gain.setValueAtTime(p ? 0.12 : 0.9, t);
  }
  stopAllForGameOver() {
    this.stopMusic();
    if (!this.ctx) return;
    const t = this.now();
    this.musicGain.gain.setValueAtTime(0, t); this.worldGain.gain.setValueAtTime(0, t);
    this.sfxGain.gain.setValueAtTime(0.9, t);
  }
  restoreAfterGameOver() {
    if (!this.ctx) return;
    const t = this.now();
    this.worldGain.gain.setValueAtTime(0.5, t); this.sfxGain.gain.setValueAtTime(0.9, t);
  }
}
