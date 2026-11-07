const CACHE = 'bebefinn-v2';
const ASSETS = ['./', 'index.html', 'styles.css', 'manifest.webmanifest', 'vendor/three.module.js', 'fonts/baloo2-latin.woff2', 'src/audio.js', 'src/bubble.js', 'src/critters.js', 'src/fin.js', 'src/levels.js', 'src/main.js', 'src/materials.js', 'src/particles.js', 'src/progress.js', 'src/textures.js', 'src/tween.js', 'src/ui.js', 'src/world.js', 'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }))
  );
});
