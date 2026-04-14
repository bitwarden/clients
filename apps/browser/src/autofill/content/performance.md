# Content Script Performance Instrumentation

Lightweight instrumentation for measuring hot paths in autofill content scripts. Designed to impose minimal overhead on the code being measured. For detailed design information, [see the deep dive](performance.design.md).

## Enabling

Instrumentation is disabled by default. Call `enableInstrumentation()` at any time to activate it:

```ts
import { enableInstrumentation } from "./performance";

enableInstrumentation();
```

Once enabled, instrumentation remains active for the lifetime of the content script. There is no `disableInstrumentation`. Use `isInstrumentationEnabled()` to check the current state.

When disabled, `stopwatch` wrappers delegate directly to the original function and `measure` calls the function directly — no timestamps, no buffer writes.

> [!WARNING]
> Both `stopwatch` and `measure` only measure synchronous execution. If the wrapped function returns a Promise, the recorded duration is the time to _create_ the promise, not to _resolve_ it. Do not use these to instrument async functions.

## Instrumenting function boundaries

Use `stopwatch` to wrap a function. The wrapper checks the enabled flag at call time, so `enableInstrumentation()` can be called before or after wrapping:

```ts
import { stopwatch } from "./performance";

this.handleMutation = stopwatch("handleMutation", this.handleMutation);
```

When enabled, the wrapper captures `performance.now()` timestamps before and after each call, writing them to a preallocated circular buffer. When disabled, it delegates directly to the original. The function's return value, arguments, and `this` context are always preserved.

> [!WARNING]
> If the measured function throws, the timing entry is silently dropped. The exception propagates normally, but the invocation will not appear in the performance timeline.

## Instrumenting inline blocks

Use `measure` for code that doesn't sit at a function boundary:

```ts
import { measure } from "./performance";

const result = measure("shadowRootCheck", () => {
  return mutations.some((m) => m.target.getRootNode() instanceof ShadowRoot);
});
```

When disabled, this is equivalent to calling the arrow function directly.

> [!WARNING]
> If the lambda throws, the timing entry is silently dropped. The exception propagates normally, but the invocation will not appear in the performance timeline.

## How data flows

1. **Hot path**: `performance.now()` timestamps are written to preallocated buffer slots. No allocations, no additional Web API calls.
2. **Idle time**: A flush callback (via `requestIdleCallback`) reads the buffer and creates standard `performance.mark()` and `performance.measure()` entries.
3. **Extraction**: The entries are available through the standard Performance API.

## Extracting results

### In browser DevTools

Open the Performance tab in Chrome DevTools or the Firefox Profiler. The measures appear in the User Timing row of the timeline.

### In Playwright / BIT

Content scripts run in an isolated world, but in Chromium the `performance` timeline is shared across worlds within a frame. This means `page.evaluate()` (which runs in the main world) can read measures created by content scripts.

After a test scenario completes:

```ts
const entries = await page.evaluate(() =>
  performance.getEntriesByType("measure").map((e) => ({
    name: e.name,
    startTime: e.startTime,
    duration: e.duration,
  })),
);
```

The module also exports a convenience wrapper:

```ts
import { exportPerformanceEntries } from "./performance";

const entries = exportPerformanceEntries(); // performance.getEntriesByType("measure")
```

### BIT integration

The Browser Interactions Testing framework runs Playwright against real extension builds. To use instrumentation in BIT:

1. Build the extension normally (`npm run build` from `apps/browser`)
2. In the content script bootstrap, call `enableInstrumentation()` before services are initialized
3. Run test scenarios — measures accumulate in the page's performance timeline
4. After each scenario, extract entries via `page.evaluate()` as shown above
