// Points are awarded by events (a finished speed zone, a tunnel, a stop, a seated passenger...) so
// kids see "+N" pop up right when they do something good. Max total = 1000.
export const MAX = { speed: 300, lights: 270, stops: 240, friends: 150, comfort: 40 };
export const STAR2 = 600;
export const STAR3 = 850;
export const MAX_TOTAL = 1000;

export const starsFor = (total) => (total >= STAR3 ? 3 : total >= STAR2 ? 2 : 1);

export function createScore() {
  const s = { speed: 0, lights: 0, stops: 0, friends: 0, comfort: 0 };
  Object.defineProperty(s, 'total', { get() { return Math.round(s.speed + s.lights + s.stops + s.friends + s.comfort); }, enumerable: false });
  return s;
}

const KEY = 'nightline.best.v1';
export function loadBest() {
  try { const v = JSON.parse(localStorage.getItem(KEY)); if (v && typeof v.score === 'number') return v; } catch (e) { /* private mode etc. */ }
  return { score: 0, stars: 0 };
}
export function saveBest(score, stars) {
  const old = loadBest();
  const best = { score: Math.max(old.score, score), stars: Math.max(old.stars, stars) };
  try { localStorage.setItem(KEY, JSON.stringify(best)); } catch (e) { /* ignore */ }
  return { best, isNew: score > old.score };
}
