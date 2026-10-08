import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export { mergeGeometries };

const _c = new THREE.Color();

// Bake a flat colour into a geometry so many parts can be merged into ONE mesh (one draw call).
export function paint(geo, hex) {
  const n = geo.attributes.position.count;
  const a = new Float32Array(n * 3);
  _c.set(hex);
  for (let i = 0; i < n; i++) { a[i * 3] = _c.r; a[i * 3 + 1] = _c.g; a[i * 3 + 2] = _c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}

export function bx(w, h, d, x, y, z, hex) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return paint(g, hex);
}

// cylinder along Z axis
export function cylZ(r0, r1, len, seg, x, y, z, hex) {
  const g = new THREE.CylinderGeometry(r0, r1, len, seg);
  g.rotateX(Math.PI / 2);
  g.translate(x, y, z);
  return paint(g, hex);
}

export function cylY(r0, r1, h, seg, x, y, z, hex) {
  const g = new THREE.CylinderGeometry(r0, r1, h, seg);
  g.translate(x, y, z);
  return paint(g, hex);
}

export function sph(r, ws, hs, x, y, z, hex, sy = 1) {
  const g = new THREE.SphereGeometry(r, ws, hs);
  g.scale(1, sy, 1);
  g.translate(x, y, z);
  return paint(g, hex);
}

export function merge(list) {
  const g = mergeGeometries(list, false);
  list.forEach((l) => l.dispose());
  return g;
}

export function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function glowTex() {
  return canvasTex(128, 128, (g) => {
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.25, 'rgba(255,240,200,.6)'); grd.addColorStop(1, 'rgba(255,230,160,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  });
}

export const lambertVC = () => new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
