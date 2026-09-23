# Autofill monitoring lifecycle

Bitwarden's autofill content scripts are injected into every page a user visits. They examine form fields, observe DOM mutations, position the inline menu, and surface notifications. That examination is valuable when the user has reason to want it, and inert work otherwise. The autofill monitoring lifecycle governs when monitors are running and signals when a lifecycle transitions.

## Background

Autofill runs inside an environment shaped by four lifecycles it observes but does not own:

- **The page lifecycle** — a page loads, then navigates. Within a single-page app a navigation swaps content without reloading the document, so a content script, once injected, persists across many navigations.
- **The account lifecycle** — an account logs in, locks and unlocks, and logs out. Examination is warranted only while an account is logged in: it should begin at login and stop at logout.
- **The extension lifecycle** — the extension process starts and stops. Firefox runs Manifest V2 with a persistent background page; Chrome runs Manifest V3, whose background is a service worker the browser terminates and restarts at will. In-memory background state is therefore durable on Firefox but ephemeral on Chrome, where it must be reconstructed on each restart.
- **The tab lifecycle** — a browser holds many open tabs, but the user views one at a time, switching among tabs and among windows. Each window has exactly one active tab; the rest sit behind it until the user returns to them.

These four are out of autofill's control; autofill must align its own behavior with them. The obstacle is that a content script, once injected, cannot be unloaded — only extension context loss, such as a navigation or page refresh, removes it. Refreshing is not an option, as it could lose the user's in-progress work, and navigation cannot be relied upon within single-page apps. So examination cannot be governed by injecting and unloading content scripts; it must be toggled in place as the lifecycles above demand.

## Architecture

Autofill's in-scope concern is the **monitoring lifecycle** — when autofill is actively engaged with a page. This work lives entirely in content scripts and is directed at the page: `AutofillMonitor` implementations examine fields and guard overlay integrity, and a separate page-transition monitor watches for loads and navigations.

The background `AutofillLifecycleService` owns this lifecycle. It starts and stops the content-script monitors as the account lifecycle crosses the logged-in boundary and as the user's active tab changes, and rebuilds them across the extension lifecycle when Manifest V3 restarts. The active-tab transitions it acts on are mediated by gates that impose deliberate entry and exit delays — a structural feature of the design, even as the specific delays remain tuned constants outside it. Page-transition reports flow to it, and it reconciles them against the account, extension, and tab lifecycles to decide what they warrant. It does not perform autofill itself: it emits a reconciled event, and the autofill machinery acts on it. The monitors stay simple: they examine and report.

Knowing which frames are live is one of the service's responsibilities. Every injected frame is a content script the service can address, and that knowledge is what protocol commands are sent to and what tells the service when a buffered transition can no longer be honored — when a frame is gone, a transition still waiting on it is dropped.

A content script's life has two scopes:

- _Monitoring_ is the active and reversible scope — it gathers indicators of fillable elements on the page and protects the integrity of autofill overlays. Its resources (observers, cached field maps, integrity-check timers) exist only while monitoring is in flight.
- _Disposal_ is the terminal scope — it removes injected DOM, nulls iframes, and tears down the rest of the graph.

These scopes are formalized by separate interfaces. The `AutofillMonitor` contract takes the reversible scope; `destroy()`, where present, takes the terminal one. Where both apply to a service, `destroy()` chains through `stopMonitoring()` first, so terminal cleanup always begins from a fully-detached state.

Monitoring may be entered and exited many times during a single content script's life, absorbing every on-demand toggle. Disposal happens exactly once, at the end, and is irreversible.

UI concerns — the autofill context menu, the overlay's event handlers, the notification surfaces — are deliberately _outside_ the monitoring scope. They are part of the always-on UI plane, not the examination system. Their interaction with monitoring is one-directional: they read monitoring's caches when monitoring is in flight, and find empty state when it is not. Empty state is a valid outcome at every UI consumer; the absence of monitoring data is itself the gate that keeps the UI inert.

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

Clearing on stop is also what keeps the always-on UI safe while monitoring is stopped. UI handlers that consult monitoring data find empty state and gracefully no-op. There is no in-flight "monitoring is off" flag the UI has to consult; the cache being empty is the signal.

### The controller is the sole lifecycle caller

Monitors compose under a controller (the content-script services compose under `AutofillInit`). The controller is the only thing that calls `startMonitoring()` or `stopMonitoring()` on its sub-monitors. Sub-monitors do not call each other; external collaborators do not reach into them.

One owner of lifecycle calls means lifecycle reasoning is local to the controller. The controller decides which transitions are reachable and from where; sub-monitors do not need to coordinate.

### `destroy()` ≡ `stopMonitoring()` + disposal

Services that own both reversible and terminal work expose both methods. The identity holds: `destroy()` calls `stopMonitoring()` first, then performs disposal — UI removal, iframe nulling, terminal tombstones that mark the service unusable.

This composition keeps each scope focused. Anything reversible belongs to monitoring; anything that requires graph-wide teardown belongs to disposal. The two never entangle.

## The tab lifecycle

The browser reports one fact about attention: which tab is active. A tab is active when it is the active tab **in its own window**, and autofill reads that fact per window — window focus is not consulted, so alt-tabbing between two windows changes neither window's active tab and leaves autofill undisturbed.

Autofill does not act on that raw fact directly. It maintains three states over it:

- **Away** — the resting state of any tab the user is not working in. Autofill does nothing: no monitoring runs, and the tab holds none of the monitoring-scoped resources `stopMonitoring()` clears, so it costs nothing on its host page. A freshly-activated tab stays away until it has been active long enough to commit.
- **Committed** — the tab autofill treats as the one the user is working in. A tab becomes committed once it has stayed active long enough to be more than a tab passed through. Monitoring runs, and filling happens only here, so a fill lands where the user is actually looking.
- **Cooling down** — a committed tab the user has just left. Autofill keeps monitoring it briefly, so a quick return finds monitoring already in flight, but the tab is no longer committed, so nothing fills there. When the cool-down elapses the tab falls back to away and monitoring stands down.

Monitoring therefore runs while a tab is committed or cooling down, and only then; an away tab is inert.

"Active" is a real state, owned by the browser; "away", "committed", and "cooling down" are virtual states, owned by autofill and layered on top of it. The gates that move a tab between these virtual states, the delays that make them stable, and the churn those delays exist to absorb belong to the protocol's [gating and delays](#gating-and-delays).

## The page lifecycle

A page-lifecycle monitor watches for the moments a page becomes ready to act on — its load, and the navigations that follow — and reports each as a transition. It does not examine field data and is **not** an `AutofillMonitor`. The autofiller (`apps/browser/src/autofill/content/autofiller.ts`) is the current monitor of this lifecycle. The browser surfaces no reliable signal for single-page-app navigation, so the autofiller synthesizes these transitions itself: it polls for URL changes and reports each as a `pageTransitionDetected` fact to the background. Like the tab lifecycle's committed and cooling-down states, a page transition is a virtual state autofill maintains, not a fact the browser hands it.

Reporting is one-directional. The monitor states that a transition happened; it does not consult monitoring state, settings, or auth status, and it does not decide whether a fill should follow. Those are the background's decisions, made at a single evaluation point (see [Buffering transitions](#buffering-transitions)). This keeps the page-lifecycle monitor simple and lets new transition producers feed the same point without each re-deriving policy.

The autofiller's content-script lifecycle is asymmetric in the following respects:

- **Injection-gated start.** `autofiller.js` is added to the injection list only when `triggeringOnPageLoad && autoFillOnPageLoadIsEnabled`, and `autoFillOnPageLoadIsEnabled` can only be true when the user is unlocked. Locked or logged-out users get no fresh autofiller on a navigation; injection itself is the authorization gate.
- **Survives lock.** A running autofiller continues to poll for URL changes through `Unlocked → Locked`. The background ignores its transition reports while the vault is locked; on `Locked → Unlocked` it resumes reporting with no message exchange. Only logout disables a running monitor.
- **Message-driven disable on logout.** On the transition into `LoggedOut`, any running autofiller halts on receipt of `AutofillerCommand.disable`. The handler reuses the existing `handleExtensionDisconnect` cleanup — clearing the interval and any pending delay timeout — so disable and context-loss teardown share a single code path.
- **Terminal teardown on context loss.** On extension context loss the autofiller disposes permanently, via the `setupExtensionDisconnectAction` handler it already registers.

There is no `enableAutofiller` message. Re-enabling happens by re-injection on the next page-load when the user is unlocked. The autofiller's content-script lifecycle, in full: _inject (when unlocked) → report transitions → (disable on logout | dispose on context loss)_.

### Buffering transitions

Autofill can only fill a frame that is monitoring — monitoring is what makes the page details available to act on. A page-load fill therefore depends on monitoring, and the two are not ordered against each other: injection adds the autofiller, which begins reporting at page load, while the `start monitors` command follows separately. A transition can be reported before monitoring has started on a freshly-injected frame.

The background bridges that sequencing gap with a buffer that carries each reported transition through a small state machine, keyed on `(tab, frame)` so simultaneous navigations across many frames advance independently. Only the latest transition per frame is kept; a fresh transition replaces the one before it.

A transition occupies one of these states:

- **Pending** — reported, and waiting for its frame's tab to be committed (see [The tab lifecycle](#the-tab-lifecycle)) and an account to be logged in. A transition reported when those conditions already hold passes through pending at once.
- **Paused** — its tab went inactive before it could resolve. Because monitoring itself may stand down while a tab is away, a paused transition can outlive active monitoring; it is held until its tab is committed again.
- **Resolved** — its conditions are met, and it leaves the buffer as an opportunity for autofill to act on (see [`autofill.design.md`](./autofill.design.md)).
- **Retired** — its frame disconnected, or the account logged out, and it is discarded, so it never outlives the conditions that kept it alive.

```mermaid
stateDiagram-v2
    [*] --> Pending: transition reported
    Pending --> Resolved: tab committed
    Pending --> Paused: tab goes inactive
    Paused --> Resolved: tab committed again
    Pending --> Retired: frame lost / logout
    Paused --> Retired: frame lost / logout
    Resolved --> [*]: opportunity surfaced
    Retired --> [*]: dropped
```

Committing the tab resolves a pending or paused transition; losing the frame or logging out retires it. **Retirement always wins:** a transition paused on an inactive tab retires the instant the account logs out, since a transition that resolved after logout would surface a fill on a logged-out account — precisely what the account lifecycle exists to prevent.

This state machine is virtual. The implementation holds no explicit state field; it folds three reactive inputs — the reported transition, the commit signal, and retirement events — into the same behavior a discrete machine would produce. The states are a way to reason about the fold, not objects the code instantiates.

A resolved transition leaves the service as a signal that this frame has reached a point where autofill _may_ act. Whether a fill actually happens is autofill's decision, governed by its own settings and policy (see [`autofill.design.md`](./autofill.design.md)) and independent of the lifecycle. This is the reciprocal of one-directional reporting: producers report facts, the lifecycle reconciles them into an opportunity, and autofill decides what to make of it.

## The lifecycle protocol

Lifecycle messages flow one-way from the background to content scripts. Three commands compose the protocol:

- **start monitors** — content scripts begin or resume examination
- **stop monitors** — content scripts stand down examination
- **disable autofiller** — running autofillers halt their page-lifecycle reporting

The first two are paired and symmetric; the third is asymmetric. All three commands are idempotent at their receivers, so the broadcast layer can fan out without worrying about exact receiver state.

### Routing

Knowing which frames are live (above) is what makes routing possible: each injected bootstrap and autofiller is a content script the service can address, from injection until extension context loss. A lifecycle command fans out to every live `(tab, frame)`.

Frame liveness is in-memory background state, so it does not survive a Manifest V3 restart. On restart the background re-injects into every open tab, re-establishing both the connections it tracks and monitoring itself. That rebuild is on the critical path for the page-load fill: because a fill depends on monitoring, a transition reported after a restart cannot be honored until monitoring has been re-established for its frame.

A restart loses more than frame liveness. The gate timers and the monitoring state they compute are in-memory too, so a service worker terminated while a tab is cooling down comes back with no memory of which tabs were monitoring or counting down. Reconstruction is gated the same way steady-state monitoring is: the background re-establishes which tab is active in each window _before_ any reconnection-driven monitor start runs, so monitoring is rebuilt only on tabs the user is viewing. A cool-down lost to termination cannot leave a monitor stranded on a tab the user has left, nor can a reconnecting frame on such a tab resurrect monitoring the lost cool-down would have torn down.

### Gating and delays

Driving monitoring straight off the browser's raw active/inactive signal would churn: standing monitoring down discards the field maps and observer graph it built, and standing it back up rebuilds them from scratch. A user cycling through tabs with ctrl+tab, or flipping to a tab and straight back, would pay that teardown-and-rebuild cost on every flick. Two gates absorb the churn by delaying the state transitions the tab lifecycle triggers, and they are deliberately asymmetric.

- The **commit gate** delays _entry_: a newly-active tab becomes committed only after it has stayed active for a short settling interval. A tab merely passed through never commits, so ctrl+tab cycling triggers nothing.
- The **cool-down gate** delays _exit_: a tab the user leaves keeps monitoring for a cool-down interval before it stands down. A flip-back inside that interval finds monitoring still in flight and rebuilds nothing.

The gates are chained — cool-down is measured from the moment a tab stops being committed — so monitoring inherits the commit delay on the way up and adds the cool-down delay on the way down. That asymmetry lets monitoring start decisively yet linger cheaply.

The commit gate does double duty: it is also the fill gate. Because a fill lands only on a committed tab, and a tab stops being committed the instant it goes inactive, a fill only ever lands on the tab in front of the user — never on one still monitoring through its cool-down. Monitoring lingers through cool-down solely to spare a rebuild; the window in which a fill may land is exactly the committed window, no wider.

The settling and cool-down intervals are tuned constants, chosen to sit below the time of a deliberate return to a tab; their values are an operational tuning concern, not part of the design.

### Triggers

Lifecycle commands are emitted on account-state boundaries and on tab state changes. Every `start monitors` is gated on the tab being committed; only the logout `stop` fans out to everything:

| Trigger                 | Target                          | Commands sent                                                                                             |
| ----------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Per-tab injection       | One `(tab, frame)`              | `start monitors` if the user is logged in (Locked or Unlocked) _and_ the tab is committed; otherwise none |
| Login                   | Every committed `(tab, frame)`  | `start monitors`                                                                                          |
| Tab becomes committed   | Every `(tab, frame)` on the tab | `start monitors`, if the user is logged in                                                                |
| Tab leaves cooling down | Every `(tab, frame)` on the tab | `stop monitors`                                                                                           |
| Logout                  | Every `(tab, frame)`            | `stop monitors` _and_ `disable autofiller`                                                                |

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

Sent to every live `(tab, frame)` on a committed tab. Logged-in tabs the user is not viewing stay inert until they become committed.

#### Logging out (any logged-in state → `LoggedOut`)

```mermaid
sequenceDiagram
    participant BG as Background
    participant CS as Content script
    participant AF as Autofiller
    Note over BG: auth state crosses LoggedOut boundary
    BG->>CS: stop monitors
    Note over CS: detach observers, clear caches
    BG->>AF: disable autofiller
    Note over AF: halt interval
```

`disable autofiller` is sent to every live tab. Tabs that never had an autofiller (because the user was Locked at the time of their navigation) receive the message and no-op.

#### Locking the vault (`Unlocked → Locked`)

No broadcast. Monitors continue. A running autofiller continues its URL-change poll; the background ignores its transition reports until the vault is unlocked again. New navigations during the locked window get no autofiller (injection gate).

#### Unlocking the vault (`Locked → Unlocked`)

No broadcast. Monitors are already running. An autofiller surviving from a prior Unlocked window resumes reporting transitions with no message exchange. Tabs that navigated during the locked window pick up an autofiller on their next navigation, via the injection gate.

#### Switching to and from a tab (logged in)

```mermaid
sequenceDiagram
    participant U as User
    participant BG as Background
    participant CS as Content script
    U->>BG: switches to a tab
    Note over BG: tab settles → committed
    BG->>CS: start monitors
    Note over CS: attach observers, begin examining
    U->>BG: switches away
    Note over BG: tab leaves cooling down → monitoring stands down
    BG->>CS: stop monitors
    Note over CS: detach observers, clear caches
```

Sent only while an account is logged in; a logged-out tab never monitors regardless of which tab is active. A flip-back during cool-down finds monitoring still in flight and sends nothing.

#### New tab or frame on navigation

```mermaid
sequenceDiagram
    participant Page
    participant BG as Background
    participant CS as Content script (freshly injected)
    Page->>BG: navigation triggers injection
    BG->>CS: inject bootstrap (+ autofiller if Unlocked)
    opt user is logged in and the tab is committed
        BG->>CS: start monitors
    end
    Note over CS: if no start was sent, sit inert
```

A page-level trigger script at `document_start, all_frames, *://*/*` wakes the service worker on every navigation regardless of auth state, so this flow runs on every new tab and frame — including for logged-out users, whose tabs end up with an inert bootstrap and no autofiller. A logged-in user's tab that is not the active tab is likewise left inert at injection; it begins monitoring only once it becomes committed.

## Disposal

The graph-wide disposal path fires exactly once, on extension context loss. It runs `stopMonitoring()` first so disposal always begins from a known, fully-detached state. Then it removes the always-on listeners (the background-message listener and the context-menu listener), clears terminal scratchpads, and calls `destroy()` on each sub-service for the graph-wide cleanup of UI, iframes, and any other resources that have no place in monitoring's reversible scope.
