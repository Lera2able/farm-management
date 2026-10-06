// Service Worker - cache-first (stale-while-revalidate): the app opens
// instantly from the last good copy no matter how bad the signal is, and
// updates itself in the background whenever there is a connection.
// v15: permanent fix for 'app not working offline / on weak signal'.
const CACHE_NAME = 'dikgomo-v15';
const CORE = [
  './',
  './index.html',
  './app.html',
  './admin.html',
  './manifest.json',
  './db.js',
  './sync.js',
  './supabase-data.js',
  './owner-ui.js',
  './app.js',
  './livestock-data.js',
  './styles.css',
  './master_stock.xlsx',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-192.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
  './assets/goats.jpeg',
  './assets/sheep.jpeg',
];
const EXTERNAL = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js',
  'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js',
  'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js',
];

// CDN origins we trust for offline caching. Anything fetched from these is
// stored on first use, so libraries that pull in extra files at runtime
// (e.g. Tesseract's worker/wasm/language data) also work offline afterwards.
const CACHEABLE_CDN_HOSTS = [
  'cdn.jsdelivr.net',
  'unpkg.com',
  'tessdata.projectnaptha.com',
];

function precacheAll(cache) {
    // add each file on its own so one missing file can't fail the rest
    return Promise.all(CORE.concat(EXTERNAL).map((u) => cache.add(u).catch(() => null)));
}

// Fetch fresh copy and update the cache; never throws (null on failure).
function revalidate(req) {
    return fetch(req).then((res) => {
        if (res && res.status === 200 && (res.type === 'basic' || res.type === 'default')) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return res;
    }).catch(() => null);
}

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(caches.open(CACHE_NAME).then(precacheAll));
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((names) => Promise.all(names.map((n) => (n !== CACHE_NAME ? caches.delete(n) : null))))
            // self-heal: top up any core files a previous broken cache missed
            .then(() => caches.open(CACHE_NAME).then(precacheAll))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);
    const isExternalAsset = EXTERNAL.indexOf(url.href) >= 0;
    const isCacheableCdn = CACHEABLE_CDN_HOSTS.indexOf(url.host) >= 0;

    if (isExternalAsset || isCacheableCdn) {
        // Cache-first for library/CDN files: use the stored copy (works
        // offline), otherwise fetch and store it for next time.
        event.respondWith(
            caches.match(req).then((hit) =>
                hit || fetch(req).then((res) => {
                    if (res && (res.status === 200 || res.type === 'opaque')) {
                        const copy = res.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
                    }
                    return res;
                })
            )
        );
        return;
    }

    // Let other cross-origin requests (Supabase APIs, email, etc.) go straight to the network.
    if (url.origin !== self.location.origin) return;

    // Cache-first for our own files: instant response from the last good
    // copy (offline or weak signal), background update when online.
    event.respondWith(
        caches.match(req).then((hit) => {
            const net = revalidate(req);
            if (hit) {
                event.waitUntil(net);
                return hit;
            }
            // nothing cached yet - must go to the network
            return net.then((res) => {
                if (res) return res;
                // offline and uncached: for a page load, serve the register or home page
                if (req.mode === 'navigate') {
                    return caches.match('./app.html').then((a) => a || caches.match('./index.html'));
                }
                return new Response('Offline and file not cached', { status: 504 });
            });
        })
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
