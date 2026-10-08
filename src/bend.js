import * as THREE from 'three';

// The whole game is laid out in "straight space": the track runs along -z (z = -dist) and x is the
// sideways offset. At draw time every vertex is bent onto a curvy, hilly centre line, so the gameplay
// code never has to know the track curves.
//
//  * left/right: the track is a chain of arcs (constant curvature per piece). A point (x, y, -d) lands at
//    centre(d) + normal(d) * x, i.e. things beside the track turn with it.
//  * up/down: smooth cosine hills. Height is just added (no tilt), so trees and people stay upright.
//
// Stations, the bridge and the start are kept straight and flat (their long platforms are single boxes).

// [start dist, curvature (1/m, + = bends right)] - each piece runs until the next one starts.
const CURVES = [
  [0, 0], // (the first piece also extends backwards behind the start)
  [70, 1 / 450], [190, -1 / 450], [310, 0],          // S-bend through the fields
  [650, -1 / 500], [750, 1 / 500], [850, 0],         // a swerve inside tunnel 1
  [1030, 1 / 600], [1140, -1 / 600], [1250, 0],      // past the village
  [1420, 1 / 500], [1520, -1 / 500], [1620, 0],      // tunnel 2
  [1640, -1 / 450], [1700, 1 / 450], [1760, 0],      // little wiggle before tunnel 3
  [1780, 1 / 450], [1840, -1 / 450], [1900, 0],      // tunnel 3
  [1920, -1 / 420], [1980, 1 / 420], [2040, 0],      // into Moon Bay
  [2200, 1 / 500], [2320, 0],                        // end of the line
];

// [start dist, length, height] - one smooth bump each (negative = dip)
const HILLS = [
  [80, 340, 7],
  [610, 270, 5],
  [1035, 195, 6],
  [1630, 125, -4],
  [1905, 130, 5],
  [2190, 260, 6],
];

// starting position / heading of every arc
const SEG = [];
{
  // walk the arcs from dist 0 (at the origin, heading straight down -z)
  let x = 0, z = 0, th = 0;
  for (let i = 0; i < CURVES.length; i++) {
    const [d, k] = CURVES[i];
    if (i > 0) {
      const [d0, k0] = CURVES[i - 1], s = d - d0;
      if (Math.abs(k0) < 1e-9) { x += Math.sin(th) * s; z -= Math.cos(th) * s; }
      else { const t1 = th + k0 * s; x += (Math.cos(th) - Math.cos(t1)) / k0; z -= (Math.sin(t1) - Math.sin(th)) / k0; th = t1; }
    }
    SEG.push({ d, k, x, z, th });
  }
}

export function heightAt(d) {
  let h = 0;
  for (const [s, L, A] of HILLS) if (d > s && d < s + L) h += A * 0.5 * (1 - Math.cos((2 * Math.PI * (d - s)) / L));
  return h;
}

function segAt(d) { let i = 0; for (let k = 1; k < SEG.length; k++) if (d >= SEG[k].d) i = k; return SEG[i]; }

// heading of the track at dist d (radians, 0 = straight ahead along -z, + = turned right)
export function headingAt(d) { const s = segAt(d); return s.th + s.k * (d - s.d); }

// straight-space point -> bent world point (in place)
export function bend(v) {
  const d = -v.z, sg = segAt(d), s = d - sg.d, th = sg.th + sg.k * s;
  let cx, cz;
  if (Math.abs(sg.k) < 1e-9) { cx = sg.x + Math.sin(sg.th) * s; cz = sg.z - Math.cos(sg.th) * s; }
  else { cx = sg.x + (Math.cos(sg.th) - Math.cos(th)) / sg.k; cz = sg.z - (Math.sin(th) - Math.sin(sg.th)) / sg.k; }
  const x = v.x;
  return v.set(cx + Math.cos(th) * x, v.y + heightAt(d), cz + Math.sin(th) * x);
}

// ---------------------------------------------------------------- GLSL twin of bend()
const f = (n) => { const s = Number(n).toPrecision(9); return s.includes('.') || s.includes('e') ? s : s + '.0'; };
const arr = (name, list) => `const float ${name}[${list.length}] = float[${list.length}](${list.map(f).join(', ')});`;
export const BEND_GLSL = `
${arr('nlD', SEG.map((s) => s.d))}
${arr('nlK', SEG.map((s) => s.k))}
${arr('nlX', SEG.map((s) => s.x))}
${arr('nlZ', SEG.map((s) => s.z))}
${arr('nlT', SEG.map((s) => s.th))}
${arr('nlHs', HILLS.map((h) => h[0]))}
${arr('nlHl', HILLS.map((h) => h[1]))}
${arr('nlHa', HILLS.map((h) => h[2]))}
vec3 nlBend(vec3 p) {
  float d = -p.z;
  int i = 0;
  for (int k = 1; k < ${SEG.length}; k++) if (d >= nlD[k]) i = k;
  float s = d - nlD[i], k = nlK[i], t0 = nlT[i], th = t0 + k * s;
  vec2 c = abs(k) < 1e-9
    ? vec2(nlX[i] + sin(t0) * s, nlZ[i] - cos(t0) * s)
    : vec2(nlX[i] + (cos(t0) - cos(th)) / k, nlZ[i] - (sin(th) - sin(t0)) / k);
  float h = 0.0;
  for (int j = 0; j < ${HILLS.length}; j++) {
    float u = (d - nlHs[j]) / nlHl[j];
    if (u > 0.0 && u < 1.0) h += nlHa[j] * 0.5 * (1.0 - cos(6.28318530718 * u));
  }
  return vec3(c.x + cos(th) * p.x, p.y + h, c.y + sin(th) * p.x);
}
`;

// Patch three's built-in shaders once, before anything compiles. Opt out per material with
// material.defines = { NL_NOBEND: '' } (sky things that follow the camera).
let installed = false;
export function installBend() {
  if (installed) return; installed = true;
  THREE.ShaderChunk.common += `\n#ifndef NL_BEND_FN\n#define NL_BEND_FN\n${BEND_GLSL}\n#endif\n`;
  THREE.ShaderChunk.project_vertex = THREE.ShaderChunk.project_vertex.replace(
    'mvPosition = modelViewMatrix * mvPosition;',
    `#ifdef NL_NOBEND
    mvPosition = modelViewMatrix * mvPosition;
    #else
    mvPosition = viewMatrix * vec4( nlBend( ( modelMatrix * mvPosition ).xyz ), 1.0 );
    #endif`);
  THREE.ShaderLib.sprite.vertexShader = THREE.ShaderLib.sprite.vertexShader.replace(
    'vec4 mvPosition = modelViewMatrix[ 3 ];',
    `#ifdef NL_NOBEND
    vec4 mvPosition = modelViewMatrix[ 3 ];
    #else
    vec4 mvPosition = viewMatrix * vec4( nlBend( modelMatrix[ 3 ].xyz ), 1.0 );
    #endif`);
}

export const noBend = (mat) => { mat.defines = { ...(mat.defines || {}), NL_NOBEND: '' }; return mat; };

// Bent objects no longer sit where their straight-space bounding spheres say, so turn off frustum culling.
export function noCull(root) { root.traverse((o) => { o.frustumCulled = false; }); }

