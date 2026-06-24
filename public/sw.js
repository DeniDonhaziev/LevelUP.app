/**
 * PWA service worker — кэширование (быстрый старт) + Firebase Cloud Messaging.
 */
const STATIC_CACHE = 'levelup-static-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Удаляем старые версии кэша
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }

  // Внешние запросы (Firestore, googleapis, exp.host, тайлы карты) — не трогаем
  if (url.origin !== self.location.origin) return;

  const isHTML =
    req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');

  // HTML/навигация — всегда из сети (свежая версия), кэш только как офлайн-фолбэк
  if (isHTML) {
    event.respondWith(
      fetch(req).catch(async () => (await caches.match(req)) || (await caches.match('/index.html')))
    );
    return;
  }

  // Статика (JS/CSS/шрифты/иконки) — мгновенно из кэша + фоновое обновление
  event.respondWith(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res && res.status === 200 && res.type === 'basic') {
              cache.put(req, res.clone());
            }
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    )
  );
});

const SCREEN_PATH = {
  home: '/',
  activity: '/activity',
  run: '/run',
  clans: '/clans',
  stats: '/stats',
  ai: '/ai',
  profile: '/profile',
};

function resolveUrl(data) {
  if (data?.url) return data.url;
  const screen = data?.screen;
  if (screen && SCREEN_PATH[screen]) return SCREEN_PATH[screen];
  switch (data?.type) {
    case 'clan_chat':
    case 'club_new_member':
    case 'club_ranking_up':
    case 'club_achievement':
      return '/clans';
    case 'run_reminder':
    case 'run_goal_near':
    case 'run_goal_achieved':
    case 'weekly_stats':
      return '/run';
    case 'ai_recommendation':
      return '/ai';
    case 'goals_incomplete':
    case 'habit_reminder':
    case 'streak_warning':
      return '/activity';
    default:
      return '/';
  }
}

try {
  importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js');
  importScripts('/fcm-sw-config.js');

  if (self.FIREBASE_CONFIG && self.FIREBASE_CONFIG.apiKey) {
    firebase.initializeApp(self.FIREBASE_CONFIG);
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
      const n = payload.notification || {};
      const data = payload.data || {};
      const title = n.title || 'LevelUp';
      const body = n.body || '';
      return self.registration.showNotification(title, {
        body,
        icon: n.icon || '/icon-192.png',
        badge: '/icon-192.png',
        tag: data.type || 'levelup',
        renotify: true,
        data: { url: resolveUrl(data), ...data },
      });
    });
  }
} catch (e) {
  console.warn('FCM SW init:', e);
}

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload = { title: 'LevelUp', body: '' };
  try {
    payload = { ...payload, ...event.data.json() };
  } catch {
    /* ignore */
  }
  const url = resolveUrl(payload.data || payload);
  event.waitUntil(
    self.registration.showNotification(payload.title || 'LevelUp', {
      body: payload.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'levelup-push',
      data: { url, ...(payload.data || {}) },
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
