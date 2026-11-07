import { doneFor, isUnlocked } from './progress.js';
import { ROUNDS, WORLDS } from './levels.js';

const STICKERS = ['🐙', '🐢', '🦀', '🐳', '🐬', '🦭', '🐡', '🦑', '🐚', '🦞', '🐋', '🦈', '🐠', '🦐', '🐧', '🦦', '🐊', '🐸', '🦆', '🦩'];
export const stickerFor = (world, stage) => STICKERS[(world * 5 + stage) % STICKERS.length];

const LOCK = `<svg viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="3"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" fill="none" stroke="#fff" stroke-width="2.6"/></svg>`;

const $ = (s, el = document) => el.querySelector(s);

export class UI {
  constructor(h) {
    this.h = h;
    this.current = 'loading';
    document.querySelectorAll('[data-nav]').forEach((b) =>
      b.addEventListener('click', () => h.nav(b.dataset.nav))
    );
    $('#play').addEventListener('click', () => h.play());
    $('#home').addEventListener('click', () => h.home());
    $('#prompt').addEventListener('click', () => h.replay());
    document.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => h.complete(b.dataset.act)));
    $('#t-sound').addEventListener('click', () => h.toggle('sound'));
    $('#t-music').addEventListener('click', () => h.toggle('music'));
    $('#t-full').addEventListener('click', () => h.toggle('full'));
    const standalone = matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || navigator.standalone;
    if (standalone || !document.documentElement.requestFullscreen) $('#t-full').style.display = 'none';
  }

  show(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id || (id === 'complete' && s.id === 'hud' && false)));
    this.current = id;
    $('.toggles').classList.toggle('hidden', !['title', 'worlds', 'stages'].includes(id));
    document.body.classList.toggle('playing', id === 'hud');
  }

  setToggles({ sound, music }) {
    $('#t-sound').classList.toggle('muted', !sound);
    $('#t-music').classList.toggle('muted', !music);
  }

  renderWorlds(worlds, progress) {
    const grid = $('.world-grid');
    grid.innerHTML = '';
    worlds.forEach((w, i) => {
      const done = doneFor(progress, w.id, w.stages.length);
      const b = document.createElement('button');
      b.className = 'world-card';
      b.style.setProperty('--c', w.color);
      b.style.setProperty('--d', w.dark);
      b.style.animationDelay = `${i * 0.08}s`;
      const deco = Array.from({ length: 3 }, (_, k) => {
        const s = 18 + k * 14;
        return `<span class="bubble-deco" style="width:${s}px;height:${s}px;right:${8 + k * 16}px;top:${10 + k * 26}px"></span>`;
      }).join('');
      b.innerHTML = `${deco}<div class="glyph">${w.emoji ? `<span>${w.glyph}<em>${w.emoji}</em></span>` : w.glyph}</div>
        <div class="name">${w.name}</div>
        <div class="score">${done.map((d, k) => `<span class="slot${d ? ' got' : ''}">${d ? stickerFor(i, k) : ''}</span>`).join('')}</div>`;
      b.addEventListener('click', () => this.h.world(i));
      grid.appendChild(b);
    });
  }

  renderStages(world, progress) {
    $('.stages-title').textContent = world.name;
    const path = $('.stage-path');
    path.innerHTML = '';
    const done = doneFor(progress, world.id, world.stages.length);
    const wi = WORLDS.indexOf(world);
    let nextMarked = false;
    world.stages.forEach((s, i) => {
      const unlocked = isUnlocked(progress, world.id, i);
      const b = document.createElement('button');
      b.className = 'stage-node';
      b.style.setProperty('--c', world.color);
      b.style.setProperty('--d', world.dark);
      b.style.animationDelay = `${i * 0.08}s`;
      if (!unlocked) {
        b.classList.add('locked');
        b.innerHTML = `${LOCK}<span class="label">${s.name}</span>`;
      } else {
        if (!nextMarked && !done[i]) {
          b.classList.add('next');
          nextMarked = true;
        }
        b.innerHTML = `${i + 1}${done[i] ? `<span class="badge">${stickerFor(wi, i)}</span>` : ''}<span class="label">${s.name}</span>`;
      }
      b.addEventListener('click', () => this.h.stage(i, unlocked));
      path.appendChild(b);
    });
  }

  setPrompt(text) {
    const p = $('#prompt');
    $('.prompt-text').textContent = text;
    p.classList.remove('bump');
    void p.offsetWidth;
    p.classList.add('bump');
  }

  setPips(done) {
    const el = $('.pips');
    if (el.children.length !== ROUNDS) el.innerHTML = '<i></i>'.repeat(ROUNDS);
    [...el.children].forEach((c, i) => c.classList.toggle('on', i < done));
  }

  showComplete({ sticker, text, hasNext }) {
    const el = $('#complete');
    $('.sticker span', el).textContent = sticker;
    $('.sub', el).textContent = text;
    $('[data-act="next"]', el).style.display = hasNext ? '' : 'none';
    this.show('complete');
  }
}
