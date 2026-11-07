import * as THREE from 'three';

const dummy = new THREE.Object3D();
const tmpColor = new THREE.Color();
const CONFETTI = ['#ff6b8b', '#ffd23f', '#5fd36b', '#4cc3ff', '#b48cff', '#ffb347', '#ffffff'];

class Pool {
  constructor(scene, geo, mat, max) {
    this.max = max;
    this.items = [];
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 20;
    for (let i = 0; i < max; i++) this.mesh.setColorAt(i, tmpColor.set('#fff'));
    this.mesh.count = 0;
    scene.add(this.mesh);
  }
  add(p) {
    if (this.items.length >= this.max) this.items.shift();
    this.items.push(p);
  }
  update(dt) {
    const items = this.items;
    for (let i = items.length - 1; i >= 0; i--) {
      const p = items[i];
      p.life -= dt;
      if (p.life <= 0) {
        items.splice(i, 1);
        continue;
      }
      const drag = Math.pow(p.drag, dt * 60);
      p.v.multiplyScalar(drag);
      p.v.y += p.g * dt;
      p.p.addScaledVector(p.v, dt);
      p.r.x += p.vr.x * dt;
      p.r.y += p.vr.y * dt;
      p.r.z += p.vr.z * dt;
    }
    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      const k = p.life / p.maxLife;
      const s = p.size * (k < 0.25 ? k / 0.25 : 1) * (p.grow ? 1 + (1 - k) * p.grow : 1);
      dummy.position.copy(p.p);
      if (p.flutter) dummy.position.x += Math.sin(p.life * 6 + p.seed) * 0.15;
      dummy.rotation.set(p.r.x, p.r.y, p.r.z);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
      this.mesh.setColorAt(i, p.color);
    }
    this.mesh.count = items.length;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

export class Particles {
  constructor(scene) {
    this.confetti = new Pool(
      scene,
      new THREE.PlaneGeometry(0.22, 0.13),
      new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false }),
      700
    );
    const starShape = new THREE.Shape();
    for (let i = 0; i <= 10; i++) {
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      const r = i % 2 === 0 ? 1 : 0.45;
      if (i === 0) starShape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else starShape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    this.stars = new Pool(
      scene,
      new THREE.ShapeGeometry(starShape),
      new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false }),
      200
    );
    this.drops = new Pool(
      scene,
      new THREE.SphereGeometry(1, 10, 8),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.75, toneMapped: false, depthWrite: false }),
      400
    );
  }

  pop(pos, color = '#ffffff', r = 1) {
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2;
      const b = (Math.random() - 0.5) * Math.PI;
      const dir = new THREE.Vector3(Math.cos(a) * Math.cos(b), Math.sin(b), Math.sin(a) * Math.cos(b));
      const p = pos.clone().addScaledVector(dir, r * 0.9);
      this.drops.add({
        p, v: dir.multiplyScalar(2 + Math.random() * 3), r: new THREE.Euler(), vr: new THREE.Vector3(),
        g: 1.5, drag: 0.9, life: 0.6 + Math.random() * 0.4, maxLife: 1, size: 0.05 + Math.random() * 0.08,
        color: tmpColor.set(i % 3 ? '#ffffff' : color).clone(),
      });
    }
  }

  burst(pos, n = 50, { speed = 7, spread = 1, colors = CONFETTI } = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const up = 0.4 + Math.random() * 0.9;
      const v = new THREE.Vector3(Math.cos(a) * spread, up, Math.sin(a) * 0.4).normalize().multiplyScalar(speed * (0.5 + Math.random() * 0.7));
      this.confetti.add({
        p: pos.clone(), v, r: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        vr: new THREE.Vector3((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 8),
        g: -5, drag: 0.94, life: 1.6 + Math.random() * 1.2, maxLife: 2.8, size: 0.8 + Math.random() * 0.8,
        color: tmpColor.set(colors[(Math.random() * colors.length) | 0]).clone(), flutter: true, seed: Math.random() * 10,
      });
    }
  }

  sparkle(pos, n = 10, color = '#ffe066') {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = new THREE.Vector3(Math.cos(a), Math.sin(a), 0).multiplyScalar(2 + Math.random() * 3);
      this.stars.add({
        p: pos.clone(), v, r: new THREE.Euler(0, 0, Math.random() * 6), vr: new THREE.Vector3(0, 0, (Math.random() - 0.5) * 8),
        g: 0, drag: 0.9, life: 0.7 + Math.random() * 0.4, maxLife: 1.1, size: 0.12 + Math.random() * 0.12,
        color: tmpColor.set(color).clone(),
      });
    }
  }

  rain(W, H, n = 120) {
    for (let i = 0; i < n; i++) {
      const p = new THREE.Vector3((Math.random() - 0.5) * W, H / 2 + Math.random() * 4, (Math.random() - 0.5) * 3);
      this.confetti.add({
        p, v: new THREE.Vector3(0, -1.5 - Math.random() * 2, 0), r: new THREE.Euler(Math.random() * 6, Math.random() * 6, 0),
        vr: new THREE.Vector3((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 6),
        g: -0.5, drag: 0.995, life: 4 + Math.random() * 2, maxLife: 6, size: 0.9 + Math.random() * 0.7,
        color: tmpColor.set(CONFETTI[(Math.random() * CONFETTI.length) | 0]).clone(), flutter: true, seed: Math.random() * 10,
      });
    }
  }

  update(dt) {
    this.confetti.update(dt);
    this.stars.update(dt);
    this.drops.update(dt);
  }
}
