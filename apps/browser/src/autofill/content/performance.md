# Content Script Performance Instrumentation

Lightweight instrumentation for measuring hot paths in autofill content scripts. Designed to impose minimal overhead on the code being measured. For detailed design information, [see the deep dive](performance.design.md).

## Enabling

Instrumentation is disabled by default. The extension build pipeline activates it when compiled with `BW_INCLUDE_CONTENT_SCRIPT_MEASUREMENTS=true`. Pair it with one of the per-browser build scripts so the manifest version and target are set:

```bash
BW_INCLUDE_CONTENT_SCRIPT_MEASUREMENTS=true npm run build:chrome
```

Production builds do not set this; the flag folds to a literal `false` at compile time, every instrumentation primitive short-circuits, and no buffers are allocated for the content script's lifetime. The build-time gate (instead of a runtime control) closes a side-channel surface that would otherwise let host pages observe autofill timing against their own DOM. See [the design doc](performance.design.md#build-time-activation-gate) for the full rationale.

When disabled, `stopwatch` wrappers delegate directly to the original function, `measure` calls the function directly, and `createMeter` returns a shared no-op.

## Spans

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

## Meters

Use `createMeter` to **record a discrete event** at the moment it occurs. Where a span measures the wall-clock time of a code path, a meter records a single instant — `performance.now()` at the call site — along with zero or more positional values describing the event.

Setup and call site are separate. `createMeter` registers the meter once; the returned function is what you call on the hot path:

```ts
import { createMeter } from "./performance";

// at setup: register the meter and the names of its fields
const recordMutation = createMeter("mutation", "count", "depth");

// at each event: call the returned function with positional values
recordMutation(47, 3);
```

The field names declared at registration become the keys of the `detail` object on the resulting mark. The call site passes positional values in the same order — in this example, `recordMutation(47, 3)` produces a mark whose `detail` is `{ count: 47, depth: 3 }`.

### Configuration

The first argument is either a string (the meter name) or a configuration object:

```ts
// string form: name only, default buffer
const recordMutation = createMeter("mutation", "count");

// object form: explicit buffer size for high-frequency meters
const recordSpan = createMeter({ name: "span", bits: 12 }, "start", "end", "depth");
```

Buffer size is 2<sup>bits</sup> in size. The default is 8 (256 slots). A meter that fires once per individual mutation record may want a larger buffer to absorb a single burst; a meter that fires once per batch is fine with the default. See [the design doc](performance.design.md#preallocated-buffers-sized-by-bit-resolution) for the buffer model.

### Counters

A meter with no field names is useful as a counter:

```ts
const tick = createMeter("tick");
tick();
```

This records a `tick:meter:autofill:bw` mark at the call instant with no `detail`.

### Value types

Positional values may be `string | number | boolean`. The framework stores them as-is in plain arrays; there is no encoding step.

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

Once poisoned, a `handleMutation:poison:autofill:bw` mark appears in the Performance Timeline. Consumers should check for it before trusting extracted measures.

## Extracting results

Content scripts run in an isolated world, but in Chromium the `performance` timeline is shared across worlds within a frame. This means `page.evaluate()` (which runs in the main world) can read entries created by content scripts.

After a test scenario completes, extract span measures via `page.evaluate`:

```ts
const entries = await page.evaluate(() =>
  performance.getEntriesByName("handleMutation:autofill:bw", "measure").map((e) => ({
    name: e.name,
    startTime: e.startTime,
    duration: e.duration,
  })),
);
```

Extract meter marks the same way, including their `detail` payload:

```ts
const events = await page.evaluate(() =>
  performance.getEntriesByName("mutation:meter:autofill:bw", "mark").map((e) => ({
    name: e.name,
    startTime: e.startTime,
    detail: (e as PerformanceMark).detail,
  })),
);
```

If reliability matters, check for poison marks first:

```ts
const poisoned = await page.evaluate(
  () => performance.getEntriesByName("handleMutation:poison:autofill:bw", "mark").length > 0,
);
```

### Underlying Web APIs

The instrumentation writes standard User Timing entries that are visible in Chrome DevTools, the Firefox Profiler, or any tool that reads the Performance API.

For a span named `"foo"`:

- `foo:start:autofill:bw` — a `performance.mark` at the start of each invocation
- `foo:end:autofill:bw` — a `performance.mark` at the end of each invocation
- `foo:autofill:bw` — a `performance.measure` spanning each start/end pair
- `foo:poison:autofill:bw` — a `performance.mark` created by `poison("foo")`, if called

For a meter named `"foo"`:

- `foo:meter:autofill:bw` — a `performance.mark` at each call, with `detail` containing the registered field names mapped to the call's positional values

These can be queried directly via `performance.getEntriesByName()` and `performance.getEntriesByType()`, and cleared via `performance.clearMarks()` and `performance.clearMeasures()`.

### BIT integration

The [Browser Interactions Testing](https://github.com/bitwarden/browser-interactions-testing) framework runs Playwright against real extension builds. Consult [Performance Instrumentation in BIT](https://github.com/bitwarden/browser-interactions-testing/blob/main/docs/performance.md) for more information.
