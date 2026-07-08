import { BehaviorSubject, firstValueFrom, Subject } from "rxjs";
import { filter, map, mergeMap, pairwise, scan, startWith, take, takeUntil } from "rxjs/operators";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { BrowserApi } from "../../platform/browser/browser-api";
import {
  AutofillerCommand,
  AutofillLifecycleCommand,
  AutofillMessageCommand,
} from "../enums/autofill-message.enums";
import { AutofillPort } from "../enums/autofill-port.enum";

import { AutofillLifecycleService } from "./abstractions/autofill-lifecycle.service";

type PortEvent =
  | { type: "connect"; port: chrome.runtime.Port }
  | { type: "disconnect"; port: chrome.runtime.Port }
  | { type: "clear" };

export class DefaultAutofillLifecycleService implements AutofillLifecycleService {
  /**
   * Connect/disconnect/clear facts for injected-script ports. The live port set
   * is the fold of this stream — no separate structure is mutated alongside it.
   */
  private readonly portEvent$ = new Subject<PortEvent>();

  /**
   * The currently-connected injected-script ports, derived as the running fold
   * of `portEvent$`. Exposed read-only; the fold owns the mutation.
   */
  private readonly connectedPorts = new BehaviorSubject<ReadonlySet<chrome.runtime.Port>>(
    new Set(),
  );

  /**
   * Lifecycle facts for each `(tab, frame)`: `active: true` when this service
   * commands the frame to start monitoring, `active: false` when it commands a
   * stop or observes a disconnect. Monitoring state is the fold of this stream.
   */
  private readonly monitorLifecycle$ = new Subject<{
    tabId: number;
    frameId: number | undefined;
    active: boolean;
  }>();

  /**
   * Current per-frame monitoring state, derived as the running fold of
   * `monitorLifecycle$`. Exposed read-only; the fold owns the mutation.
   */
  private readonly monitoringState = new BehaviorSubject<ReadonlyMap<string, boolean>>(new Map());

  /**
   * Page transitions reported by page-lifecycle monitors (e.g. the autofiller).
   * Each is buffered against `monitoringState` and resolved into a page-details
   * collection once its frame is monitoring.
   */
  private readonly pageTransition$ = new Subject<{
    tab: chrome.tabs.Tab;
    tabId: number;
    frameId: number | undefined;
  }>();

  constructor(
    private authService: AuthService,
    private autofillSettingsService: AutofillSettingsServiceAbstraction,
    private logService: LogService,
  ) {}

  /**
   * Wires the background listeners and reactive pipelines. The subscriptions
   * are intentionally process-lifetime — this is a background singleton, and
   * the service worker is torn down wholesale rather than disposing services.
   */
  init() {
    BrowserApi.addListener(chrome.runtime.onConnect, this.handleInjectedScriptPortConnection);

    // Fold port events into the live port set. The accumulator is mutated in
    // place (no per-event allocation); reads go through `connectedPorts.value`.
    this.portEvent$
      .pipe(
        scan((ports, event) => {
          switch (event.type) {
            case "connect":
              ports.add(event.port);
              break;
            case "disconnect":
              ports.delete(event.port);
              break;
            case "clear":
              ports.clear();
              break;
          }
          return ports;
        }, new Set<chrome.runtime.Port>()),
      )
      .subscribe(this.connectedPorts);

    // Fold lifecycle facts into per-frame monitoring state. The accumulator is
    // mutated in place and widened to ReadonlyMap to prevent casual mutation.
    this.monitorLifecycle$
      .pipe(
        scan((state, event) => {
          const key = this.monitorFrameKey(event.tabId, event.frameId);
          if (event.active) {
            state.set(key, true);
          } else {
            state.delete(key);
          }
          return state;
        }, new Map<string, boolean>()),
      )
      .subscribe(this.monitoringState);

    // Buffer each reported transition until its frame is monitoring.
    this.pageTransition$
      .pipe(
        // keeps every (tab, frame) independent so simultaneous reloads each buffer on their own
        mergeMap((transition) => {
          const key = this.monitorFrameKey(transition.tabId, transition.frameId);
          return this.monitoringState.pipe(
            filter((state) => state.get(key) === true),
            map(() => transition),
            // resolve on the first monitoring frame...
            take(1),
            // ...or drop the transition when the frame is retired before monitoring starts,
            // so the buffer never accumulates subscriptions for frames that are gone.
            takeUntil(
              this.monitorLifecycle$.pipe(
                filter(
                  (lifecycle) =>
                    !lifecycle.active &&
                    this.monitorFrameKey(lifecycle.tabId, lifecycle.frameId) === key,
                ),
              ),
            ),
          );
        }),
      )
      .subscribe((transition) => void this.issuePageTransitionCollection(transition));

    this.authService.activeAccountStatus$
      .pipe(startWith(undefined), pairwise())
      .subscribe(([previousStatus, currentStatus]) =>
        this.handleAuthStatusTransition(previousStatus, currentStatus),
      );
  }

  reportPageTransition(tab: chrome.tabs.Tab, frameId: number | undefined) {
    const tabId = tab?.id;
    if (!tabId) {
      return;
    }
    // Carry the narrowed tabId in the payload so the buffer keys off a definite
    // number — the guard's narrowing of `tab.id` does not survive the stream.
    this.pageTransition$.next({ tab, tabId, frameId });
  }

  /**
   * Commands a freshly-injected frame to start monitoring when an account is
   * logged in. Called after the frame's scripts are injected.
   *
   * The auth status is re-checked here rather than reused from injection time:
   * the injection awaits yield the event loop, and a logout can complete in
   * that window; commanding start off a stale snapshot would leave this frame
   * monitoring on a logged-out account.
   *
   * FIXME: A race condition can still occur here. There is no happens-before
   * relationship between an `activeAccountStatus$` logout emission and this
   * send. A logout landing just after this check triggers
   * `handleAuthStatusTransition`, which stops connected ports. A frame whose
   * port hasn't yet registered can still slip through. This may be eliminated
   * by using rx to fully sequence script injections.
   */
  async startMonitoringFrame(tab: chrome.tabs.Tab, frameId: number) {
    const tabId = tab.id;
    if (tabId == null) {
      return;
    }
    const accountIsLoggedIn =
      (await firstValueFrom(this.authService.activeAccountStatus$)) !==
      AuthenticationStatus.LoggedOut;
    if (!accountIsLoggedIn) {
      return;
    }
    // Fire-and-forget: the bootstrap is already injected at this point, and
    // awaiting the send only matters if the caller needs a response, which it
    // does not. Errors are reported rather than swallowed.
    BrowserApi.tabSendMessage(tab, { command: AutofillLifecycleCommand.start }, { frameId }).catch(
      (error) => this.logService.error(error),
    );
    // Shares the race noted above: a logout landing here can leave this frame
    // folded as monitoring until it disconnects.
    this.monitorLifecycle$.next({ tabId, frameId, active: true });
  }

  /**
   * Retires every live frame from monitoring and disconnects its ports, ahead
   * of a full re-injection. A background-initiated disconnect does not fire the
   * port's `onDisconnect`, so the port fold is cleared explicitly rather than
   * left to self-clear.
   */
  retireAllFrames() {
    this.markConnectedFramesMonitoring(false);
    this.connectedPorts.value.forEach((port) => port.disconnect());
    this.portEvent$.next({ type: "clear" });
  }

  /**
   * Handles incoming long-lived connections from injected autofill scripts,
   * recording the port and wiring its disconnect.
   */
  private handleInjectedScriptPortConnection = (port: chrome.runtime.Port) => {
    if (port.name !== AutofillPort.InjectedScript) {
      return;
    }

    this.portEvent$.next({ type: "connect", port });
    port.onDisconnect.addListener(this.handleInjectScriptPortOnDisconnect);
  };

  /**
   * Handles a disconnecting injected-script port, retiring its `(tab, frame)`
   * from monitoring once the frame's last port is gone.
   */
  private handleInjectScriptPortOnDisconnect = (port: chrome.runtime.Port) => {
    if (port.name !== AutofillPort.InjectedScript) {
      return;
    }

    this.portEvent$.next({ type: "disconnect", port });

    const tabId = port.sender?.tab?.id;
    if (tabId == null) {
      return;
    }
    const frameId = port.sender?.frameId;
    const key = this.monitorFrameKey(tabId, frameId);
    // A (tab, frame) may hold more than one injected-script port — the
    // bootstrap and page-lifecycle monitors register independently. Retire the
    // frame from monitoring state only once its last port is gone. This reads
    // `connectedPorts.value` immediately after emitting the disconnect above and
    // relies on the fold propagating synchronously — keep these pipes free of
    // async scheduling (`observeOn`, `delay`) or this check sees a stale set.
    const framePortRemains = [...this.connectedPorts.value].some(
      (remaining) =>
        remaining.sender?.tab?.id != null &&
        this.monitorFrameKey(remaining.sender.tab.id, remaining.sender.frameId) === key,
    );
    if (!framePortRemains) {
      this.monitorLifecycle$.next({ tabId, frameId, active: false });
    }
  };

  /**
   * Broadcasts monitor lifecycle commands to every currently-connected autofill
   * content script when the active account's authentication status crosses the
   * `LoggedOut` boundary. On `LoggedOut → logged-in`, sends `startAutofillMonitors`.
   * On `logged-in → LoggedOut`, sends both `stopAutofillMonitors` and
   * `disableAutofiller`. Lock and unlock transitions emit no broadcast — monitors
   * run across the lock boundary, and a running autofiller survives a lock.
   */
  private handleAuthStatusTransition(
    previousStatus: AuthenticationStatus | undefined,
    currentStatus: AuthenticationStatus | undefined,
  ) {
    if (previousStatus === undefined || previousStatus === currentStatus) {
      // The first emission paired with `startWith(undefined)` is not a
      // transition — it's the seed. Skip it so a service-worker boot into any
      // auth state is silent.
      return;
    }
    const wasLoggedOut = previousStatus === AuthenticationStatus.LoggedOut;
    const isLoggedOut = currentStatus === AuthenticationStatus.LoggedOut;
    if (wasLoggedOut && !isLoggedOut) {
      this.broadcastToInjectedScripts({ command: AutofillLifecycleCommand.start });
      this.markConnectedFramesMonitoring(true);
      return;
    }
    if (!wasLoggedOut && isLoggedOut) {
      this.broadcastToInjectedScripts({ command: AutofillLifecycleCommand.stop });
      this.broadcastToInjectedScripts({ command: AutofillerCommand.disable });
      this.markConnectedFramesMonitoring(false);
    }
  }

  /**
   * Sends a one-way message to each `(tab, frame)` pair currently connected.
   * Each pair may have multiple ports (bootstrap and autofiller register
   * independently); the message is sent once per unique pair. Stale ports are
   * skipped silently.
   */
  private broadcastToInjectedScripts(message: { command: string }) {
    // The dedup key collapses ports for the same (tab, frameId). When a sender
    // unexpectedly reports `frameId` as undefined alongside another with a real
    // number for the same tab, the two entries deliver twice — once tab-wide,
    // once frame-specific. The lifecycle commands sent here are all idempotent
    // on the receivers, so the duplicate is benign.
    const targets = new Map<string, { tab: chrome.tabs.Tab; frameId: number | undefined }>();
    this.connectedPorts.value.forEach((port) => {
      const tab = port.sender?.tab;
      const frameId = port.sender?.frameId;
      if (!tab?.id) {
        return;
      }
      targets.set(this.monitorFrameKey(tab.id, frameId), { tab, frameId });
    });
    targets.forEach(({ tab, frameId }) => {
      BrowserApi.tabSendMessage(
        tab,
        message,
        frameId !== undefined ? { frameId } : undefined,
      ).catch((error) => this.logService.error(error));
    });
  }

  /**
   * The monitoring-state key for a `(tab, frame)` pair, and the single source of
   * that key's encoding. The folds, the buffer's lookup, the disconnect
   * retirement, and the broadcast dedup all route through here, so a frame
   * commanded to start and a transition reported against it resolve to the same
   * entry. Key correspondence holds only as long as every site uses this helper
   * rather than hand-rolling the format.
   */
  private monitorFrameKey(tabId: number, frameId: number | undefined): string {
    return `${tabId}:${frameId ?? -1}`;
  }

  /**
   * Emits a lifecycle fact for every currently-connected `(tab, frame)`, folding
   * them into or out of monitoring state. Used when an auth transition commands
   * start/stop across all connected scripts, and when a reload retires every
   * frame ahead of re-injection.
   */
  private markConnectedFramesMonitoring(active: boolean) {
    const seen = new Set<string>();
    for (const port of this.connectedPorts.value) {
      const tabId = port.sender?.tab?.id;
      if (tabId == null) {
        continue;
      }
      const frameId = port.sender?.frameId;
      const key = this.monitorFrameKey(tabId, frameId);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      this.monitorLifecycle$.next({ tabId, frameId, active });
    }
  }

  /**
   * Resolves a buffered page transition into a page-details collection. The
   * frame is monitoring by this point (the buffer guarantees it), so the
   * collection's response is honored. The `autofillOnPageLoad` setting is
   * re-checked here so it stays authoritative at evaluation time rather than
   * only at injection time.
   */
  private async issuePageTransitionCollection(transition: {
    tab: chrome.tabs.Tab;
    frameId: number | undefined;
  }) {
    const autofillOnPageLoad = await firstValueFrom(
      this.autofillSettingsService.autofillOnPageLoad$,
    );
    if (!autofillOnPageLoad) {
      return;
    }

    BrowserApi.tabSendMessage(
      transition.tab,
      {
        command: AutofillMessageCommand.collectPageDetails,
        tab: transition.tab,
        sender: "autofiller",
      },
      transition.frameId !== undefined ? { frameId: transition.frameId } : undefined,
    ).catch((error) => this.logService.error(error));
  }
}
