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

1. **Minimal hot-path overhead.** Code on hot paths should not allocate objects, cross the JS-to-native boundary, or perform work proportional to anything other than the measurement itself.

2. **Two measurement modalities.** Callers need both span measurements and point measurements. Span measurements track the wall-clock time spent in a synchronous code path. Point measurements track when an event occurred, along with metrics describing the event.

3. **No external dependencies.** Content scripts are bundled as separate webpack entry points. Importing shared utility barrels pulls in unrelated code. The instrumentation module must be self-contained.

4. **Cross-browser compatibility.** Chrome, Firefox, and Safari all need to work. The Performance API (User Timing Level 3, including the `detail` option on `performance.mark`) is available in all target browsers.

## Information architecture

The data flows through two stages, each with a different performance budget:

### Stage 1: Capture (hot path)

Records into a preallocated circular buffer slot. The framework provides two capture paths:

- **Watch entry**: a name (string reference captured at wrap time), a start timestamp, and an end timestamp. Budget: two `performance.now()` reads and three slot field assignments.
- **Meter entry**: a timestamp plus N positional values typed `string | number | boolean`. Budget: one `performance.now()` read and `1 + N` slot field assignments.

No objects are allocated in either path, no Web APIs are called, and no strings are built. Slot storage is pre-allocated when the corresponding higher-order function is called.

### Stage 2: Flush

Drains the buffers and materializes each entry as User Timing entries. A watch entry becomes a pair of `performance.mark` calls and a `performance.measure` spanning them. A meter entry becomes a single `performance.mark` with a `detail` object reconstructed from the registered keys and the slot's positional values. Flush runs via `setTimeout(0)`, so the hot path returns immediately and the materialization happens at the next macrotask boundary.

### Name stability

Each stage produces entries with structured names. For a span named `"foo"`, the watch marks are `foo:start:autofill:bw` and `foo:end:autofill:bw`, the measure is `foo:autofill:bw`, and any poison mark is `foo:poison:autofill:bw`. For a meter named `"foo"`, the point mark is `foo:meter:autofill:bw`.

These names are part of the public contract — they are visible in browser developer tools and relied upon by test infrastructure. Changing the suffix convention (`:start`, `:end`, `:meter`, `:poison`, `:autofill:bw`) is a breaking change.

### Privacy

All stages operate exclusively within the browser's built-in Performance API. Measurement data lives in the page's `performance` timeline — the same timeline visible in Chrome DevTools or the Firefox Profiler. No data is collected by the extension or stored beyond the page's lifetime. It is ephemeral: it exists only while the page is open and is cleared when the page navigates away.

Data collection, aggregation, and reporting are explicitly out of scope. The instrumentation provides the raw measurement capability; how that data is consumed is a separate concern handled by the testing framework or developer workflow.

## Design decisions

### Higher-order functions for amortized setup

The instrumentation API uses higher-order functions throughout. They serve two complementary roles:

- **Amortizing setup.** `stopwatch` and `createMeter` do their setup work once at the point of registration: name binding, buffer allocation (for meters), key capture, closure construction. The returned function is a plain closure that writes into preallocated state. This is what keeps the hot path zero-allocation.
- **Accepting one-shot callbacks.** `measure` accepts a function and invokes it immediately. There's no amortized setup, but accepting a function is how a code block becomes bracketable without forcing the caller to write start/end markers manually. JS engines inline monomorphic lambdas at the same call site, so the overhead is minimal in practice.

The closures returned by `stopwatch` and `createMeter` are plain functions, not methods. Plain functions stay statically bound at the call site — there's no prototype chain, no hidden-class transitions on `this`. We only introduce indirection where it already exists: a wrapped method already pays for a method dispatch; a `forEach` callback already pays for a function call. Where there's no existing indirection, we don't add any.

The three primitives express these roles with different shapes:

- `stopwatch(name, fn)`: takes a function and returns an instrumented wrapper. The wrapper replaces the original reference.
- `measure(name, fn)`: takes a one-shot callback and invokes it. Used at sites that aren't already function boundaries.
- `createMeter(config, ...keys)`: takes configuration and zero or more field names, returns a positional-args writer.

### Preallocated buffers sized by bit-resolution

Buffers are sized in bits of resolution, not by slot count. The size is `1 << bits` and the mask is `(1 << bits) - 1`. This makes the power-of-two invariant structural. There is no way to misconfigure a non-power-of-two size that breaks the bitmask wrap.

Two kinds of buffer exist:

- **Watch buffer.** A single global buffer. Each slot is a plain object with `name`, `start`, and `end` properties, pre-allocated at module load. 10 bits is sized for the largest mutation-observer bursts the framework needs to absorb in one task cycle.
- **Meter buffers.** Each `createMeter` call allocates its own buffer. This defaults to 256 slots, and is overridable for meters in tight inner loops. Each slot is a pre-allocated array containing the positional values of the meter. The framework reconstructs the keyed `detail` object from this row at flush time.

Slot values for meters are stored in plain arrays rather than typed arrays. This avoids two-dimensional indexing (`slotIndex × fieldsPerSlot`) competing with the bitmask wrap, and lets values be `string | number | boolean` without a separate encoding path.

When `enabled === false`:

- The watch buffer initializes to one dead slot (0 bits). Wrappers short-circuit before writing, so the slot is never used.
- `createMeter` allocates nothing and returns a shared `NOOP`. No meter buffer exists in production.

### Deferred flush with coalescing

The first buffer write after a flush schedules a flush via `setTimeout(0)`. Subsequent writes coalesce — a `pendingFlush` flag prevents redundant scheduling. The flush runs as a single macrotask, draining the watch buffer and every registered meter.

Coalescing keeps flush cost bounded per burst: one `setTimeout` registration per cycle regardless of how many entries land in the buffers. If new entries arrive during a flush, the flush reschedules itself.

The flush runs on the main thread and can compete with paint and input handlers. Its work is bounded by what was written between scheduling and dispatch. Buffer capacity exists for unusually large bursts; in steady state, slots are written and drained within the same task cycle.

### Synchronous code paths only

The instrumentation measures wall-clock time between two `performance.now()` calls that bracket the measured function. This captures exactly the synchronous work — the code that blocks the main thread and causes jank.

Async functions are out of scope. If a measured function returns a Promise, the recorded duration is the time to _create_ the promise, not to _resolve_ it. The interesting work in an async workflow happens after the function returns, across microtask boundaries and event loop ticks. `measure()` may be used to monitor the runtime between async calls, but measuring the duration of async tasks requires a different approach.

### Poison mechanism

`poison(name)` writes a `${name}:poison:autofill:bw` mark to the Performance Timeline. Consumers extracting watch measures via `performance.getEntriesByName()` should check for the corresponding poison mark before trusting the data. The convention is explicit and visible in browser developer tools — a poisoned measurement is impossible to overlook when inspecting the timeline.

Poisoning is not automatic so that the framework can instrument error paths.

Poisoning applies only to watch entries. A watch entry brackets a duration; if something unexpected happens mid-flight, the timing is unreliable but already written. Meter entries are atomic points — they either get written or they don't, so there is no equivalent failure mode.

## Build-time activation gate

Instrumentation is activated only when the bootstrap is compiled with `BW_INCLUDE_CONTENT_SCRIPT_MEASUREMENTS=true`. webpack's `DefinePlugin` substitutes the env var with a literal boolean at build time. `performance.ts` reads it once at module load:

```ts
const enabled = process.env.BW_INCLUDE_CONTENT_SCRIPT_MEASUREMENTS;
```

In benchmark builds this folds to the literal `true`; in production builds it folds to the literal `false`. The constant cannot be flipped at runtime — there is no exported control.

### Why a build-time gate, not a runtime control

A runtime knob — a window global, a localStorage entry, a custom event the page can dispatch — would let a hostile host page enable autofill instrumentation against itself. Once enabled, the page could read the resulting `performance.measure` entries directly and observe the timing of internal autofill operations against its own DOM. That is a side channel into how the extension handles credentials, and we don't want it to exist as an addressable surface.

Build-time gating closes that surface. In production, the flag is the literal `false`; every code path gated on it short-circuits; meter buffers are never allocated; the watch buffer is a single dead slot. There is no runtime variable for any caller — page or otherwise — to flip.

### What the gate does not do

Content scripts are excluded from Terser minification (`webpack.base.js`), so the dead branches survive in the production bundle as dead code. If the content-script Terser exclusion is ever revisited, those branches would be stripped automatically and the instrumented code paths would cease to exist in production at all.
