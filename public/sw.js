/**
 * PWA service worker + Firebase Cloud Messaging (фоновые push как в WhatsApp).
 */
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});

try {
  importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js');
  importScripts('/fcm-sw-config.js');

  if (self.FIREBASE_CONFIG && self.FIREBASE_CONFIG.apiKey) {
    firebase.initializeApp(self.FIREBASE_CONFIG);
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
      const n = payload.notification || {};
      const title = n.title || 'Клан';
      const body = n.body || 'Новое сообщение';
      return self.registration.showNotification(title, {
        body,
        icon: n.icon || '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'clan-chat',
        renotify: true,
        data: { url: payload.fcmOptions?.link || '/' },
      });
    });
  }
} catch (e) {
  console.warn('FCM SW init:', e);
}

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload = { title: 'LevelUp', body: 'Новое сообщение в клане' };
  try {
    payload = { ...payload, ...event.data.json() };
  } catch {
    /* ignore */
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || 'LevelUp', {
      body: payload.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'clan-chat-push',
      data: payload.data || { url: '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          if ('navigate' in client) client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
