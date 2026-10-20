# Automation-driver

Library exposing `AutomationDriver` — a hook into the client for machine interaction with Bitwarden
clients. It is attached to the global object in all Angular builds (browser, desktop, web), and lets
end-to-end tests, automated scripts, and agents drive the client at runtime through dev-tools. The
CLI is not supported.

## Capabilities

The driver is a registry. It holds a set of named capabilities and never constructs them itself, so
a capability can live in whichever library owns its dependencies.
Extend `AutomationCapability` and register it against that same class as a multi-provider token — in `jslib-services.module.ts` for a capability every client supports, or in
a single client's provider module for one only that client can offer:

```ts
safeProvider({
  provide: AutomationCapability,
  useFactory: (messagingService: MessagingService) =>
    new DesktopNavigationCapability(messagingService),
  deps: [MessagingService],
  multi: true,
});
```

## Usage from dev-tools

```js
bitwardenAutomationDriver.list();
// ["featureFlags", "state", "lock", "logging", "processReload"]

await bitwardenAutomationDriver.get("lock").listUsers();
```

`get` returns `undefined` when the running client does not provide the capability.

### Performance tracking

The `performance` capability replaces the global `performance` with a proxy that records
`mark()` and `measure()` calls. It hooks itself in development builds; elsewhere call
`hookPerformance()` first.

```js
const perf = bitwardenAutomationDriver.get("performance");
perf.hookPerformance();
performance.mark("start");
perf.readEvents();
// [{ type: "mark", name: "start", startTime: 1234.5, duration: 0, detail: null }]
```

The buffer keeps the latest 10,000 events. `clearEvents()` empties it, `unhookPerformance()`
restores the original object.

### SDK client (development builds only)

The `sdk` capability hands a user's SDK client to a callback. It is registered only in development
builds. Its `debug()` tree additionally needs an sdk-internal build with the `debug-capabilities`
feature (`build.sh -d`).

```js
await bitwardenAutomationDriver
  .get("sdk")
  .forUser(userId, (client) => client.vault().folders().list());
await bitwardenAutomationDriver
  .get("sdk")
  .forUser(userId, (client) => client.debug().state().types());
```

Do not keep the client, or anything reached through it, after the callback returns: the client is
freed once nothing references it.
