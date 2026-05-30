// Service Worker - network-first so new commits reach devices as soon as
// they are online, while still working offline from the last good copy.
const CACHE_NAME = 'dikgomo-v3';
const CORE = ['./', './index.html', './manifest.json', './supabase-data.js', './owner-ui.js'];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) =>
            // add each file on its own so one missing file can't fail the install
            Promise.all(CORE.map((u) => cache.add(u).catch(() => null)))
        )
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((names) => Promise.all(names.map((n) => (n !== CACHE_NAME ? caches.delete(n) : null))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);
    // Let cross-origin requests (CDNs, Supabase, EmailJS) go straight to the network.
    if (url.origin !== self.location.origin) return;

    // Network-first: always try to fetch the freshest file; fall back to cache offline.
    event.respondWith(
        fetch(req)
            .then((res) => {
                if (res && res.status === 200 && res.type === 'basic') {
                    const copy = res.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
                }
                return res;
            })
            .catch(() =>
                caches.match(req).then((hit) => hit || caches.match('./index.html'))
            )
    );
});

// Background sync hook (used by the app to trigger a sync when back online)
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-attendance') {
        event.waitUntil((async () => {
            const clients = await self.clients.matchAll();
            clients.forEach((client) => client.postMessage({ type: 'SYNC_REQUEST' }));
        })());
    }
});
