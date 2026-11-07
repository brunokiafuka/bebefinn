const tweens = new Set();

export const Ease = {
  linear: (t) => t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inCubic: (t) => t * t * t,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  inBack: (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return c3 * t * t * t - c1 * t * t;
  },
  outElastic: (t) => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
  },
};

export function tween({ from = 0, to = 1, duration = 0.5, delay = 0, ease = Ease.outCubic, onUpdate, target } = {}) {
  return new Promise((resolve) => {
    tweens.add({ t: -delay, duration: Math.max(duration, 1e-4), from, to, ease, onUpdate, target, resolve });
  });
}

export function killTweens(target) {
  for (const tw of tweens) {
    if (tw.target === target) {
      tweens.delete(tw);
      tw.resolve();
    }
  }
}

export function updateTweens(dt) {
  for (const tw of tweens) {
    tw.t += dt;
    if (tw.t < 0) continue;
    const k = Math.min(tw.t / tw.duration, 1);
    tw.onUpdate?.(tw.from + (tw.to - tw.from) * tw.ease(k), k);
    if (k >= 1) {
      tweens.delete(tw);
      tw.resolve();
    }
  }
}

export const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));
