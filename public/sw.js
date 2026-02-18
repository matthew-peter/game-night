// Service Worker for Web Push Notifications — v2
//
// Notification routing:
// 1. User is on the SAME game page → suppress (real-time handles it)
// 2. App is open but on a different page → show OS notification (user isn't watching that game)
// 3. App is not open → show OS notification

self.addEventListener('push', function(event) {
  if (!event.data) return;

  var data = event.data.json();
  var gameId = data.gameId;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Check if user is viewing the exact game page
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.visibilityState === 'visible' && gameId && client.url.includes('/game/' + gameId)) {
          // User is looking at this game — real-time subscription handles updates
          return;
        }
      }

      // Show OS notification (user is either on a different page, or app is closed)
      var options = {
        body: data.body || "It's your turn!",
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [100, 50, 100],
        data: {
          url: data.url || '/',
          gameId: gameId
        },
        actions: [
          { action: 'open', title: 'Open Game' }
        ],
        tag: gameId || 'game-night-turn',
        renotify: true
      };

      return self.registration.showNotification(data.title || 'Game Night', options);
    })
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  var url = event.notification.data && event.notification.data.url ? event.notification.data.url : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // If a window is already open, focus it and navigate
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if ('focus' in client) {
          client.focus();
          if (!client.url.includes(url)) {
            client.navigate(url);
          }
          return;
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

self.addEventListener('install', function() {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(clients.claim());
});
