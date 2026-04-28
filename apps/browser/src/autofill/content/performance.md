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

## Instrumentation

Use `stopwatch` to **instrument a function call**. The function's return value, arguments, and `this` context are always preserved. This example assigns back to `this.handleMutation` so that the wrapper can forward the receiver when called as a method:

```ts
import { stopwatch } from "./performance";

// initialize
this.handleMutation = stopwatch("handleMutation", this.handleMutation);

// measurement occurs when called
this.handleMutation();
```

When enabled, the wrapper captures timestamps before and after each call. Timestamps are recorded only after the call. If measured code throws, the timing entry is silently dropped. The exception propagates normally, but the invocation will not appear in the performance timeline.

When disabled, it delegates directly to the original.

Use `measure` to **instrument a block**:

```ts
import { measure } from "./performance";

// measurement occurs immediately
const result = measure("shadowRootCheck", () => {
  return mutations.some((m) => m.target.getRootNode() instanceof ShadowRoot);
});
```

When disabled, this is equivalent to calling the arrow function directly.

> [!WARNING]
> Both `stopwatch` and `measure` only measure synchronous execution. If the wrapped function returns a Promise, the recorded duration is the time to _create_ the promise, not to _resolve_ it. Do not use these to instrument async functions.

## Poisoning

Use `poison(name)` to mark a measurement as unreliable — for example, when an unexpected error during processing means the timing data can't be trusted:

```ts
import { poison } from "./performance";

try {
  this.handleMutation();
} catch (e: unknown) {
  poison("handleMutation");
}
```

Once poisoned, a `handleMutation:poison` mark appears in the Performance Timeline. Consumers should check for it before trusting extracted measures.

## Extracting results

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

If reliability matters, check for poison marks first:

```ts
const poisoned = await page.evaluate(
  () => performance.getEntriesByName("handleMutation:poison", "mark").length > 0,
);
```

> [!TIP]
> Buffered entries are flushed to the Performance Timeline during idle time. If a page never goes idle (e.g., continuous animation or heavy scripting), the flush will never fire and measures will not appear. Call `useTimeoutForFlush()` to force the collector to flush using `setTimeout` instead:
>
> ```ts
> import { useTimeoutForFlush } from "./performance";
>
> useTimeoutForFlush();
> ```

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
