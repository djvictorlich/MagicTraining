// Magic Training - Service Worker
const CACHE_NAME = 'magic-training-v1';
const VIDEO_CACHE_NAME = 'magic-training-videos-v1';

// Файлы для кэширования при установке
const STATIC_ASSETS = [
  '/MagicTraining/',
  '/MagicTraining/index.html',
  '/MagicTraining/manifest.json',
  '/MagicTraining/icons/icon-152.png',
  '/MagicTraining/icons/icon-192.png',
  '/MagicTraining/icons/icon-512.png'
];

// Установка Service Worker
self.addEventListener('install', event => {
  console.log('[Service Worker] Установка...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Кэшируем основные ресурсы');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[Service Worker] Установка завершена');
        return self.skipWaiting();
      })
  );
});

// Активация Service Worker
self.addEventListener('activate', event => {
  console.log('[Service Worker] Активация...');
  
  // Очистка старых кэшей
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && cacheName !== VIDEO_CACHE_NAME) {
            console.log('[Service Worker] Удаляем старый кэш:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[Service Worker] Активация завершена');
      return self.clients.claim();
    })
  );
});

// Обработка запросов
self.addEventListener('fetch', event => {
  const url = event.request.url;
  
  // Для Google Drive видео - пропускаем через Service Worker
  if (url.includes('drive.google.com/file/d/') && url.includes('/preview')) {
    event.respondWith(
      handleGoogleDriveRequest(event.request)
    );
    return;
  }
  
  // Для HTML-страниц - "Network First, затем Cache"
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Обновляем кэш
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, response.clone());
          });
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) {
              return cachedResponse;
            }
            return caches.match('/MagicTraining/');
          });
        })
    );
    return;
  }
  
  // Для остальных ресурсов - "Cache First"
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then(response => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
          
          return response;
        });
      })
  );
});

// Обработка Google Drive запросов
async function handleGoogleDriveRequest(request) {
  const cache = await caches.open(VIDEO_CACHE_NAME);
  
  // Пробуем кэш
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    console.log('[SW] Google Drive видео из кэша');
    return cachedResponse;
  }
  
  try {
    // Загружаем из сети
    const networkResponse = await fetch(request, {
      mode: 'no-cors',
      credentials: 'omit'
    });
    
    // Сохраняем в кэш
    cache.put(request, networkResponse.clone());
    
    return networkResponse;
    
  } catch (error) {
    console.log('[SW] Ошибка загрузки Google Drive видео:', error);
    
    // Фолбэк страница
    return new Response(
      `
      <!DOCTYPE html>
      <html>
      <head><title>Видео недоступно</title></head>
      <body style="text-align: center; padding: 50px; background: #f2f2f7;">
        <h2 style="color: #333;">Видео временно недоступно</h2>
        <p style="color: #666;">Проверьте подключение к интернету</p>
        <p style="color: #666;">или откройте видео напрямую в Google Drive</p>
      </body>
      </html>
      `,
      {
        headers: { 'Content-Type': 'text/html' }
      }
    );
  }
}

// Фоновые задачи
self.addEventListener('message', event => {
  if (event.data.action === 'CACHE_VIDEOS') {
    const videos = event.data.videos;
    console.log('[SW] Фоновое кэширование видео:', videos.length);
    
    event.waitUntil(
      caches.open(VIDEO_CACHE_NAME).then(cache => {
        return Promise.all(
          videos.map(videoUrl => {
            return fetch(videoUrl, { mode: 'no-cors' })
              .then(response => cache.put(videoUrl, response))
              .catch(error => {
                console.log('[SW] Ошибка кэширования видео:', error);
              });
          })
        );
      })
    );
  }
});
