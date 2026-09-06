/**
 * =============================================================================
 * SERVICE WORKER (SW.JS) - PWA SPK BANSOS PEMKAB SIDOARJO
 * Lokasi: frontend/sw.js
 * =============================================================================
 * Fitur:
 * 1. Resilient Pre-caching aset aplikasi & pustaka pihak ketiga (Leaflet, CDN)
 * 2. Multi-strategy caching (Network-First untuk HTML, Cache-First untuk aset)
 * 3. Bypassing ketat untuk API backend (/api/) dan file dinamis (/uploads/)
 * 4. Background Sync ('sync-survei-bansos') untuk survei lapangan luring
 * 5. Push Notifications & Notification Click Handler
 * =============================================================================
 */

const CACHE_VERSION = 'bansos-sidoarjo-pwa-v1';
const STATIC_CACHE_NAME = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE_NAME = `dynamic-${CACHE_VERSION}`;

// Daftar aset inti yang di-cache saat instalasi awal
const PRECACHE_ASSETS = [
    '/',
    '/index.html',
    '/login.html',
    '/publik.html',
    '/manifest.json',

    // Stylesheets
    '/static/css/style.css',
    '/static/css/login.css',
    '/static/css/admin.css',
    '/static/css/publik.css',

    // Core Scripts
    '/static/js/core/config.js',
    '/static/js/core/auth.js',
    '/static/js/core/api.js',
    '/static/js/global.js',

    // Page Controllers
    '/static/js/login.js',
    '/static/js/admin.js',
    '/static/js/publik.js',

    // Feature Modules
    '/static/js/modules/admin-map.js',
    '/static/js/modules/admin-spk.js',
    '/static/js/modules/admin-print.js',
    '/static/js/modules/admin-chat.js',

    // External Libraries (CDN)
    'https://cdn.jsdelivr.net/npm/sweetalert2@11',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap'
];

// =============================================================================
// 1. LIFECYCLE: INSTALL
// =============================================================================
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE_NAME).then(async (cache) => {
            // Resilient precaching: Kegagalan 1 file tidak membatalkan install seluruh SW
            const cachePromises = PRECACHE_ASSETS.map(async (asset) => {
                try {
                    const response = await fetch(asset, { cache: 'no-cache' });
                    if (response.ok) {
                        await cache.put(asset, response);
                    }
                } catch (err) {
                    console.warn(`[SW Install] Gagal meng-cache aset: ${asset}`, err);
                }
            });
            await Promise.all(cachePromises);
        })
    );
    self.skipWaiting();
});

// =============================================================================
// 2. LIFECYCLE: ACTIVATE (PEMBERSIHAN CACHE LAMA)
// =============================================================================
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== STATIC_CACHE_NAME && cacheName !== DYNAMIC_CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// =============================================================================
// 3. LIFECYCLE: FETCH (STRATEGI REQUEST & CACHING)
// =============================================================================
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);

    // 1. Abaikan metode selain GET (POST, PUT, DELETE, dll.)
    if (request.method !== 'GET') {
        return;
    }

    // 2. Bypass penuh untuk API Flask, endpoint autentikasi, dan media uploads dinamis
    if (
        url.pathname.startsWith('/api/') ||
        url.pathname.startsWith('/uploads/') ||
        url.pathname.includes('/login') ||
        url.pathname.includes('/init-kriteria') ||
        url.pathname.includes('/warga') ||
        url.pathname.includes('/hitung-saw') ||
        url.pathname.includes('/komparasi')
    ) {
        event.respondWith(
            fetch(request).catch(() => {
                return new Response(
                    JSON.stringify({
                        status: 'error',
                        offline: true,
                        message: 'Koneksi internet terputus. Data tidak dapat disinkronkan langsung ke peladen.'
                    }),
                    {
                        status: 503,
                        headers: { 'Content-Type': 'application/json' }
                    }
                );
            })
        );
        return;
    }

    // 3. Strategi Network-First untuk Navigasi Dokumen HTML
    if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
        event.respondWith(
            fetch(request)
                .then((networkResponse) => {
                    if (networkResponse.ok) {
                        const copy = networkResponse.clone();
                        caches.open(DYNAMIC_CACHE_NAME).then((cache) => cache.put(request, copy));
                    }
                    return networkResponse;
                })
                .catch(async () => {
                    const cachedResponse = await caches.match(request);
                    if (cachedResponse) return cachedResponse;

                    // Fallback luring jika halaman belum ter-cache
                    return caches.match('/publik.html') || caches.match('/');
                })
        );
        return;
    }

    // 4. Strategi Stale-While-Revalidate untuk Aset Statis (CSS, JS, Fonts, Gambar UI)
    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            const fetchPromise = fetch(request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const copy = networkResponse.clone();
                        caches.open(DYNAMIC_CACHE_NAME).then((cache) => cache.put(request, copy));
                    }
                    return networkResponse;
                })
                .catch(() => cachedResponse);

            return cachedResponse || fetchPromise;
        })
    );
});

// =============================================================================
// 4. BACKGROUND SYNC (SINKRONISASI HASIL SURVEI LAPANGAN SAAT ONLINE KEMBALI)
// =============================================================================
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-survei-bansos') {
        event.waitUntil(
            // Beri sinyal ke seluruh tab client agar modul offline mengirim antrean IndexedDB
            self.clients.matchAll().then((clients) => {
                clients.forEach((client) => {
                    client.postMessage({
                        action: 'TRIGGER_OFFLINE_SYNC',
                        timestamp: Date.now()
                    });
                });
            })
        );
    }
});

// =============================================================================
// 5. PUSH NOTIFICATIONS & INTERAKSI NOTIFIKASI
// =============================================================================
self.addEventListener('push', (event) => {
    let data = {
        title: 'Sistem Bansos Sidoarjo',
        body: 'Ada pembaruan status verifikasi atau penetapan bansos.',
        icon: '/static/img/icon-192.png',
        url: '/index.html'
    };

    if (event.data) {
        try {
            data = { ...data, ...event.data.json() };
        } catch (e) {
            data.body = event.data.text();
        }
    }

    const options = {
        body: data.body,
        icon: data.icon,
        badge: '/static/img/icon-192.png',
        vibrate: [100, 50, 100],
        data: { url: data.url }
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = event.notification.data?.url || '/index.html';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url.includes(targetUrl) && 'focus' in client) {
                    return client.focus();
                }
            }
            if (self.clients.openWindow) {
                return self.clients.openWindow(targetUrl);
            }
        })
    );
});

// =============================================================================
// 6. MESSAGE EVENT (KONTROL DARI CLIENT / MANUAL SKIP WAITING)
// =============================================================================
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});