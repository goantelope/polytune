var CACHE_NAME = 'polytune-v1';
var URLS = [
    './',
    'index.html',
    'css/styles.css',
    'js/tunings.js',
    'js/pitch-detector.js',
    'js/audio-engine.js',
    'js/tuner-core.js',
    'js/ui.js',
    'js/app.js',
    'manifest.json',
    'icons/icon-192.png',
    'icons/icon-512.png',
];

self.addEventListener('install', function (e) {
    e.waitUntil(
        caches.open(CACHE_NAME).then(function (cache) {
            return cache.addAll(URLS);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', function (e) {
    e.waitUntil(
        caches.keys().then(function (names) {
            return Promise.all(
                names.filter(function (n) { return n !== CACHE_NAME; })
                    .map(function (n) { return caches.delete(n); })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', function (e) {
    e.respondWith(
        caches.match(e.request).then(function (resp) {
            return resp || fetch(e.request);
        })
    );
});
