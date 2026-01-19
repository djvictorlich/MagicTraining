const CACHE_NAME = 'gym-pro-v1.0';
const BASE_PATH = '/gym-pwa/';
const urlsToCache = [
  BASE_PATH,
  BASE_PATH + 'index.html',
  BASE_PATH + 'manifest.json',
  BASE_PATH + '404.html',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// Установка Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Кэширование файлов приложения');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Активация Service Worker
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Удаление старого кэша:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Перехват запросов
self.addEventListener('fetch', event => {
  // Для GitHub Pages учитываем BASE_PATH
  const requestUrl = new URL(event.request.url);
  
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Возвращаем кэшированный ответ, если он есть
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // Для навигационных запросов возвращаем index.html
        if (event.request.mode === 'navigate') {
          return caches.match(BASE_PATH + 'index.html')
            .then(response => {
              if (response) {
                return response;
              }
              return fetch(event.request);
            });
        }
        
        // Иначе делаем сетевой запрос
        return fetch(event.request)
          .then(response => {
            // Кэшируем только успешные ответы
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Клонируем ответ
            const responseToCache = response.clone();
            
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          })
          .catch(() => {
            // Если сеть недоступна и это HTML, показываем index.html
            if (event.request.headers.get('accept').includes('text/html')) {
              return caches.match(BASE_PATH + 'index.html');
            }
          });
      })
  );
});
