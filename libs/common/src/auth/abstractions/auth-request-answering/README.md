# Auth Request Answering Service

This feature is to allow for the taking of auth requests that are received via websockets by the background service to
be acted on when the user loads up a client. Currently only implemented with the browser client.

See diagram for the high level picture of how this is wired up.

## Diagram

![img.png](notification-architecture.png)

## Compatibility Table

| Browser | Operating System | What Works?                                                      |
| ------- | ---------------- | ---------------------------------------------------------------- |
| Chrome  | Mac              | ✅ Everything works as designed                                  |
| Chrome  | Windows          | 🟡 Works, save clicking a notification and the extension opening |
| Firefox | Mac              | 🟡 Works, save clicking a notification and the extension opening |
| Firefox | Windows          | ⚠️ Untested                                                      |
| Safari  | Mac              | ❌ Nothing, notification nor open popup will function            |
| Edge    | Mac              | 🟡 Works, save clicking a notification and the extension opening |
| Edge    | Windows          | ⚠️ Untested                                                      |
| Vivaldi | Mac              | 🟡 Works, save clicking a notification and the extension opening |
| Vivaldi | Windows          | ⚠️ Untested                                                      |
| Opera   | Mac              | ⚠️ Untested                                                      |
| Opera   | Windows          | ⚠️ Untested                                                      |
