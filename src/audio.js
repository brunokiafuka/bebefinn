const prefs = {
  sound: localStorage.getItem('bebefin-sound') !== '0',
  music: localStorage.getItem('bebefin-music') !== '0',
};

let ctx = null;
let sfxBus, musicBus, musicDuck;
let speechUnlocked = false;
let speaking = false;
let voice = null;

export const isSoundOn = () => prefs.sound;
export const isMusicOn = () => prefs.music;
export const isSpeaking = () => speaking;

export function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    const master = ctx.createGain();
    master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = prefs.sound ? 1 : 0;
    sfxBus.connect(master);
    musicDuck = ctx.createGain();
    musicDuck.connect(master);
    musicBus = ctx.createGain();
    musicBus.gain.value = prefs.music ? 1 : 0;
    musicBus.connect(musicDuck);
  }
  if (ctx.state === 'suspended') ctx.resume();
  if (!speechUnlocked && 'speechSynthesis' in window) {
    speechUnlocked = true;
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    speechSynthesis.speak(u);
  }
}

export function setSound(on) {
  prefs.sound = on;
  localStorage.setItem('bebefin-sound', on ? '1' : '0');
  if (sfxBus) sfxBus.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.05);
  if (!on && 'speechSynthesis' in window) speechSynthesis.cancel();
}

export function setMusic(on) {
  prefs.music = on;
  localStorage.setItem('bebefin-music', on ? '1' : '0');
  if (musicBus) musicBus.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.2);
  if (on) startMusic();
}

function tone(freq, { t = 0, dur = 0.2, type = 'sine', vol = 0.2, slideTo = null, attack = 0.01, bus } = {}) {
  if (!ctx) return;
  const t0 = ctx.currentTime + t;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(bus || sfxBus);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

let noiseBuf = null;
function noise({ t = 0, dur = 0.15, vol = 0.2, freq = 1200, q = 1, sweepTo = null } = {}) {
  if (!ctx) return;
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t0 = ctx.currentTime + t;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(freq, t0);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(sfxBus);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
}

const SCALE = [523.25, 587.33, 659.25, 698.46, 783.99, 880, 987.77, 1046.5, 1174.66, 1318.51, 1396.91];

export const sfx = {
  tap: () => tone(620, { dur: 0.09, type: 'triangle', vol: 0.18, slideTo: 940 }),
  blip: (i = 0) => tone(480 + i * 70, { dur: 0.12, vol: 0.14, slideTo: 900 + i * 90 }),
  pop: () => {
    tone(380, { dur: 0.14, vol: 0.35, slideTo: 1500 });
    noise({ dur: 0.07, vol: 0.18, freq: 2500, q: 0.8 });
  },
  smallPop: () => {
    tone(700 + Math.random() * 300, { dur: 0.08, vol: 0.18, slideTo: 1800 });
  },
  correct: () => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      tone(f, { t: 0.05 + i * 0.075, dur: 0.35, type: 'triangle', vol: 0.2 });
      tone(f * 2, { t: 0.05 + i * 0.075, dur: 0.2, vol: 0.05 });
    });
  },
  wrong: () => {
    tone(330, { dur: 0.22, vol: 0.2, slideTo: 220 });
    tone(262, { t: 0.14, dur: 0.3, vol: 0.16, slideTo: 175 });
  },
  count: (n) => {
    const f = SCALE[Math.max(0, n - 1) % SCALE.length];
    tone(f, { dur: 0.3, type: 'triangle', vol: 0.22 });
    tone(f * 2, { dur: 0.18, vol: 0.06 });
  },
  swoosh: () => noise({ dur: 0.5, vol: 0.12, freq: 400, q: 1.5, sweepTo: 3000 }),
  giggle: () => {
    [900, 1100, 950, 1250].forEach((f, i) => tone(f, { t: i * 0.07, dur: 0.09, vol: 0.12, slideTo: f * 1.3 }));
  },
  whoosh: () => noise({ dur: 0.35, vol: 0.1, freq: 2500, q: 1, sweepTo: 500 }),
  win: () => {
    const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.51];
    const times = [0, 0.12, 0.24, 0.36, 0.56, 0.68, 0.8];
    notes.forEach((f, i) => {
      const dur = i === notes.length - 1 ? 0.9 : 0.25;
      tone(f, { t: times[i], dur, type: 'triangle', vol: 0.22 });
      tone(f / 2, { t: times[i], dur, type: 'sine', vol: 0.08 });
    });
    for (let i = 0; i < 10; i++) tone(1800 + Math.random() * 1600, { t: 0.9 + i * 0.06, dur: 0.12, vol: 0.05 });
  },
};

// ---------- gentle music-box loop ----------
const CHORDS = [
  [60, 64, 67, 72],
  [57, 60, 64, 69],
  [53, 57, 60, 65],
  [55, 59, 62, 67],
];
const PATTERN = [0, 2, 1, 3, 2, 1, 3, 2];
const STEP = 60 / 96 / 2;
let musicTimer = null;
let nextTime = 0;
let step = 0;
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

function musicNote(f, t, vol, dur) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.value = f;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(musicBus);
  o.start(t);
  o.stop(t + dur + 0.05);
}

export function startMusic() {
  if (!ctx || musicTimer || !prefs.music) return;
  nextTime = ctx.currentTime + 0.1;
  musicTimer = setInterval(() => {
    while (nextTime < ctx.currentTime + 0.3) {
      const bar = Math.floor(step / 8) % CHORDS.length;
      const chord = CHORDS[bar];
      const n = chord[PATTERN[step % 8]] + 12;
      musicNote(midi(n), nextTime, 0.035, 0.7);
      musicNote(midi(n + 12), nextTime, 0.008, 0.35);
      if (step % 4 === 0) musicNote(midi(chord[0] - 12), nextTime, 0.045, 1.2);
      nextTime += STEP;
      step++;
    }
  }, 100);
}

function duck(on) {
  if (!musicDuck) return;
  musicDuck.gain.setTargetAtTime(on ? 0.35 : 1, ctx.currentTime, 0.15);
}

// ---------- voice ----------
function pickVoice() {
  if (!('speechSynthesis' in window)) return null;
  const vs = speechSynthesis.getVoices();
  if (!vs.length) return null;
  const preferred = ['Samantha', 'Google US English', 'Microsoft Aria', 'Microsoft Jenny', 'Karen', 'Tessa', 'Moira', 'Google UK English Female', 'Serena'];
  for (const p of preferred) {
    const v = vs.find((v) => v.name.includes(p));
    if (v) return v;
  }
  return vs.find((v) => /^en[-_]US/i.test(v.lang)) || vs.find((v) => /^en/i.test(v.lang)) || null;
}
if ('speechSynthesis' in window) {
  voice = pickVoice();
  speechSynthesis.addEventListener?.('voiceschanged', () => (voice = pickVoice()));
}

let sayId = 0;
export function say(text, { rate = 0.88, pitch = 1.2 } = {}) {
  const id = ++sayId;
  if (!prefs.sound || !('speechSynthesis' in window) || !text) {
    return new Promise((r) => setTimeout(r, Math.min(1800, 300 + (text || '').length * 40)));
  }
  return new Promise((resolve) => {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (!voice) voice = pickVoice();
    if (voice) u.voice = voice;
    u.lang = voice?.lang || 'en-US';
    u.rate = rate;
    u.pitch = pitch;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(guard);
      if (id === sayId) {
        speaking = false;
        duck(false);
      }
      resolve();
    };
    u.onstart = () => {
      if (id === sayId) {
        speaking = true;
        duck(true);
      }
    };
    u.onend = finish;
    u.onerror = finish;
    const guard = setTimeout(finish, 2500 + text.length * 110);
    // Chrome occasionally drops an utterance queued right after cancel().
    setTimeout(() => {
      if (id === sayId && !done) speechSynthesis.speak(u);
      else finish();
    }, 60);
  });
}

export function stopSpeaking() {
  sayId++;
  speaking = false;
  duck(false);
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}
