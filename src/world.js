import * as THREE from 'three';
import { toon, GEO, addOutline, bubbleMaterial, srgb } from './materials.js';
import { gradientBackground, rayTexture } from './textures.js';
import { makeFish } from './critters.js';

const FOG = '#3ea6db';
const FOG_NEAR = 16;
const FOG_FAR = 46;

const fogUniforms = () => ({
  uFog: { value: srgb(FOG) },
  uNear: { value: FOG_NEAR },
  uFar: { value: FOG_FAR },
});

export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  scene.background = gradientBackground();
  scene.fog = new THREE.Fog(FOG, FOG_NEAR, FOG_FAR);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 140);
  camera.position.set(0, 0.8, 14);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.HemisphereLight('#e0f8ff', '#2a6f9e', 1.8));
  const sun = new THREE.DirectionalLight('#ffffff', 2.4);
  sun.position.set(-5, 10, 8);
  scene.add(sun);

  const updaters = [];
  const uTime = { value: 0 };

  // ---------- sand ----------
  const floorGeo = new THREE.PlaneGeometry(160, 70, 160, 70);
  floorGeo.rotateX(-Math.PI / 2);
  const fp = floorGeo.attributes.position;
  for (let i = 0; i < fp.count; i++) {
    const x = fp.getX(i), z = fp.getZ(i);
    fp.setY(i, Math.sin(x * 0.3) * 0.25 + Math.cos(z * 0.45 + x * 0.15) * 0.35 + Math.max(0, -z - 20) * 0.08);
  }
  floorGeo.computeVertexNormals();
  const floorMat = new THREE.ShaderMaterial({
    uniforms: { uTime, ...fogUniforms() },
    vertexShader: /* glsl */ `
      varying vec3 vW; varying vec3 vN; varying float vDepth;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz; vN = normal;
        vec4 mv = viewMatrix * w; vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uFog; uniform float uNear; uniform float uFar;
      varying vec3 vW; varying vec3 vN; varying float vDepth;
      float caustic(vec2 uv, float t) {
        vec2 p = mod(uv * 6.28318, 6.28318) - 250.0;
        vec2 i = p; float c = 1.0; float inten = 0.005;
        for (int n = 0; n < 4; n++) {
          float tt = t * (1.0 - (3.5 / float(n + 1)));
          i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
          c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
        }
        c /= 4.0; c = 1.17 - pow(c, 1.4);
        return clamp(pow(abs(c), 8.0), 0.0, 1.0);
      }
      void main() {
        vec3 sand = mix(vec3(0.93, 0.80, 0.56), vec3(1.0, 0.92, 0.72), smoothstep(-0.4, 0.5, vW.y + 5.2));
        float l = 0.65 + 0.35 * max(dot(normalize(vN), normalize(vec3(-0.3, 1.0, 0.4))), 0.0);
        float c = caustic(vW.xz * 0.09, uTime * 0.45);
        vec3 col = sand * l + c * 0.5;
        col = mix(col, uFog, smoothstep(uNear, uFar, vDepth));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.position.set(0, -5.3, -20);
  scene.add(floor);

  // ---------- seaweed ----------
  const weedMats = [
    ['#1f8a4c', '#7ee08a'],
    ['#17775f', '#5fd3b0'],
    ['#4c8f22', '#b4e05a'],
  ].map(
    ([a, b]) =>
      new THREE.ShaderMaterial({
        uniforms: { uTime, uA: { value: srgb(a) }, uB: { value: srgb(b) }, ...fogUniforms() },
        side: THREE.DoubleSide,
        vertexShader: /* glsl */ `
          uniform float uTime; varying float vH; varying float vDepth; varying float vX;
          void main() {
            vec3 p = position; float h = uv.y;
            p.x *= (1.0 - h * 0.8);
            vec4 w = modelMatrix * vec4(p, 1.0);
            float ph = modelMatrix[3][0] * 1.7 + modelMatrix[3][2] * 0.9;
            w.x += sin(uTime * 1.3 + h * 3.0 + ph) * 0.55 * h * h;
            w.z += cos(uTime * 1.0 + h * 2.0 + ph) * 0.25 * h * h;
            vH = h; vX = uv.x;
            vec4 mv = viewMatrix * w; vDepth = -mv.z;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uA; uniform vec3 uB; uniform vec3 uFog; uniform float uNear; uniform float uFar;
          varying float vH; varying float vDepth; varying float vX;
          void main() {
            vec3 col = mix(uA, uB, vH);
            col *= 0.85 + 0.15 * smoothstep(0.0, 0.5, 1.0 - abs(vX - 0.5) * 2.0);
            col = mix(col, uFog, smoothstep(uNear, uFar, vDepth));
            gl_FragColor = vec4(col, 1.0);
          }`,
      })
  );
  const weedGeos = [3, 4.5, 6, 7.5].map((h) => {
    const g = new THREE.PlaneGeometry(0.6, h, 1, 14);
    g.translate(0, h / 2, 0);
    return g;
  });
  const rnd = (a, b) => a + Math.random() * (b - a);
  function addWeed(x, z) {
    const n = 2 + ((Math.random() * 3) | 0);
    const mat = weedMats[(Math.random() * weedMats.length) | 0];
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(weedGeos[(Math.random() * weedGeos.length) | 0], mat);
      m.position.set(x + rnd(-0.4, 0.4), -5.2, z + rnd(-0.3, 0.3));
      m.rotation.y = rnd(-1, 1);
      m.scale.setScalar(rnd(0.7, 1.15));
      scene.add(m);
    }
  }
  for (let i = 0; i < 26; i++) addWeed(rnd(-26, 26), rnd(-18, -4));
  for (const x of [-15, -12.5, 12, 14.5, -18, 18]) addWeed(x + rnd(-1, 1), rnd(-3, -1));

  // ---------- coral & rocks ----------
  const coralColors = ['#ff6f91', '#ff9f5a', '#b98cff', '#ff5e7e', '#ffc94d'];
  const branchGeo = new THREE.CapsuleGeometry(0.22, 1, 4, 10);
  function addCoral(x, z, s = 1) {
    const g = new THREE.Group();
    const color = coralColors[(Math.random() * coralColors.length) | 0];
    const mat = toon(color);
    const n = 5 + ((Math.random() * 4) | 0);
    for (let i = 0; i < n; i++) {
      const b = new THREE.Mesh(branchGeo, mat);
      const a = (i / n) * Math.PI * 2;
      const tilt = rnd(0.2, 0.7);
      b.position.set(Math.cos(a) * 0.35, 0.6 + rnd(0, 0.5), Math.sin(a) * 0.35);
      b.rotation.set(Math.sin(a) * tilt, 0, -Math.cos(a) * tilt);
      b.scale.set(1, rnd(0.8, 1.5), 1);
      g.add(b);
      const tip = new THREE.Mesh(GEO.sphereLo, toon('#ffffff'));
      tip.scale.setScalar(0.12);
      tip.position.set(0, 0.62, 0);
      b.add(tip);
    }
    g.position.set(x, -5.1, z);
    g.scale.setScalar(s);
    scene.add(g);
  }
  function addBrain(x, z, s = 1) {
    const color = coralColors[(Math.random() * coralColors.length) | 0];
    const m = new THREE.Mesh(GEO.sphere, toon(color));
    m.scale.set(1.2 * s, 0.8 * s, 1.1 * s);
    m.position.set(x, -5.0, z);
    scene.add(m);
    addOutline(m, '#7a2d4d', 0.04);
  }
  const rockGeo = new THREE.IcosahedronGeometry(1, 1);
  function addRock(x, z, s = 1, color = '#6f8fb3') {
    const m = new THREE.Mesh(rockGeo, toon(color));
    m.scale.set(s * rnd(1, 1.6), s * rnd(0.6, 1), s * rnd(0.8, 1.3));
    m.rotation.y = rnd(0, 3);
    m.position.set(x, -5.2 + s * 0.2, z);
    scene.add(m);
  }
  for (let i = 0; i < 9; i++) addCoral(rnd(-22, 22), rnd(-14, -5), rnd(0.8, 1.4));
  for (const [x, z] of [[-11, -3.5], [10.5, -3], [-16, -6], [16, -7]]) addCoral(x, z, 1.3);
  for (let i = 0; i < 6; i++) addBrain(rnd(-20, 20), rnd(-12, -4), rnd(0.6, 1.1));
  for (let i = 0; i < 10; i++) addRock(rnd(-25, 25), rnd(-16, -3), rnd(0.6, 1.5));
  for (let i = 0; i < 6; i++) addRock(rnd(-40, 40), rnd(-40, -30), rnd(4, 8), '#3f78a8');

  // ---------- light rays ----------
  const rayMat = new THREE.MeshBasicMaterial({
    map: rayTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0.22, side: THREE.DoubleSide,
  });
  const rays = [];
  for (let i = 0; i < 7; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(rnd(1.5, 3.5), 26), rayMat.clone());
    m.position.set(-16 + i * 5.5 + rnd(-1, 1), 4, -10 - rnd(0, 6));
    m.rotation.z = 0.32 + rnd(-0.05, 0.05);
    m.userData.ph = Math.random() * 10;
    scene.add(m);
    rays.push(m);
  }

  // ---------- background fish ----------
  const fishColors = ['#ffd23f', '#ff8f6b', '#7fd8ff', '#c9a6ff', '#ffffff'];
  const swimmers = [];
  for (let i = 0; i < 9; i++) {
    const f = makeFish(fishColors[i % fishColors.length], { stripe: i % 2 === 0 });
    const dir = Math.random() < 0.5 ? 1 : -1;
    f.scale.setScalar(rnd(0.35, 0.6));
    f.position.set(rnd(-28, 28), rnd(-1.5, 5), rnd(-14, -6));
    f.rotation.y = dir > 0 ? 0 : Math.PI;
    f.userData.dir = dir;
    f.userData.speed = rnd(0.8, 2);
    f.userData.baseY = f.position.y;
    f.userData.ph = Math.random() * 10;
    scene.add(f);
    swimmers.push(f);
  }

  // ---------- ambient bubbles ----------
  const AMB = 70;
  const ambMat = bubbleMaterial('#ffffff', { fill: 0.08 });
  const amb = new THREE.InstancedMesh(GEO.sphere, ambMat, AMB);
  amb.frustumCulled = false;
  amb.renderOrder = 1;
  const ambData = [];
  const dummy = new THREE.Object3D();
  function resetAmb(d, initial) {
    d.x = rnd(-18, 18);
    d.z = rnd(-10, 2);
    d.y = initial ? rnd(-7, 9) : rnd(-8, -6);
    d.s = rnd(0.06, 0.22);
    d.speed = rnd(0.6, 1.6);
    d.ph = Math.random() * 10;
    d.popped = 0;
  }
  for (let i = 0; i < AMB; i++) {
    const d = {};
    resetAmb(d, true);
    ambData.push(d);
  }
  scene.add(amb);

  function update(t, dt) {
    uTime.value = t;
    ambMat.uniforms.uTime.value = t;
    for (const r of rays) r.material.opacity = 0.12 + 0.1 * Math.sin(t * 0.4 + r.userData.ph);
    for (const f of swimmers) {
      const u = f.userData;
      f.position.x += u.dir * u.speed * dt;
      f.position.y = u.baseY + Math.sin(t * 0.8 + u.ph) * 0.4;
      if (u.dir > 0 && f.position.x > 30) f.position.x = -30;
      if (u.dir < 0 && f.position.x < -30) f.position.x = 30;
      u.update?.(t);
    }
    for (let i = 0; i < AMB; i++) {
      const d = ambData[i];
      d.y += d.speed * dt;
      if (d.y > 10) resetAmb(d, false);
      dummy.position.set(d.x + Math.sin(t * 1.5 + d.ph) * 0.2, d.y, d.z);
      dummy.scale.setScalar(d.s);
      dummy.updateMatrix();
      amb.setMatrixAt(i, dummy.matrix);
    }
    amb.instanceMatrix.needsUpdate = true;
    for (const u of updaters) u(t, dt);
  }

  function popAmbient(raycaster) {
    const hits = raycaster.intersectObject(amb, false);
    if (!hits.length) return null;
    const d = ambData[hits[0].instanceId];
    const pos = new THREE.Vector3(d.x, d.y, d.z);
    resetAmb(d, false);
    return pos;
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    const aspect = w / h;
    camera.aspect = aspect;
    const dist = camera.position.length();
    let viewH = 2 * dist * Math.tan(THREE.MathUtils.degToRad(22.5));
    const minW = 10.5;
    if (viewH * aspect < minW) viewH = minW / aspect;
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(viewH / 2 / dist));
    camera.updateProjectionMatrix();
    return { W: viewH * aspect, H: viewH };
  }

  return { renderer, scene, camera, update, resize, popAmbient };
}
