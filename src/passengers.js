import * as THREE from 'three';
import { cabinMaterial } from './train.js';
import { rng, canvasTex } from './geo.js';
import { SEATS, QUOTA } from './route.js';

// Little instanced low-poly people. 5 instanced meshes draw all 24 of them.
function faceTexture(happy) {
  return canvasTex(128, 128, (g) => {
    g.clearRect(0, 0, 128, 128);
    g.fillStyle = 'rgba(255,120,120,.45)';
    g.beginPath(); g.ellipse(30, 78, 13, 8, 0, 0, 7); g.ellipse(98, 78, 13, 8, 0, 0, 7); g.fill();
    g.fillStyle = '#2a2140';
    g.beginPath(); g.ellipse(42, 52, 8, happy ? 11 : 9, 0, 0, 7); g.ellipse(86, 52, 8, happy ? 11 : 9, 0, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(45, 48, 3, 0, 7); g.arc(89, 48, 3, 0, 7); g.fill();
    g.strokeStyle = '#2a2140'; g.lineWidth = 8; g.lineCap = 'round'; g.beginPath();
    if (happy) g.arc(64, 78, 20, 0.15 * Math.PI, 0.85 * Math.PI); else { g.arc(64, 108, 18, 1.18 * Math.PI, 1.82 * Math.PI); }
    g.stroke();
    if (!happy) { g.fillStyle = '#6ec6ff'; g.beginPath(); g.ellipse(100, 74, 5, 9, 0, 0, 7); g.fill(); }
  });
}

const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
const easeBack = (t) => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

export function makePassengers(scene, seatsLocal, doorsLocal) {
  const N = SEATS; const R = rng(77);
  const bodyGeo = new THREE.CapsuleGeometry(0.26, 0.5, 3, 8).translate(0, 0.56, 0);
  const headGeo = new THREE.SphereGeometry(0.27, 10, 8).translate(0, 1.36, 0);
  const hairGeo = new THREE.SphereGeometry(0.29, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.4).translate(0, 1.4, -0.015);
  const faceGeo = new THREE.PlaneGeometry(0.42, 0.42).translate(0, 1.33, 0.272);

  const body = new THREE.InstancedMesh(bodyGeo, cabinMaterial({}), N);
  const head = new THREE.InstancedMesh(headGeo, cabinMaterial({}), N);
  const hair = new THREE.InstancedMesh(hairGeo, cabinMaterial({}), N);
  const faceH = new THREE.InstancedMesh(faceGeo, cabinMaterial({ map: faceTexture(true), transparent: true, alphaTest: 0.3 }), N);
  const faceS = new THREE.InstancedMesh(faceGeo, cabinMaterial({ map: faceTexture(false), transparent: true, alphaTest: 0.3 }), N);
  const meshes = [body, head, hair, faceH, faceS];
  meshes.forEach((m) => { m.frustumCulled = false; scene.add(m); });

  const skins = [0xffd2b0, 0xf0b48a, 0xc98c5e, 0x8d5a3a, 0xffe0c8];
  const hairs = [0x2a1f1a, 0x6b3b1e, 0xe0b23a, 0xc4452f, 0x3a2a6a, 0x1c1c1c];
  const shirts = [0xff6b6b, 0x4dabf7, 0xffd43b, 0x69db7c, 0xda77f2, 0xff922b, 0x38d9a9, 0xf783ac];
  const col = new THREE.Color();
  for (let i = 0; i < N; i++) {
    body.setColorAt(i, col.set(shirts[Math.floor(R() * shirts.length)]));
    head.setColorAt(i, col.set(skins[Math.floor(R() * skins.length)]));
    hair.setColorAt(i, col.set(hairs[Math.floor(R() * hairs.length)]));
  }

  const order = Array.from({ length: N }, (_, i) => i);
  for (let i = N - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }

  const P = Array.from({ length: N }, (_, i) => ({
    i, st: 'hidden', x: 0, y: 0.9, z: 0, yaw: 0, path: [], pi: 0, seat: seatsLocal[order[i]], station: 0,
    phase: R() * 6, scale: 0.9 + R() * 0.18, pop: 0, speed: 2.2 + R() * 0.5, wait: R() * 2,
  }));
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  const dummy = new THREE.Object3D();

  let boarding = null; let seatedCount = 0; let platformPhase = 0; let seatCb = null;
  const idsOf = (k) => { let s = 0; for (let j = 0; j < k; j++) s += QUOTA[j]; return Array.from({ length: QUOTA[k] }, (_, n) => s + n); };

  function setPose(p, i, happy, t) {
    let bob = 0;
    if (p.st === 'walking') bob = Math.abs(Math.sin(t * 11 + p.phase)) * 0.09;
    else if (p.st === 'waiting') bob = Math.abs(Math.sin(t * 2.2 + p.phase)) * 0.04;
    else if (p.st === 'seated') bob = Math.sin(t * 1.6 + p.phase) * 0.012;
    const s = p.scale * Math.max(0, p.pop);
    dummy.position.set(p.x, p.y + bob, p.z); dummy.rotation.set(0, p.yaw, 0); dummy.scale.setScalar(s); dummy.updateMatrix();
    body.setMatrixAt(i, dummy.matrix); head.setMatrixAt(i, dummy.matrix); hair.setMatrixAt(i, dummy.matrix);
    if (happy) { faceH.setMatrixAt(i, dummy.matrix); faceS.setMatrixAt(i, ZERO); } else { faceS.setMatrixAt(i, dummy.matrix); faceH.setMatrixAt(i, ZERO); }
  }

  return {
    get seated() { return seatedCount; },
    reset() { P.forEach((p) => { p.st = 'hidden'; p.pop = 0; }); seatedCount = 0; boarding = null; },

    spawnCrowd(k, S) {
      idsOf(k).forEach((id, n) => {
        const p = P[id];
        const door = doorsLocal[n % 2];
        p.st = 'waiting'; p.station = k; p.pop = 0; p.wait = n * 0.12;
        p.x = 3.6 + R() * 2.4; p.y = 0.9; p.z = -S + door.z + (R() - 0.5) * 4.5; p.yaw = -Math.PI / 2 + (R() - 0.5) * 0.6;
      });
    },

    startBoarding(k, dist, onSeated) {
      seatCb = onSeated;
      boarding ={ k, dist, queue: idsOf(k).filter((id) => P[id].st === 'waiting'), timer: 1.1, onSeated, total: QUOTA[k] };
    },

    allAboard(k) { return idsOf(k).every((id) => P[id].st === 'seated' || P[id].st === 'gone'); },
    waitingCount(k) { return idsOf(k).filter((id) => P[id].st === 'waiting').length; },
    boardingActive() { return !!boarding; },

    // anyone still on the platform waves goodbye (shrinks away) when the train leaves
    leaveBehind(k) {
      idsOf(k).forEach((id) => { const p = P[id]; if (p.st === 'waiting' || p.st === 'walking') { p.st = 'gone'; } });
      boarding = null;
    },

    update(dt, t, happy, trainZ) {
      platformPhase += dt;
      if (boarding) {
        boarding.timer -= dt;
        if (boarding.timer <= 0 && boarding.queue.length) {
          boarding.timer = 0.6;
          const id = boarding.queue.shift(); const p = P[id]; const s = p.seat;
          const dIdx = s.z < 15 ? 0 : 1; const doorZ = -boarding.dist + doorsLocal[dIdx].z; const seatZ = -boarding.dist + s.z;
          p.st = 'walking';
          p.path = [[1.75, 0.9, doorZ], [0.05, 0.9, doorZ], [0.05, 0.9, seatZ], [s.x, 1.35, seatZ]];
          p.pi = 0;
        }
        if (!boarding.queue.length && !P.some((p) => p.st === 'walking')) boarding = null;
      }
      for (let i = 0; i < N; i++) {
        const p = P[i];
        if (p.st === 'hidden') { dummy.matrix.copy(ZERO); body.setMatrixAt(i, ZERO); head.setMatrixAt(i, ZERO); hair.setMatrixAt(i, ZERO); faceH.setMatrixAt(i, ZERO); faceS.setMatrixAt(i, ZERO); continue; }
        if (p.st === 'waiting') {
          p.wait -= dt; if (p.wait < 0) p.pop = Math.min(1, p.pop + dt * 3);
        } else if (p.st === 'walking') {
          p.pop = 1;
          const w = p.path[p.pi]; const dx = w[0] - p.x, dz = w[2] - p.z, dy = w[1] - p.y;
          const dist = Math.hypot(dx, dz);
          const step = p.speed * dt;
          if (dist <= step) {
            p.x = w[0]; p.z = w[2]; p.y = w[1]; p.pi++;
            if (p.pi >= p.path.length) {
              p.st = 'seated'; p.yaw = 0; seatedCount++;
              if (seatCb) seatCb(p.i);
            }
          } else {
            p.x += (dx / dist) * step; p.z += (dz / dist) * step; p.y += dy * Math.min(1, dt * 6);
            const want = Math.atan2(dx, dz);
            p.yaw += angDiff(p.yaw, want) * Math.min(1, dt * 10);
          }
        } else if (p.st === 'seated') {
          p.x = p.seat.x; p.y = p.seat.y; p.z = trainZ + p.seat.z; p.pop = 1;
        } else if (p.st === 'gone') {
          p.pop -= dt * 2.5; p.x += dt * 1.2; if (p.pop <= 0) { p.st = 'hidden'; p.pop = 0; continue; }
        }
        // seated people ride with the train: keep local seat coords when moving
        setPose(p, i, happy, t);
      }
      meshes.forEach((m) => { m.instanceMatrix.needsUpdate = true; });
    },
  };
}
