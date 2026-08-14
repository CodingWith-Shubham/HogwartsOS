self.addEventListener('push', function (event) {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.message,
      icon: '/icon-192x192.png', // Optional: Add an icon if you have one
      badge: '/icon-192x192.png', // Optional: Add a badge if you have one
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: '2',
        url: data.href || '/' // Important for routing on click
      }
    };
    event.waitUntil(self.registration.showNotification(data.title, options));
    
    // Broadcast message to clients to update Bell UI
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({ type: 'NEW_NOTIFICATION', payload: data });
      });
    });
  }
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const urlToOpen = new URL(event.notification.data.url, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window/tab open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        // If so, just focus it.
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, then open the target URL in a new window/tab.
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
