# Server Notifications

## About

This is the clients equivalent of server push notifications. The `ServerNotificationsService` takes
care of receiving the notifications from our server no matter the technology needed to make it
happen behind the scenes.

## Usage

At the current moment the best way to consume a notification pushed to our client is by adding code
to the switch statement in the `processNotification` method of
[`DefaultServerNotificationsService`](./internal/default-server-notifications.service.ts). It's best
to put as much of your logic in your own service and inject and call a method on that service in
response to your notification type being processed.

In the future, notifications will be able to be handled in response to the `notifications$`
observable. This stream will contain all notifications that come from our server and it will be
your responsibility to filter out for only the notifications you care about and to parse the payload
into your expected type. Through this stream you will also be required to filter out if the
notification should not be handled as the current device was the originator of the notification
or if you only want to handle the notifications of the currently active user.

## Implementation

There are three server notification service implementations available for our clients, with specific
use cases detailed below.

### Default

The default implementation is the main implementation that actually does the actions people expect
it to do. This service manages the logic for when we should connect, ensuring we always have a
connection during those times, and trying to limit reconnection events to only when necessary.
The service establishes a connection for the all users if they have an available access token and a
notification URL other than `http://-`, which is used as a special value to say that notifications
should not be used. Then the service will reach out to the injected `WebPushConnectionService` for
its support status on if it supports web push. If it does support web push it will give us an object
to use to connect to web push notifications. If that service tells us web push is not supported or
any exceptions happen in the web push stream we fall back to connecting to SignalR notifications. We
are sure to use the `rxjs` operator `distinctUntilChanged` on a lot of these events to help avoid
doing unnecessary reconnects.

This structure allows us to inject a different implementation of `WebPushConnectionService` based on
the client, depending on the best way to use web push in that client's ecosystem. For now it is only
using the Service Worker of our Chrome MV3 extension. Possible future implementation of this service
could be a `Worker` in our web app. This would require that we request the
[`Notification` permission][notification-permission] and that browsers start allowing
`userVisibleOnly: false`. Right now browsers require `true` and that a notification is shown to the
user after push notification is received. If one isn't shown then browser will automatically show
one stating "The website has refreshed in the background". Another possible implementation that
could apply to web and desktop would be using our `autopush-manager` package. That package uses web
sockets under the hood but implements the cryptography layer of web push on top of it so that we can
offload the socket connection to another party.

The injected `SignalRConnectionService` is another service that we can utilize to make the below
foreground service not needed anymore. Instead of having a whole different
`ServerNotificationService` implementation we can have a new implementation of this and it can defer
to the service worker for the more persistent connection but send SignalR messages through
`MessageSender`. Since the browser handles the underlying connection in web push there is should be
no adverse effects from just adding another `push` event listener in each context.

### Noop

This is a special implementation that can be opted into being used through the dev flag
`noopNotifications`. When that flag is true then the noop version of server notifications will be
used. This is usually done to keep the console cleaner from any logs that might happen from the
default implementation. We could, in the future decide to depracate this implementation in favor
of instructing users to use `http://-` as their notifications url in the `local.json` configuration.
That should largely have the same behavior and would allow us to maintain one fewer implementation.

```jsonc
// apps/[browser|desktop|web]/local.json
{
  "devFlags": {
    "noopNotifications": true,
  },
}
```

### Foreground

The foreground implementation is specially for browser foreground instances. At the moment this
service acts as a stub to avoid accidentally doubling up SignalR connections. If we had the default
implementation in both the background service worker and in each foreground instance then there
would be a web socket connection made in each. With this special instance we avoid that by doing
nothing at the moment. Once we begin to fully support the `notifications$` observable we can make
a choice whether or not keep not supporting it in the browser foreground or we can decide to support
it through messaging the background.

[notification-permission]:[https://developer.mozilla.org/en-US/docs/Web/API/Notification/permission_static]
