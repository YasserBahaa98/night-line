import { SIGN_ICON, SEATS, STATION_NAMES } from './route.js';
import { MAX, MAX_TOTAL, STAR2, STAR3 } from './scoring.js';

const $ = (id) => document.getElementById(id);
const el = {
  hud: $('hud'), score: $('score'), scoreVal: $('scoreVal'), starFill: $('starFill'), starBar: $('starBar'),
  stops: $('stops'), banner: $('banner'), bannerIcon: $('bannerIcon'), bannerText: $('bannerText'),
  seatBox: $('seatBox'), seatNum: $('seatNum'), pips: $('pips'),
  face: $('face'), comfortFill: $('comfortFill'), mute: $('btnMute'),
  camStrip: $('camStrip'), dash: $('dash'),
  slow: $('btnSlow'), go: $('btnGo'), leave: $('btnLeave'), head: $('btnHead'), cabin: $('btnCabin'),
  gauge: $('gauge'), needle: $('needle'), bandSlow: $('bandSlow'), bandGood: $('bandGood'), bandFast: $('bandFast'),
  limitSign: $('limitSign'), limitIcon: $('limitIcon'), limitNum: $('limitNum'),
  menu: $('menu'), play: $('btnPlay'), best: $('best'),
  results: $('results'), stars: $('stars'), rows: $('rows'), resScore: $('resScore'), resBest: $('resBest'), resTitle: $('resTitle'), again: $('btnAgain'),
  confetti: $('confetti'), fps: $('fps'),
};
export { el };

let bannerTimer = 0;
const cache = {};
const setText = (node, key, v) => { if (cache[key] !== v) { cache[key] = v; node.textContent = v; } };
const toggle = (node, cls, on) => { const k = `${node.id}.${cls}`; if (cache[k] !== on) { cache[k] = on; node.classList.toggle(cls, on); } };

// ---------- gauge ----------
const GMAX = 80;
function arc(v1, v2) {
  if (v2 <= v1) return '';
  const pt = (v) => { const a = Math.PI * (1 - v / GMAX); return [100 + 80 * Math.cos(a), 100 - 80 * Math.sin(a)]; };
  const [x1, y1] = pt(v1), [x2, y2] = pt(v2);
  return `M${x1.toFixed(1)} ${y1.toFixed(1)} A80 80 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}
export function setLimit(limit, bounce = true) {
  if (cache.limit === limit) return;
  cache.limit = limit;
  const lo = Math.max(0, limit - 20);
  el.bandSlow.setAttribute('d', arc(0, lo));
  el.bandGood.setAttribute('d', arc(lo, limit));
  el.bandFast.setAttribute('d', arc(limit, GMAX));
  el.limitIcon.textContent = SIGN_ICON[limit]; el.limitNum.textContent = limit;
  if (bounce) { el.limitSign.classList.remove('bounce'); void el.limitSign.offsetWidth; el.limitSign.classList.add('bounce'); }
}
export function setGauge(kmh, over) {
  const a = (Math.min(GMAX, kmh) / GMAX) * 180 - 90;
  const key = Math.round(a * 2);
  if (cache.needle !== key) { cache.needle = key; el.needle.style.transform = `rotate(${a.toFixed(1)}deg)`; }
  toggle(el.gauge, 'over', over);
}

// ---------- HUD bits ----------
export function showHUD(on) { el.hud.classList.toggle('hidden', !on); document.body.classList.toggle('driving', on); }

let shownScore = 0;
export function setScore(total, pop = false) {
  setText(el.scoreVal, 'score', total);
  el.starFill.style.width = `${Math.min(100, (total / MAX_TOTAL) * 100)}%`;
  const s = el.starBar.querySelectorAll('s');
  s[0].classList.toggle('got', total >= STAR2); s[1].classList.toggle('got', total >= STAR3); s[2].classList.toggle('got', total >= MAX_TOTAL);
  if (pop) { el.score.classList.remove('pop'); void el.score.offsetWidth; el.score.classList.add('pop'); }
  shownScore = total;
}

export function setStops(next, done) {
  el.stops.querySelectorAll('.dot').forEach((d, i) => { d.classList.toggle('done', i < done); d.classList.toggle('now', i === next && i >= done); });
}

export function banner(text, icon = '', kind = '', ms = 2800) {
  el.bannerIcon.textContent = icon; el.bannerText.textContent = text;
  el.banner.className = `show ${kind}`;
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => { el.banner.classList.remove('show'); }, ms);
}
export function hideBanner() { clearTimeout(bannerTimer); el.banner.classList.remove('show'); }

export function popup(text) {
  const d = document.createElement('div'); d.className = 'float'; d.textContent = text;
  d.style.top = `${34 + Math.random() * 8}%`; d.style.left = `${46 + Math.random() * 8}%`;
  document.body.appendChild(d); setTimeout(() => d.remove(), 1600);
}

export function setComfort(c) {
  el.comfortFill.style.width = `${Math.round(c * 100)}%`;
  el.comfortFill.style.background = c > 0.6 ? '#6dffa0' : c > 0.35 ? '#ffd34a' : '#ff6b6b';
  setText(el.face, 'face', c > 0.66 ? '😊' : c > 0.4 ? '😐' : '😢');
}

export function setLights(head, cabin) { toggle(el.head, 'on', head); toggle(el.cabin, 'on', cabin); }
export function hintLights(head, cabin) { toggle(el.head, 'hint', head); toggle(el.cabin, 'hint', cabin); }

export function setSlowMode(mode) { // 'slow' | 'stop' | 'now' | 'off'
  const stop = mode === 'stop' || mode === 'now';
  if (cache.slowMode !== (stop ? 'stop' : 'slow')) {
    cache.slowMode = stop ? 'stop' : 'slow';
    el.slow.querySelector('.ic').textContent = stop ? '🛑' : '🐢';
    el.slow.querySelector('em').textContent = stop ? 'STOP' : 'SLOW';
  }
  toggle(el.slow, 'now', mode === 'now');
  toggle(el.slow, 'off', mode === 'off');
}
export function setGoMode(mode) { // 'go' | 'goCapped' | 'off' | 'leave' | 'leaveEarly'
  const stationMode = mode === 'leave' || mode === 'leaveEarly';
  toggle(el.go, 'hidden', stationMode); toggle(el.leave, 'hidden', !stationMode);
  toggle(el.go, 'off', mode === 'off');
  toggle(el.leave, 'green', mode === 'leave'); toggle(el.leave, 'orange', mode === 'leaveEarly'); toggle(el.leave, 'pulse', mode === 'leave');
  toggle(el.slow, 'hidden', false);
}
export function setDriveButtonsDimmed(dim) { toggle(el.slow, 'off', dim); }
export function pulseGo(on) { toggle(el.go, 'pulse', on); }

export function buildPips() {
  el.pips.innerHTML = '';
  for (let i = 0; i < SEATS; i++) el.pips.appendChild(document.createElement('i'));
}
export function setSeats(n, bump = false) {
  setText(el.seatNum, 'seats', n);
  const pips = el.pips.children;
  for (let i = 0; i < pips.length; i++) pips[i].classList.toggle('on', i < n);
  if (bump) { el.seatBox.classList.remove('bump'); void el.seatBox.offsetWidth; el.seatBox.classList.add('bump'); }
}
export function showSeatBox(on) { el.seatBox.classList.toggle('show', on); if (!on) el.seatBox.classList.remove('full'); }
export function seatsFull() { el.seatBox.classList.add('full'); }

export function setCamStrip(show, view) {
  el.camStrip.classList.toggle('show', show);
  el.camStrip.querySelectorAll('.cam').forEach((b) => b.classList.toggle('on', b.dataset.view === view));
}

// ---------- menu ----------
export function showMenu(best) {
  el.menu.classList.remove('out'); el.menu.style.display = '';
  const st = best.stars;
  el.best.textContent = best.score ? `BEST  ${'★'.repeat(st)}${'☆'.repeat(3 - st)}  ${best.score}` : '';
}
export function hideMenu() { el.menu.classList.add('out'); setTimeout(() => { el.menu.style.display = 'none'; }, 750); }

// ---------- mute ----------
export function setMuteIcon(m) { el.mute.textContent = m ? '🔇' : '🔊'; }

// ---------- input wiring ----------
export function bind(h) {
  const press = (node, fn) => node.addEventListener('pointerdown', (e) => { e.preventDefault(); fn(e); });
  press(el.slow, () => h.slow()); press(el.go, () => h.go()); press(el.leave, () => h.leave());
  press(el.head, () => h.head()); press(el.cabin, () => h.cabinLights()); press(el.mute, () => h.mute());
  el.camStrip.querySelectorAll('.cam').forEach((b) => press(b, () => h.view(b.dataset.view)));
  // PLAY / AGAIN use "click" (fires after touchend) so iOS accepts them as the audio-unlocking gesture
  el.play.addEventListener('click', (e) => { e.preventDefault(); h.play(); });
  el.again.addEventListener('click', (e) => { e.preventDefault(); h.again(); });
  // no rubber-banding / pinch / double-tap zoom
  document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  let last = 0;
  document.addEventListener('touchend', (e) => { const n = Date.now(); if (n - last < 350) e.preventDefault(); last = n; }, { passive: false });
}

// ---------- results ----------
const ROW_DEFS = [
  ['speed', '🐇', MAX.speed], ['lights', '💡', MAX.lights], ['stops', '🚏', MAX.stops], ['friends', '🧑‍🤝‍🧑', MAX.friends], ['comfort', '😊', MAX.comfort],
];
export function showResults(score, stars, bestInfo, hooks) {
  el.results.classList.remove('hidden');
  el.rows.innerHTML = ''; [...el.stars.children].forEach((s) => s.classList.remove('lit'));
  el.resScore.textContent = '0';
  el.resTitle.textContent = stars === 3 ? 'Superstar driver!' : stars === 2 ? 'Great driving!' : 'Nice job!';
  el.resBest.textContent = bestInfo.isNew ? '🎉 New best!' : `Best: ${bestInfo.best.score}`;
  ROW_DEFS.forEach(([k, ico, max], i) => {
    const r = document.createElement('div'); r.className = 'row'; r.style.animationDelay = `${0.3 + i * 0.16}s`;
    r.innerHTML = `<span class="ico">${ico}</span><div class="meter"><i></i></div><span class="num">${Math.round(score[k])}</span>`;
    el.rows.appendChild(r);
    setTimeout(() => { r.querySelector('i').style.width = `${(score[k] / max) * 100}%`; hooks.tick(i); }, 450 + i * 160);
  });
  // count the total up
  const t0 = performance.now(), dur = 1300, delay = 500;
  const step = (now) => {
    const k = Math.min(1, Math.max(0, (now - t0 - delay) / dur));
    el.resScore.textContent = Math.round(score.total * (1 - Math.pow(1 - k, 3)));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  // stars pop in one by one
  const starEls = [...el.stars.children];
  for (let i = 0; i < stars; i++) setTimeout(() => { starEls[i].classList.add('lit'); hooks.star(i); if (i === stars - 1) { hooks.done(); burstConfetti(stars === 3 ? 220 : 120); } }, 1700 + i * 650);
}
export function hideResults() { el.results.classList.add('hidden'); }

// ---------- confetti (own tiny 2D canvas, only runs while there is something to draw) ----------
let confParts = [], confRun = false;
export function burstConfetti(n = 150) {
  const c = el.confetti, dpr = Math.min(window.devicePixelRatio || 1, 2);
  c.width = innerWidth * dpr; c.height = innerHeight * dpr;
  const cols = ['#ff6b6b', '#ffd43b', '#69db7c', '#4dabf7', '#da77f2', '#ff922b'];
  for (let i = 0; i < n; i++) {
    confParts.push({ x: c.width * (0.2 + Math.random() * 0.6), y: c.height * 0.2, vx: (Math.random() - 0.5) * 16 * dpr, vy: (-6 - Math.random() * 12) * dpr, r: (4 + Math.random() * 6) * dpr, a: Math.random() * 6, va: (Math.random() - 0.5) * 0.4, c: cols[i % cols.length], life: 1 });
  }
  if (confRun) return; confRun = true;
  const g = c.getContext('2d');
  const loop = () => {
    g.clearRect(0, 0, c.width, c.height);
    confParts = confParts.filter((p) => p.life > 0 && p.y < c.height + 40);
    for (const p of confParts) {
      p.vy += 0.38 * dpr; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.a += p.va; p.life -= 0.003;
      g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.fillStyle = p.c; g.globalAlpha = Math.min(1, p.life * 3);
      g.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r); g.restore();
    }
    if (confParts.length) requestAnimationFrame(loop); else { confRun = false; g.clearRect(0, 0, c.width, c.height); }
  };
  requestAnimationFrame(loop);
}

export { STATION_NAMES };
