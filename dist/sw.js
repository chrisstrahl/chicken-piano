// Chicken Piano offline cache (see src/offline.js). build.mjs fills in the build stamp.
const BUILD = '2026-10-23 01:44 UTC';
const SHELL = `shell-${BUILD}`; // the page, manifest and icons of this build
const VOICE = 'voice-v1'; // clips are named by a hash of their sentence, so a clip never changes
const FONTS = 'fonts-v1';
const SHELL_FILES = ['./', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
const PAGE = new URL('./', self.registration.scope).href;
const PAGE_WAIT = 4000; // a slow network gets the saved page; the fresh one is saved for next time

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES.map((f) => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('shell-') && k !== SHELL) await caches.delete(k);
    await self.clients.claim();
  })());
});

const keep = (res) => res && (res.ok || res.type === 'opaque');
async function put(name, req, res) { if (keep(res)) await (await caches.open(name)).put(req, res.clone()); return res; }

// The page: network first, so a new build shows up right away; the saved copy when offline.
async function page() {
  const fresh = fetch(PAGE, { cache: 'no-cache' }).then((res) => put(SHELL, PAGE, res));
  const saved = () => caches.match(PAGE);
  const slow = new Promise((ok) => setTimeout(ok, PAGE_WAIT)).then(saved);
  try {
    const res = await Promise.race([fresh, slow]);
    if (keep(res)) return res;
  } catch (e) {}
  return (await saved()) || fresh;
}
async function cacheFirst(name, req) {
  const hit = await caches.match(req, { cacheName: name });
  return hit || put(name, req, await fetch(req));
}
async function staleWhileRevalidate(name, req) {
  const hit = await caches.match(req, { cacheName: name });
  const fresh = fetch(req).then((res) => put(name, req, res)).catch(() => hit);
  return hit || fresh;
}
async function networkFirst(name, req) {
  try { return await put(name, req, await fetch(req)); } catch (e) { return (await caches.match(req)) || Response.error(); }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate' && url.href.split(/[?#]/)[0].replace(/index\.html$/, '') === PAGE) return e.respondWith(page());
  if (url.origin === location.origin && /\/voice\/[0-9a-f]+\.mp3$/.test(url.pathname)) return e.respondWith(cacheFirst(VOICE, req));
  if (/^fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) return e.respondWith(staleWhileRevalidate(FONTS, req));
  if (url.origin === location.origin) e.respondWith(networkFirst(SHELL, req));
});

// Download every voice clip (about 12 MB) so the chicken can talk offline, and drop clips no longer used.
let filling = null;
async function fillVoice() {
  const list = await fetch(new URL('voice/manifest.json', self.registration.scope), { cache: 'no-cache' }).then((r) => r.json());
  const want = new Set(Object.keys(list).map((id) => new URL(`voice/${id}.mp3`, self.registration.scope).href));
  const cache = await caches.open(VOICE);
  const have = new Set();
  for (const req of await cache.keys()) { if (want.has(req.url)) have.add(req.url); else await cache.delete(req); }
  const missing = [...want].filter((u) => !have.has(u));
  const next = async () => {
    for (let u; (u = missing.shift());) { try { const res = await fetch(u); if (res.ok) await cache.put(u, res); } catch (e) {} }
  };
  await Promise.all([next(), next(), next(), next()]);
}
self.addEventListener('message', (e) => {
  if (e.data !== 'fill-voice') return;
  filling = filling || fillVoice().catch(() => {}).finally(() => { filling = null; });
  e.waitUntil(filling);
});
