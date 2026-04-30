const CACHE_NAME = 'quiz-pwa-cache-v2';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './quizzes/biologie_2lf.json',
  './quizzes/chemie_2lf.json',
  './quizzes/fyzika_2lf.json'
  // Zde necháváme jen základní soubory nutné pro start aplikace
];

// 1. Instalace - uložíme základní UI soubory
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

// 2. Aktivace - promazání starých verzí
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// 3. Fetch - TADY SE DĚJE TO "STÁHNUTÍ" SLOŽKY S OBRÁZKY
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Pokud soubor máme v cache, vrátíme ho (rychlé, funguje offline)
        if (response) {
          return response;
        }

        // Pokud soubor nemáme, stáhneme ho ze sítě
        return fetch(event.request).then(networkResponse => {
          // Zkontrolujeme, zda jde o požadavek na obrázek z naší složky
          if (event.request.url.includes('chemie_2lf_images')) {
            const responseToCache = networkResponse.clone(); // Musíme naklonovat, protože response lze použít jen jednou
            
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache); // Šoupneme ho do cache pro příště
            });
          }
          return networkResponse;
        });
      })
      .catch(() => {
        // Tady by mohl být fallback pro případ, že nejde síť a nemáme ani cache
      })
  );
});