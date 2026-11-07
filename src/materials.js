import * as THREE from 'three';

let gradMap = null;
export function gradientMap() {
  if (!gradMap) {
    const d = new Uint8Array([120, 120, 120, 255, 200, 200, 200, 255, 255, 255, 255, 255]);
    gradMap = new THREE.DataTexture(d, 3, 1);
    gradMap.minFilter = gradMap.magFilter = THREE.NearestFilter;
    gradMap.needsUpdate = true;
  }
  return gradMap;
}

const toonCache = new Map();
export function toon(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (toonCache.has(key)) return toonCache.get(key);
  const m = new THREE.MeshToonMaterial({ color, gradientMap: gradientMap(), ...opts });
  toonCache.set(key, m);
  return m;
}

const basicCache = new Map();
export function basic(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (basicCache.has(key)) return basicCache.get(key);
  const m = new THREE.MeshBasicMaterial({ color, ...opts });
  basicCache.set(key, m);
  return m;
}

export const GEO = {
  sphere: new THREE.SphereGeometry(1, 28, 20),
  sphereHi: new THREE.SphereGeometry(1, 48, 32),
  sphereLo: new THREE.SphereGeometry(1, 12, 8),
};

const outlineCache = new Map();
export function addOutline(mesh, color = '#23395d', thickness = 0.04) {
  let m = outlineCache.get(color);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
    outlineCache.set(color, m);
  }
  const o = new THREE.Mesh(mesh.geometry, m);
  o.scale.setScalar(1 + thickness / Math.max(0.2, Math.min(mesh.scale.x, mesh.scale.y, mesh.scale.z)));
  o.raycast = () => {};
  mesh.add(o);
  return o;
}

export const srgb = (c) => new THREE.Color(c).convertLinearToSRGB();

const bubbleVert = /* glsl */ `
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec4 p = vec4(position, 1.0);
    vec3 n = normal;
    #ifdef USE_INSTANCING
      p = instanceMatrix * p;
      n = mat3(instanceMatrix) * n;
    #endif
    vec4 mv = modelViewMatrix * p;
    vN = normalize(normalMatrix * n);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const bubbleFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uOpacity;
  uniform float uFill;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec3 n = normalize(vN);
    float f = 1.0 - clamp(dot(n, vV), 0.0, 1.0);
    float rim = pow(f, 2.4);
    vec3 irid = 0.5 + 0.5 * cos(6.28318 * (vec3(0.0, 0.33, 0.67) + f * 1.3 + uTime * 0.08));
    vec3 col = mix(uColor, irid, 0.35 * rim);
    col = mix(col, vec3(1.0), rim * 0.55);
    vec3 L = normalize(vec3(-0.55, 0.75, 0.9));
    float spec = pow(max(dot(reflect(-L, n), vV), 0.0), 60.0);
    float spec2 = pow(max(dot(reflect(-normalize(vec3(0.6, -0.5, 0.8)), n), vV), 0.0), 18.0) * 0.25;
    float a = uFill + rim * 0.8 + spec + spec2;
    col += vec3(spec + spec2);
    gl_FragColor = vec4(col, clamp(a, 0.0, 1.0) * uOpacity);
  }
`;

export function bubbleMaterial(color = '#ffffff', { fill = 0.3, opacity = 1 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: srgb(color) },
      uTime: { value: 0 },
      uOpacity: { value: opacity },
      uFill: { value: fill },
    },
    vertexShader: bubbleVert,
    fragmentShader: bubbleFrag,
    transparent: true,
    depthWrite: false,
  });
}
