import * as THREE from 'three';

// Two fixed-size pooled particle systems (steam + sparks). One draw call each, no allocation at runtime.
function softTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.5, 'rgba(255,255,255,.55)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

class Pool {
  constructor(n, { additive, color, gravity, drag }) {
    this.n = n; this.next = 0; this.gravity = gravity; this.drag = drag;
    this.pos = new Float32Array(n * 3); this.vel = new Float32Array(n * 3);
    this.life = new Float32Array(n); this.max = new Float32Array(n).fill(1);
    this.s0 = new Float32Array(n); this.s1 = new Float32Array(n);
    this.size = new Float32Array(n); this.alpha = new Float32Array(n);
    this.life.fill(0);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.uniforms = { map: { value: softTexture() }, color: { value: new THREE.Color(color) }, uScale: { value: 600 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false, fog: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: `attribute float aSize; attribute float aAlpha; uniform float uScale; varying float vA;
        void main(){ vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = aSize * uScale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D map; uniform vec3 color; varying float vA;
        void main(){ float a = texture2D(map, gl_PointCoord).a * vA; if (a < 0.01) discard; gl_FragColor = vec4(color, a);
        #include <colorspace_fragment>
        }`,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    this.pos.fill(0, 0); for (let i = 0; i < n; i++) this.pos[i * 3 + 1] = -999;
  }
  emit(x, y, z, vx, vy, vz, life, s0, s1) {
    const i = this.next; this.next = (this.next + 1) % this.n;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = life; this.max[i] = life; this.s0[i] = s0; this.s1[i] = s1;
  }
  update(dt) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; this.size[i] = 0; continue; }
      this.life[i] -= dt;
      const t = 1 - Math.max(0, this.life[i]) / this.max[i];
      const k = Math.exp(-this.drag * dt);
      this.vel[i * 3] *= k; this.vel[i * 3 + 2] *= k; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * k + this.gravity * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * t;
      this.alpha[i] = (1 - t) * (1 - t) * (t < 0.1 ? t * 10 : 1);
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true; g.attributes.aSize.needsUpdate = true; g.attributes.aAlpha.needsUpdate = true;
  }
}

export function makeFx(scene) {
  const steam = new Pool(64, { additive: false, color: 0xffffff, gravity: 0.9, drag: 0.7 });
  const sparks = new Pool(40, { additive: true, color: 0xffb347, gravity: -9, drag: 0.5 });
  scene.add(steam.points, sparks.points);
  return {
    puff(x, y, z, vx, strength = 1) {
      steam.emit(x, y, z, vx * 0.35 + (Math.random() - 0.5) * 0.8, 2.2 * strength, (Math.random() - 0.5) * 0.8, 1.9 + Math.random() * 0.8, 0.5, 2.6 * strength + 0.8);
    },
    spark(x, y, z, vz) {
      sparks.emit(x + (Math.random() - 0.5) * 0.3, y, z, (Math.random() - 0.5) * 3, 1.5 + Math.random() * 2.5, vz * 0.4 + (Math.random() - 0.5) * 2, 0.35 + Math.random() * 0.25, 0.12, 0.04);
    },
    update(dt, viewHeightPx, fov, lightLevel) {
      const s = viewHeightPx / (2 * Math.tan((fov * Math.PI) / 360));
      steam.uniforms.uScale.value = s; sparks.uniforms.uScale.value = s;
      steam.uniforms.color.value.setScalar(0.28 + 0.72 * lightLevel);
      steam.update(dt); sparks.update(dt);
    },
  };
}
