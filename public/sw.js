self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const targetUrl = event.notification.data?.url || '/'

  event.waitUntil(
    clients
      .matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      .then((windows) => {
        const existingWindow = windows.find((client) =>
          client.url.startsWith(targetUrl)
        )

        if (existingWindow) {
          existingWindow.focus()

          existingWindow.postMessage({
            type: 'OPEN_CHAT',
            chatId: event.notification.data?.chatId,
          })

          return
        }

        return clients.openWindow(targetUrl)
      })
  )
})
