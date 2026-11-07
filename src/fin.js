import * as THREE from 'three';
import { toon, basic, GEO, addOutline } from './materials.js';
import { makeEye, makeCheek } from './critters.js';
import { tween, Ease, killTweens } from './tween.js';
import { isSpeaking } from './audio.js';

const C = {
  body: '#ff9248',
  belly: '#ffe6bf',
  fin: '#ff6f61',
  tail: '#ffb347',
  outline: '#5b2a1c',
};

function surface(x, y, sy = 0.95) {
  const z = Math.sqrt(Math.max(0, 1 - x * x - (y / sy) ** 2));
  const p = new THREE.Vector3(x, y, z);
  const n = new THREE.Vector3(x, y / (sy * sy), z).normalize();
  return { p, n };
}

function orient(obj, n) {
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
}

export class Fin {
  constructor() {
    this.root = new THREE.Group();
    this.hop = new THREE.Group();
    this.root.add(this.hop);
    this.body = new THREE.Group();
    this.hop.add(this.body);

    this.time = 0;
    this.turn = 0.5;
    this.spin = 0;
    this.shake = 0;
    this.jump = 0;
    this.squash = 0;
    this.forceOpen = 0;
    this.mouth = 0;
    this.blinkT = 2;
    this.blinkPhase = -1;
    this.lookTarget = null;

    const bodyMesh = new THREE.Mesh(GEO.sphereHi, toon(C.body));
    bodyMesh.scale.set(1, 0.95, 1);
    this.body.add(bodyMesh);
    addOutline(bodyMesh, C.outline, 0.035);
    this.hitMesh = bodyMesh;

    const belly = new THREE.Mesh(GEO.sphere, toon(C.belly));
    belly.scale.set(0.7, 0.55, 0.55);
    belly.position.set(0, -0.38, 0.4);
    this.body.add(belly);

    // stripe like a little clownfish
    const stripe = new THREE.Mesh(GEO.sphereHi, toon('#ffffff'));
    stripe.scale.set(1.012, 0.962, 0.16);
    stripe.position.z = -0.42;
    this.body.add(stripe);

    this.eyes = [];
    for (const sx of [-1, 1]) {
      const { p, n } = surface(sx * 0.36, 0.24);
      const eye = makeEye(0.27);
      eye.position.copy(p).multiplyScalar(0.94);
      orient(eye, n);
      this.body.add(eye);
      this.eyes.push(eye);

      const c = surface(sx * 0.6, -0.08);
      const cheek = makeCheek(1.3);
      cheek.position.copy(c.p).multiplyScalar(1.006);
      orient(cheek, c.n);
      this.body.add(cheek);
    }

    // mouth: smile + open mouth
    const m = surface(0, -0.1);
    this.smile = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.034, 8, 20, Math.PI), basic('#3a1d2b'));
    this.smile.position.copy(m.p).multiplyScalar(1.0);
    orient(this.smile, m.n);
    this.smile.rotateZ(Math.PI);
    this.body.add(this.smile);
    this.open = new THREE.Group();
    const mo = surface(0, -0.16);
    this.open.position.copy(mo.p).multiplyScalar(0.985);
    orient(this.open, mo.n);
    const hole = new THREE.Mesh(GEO.sphere, basic('#7a1f35'));
    hole.scale.set(0.16, 0.13, 0.06);
    this.open.add(hole);
    const tongue = new THREE.Mesh(GEO.sphere, basic('#ff7a93'));
    tongue.scale.set(0.09, 0.05, 0.04);
    tongue.position.set(0, -0.06, 0.03);
    this.open.add(tongue);
    this.open.scale.y = 0.001;
    this.body.add(this.open);

    // little curl on top
    const curl = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.05, 8, 20, Math.PI * 1.4), toon(C.fin));
    curl.position.set(0.02, 1.02, 0.12);
    curl.rotation.set(0, 0, -0.4);
    this.body.add(curl);

    // dorsal fin
    const dorsal = new THREE.Mesh(GEO.sphere, toon(C.fin));
    dorsal.scale.set(0.09, 0.34, 0.42);
    dorsal.position.set(0, 0.86, -0.32);
    dorsal.rotation.x = 0.5;
    this.body.add(dorsal);

    // side fins
    this.sideFins = [];
    for (const sx of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(sx * 0.92, -0.28, 0.12);
      const f = new THREE.Mesh(GEO.sphere, toon(C.fin));
      f.scale.set(0.34, 0.13, 0.24);
      f.position.x = sx * 0.24;
      pivot.add(f);
      addOutline(f, C.outline, 0.03);
      pivot.userData.sx = sx;
      this.body.add(pivot);
      this.sideFins.push(pivot);
    }

    // tail
    this.tail = new THREE.Group();
    this.tail.position.set(0, 0, -0.88);
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.bezierCurveTo(0.3, 0.35, 0.75, 0.85, 0.95, 0.7);
    s.quadraticCurveTo(0.7, 0, 0.95, -0.7);
    s.bezierCurveTo(0.75, -0.85, 0.3, -0.35, 0, 0);
    const tg = new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 3, curveSegments: 18 });
    tg.translate(0, 0, -0.04);
    tg.rotateY(Math.PI / 2);
    const tail = new THREE.Mesh(tg, toon(C.tail));
    tail.rotation.x = -0.25;
    this.tail.add(tail);
    this.body.add(this.tail);

    this.root.traverse((o) => (o.userData.fin = true));
  }

  update(dt) {
    this.time += dt;
    const t = this.time;
    this.hop.position.y = Math.sin(t * 2) * 0.12 + this.jump;
    this.hop.rotation.z = Math.sin(t * 1.3) * 0.05;
    const sq = this.squash;
    this.hop.scale.set(1 - sq * 0.5, 1 + sq, 1 - sq * 0.5);
    this.body.rotation.y = this.turn + this.spin + Math.sin(t * 0.7) * 0.08;
    this.body.rotation.z = this.shake;
    this.body.rotation.x = Math.sin(t * 1.1) * 0.05;
    this.tail.rotation.y = Math.sin(t * 7) * 0.45;
    for (const f of this.sideFins) f.rotation.z = f.userData.sx * (-0.25 + Math.sin(t * 6 + f.userData.sx) * 0.3);

    // blink
    this.blinkT -= dt;
    if (this.blinkT < 0 && this.blinkPhase < 0) {
      this.blinkPhase = 0;
      this.blinkT = 2 + Math.random() * 3;
    }
    let lid = 1;
    if (this.blinkPhase >= 0) {
      this.blinkPhase += dt;
      lid = Math.abs(Math.cos(Math.min(this.blinkPhase / 0.16, 1) * Math.PI));
      lid = Math.max(0.08, lid);
      if (this.blinkPhase > 0.16) this.blinkPhase = -1;
    }
    for (const e of this.eyes) e.scale.y = lid;

    // look
    const pupils = this.eyes.map((e) => e.userData.pupil);
    let lx = Math.sin(t * 0.5) * 0.03, ly = 0;
    if (this.lookTarget) {
      const v = this.body.worldToLocal(this.lookTarget.clone()).normalize();
      lx = THREE.MathUtils.clamp(v.x * 0.14, -0.07, 0.07);
      ly = THREE.MathUtils.clamp(v.y * 0.14, -0.06, 0.06);
    }
    for (const p of pupils) {
      p.position.x += (lx - p.position.x) * Math.min(1, dt * 8);
      p.position.y += (ly - p.position.y) * Math.min(1, dt * 8);
    }

    // mouth
    const talking = isSpeaking();
    const target = Math.max(this.forceOpen, talking ? 0.35 + 0.65 * Math.abs(Math.sin(t * 13)) : 0);
    this.mouth += (target - this.mouth) * Math.min(1, dt * 18);
    this.open.scale.y = Math.max(0.001, this.mouth);
    this.open.visible = this.mouth > 0.05;
    this.smile.visible = this.mouth < 0.3;
  }

  lookAt(v) {
    this.lookTarget = v ? v.clone() : null;
  }

  moveTo({ x, y, s }, duration = 0.9) {
    killTweens(this.root);
    const fx = this.root.position.x, fy = this.root.position.y, fs = this.root.scale.x;
    return tween({
      duration,
      ease: Ease.inOutCubic,
      target: this.root,
      onUpdate: (v) => {
        this.root.position.x = fx + (x - fx) * v;
        this.root.position.y = fy + (y - fy) * v + Math.sin(v * Math.PI) * 0.6;
        this.root.scale.setScalar(fs + (s - fs) * v);
      },
    });
  }

  place({ x, y, s }) {
    killTweens(this.root);
    this.root.position.set(x, y, 0);
    this.root.scale.setScalar(s);
  }

  happy() {
    killTweens(this);
    this.forceOpen = 1;
    tween({ duration: 0.12, target: this, onUpdate: (v) => (this.squash = -0.18 * v) }).then(() =>
      tween({
        duration: 0.85,
        target: this,
        ease: Ease.linear,
        onUpdate: (v) => {
          this.squash = -0.18 * (1 - Math.min(1, v * 4)) + Math.sin(v * Math.PI) * 0.06;
          this.jump = Math.sin(v * Math.PI) * 1.1;
          this.spin = Ease.inOutCubic(v) * Math.PI * 2;
        },
      }).then(() => {
        this.spin = 0;
        this.jump = 0;
        tween({ duration: 0.3, target: this, onUpdate: (v, k) => (this.squash = Math.sin(k * Math.PI) * -0.12) }).then(() => {
          this.squash = 0;
          this.forceOpen = 0;
        });
      })
    );
  }

  oops() {
    killTweens(this);
    this.spin = 0;
    this.jump = 0;
    this.squash = 0;
    this.forceOpen = 0.4;
    tween({
      duration: 0.7,
      target: this,
      ease: Ease.linear,
      onUpdate: (v) => (this.shake = Math.sin(v * Math.PI * 5) * 0.22 * (1 - v)),
    }).then(() => {
      this.shake = 0;
      this.forceOpen = 0;
    });
  }

  async dance() {
    killTweens(this);
    this.forceOpen = 1;
    await tween({
      duration: 2.2,
      target: this,
      ease: Ease.linear,
      onUpdate: (v) => {
        this.jump = Math.abs(Math.sin(v * Math.PI * 4)) * 0.8;
        this.shake = Math.sin(v * Math.PI * 4) * 0.25;
        this.spin = v > 0.6 ? Ease.inOutCubic((v - 0.6) / 0.4) * Math.PI * 2 : 0;
      },
    });
    this.jump = this.shake = this.spin = 0;
    this.forceOpen = 0;
  }
}
