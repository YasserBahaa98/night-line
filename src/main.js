import * as THREE from 'three';
import './style.css';
import {
  KMH, STEPS, TOTAL, START_DIST, STATIONS, STATION_NAMES, APPROACH, SEATS, ZONES, TUNNELS, SIGN_ICON,
  zoneIndexAt, tunnelAt, darkness,
} from './route.js';
import * as Audio from './audio.js';
import * as UI from './ui.js';
import { makeWorld } from './world.js';
import { makeTrain } from './train.js';
import { makeCab } from './cab.js';
import { makePassengers } from './passengers.js';
import { makeFx } from './fx.js';
import { MAX, createScore, starsFor, loadBest, saveBest } from './scoring.js';

const sfx = Audio.sfx;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// ------------------------------------------------------------------ renderer / scene
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 1, 0.2, 800);

const world = makeWorld(scene);
const train = makeTrain();
scene.add(train.root);
// sounds fire when the driver's hand reaches the switch / horn cord, so they line up with the animation
const cab = makeCab(train.root, {
  flip: (kind, value) => sfx.toggle(value),
  horn: (short) => (short ? sfx.hornShort() : sfx.horn()),
});
const pax = makePassengers(scene, train.seats, train.doors);
const fx = makeFx(scene);

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
resize();

// ------------------------------------------------------------------ game state
const G = {
  state: 'menu', // menu | playing | station | finish | results
  t: 0, dist: START_DIST, v: 0, go: false, slow: false, capHit: false, emergency: false,
  head: false, cabinOn: false,
  comfort: 0.85, nextStation: 0, done: 0, leaveCapUntil: -1,
  zone: null, tunnel: null, afterTunnel: null, hinted: {}, station: null,
  firstGo: false, overT: 0, scareT: 0, finishT: 0, approachSeen: -1, shortHint: false,
};
let score = createScore();
const timers = [];
const later = (sec, fn) => timers.push({ t: sec, fn });

function newZone(k) { return { k, moving: 0, good: 0, total: 0 }; }

function reset() {
  score = createScore();
  Object.assign(G, {
    dist: START_DIST, v: 0, go: false, slow: false, capHit: false, emergency: false, head: false, cabinOn: false, comfort: 0.85,
    nextStation: 0, done: 0, leaveCapUntil: -1, zone: newZone(zoneIndexAt(START_DIST)), tunnel: null, afterTunnel: null,
    hinted: {}, station: null, firstGo: false, overT: 0, scareT: 0, finishT: 0, approachSeen: -1, shortHint: false,
  });
  timers.length = 0;
  pax.reset();
  cab.reset(false, false);
  UI.setScore(0); UI.setStops(0, 0); UI.setComfort(G.comfort); UI.setLights(false, false); UI.hintLights(false, false);
  UI.setSeats(0); UI.showSeatBox(false); UI.setCamStrip(false, 'cab'); UI.setGoMode('go'); UI.setSlowMode('slow'); UI.pulseGo(false);
  UI.setLimit(ZONES[G.zone.k].limit, false);
}

// ------------------------------------------------------------------ scoring helpers
function award(cat, pts, label) {
  const p = Math.min(pts, MAX[cat] - score[cat]);
  if (p <= 0) return;
  score[cat] += p;
  UI.setScore(score.total, true);
  if (label) UI.popup(label);
}

function finalizeZone() {
  const z = G.zone; if (!z) return;
  const frac = z.total < 1.2 ? 1 : z.good / z.total;
  const pts = (MAX.speed / ZONES.length) * frac;
  award('speed', pts, z.total >= 2 ? `+${Math.round(pts)} ${SIGN_ICON[ZONES[z.k].limit]}` : null);
}

// ------------------------------------------------------------------ controls
function currentCap() {
  let cap = 3;
  if (G.dist < G.leaveCapUntil) cap = 1;
  if (G.nextStation < 3) {
    const dS = STATIONS[G.nextStation] - G.dist;
    if (dS < APPROACH && dS > -40) cap = 1;
  }
  return cap;
}

// hold-to-drive: the train speeds up while GO is held, brakes while SLOW is held, and keeps its speed otherwise
const ACCEL = 5, BRAKE = 8;
function horn(short = false) { cab.act('horn', short); }

const handlers = {
  goDown() {
    if (G.state !== 'playing') return;
    if (!G.firstGo) { G.firstGo = true; UI.hideBanner(); horn(true); }
    UI.pulseGo(false);
    G.go = true; G.capHit = false; G.emergency = false; sfx.lever(true);
  },
  goUp() { if (G.go) sfx.lever(false); G.go = false; },
  slowDown() { if (G.state !== 'playing') return; G.slow = true; sfx.lever(true); },
  slowUp() {
    if (G.slow) { sfx.lever(false); if (G.v > 0.5) sfx.brakeRelease(); }
    G.slow = false;
  },
  head() { G.head = !G.head; sfx.tap(); UI.setLights(G.head, G.cabinOn); cab.act('head', G.head); },
  cabinLights() { G.cabinOn = !G.cabinOn; sfx.tap(); UI.setLights(G.head, G.cabinOn); cab.act('seats', G.cabinOn); },
  mute() { Audio.setMuted(!Audio.isMuted()); UI.setMuteIcon(Audio.isMuted()); },
  view(v) { if (G.state === 'station') { setView(v); UI.setCamStrip(true, v); sfx.whoosh(); } },
  leave() { if (G.state === 'station') leaveStation(); },
  play() { start(); },
  again() { UI.hideResults(); start(true); },
};
UI.bind(handlers);
UI.buildPips();

// ------------------------------------------------------------------ flow
function start(again = false) {
  Audio.init();
  reset();
  if (!again) UI.hideMenu();
  G.state = 'playing';
  UI.showHUD(true);
  UI.setStops(0, 0);
  setView('cab', again ? 1.2 : 2.0);
  horn();
  UI.pulseGo(true);
  later(1.2, () => UI.banner('Hold GO to drive!', '🚂', 'good', 4000));
}

function arrive() {
  const k = G.nextStation, S = STATIONS[k];
  G.state = 'station'; G.v = 0; G.go = false; G.slow = false; G.emergency = false;
  UI.setGauge(0, false);
  finalizeZone(); G.zone = newZone(zoneIndexAt(G.dist));
  const e = Math.abs(G.dist - S);
  const [pts, msg, kind] = e <= 6 ? [80, 'Perfect stop!', 'good'] : e <= 12 ? [60, 'Great stop!', 'good'] : e <= 20 ? [40, 'Good stop!', 'good'] : [25, 'Stopped!', 'warn'];
  award('stops', pts, `+${pts} 🚏`);
  sfx.chime(); sfx.brakeRelease();
  UI.banner(msg, e <= 12 ? '🌟' : '👍', kind, 2600);
  G.station = { k, t: 0, all: false };
  pax.startBoarding(k, G.dist, (id) => {
    award('friends', MAX.friends / SEATS);
    UI.popup('+6');
    sfx.pop();
    UI.setSeats(pax.seated, true);
  });
  UI.showSeatBox(true); UI.setSeats(pax.seated);
  UI.setCamStrip(true, 'cab');
  UI.setGoMode('leaveEarly'); UI.setSlowMode('off'); UI.hintLights(false, false);
  later(0.9, () => { if (G.state === 'station') { setView('platform'); UI.setCamStrip(true, 'platform'); sfx.whoosh(); } });
}

function allAboard() {
  G.station.all = true;
  UI.setGoMode('leave');
  sfx.ding();
  if (pax.seated >= SEATS) {
    UI.seatsFull(); UI.burstConfetti(160); sfx.jingle();
    UI.banner('FULL TRAIN!', '🎉', 'good', 3200);
  } else {
    UI.banner('All aboard!', '✅', 'good', 2600);
  }
}

function leaveStation() {
  const k = G.station.k, S = STATIONS[k];
  if (!G.station.all) {
    pax.leaveBehind(k);
    UI.banner('Bye bye friends!', '👋', 'warn', 2200);
    sfx.sad();
  }
  horn();
  G.state = 'playing'; G.nextStation = k + 1; G.done = k + 1; G.leaveCapUntil = S + 60; G.station = null;
  UI.pulseGo(true); later(0.6, () => UI.banner('Hold GO!', '🚂', 'good', 2600));
  UI.showSeatBox(false); UI.setCamStrip(false, 'cab'); setView('cab', 1.1);
  UI.setGoMode('go'); UI.setSlowMode('slow');
  UI.setStops(G.nextStation, G.done);
}

function finishRun() {
  finalizeZone();
  score.comfort = MAX.comfort * G.comfort;
  const total = score.total, stars = starsFor(total);
  const info = saveBest(total, stars);
  G.state = 'results';
  UI.hideBanner(); UI.showHUD(false); setView('hero', 2.4);
  UI.showResults(score, stars, info, {
    tick: () => sfx.coin(), star: (i) => sfx.star(i), done: () => sfx.jingle(),
  });
}

// ------------------------------------------------------------------ camera rig
const camPos = new THREE.Vector3(), camTgt = new THREE.Vector3();
let camFov = 62, view = 'hero', blend = 1, blendDur = 1, viewShift = 0.05, viewShiftX = 0.12;
const frozen = { pos: new THREE.Vector3(), tgt: new THREE.Vector3(), fov: 50 };
const pA = new THREE.Vector3(), pT = new THREE.Vector3();
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

function setView(name, dur = 0.9) {
  if (name === view && blend >= 1) return;
  frozen.pos.copy(camPos); frozen.tgt.copy(camTgt); frozen.fov = camFov;
  view = name; blend = 0; blendDur = dur;
}

function pose(name, t, outP, outT) {
  const sp = clamp(G.v / 36, 0, 1);
  switch (name) {
    case 'cab': {
      const sx = (Math.sin(t * 1.7) * 0.025 + Math.sin(t * 0.9) * 0.012) * sp;
      const by = Math.sin(t * (6 + sp * 9)) * 0.014 * sp;
      // over the driver's shoulder, inside the cab
      outP.set(0.98 + sx, 3.22 + by, -G.dist + 3.2);
      outT.set(-0.55 + sx * 0.4, 1.0, -G.dist - 30);
      return 66 + sp * 4;
    }
    case 'platform':
      outP.set(16, 5.4, -G.dist + 12); outT.set(2.5, 1.6, -G.dist + 12.5); return 60;
    case 'inside':
      outP.set(0, 2.6, -G.dist + 25.8); outT.set(0, 1.45, -G.dist + 8); return 74;
    default: { // hero: slow orbit around the loco
      const a = 0.9 + Math.sin(t * 0.22) * 0.45, cz = -G.dist - 3;
      outP.set(-Math.sin(a) * 14, 3.6 + Math.sin(t * 0.3) * 0.4, cz - Math.cos(a) * 14);
      outT.set(0, 2.4, cz); return 50;
    }
  }
}

function updateCamera(dt, t) {
  const fov = pose(view, t, pA, pT);
  if (blend < 1) {
    blend = Math.min(1, blend + dt / blendDur);
    const e = ease(blend);
    camPos.lerpVectors(frozen.pos, pA, e); camTgt.lerpVectors(frozen.tgt, pT, e); camFov = frozen.fov + (fov - frozen.fov) * e;
  } else { camPos.copy(pA); camTgt.copy(pT); camFov = fov; }
  camera.position.copy(camPos);
  camera.lookAt(camTgt);
  // the dashboard hides the bottom third: push the picture up so the horizon sits in the visible area
  viewShift += ((view === 'cab' ? 0.12 : 0.05) - viewShift) * Math.min(1, dt * 3);
  viewShiftX += ((G.state === 'menu' ? 0.12 : 0) - viewShiftX) * Math.min(1, dt * 3); // menu: train sits right of the title card
  camera.setViewOffset(innerWidth, innerHeight, viewShiftX * innerWidth, viewShift * innerHeight, innerWidth, innerHeight);
  if (view === 'cab' && blend >= 1) camera.rotateZ(Math.sin(t * 1.3) * 0.006 * clamp(G.v / 36, 0, 1));
  if (Math.abs(camera.fov - camFov) > 0.01) { camera.fov = camFov; camera.updateProjectionMatrix(); }
}

// ------------------------------------------------------------------ per-frame logic
function driveUpdate(dt) {
  const nsIdx = G.nextStation, S = nsIdx < 3 ? STATIONS[nsIdx] : Infinity, dS = S - G.dist;
  const cap = currentCap();
  const inApproach = nsIdx < 3 && dS < APPROACH && dS > -40;

  // station announcements
  if (nsIdx < 3 && dS < 300 && !G.hinted['crowd' + nsIdx]) { G.hinted['crowd' + nsIdx] = true; pax.spawnCrowd(nsIdx, S); }
  if (inApproach && G.approachSeen !== nsIdx) {
    G.approachSeen = nsIdx;
    UI.banner('Station! Stop at the green mark', '🚏', 'good', 4200); horn(true);
    UI.setStops(nsIdx, G.done);
  }

  // emergency brake if the player sails past the platform
  if (inApproach && G.dist > S + 18 && G.v > 0) G.emergency = true;

  const capV = STEPS[cap] * KMH, prev = G.v;
  if (G.state === 'finish' || G.emergency) G.v = Math.max(0, G.v - (G.emergency ? 16 : 7) * dt);
  else if (G.slow) G.v = Math.max(0, G.v - BRAKE * dt);
  else if (G.v > capV) G.v = Math.max(capV, G.v - 6.5 * dt); // auto-slow for slow zones / stations
  else if (G.go) {
    G.v = Math.min(capV, G.v + ACCEL * dt);
    if (G.v >= capV && !G.capHit) {
      G.capHit = true; sfx.bonk();
      UI.banner(cap === 1 ? 'Slow zone!' : 'Top speed!', cap === 1 ? '🐢' : '🚀', 'warn', 1500);
    }
  }
  if (G.v < 0.03 && !G.go) G.v = 0;
  if (G.v === 0) G.emergency = false;
  G.dist += G.v * dt;
  const braking = prev - G.v;
  // brake sounds: air hiss while the brake is held, wheel squeal when slowing hard at speed
  const decel = dt > 0 ? braking / dt : 0;
  Audio.setBrake(G.slow && G.v > 0 ? 1 : 0, clamp((decel - 5) / 8, 0, 1) * clamp(G.v / 8, 0, 1));

  // sparks when braking hard
  if (braking / dt > 4 && G.v > 2) {
    const w = train.wheelWorld(tmpV);
    fx.spark(w.x + (Math.random() < 0.5 ? -1.3 : 1.3), 0.4, w.z + (Math.random() - 0.5) * 3, -G.v);
  }

  // ---- speed limits
  const zi = zoneIndexAt(G.dist), lim = ZONES[zi].limit;
  if (zi !== G.zone.k) {
    finalizeZone();
    const oldLim = ZONES[G.zone.k].limit;
    G.zone = newZone(zi);
    if (lim !== oldLim && G.state === 'playing') UI.banner(`Limit ${lim}`, SIGN_ICON[lim], '', 2200);
  }
  UI.setLimit(lim);
  const kmh = G.v / KMH;
  let over = false;
  if (G.v > 1 && G.state !== 'finish') {
    G.zone.moving += dt;
    if (G.zone.moving > 3.5) {
      G.zone.total += dt;
      over = kmh > lim + 1.5;
      if (!over && kmh >= lim - 21) G.zone.good += dt;
    }
  }
  UI.setGauge(kmh, over);
  if (over) { G.overT += dt; if (G.overT > 0.4) Audio.overspeedBonk(G.t); } else G.overT = 0;

  // ---- lights / tunnels
  const ti = tunnelAt(G.dist), bothOn = G.head && G.cabinOn;
  for (let i = 0; i < TUNNELS.length; i++) {
    const a = TUNNELS[i][0];
    if (G.dist > a - 170 && G.dist < a && !G.hinted['tun' + i] && !inApproach) {
      G.hinted['tun' + i] = true;
      UI.banner(bothOn ? 'Tunnel! Lights are on' : 'Tunnel ahead! Lights on', '🌙', bothOn ? 'good' : 'warn', 3600);
    }
  }
  const nearTunnel = TUNNELS.some(([a]) => G.dist > a - 170 && G.dist < a + 4);
  if (ti >= 0) {
    if (!G.tunnel) {
      G.tunnel = { i: ti, dark: 0, head: 0, cab: 0 }; horn(true);
    }
    G.tunnel.dark += dt; if (G.head) G.tunnel.head += dt; if (G.cabinOn) G.tunnel.cab += dt;
  } else if (G.tunnel) {
    const tn = G.tunnel; G.tunnel = null;
    const frac = tn.dark > 0 ? 0.5 * tn.head / tn.dark + 0.5 * tn.cab / tn.dark : 1;
    const pts = Math.round(70 * frac);
    award('lights', pts, `+${pts} 💡`);
    UI.banner(frac > 0.8 ? 'Bright and cosy!' : 'Lights on next time!', frac > 0.8 ? '✨' : '💡', frac > 0.8 ? 'good' : 'warn', 2600);
    G.afterTunnel = { t: 0, said: false, paid: false };
  }
  if (G.afterTunnel) {
    const a = G.afterTunnel; a.t += dt;
    if (a.t > 1.6 && !a.said) { a.said = true; if (bothOn || G.head || G.cabinOn) UI.banner('Sunny! Lights off', '☀️', '', 2800); }
    if (a.t > 6 && !a.paid) { a.paid = true; if (!G.head && !G.cabinOn) award('lights', 20, '+20 ☀️'); G.afterTunnel = null; }
  }
  const inDark = ti >= 0;
  UI.hintLights((inDark || nearTunnel) && !G.head, (inDark || nearTunnel) && !G.cabinOn);

  // ---- comfort
  let dc = 0.03;
  if (darkness(G.dist) > 0.5) { if (!G.cabinOn) dc -= 0.14; if (!G.head) dc -= 0.07; }
  if (over) dc -= 0.05;
  const oldC = G.comfort;
  G.comfort = clamp(G.comfort + dc * dt, 0, 1);
  G.scareT -= dt;
  if (G.comfort < 0.4 && oldC >= 0.4 && G.scareT <= 0) { G.scareT = 6; sfx.scare(); UI.banner('Passengers are scared!', '😢', 'bad', 2400); }
  UI.setComfort(G.comfort);

  // ---- buttons: STOP label + glow
  if (G.state === 'playing') {
    if (inApproach && dS > -30) {
      const pred = G.dist + (G.v * G.v) / (2 * BRAKE);
      UI.setSlowMode(G.v > 0 && !G.slow && Math.abs(pred - S) < 5.5 ? 'now' : 'stop');
    } else UI.setSlowMode('slow');
  }

  // ---- arrive at a station
  if (G.state === 'playing' && nsIdx < 3 && G.v === 0 && !G.go && Math.abs(G.dist - S) <= 30) arrive();
  else if (G.state === 'playing' && nsIdx < 3 && G.v === 0 && !G.go && inApproach && !G.shortHint && G.dist < S - 30) {
    G.shortHint = true; UI.banner('Hold GO to roll closer', '🚂', 'warn', 3200);
  }
  if (G.go) G.shortHint = false;

  // ---- end of the line
  if (G.state === 'playing' && G.nextStation >= 3 && G.dist > STATIONS[2] + 130) {
    G.state = 'finish'; G.go = G.slow = false; UI.banner('End of the line!', '🏁', 'good', 3000); horn();
    UI.setDriveButtonsDimmed(true);
  }
  if (G.state === 'finish' && G.v === 0) { G.finishT += dt; if (G.finishT > 1.6) finishRun(); }
}

const tmpV = new THREE.Vector3();
let puffAcc = 0, idleAcc = 0;

function frame(now) {
  const dt = clamp((now - (frame.last || now)) / 1000, 0, 0.05); frame.last = Math.max(now, frame.last || 0);
  G.t += dt;
  const t = G.t;

  for (let i = timers.length - 1; i >= 0; i--) { timers[i].t -= dt; if (timers[i].t <= 0) { const f = timers.splice(i, 1)[0].fn; f(); } }

  if (G.state !== 'playing' && G.state !== 'finish') Audio.setBrake(0, 0);
  if (G.state === 'playing' || G.state === 'finish') driveUpdate(dt);
  else if (G.state === 'station') {
    const st = G.station; st.t += dt;
    if (!st.all && ((pax.allAboard(st.k) && !pax.boardingActive()) || st.t > 24)) {
      if (pax.allAboard(st.k)) allAboard(); else if (st.t > 24) { st.all = true; UI.setGoMode('leave'); }
    }
  }

  train.root.position.z = -G.dist;
  train.root.updateMatrixWorld(true);
  train.update(dt, G.v, G.head ? 1 : 0, G.cabinOn ? 1 : 0);
  cab.update(dt, {
    v: G.v, kmh: G.v / KMH, limit: ZONES[zoneIndexAt(G.dist)].limit, go: G.go && G.state === 'playing', slow: G.slow && G.state === 'playing',
    dark: G.state === 'menu' || G.state === 'results' ? 0 : darkness(G.dist), cabin: train.cabinLevel, atStation: G.state === 'station', t: G.t,
  });

  const dk = G.state === 'menu' || G.state === 'results' ? 0 : darkness(G.dist);
  const prog = clamp(G.dist / TOTAL, 0, 1);
  world.setEnv(dk, prog, train.headLevel);
  const dS = G.nextStation < 3 ? STATIONS[G.nextStation] - G.dist : 999;
  world.update(t, camera, G.state === 'playing' && dS < 300 && dS > -20 ? G.nextStation : -1, G.dist);

  pax.update(dt, t, G.comfort > 0.42, -G.dist);

  // sound + steam
  const chuffs = Audio.tick(dt, G.v, dk);
  const fun = train.funnelWorld();
  let puff = false;
  if (chuffs < 0) { puffAcc += dt * (1 + G.v * 0.13); if (G.v > 0.4 && puffAcc >= 1) { puffAcc = 0; puff = true; } } else if (chuffs > 0) puff = true;
  idleAcc += dt; if (G.v <= 0.4 && idleAcc > 1.1) { idleAcc = 0; puff = true; }
  if (puff) fx.puff(fun.x, fun.y, fun.z, 0, clamp(0.7 + G.v / 30, 0.7, 1.5));
  fx.update(dt, renderer.domElement.height, camera.fov, 0.3 + 0.7 * (1 - dk));

  updateCamera(dt, t);
  renderer.render(scene, camera);

  if (fpsOn) {
    fpsN++; fpsT += dt;
    if (fpsT >= 1) { UI.el.fps.textContent = `${fpsN} fps  ${renderer.info.render.calls} calls  ${(renderer.info.render.triangles / 1000).toFixed(0)}k tris`; fpsN = 0; fpsT = 0; }
  }
}

let fpsOn = /[?&]fps/.test(location.search), fpsN = 0, fpsT = 0;
if (fpsOn) UI.el.fps.classList.remove('hidden');

// ------------------------------------------------------------------ boot
UI.setMuteIcon(false);
reset();
UI.showMenu(loadBest());
renderer.setAnimationLoop(frame);

document.addEventListener('visibilitychange', () => { if (document.hidden) Audio.suspend(); else Audio.resume(); });
['pointerdown', 'touchend', 'click'].forEach((ev) => document.addEventListener(ev, () => Audio.resume(), { passive: true }));

// debug / testing hooks
window.__nl = {
  G, world, train, cab, sfx, pax, camera, renderer, get score() { return score; }, handlers, setView,
  teleport(d) { G.dist = d; G.zone = newZone(zoneIndexAt(d)); },
  // step the sim manually (used for testing when rAF is throttled, e.g. hidden tab)
  advance(sec, dt = 1 / 60) {
    let now = (frame.last || performance.now());
    const n = Math.round(sec / dt), t0 = performance.now();
    for (let i = 0; i < n; i++) { now += dt * 1000; frame(now); }
    return { frames: n, msPerFrame: (performance.now() - t0) / n };
  },
};
