# Designing Content Script Instrumentation

## The problem

Bitwarden's autofill content scripts run inside every page a user visits. They observe DOM mutations, query shadow roots, manage overlays, and coordinate with the extension background — all on the browser's main thread, in the same execution context as the page's own JavaScript.

On dynamic pages — think Jupyter notebooks, SPAs with aggressive virtual scrolling, or pages with heavy shadow DOM usage — the mutation observer callback can fire hundreds of times per second. Each callback does synchronous work: traversing parent chains, checking prototype chains, scheduling follow-up operations. When this work takes too long, the page janks. The user sees it. The page author (rightfully) blames our observers.

We want to measure exactly how much time these hot paths consume, so we can identify the biggest offenders and track improvement over time. The catch: **the measurement itself can't contribute to the problem it's trying to observe.**

## The operating environment

Content scripts run in an **isolated world** — a separate JavaScript execution context that shares the page's DOM but has its own global scope. This means:

- We share the main thread with the page. Any work we do delays the page's rendering, event handlers, and layout operations.
- The mutation observer callback is synchronous. Until it returns, the browser cannot perform layout, paint, or run other microtasks.
- We are guests. The page's performance is not ours to degrade.

The mutation observer is the most critical hot path. It processes batches of DOM mutations, and each batch can contain hundreds of records. The observer fires during or immediately after DOM manipulation, which often coincides with the browser wanting to perform layout and paint. Every microsecond we spend in the callback is a microsecond added to a potentially already-long frame.

## Design constraints

Given this environment, the instrumentation must satisfy:

1. **Minimal hot-path overhead.** The code inside the mutation callback must not allocate objects, cross the JS-to-native boundary, or perform work proportional to anything other than the measurement itself (two timestamp reads per measured span).

2. **No interference with browser scheduling.** Expensive operations like creating performance entries must happen during idle time, not during active frame processing.

3. **No external dependencies.** Content scripts are bundled as separate webpack entry points. Importing shared utility barrels pulls in unrelated code. The instrumentation module must be self-contained.

4. **Cross-browser compatibility.** Chrome, Firefox, and Safari all need to work. The Performance API (User Timing Level 3) is available in all target browsers.

## Information architecture

The data flows through three stages, each with a different performance budget:

### Stage 1: Capture (hot path)

Records a name and two timestamps (start and end) into a preallocated circular buffer. This is the only stage that runs during performance-critical code — its budget is two `performance.now()` reads and a buffer write. No objects are allocated, no Web APIs are called, and no strings are built.

### Stage 2: Flush (idle time)

Drains the buffer and materializes each entry as a pair of `performance.mark` entries and a `performance.measure` entry in the browser's Performance Timeline. Runs during idle time (`requestIdleCallback`, with a `setTimeout` fallback), so it has no performance budget constraint.

### Name stability

Each stage produces entries with structured names: for a measure called `"foo"`, the marks are `foo:start`, `foo:end`, and (if poisoned) `foo:poison`. These names are part of the public contract — they are visible in browser developer tools and relied upon by test infrastructure. Changing the suffix convention (`:start`, `:end`, `:poison`) is a breaking change.

### Privacy

All three stages operate exclusively within the browser's built-in Performance API. Measurement data lives in the page's `performance` timeline — the same timeline visible in Chrome DevTools or the Firefox Profiler. No data is collected by the extension or stored beyond the page's lifetime. It is ephemeral: it exists only while the page is open and is cleared when the page navigates away.

Data collection, aggregation, and reporting are explicitly out of scope. The instrumentation provides the raw measurement capability; how that data is consumed is a separate concern handled by the testing framework or developer workflow.

## Design decisions

### Preallocated circular buffer

The buffer is a fixed-size array of 128 slots, allocated once at module load. Each slot is a plain object with `name`, `start`, and `end` properties. The write head advances monotonically; the circular behavior comes from bitwise masking (`writeHead & 127`).

Why 128? It's arbitrary. What matters is that it's a power of 2 to keep the bitmask cheap.

Why preallocated? The hot path must not trigger garbage collection. By reusing the same 128 objects, we avoid creating any new objects during measurement. The `name` property is always a string literal reference captured in the closure at stopwatch creation time — assigning it to the slot is a pointer copy, not an allocation.

### Higher-order function for function boundaries

`stopwatch(name, fn)` always returns a wrapper. The wrapper checks the `enabled` flag at call time, so `enableInstrumentation()` can be called at any point — before or after wrapping — and all existing stopwatches will begin recording. When disabled, the wrapper delegates directly to `fn` with no timestamps or buffer writes.

The per-call branch (checking `enabled`) is negligible: the CPU's branch predictor learns the never-taken pattern immediately, and the cost is a single comparison instruction per call. This is an acceptable tradeoff for the flexibility of late activation.

The wrapper is a plain function, not a method on an object — no property lookup, no prototype chain walk, no hidden class transition.

### Callback wrapper for inline blocks

`measure(name, fn)` accepts an arbitrary callback and invokes it. When disabled, it calls `fn()` directly. JavaScript engines are effective at inlining small, monomorphic call sites — an arrow function that always has the same shape at the same call site is an ideal candidate. The function-call overhead, in practice, should optimize away.

### Idle flush with coalescing

The first buffer write after a flush schedules an idle callback. Subsequent writes are coalesced — the `pendingFlush` flag prevents redundant scheduling. This means:

- One idle callback per flush cycle, regardless of how many entries are written
- No scheduling overhead on the hot path after the first write
- If new entries arrive during a flush, the flush reschedules itself

A consequence of this design is that if the browser never goes idle, the flush never fires and entries remain in the buffer indefinitely (or are overwritten as the circular buffer wraps). The framework optimizes for hot-path instrumentation, and does not attempt to detect this scenario. Instead, `useTimeoutForFlush()` lets the caller opt into `setTimeout`-based flushing.

### Synchronous code paths only

The instrumentation measures the wall-clock time between two `performance.now()` calls that bracket the measured function. This captures exactly the synchronous work — the code that blocks the main thread and causes jank.

Async functions are out of scope. If a measured function returns a Promise, the recorded duration is the time to _create_ the promise, not to _resolve_ it. The interesting work in an async workflow happens after the function returns, across microtask boundaries and event loop ticks. While `measure()` may be used to monitor the runtime between async calls, measuring the duration of async tasks requires a different approach.

### Poison mechanism

`poison(name)` writes a `${name}:poison` mark to the Performance Timeline. Consumers extracting measures via `performance.getEntriesByName()` should check for the corresponding poison mark before trusting the data. The convention is explicit and visible in browser developer tools — a poisoned measurement is impossible to overlook when inspecting the timeline.

Poisoning is not automatic so that the framework can instrument error paths.

## Further optimization opportunities

The current design uses a runtime `enabled` flag checked at call time. This is simple, flexible (instrumentation can be activated at any point), and the overhead is negligible — a single predicted branch per call. But it's not zero.

A compile-time build gate (e.g., a webpack `DefinePlugin` constant) could eliminate that remaining overhead entirely. When the flag is `false` at build time, the minifier strips the dead branches and the instrumented code paths cease to exist in the bundle. The `stopwatch` wrapper becomes a pure passthrough with no branch at all.

Content scripts are currently excluded from Terser minification (`webpack.base.js`), so a compile-time flag alone would produce `if (false) { ... }` blocks that ship as inert bytes but are never executed. If content script minification is ever enabled, those dead branches would be stripped automatically — achieving true zero-cost instrumentation in production builds.
