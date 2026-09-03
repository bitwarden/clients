# Flight recorder

Read SDK flight recorder events from the running desktop app via the automation driver. Only
available on clients that load the WASM SDK (desktop, browser extension, web — not CLI).

Access via `window.bitwardenAutomationDriver.flightRecorder`. Call methods via
`mcp__electron-devtools-attach__evaluate_script`.

## Read events

```js
// Read all events currently in the buffer
async () => window.bitwardenAutomationDriver.flightRecorder.read();

// Get the current event count without reading contents
async () => window.bitwardenAutomationDriver.flightRecorder.count();
```

`read()` returns an array of `FlightRecorderEvent` objects from `@bitwarden/sdk-internal`:

| Field       | Type                     | Example                             |
| ----------- | ------------------------ | ----------------------------------- |
| `timestamp` | `number` (unix ms)       | `1756900000123`                     |
| `level`     | `string`                 | `DEBUG` / `INFO` / `WARN` / `ERROR` |
| `target`    | `string` (module path)   | `bitwarden_core::client`            |
| `message`   | `string`                 | `failed to decrypt cipher`          |
| `fields`    | `Record<string, string>` | `{ cipher_id: "..." }`              |

## Grep for specific events

The buffer can hold thousands of events — never dump it whole into your context. Filter inside the
page and return only the matching lines, formatted as text.

```js
// Grep by message/target/fields substring, case-insensitive. Returns newest 20 matches.
async () => {
  const pattern = /decrypt|cipher_id/i; // <-- edit this
  const events = await window.bitwardenAutomationDriver.flightRecorder.read();

  const hits = events.filter(
    (e) =>
      pattern.test(e.message) || pattern.test(e.target) || pattern.test(JSON.stringify(e.fields)),
  );

  return {
    total: events.length,
    matched: hits.length,
    lines: hits.slice(-20).map((e) => {
      const time = new Date(e.timestamp).toISOString().slice(11, 23);
      const fields = Object.entries(e.fields)
        .map(([k, v]) => `${k}=${v}`)
        .join(" ");
      return `${time} ${e.level} ${e.target} ${e.message} ${fields}`.trim();
    }),
  };
};
```

Common variants — swap the filter predicate:

```js
// Errors and warnings only
events.filter((e) => e.level === "ERROR" || e.level === "WARN");

// One SDK module
events.filter((e) => e.target.startsWith("bitwarden_vault"));

// Only what happened after a marked point in time
events.filter((e) => e.timestamp > since); // capture `since = Date.now()` before the repro step

// Count by level instead of listing, to see whether anything is worth reading
events.reduce((acc, e) => ({ ...acc, [e.level]: (acc[e.level] ?? 0) + 1 }), {});
```
