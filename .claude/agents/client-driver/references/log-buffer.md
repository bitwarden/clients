# Log buffer

The automation driver hooks the app's `LogService` at startup and accumulates every log write in
an in-memory buffer. Use this to inspect log output without attaching a debugger.

Available via `window.bitwardenAutomationDriver` on any client running in dev mode. Call methods
via the appropriate `evaluate_script` tool for the target client.

## Read the buffer

```js
// Returns a snapshot: [{ level: 0|1|2|3, message: any, params: any[] }, ...]
async () => window.bitwardenAutomationDriver.readLogBuffer();
```

`level` maps to `LogLevel` from `@bitwarden/logging`:

| Value | Name      |
| ----- | --------- |
| 0     | `Debug`   |
| 1     | `Info`    |
| 2     | `Warning` |
| 3     | `Error`   |

## Clear the buffer

```js
async () => {
  window.bitwardenAutomationDriver.clearLogBuffer();
};
```

Call this before the operation under test so the buffer only contains messages from that run.

## Typical debugging flow

1. Clear the buffer.
2. Trigger the operation (click, send message, call an API, etc.).
3. Read the buffer and inspect for unexpected warnings or errors.

## Notes

- The hook is added once, at driver construction. Calling the driver's `hookLogService` method
  a second time on the same service stacks wrappers — avoid double-hooking.
- The buffer is never automatically cleared; it grows until you call `clearLogBuffer()` or the
  page/process reloads.
- `readLogBuffer()` returns a snapshot (a copy) — entries added after the call are not visible in
  the returned array.
