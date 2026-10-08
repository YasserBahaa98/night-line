import * as THREE from 'three';
import { bx, cylY, merge, paint, rng, canvasTex, glowTex } from './geo.js';
import { TOTAL, STATIONS, STATION_NAMES, STATION_ICONS, TUNNELS, BRIDGE, VILLAGE, ZONES, PLAT, SIGN_ICON, signDist } from './route.js';

const Z = (d) => -d; // dist along the track -> world z

const vcLambert = () => new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
const lambert = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });

// ---- palettes --------------------------------------------------------------------------------
const C = {
  dayTop: new THREE.Color(0x3b3a8c), dayMid: new THREE.Color(0xff9d7c),
  twiTop: new THREE.Color(0x24246e), twiMid: new THREE.Color(0xe0709f),
  nightTop: new THREE.Color(0x04050d), nightMid: new THREE.Color(0x0a0c1b),
  hemiSkyDay: new THREE.Color(0xd7c8ff), hemiSkyNight: new THREE.Color(0x4a4a8c),
  hemiGrDay: new THREE.Color(0x9a6a74), hemiGrNight: new THREE.Color(0x26263c),
};
const _a = new THREE.Color(), _b = new THREE.Color();

function signTexture(limit) {
  return canvasTex(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#fff'; g.beginPath(); g.arc(128, 128, 124, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#e5322d'; g.lineWidth = 26; g.beginPath(); g.arc(128, 128, 108, 0, Math.PI * 2); g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '84px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
    g.fillText(SIGN_ICON[limit], 128, 82);
    g.fillStyle = '#2f2b45'; g.font = '900 100px ui-rounded, "Arial Rounded MT Bold", Arial, sans-serif';
    g.fillText(String(limit), 128, 176);
  });
}

function stationSignTexture(name, icon, idx) {
  const cols = ['#f08a3c', '#2f9d6a', '#5b66d6'];
  return canvasTex(512, 160, (g, w, h) => {
    g.fillStyle = cols[idx]; g.beginPath(); g.roundRect(4, 4, w - 8, h - 8, 36); g.fill();
    g.strokeStyle = '#fff6e6'; g.lineWidth = 10; g.stroke();
    g.fillStyle = '#fff6e6'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '900 68px ui-rounded, "Arial Rounded MT Bold", Arial, sans-serif';
    g.fillText(name, w / 2 + 34, h / 2 + 4);
    g.font = '74px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
    g.fillText(icon, 66, h / 2 + 4);
  });
}

function stopTexture() {
  return canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = 'rgba(80,255,140,.55)'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#eafff1';
    for (let i = 0; i < 6; i++) g.fillRect(i * 44 - 4, 0, 14, h); // hazard-ish stripes
    g.fillStyle = 'rgba(10,80,40,.75)'; g.fillRect(34, 24, w - 68, h - 48);
    g.fillStyle = '#eafff1'; g.font = '900 64px ui-rounded, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('STOP', w / 2, h / 2 + 4);
  });
}

export function makeWorld(scene) {
  const R = rng(20241);
  const world = { stations: [] };

  // ---- lights (just hemisphere; the headlight lives on the train) ----------------------------
  const hemi = new THREE.HemisphereLight(0xd7c8ff, 0x9a6a74, 2.2);
  scene.add(hemi);
  scene.fog = new THREE.Fog(0xff9d7c, 35, 430);

  // ---- sky (follows camera) ------------------------------------------------------------------
  const skyGroup = new THREE.Group();
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color() }, mid: { value: new THREE.Color() } },
    vertexShader: 'varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 mid; varying float h;
      void main(){ float t = clamp(h * 1.7, 0.0, 1.0); vec3 c = mix(mid, top, pow(t, 0.65));
      gl_FragColor = vec4(c, 1.0);
      #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 24, 14), skyMat);
  sky.renderOrder = -10;
  skyGroup.add(sky);

  const starPos = new Float32Array(300 * 3);
  for (let i = 0; i < 300; i++) {
    const th = R() * Math.PI * 2, ph = Math.acos(0.05 + R() * 0.95);
    starPos[i * 3] = 560 * Math.sin(ph) * Math.cos(th); starPos[i * 3 + 1] = 560 * Math.cos(ph); starPos[i * 3 + 2] = 560 * Math.sin(ph) * Math.sin(th);
  }
  const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xfff6dd, size: 2.6, sizeAttenuation: false, transparent: true, opacity: 0.3, depthWrite: false, fog: false });
  skyGroup.add(new THREE.Points(starGeo, starMat));

  const moonTex = canvasTex(256, 256, (g) => {
    const grd = g.createRadialGradient(128, 128, 20, 128, 128, 128);
    grd.addColorStop(0, 'rgba(255,248,214,.55)'); grd.addColorStop(1, 'rgba(255,248,214,0)'); g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#fff6d6'; g.beginPath(); g.arc(128, 128, 44, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(210,196,150,.55)';
    [[112, 116, 10], [140, 138, 8], [126, 150, 6]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); });
  });
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, transparent: true, opacity: 0.5, depthWrite: false, fog: false }));
  moon.scale.set(110, 110, 1); moon.position.set(-210, 200, -430);
  skyGroup.add(moon);

  const sunTex = canvasTex(256, 256, (g) => {
    const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grd.addColorStop(0, 'rgba(255,250,220,1)'); grd.addColorStop(0.18, 'rgba(255,214,140,.95)'); grd.addColorStop(0.4, 'rgba(255,150,90,.4)'); grd.addColorStop(1, 'rgba(255,120,80,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  });
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
  sun.scale.set(380, 380, 1);
  skyGroup.add(sun);
  scene.add(skyGroup);

  // ---- ground ---------------------------------------------------------------------------------
  {
    const len = TOTAL + 800;
    const g = new THREE.PlaneGeometry(1300, len, 26, 100);
    g.rotateX(-Math.PI / 2);
    g.translate(0, -0.02, -(TOTAL / 2) + 150);
    const n = g.attributes.position.count; const col = new Float32Array(n * 3); const base = new THREE.Color(0x3f8060); const t = new THREE.Color();
    for (let i = 0; i < n; i++) {
      t.copy(base).offsetHSL((R() - 0.5) * 0.04, (R() - 0.5) * 0.08, (R() - 0.5) * 0.07);
      col[i * 3] = t.r; col[i * 3 + 1] = t.g; col[i * 3 + 2] = t.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    scene.add(new THREE.Mesh(g, vcLambert()));
  }

  // ---- track ----------------------------------------------------------------------------------
  {
    const ballastMat = lambert(0x7a7388);
    const seg = (a, b) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.34, b - a), ballastMat);
      m.position.set(0, 0.17, Z((a + b) / 2)); scene.add(m);
    };
    seg(-60, BRIDGE[0]); seg(BRIDGE[1], TOTAL + 250);

    const n = Math.floor((TOTAL + 300) / 1.4);
    const sl = new THREE.InstancedMesh(new THREE.BoxGeometry(2.5, 0.14, 0.45), lambert(0x6b4a3a), n);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < n; i++) { m4.makeTranslation(0, 0.4, Z(-40 + i * 1.4)); sl.setMatrixAt(i, m4); }
    scene.add(sl);

    const railMat = lambert(0xcfcde0);
    for (const x of [-0.72, 0.72]) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, TOTAL + 320), railMat);
      r.position.set(x, 0.5, Z((TOTAL + 250 - 70) / 2));
      scene.add(r);
    }
  }

  // ---- river + bridge -------------------------------------------------------------------------
  {
    const cz = Z((BRIDGE[0] + BRIDGE[1]) / 2), len = BRIDGE[1] - BRIDGE[0];
    const water = new THREE.Mesh(new THREE.PlaneGeometry(1300, len - 8).rotateX(-Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: 0x4aa8d8, emissive: 0x153a66, flatShading: true }));
    water.position.set(0, 0.03, cz); scene.add(water);
    world.water = water;

    const parts = [
      bx(4.4, 0.45, len, 0, 0.12, cz, 0x4d5d86),
      bx(0.3, 1.9, len, -2.25, 1.2, cz, 0x6a85c4), bx(0.3, 1.9, len, 2.25, 1.2, cz, 0x6a85c4),
      bx(0.45, 0.3, len, -2.25, 2.25, cz, 0xffc83d), bx(0.45, 0.3, len, 2.25, 2.25, cz, 0xffc83d),
    ];
    for (let z = -len / 2 + 3; z <= len / 2 - 3; z += 6) {
      parts.push(bx(0.3, 1.9, 0.3, -2.25, 1.2, cz + z, 0xffc83d), bx(0.3, 1.9, 0.3, 2.25, 1.2, cz + z, 0xffc83d));
      parts.push(bx(1.2, 0.3, 1.2, -2.0, -0.6, cz + z, 0x56608c), bx(1.2, 0.3, 1.2, 2.0, -0.6, cz + z, 0x56608c));
    }
    scene.add(new THREE.Mesh(merge(parts), vcLambert()));
  }

  // ---- tunnels --------------------------------------------------------------------------------
  {
    const shellMat = new THREE.MeshLambertMaterial({ color: 0x47455a, side: THREE.BackSide, flatShading: true });
    const domeMat = lambert(0x4a8a5c);
    const faceMat = new THREE.MeshLambertMaterial({ color: 0x8c88a0, side: THREE.DoubleSide, flatShading: true });
    const shape = new THREE.Shape();
    shape.moveTo(-14, 0); shape.lineTo(-5.6, 0); shape.absarc(0, 0, 5.6, Math.PI, 0, true); shape.lineTo(14, 0); shape.absarc(0, 0, 14, 0, Math.PI, false);
    const faceGeo = new THREE.ShapeGeometry(shape, 18);
    const lampGeo = new THREE.SphereGeometry(0.34, 8, 6);
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffd98a });
    for (const [a, b] of TUNNELS) {
      const len = b - a, cz = Z((a + b) / 2);
      const mk = (r, mat, sl) => {
        const g = new THREE.CylinderGeometry(r, r, len, 16, 1, true, Math.PI / 2, Math.PI);
        g.rotateX(Math.PI / 2);
        const m = new THREE.Mesh(g, mat); m.position.set(0, 0, cz); scene.add(m); return m;
      };
      mk(5.6, shellMat); mk(14, domeMat);
      // inner floor strip so the headlight has something to hit
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(11.2, len).rotateX(-Math.PI / 2), lambert(0x3a3848));
      fl.position.set(0, 0.0, cz); scene.add(fl);
      const f1 = new THREE.Mesh(faceGeo, faceMat); f1.position.set(0, 0, Z(a)); scene.add(f1);
      const f2 = new THREE.Mesh(faceGeo, faceMat); f2.position.set(0, 0, Z(b)); f2.rotation.y = Math.PI; scene.add(f2);
      for (const z of [Z(a) + 0.2, Z(b) - 0.2]) for (const x of [-6.6, 6.6]) {
        const l = new THREE.Mesh(lampGeo, lampMat); l.position.set(x, 2.6, z); scene.add(l);
      }
      // trim ring: little colour flags above each portal
      const trim = merge([bx(2.6, 0.5, 0.4, 0, 6.4, Z(a) + 0.25, 0xffc83d), bx(2.6, 0.5, 0.4, 0, 6.4, Z(b) - 0.25, 0xffc83d)]);
      scene.add(new THREE.Mesh(trim, vcLambert()));
      // cat-eye lights down the tunnel wall (cheap emissive dots)
      const dots = Math.floor(len / 14);
      const dm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.2, 0.5), new THREE.MeshBasicMaterial({ color: 0xff8f6a }), dots * 2);
      const m4 = new THREE.Matrix4(); let k = 0;
      for (let i = 0; i < dots; i++) for (const sx of [-1, 1]) { m4.makeTranslation(sx * 5.45, 1.2, Z(a + 7 + i * 14)); dm.setMatrixAt(k++, m4); }
      scene.add(dm);
    }
  }

  // ---- speed-limit signs ----------------------------------------------------------------------
  {
    const texCache = {};
    const poleGeo = new THREE.CylinderGeometry(0.07, 0.07, 3.6, 6);
    const poleMat = lambert(0x9a96b0);
    const discGeo = new THREE.CircleGeometry(1.05, 28);
    ZONES.forEach((zn, k) => {
      const d = signDist(k);
      const tex = texCache[zn.limit] || (texCache[zn.limit] = signTexture(zn.limit));
      const mat = new THREE.MeshLambertMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.28, transparent: false, alphaTest: 0.5 });
      const pole = new THREE.Mesh(poleGeo, poleMat); pole.position.set(3.7, 1.8, Z(d)); scene.add(pole);
      const disc = new THREE.Mesh(discGeo, mat); disc.position.set(3.7, 4.0, Z(d) + 0.1); scene.add(disc);
    });
  }

  // ---- stations -------------------------------------------------------------------------------
  {
    const stopTex = stopTexture();
    const platCols = [0xb9a7d8, 0xa6c9b0, 0x9fb2e6];
    const roofCols = [0xf08a3c, 0x2f9d6a, 0x5b66d6];
    STATIONS.forEach((S, i) => {
      const d0 = S + PLAT.from, d1 = S + PLAT.to, len = d1 - d0, cz = Z((d0 + d1) / 2);
      const parts = [
        bx(4.6, 0.9, len, 4.3, 0.45, cz, platCols[i]),
        bx(0.28, 0.06, len, 2.14, 0.92, cz, 0xffd447),
        bx(4.6, 0.12, len, 4.3, 0.9, cz, 0xe6e0f2),
      ];
      // lamp posts
      const bulbs = [];
      for (let d = S - 40; d <= S + 30; d += 14) {
        parts.push(bx(0.12, 3.2, 0.12, 6.3, 2.5, Z(d), 0x2f2b45));
        const b = new THREE.SphereGeometry(0.3, 8, 6); b.translate(6.3, 4.3, Z(d)); bulbs.push(b);
      }
      // little shelter at the back
      const sz = Z(S + 20);
      parts.push(bx(2.6, 0.18, 10, 5.4, 3.5, sz, roofCols[i]));
      for (const dz of [-4.4, 4.4]) for (const dx of [4.4, 6.4]) parts.push(bx(0.14, 2.6, 0.14, dx, 2.2, sz + dz, 0x2f2b45));
      parts.push(bx(0.14, 1.8, 8.8, 6.55, 1.8, sz, 0xfff0d2));
      // benches
      parts.push(bx(0.5, 0.12, 2.2, 6.2, 1.35, Z(S + 17), 0x8a5a3c), bx(0.5, 0.12, 2.2, 6.2, 1.35, Z(S + 23), 0x8a5a3c));
      scene.add(new THREE.Mesh(merge(parts), vcLambert()));
      const bulbMesh = new THREE.Mesh(merge(bulbs.map((g) => paint(g, 0xffe6a0))), new THREE.MeshBasicMaterial({ vertexColors: true }));
      scene.add(bulbMesh);

      // big name board, faces the approaching train
      const board = new THREE.Mesh(new THREE.PlaneGeometry(7, 2.2), new THREE.MeshBasicMaterial({ map: stationSignTexture(STATION_NAMES[i], STATION_ICONS[i], i), transparent: true }));
      board.position.set(5.1, 5.7, Z(S + 20)); scene.add(board);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.4, 0.2), lambert(0x2f2b45));
      post.position.set(5.1, 3.9, Z(S + 20) - 0.15); scene.add(post);

      // glowing stop marker on the rails + bobbing arrow
      const marker = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 2.2).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ map: stopTex, transparent: true, depthWrite: false, opacity: 0.9 }));
      marker.position.set(0, 0.6, Z(S)); marker.renderOrder = 2; marker.visible = false; scene.add(marker);
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.5, 4).rotateX(Math.PI),
        new THREE.MeshBasicMaterial({ color: 0x6dffa0, fog: false }));
      arrow.position.set(3.6, 7.6, Z(S)); arrow.scale.setScalar(1.5); arrow.visible = false; scene.add(arrow);
      // tall see-through beacon so kids spot the stop mark from far away
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 12, 14, 1, true).translate(0, 6, 0),
        new THREE.MeshBasicMaterial({ color: 0x6dffa0, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      beam.position.set(3.6, 0.9, Z(S)); beam.visible = false; beam.renderOrder = 2; scene.add(beam);
      world.stations.push({ S, marker, arrow, beam });
    });
  }

  // ---- scenery: trees, hills, poles, village --------------------------------------------------
  {
    const bad = (d, x) => {
      for (const [a, b] of TUNNELS) if (d > a - 10 && d < b + 10 && Math.abs(x) < 17) return true;
      for (const S of STATIONS) if (d > S - 62 && d < S + 52 && Math.abs(x) < 34) return true;
      if (d > BRIDGE[0] - 6 && d < BRIDGE[1] + 6) return true;
      if (d < 50 && Math.abs(x) < 28) return true; // keep the menu/hero camera spot clear
      if (d > VILLAGE[0] - 12 && d < VILLAGE[1] + 12 && x < -8 && x > -62) return true;
      return false;
    };
    // trees
    const N = 820; const trees = [];
    while (trees.length < N) {
      const d = R() * (TOTAL + 360) - 120; const side = R() < 0.5 ? -1 : 1;
      const x = side * (8.5 + Math.pow(R(), 1.7) * 105);
      if (bad(d, x)) continue;
      trees.push({ d, x, s: 0.8 + R() * 1.0 });
    }
    // trees live in 250 m chunks (3 instanced meshes each, shared geometry/materials);
    // chunks behind / far ahead of the train are switched off, so only ~3 are ever drawn.
    const CH = 250; const nCh = Math.ceil((TOTAL + 360) / CH) + 1;
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.3, 1.4, 5), cone1Geo = new THREE.ConeGeometry(1.7, 3.1, 6), cone2Geo = new THREE.ConeGeometry(1.25, 2.6, 6);
    const trunkMat = lambert(0x6b4a3a), coneMat = lambert(0xffffff);
    const greens = [0x2f7d5b, 0x3a8f6a, 0x27695a, 0x4a9a62, 0x2d6e4e, 0x356f8a];
    const m = new THREE.Matrix4(), l = new THREE.Matrix4(), col = new THREE.Color();
    world.chunks = [];
    for (let c = 0; c < nCh; c++) {
      const d0 = -120 + c * CH, d1 = d0 + CH;
      const list = trees.filter((t) => t.d >= d0 && t.d < d1);
      if (!list.length) continue;
      const trunk = new THREE.InstancedMesh(trunkGeo, trunkMat, list.length);
      const cone1 = new THREE.InstancedMesh(cone1Geo, coneMat, list.length);
      const cone2 = new THREE.InstancedMesh(cone2Geo, coneMat, list.length);
      list.forEach((t, i) => {
        m.makeScale(t.s, t.s, t.s).setPosition(t.x, 0, Z(t.d));
        trunk.setMatrixAt(i, l.makeTranslation(0, 0.7, 0).premultiply(m));
        cone1.setMatrixAt(i, l.makeTranslation(0, 2.6, 0).premultiply(m));
        cone2.setMatrixAt(i, l.makeTranslation(0, 4.1, 0).premultiply(m));
        col.set(R() < 0.09 ? 0xe58a4c : greens[Math.floor(R() * greens.length)]).offsetHSL(0, 0, (R() - 0.5) * 0.06);
        cone1.setColorAt(i, col); cone2.setColorAt(i, col);
      });
      [trunk, cone1, cone2].forEach((x) => { x.frustumCulled = false; scene.add(x); });
      world.chunks.push({ d0, d1, meshes: [trunk, cone1, cone2] });
    }

    // hills (parallax backdrop)
    const HN = 90; const hills = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), lambert(0xffffff), HN);
    const hcols = [0x5b6cb4, 0x6a6fb8, 0x4f8a86, 0x7a64a8, 0x4d7f9c];
    for (let i = 0; i < HN; i++) {
      const side = i % 2 ? 1 : -1; const d = R() * (TOTAL + 500) - 200; const x = side * (70 + R() * 190);
      const sx = 28 + R() * 50, sy = 12 + R() * 30, sz = 28 + R() * 50;
      m.makeScale(sx, sy, sz).setPosition(x, sy * 0.15, Z(d)); hills.setMatrixAt(i, m);
      hills.setColorAt(i, col.set(hcols[Math.floor(R() * hcols.length)]));
    }
    scene.add(hills);

    // telegraph poles + wires
    const poleParts = [bx(0.16, 5.4, 0.16, 0, 2.7, 0, 0x6b4a3a), bx(1.8, 0.14, 0.14, 0, 4.9, 0, 0x6b4a3a)];
    const poleGeo = merge(poleParts); const poleMat = vcLambert();
    const ds = []; for (let d = 10; d < TOTAL + 150; d += 46) { if (!bad(d, 6) && !TUNNELS.some(([a, b]) => d > a - 4 && d < b + 4)) ds.push(d); }
    const poles = new THREE.InstancedMesh(poleGeo, poleMat, ds.length);
    ds.forEach((d, i) => poles.setMatrixAt(i, m.makeTranslation(-4.3, 0, Z(d))));
    scene.add(poles);
    const wp = [];
    for (let i = 0; i < ds.length - 1; i++) {
      if (ds[i + 1] - ds[i] > 50) continue;
      for (const o of [-0.7, 0.7]) wp.push(-4.3 + o, 4.9, Z(ds[i]), -4.3 + o, 4.9, Z(ds[i + 1]));
    }
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3));
    scene.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x2f2b45 })));

    // village on the left
    const hp = [], wl = [];
    const pastel = [0xffd6a5, 0xffadad, 0xcaffbf, 0xbdb2ff, 0xa0c4ff, 0xfdffb6];
    const roofs = [0xe0443e, 0xc4682f, 0x6d5acf];
    let hi = 0;
    for (let d = VILLAGE[0]; d <= VILLAGE[1]; d += 13) {
      for (const row of [0, 1]) {
        const hx = -(14 + row * 13 + R() * 3), hz = Z(d + row * 6 + R() * 3);
        const hh = 2.6 + R() * 1.4;
        hp.push(bx(3.6, hh, 4.2, hx, hh / 2, hz, pastel[(hi++) % pastel.length]));
        const roof = new THREE.ConeGeometry(3.4, 2.2, 4); roof.rotateY(Math.PI / 4); roof.translate(hx, hh + 1.1, hz); hp.push(paint(roof, roofs[Math.floor(R() * 3)]));
        hp.push(bx(0.7, 1.4, 0.1, hx + 1.82, 0.7, hz + 1.1, 0x6b4a3a));
        for (const dz of [-0.8, 0.9]) {
          const w = new THREE.PlaneGeometry(0.8, 0.8); w.rotateY(Math.PI / 2); w.translate(hx + 1.83, hh * 0.62, hz + dz); wl.push(paint(w, 0xffd27a));
        }
      }
    }
    // clock tower
    const tx = -34, tz = Z(VILLAGE[0] + 50);
    hp.push(bx(3, 9, 3, tx, 4.5, tz, 0xe9d5ff)); const tr = new THREE.ConeGeometry(2.4, 3.4, 4); tr.rotateY(Math.PI / 4); tr.translate(tx, 10.7, tz); hp.push(paint(tr, 0xe0443e));
    const clock = new THREE.CircleGeometry(0.9, 16); clock.rotateY(Math.PI / 2); clock.translate(tx + 1.52, 7.4, tz); wl.push(paint(clock, 0xfff6c8));
    scene.add(new THREE.Mesh(merge(hp), vcLambert()));
    scene.add(new THREE.Mesh(merge(wl), new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })));
  }

  // ---- per-frame environment ------------------------------------------------------------------
  world.setEnv = (dk, prog, headLevel) => {
    _a.copy(C.dayTop).lerp(C.twiTop, prog * 0.8).lerp(C.nightTop, dk);
    _b.copy(C.dayMid).lerp(C.twiMid, prog * 0.55).lerp(C.nightMid, dk);
    skyMat.uniforms.top.value.copy(_a); skyMat.uniforms.mid.value.copy(_b);
    scene.fog.color.copy(_b);
    scene.fog.near = 35 - dk * 31; scene.fog.far = 430 - dk * 355 + headLevel * dk * 80;
    hemi.color.copy(C.hemiSkyDay).lerp(C.hemiSkyNight, dk);
    hemi.groundColor.copy(C.hemiGrDay).lerp(C.hemiGrNight, dk);
    hemi.intensity = 2.2 - 1.45 * dk - prog * 0.3;
    starMat.opacity = (0.12 + prog * 0.6) * (1 - dk * 0.6);
    moon.material.opacity = (0.25 + prog * 0.75) * (1 - dk);
    sun.position.set(90, 70 - prog * 140, -520);
    sun.material.opacity = (1 - dk) * (1 - prog * 0.85);
  };

  world.update = (t, camera, active, dist = 0) => {
    for (const ch of world.chunks) { const v = dist > ch.d0 - 480 && dist < ch.d1 + 90; if (ch.meshes[0].visible !== v) ch.meshes.forEach((x) => { x.visible = v; }); }
    skyGroup.position.copy(camera.position);
    world.water.position.y = 0.03 + Math.sin(t * 1.4) * 0.012;
    const pulse = 0.65 + Math.sin(t * 6) * 0.25;
    world.stations.forEach((st, i) => {
      const on = active === i;
      st.marker.visible = on; st.arrow.visible = on; st.beam.visible = on;
      if (on) {
        st.marker.material.opacity = pulse;
        st.beam.material.opacity = 0.16 + Math.sin(t * 5) * 0.06;
        st.arrow.position.y = 7.4 + Math.sin(t * 5) * 0.4; st.arrow.rotation.y = t * 2;
      }
    });
  };

  return world;
}
