import * as THREE from 'three';
import { createWorld } from './world.js';
import { Fin } from './fin.js';
import { ChoiceBubble } from './bubble.js';
import { makeCritter } from './critters.js';
import { Particles } from './particles.js';
import { tween, updateTweens, Ease, wait, killTweens } from './tween.js';
import * as audio from './audio.js';
import { sfx, say } from './audio.js';
import { WORLDS, ROUNDS, NUM_WORDS, pick, shuffle } from './levels.js';
import { UI } from './ui.js';
import { labelTexture, cardTexture, slotTexture, shade } from './textures.js';
import { GEO } from './materials.js';
import { loadProgress, recordStars, isUnlocked } from './progress.js';

const PRAISE = ['Yay!', 'Great job!', 'You did it!', 'Super!', 'Wow, well done!', 'Amazing!', 'Hooray!', 'Brilliant!', 'Finn-tastic!'];
const PALETTE = ['#ff6b8b', '#ffb347', '#5fd36b', '#4cc3ff', '#b48cff', '#ffd23f'];
const cap = (s) => s[0].toUpperCase() + s.slice(1);

const canvas = document.getElementById('scene');
const world = createWorld(canvas);
const { camera, renderer } = world;
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight('#e0f8ff', '#2a6f9e', 1.8));
const sun = new THREE.DirectionalLight('#ffffff', 2.4);
sun.position.set(-5, 10, 8);
scene.add(sun);
renderer.autoClear = false;
const fin = new Fin();
scene.add(fin.root);
const fx = new Particles(scene);
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const progress = loadProgress();
const hitMat = new THREE.MeshBasicMaterial();

let L = null;
let state = 'loading';
let token = 0;
let bubbles = [];
const allBubbles = new Set();
let display = null;
let accepting = false;
let hintTimer = null;
let currentWorld = 0;
let S = { world: 0, stage: 0, round: 0, mistakes: 0, wrong: 0, count: 0, deck: [], r: null };

// ---------------------------------------------------------------- layout
function computeLayout() {
  const { W, H } = world.resize();
  const px = H / window.innerHeight;
  const portraitHud = window.innerWidth / window.innerHeight < 0.75;
  const hud = (portraitHud ? 150 : 100) * px;
  const landscape = W / H >= 1.15;
  L = { W, H, landscape, top: H / 2 - hud, bottom: -H / 2 };
  if (landscape) {
    L.fin = { x: -W / 2 + 2.3, y: -1.1, s: 1 };
    L.left = -W / 2 + 4.6;
    L.right = W / 2 - 0.9;
  } else {
    L.fin = { x: 0, y: L.bottom + 1.5, s: 0.9 };
    L.finTop = L.bottom + 2.75;
  }
}

function finSpot(kind) {
  if (kind === 'title') return L.landscape ? { x: 0, y: -1.5, s: 1.5 } : { x: 0, y: 0.4, s: 1.5 };
  if (kind === 'menu') return { x: -L.W / 2 + (L.landscape ? 1.8 : 1.3), y: L.bottom + (L.landscape ? 1.6 : 1.3), s: L.landscape ? 0.8 : 0.62 };
  return L.fin;
}

function choicePositions(n, centered = false) {
  if (L.landscape) {
    const span = L.right - L.left;
    const r = Math.min(centered ? 1.7 : 1.35, span / (n * 2.45));
    const gap = span / n;
    const y = centered ? (L.top + L.bottom) / 2 - 0.3 : L.bottom + r + 0.8;
    return { r, pts: Array.from({ length: n }, (_, i) => ({ x: L.left + gap * (i + 0.5), y })), top: y + r + 0.35 };
  }
  const cols = n <= 3 ? n : Math.ceil(n / 2);
  const rows = Math.ceil(n / cols);
  const span = L.W - 0.8;
  const r = Math.min(centered ? 1.9 : 1.6, span / (cols * 2.35));
  const gx = span / cols;
  const gy = 2 * r + 0.35;
  const y0 = centered ? Math.max(L.finTop + r + 0.25, (L.top + L.finTop) / 2 - ((rows - 1) * gy) / 2) : L.finTop + r + 0.25;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols);
    const inRow = row === rows - 1 ? n - row * cols : cols;
    const col = i - row * cols;
    pts.push({ x: (col - (inRow - 1) / 2) * gx, y: y0 + (rows - 1 - row) * gy });
  }
  return { r, pts, top: y0 + (rows - 1) * gy + r + 0.35 };
}

function displayRegion(top) {
  if (L.landscape) return { x: (L.left + L.right) / 2, y: (L.top + top) / 2, w: L.right - L.left, h: L.top - top };
  return { x: 0, y: (L.top + top) / 2, w: L.W - 0.8, h: L.top - top };
}

function regionForRound(r) {
  const n = r.mode === 'choose' ? r.choices.length : r.mode === 'popCount' ? r.bubbles : 0;
  const cp = n ? choicePositions(n, !r.display) : null;
  const top = cp ? cp.top : L.landscape ? L.bottom + 1.2 : L.finTop + 0.3;
  return { cp, region: displayRegion(top) };
}

// ---------------------------------------------------------------- display
function buildDisplay(d, region, accent) {
  const g = new THREE.Group();
  const disp = { group: g, items: [], anim: [], slots: [], disposables: [], card: null, w: 1, h: 1, region };
  display = disp;
  scene.add(g);
  if (!d) return disp;
  const SP = 1.4, CS = 0.55;

  const addCritters = (kind, n, cx, maxCols, colorIdx = 0) => {
    const cols = Math.min(n, maxCols);
    const rows = Math.ceil(n / cols);
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / cols);
      const inRow = row === rows - 1 ? n - row * cols : cols;
      const col = i - row * cols;
      const c = makeCritter(kind, i + colorIdx);
      c.scale.setScalar(CS);
      c.position.set(cx + (col - (inRow - 1) / 2) * SP, ((rows - 1) / 2 - row) * SP * 0.92, 0);
      c.userData.home = c.position.clone();
      c.userData.baseScale = CS;
      const hit = new THREE.Mesh(GEO.sphereLo, hitMat);
      hit.visible = false;
      hit.scale.setScalar(1.25);
      c.add(hit);
      g.add(c);
      disp.items.push(c);
      disp.anim.push(c);
    }
    return { w: cols * SP, h: rows * SP * 0.92 };
  };

  if (d.type === 'critters' || d.type === 'takeaway') {
    const maxCols = d.n <= 5 ? d.n : Math.ceil(d.n / 2);
    const s = addCritters(d.kind, d.n, 0, maxCols);
    disp.w = s.w;
    disp.h = s.h;
  } else if (d.type === 'sum') {
    const wA = Math.min(d.a, 3) * SP, wB = Math.min(d.b, 3) * SP, gap = 1.5;
    const total = wA + gap + wB;
    const a = addCritters(d.kind, d.a, -total / 2 + wA / 2, 3, 0);
    const plusTex = labelTexture('+', { stroke: '#24427a' });
    const plusMat = new THREE.MeshBasicMaterial({ map: plusTex, transparent: true, depthWrite: false });
    const plusGeo = new THREE.PlaneGeometry(1.4, 1.4);
    const plus = new THREE.Mesh(plusGeo, plusMat);
    plus.position.x = -total / 2 + wA + gap / 2;
    plus.userData.baseScale = 1;
    g.add(plus);
    disp.anim.splice(d.a, 0, plus);
    disp.disposables.push(plusTex, plusMat, plusGeo);
    const b = addCritters(d.kind, d.b, total / 2 - wB / 2, 3, 3);
    disp.w = total;
    disp.h = Math.max(a.h, b.h);
  } else if (d.type === 'card') {
    const wide = d.wide || (d.text && d.text.length > 2 && !d.emoji);
    const tw = wide ? 768 : 512;
    const tex = cardTexture({ emoji: d.emoji, text: d.text, accent, w: tw, h: 512 });
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false });
    const geo = new THREE.PlaneGeometry((3.4 * tw) / 512, 3.4);
    const card = new THREE.Mesh(geo, mat);
    card.userData.baseScale = 1;
    g.add(card);
    disp.card = card;
    disp.anim.push(card);
    disp.disposables.push(tex, mat, geo);
    disp.w = (3.4 * tw) / 512;
    disp.h = 3.4;
  } else if (d.type === 'slots') {
    const geo = new THREE.PlaneGeometry(1.15, 1.15);
    disp.disposables.push(geo);
    for (let i = 0; i < d.n; i++) {
      const tex = slotTexture(i + 1, false);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
      const m = new THREE.Mesh(geo, mat);
      m.position.x = (i - (d.n - 1) / 2) * 1.45;
      m.userData.baseScale = 1;
      g.add(m);
      disp.slots.push(m);
      disp.anim.push(m);
      disp.disposables.push(tex, mat);
    }
    disp.w = d.n * 1.45;
    disp.h = 1.4;
  }
  fitDisplay(disp, region);
  return disp;
}

function fitDisplay(disp, region) {
  disp.region = region;
  const s = Math.min(1.6, region.w / (disp.w + 0.4), region.h / (disp.h + 0.3));
  disp.group.scale.setScalar(Math.max(0.3, s));
  disp.group.position.set(region.x, region.y, 0);
}

async function introDisplay() {
  if (!display) return;
  const items = display.anim;
  items.forEach((o) => o.scale.setScalar(0.001));
  const ps = items.map((o, i) => {
    setTimeout(() => sfx.blip(i), i * 110);
    return tween({ duration: 0.55, delay: i * 0.11, ease: Ease.outBack, target: o, onUpdate: (v) => o.scale.setScalar(Math.max(0.001, o.userData.baseScale * v)) });
  });
  await Promise.all(ps);
}

function disposeDisplay(d) {
  d.group.traverse((o) => killTweens(o));
  scene.remove(d.group);
  d.disposables.forEach((x) => x.dispose());
}

async function clearRound(immediate = false) {
  accepting = false;
  clearTimeout(hintTimer);
  const old = bubbles;
  bubbles = [];
  old.forEach((b) => {
    if (immediate) disposeBubble(b);
    else if (b.alive) b.floatAway().then(() => disposeBubble(b));
    else setTimeout(() => disposeBubble(b), 700);
  });
  const d = display;
  display = null;
  if (!d) return;
  if (immediate) return disposeDisplay(d);
  const s0 = d.group.scale.x;
  await tween({ duration: 0.3, ease: Ease.inBack, target: d.group, onUpdate: (v) => d.group.scale.setScalar(Math.max(0.001, s0 * (1 - v))) });
  disposeDisplay(d);
}

function disposeBubble(b) {
  b.dispose();
  allBubbles.delete(b);
}

// ---------------------------------------------------------------- effects
function floatText(text, pos, color = '#ffb347', size = 1.6) {
  const tex = labelTexture(text, { stroke: shade(color, -0.3) });
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false });
  const sp = new THREE.Sprite(mat);
  sp.renderOrder = 30;
  sp.position.copy(pos);
  scene.add(sp);
  tween({
    duration: 1.1,
    ease: Ease.linear,
    onUpdate: (v) => {
      const k = Ease.outBack(Math.min(1, v * 3));
      sp.scale.setScalar(size * k);
      sp.position.y = pos.y + Ease.outCubic(v) * 1.4;
      mat.opacity = v > 0.65 ? 1 - (v - 0.65) / 0.35 : 1;
    },
  }).then(() => {
    scene.remove(sp);
    tex.dispose();
    mat.dispose();
  });
}

function worldPosOf(obj) {
  return obj.getWorldPosition(new THREE.Vector3());
}

// ---------------------------------------------------------------- flow
async function startStage(wi, si) {
  token++;
  const tok = token;
  audio.stopSpeaking();
  await clearRound(true);
  state = 'play';
  currentWorld = wi;
  S = { world: wi, stage: si, round: 0, mistakes: 0, wrong: 0, count: 0, deck: WORLDS[wi].stages[si].deck(), r: null };
  ui.setPips(0);
  ui.setPrompt(WORLDS[wi].stages[si].name);
  ui.show('hud');
  fin.turn = 0.5;
  fin.moveTo(finSpot('play'));
  await wait(0.6);
  playRound(tok);
}

async function playRound(tok) {
  if (tok !== token) return;
  const W = WORLDS[S.world];
  const st = W.stages[S.stage];
  if (S.round >= ROUNDS) return completeStage(tok);
  const r = st.make(S.deck[S.round], S.round);
  S.r = r;
  S.wrong = 0;
  S.count = 0;
  await clearRound();
  if (tok !== token) return;
  ui.setPrompt(r.text);
  const { cp, region } = regionForRound(r);
  buildDisplay(r.display, region, W.color);
  fin.lookAt(new THREE.Vector3(region.x, region.y, 0));
  await introDisplay();
  if (tok !== token) return;

  if (r.intro && r.display?.type === 'takeaway') {
    await say(r.intro[0]);
    if (tok !== token) return;
    const k = r.display.k;
    const leaving = display.items.slice(-k);
    display.items = display.items.slice(0, display.items.length - k);
    sfx.swoosh();
    await Promise.all([
      say(r.intro[1]),
      ...leaving.map((c, i) =>
        tween({
          duration: 1.4,
          delay: i * 0.2,
          ease: Ease.inCubic,
          target: c,
          onUpdate: (v) => {
            c.position.x = c.userData.home.x + v * 14;
            c.position.y = c.userData.home.y + Math.sin(v * 8) * 0.3;
          },
        }).then(() => (c.visible = false))
      ),
    ]);
    if (tok !== token) return;
  }

  if (cp) {
    const choices = r.mode === 'popCount' ? Array.from({ length: r.bubbles }, () => ({ pop: true })) : r.choices;
    const colors = shuffle(PALETTE);
    choices.forEach((c, i) => {
      const b = new ChoiceBubble(c, cp.r, colors[i % colors.length]);
      b.setBase(cp.pts[i].x, cp.pts[i].y);
      scene.add(b.group);
      bubbles.push(b);
      allBubbles.add(b);
      b.update(0);
      b.spawn(i * 0.12, -(L.H * 0.7));
      setTimeout(() => sfx.blip(i + 2), i * 120 + 200);
    });
  }
  accepting = true;
  say(r.prompt);
  armHint(tok);
}

function armHint(tok) {
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => {
    if (tok !== token || !accepting) return;
    showHint();
    say(S.r.prompt);
    armHint(tok);
  }, 11000);
}

function showHint() {
  const r = S.r;
  if (!r) return;
  if (r.mode === 'choose') {
    const b = bubbles.find((b) => b.alive && b.choice.correct);
    if (b) {
      b.setHint(true);
      fin.lookAt(b.worldPos);
    }
  } else if (r.mode === 'tapCount' && display) {
    const c = display.items.find((c) => !c.userData.counted);
    if (c) hop(c, 0.6);
  } else {
    bubbles.filter((b) => b.alive).forEach((b) => b.setHint(true));
  }
}

function hop(obj, h = 0.8) {
  const y0 = obj.userData.home ? obj.userData.home.y : obj.position.y;
  const s0 = obj.userData.baseScale || obj.scale.x;
  return tween({
    duration: 0.55,
    ease: Ease.linear,
    target: obj,
    onUpdate: (v) => {
      obj.position.y = y0 + Math.sin(v * Math.PI) * h;
      const sq = Math.sin(v * Math.PI * 2) * 0.12;
      obj.scale.set(s0 * (1 - sq), s0 * (1 + sq), s0);
    },
  });
}

async function onBubble(b) {
  const tok = token;
  const r = S.r;
  fin.lookAt(b.worldPos);
  if (r.mode === 'popCount') {
    b.pop();
    fx.pop(b.worldPos, b.color, b.r);
    sfx.pop();
    bubbles.forEach((x) => x.hint && x.setHint(false));
    S.count++;
    const n = S.count;
    const slot = display?.slots[n - 1];
    if (slot) {
      slot.material.map.dispose();
      slot.material.map = slotTexture(n, true, b.color);
      display.disposables.push(slot.material.map);
      hop(slot, 0.3);
      fx.sparkle(worldPosOf(slot), 10);
    }
    floatText(String(n), b.worldPos, b.color);
    setTimeout(() => sfx.count(n), 120);
    if (n >= r.target) {
      accepting = false;
      clearTimeout(hintTimer);
      await wait(0.3);
      bubbles.filter((x) => x.alive).forEach((x) => x.floatAway());
      return roundSuccess(tok, b.worldPos, `${cap(NUM_WORDS[n])}! `);
    }
    say(cap(NUM_WORDS[n]));
    armHint(tok);
    return;
  }

  if (b.choice.correct) {
    accepting = false;
    clearTimeout(hintTimer);
    b.pop();
    fx.pop(b.worldPos, b.color, b.r);
    sfx.pop();
    const others = bubbles.filter((x) => x !== b && x.alive);
    setTimeout(() => others.forEach((x) => x.floatAway()), 250);
    return roundSuccess(tok, b.worldPos);
  }

  S.mistakes++;
  S.wrong++;
  b.wobble();
  sfx.wrong();
  fin.oops();
  say(r.wrong ? r.wrong(b.choice) : `That's ${b.choice.say}. ${r.prompt}`);
  if (S.wrong >= 2) showHint();
  armHint(tok);
}

async function onCritter(c) {
  if (c.userData.counted) {
    hop(c, 0.3);
    return;
  }
  const tok = token;
  c.userData.counted = true;
  S.count++;
  const n = S.count;
  hop(c, 0.8);
  const tex = labelTexture(String(n), { stroke: '#c0521a' });
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const badge = new THREE.Sprite(mat);
  badge.position.copy(c.userData.home).add(new THREE.Vector3(0, 1.0, 0.4));
  badge.renderOrder = 25;
  display.group.add(badge);
  display.disposables.push(tex, mat);
  tween({ duration: 0.5, ease: Ease.outBack, onUpdate: (v) => badge.scale.setScalar(0.001 + v * 1.1) });
  sfx.count(n);
  fx.sparkle(worldPosOf(c), 12);
  fin.lookAt(worldPosOf(c));
  if (n >= S.r.target) {
    accepting = false;
    clearTimeout(hintTimer);
    await wait(0.45);
    if (tok !== token || !display) return;
    display.items.forEach((it, i) => setTimeout(() => hop(it, 0.6), i * 90));
    return roundSuccess(tok, new THREE.Vector3(display.region.x, display.region.y, 0), `${cap(NUM_WORDS[n])}! `);
  }
  say(cap(NUM_WORDS[n]));
  armHint(tok);
}

async function roundSuccess(tok, pos, lead = '') {
  sfx.correct();
  fin.happy();
  fx.burst(pos, 46);
  fx.sparkle(pos, 14);
  S.round++;
  ui.setPips(S.round);
  await say(`${lead}${S.r.success} ${pick(PRAISE)}`);
  if (tok !== token) return;
  await wait(0.35);
  playRound(tok);
}

async function completeStage(tok) {
  state = 'complete';
  await clearRound();
  if (tok !== token) return;
  const W = WORLDS[S.world];
  const st = W.stages[S.stage];
  const stars = S.mistakes <= 1 ? 3 : S.mistakes <= 4 ? 2 : 1;
  recordStars(progress, W.id, S.stage, stars);
  const hasNext = S.stage < W.stages.length - 1;
  ui.showComplete({ stars, text: hasNext ? `You finished “${st.name}”!` : `You finished all of ${W.name}!`, hasNext });
  fin.moveTo(finSpot('menu'));
  sfx.win();
  fx.rain(L.W, L.H, 160);
  [0, 400, 800].forEach((d, i) => setTimeout(() => tok === token && fx.burst(new THREE.Vector3((i - 1) * L.W * 0.3, -L.H * 0.3, 1), 50, { speed: 9 }), d));
  fin.dance();
  say(hasNext ? 'Hooray! You did it! Ready for the next one?' : `Wow! You finished all of ${W.name}! You are a superstar!`);
}

function leavePlay() {
  token++;
  accepting = false;
  clearTimeout(hintTimer);
  audio.stopSpeaking();
  clearRound();
  fin.lookAt(null);
}

function goTitle() {
  leavePlay();
  state = 'title';
  ui.show('title');
  fin.turn = 0.25;
  fin.moveTo(finSpot('title'));
}

function goWorlds(greet = false) {
  leavePlay();
  state = 'worlds';
  ui.renderWorlds(WORLDS, progress);
  ui.show('worlds');
  fin.turn = 0.5;
  fin.moveTo(finSpot('menu'));
  say(greet ? "Hi! I'm Finn! Where shall we swim today?" : 'Where shall we swim?');
}

function goStages(i) {
  leavePlay();
  currentWorld = i;
  state = 'stages';
  ui.renderStages(WORLDS[i], progress);
  ui.show('stages');
  fin.moveTo(finSpot('menu'));
  say(`${WORLDS[i].name}! Pick a bubble!`);
}

const ui = new UI({
  play: () => {
    audio.unlock();
    audio.startMusic();
    sfx.tap();
    goWorlds(true);
  },
  nav: (to) => {
    sfx.tap();
    if (to === 'title') goTitle();
    else goWorlds();
  },
  world: (i) => {
    sfx.tap();
    goStages(i);
  },
  stage: (i, unlocked) => {
    if (!unlocked) {
      sfx.wrong();
      fin.oops();
      say("That one is still locked. Let's play the shiny one first!");
      return;
    }
    sfx.tap();
    startStage(currentWorld, i);
  },
  home: () => {
    sfx.tap();
    goStages(currentWorld);
  },
  replay: () => {
    if (state === 'play' && S.r) {
      say(S.r.prompt);
      armHint(token);
    }
  },
  complete: (act) => {
    sfx.tap();
    if (act === 'replay') startStage(S.world, S.stage);
    else if (act === 'next') startStage(S.world, S.stage + 1);
    else goStages(S.world);
  },
  toggle: (k) => {
    audio.unlock();
    if (k === 'sound') audio.setSound(!audio.isSoundOn());
    if (k === 'music') audio.setMusic(!audio.isMusicOn());
    if (k === 'full') {
      if (document.fullscreenElement) document.exitFullscreen?.();
      else document.documentElement.requestFullscreen?.().catch(() => {});
    }
    ui.setToggles({ sound: audio.isSoundOn(), music: audio.isMusicOn() });
    sfx.tap();
  },
});
ui.setToggles({ sound: audio.isSoundOn(), music: audio.isMusicOn() });

// ---------------------------------------------------------------- input
function setRay(e) {
  const rect = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
}

function critterHit() {
  if (!(state === 'play' && accepting && S.r?.mode === 'tapCount' && display)) return null;
  const h = raycaster.intersectObjects(display.items, true)[0];
  if (!h) return null;
  let o = h.object;
  while (o && !o.userData.critter) o = o.parent;
  return o;
}

function bubbleHit() {
  if (!(state === 'play' && accepting)) return null;
  const live = bubbles.filter((b) => b.alive);
  const h = raycaster.intersectObjects(live.map((b) => b.sphere), false)[0];
  return h ? h.object.userData.bubble : null;
}

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  setRay(e);
  const b = bubbleHit();
  if (b) return onBubble(b);
  const c = critterHit();
  if (c) return onCritter(c);
  if (raycaster.intersectObject(fin.hitMesh, false).length) {
    fin.happy();
    sfx.giggle();
    fx.sparkle(worldPosOf(fin.root).add(new THREE.Vector3(0, 1, 1)), 10);
    if (state !== 'play') say(pick(["Hi! I'm Finn!", 'Tee hee! That tickles!', "Let's play!", 'Blub blub!', 'Wheee!']));
    return;
  }
  const p = world.popAmbient(raycaster);
  if (p) {
    fx.pop(p, '#ffffff', 0.15);
    sfx.smallPop();
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return;
  setRay(e);
  const over = !!(bubbleHit() || critterHit() || raycaster.intersectObject(fin.hitMesh, false).length);
  document.body.classList.toggle('pointer', over);
});

// ---------------------------------------------------------------- resize
function relayout() {
  computeLayout();
  if (state === 'title') fin.place(finSpot('title'));
  else if (state === 'play') fin.place(finSpot('play'));
  else fin.place(finSpot('menu'));
  if (state === 'play' && S.r) {
    const { cp, region } = regionForRound(S.r);
    if (cp && bubbles.length === cp.pts.length) bubbles.forEach((b, i) => b.setBase(cp.pts[i].x, cp.pts[i].y));
    if (display) fitDisplay(display, region);
  }
}
window.addEventListener('resize', relayout);
document.addEventListener('visibilitychange', () => document.hidden && audio.stopSpeaking());

// ---------------------------------------------------------------- loop
let last = performance.now();
let time = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  time += dt;
  updateTweens(dt);
  world.update(time, dt);
  fin.update(dt);
  for (const b of allBubbles) b.update(time);
  if (display) {
    for (const c of display.items) c.userData.update?.(time);
    if (display.card) {
      display.card.rotation.z = Math.sin(time * 1.1) * 0.04;
      display.card.position.y = Math.sin(time * 1.4) * 0.08;
    }
  }
  fx.update(dt);
  renderer.clear();
  renderer.render(world.scene, camera);
  renderer.clearDepth();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

async function boot() {
  computeLayout();
  fin.place({ x: 0, y: -12, s: 1.5 });
  requestAnimationFrame(frame);
  try {
    await Promise.race([document.fonts.load('800 100px "Baloo 2"'), wait(2.5)]);
  } catch {}
  state = 'title';
  ui.show('title');
  fin.turn = 0.25;
  fin.moveTo(finSpot('title'), 1.4);
}
boot();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

window.bebefin = { startStage, goWorlds, goStages, goTitle, state: () => ({ state, S, accepting, bubbles: bubbles.map((b) => ({ choice: b.choice, pos: b.worldPos })) }), camera, onBubble: (i) => onBubble(bubbles[i]), bubbles: () => bubbles, display: () => display, onCritter };
