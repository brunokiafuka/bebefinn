import * as THREE from 'three';
import { GEO, bubbleMaterial } from './materials.js';
import { labelTexture, glowTexture, shade } from './textures.js';
import { makeCritter } from './critters.js';
import { tween, Ease, killTweens } from './tween.js';

let glowTex = null;

export class ChoiceBubble {
  constructor(choice, r, color) {
    this.choice = choice;
    this.r = r;
    this.color = color;
    this.alive = true;
    this.hint = 0;
    this.rise = 0;
    this.fade = 1;
    this.phase = Math.random() * 10;
    this.base = new THREE.Vector3();
    this.disposables = [];

    this.group = new THREE.Group();
    this.inner = new THREE.Group();
    this.group.add(this.inner);

    this.mat = bubbleMaterial(color, { fill: 0.32 });
    this.disposables.push(this.mat);
    this.sphere = new THREE.Mesh(GEO.sphereHi, this.mat);
    this.sphere.scale.setScalar(r);
    this.sphere.renderOrder = 4;
    this.sphere.userData.bubble = this;
    this.inner.add(this.sphere);

    this.content = new THREE.Group();
    this.inner.add(this.content);

    if (choice.critters) {
      const { kind, n } = choice.critters;
      const cols = n <= 3 ? n : Math.ceil(n / 2);
      const rows = Math.ceil(n / cols);
      const sp = Math.min((r * 1.45) / cols, (r * 1.3) / rows);
      for (let i = 0; i < n; i++) {
        const row = Math.floor(i / cols);
        const inRow = row === rows - 1 ? n - row * cols : cols;
        const col = i - row * cols;
        const c = makeCritter(kind, i);
        c.scale.setScalar(sp * 0.42);
        c.position.set((col - (inRow - 1) / 2) * sp, ((rows - 1) / 2 - row) * sp * 0.95, 0);
        c.traverse((o) => (o.raycast = () => {}));
        this.content.add(c);
      }
    } else if (choice.text != null || choice.emoji) {
      const text = choice.text ?? choice.emoji;
      const tex = labelTexture(String(text), { emoji: !!choice.emoji, stroke: shade(color, -0.32) });
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false });
      const geo = new THREE.PlaneGeometry(r * 1.55, r * 1.55);
      this.disposables.push(tex, mat, geo);
      const label = new THREE.Mesh(geo, mat);
      label.renderOrder = 5;
      label.raycast = () => {};
      this.label = label;
      this.content.add(label);
    }

    if (!glowTex) glowTex = glowTexture();
    this.glowMat = new THREE.SpriteMaterial({ map: glowTex, color: '#fff7a8', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
    this.disposables.push(this.glowMat);
    this.glow = new THREE.Sprite(this.glowMat);
    this.glow.scale.setScalar(r * 3.4);
    this.glow.renderOrder = 3;
    this.glow.raycast = () => {};
    this.group.add(this.glow);
  }

  setBase(x, y) {
    this.base.set(x, y, 0);
  }

  get worldPos() {
    return this.group.position.clone();
  }

  update(t) {
    this.mat.uniforms.uTime.value = t + this.phase;
    this.mat.uniforms.uOpacity.value = this.fade;
    const fy = Math.sin(t * 1.6 + this.phase) * 0.1;
    const fx = Math.sin(t * 0.9 + this.phase * 2) * 0.06;
    this.group.position.set(this.base.x + fx, this.base.y + fy + this.rise, this.base.z);
    this.content.rotation.z = Math.sin(t * 1.2 + this.phase) * 0.06;
    this.content.children.forEach((c) => c.userData.update?.(t));
    const pulse = this.hint * (0.55 + 0.45 * Math.sin(t * 6));
    this.glowMat.opacity = pulse * 0.9;
    if (this.hint > 0 && !this._squashing) this.inner.scale.setScalar(1 + pulse * 0.08);
  }

  spawn(delay = 0, from = -9) {
    this.rise = from;
    this.inner.scale.setScalar(0.3);
    tween({ duration: 0.9, delay, ease: Ease.outBack, target: this, onUpdate: (v) => (this.rise = from * (1 - v)) });
    return tween({ duration: 0.7, delay: delay + 0.1, ease: Ease.outElastic, target: this, onUpdate: (v) => this.inner.scale.setScalar(0.3 + 0.7 * v) });
  }

  setHint(on) {
    const from = this.hint;
    tween({ duration: 0.4, onUpdate: (v) => (this.hint = from + ((on ? 1 : 0) - from) * v) });
  }

  wobble() {
    this._squashing = true;
    return tween({
      duration: 0.7,
      ease: Ease.linear,
      onUpdate: (v) => {
        const d = (1 - v) * 0.22;
        this.inner.scale.set(1 + Math.sin(v * 22) * d, 1 - Math.sin(v * 22) * d, 1);
        this.inner.rotation.z = Math.sin(v * 18) * 0.15 * (1 - v);
      },
    }).then(() => {
      this._squashing = false;
      this.inner.scale.setScalar(1);
      this.inner.rotation.z = 0;
    });
  }

  pop() {
    this.alive = false;
    this.sphere.visible = false;
    this.glow.visible = false;
    this._squashing = true;
    return tween({
      duration: 0.5,
      ease: Ease.outCubic,
      onUpdate: (v) => {
        const s = v < 0.35 ? 1 + v * 1.4 : 1.49 * (1 - (v - 0.35) / 0.65);
        this.content.scale.setScalar(Math.max(0.001, s));
      },
    });
  }

  floatAway() {
    this.alive = false;
    killTweens(this);
    const r0 = this.rise;
    return tween({
      duration: 0.8,
      ease: Ease.inCubic,
      onUpdate: (v) => {
        this.rise = r0 + v * 9;
        this.fade = 1 - v;
        this.content.scale.setScalar(Math.max(0.001, 1 - v));
      },
    });
  }

  dispose() {
    killTweens(this);
    this.group.parent?.remove(this.group);
    for (const d of this.disposables) d.dispose();
  }
}
