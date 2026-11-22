const TRACKS = {
  day: { room: 0.035, rain: 0, name: '白班' },
  night: { room: 0.028, rain: 0, name: '夜班' },
  rain: { room: 0.035, rain: 0.07, name: '雨' },
  snow: { room: 0.03, rain: 0.025, name: '雪' },
  typhoon: { room: 0.04, rain: 0.12, name: '台风' },
  incident: { room: 0.045, rain: 0.04, name: '事故' },
  review: { room: 0.025, rain: 0, name: '复盘' },
  tutorial: { room: 0.022, rain: 0, name: '教程' },
  special: { room: 0.03, rain: 0, name: '专运' },
  hump: { room: 0.04, rain: 0, name: '编组' },
};

const SCENE_TRACK = {
  '晴': 'day', '阴': 'day', '雨': 'rain', '暴雨': 'rain', '雪': 'snow', '冻雨': 'snow',
  '台风': 'typhoon', '地震': 'incident', '雾': 'night',
};

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxBus = null;
    this.ambBus = null;
    this.musicBus = null;
    this.noiseBuf = null;
    this.ambSrc = null;
    this.rainSrc = null;
    this.musicTimer = null;
    this.musicStep = 0;
    this.musicId = null;
    this.musicOn = false;
    this.on = true;
    this.trackId = null;
  }

  ensure() {
    if (this.ctx) return this.ctx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.42;
    this.master.connect(this.ctx.destination);
    this.ambBus = this.ctx.createGain();
    this.ambBus.gain.value = 1;
    this.ambBus.connect(this.master);
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = 0.62;
    this.musicBus.connect(this.master);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = 1;
    this.sfxBus.connect(this.master);
    this.makeNoise();
    return this.ctx;
  }

  makeNoise() {
    const len = Math.floor(this.ctx.sampleRate * 3);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i += 1) {
      const white = Math.random() * 2 - 1;
      last = last * 0.96 + white * 0.04;
      data[i] = last;
    }
    this.noiseBuf = buf;
  }

  resume() {
    const c = this.ensure();
    if (c && c.state === 'suspended') c.resume();
  }

  setEnabled(on) {
    this.on = on;
    if (this.master) this.master.gain.value = on ? 0.42 : 0;
  }

  ambience(level, rainLevel) {
    if (!this.ctx || !this.noiseBuf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const flt = this.ctx.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.value = 320;
    const g = this.ctx.createGain();
    g.gain.value = level;
    src.connect(flt).connect(g).connect(this.ambBus);
    src.start();
    this.ambSrc = src;
    if (rainLevel) {
      const rs = this.ctx.createBufferSource();
      rs.buffer = this.noiseBuf;
      rs.loop = true;
      const rf = this.ctx.createBiquadFilter();
      rf.type = 'bandpass';
      rf.frequency.value = 1200;
      rf.Q.value = 0.4;
      const rg = this.ctx.createGain();
      rg.gain.value = rainLevel;
      rs.connect(rf).connect(rg).connect(this.ambBus);
      rs.start();
      this.rainSrc = rs;
    }
  }

  stopAmbience() {
    [this.ambSrc, this.rainSrc].forEach((s) => {
      if (s) { try { s.stop(); } catch (e) {} }
    });
    this.ambSrc = null;
    this.rainSrc = null;
  }

  play(trackId) {
    const c = this.ensure();
    if (!c) return;
    this.resume();
    if (this.trackId === trackId && this.ambSrc) return;
    this.trackId = trackId;
    const track = TRACKS[trackId] || TRACKS.day;
    this.stopAmbience();
    this.ambience(track.room, track.rain);
    this.music(trackId);
  }

  music(trackId) {
    const c = this.ensure();
    if (!c) return;
    this.resume();
    if (this.musicId === trackId && this.musicTimer) return;
    this.stopMusic();
    this.musicId = trackId;
    this.musicOn = true;
    this.musicStep = 0;
    const bar = () => this.musicBar(trackId);
    bar();
    this.musicTimer = setInterval(bar, 7600);
  }

  musicBar(trackId) {
    if (!this.musicOn || !this.on || !this.ctx || !this.musicBus) return;
    const c = this.ctx;
    const t0 = c.currentTime + 0.06;
    const dark = trackId === 'night' || trackId === 'incident' || trackId === 'rain';
    const sparse = trackId === 'review' || trackId === 'tutorial';
    const seqs = dark
      ? [[2, 5, 9], [2, 5, 10], [1, 4, 8], [0, 3, 7]]
      : sparse
        ? [[0, 4, 7], [5, 9, 2], [3, 7, 10], [7, 11, 2]]
        : [[2, 5, 9], [10, 2, 5], [5, 8, 0], [0, 4, 7]];
    const chord = seqs[(this.musicStep + (dark ? 1 : 0)) % seqs.length];
    const root = dark ? 174.6 : 196;
    chord.forEach((semi, i) => {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = i === 1 ? 'triangle' : 'sine';
      osc.frequency.value = root * Math.pow(2, semi / 12);
      const gain = (sparse ? 0.022 : 0.03) * (i === 1 ? 0.8 : 1);
      g.gain.setValueAtTime(0, t0 + i * 0.05);
      g.gain.linearRampToValueAtTime(gain, t0 + 1.1 + i * 0.05);
      g.gain.linearRampToValueAtTime(gain * 0.85, t0 + 5.4);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 7.4);
      osc.connect(g).connect(this.musicBus);
      osc.start(t0 + i * 0.05);
      osc.stop(t0 + 7.5);
    });
    const bass = c.createOscillator();
    const bg = c.createGain();
    bass.type = 'sine';
    bass.frequency.value = root * 0.5 * Math.pow(2, chord[0] / 12);
    bg.gain.setValueAtTime(0, t0);
    bg.gain.linearRampToValueAtTime(0.035, t0 + 0.8);
    bg.gain.exponentialRampToValueAtTime(0.0001, t0 + 7.2);
    bass.connect(bg).connect(this.musicBus);
    bass.start(t0);
    bass.stop(t0 + 7.3);
    if (this.musicStep % 4 === 2) {
      const bell = c.createOscillator();
      const bgn = c.createGain();
      bell.type = 'triangle';
      bell.frequency.value = root * Math.pow(2, (chord[2] + 12) / 12);
      bgn.gain.setValueAtTime(0, t0 + 1.8);
      bgn.gain.linearRampToValueAtTime(0.012, t0 + 1.86);
      bgn.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.4);
      bell.connect(bgn).connect(this.musicBus);
      bell.start(t0 + 1.8);
      bell.stop(t0 + 3.5);
    }
    this.musicStep += 1;
  }

  stopMusic() {
    this.musicOn = false;
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
    this.musicId = null;
  }

  stop() {
    this.stopAmbience();
    this.stopMusic();
    this.trackId = null;
  }

  tone(freq, dur, gain = 0.06, delay = 0, type = 'sine') {
    if (!this.on) return;
    const c = this.ensure();
    if (!c) return;
    const t = c.currentTime + delay;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.sfxBus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  tick(gain = 0.035) {
    if (!this.on || !this.ctx || !this.noiseBuf) return;
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const flt = c.createBiquadFilter();
    flt.type = 'highpass';
    flt.frequency.value = 1800;
    const g = c.createGain();
    const t = c.currentTime;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
    src.connect(flt).connect(g).connect(this.sfxBus);
    src.start(t);
    src.stop(t + 0.05);
  }

  sfx(kind) {
    if (!this.on) return;
    switch (kind) {
      case 'click':
        this.tick(0.03);
        this.tone(640, 0.022, 0.025);
        break;
      case 'order':
        this.tick(0.05);
        this.tone(700, 0.07, 0.05);
        this.tone(940, 0.09, 0.04, 0.09);
        break;
      case 'ok':
        this.tone(620, 0.1, 0.05);
        this.tone(860, 0.14, 0.04, 0.11);
        break;
      case 'err':
        this.tone(300, 0.16, 0.06, 0, 'triangle');
        this.tone(230, 0.2, 0.05, 0.13, 'triangle');
        break;
      case 'alarm':
        this.tone(520, 0.12, 0.045, 0, 'triangle');
        this.tone(410, 0.14, 0.04, 0.16, 'triangle');
        break;
      case 'phone':
        this.tone(780, 0.09, 0.04);
        this.tone(780, 0.09, 0.04, 0.16);
        break;
      case 'fail':
        this.tone(220, 0.28, 0.07, 0, 'triangle');
        this.tone(160, 0.4, 0.06, 0.24, 'triangle');
        break;
      default:
        this.tick(0.03);
    }
  }
}

export function trackForScene(scene, mode) {
  if (mode === 'tutorial' || (scene && scene.kind === 'tutorial')) return 'tutorial';
  if (mode === 'review') return 'review';
  if (scene && scene.weather && SCENE_TRACK[scene.weather]) return SCENE_TRACK[scene.weather];
  if (scene && scene.kind === 'story' && scene.act >= 5) return 'special';
  return 'day';
}

export function trackForWeather(weather) {
  return SCENE_TRACK[weather] || 'day';
}

export const TRACK_NAMES = Object.fromEntries(Object.entries(TRACKS).map(([k, v]) => [k, v.name]));
