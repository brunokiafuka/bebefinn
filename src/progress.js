const KEY = 'bebefin-progress-v1';

export function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

export function saveProgress(p) {
  localStorage.setItem(KEY, JSON.stringify(p));
}

export function starsFor(p, worldId, count) {
  const arr = p[worldId] || [];
  return Array.from({ length: count }, (_, i) => arr[i] || 0);
}

export function recordStars(p, worldId, stage, stars) {
  const arr = (p[worldId] = p[worldId] || []);
  arr[stage] = Math.max(arr[stage] || 0, stars);
  saveProgress(p);
}

export function isUnlocked(p, worldId, stage) {
  if (stage === 0) return true;
  return (p[worldId]?.[stage - 1] || 0) > 0;
}
