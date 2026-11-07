import { KINDS } from './critters.js';

export const ROUNDS = 5;
export const NUM_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const cap = (s) => s[0].toUpperCase() + s.slice(1);

export const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

function deck(pool, n = ROUNDS) {
  const out = [];
  while (out.length < n) {
    for (const v of shuffle(pool)) {
      if (out.length >= n) break;
      if (out.length && JSON.stringify(out[out.length - 1]) === JSON.stringify(v)) out.splice(out.length - 1, 0, v);
      else out.push(v);
    }
  }
  return out;
}

function options(correct, pool, n) {
  const others = shuffle(pool.filter((x) => x !== correct)).slice(0, n - 1);
  return shuffle([correct, ...others]);
}

const randomKind = () => pick(Object.keys(KINDS));
const kindName = (k, n = 2) => (n === 1 ? KINDS[k].one || KINDS[k].name : KINDS[k].name);
const an = (w) => (/^[aeiou]/i.test(w) ? 'an' : 'a');
const PLURALS = new Set(['grapes']);
const does = (w) => (PLURALS.has(w) ? 'do' : 'does');
const starts = (w) => (PLURALS.has(w) ? 'start' : 'starts');

// ---------- content ----------
export const LETTERS = {
  A: ['apple', '🍎'], B: ['bee', '🐝'], C: ['cat', '🐱'], D: ['dog', '🐶'], E: ['egg', '🥚'],
  F: ['fish', '🐟'], G: ['grapes', '🍇'], H: ['house', '🏠'], I: ['ice cream', '🍦'], J: ['juice', '🧃'],
  K: ['kite', '🪁'], L: ['lion', '🦁'], M: ['moon', '🌙'], N: ['nose', '👃'], O: ['owl', '🦉'],
  P: ['pig', '🐷'], Q: ['queen', '👸'], R: ['rainbow', '🌈'], S: ['sun', '🌞'], T: ['tree', '🌳'],
  U: ['umbrella', '☂️'], V: ['violin', '🎻'], W: ['whale', '🐳'], X: ['x-ray fish', '🐠'], Y: ['yo-yo', '🪀'], Z: ['zebra', '🦓'],
};
const ALPHA = Object.keys(LETTERS);

const WORDS3 = [
  ['cat', '🐱'], ['dog', '🐶'], ['sun', '🌞'], ['bus', '🚌'], ['pig', '🐷'], ['cow', '🐮'], ['bee', '🐝'], ['egg', '🥚'],
  ['fox', '🦊'], ['owl', '🦉'], ['car', '🚗'], ['hat', '👒'], ['cup', '🥤'], ['ant', '🐜'], ['bat', '🦇'], ['bed', '🛏️'],
];
const WORDS4 = [['fish', '🐟'], ['duck', '🦆'], ['ball', '⚽'], ['moon', '🌙'], ['star', '⭐'], ['tree', '🌳'], ['cake', '🎂'], ['frog', '🐸']];
const spell = (w) => w.toUpperCase().split('').join(', ') + '. ' + cap(w) + '!';

// ---------- round builders ----------
function findNumber(n, pool, count) {
  return {
    mode: 'choose',
    prompt: `Find the number ${NUM_WORDS[n]}!`,
    text: `Find ${n}`,
    display: null,
    choices: options(n, pool, count).map((k) => ({ text: String(k), say: NUM_WORDS[k], correct: k === n })),
    success: `${cap(NUM_WORDS[n])}!`,
  };
}

function howMany(n, pool, count) {
  const kind = randomKind();
  return {
    mode: 'choose',
    prompt: `How many ${kindName(kind)}? Let's count!`,
    text: `How many?`,
    display: { type: 'critters', kind, n },
    choices: options(n, pool, count).map((k) => ({ text: String(k), say: NUM_WORDS[k], correct: k === n })),
    wrong: () => `Hmm, let's count again!`,
    success: `${cap(NUM_WORDS[n])} ${kindName(kind, n)}!`,
  };
}

function findLetter(L, pool, count) {
  const [word, emoji] = LETTERS[L];
  return {
    mode: 'choose',
    prompt: `Find the letter ${L}!`,
    text: `Find ${L}`,
    display: { type: 'card', emoji },
    choices: options(L, pool, count).map((k) => ({ text: k, say: k, correct: k === L })),
    wrong: (c) => [`That's ${c.say}.`, `Find ${L}!`],
    success: `${L}! ${L} is for ${word}!`,
  };
}

function wordToPicture([w, e], pool, count) {
  const opts = options(w, pool.map((p) => p[0]), count);
  return {
    mode: 'choose',
    prompt: `This word says ${w}. Find the ${w}!`,
    text: `Find the ${w}`,
    display: { type: 'card', text: w, wide: true },
    choices: opts.map((k) => ({ emoji: pool.find((p) => p[0] === k)[1], say: k, correct: k === w })),
    wrong: (c) => [`That's ${an(c.say)} ${c.say}.`, `Find the ${w}!`],
    success: spell(w),
  };
}

function pictureToWord([w, e], pool, count) {
  const opts = options(w, pool.map((p) => p[0]), count);
  return {
    mode: 'choose',
    prompt: `Which word says ${w}?`,
    text: `Which word?`,
    display: { type: 'card', emoji: e },
    choices: opts.map((k) => ({ text: k, say: k, correct: k === w })),
    wrong: (c) => [`That word says ${c.say}.`, `Find the word ${w}!`],
    success: spell(w),
  };
}

// ---------- worlds ----------
export const WORLDS = [
  {
    id: 'numbers',
    name: 'Numbers',
    glyph: '123',
    color: '#ff6b8b',
    dark: '#d8466a',
    stages: [
      {
        name: 'Count with Finn',
        deck: () => deck([1, 2, 3, 2, 3]),
        make: (n) => {
          const kind = randomKind();
          return {
            mode: 'tapCount',
            target: n,
            prompt: `Let's count the ${kindName(kind)}! Tap each one.`,
            text: `Tap to count!`,
            display: { type: 'critters', kind, n },
            success: `${cap(NUM_WORDS[n])} ${kindName(kind, n)}!`,
          };
        },
      },
      { name: 'Find the number', deck: () => deck([1, 2, 3]), make: (n) => findNumber(n, [1, 2, 3], 2) },
      { name: 'Numbers to 5', deck: () => deck(range(1, 5)), make: (n) => findNumber(n, range(1, 5), 3) },
      { name: 'How many?', deck: () => deck(range(1, 5)), make: (n) => howMany(n, range(1, 5), 3) },
      {
        name: 'Up to ten',
        deck: () => shuffle([...shuffle(range(6, 10)).slice(0, 3).map((n) => ['find', n]), ...shuffle(range(3, 6)).slice(0, 2).map((n) => ['count', n])]),
        make: ([type, n]) => (type === 'find' ? findNumber(n, range(1, 10), 3) : howMany(n, range(2, 7), 3)),
      },
    ],
  },
  {
    id: 'maths',
    name: 'Counting',
    glyph: '1+1',
    color: '#ffb347',
    dark: '#d9861c',
    stages: [
      {
        name: 'Pop & count',
        deck: () => deck([1, 2, 3, 2, 4]),
        make: (n) => ({
          mode: 'popCount',
          target: n,
          bubbles: Math.min(6, n + 2),
          prompt: `Pop ${NUM_WORDS[n]} bubble${n > 1 ? 's' : ''}!`,
          text: `Pop ${n}`,
          display: { type: 'slots', n },
          success: `${cap(NUM_WORDS[n])} bubble${n > 1 ? 's' : ''}!`,
        }),
      },
      {
        name: 'Which has more?',
        deck: () => [0, 1, 2, 3, 4],
        make: (i) => {
          const minDiff = i < 3 ? 2 : 1;
          let a, b;
          do {
            a = rand(1, 5);
            b = rand(1, 5);
          } while (Math.abs(a - b) < minDiff);
          const kind = randomKind();
          const max = Math.max(a, b);
          return {
            mode: 'choose',
            prompt: `Which bubble has more ${kindName(kind)}?`,
            text: `Which has more?`,
            display: null,
            choices: [a, b].map((n) => ({ critters: { kind, n }, say: NUM_WORDS[n], n, correct: n === max })),
            wrong: (c) => [`That one has ${c.say} ${kindName(kind, c.n)}.`, `Find the bubble with more!`],
            success: `Yes! ${cap(NUM_WORDS[max])} is more than ${NUM_WORDS[Math.min(a, b)]}!`,
          };
        },
      },
      {
        name: 'One more',
        deck: () => deck([1, 2, 3]),
        make: (a) => sumRound(a, 1, 3),
      },
      {
        name: 'Adding up',
        deck: () => deck([[1, 2], [2, 2], [1, 3], [3, 2], [2, 1], [4, 1], [2, 3]]),
        make: ([a, b]) => sumRound(a, b, 3),
      },
      {
        name: 'Take away',
        deck: () => deck([[3, 1], [4, 2], [2, 1], [5, 2], [4, 1], [3, 2], [5, 1]]),
        make: ([n, k]) => {
          const kind = randomKind();
          const left = n - k;
          return {
            mode: 'choose',
            prompt: `How many ${kindName(kind, 2)} are left?`,
            text: `${n} − ${k} = ?`,
            display: { type: 'takeaway', kind, n, k },
            intro: [`There ${n === 1 ? 'is' : 'are'} ${NUM_WORDS[n]} ${kindName(kind, n)}.`, `Bye bye! ${cap(NUM_WORDS[k])} swim${k === 1 ? 's' : ''} away.`],
            choices: options(left, range(0, 5), 3).map((v) => ({ text: String(v), say: NUM_WORDS[v], correct: v === left })),
            wrong: () => `Let's count again!`,
            success: `${cap(NUM_WORDS[n])} take away ${NUM_WORDS[k]} is ${NUM_WORDS[left]}!`,
          };
        },
      },
    ],
  },
  {
    id: 'abc',
    name: 'ABC',
    glyph: 'ABC',
    color: '#5fbf4a',
    dark: '#3d9a2f',
    stages: [
      { name: 'A to E', deck: () => deck(ALPHA.slice(0, 5)), make: (L) => findLetter(L, ALPHA.slice(0, 5), 2) },
      { name: 'A to M', deck: () => deck(ALPHA.slice(0, 13)), make: (L) => findLetter(L, ALPHA.slice(0, 13), 3) },
      { name: 'All letters', deck: () => deck(ALPHA), make: (L) => findLetter(L, ALPHA, 3) },
      {
        name: 'Letter sounds',
        deck: () => deck(ALPHA.filter((l) => !'QUXYIEKVJ'.includes(l))),
        make: (L) => {
          const [word, emoji] = LETTERS[L];
          return {
            mode: 'choose',
            prompt: `${cap(word)}! Which letter ${does(word)} ${word} start with?`,
            text: `${cap(word)} ${starts(word)} with…`,
            display: { type: 'card', emoji, text: word },
            choices: options(L, ALPHA.filter((l) => !'QXY'.includes(l)), 3).map((k) => ({ text: k, say: k, correct: k === L })),
            wrong: (c) => [`That's ${c.say}.`, `${cap(word)} ${starts(word)} with…?`],
            success: `${L}! ${L} for ${word}!`,
          };
        },
      },
      {
        name: 'Little letters',
        deck: () => deck(ALPHA.slice(0, 12)),
        make: (L) => {
          const l = L.toLowerCase();
          return {
            mode: 'choose',
            prompt: `This is big ${L}. Find little ${l}!`,
            text: `Find little ${l}`,
            display: { type: 'card', text: L },
            choices: options(l, ALPHA.slice(0, 12).map((x) => x.toLowerCase()), 3).map((k) => ({ text: k, say: k, correct: k === l })),
            wrong: (c) => [`That's little ${c.say}.`, `Find little ${l}!`],
            success: `Big ${L}, little ${l}!`,
          };
        },
      },
    ],
  },
  {
    id: 'words',
    name: 'Words',
    glyph: 'cat',
    emoji: '🐱',
    color: '#4cb5f5',
    dark: '#2589cc',
    stages: [
      { name: 'Look & listen', deck: () => deck(WORDS3.slice(0, 8)), make: (w) => wordToPicture(w, WORDS3.slice(0, 8), 2) },
      { name: 'Picture words', deck: () => deck(WORDS3.slice(0, 8)), make: (w) => pictureToWord(w, WORDS3.slice(0, 8), 2) },
      { name: 'More words', deck: () => deck([...WORDS3, ...WORDS4]), make: (w) => wordToPicture(w, [...WORDS3, ...WORDS4], 3) },
      {
        name: 'Missing letter',
        deck: () => deck(WORDS3.slice(0, 12)),
        make: ([w, e]) => {
          const first = w[0];
          return {
            mode: 'choose',
            prompt: `${cap(w)}! Which letter is missing?`,
            text: `_${w.slice(1)}`,
            display: { type: 'card', emoji: e, text: `_${w.slice(1)}` },
            choices: options(first, 'bcdfhmpst'.split('').concat(first), 3).map((k) => ({ text: k, say: k, correct: k === first })),
            wrong: (c) => [`That's ${c.say.toUpperCase()}.`, `Not quite! Try again.`],
            success: spell(w),
          };
        },
      },
      { name: 'Word master', deck: () => deck([...WORDS3, ...WORDS4]), make: (w) => pictureToWord(w, [...WORDS3, ...WORDS4], 3) },
    ],
  },
];

function sumRound(a, b, count) {
  const kind = randomKind();
  const s = a + b;
  return {
    mode: 'choose',
    prompt: `${cap(NUM_WORDS[a])} ${kindName(kind, a)} and ${NUM_WORDS[b]} more. How many ${kindName(kind)} altogether?`,
    text: `${a} + ${b} = ?`,
    display: { type: 'sum', kind, a, b },
    choices: options(s, range(1, 6), count).map((v) => ({ text: String(v), say: NUM_WORDS[v], correct: v === s })),
    wrong: () => `Let's count them all together!`,
    success: `${cap(NUM_WORDS[a])} plus ${NUM_WORDS[b]} is ${NUM_WORDS[s]}!`,
  };
}
