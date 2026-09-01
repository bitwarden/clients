# Autofill monitoring lifecycle

## The problem

Bitwarden's autofill content scripts are injected into every page a user visits. They examine form fields, observe DOM mutations, position the inline menu, and surface notifications. That examination is valuable when the user has reason to want it, and inert work otherwise.

One such case is alignment with login state:

- When there is no account logged in, observation is unnecessary.
- When a user logs in, observation becomes necessary.
- When a user logs out, observation should stop.

These transitions should be immediate, but this presents a problem. Once injected, a content script cannot be unloaded. Only extension context loss, such as during navigation or a page refresh, removes it. Refreshing is not an option, as it could lose the user's in-progress work. Neither can navigation be relied upon within single-page apps. Thus, the solution must toggle the monitoring feature in the content script.

## Architecture

A content script's life has two scopes:

- _Monitoring_ is the active and reversible scope — it gathers indicators of fillable elements on the page and protects the integrity of autofill overlays. Its resources (observers, cached field maps, integrity-check timers) exist only while monitoring is in flight.
- _Disposal_ is the terminal scope — it removes injected DOM, nulls iframes, and tears down the rest of the graph.

These scopes are formalized by separate interfaces. The `AutofillMonitor` contract takes the reversible scope; `destroy()`, where present, takes the terminal one. Where both apply to a service, `destroy()` chains through `stopMonitoring()` first, so terminal cleanup always begins from a fully-detached state.

Monitoring may be entered and exited many times during a single content script's life, absorbing every on-demand toggle. Disposal happens exactly once, at the end, and is irreversible.

UI concerns — the autofill context menu, the overlay's event handlers, the notification surfaces — are deliberately _outside_ the monitoring scope. They are part of the always-on UI plane, not the examination system. Their interaction with monitoring is one-directional: they read monitoring's caches when monitoring is in flight, and find empty state when it is not. Empty state is a valid outcome at every UI consumer; the absence of monitoring data is itself the gate that keeps the UI inert.

The **autofiller actor** (`autofiller.ts`) is a separate concern again. It performs auto-fill-on-page-load — it triggers fills, it does not examine field data — and follows an asymmetric lifecycle described below.

## The `AutofillMonitor` contract

```ts
interface AutofillMonitor {
  startMonitoring(): void;
  stopMonitoring(): void;
}
```

The contract describes what implementors must guarantee so that the controller above them can reason about lifecycle correctness without knowing the details of any particular monitor.

### Construction is inert

Constructors do no I/O and attach no listeners to globals. A freshly-constructed monitor produces no observable effects on the page; real work begins only when `startMonitoring()` is called.

Because construction has no side effects, the bootstrap constructs every monitor unconditionally, regardless of the auth state at injection time. A bootstrap injected into a logged-out tab sits in the page without examining anything until a signal arrives to begin.

### Monitoring is reversible and may repeat

`startMonitoring()` and `stopMonitoring()` may each be called many times across a content script's life. `startMonitoring()` begins examination against the page as it is at the moment of the call; `stopMonitoring()` detaches what was attached and discards what was cached.

Both methods are idempotent. A call to either is safe whether the monitor is currently running or not. Idempotency lets the controller call `stopMonitoring()` from any cleanup path — including disposal — without first checking state, and lets the protocol treat lifecycle commands as plain toggles rather than state-aware transitions.

### Monitoring-scoped state is cleared on stop

Any data a monitor caches in service of its examination — field maps, integrity-check state, fill-history bookkeeping — is monitoring-scoped. `stopMonitoring()` clears that state along with detaching observers. A future `startMonitoring()` begins with a clean view of the current page rather than reasoning against stale data left over from a prior session.

Clearing on stop is also what keeps the always-on UI safe while monitoring is paused. UI handlers that consult monitoring data find empty state and gracefully no-op. There is no in-flight "monitoring is paused" flag the UI has to consult; the cache being empty is the signal.

### The controller is the sole lifecycle caller

Monitors compose under a controller (the content-script services compose under `AutofillInit`). The controller is the only thing that calls `startMonitoring()` or `stopMonitoring()` on its sub-monitors. Sub-monitors do not call each other; external collaborators do not reach into them.

One owner of lifecycle calls means lifecycle reasoning is local to the controller. The controller decides which transitions are reachable and from where; sub-monitors do not need to coordinate.

### `destroy()` ≡ `stopMonitoring()` + disposal

Services that own both reversible and terminal work expose both methods. The identity holds: `destroy()` calls `stopMonitoring()` first, then performs disposal — UI removal, iframe nulling, terminal tombstones that mark the service unusable.

This composition keeps each scope focused. Anything reversible belongs to monitoring; anything that requires graph-wide teardown belongs to disposal. The two never entangle.

## The autofiller actor

`apps/browser/src/autofill/content/autofiller.ts` is a separate content script that performs auto-fill-on-page-load. By design it acts only at page-load time; once a page is loaded and the autofill attempt has happened, the actor has nothing further to do until the URL changes. Because filling is bound to page load, an actor can be disabled without a reciprocal enable — disabling halts the URL-change poll, and the next page-load injection (gated separately) decides whether a fresh actor appears.

The actor is **not** an `AutofillMonitor`; it triggers fills, it does not examine field data. Its lifecycle is asymmetric in three respects:

- **Injection-gated start.** `autofiller.js` is added to the injection list only when `triggeringOnPageLoad && autoFillOnPageLoadIsEnabled`, and `autoFillOnPageLoadIsEnabled` can only be true when the user is unlocked. Locked or logged-out users get no fresh autofiller on a navigation; injection itself is the authorization gate.
- **Survives lock.** A running autofiller continues to poll for URL changes through `Unlocked → Locked`. The background ignores its fill requests while the vault is locked; on `Locked → Unlocked` the existing actor resumes triggering fills with no message exchange. Only logout disables a running actor.
- **Message-driven disable on logout.** On the transition into `LoggedOut`, any running autofiller halts on receipt of `AutofillerCommand.disable`. The handler reuses the existing `handleExtensionDisconnect` cleanup — clearing the interval and any pending delay timeout — so disable and context-loss teardown share a single code path.
- **Terminal teardown on context loss.** Already responds to `setupExtensionDisconnectAction`.

There is no `enableAutofiller` message. Re-enabling happens by re-injection on the next page-load when the user is unlocked. The autofiller's content-script lifecycle, in full: _inject (when unlocked) → run → (disable on logout | dispose on context loss)_.

## The lifecycle protocol

Lifecycle messages flow one-way from the background to content scripts. Three commands compose the protocol:

- **start monitors** — content scripts begin or resume examination
- **stop monitors** — content scripts pause examination
- **disable autofiller** — running autofiller actors halt

The first two are paired and symmetric; the third is asymmetric. All three commands are idempotent at their receivers, so the broadcast layer can fan out without worrying about exact receiver state.

### Routing

The background maintains one routing-relevant data structure: the set of currently-connected content-script ports, indexed by `(tab, frame)`. Each injected bootstrap and each autofiller actor registers a port at injection time and deregisters on extension context loss. The set is consulted when a lifecycle command needs to fan out to every open content script.

### Triggers

Two events emit lifecycle commands. One auth-state boundary drives all of the broadcast traffic:

| Trigger           | Target               | Commands sent                                                                  |
| ----------------- | -------------------- | ------------------------------------------------------------------------------ |
| Per-tab injection | One `(tab, frame)`   | `start monitors` if the user is logged in (Locked or Unlocked); otherwise none |
| Login             | Every `(tab, frame)` | `start monitors`                                                               |
| Logout            | Every `(tab, frame)` | `stop monitors` _and_ `disable autofiller`                                     |

The `Unlocked` boundary participates separately, but only at injection time: it gates whether a fresh navigation gets an autofiller. Transitions across `Unlocked` (lock and unlock events) do not emit any broadcast.

### Message sequences

#### Logging in (`LoggedOut → Locked` or `LoggedOut → Unlocked`)

```mermaid
sequenceDiagram
    participant BG as Background
    participant CS as Content script
    Note over BG: auth state crosses LoggedOut boundary
    BG->>CS: start monitors
    Note over CS: attach observers, begin examining
```

Sent to every `(tab, frame)` in the port set.

#### Logging out (any logged-in state → `LoggedOut`)

```mermaid
sequenceDiagram
    participant BG as Background
    participant CS as Content script
    participant AF as Autofiller actor
    Note over BG: auth state crosses LoggedOut boundary
    BG->>CS: stop monitors
    Note over CS: detach observers, clear caches
    BG->>AF: disable autofiller
    Note over AF: halt interval
```

`disable autofiller` is sent to every tab in the port set. Tabs that never had an autofiller (because the user was Locked at the time of their navigation) receive the message and no-op.

#### Locking the vault (`Unlocked → Locked`)

No broadcast. Monitors continue. A running autofiller actor continues its URL-change poll; the background ignores its fill requests until the vault is unlocked again. New navigations during the locked window get no autofiller (injection gate).

#### Unlocking the vault (`Locked → Unlocked`)

No broadcast. Monitors are already running. An autofiller actor surviving from a prior Unlocked window resumes triggering fills with no message exchange. Tabs that navigated during the locked window pick up an autofiller on their next navigation, via the injection gate.

#### New tab or frame on navigation

```mermaid
sequenceDiagram
    participant Page
    participant BG as Background
    participant CS as Content script (freshly injected)
    Page->>BG: navigation triggers injection
    BG->>CS: inject bootstrap (+ autofiller if Unlocked)
    opt user is logged in
        BG->>CS: start monitors
    end
    Note over CS: if no start was sent, sit inert
```

A page-level trigger script at `document_start, all_frames, *://*/*` wakes the service worker on every navigation regardless of auth state, so this flow runs on every new tab and frame — including for logged-out users, whose tabs end up with an inert bootstrap and no autofiller.

## Disposal

The graph-wide disposal path fires exactly once, on extension context loss. It runs `stopMonitoring()` first so disposal always begins from a known, fully-detached state. Then it removes the always-on listeners (the background-message listener and the context-menu listener), clears terminal scratchpads, and calls `destroy()` on each sub-service for the graph-wide cleanup of UI, iframes, and any other resources that have no place in monitoring's reversible scope.
