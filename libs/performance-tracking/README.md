# performance-tracking

Owned by: platform

Performance tracing primitives. Wraps `performance.mark` / `performance.measure` so entries show up as
custom tracks in the Chrome DevTools performance panel, and debug-logs the same data.

Entries are organized by three names:

```
Key Management            <- namespace (devtools track group), the owning team
 └─ DefaultUnlockService  <- category  (devtools track), generally the class name
     └─ unlockWithPin     <- event name
```

## Usage

Prefer `startEvent` over the raw `measure` API — it captures the start time for you.

```typescript
const event = performanceTracking.startEvent({
  namespace: "Key Management",
  category: "DefaultUnlockService",
  name: "unlockWithPin",
  properties: [["userId", userId]],
});

event.mark("pin validated");
await this.setUserKey(key);
event.finish([["result", "success"]]);
```

For something that happens at a single point in time, use `logEvent`. It writes immediately with a
fixed nominal duration (a zero-length entry is not selectable in devtools) and flags itself with the
`instant` property.

```typescript
performanceTracking.logEvent({
  namespace: "Key Management",
  category: "DefaultUnlockService",
  name: "auto-lock triggered",
  properties: [["reason", "timeout"]],
});
```

Angular consumers should use [`@bitwarden/performance-tracking-angular`](../performance-tracking-angular/README.md),
which wires the debug sink to `LogService`.
