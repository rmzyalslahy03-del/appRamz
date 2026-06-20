// ======================================================================
// sw.js - Service Worker لتطبيق RamzApp PWA
// ======================================================================

// ==================== التكوين ====================
const CACHE_NAME = 'ramzapp-v4.0';
const STATIC_CACHE_NAME = `static-${CACHE_NAME}`;
const DYNAMIC_CACHE_NAME = `dynamic-${CACHE_NAME}`;
const IMAGES_CACHE_NAME = `images-${CACHE_NAME}`;

// الملفات الأساسية المخزنة مؤقتاً
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/login.html',
  '/settings.html',
  '/edit-profile.html',
  '/channel.html',
  '/channel-feed.html',
  '/redirect.html',
  '/common.js',
  '/db.js',
  '/supabase.js',
  '/media.js',
  '/sync.js',
  '/test.js',
  '/manifest.json',
  '/favicon.ico',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap'
];

// ==================== تثبيت Service Worker ====================
self.addEventListener('install', event => {
  console.log('📦 Service Worker Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then(cache => {
        console.log('⏳ Caching static assets...');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('✅ Static assets cached successfully');
        return self.skipWaiting();
      })
      .catch(err => {
        console.error('❌ Failed to cache static assets:', err);
      })
  );
});

// ==================== تنشيط Service Worker ====================
self.addEventListener('activate', event => {
  console.log('🚀 Service Worker Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          return cacheName !== STATIC_CACHE_NAME &&
                 cacheName !== DYNAMIC_CACHE_NAME &&
                 cacheName !== IMAGES_CACHE_NAME;
        }).map(cacheName => {
          console.log(`🗑️ Deleting old cache: ${cacheName}`);
          return caches.delete(cacheName);
        })
      );
    })
    .then(() => {
      console.log('✅ Service Worker activated');
      return self.clients.claim();
    })
  );
});

// ==================== استراتيجية التخزين المؤقت ====================
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  // تجاهل طلبات chrome-extension
  if (url.protocol === 'chrome-extension:') return;

  // استراتيجية مختلفة للصور
  if (request.destination === 'image') {
    event.respondWith(handleImageRequest(request));
    return;
  }

  // API requests (Supabase) - استراتيجية Network First
  if (url.hostname === 'serlegwdzjulfcxabxzv.supabase.co') {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // الملفات الثابتة - استراتيجية Cache First
  if (STATIC_ASSETS.some(asset => request.url.includes(asset) || request.url.endsWith(asset))) {
    event.respondWith(handleStaticRequest(request));
    return;
  }

  // كل شيء آخر - استراتيجية Network First مع احتياطي Cache
  event.respondWith(handleNetworkFirstRequest(request));
});

// ==================== معالج الطلبات ====================

// للملفات الثابتة (Cache First)
async function handleStaticRequest(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(STATIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.warn('⚠️ Static request failed:', request.url);
    return new Response('', { status: 404 });
  }
}

// للصور (Cache First مع تحديث في الخلفية)
async function handleImageRequest(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      // تحديث في الخلفية
      fetch(request).then(response => {
        if (response && response.status === 200) {
          caches.open(IMAGES_CACHE_NAME).then(cache => {
            cache.put(request, response);
          });
        }
      }).catch(() => {});
      return cachedResponse;
    }
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(IMAGES_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.warn('⚠️ Image request failed:', request.url);
    return new Response('', { status: 404 });
  }
}

// لـ API (Network First)
async function handleApiRequest(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    console.warn('⚠️ API request failed:', request.url);
    return new Response(JSON.stringify({ error: 'Network error' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// للطلبات العامة (Network First مع احتياطي Cache)
async function handleNetworkFirstRequest(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    console.warn('⚠️ Network request failed:', request.url);
    return new Response('', { status: 404 });
  }
}

// ==================== إشعارات الدفع (Push Notifications) ====================
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'RamzApp';
  const options = {
    body: data.body || 'لديك رسالة جديدة',
    icon: '/assets/icons/icon-192x192.png',
    badge: '/assets/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/index.html',
      chatId: data.chatId || null
    },
    actions: [
      { action: 'open', title: 'فتح' },
      { action: 'close', title: 'إغلاق' }
    ]
  };
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ==================== التعامل مع النقر على الإشعارات ====================
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data.url || '/index.html';
  const chatId = event.notification.data.chatId || null;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        // إذا كانت هناك نافذة مفتوحة، نوجهها
        for (const client of windowClients) {
          if (client.url === url && 'focus' in client) {
            return client.focus();
          }
        }
        // وإلا نفتح نافذة جديدة
        if (clients.openWindow) {
          const targetUrl = chatId ? `${url}?chat=${chatId}` : url;
          return clients.openWindow(targetUrl);
        }
      })
  );
});

console.log('✅ Service Worker جاهز');
