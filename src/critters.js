import * as THREE from 'three';
import { toon, basic, GEO, addOutline } from './materials.js';

const OUTLINE = '#23395d';

function fanShape(len = 0.75, spread = 0.6) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(len * 0.35, spread * 0.5, len * 0.8, spread * 1.05, len, spread * 0.85);
  s.quadraticCurveTo(len * 0.72, 0, len, -spread * 0.85);
  s.bezierCurveTo(len * 0.8, -spread * 1.05, len * 0.35, -spread * 0.5, 0, 0);
  return s;
}

function extrude(shape, depth, bevel) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 16,
  });
  g.translate(0, 0, -depth / 2);
  return g;
}

export const fishTailGeo = (() => {
  const g = extrude(fanShape(0.75, 0.62), 0.06, 0.04);
  g.rotateZ(Math.PI);
  return g;
})();

export function makeEye(size = 0.2) {
  const eye = new THREE.Group();
  const white = new THREE.Mesh(GEO.sphere, basic('#ffffff'));
  white.scale.set(size, size * 1.12, size * 0.6);
  eye.add(white);
  const pupil = new THREE.Group();
  pupil.position.z = size * 0.42;
  const p = new THREE.Mesh(GEO.sphere, basic('#1c2340'));
  p.scale.set(size * 0.62, size * 0.72, size * 0.32);
  pupil.add(p);
  const sp = new THREE.Mesh(GEO.sphereLo, basic('#ffffff'));
  sp.scale.setScalar(size * 0.2);
  sp.position.set(size * 0.2, size * 0.26, size * 0.22);
  pupil.add(sp);
  eye.add(pupil);
  eye.userData.pupil = pupil;
  return eye;
}

const smileGeo = new THREE.TorusGeometry(0.1, 0.028, 8, 18, Math.PI);
export function makeSmile(scale = 1) {
  const m = new THREE.Mesh(smileGeo, basic('#3a1d2b'));
  m.rotation.z = Math.PI;
  m.scale.setScalar(scale);
  return m;
}

const cheekGeo = new THREE.CircleGeometry(0.1, 20);
export function makeCheek(scale = 1) {
  const m = new THREE.Mesh(cheekGeo, basic('#ff7aa8', { transparent: true, opacity: 0.6, depthWrite: false }));
  m.scale.setScalar(scale);
  return m;
}

export function makeFish(color = '#ffb347', { stripe = false, outline = true } = {}) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(GEO.sphere, toon(color));
  body.scale.set(0.85, 0.68, 0.55);
  g.add(body);
  if (outline) addOutline(body, OUTLINE, 0.045);
  if (stripe) {
    const st = new THREE.Mesh(GEO.sphere, toon('#ffffff'));
    st.scale.set(0.12, 0.69, 0.56);
    st.position.x = 0.18;
    g.add(st);
  }
  const tail = new THREE.Mesh(fishTailGeo, toon(color));
  tail.position.x = -0.72;
  g.add(tail);
  const fin = new THREE.Mesh(GEO.sphere, toon(color));
  fin.scale.set(0.32, 0.2, 0.06);
  fin.position.set(-0.1, 0.62, 0);
  fin.rotation.z = -0.3;
  g.add(fin);
  const eye = makeEye(0.17);
  eye.position.set(0.42, 0.16, 0.42);
  eye.rotation.y = 0.5;
  g.add(eye);
  const smile = makeSmile(0.9);
  smile.position.set(0.66, -0.14, 0.34);
  smile.rotation.y = 0.9;
  g.add(smile);
  const cheek = makeCheek(0.9);
  cheek.position.set(0.5, -0.12, 0.43);
  cheek.rotation.y = 0.6;
  g.add(cheek);
  const ph = Math.random() * 10;
  g.userData.update = (t) => {
    tail.rotation.y = Math.sin(t * 8 + ph) * 0.5;
    fin.rotation.x = Math.sin(t * 5 + ph) * 0.2;
  };
  return g;
}

const starGeo = (() => {
  const s = new THREE.Shape();
  const pts = 5;
  for (let i = 0; i <= pts * 2; i++) {
    const a = (i / (pts * 2)) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 === 0 ? 1 : 0.5;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  return extrude(s, 0.18, 0.16);
})();

export function makeStarfish(color = '#ffd23f') {
  const g = new THREE.Group();
  const inner = new THREE.Group();
  g.add(inner);
  const body = new THREE.Mesh(starGeo, toon(color));
  body.scale.setScalar(0.85);
  inner.add(body);
  for (const sx of [-1, 1]) {
    const e = makeEye(0.13);
    e.position.set(sx * 0.17, 0.12, 0.26);
    inner.add(e);
    const ch = makeCheek(0.7);
    ch.position.set(sx * 0.32, -0.06, 0.255);
    inner.add(ch);
  }
  const sm = makeSmile(0.8);
  sm.position.set(0, -0.05, 0.27);
  inner.add(sm);
  const dots = toon('#ffffff');
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + Math.PI / 2;
    const d = new THREE.Mesh(GEO.sphereLo, dots);
    d.scale.set(0.05, 0.05, 0.03);
    d.position.set(Math.cos(a) * 0.62, Math.sin(a) * 0.62, 0.24);
    inner.add(d);
  }
  const ph = Math.random() * 10;
  g.userData.update = (t) => {
    inner.rotation.z = Math.sin(t * 1.6 + ph) * 0.14;
    inner.scale.y = 1 + Math.sin(t * 3 + ph) * 0.03;
  };
  return g;
}

const domeGeo = new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
const tentGeo = new THREE.CapsuleGeometry(0.07, 0.5, 4, 8);
tentGeo.translate(0, -0.32, 0);

export function makeJelly(color = '#ff8fd0') {
  const g = new THREE.Group();
  const inner = new THREE.Group();
  g.add(inner);
  const dome = new THREE.Mesh(domeGeo, toon(color));
  dome.scale.set(0.78, 0.72, 0.7);
  dome.position.y = -0.1;
  inner.add(dome);
  addOutline(dome, OUTLINE, 0.04).material.side = THREE.BackSide;
  const skirt = new THREE.Mesh(GEO.sphere, toon(color));
  skirt.scale.set(0.8, 0.12, 0.72);
  skirt.position.y = -0.12;
  inner.add(skirt);
  const tents = [];
  for (let i = 0; i < 4; i++) {
    const t = new THREE.Mesh(tentGeo, toon(color));
    t.position.set(-0.45 + i * 0.3, -0.18, 0.1);
    inner.add(t);
    tents.push(t);
  }
  for (const sx of [-1, 1]) {
    const e = makeEye(0.13);
    e.position.set(sx * 0.22, 0.18, 0.58);
    inner.add(e);
    const ch = makeCheek(0.7);
    ch.position.set(sx * 0.42, 0.04, 0.53);
    ch.rotation.y = sx * 0.6;
    inner.add(ch);
  }
  const sm = makeSmile(0.8);
  sm.position.set(0, 0.04, 0.65);
  inner.add(sm);
  const ph = Math.random() * 10;
  g.userData.update = (t) => {
    const s = Math.sin(t * 3 + ph);
    inner.scale.set(1 + s * 0.05, 1 - s * 0.05, 1);
    inner.position.y = Math.sin(t * 1.5 + ph) * 0.06;
    tents.forEach((tt, i) => (tt.rotation.z = Math.sin(t * 3 + i + ph) * 0.25));
  };
  return g;
}

export const KINDS = {
  fish: { name: 'fish', colors: ['#ffb347', '#ff6b8b', '#4cc3ff', '#5fd36b', '#b48cff', '#ffd23f'] },
  star: { name: 'starfish', colors: ['#ffd23f', '#ff8f3f', '#ff6b8b', '#b48cff'] },
  jelly: { name: 'jellyfish', colors: ['#ff8fd0', '#b48cff', '#7fd8ff', '#ffa0a0'] },
};

export function makeCritter(kind, i = 0, colorOverride) {
  const colors = KINDS[kind].colors;
  const color = colorOverride || colors[i % colors.length];
  let c;
  if (kind === 'star') c = makeStarfish(color);
  else if (kind === 'jelly') c = makeJelly(color);
  else c = makeFish(color, { stripe: i % 3 === 1 });
  c.userData.critter = true;
  c.userData.kind = kind;
  return c;
}
