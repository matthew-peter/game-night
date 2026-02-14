// Service Worker for Web Push Notifications
//
// Notification routing logic:
// 1. User is on the SAME game page → suppress entirely (real-time handles it)
// 2. User has the app open (any page visible) → forward to app for in-app toast
// 3. User is away (no visible windows) → show OS push notification

self.addEventListener('push', function(event) {
  if (!event.data) return;

  const data = event.data.json();
  const gameId = data.gameId;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      var visibleClient = null;
      var onGamePage = false;

      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.visibilityState === 'visible') {
          visibleClient = client;
          if (gameId && client.url.includes('/game/' + gameId)) {
            onGamePage = true;
          }
        }
      }

      // Case 1: User is viewing this exact game — suppress entirely.
      // The real-time subscription already updated the UI.
      if (onGamePage) {
        return;
      }

      // Case 2: User has the app open on another page — send in-app toast.
      // This avoids the jarring OS notification while they're actively using the app.
      if (visibleClient) {
        visibleClient.postMessage({
          type: 'in-app-notification',
          title: data.title || 'Game Night',
          body: data.body || "It's your turn!",
          gameId: gameId,
          url: data.url || '/'
        });
        return;
      }

      // Case 3: App is not visible — show full OS notification.
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
          // Navigate to the game if not already there
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
