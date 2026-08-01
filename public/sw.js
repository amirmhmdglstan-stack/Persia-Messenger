// Persia Messenger — Service Worker (basic offline/app-shell cache)
const CACHE = 'persia-v1';
const ASSETS = ['/', '/index.html', '/style.css', '/app.js', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
    e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
    const url = e.request.url;
    // Network-first for dynamic/API + socket, cache fallback for static app shell
    if (url.includes('/socket.io/') || url.includes('/api/') || url.includes('/uploads/')) return;
    e.respondWith(
        fetch(e.request)
            .then(res => {
                const copy = res.clone();
                caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
                return res;
            })
            .catch(() => caches.match(e.request).then(r => r || caches.match('/')))
    );
});
