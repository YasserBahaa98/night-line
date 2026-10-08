// All sound is synthesised with WebAudio - no files. Must be init()'d from a user gesture (iOS).
let ctx = null;
let master, sfxBus, musicBus, rumbleGain, rumbleFilter, noiseBuf;
let muted = false;
let chuffAcc = 0, clackAcc = 0, musicAcc = 0, musicStep = 0, dark = 0;
let lastOver = 0;

const PENTA = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
const PENTA_DARK = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25]; // lower, softer in tunnels

export function init() {
  if (ctx) { resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = muted ? 0 : 0.85; master.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);

  // music bus with a little echo
  musicBus = ctx.createGain(); musicBus.gain.value = 0.5; musicBus.connect(master);
  const delay = ctx.createDelay(1); delay.delayTime.value = 0.34;
  const fb = ctx.createGain(); fb.gain.value = 0.38;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
  musicBus.connect(delay); delay.connect(lp); lp.connect(fb); fb.connect(delay); lp.connect(master);

  // 2 s of white noise, reused by every whoosh / chuff / clack
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

  // constant rolling rumble, volume follows speed
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  rumbleFilter = ctx.createBiquadFilter(); rumbleFilter.type = 'lowpass'; rumbleFilter.frequency.value = 160;
  rumbleGain = ctx.createGain(); rumbleGain.gain.value = 0;
  src.connect(rumbleFilter); rumbleFilter.connect(rumbleGain); rumbleGain.connect(master);
  src.start();

  unlockIOS();
  resume();
}

// iOS plays WebAudio through the "ringer" channel; a looping silent <audio> flips it to media playback.
function unlockIOS() {
  try {
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
  } catch (e) { /* ignore */ }
  try {
    const rate = 8000, n = 800;
    const buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    w(36, 'data'); v.setUint32(40, n * 2, true);
    const a = new Audio(URL.createObjectURL(new Blob([buf], { type: 'audio/wav' })));
    a.loop = true; a.volume = 0.01; a.setAttribute('playsinline', '');
    a.play().catch(() => {});
  } catch (e) { /* ignore */ }
}

export function resume() { if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {}); }
export function suspend() { if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); }
export function isMuted() { return muted; }
export function setMuted(m) {
  muted = m;
  if (master) master.gain.setTargetAtTime(m ? 0 : 0.85, ctx.currentTime, 0.05);
}

function tone({ f = 440, f2 = null, type = 'sine', t = 0, d = 0.2, v = 0.2, a = 0.006, dest = null }) {
  if (!ctx) return;
  const t0 = ctx.currentTime + t;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + d);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(v, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  o.connect(g); g.connect(dest || sfxBus);
  o.start(t0); o.stop(t0 + d + 0.05);
}

function noise({ t = 0, d = 0.1, v = 0.2, f = 800, q = 1, type = 'bandpass', f2 = null, dest = null }) {
  if (!ctx) return;
  const t0 = ctx.currentTime + t;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const flt = ctx.createBiquadFilter(); flt.type = type; flt.frequency.setValueAtTime(f, t0); flt.Q.value = q;
  if (f2) flt.frequency.exponentialRampToValueAtTime(f2, t0 + d);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(v, t0 + Math.min(0.012, d / 3));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  s.connect(flt); flt.connect(g); g.connect(dest || sfxBus);
  s.start(t0, Math.random() * 1.5, d + 0.05);
}

export const sfx = {
  click(on = true) { tone({ f: on ? 620 : 420, f2: on ? 900 : 300, type: 'triangle', d: 0.09, v: 0.18 }); },
  tap() { tone({ f: 520, f2: 640, type: 'triangle', d: 0.07, v: 0.14 }); },
  horn() {
    tone({ f: 233, type: 'sawtooth', d: 0.75, v: 0.11, a: 0.04 });
    tone({ f: 294, type: 'sawtooth', d: 0.75, v: 0.1, a: 0.04 });
    tone({ f: 466, type: 'triangle', d: 0.75, v: 0.06, a: 0.05 });
  },
  hornShort() {
    tone({ f: 233, type: 'sawtooth', d: 0.25, v: 0.1, a: 0.02 });
    tone({ f: 294, type: 'sawtooth', d: 0.25, v: 0.09, a: 0.02 });
    tone({ f: 233, type: 'sawtooth', t: 0.3, d: 0.4, v: 0.1, a: 0.02 });
    tone({ f: 294, type: 'sawtooth', t: 0.3, d: 0.4, v: 0.09, a: 0.02 });
  },
  chime() { // ding-dong
    tone({ f: 784, d: 1.2, v: 0.2 }); tone({ f: 1568, d: 0.7, v: 0.05 });
    tone({ f: 659, t: 0.45, d: 1.4, v: 0.2 }); tone({ f: 1318, t: 0.45, d: 0.8, v: 0.05 });
  },
  bonk() { tone({ f: 420, f2: 190, type: 'sine', d: 0.28, v: 0.28 }); tone({ f: 210, f2: 120, type: 'triangle', d: 0.28, v: 0.12 }); },
  pop() { tone({ f: 500 + Math.random() * 120, f2: 1000, type: 'sine', d: 0.11, v: 0.2 }); },
  coin() { tone({ f: 988, type: 'square', d: 0.07, v: 0.05 }); tone({ f: 1319, type: 'square', t: 0.07, d: 0.22, v: 0.05 }); },
  whoosh() { noise({ d: 0.5, v: 0.16, f: 400, f2: 2400, q: 0.7 }); },
  ding() { tone({ f: 1046, d: 0.5, v: 0.15 }); },
  star(i = 0) {
    const base = [523.25, 659.25, 783.99][i] || 784;
    tone({ f: base, type: 'triangle', d: 0.9, v: 0.22 }); tone({ f: base * 2, type: 'sine', d: 0.7, v: 0.08 });
    tone({ f: base * 1.5, type: 'triangle', t: 0.12, d: 0.9, v: 0.12 });
  },
  jingle() {
    [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5].forEach((f, i) =>
      tone({ f, type: 'triangle', t: i * 0.12, d: i === 6 ? 1.2 : 0.35, v: 0.2 }));
  },
  sad() { [392, 330, 262].forEach((f, i) => tone({ f, type: 'sine', t: i * 0.2, d: 0.5, v: 0.18 })); },
  scare() { tone({ f: 300, f2: 150, type: 'triangle', d: 0.4, v: 0.06 }); },
};

function chuff(strength) {
  noise({ d: 0.11, v: 0.17 * strength, f: 520, q: 0.8, f2: 260 });
  tone({ f: 85, f2: 50, type: 'sine', d: 0.12, v: 0.14 * strength });
}
function clack() {
  noise({ d: 0.03, v: 0.07, f: 2600, q: 2, type: 'highpass' });
  noise({ t: 0.07, d: 0.03, v: 0.05, f: 2200, q: 2, type: 'highpass' });
}

// Called every frame. v = world units/sec. Returns how many steam chuffs fired (so visuals can match).
export function tick(dt, v, darkness) {
  if (!ctx || ctx.state !== 'running') return -1;
  dark = darkness;
  const sp = Math.min(1, v / 36);
  rumbleGain.gain.setTargetAtTime(0.04 + sp * 0.26, ctx.currentTime, 0.15);
  rumbleFilter.frequency.setTargetAtTime(110 + sp * 260 + dark * -30, ctx.currentTime, 0.2);

  let chuffs = 0;
  if (v > 0.4) {
    chuffAcc += dt * (1.1 + v * 0.13);
    if (chuffAcc >= 1) { chuffAcc -= 1; chuff(0.55 + sp * 0.5); chuffs = 1; }
    clackAcc += dt * (v / 12);
    if (clackAcc >= 1) { clackAcc -= 1; clack(); }
  } else { chuffAcc = 0.8; }

  // soft music-box melody: random walk on a pentatonic scale
  musicAcc += dt;
  if (musicAcc > 0.46) {
    musicAcc = 0;
    musicStep++;
    const scale = dark > 0.5 ? PENTA_DARK : PENTA;
    if (Math.random() < 0.72) {
      const f = scale[(musicStep * 2 + Math.floor(Math.random() * 3)) % scale.length];
      tone({ f, type: 'triangle', d: 1.1, v: 0.045, dest: musicBus });
      tone({ f: f * 2, type: 'sine', d: 0.6, v: 0.012, dest: musicBus });
    }
    if (musicStep % 8 === 0) tone({ f: scale[0] / 2, type: 'sine', d: 1.8, v: 0.05, dest: musicBus });
  }
  return chuffs;
}

export function overspeedBonk(now) {
  if (now - lastOver > 2.2) { lastOver = now; sfx.bonk(); return true; }
  return false;
}
