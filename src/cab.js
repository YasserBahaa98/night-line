import * as THREE from 'three';
import { bx, cylY, cylZ, sph, paint, merge } from './geo.js';

// Driver's cab interior: front wall with windows, control desk with levers / switches / speed dial,
// a horn cord and the driver, who reaches for whatever the player presses.
// Everything lives in loco-local space (the train points toward -z, cab spans z -0.9 .. 3.7).

const glow = { value: 0.2 }; // fake interior light so the cab never goes pitch black in tunnels

function cabMat(opts = {}) {
  const m = new THREE.MeshLambertMaterial({ flatShading: true, ...opts });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uCabGlow = glow;
    shader.fragmentShader = 'uniform float uCabGlow;\n' + shader.fragmentShader.replace(
      '#include <opaque_fragment>', 'outgoingLight += diffuseColor.rgb * uCabGlow;\n#include <opaque_fragment>');
  };
  m.customProgramCacheKey = () => 'cabglow';
  return m;
}

// box rotated about X, then moved (for the slanted desk top)
function tiltBox(w, h, d, ax, x, y, z, hex) {
  const g = new THREE.BoxGeometry(w, h, d); g.rotateX(ax); g.translate(x, y, z); return paint(g, hex);
}

const RED = 0xe0443e, DARK = 0x2f2b45, GOLD = 0xffc83d, CREAM = 0xfff0d2, WOOD = 0xc9996a, WOOD2 = 0x9c6b45, DESK = 0x4b4370;
const DESK_TILT = 0.45;

function buildShell() {
  const p = [];
  // front wall ("spectacle plate") with two big windows either side of a thin centre post
  p.push(bx(2.58, 1.3, 0.1, 0, 1.85, -0.86, WOOD2));
  p.push(bx(2.58, 0.36, 0.1, 0, 3.93, -0.86, RED));
  for (const x of [-1.22, 1.22]) p.push(bx(0.14, 1.3, 0.1, x, 3.1, -0.86, RED));
  p.push(bx(0.1, 1.3, 0.1, 0, 3.1, -0.86, RED));
  // gold window frames
  for (const cx of [-0.62, 0.62]) {
    p.push(bx(1.08, 0.06, 0.06, cx, 2.47, -0.8, GOLD), bx(1.08, 0.06, 0.06, cx, 3.73, -0.8, GOLD));
    p.push(bx(0.06, 1.3, 0.06, cx - 0.54, 3.1, -0.8, GOLD), bx(0.06, 1.3, 0.06, cx + 0.54, 3.1, -0.8, GOLD));
  }
  // wooden floor + window ledges along the side walls
  p.push(bx(2.4, 0.04, 4.4, 0, 1.23, 1.4, WOOD));
  for (const x of [-1.15, 1.15]) p.push(bx(0.22, 0.07, 4.4, x, 2.33, 1.4, WOOD));
  // control desk: body + slanted top + gold trim
  p.push(bx(2.4, 0.85, 0.5, 0, 1.63, -0.58, DESK));
  p.push(tiltBox(2.44, 0.07, 0.62, DESK_TILT, 0, 2.12, -0.5, 0x5d548a));
  p.push(tiltBox(2.46, 0.05, 0.05, DESK_TILT, 0, 2.0, -0.21, GOLD));
  // lever quadrants (little gold combs the levers slide along)
  for (const x of [-0.56, -0.2]) p.push(paint(new THREE.CylinderGeometry(0.13, 0.13, 0.06, 10, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).translate(x, 2.16, -0.32), GOLD));
  // switch plate
  p.push(tiltBox(0.5, 0.03, 0.26, DESK_TILT, 0.25, 2.2, -0.5, DARK));
  // dial post
  p.push(cylY(0.04, 0.05, 0.22, 6, 0.9, 2.3, -0.6, DARK));
  // driver's stool
  p.push(cylY(0.07, 0.1, 0.45, 8, -0.6, 1.45, 0.62, DARK), cylY(0.25, 0.25, 0.1, 12, -0.6, 1.72, 0.62, RED));
  // roof lamp housing
  p.push(cylY(0.05, 0.05, 0.12, 6, 0, 4.03, 1.2, DARK), cylY(0.12, 0.2, 0.1, 10, 0, 3.92, 1.2, GOLD));
  return merge(p);
}

// Lever: a group at its pivot, rotated about X (negative = pushed forward).
function makeLever(x, knobHex, mat) {
  const g = new THREE.Group(); g.position.set(x, 2.16, -0.32);
  const LEN = 0.42;
  const geo = merge([cylY(0.025, 0.03, LEN, 6, 0, LEN / 2, 0, 0xd8d2ea), sph(0.075, 10, 8, 0, LEN, 0, knobHex)]);
  g.add(new THREE.Mesh(geo, mat));
  return { g, LEN, ang: 0.15 };
}

// Toggle switch on the switch plate with an indicator lamp next to it.
function makeSwitch(x, capHex, lampHex, mat) {
  const g = new THREE.Group(); g.position.set(x, 2.23, -0.48); g.rotation.x = DESK_TILT;
  const base = merge([bx(0.12, 0.05, 0.12, 0, 0, 0, 0x8c84c4)]);
  g.add(new THREE.Mesh(base, mat));
  const stick = new THREE.Group();
  stick.add(new THREE.Mesh(merge([cylY(0.018, 0.018, 0.14, 6, 0, 0.07, 0, 0xd8d2ea), sph(0.04, 8, 6, 0, 0.15, 0, capHex)]), mat));
  g.add(stick);
  const lampMat = new THREE.MeshBasicMaterial({ color: 0x3a3550 });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), lampMat); lamp.position.set(0, 0.02, -0.11);
  g.add(lamp);
  const on = new THREE.Color(lampHex), off = new THREE.Color(0x3a3550);
  return { g, stick, lampMat, on, off, val: 0, target: 0, tip: new THREE.Vector3() };
}

export function makeCab(root) {
  const cab = new THREE.Group();
  root.add(cab);
  const vc = cabMat({ vertexColors: true });
  cab.add(new THREE.Mesh(buildShell(), vc));

  // roof lamp bulb (follows the cabin lights)
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0x5a5470 });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 6), bulbMat); bulb.position.set(0, 3.86, 1.2); cab.add(bulb);

  const throttle = makeLever(-0.56, 0x4ddb7a, vc);
  const brake = makeLever(-0.2, 0xff5a5a, vc);
  cab.add(throttle.g, brake.g);

  const swHead = makeSwitch(0.13, 0xffd34a, 0xfff1a0, vc);
  const swSeat = makeSwitch(0.37, 0x6dd3ff, 0xbdf0ff, vc);
  cab.add(swHead.g, swSeat.g);

  // speed dial
  const dial = new THREE.Group(); dial.position.set(0.9, 2.5, -0.6); dial.rotation.x = -0.35; cab.add(dial);
  const face = merge([
    cylZ(0.19, 0.19, 0.04, 20, 0, 0, 0, GOLD), cylZ(0.165, 0.165, 0.045, 20, 0, 0, 0.005, CREAM),
  ]);
  dial.add(new THREE.Mesh(face, vc));
  // coloured band ticks on the dial (0..80 km/h over 260°)
  const A0 = 2.27, A1 = -2.27; // radians: left-bottom .. right-bottom
  const angFor = (kmh) => A0 + (A1 - A0) * Math.min(1, kmh / 80);
  const ticks = [];
  for (let k = 0; k <= 80; k += 10) {
    const a = angFor(k), r = 0.135;
    const t = bx(0.012, 0.035, 0.01, 0, 0, 0, DARK); t.rotateZ(a); t.translate(-Math.sin(a) * r, Math.cos(a) * r, 0.03);
    ticks.push(t);
  }
  dial.add(new THREE.Mesh(merge(ticks), vc));
  const needle = new THREE.Group(); needle.position.z = 0.035; dial.add(needle);
  needle.add(new THREE.Mesh(merge([bx(0.018, 0.13, 0.01, 0, 0.055, 0, 0xe5322d), cylZ(0.022, 0.022, 0.02, 8, 0, 0, 0, DARK)]), vc));
  const limitMark = new THREE.Group(); limitMark.position.z = 0.032; dial.add(limitMark);
  limitMark.add(new THREE.Mesh(merge([bx(0.03, 0.03, 0.01, 0, 0.16, 0, 0xe5322d)]), new THREE.MeshBasicMaterial({ color: 0xff3b3b })));

  // horn cord hanging from the roof
  const horn = new THREE.Group(); horn.position.set(-0.18, 4.08, 0.25); cab.add(horn);
  const CORD = 0.62;
  horn.add(new THREE.Mesh(merge([cylY(0.012, 0.012, CORD, 4, 0, -CORD / 2, 0, 0xfff6e6), sph(0.05, 8, 6, 0, -CORD - 0.03, 0, GOLD, 1.5)]), vc));
  let hornPull = 0;

  // ---------------------------------------------------------------- driver
  const SKIN = 0xffd2b0, SHIRT = 0xe0443e, OVERALL = 0x3d6fd6, CAP = 0x3d6fd6;
  const HIP = new THREE.Vector3(-0.6, 1.8, 0.6);
  const body = new THREE.Group(); body.position.copy(HIP); cab.add(body);
  body.add(new THREE.Mesh(merge([
    cylY(0.25, 0.27, 0.62, 10, 0, 0.32, 0, OVERALL),          // torso (overalls)
    sph(0.25, 10, 6, 0, 0.64, 0, SHIRT, 0.55),               // shoulders
    bx(0.08, 0.5, 0.03, -0.12, 0.38, -0.26, 0x2b4fa8), bx(0.08, 0.5, 0.03, 0.12, 0.38, -0.26, 0x2b4fa8), // straps
    cylY(0.1, 0.11, 0.14, 8, 0, 0.75, 0, SKIN),              // neck
    cylY(0.14, 0.14, 0.06, 10, 0, 0.72, 0, 0xffc83d),        // neckerchief
  ]), vc));
  const head = new THREE.Group(); head.position.set(0, 0.98, 0); body.add(head);
  head.add(new THREE.Mesh(merge([
    sph(0.21, 12, 10, 0, 0, 0, SKIN),
    sph(0.05, 8, 6, 0, -0.01, -0.21, 0xffb592),             // nose
    bx(0.2, 0.05, 0.06, 0, -0.07, -0.19, 0x5a3a2a),          // moustache
    sph(0.05, 6, 6, -0.21, 0, 0, SKIN), sph(0.05, 6, 6, 0.21, 0, 0, SKIN), // ears
    sph(0.215, 12, 6, 0, 0.07, 0.02, 0x5a3a2a, 0.75),        // hair at the back
    cylY(0.225, 0.225, 0.16, 14, 0, 0.16, 0, CAP),           // engineer cap
    sph(0.225, 14, 6, 0, 0.24, 0, CAP, 0.45),
    cylY(0.23, 0.23, 0.04, 14, 0, 0.1, 0, 0xffffff),         // white stripe
    bx(0.36, 0.03, 0.18, 0, 0.09, -0.24, 0x2b4fa8),          // brim
  ]), vc));
  // legs (static): thighs forward on the stool, shins down to the floor
  cab.add(new THREE.Mesh(merge([
    cylZ(0.1, 0.1, 0.5, 8, -0.73, 1.82, 0.38, OVERALL), cylZ(0.1, 0.1, 0.5, 8, -0.47, 1.82, 0.38, OVERALL),
    cylY(0.09, 0.09, 0.5, 8, -0.73, 1.55, 0.14, OVERALL), cylY(0.09, 0.09, 0.5, 8, -0.47, 1.55, 0.14, OVERALL),
    bx(0.16, 0.1, 0.28, -0.73, 1.3, 0.06, DARK), bx(0.16, 0.1, 0.28, -0.47, 1.3, 0.06, DARK),
  ]), vc));

  // arms: unit-length cylinders stretched between joints (two-bone IK)
  const UP = new THREE.Vector3(0, 1, 0);
  const limbGeo = new THREE.CylinderGeometry(1, 1, 1, 8).translate(0, 0.5, 0);
  const handGeo = new THREE.SphereGeometry(0.075, 10, 8);
  const shirtM = cabMat({ color: SHIRT }), skinM = cabMat({ color: SKIN });
  function makeArm(side) {
    const upper = new THREE.Mesh(limbGeo, shirtM), lower = new THREE.Mesh(limbGeo, shirtM), hand = new THREE.Mesh(handGeo, skinM);
    upper.scale.set(0.075, 1, 0.075); lower.scale.set(0.065, 1, 0.065);
    cab.add(upper, lower, hand);
    return { side, upper, lower, hand, pos: new THREE.Vector3(), elbow: new THREE.Vector3(), sh: new THREE.Vector3() };
  }
  const armL = makeArm(-1), armR = makeArm(1);
  const UPPER = 0.46, LOWER = 0.48;
  const tv = new THREE.Vector3(), dir = new THREE.Vector3(), pole = new THREE.Vector3(), perp = new THREE.Vector3();
  const shoulderLocal = new THREE.Vector3();

  function placeLimb(mesh, a, b) {
    dir.subVectors(b, a); const len = dir.length();
    mesh.position.copy(a); mesh.scale.y = len;
    mesh.quaternion.setFromUnitVectors(UP, dir.multiplyScalar(1 / (len || 1)));
  }
  function solveArm(arm, target) {
    shoulderLocal.set(arm.side * 0.27, 0.62, 0).applyMatrix4(body.matrix);
    arm.sh.copy(shoulderLocal);
    dir.subVectors(target, arm.sh);
    const stretch = THREE.MathUtils.clamp(dir.length() / (UPPER + LOWER - 0.02), 1, 1.25);
    const U = UPPER * stretch, L = LOWER * stretch;
    const d = THREE.MathUtils.clamp(dir.length(), 0.15, U + L - 0.005);
    dir.normalize();
    const hand = tv.copy(arm.sh).addScaledVector(dir, d);
    const cosA = (U * U + d * d - L * L) / (2 * U * d);
    const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
    pole.set(arm.side * 0.6, -0.8, 0.3);
    perp.copy(pole).addScaledVector(dir, -pole.dot(dir)).normalize();
    arm.elbow.copy(arm.sh).addScaledVector(dir, U * cosA).addScaledVector(perp, U * sinA);
    placeLimb(arm.upper, arm.sh, arm.elbow);
    placeLimb(arm.lower, arm.elbow, hand);
    arm.hand.position.copy(hand);
  }

  const knob = (lv, out) => out.set(lv.g.position.x, lv.g.position.y + Math.cos(lv.ang) * lv.LEN, lv.g.position.z + Math.sin(lv.ang) * lv.LEN);
  const switchTip = (sw, out) => { out.set(0, 0.16, 0); sw.stick.updateMatrix(); sw.g.updateMatrix(); return out.applyMatrix4(sw.stick.matrix).applyMatrix4(sw.g.matrix); };

  // right-hand jobs: switch flips + horn pulls, played one after another
  const queue = []; let job = null;
  const REST_R = new THREE.Vector3(-0.42, 1.98, 0.25), REST_L = new THREE.Vector3(-0.78, 1.98, 0.25);
  const handL = new THREE.Vector3().copy(REST_L), handR = new THREE.Vector3().copy(REST_R);
  const tgtL = new THREE.Vector3(), tgtR = new THREE.Vector3(), tmp = new THREE.Vector3();
  let lean = 0, leanSide = 0, lookYaw = 0, lookPitch = 0, bobT = 0;

  swHead.stick.rotation.x = 0.55; swSeat.stick.rotation.x = 0.55;

  return {
    group: cab,
    // kind: 'head' | 'seats' | 'horn'; value = new switch state
    act(kind, value) { queue.push({ kind, value, t: 0, done: false }); },
    reset(head, seats) {
      queue.length = 0; job = null;
      swHead.val = swHead.target = head ? 1 : 0; swSeat.val = swSeat.target = seats ? 1 : 0;
    },
    update(dt, s) { // s: { v, kmh, limit, go, slow, dark, cabin, atStation, t }
      // levers follow the held buttons
      const thrT = s.go ? -0.55 : 0.15, brkT = s.slow ? 0.75 : 0.15;
      throttle.ang += (thrT - throttle.ang) * Math.min(1, dt * 10);
      brake.ang += (brkT - brake.ang) * Math.min(1, dt * 10);
      throttle.g.rotation.x = throttle.ang; brake.g.rotation.x = brake.ang;

      // dial
      needle.rotation.z = THREE.MathUtils.lerp(needle.rotation.z, angFor(s.kmh), Math.min(1, dt * 12));
      limitMark.rotation.z = angFor(s.limit);

      // switch flips animate towards their target, lamps follow
      for (const sw of [swHead, swSeat]) {
        sw.val += (sw.target - sw.val) * Math.min(1, dt * 18);
        sw.stick.rotation.x = 0.55 - sw.val * 1.1;
        sw.lampMat.color.copy(sw.off).lerp(sw.on, sw.val);
      }
      bulbMat.color.setRGB(0.35 + s.cabin * 0.65, 0.33 + s.cabin * 0.62, 0.44 + s.cabin * 0.3);
      glow.value = 0.12 + s.dark * 0.22 + s.cabin * 0.3;

      // ---- right hand: current job, else brake, else lap
      if (!job && queue.length) job = queue.shift();
      if (job) {
        job.t += dt;
        const REACH = 0.28, HOLD = 0.22;
        if (job.kind === 'horn') {
          tmp.set(horn.position.x, horn.position.y - CORD - 0.03 - hornPull, horn.position.z);
          tgtR.copy(tmp);
          if (job.t > REACH && !job.done) { job.done = true; }
          hornPull = job.t > REACH ? Math.min(0.18, (job.t - REACH) * 1.2) : 0;
        } else {
          const sw = job.kind === 'head' ? swHead : swSeat;
          switchTip(sw, tgtR);
          if (job.t > REACH && !job.done) { job.done = true; sw.target = job.value ? 1 : 0; }
        }
        if (job.t > REACH + HOLD + (job.kind === 'horn' ? 0.35 : 0)) { job = null; hornPull = 0; }
      } else if (s.slow) knob(brake, tgtR);
      else tgtR.copy(REST_R);
      horn.scale.y = 1 + hornPull / CORD;

      // ---- left hand rides the throttle unless the train is parked
      if (s.atStation) tgtL.copy(REST_L); else knob(throttle, tgtL);

      const k = Math.min(1, dt * 14);
      handL.lerp(tgtL, k); handR.lerp(tgtR, k);

      // body leans toward far reaches; head glances at the right hand's job, or at the platform
      const reach = job ? 1 : 0;
      lean += ((s.go ? 0.12 : 0.05) + reach * 0.16 - lean) * Math.min(1, dt * 6);
      leanSide += ((job && job.kind !== 'horn' ? -0.22 : 0) - leanSide) * Math.min(1, dt * 6);
      bobT += dt * (2 + s.v * 0.4);
      const bob = Math.sin(bobT * 2) * 0.012 * Math.min(1, s.v / 10);
      body.position.set(HIP.x, HIP.y + bob, HIP.z);
      body.rotation.set(-lean, 0, leanSide);
      body.updateMatrix();

      let yawT = Math.sin(s.t * 0.37) * 0.12, pitchT = 0;
      if (job && job.kind !== 'horn') { yawT = -0.55; pitchT = -0.35; }
      else if (job) { yawT = -0.25; pitchT = 0.3; }
      else if (s.atStation) yawT = -1.0;
      else if (s.slow || s.go) pitchT = -0.15;
      lookYaw += (yawT - lookYaw) * Math.min(1, dt * 5);
      lookPitch += (pitchT - lookPitch) * Math.min(1, dt * 5);
      head.rotation.set(lookPitch, lookYaw, 0, 'YXZ');

      solveArm(armL, handL);
      solveArm(armR, handR);
    },
  };
}
