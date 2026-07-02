# Flight recorder

Read SDK flight recorder events from the running desktop app via the automation driver. Only
available on clients that load the WASM SDK (desktop, browser extension, web — not CLI).

Access via `window.bitwardenAutomationDriver.flightRecorder` (undefined if the client does not wire
it in). Call methods via `mcp__electron-devtools__evaluate_script`.

## Read events

```js
// Read all events currently in the buffer
async () => window.bitwardenAutomationDriver.flightRecorder.read();

// Get the current event count without reading contents
async () => window.bitwardenAutomationDriver.flightRecorder.count();
```

`read()` returns an array of `FlightRecorderEvent` objects from `@bitwarden/sdk-internal`.

## Typical debugging flow

1. Guard for the driver and the flight recorder capability:

   ```js
   () => {
     const d = window.bitwardenAutomationDriver;
     if (!d) return "automation driver unavailable";
     if (!d.flightRecorder) return "flight recorder not wired on this client";
   };
   ```

2. Reproduce the operation under investigation.

3. Read the event buffer:

   ```js
   async () => window.bitwardenAutomationDriver.flightRecorder.read();
   ```

4. Inspect the returned events for timing, ordering, or error signals.

## Source

- `libs/automation-driver/src/automation-driver.service.ts`: `AutomationDriver.flightRecorder`
  getter and `AutomationDriverCapabilities.flightRecorder`
- `libs/logging/src/flight-recorder.ts`: `FlightRecorder` — `read()` and `count()` implementation
- `libs/logging-angular/src/flight-recorder.service.ts`: Angular injectable that wires
  `FlightRecorder` to `SdkLoadService.Ready`
