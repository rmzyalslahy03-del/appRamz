// ======================================================================
// sw.js - Service Worker لتطبيق RamzApp v5.0 (PWA)
// ======================================================================

// ==================== التكوين الأساسي ====================
const CACHE_NAME = 'ramzapp-v5.0';
const STATIC_CACHE_NAME = `static-${CACHE_NAME}`;
const DYNAMIC_CACHE_NAME = `dynamic-${CACHE_NAME}`;
const IMAGES_CACHE_NAME = `images-${CACHE_NAME}`;
const API_CACHE_NAME = `api-${CACHE_NAME}`;

// ==================== الملفات الثابتة للتخزين المؤقت ====================
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
  // الخطوط والأيقونات (CDN)
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js'
];

// ==================== تثبيت Service Worker ====================
self.addEventListener('install', event => {
  console.log('📦 RamzApp Service Worker Installing...');
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
        // إعادة محاولة التخزين المؤقت للملفات الأساسية
        return caches.open(STATIC_CACHE_NAME).then(cache => {
          return cache.addAll([
            '/',
            '/index.html',
            '/login.html',
            '/common.js',
            '/db.js',
            '/supabase.js',
            '/manifest.json'
          ]);
        });
      })
  );
});

// ==================== تنشيط Service Worker ====================
self.addEventListener('activate', event => {
  console.log('🚀 RamzApp Service Worker Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          // حذف الكاشات القديمة (غير المستخدمة)
          return cacheName !== STATIC_CACHE_NAME &&
                 cacheName !== DYNAMIC_CACHE_NAME &&
                 cacheName !== IMAGES_CACHE_NAME &&
                 cacheName !== API_CACHE_NAME;
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

// ==================== استراتيجيات التخزين المؤقت ====================
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  // تجاهل طلبات chrome-extension و localhost (للتطوير)
  if (url.protocol === 'chrome-extension:' || url.hostname === 'localhost') {
    return;
  }

  // ====== استراتيجية للصور ======
  if (request.destination === 'image') {
    event.respondWith(handleImageRequest(request));
    return;
  }

  // ====== استراتيجية لـ Supabase API (وسيط) ======
  if (url.hostname === 'serlegwdzjulfcxabxzv.supabase.co') {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // ====== استراتيجية للملفات الثابتة (HTML, CSS, JS) ======
  if (STATIC_ASSETS.some(asset => request.url.includes(asset) || request.url.endsWith(asset))) {
    event.respondWith(handleStaticRequest(request));
    return;
  }

  // ====== استراتيجية للطلبات العامة (Network First مع Cache) ======
  event.respondWith(handleNetworkFirstRequest(request));
});

// ==================== معالجات الطلبات ====================

// ----- 1. الملفات الثابتة (Cache First) -----
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

// ----- 2. الصور (Cache First مع تحديث خلفي) -----
async function handleImageRequest(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      // تحديث في الخلفية (للحصول على الصورة الأحدث)
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
    // محاولة عرض صورة احتياطية
    return new Response('', { status: 404 });
  }
}

// ----- 3. طلبات Supabase API (Network First) -----
async function handleApiRequest(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(API_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    console.warn('⚠️ API request failed:', request.url);
    // إرجاع استجابة خطأ بدلاً من تعطيل التطبيق
    return new Response(JSON.stringify({ error: 'Network error', offline: true }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ----- 4. الطلبات العامة (Network First مع احتياطي Cache) -----
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
  console.log('📨 Push notification received:', event);

  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'RamzApp', body: 'لديك رسالة جديدة' };
  }

  const title = data.title || '💬 RamzApp';
  const options = {
    body: data.body || 'لديك رسالة جديدة من أحد أصدقائك',
    icon: '/assets/icons/icon-192x192.png',
    badge: '/assets/icons/icon-72x72.png',
    vibrate: [200, 100, 200, 100, 300],
    data: {
      url: data.url || '/index.html',
      chatId: data.chatId || null,
      senderId: data.senderId || null
    },
    actions: [
      { action: 'open', title: '📱 فتح التطبيق' },
      { action: 'reply', title: '💬 رد سريع' },
      { action: 'close', title: '✖️ إغلاق' }
    ],
    // تحسين ظهور الإشعار في الأجهزة المختلفة
    silent: false,
    requireInteraction: true,
    tag: data.chatId || 'ramzapp-notification',
    renotify: true
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
      .then(() => console.log('✅ Notification shown'))
      .catch(err => console.warn('⚠️ Notification failed:', err))
  );
});

// ==================== التعامل مع النقر على الإشعارات ====================
self.addEventListener('notificationclick', event => {
  console.log('🔔 Notification clicked:', event);

  // إغلاق الإشعار
  event.notification.close();

  const action = event.action;
  const url = event.notification.data?.url || '/index.html';
  const chatId = event.notification.data?.chatId || null;

  if (action === 'close') {
    // فقط أغلق الإشعار (تم بالفعل)
    return;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        // 1. البحث عن نافذة مفتوحة للتطبيق
        for (const client of windowClients) {
          if (client.url.includes('/index.html') || client.url.includes('/app')) {
            // نافذة موجودة، نوجهها
            if ('focus' in client) {
              client.focus();
            }
            // إرسال رسالة لتحديث الواجهة (فتح المحادثة)
            if (chatId && 'postMessage' in client) {
              client.postMessage({
                type: 'OPEN_CHAT',
                chatId: chatId
              });
            }
            return client;
          }
        }
        // 2. لا توجد نافذة، نفتح جديدة
        if (clients.openWindow) {
          const targetUrl = chatId ? `${url}?openChat=${chatId}` : url;
          return clients.openWindow(targetUrl);
        }
      })
      .then(client => {
        if (client && chatId && 'postMessage' in client) {
          // تأخير بسيط لضمان تحميل الصفحة
          setTimeout(() => {
            client.postMessage({
              type: 'OPEN_CHAT',
              chatId: chatId
            });
          }, 500);
        }
      })
  );
});

// ==================== استقبال رسائل من التطبيق ====================
self.addEventListener('message', event => {
  console.log('📩 Message received from client:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  // يمكن استخدام هذا لتحديث الكاش أو إرسال إشعارات من التطبيق
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            console.log(`🗑️ Clearing cache: ${cacheName}`);
            return caches.delete(cacheName);
          })
        );
      })
    );
  }
});

// ==================== التنظيف الدوري للكاش ====================
// حذف الكاش القديم بشكل دوري (كل 24 ساعة)
setInterval(() => {
  console.log('🔄 Periodic cache cleanup...');
  caches.keys().then(cacheNames => {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 ساعة

    return Promise.all(
      cacheNames.map(cacheName => {
        // الاحتفاظ بالكاشات الأساسية فقط
        if (cacheName === STATIC_CACHE_NAME) return;
        if (cacheName === API_CACHE_NAME) return;

        return caches.open(cacheName).then(cache => {
          cache.keys().then(requests => {
            for (const request of requests) {
              // يمكن إضافة منطق لحذف الإدخالات القديمة
            }
          });
        });
      })
    );
  });
}, 24 * 60 * 60 * 1000);

// ==================== تسجيل الإنجاز ====================
console.log('✅ RamzApp Service Worker v5.0 ready');
console.log('📦 Caches:', {
  static: STATIC_CACHE_NAME,
  dynamic: DYNAMIC_CACHE_NAME,
  images: IMAGES_CACHE_NAME,
  api: API_CACHE_NAME
});
