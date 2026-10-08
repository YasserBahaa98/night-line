// Route layout + tuning constants. Everything is measured in "dist": metres along the track.
export const KMH = 0.6; // world units per second, per km/h on the gauge
export const STEPS = [0, 20, 40, 60]; // the four speed steps (km/h)
export const TOTAL = 2300;
export const START_DIST = 14;

export const STATIONS = [520, 1320, 2120]; // where the cab should stop
export const STATION_NAMES = ['Sunny Hill', 'Pine Town', 'Moon Bay'];
export const STATION_ICONS = ['☀️', '🌲', '🌙'];
export const APPROACH = 170; // auto-slow starts this far before the stop mark
export const PLAT = { from: -48, to: 36 }; // platform extent relative to stop mark

export const SEATS = 24;
export const QUOTA = [8, 8, 8];

export const ZONES = [
  [0, 40], [180, 60], [350, 20], [560, 40], [700, 60], [900, 20], [1050, 40],
  [1150, 20], [1360, 60], [1550, 40], [1700, 60], [1880, 40], [1950, 20], [2160, 40],
].map(([start, limit]) => ({ start, limit }));

export const TUNNELS = [[640, 860], [1400, 1620], [1760, 1900]];
export const BRIDGE = [940, 1010];
export const VILLAGE = [1020, 1135];

export const SIGN_ICON = { 20: '🐢', 40: '🐇', 60: '🚀' };

export function zoneIndexAt(d) {
  let i = 0;
  for (let k = 0; k < ZONES.length; k++) if (d >= ZONES[k].start) i = k;
  return i;
}
export const signDist = (k) => (k === 0 ? 30 : ZONES[k].start);

export function tunnelAt(d) {
  for (let i = 0; i < TUNNELS.length; i++) if (d >= TUNNELS[i][0] && d <= TUNNELS[i][1]) return i;
  return -1;
}

const clamp01 = (x) => Math.min(1, Math.max(0, x));
// 0 = daylight, 1 = pitch dark. Ramps over a few metres at each mouth.
export function darkness(d) {
  let k = 0;
  for (const [a, b] of TUNNELS) {
    k = Math.max(k, clamp01((d - (a - 6)) / 12) * clamp01((b + 6 - d) / 12));
  }
  return k;
}
