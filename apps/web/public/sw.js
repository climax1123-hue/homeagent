/* global self, clients, URL */
self.addEventListener('push', (event) => {
  let payload = { title: '우리집 알림', body: '확인할 알림이 있습니다.', url: '/app/calendar' };
  try {
    payload = { ...payload, ...event.data.json() };
  } catch {
    /* Use privacy-safe fallback. */
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/home-icon.svg',
      badge: '/home-icon.svg',
      data: { url: payload.url || '/app/calendar' },
      tag: payload.tag,
      renotify: false,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/app/calendar', self.location.origin)
    .href;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const existing = windows.find((client) => client.url.startsWith(self.location.origin));
      return existing
        ? existing.focus().then(() => existing.navigate(target))
        : clients.openWindow(target);
    }),
  );
});
