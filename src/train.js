import * as THREE from 'three';
import { bx, cylZ, cylY, sph, paint, merge, glowTex } from './geo.js';

// Shared "interior light" amount (0..1). Anything built with cabinMaterial() brightens when the passenger lights are on.
export const cabin = { value: 0 };

export function cabinMaterial(opts = {}) {
  const m = new THREE.MeshLambertMaterial({ flatShading: true, ...opts });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uCabin = cabin;
    shader.fragmentShader = 'uniform float uCabin;\n' + shader.fragmentShader.replace(
      '#include <opaque_fragment>', 'outgoingLight += diffuseColor.rgb * uCabin;\n#include <opaque_fragment>');
  };
  m.customProgramCacheKey = () => 'cabin';
  return m;
}

const COACH_Z = [9.9, 19.9];       // local z of each carriage centre (train points toward -z)
const ROWS = [-3.8, -2.6, -1.4, 1.4, 2.6, 3.8];
const SPOT_I = 650;

function buildCoach(main, accent) {
  const CREAM = 0xfff0d2, DARK = 0x2f2b45, WOOD = 0xc9996a;
  const seatCols = [0xff8a5b, 0xffc83d, 0x6dd3ff];
  const p = [];
  p.push(bx(2.9, 0.22, 9.4, 0, 0.79, 0, WOOD));
  p.push(bx(2.0, 0.3, 8.4, 0, 0.5, 0, DARK));
  p.push(bx(3.1, 0.18, 9.8, 0, 3.15, 0, accent));
  p.push(bx(2.3, 0.24, 9.4, 0, 3.34, 0, accent));
  p.push(bx(0.14, 1.0, 9.4, -1.4, 1.4, 0, main));
  p.push(bx(0.14, 1.0, 3.95, 1.4, 1.4, -2.725, main), bx(0.14, 1.0, 3.95, 1.4, 1.4, 2.725, main));
  p.push(bx(0.06, 0.2, 9.4, -1.5, 1.1, 0, accent));
  p.push(bx(0.06, 0.2, 3.95, 1.5, 1.1, -2.725, accent), bx(0.06, 0.2, 3.95, 1.5, 1.1, 2.725, accent));
  for (const x of [-1.4, 1.4]) {
    for (const z of [-4.6, -2.7, -0.75, 0.75, 2.7, 4.6]) p.push(bx(0.16, 1.05, 0.22, x, 2.42, z, CREAM));
    p.push(bx(0.16, 0.22, 9.4, x, 3.0, 0, main));
  }
  p.push(bx(2.9, 0.22, 0.2, 0, 3.0, -4.7, accent), bx(2.9, 0.22, 0.2, 0, 3.0, 4.7, accent));
  let k = 0;
  for (const rz of ROWS) for (const sx of [-0.9, 0.9]) {
    const c = seatCols[k++ % 3];
    p.push(bx(0.8, 0.45, 0.85, sx, 1.12, rz, c));
    p.push(bx(0.8, 0.75, 0.12, sx, 1.75, rz - 0.45, c));
  }
  return merge(p);
}

function buildLoco() {
  const RED = 0xe0443e, DARK = 0x2f2b45, GOLD = 0xffc83d, CREAM = 0xfff0d2;
  const p = [];
  p.push(bx(2.4, 0.5, 10.4, 0, 0.8, -1.4, DARK));
  p.push(cylZ(0.85, 0.85, 5.2, 12, 0, 1.75, -3.5, RED));
  p.push(cylZ(0.89, 0.89, 0.2, 12, 0, 1.75, -2.2, GOLD), cylZ(0.89, 0.89, 0.2, 12, 0, 1.75, -4.4, GOLD));
  p.push(cylZ(0.88, 0.88, 0.7, 12, 0, 1.75, -6.0, DARK));
  p.push(cylZ(0.72, 0.72, 0.12, 12, 0, 1.75, -6.4, GOLD));
  p.push(cylY(0.4, 0.26, 0.95, 8, 0, 3.05, -5.2, DARK), cylY(0.5, 0.5, 0.12, 8, 0, 3.56, -5.2, GOLD));
  p.push(sph(0.42, 10, 6, 0, 2.62, -3.1, GOLD, 0.8), sph(0.3, 8, 6, 0, 2.55, -1.8, GOLD, 0.8));
  p.push(bx(2.1, 0.5, 0.9, 0, 0.55, -6.9, GOLD), bx(1.5, 0.35, 0.5, 0, 0.5, -7.35, RED));
  for (const x of [-1.45, 1.45]) p.push(bx(0.1, 0.18, 3.6, x, 0.62, -2.9, GOLD));
  // cab
  p.push(bx(2.7, 0.2, 4.6, 0, 1.1, 1.4, DARK));
  for (const x of [-1.29, 1.29]) {
    p.push(bx(0.12, 1.1, 4.6, x, 1.75, 1.4, RED));
    p.push(bx(0.16, 1.6, 0.2, x, 3.1, 3.6, CREAM));
    p.push(bx(0.14, 0.22, 4.6, x, 3.95, 1.4, RED));
  }
  p.push(bx(2.7, 2.6, 0.12, 0, 2.45, 3.7, RED));
  p.push(bx(3.1, 0.22, 5.2, 0, 4.2, 1.4, CREAM), bx(2.2, 0.2, 5.0, 0, 4.4, 1.4, RED));
  p.push(bx(2.6, 0.1, 0.5, 0, 1.0, 4.0, GOLD));
  // coupling to the first carriage
  p.push(bx(0.22, 0.22, 1.8, 0, 0.9, 4.5, DARK));
  return merge(p);
}

function wheelGeo() {
  const rim = new THREE.CylinderGeometry(1, 1, 0.16, 10); rim.rotateZ(Math.PI / 2); paint(rim, 0x2f2b45);
  const spoke = bx(0.2, 1.7, 0.22, 0, 0, 0, 0xffc83d);
  const spoke2 = bx(0.2, 0.22, 1.7, 0, 0, 0, 0xffc83d);
  return merge([rim, spoke, spoke2]);
}

export function makeTrain() {
  const root = new THREE.Group();
  const vc = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  root.add(new THREE.Mesh(buildLoco(), vc));

  // carriages (lit by the shared "cabin" uniform)
  const cabinVC = cabinMaterial({ vertexColors: true });
  const glassMat = new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0x4a4560 });
  const glassGeo = merge([
    new THREE.PlaneGeometry(9.2, 0.95).rotateY(Math.PI / 2).translate(1.41, 2.42, 0),
    new THREE.PlaneGeometry(9.2, 0.95).rotateY(-Math.PI / 2).translate(-1.41, 2.42, 0),
  ].map((g) => { g.deleteAttribute('uv'); return g; }));
  const lampGeo = merge([new THREE.BoxGeometry(0.4, 0.06, 3.4).translate(0, 2.95, -2.3), new THREE.BoxGeometry(0.4, 0.06, 3.4).translate(0, 2.95, 2.3)].map((g) => { g.deleteAttribute('uv'); return g; }));
  const coachGeos = [buildCoach(0x3f8fd2, 0xffc83d), buildCoach(0x37b98a, 0xff8a5b)];
  COACH_Z.forEach((cz, i) => {
    const g = new THREE.Group(); g.position.z = cz;
    g.add(new THREE.Mesh(coachGeos[i], cabinVC), new THREE.Mesh(glassGeo, glassMat), new THREE.Mesh(lampGeo, lampMat));
    root.add(g);
  });
  // coupling between carriages
  const coup = new THREE.Mesh(merge([bx(0.22, 0.22, 1.0, 0, 0.9, 14.9, 0x2f2b45)]), vc); root.add(coup);

  // wheels
  const wheelSpec = [];
  for (const x of [-1.3, 1.3]) for (const z of [-4.6, -2.9, -1.2]) wheelSpec.push([x, 0.55, z, 0.55]);
  for (const cz of COACH_Z) for (const x of [-1.15, 1.15]) for (const dz of [-4.1, -2.7, 2.7, 4.1]) wheelSpec.push([x, 0.42, cz + dz, 0.42]);
  const wheels = new THREE.InstancedMesh(wheelGeo(), vc, wheelSpec.length);
  wheels.frustumCulled = false;
  root.add(wheels);
  const dummy = new THREE.Object3D();
  let roll = 0;

  // headlight: one real SpotLight + faked glow cone / lens / sprite
  const spot = new THREE.SpotLight(0xfff1c9, 0, 160, 0.6, 0.9, 1.0);
  spot.position.set(0, 2.4, -6.5);
  spot.target.position.set(0, 0.2, -45);
  root.add(spot, spot.target);

  const lensMat = new THREE.MeshBasicMaterial({ color: 0x77708f });
  const lens = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), lensMat); lens.position.set(0, 2.35, -6.55); root.add(lens);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xfff0c0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  glow.scale.set(1.8, 1.8, 1); glow.position.set(0, 2.35, -6.9); root.add(glow);

  const H = 48; const cone = new THREE.ConeGeometry(6, H, 20, 1, true);
  {
    const pos = cone.attributes.position, col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const t = (pos.getY(i) + H / 2) / H; // 1 at the tip, 0 at the far end
      const k = Math.pow(t, 2.4) * 0.3;
      col[i * 3] = k; col[i * 3 + 1] = k * 0.92; col[i * 3 + 2] = k * 0.7;
    }
    cone.setAttribute('color', new THREE.BufferAttribute(col, 3));
    cone.rotateX(Math.PI / 2);
  }
  const beamMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false, opacity: 0 });
  const beam = new THREE.Mesh(cone, beamMat); beam.position.set(0, 2.3, -6.6 - H / 2); beam.rotation.x = 0.045; beam.renderOrder = 3; root.add(beam);

  // seat + door positions (train-local) for the passengers
  const seats = []; const doors = [];
  COACH_Z.forEach((cz) => {
    doors.push({ x: 1.4, z: cz });
    for (const rz of ROWS) for (const sx of [-0.9, 0.9]) seats.push({ x: sx, y: 1.35, z: cz + rz });
  });

  let hl = 0, cl = 0;
  const funnel = new THREE.Vector3(0, 3.9, -5.2);
  const tmp = new THREE.Vector3();

  return {
    root, seats, doors, spot,
    funnelWorld() { return tmp.copy(funnel).applyMatrix4(root.matrixWorld); },
    wheelWorld(out) { return out.set(0, 0.5, -3).applyMatrix4(root.matrixWorld); },
    get headLevel() { return hl; },
    update(dt, v, head, cabinOn) {
      hl += (head - hl) * Math.min(1, dt * 9);
      cl += (cabinOn - cl) * Math.min(1, dt * 7);
      spot.intensity = hl * SPOT_I;
      lensMat.color.setRGB(0.47 + hl * 0.53, 0.44 + hl * 0.52, 0.56 + hl * 0.2);
      glow.material.opacity = hl * 0.55;
      beamMat.opacity = hl;
      cabin.value = cl * 0.8;
      glassMat.opacity = 0.1 + cl * 0.42;
      lampMat.color.setRGB(0.29 + cl * 0.71, 0.27 + cl * 0.68, 0.38 + cl * 0.32);
      roll += v * dt;
      for (let i = 0; i < wheelSpec.length; i++) {
        const [x, y, z, r] = wheelSpec[i];
        dummy.position.set(x, y, z); dummy.rotation.set(-roll / r, 0, 0); dummy.scale.set(1, r, r); dummy.updateMatrix();
        wheels.setMatrixAt(i, dummy.matrix);
      }
      wheels.instanceMatrix.needsUpdate = true;
    },
  };
}
