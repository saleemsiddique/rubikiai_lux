const CACHE_NAME = 'rubikiai-lux-v2';
const urlsToCache = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-icon.png',
  '/rubikiai-logo.png'
];

// Instalar el service worker y cachear recursos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache abierto');
        return cache.addAll(urlsToCache);
      })
  );
});

// Activar el service worker y limpiar cachés antiguas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Eliminando caché antigua:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Interceptar peticiones y servir desde caché si está disponible
self.addEventListener('fetch', (event) => {
  // Ignorar peticiones de navegación para evitar problemas con redirecciones
  if (event.request.mode === 'navigate') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Retornar desde caché si está disponible
        if (response) {
          return response;
        }

        // Si no está en caché, hacer fetch
        return fetch(event.request).then(
          (response) => {
            // Solo cachear respuestas válidas sin redirecciones
            if (!response || !response.ok || response.type === 'opaque' || response.type === 'opaqueredirect') {
              return response;
            }

            // Clonar la respuesta para cachear
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        ).catch(() => {
          // Si falla el fetch, intentar retornar desde caché cualquier cosa que coincida
          return caches.match(event.request);
        });
      })
  );
});
