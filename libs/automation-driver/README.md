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
