// Nama cache diperbarui ke v3 untuk memaksa browser menghapus versi lama secara radikal
const CACHE_NAME = 'bansos-cache-v3';

// Daftar file kerangka utama yang wajib disimpan di memori device pengguna
const urlsToCache = [
  '/',
  '/login.html',
  '/index.html',
  '/publik.html',
  '/static/css/style.css',
  '/static/css/login.css',
  '/static/css/admin.css',
  '/static/css/publik.css',
  '/static/js/login.js',
  '/static/js/admin.js',
  '/static/js/publik.js'
];

// EVENT INSTALL: Menyimpan file-file penting ke dalam Cache
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Service Worker: Caching App Shell...');
      return cache.addAll(urlsToCache);
    })
  );
  // Memaksa Service Worker langsung aktif tanpa menunggu browser ditutup
  self.skipWaiting();
});

// EVENT ACTIVATE: Membersihkan Cache versi lama agar pengguna selalu dapat update terbaru
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Service Worker: Menghapus Cache Lama ->', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// EVENT FETCH: Strategi Cache-First untuk file statis, tapi Bypass untuk API
self.addEventListener('fetch', event => {
  // Jangan pernah melakukan cache pada request API / Database, pastikan selalu Real-Time
  if (event.request.url.includes('/api/') || event.request.url.includes('/warga') || event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(response => {
      // Jika file ada di dalam cache, muat dari cache (sangat cepat)
      if (response) {
        return response;
      }

      // Jika tidak ada di cache, ambil dari jaringan (Internet)
      return fetch(event.request).then(
        function(networkResponse) {
          // Jangan cache jika respons gagal atau jika berasal dari ekstensi/skrip pihak ketiga
          if(!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }

          // Simpan file baru yang berhasil di-fetch ke dalam Cache secara dinamis
          var responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME)
            .then(function(cache) {
              cache.put(event.request, responseToCache);
            });

          return networkResponse;
        }
      ).catch(() => {
          // Jika internet mati dan file tidak ada di cache, bisa diarahkan ke halaman fallback offline
      });
    })
  );
});