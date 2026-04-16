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

When enabled, the wrapper captures `performance.now()` timestamps before and after each call, writing them to a preallocated circular buffer. When disabled, it delegates directly to the original. The function's return value, arguments, and `this` context are always preserved — this is why the example assigns back to `this.handleMutation`, since the wrapper correctly forwards the receiver when called as a method.

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

## Extracting results

### API methods

Use `exportPerformanceEntries(name)` to retrieve measures for a specific instrumented function or block:

```ts
import { exportPerformanceEntries } from "./performance";

const entries = exportPerformanceEntries("handleMutation");
```

This returns a `PerformanceEntryList` filtered to measures matching the given name. If the measurement has been poisoned, it throws.

Use `poison(name)` to mark a measurement as unreliable — for example, when an unexpected error during processing means the timing data can't be trusted:

```ts
import { poison } from "./performance";

try {
  processResults();
} catch {
  poison("handleMutation");
}
```

Once poisoned, any call to `exportPerformanceEntries("handleMutation")` will throw rather than return misleading data.

### After a test scenario

Content scripts run in an isolated world, but in Chromium the `performance` timeline is shared across worlds within a frame. This means `page.evaluate()` (which runs in the main world) can read measures created by content scripts.

After a test scenario completes, extract entries for a specific measure via `page.evaluate`:

```ts
const entries = await page.evaluate(() =>
  performance.getEntriesByName("handleMutation", "measure").map((e) => ({
    name: e.name,
    startTime: e.startTime,
    duration: e.duration,
  })),
);
```

Note that this approach bypasses the poison check. If reliability matters, check for poison marks first:

```ts
const poisoned = await page.evaluate(
  () => performance.getEntriesByName("handleMutation:poison", "mark").length > 0,
);
```

### Underlying Web APIs

The instrumentation writes standard User Timing entries that are visible in Chrome DevTools, the Firefox Profiler, or any tool that reads the Performance API. For a measure named `"foo"`, the following entries are created:

- `foo:start` — a `performance.mark` at the start of each invocation
- `foo:end` — a `performance.mark` at the end of each invocation
- `foo` — a `performance.measure` spanning each start/end pair
- `foo:poison` — a `performance.mark` created by `poison("foo")`, if called

These can be queried directly via `performance.getEntriesByName()` and `performance.getEntriesByType()`, and cleared via `performance.clearMarks()` and `performance.clearMeasures()`.

### BIT integration

The [Browser Interactions Testing](https://github.com/bitwarden/browser-interactions-testing) framework runs Playwright against real extension builds. To use instrumentation in BIT:

1. Build the extension normally (`npm run build` from `apps/browser`)
2. In the content script bootstrap, call `enableInstrumentation()` before services are initialized
3. Run test scenarios — measures accumulate in the page's performance timeline
4. After each scenario, extract entries via `page.evaluate()` as shown above
