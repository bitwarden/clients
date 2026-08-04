import { Observable } from "rxjs";

/**
 * The scripted-automation workflows that report readiness through
 * {@link AutofillLifecycleService.reportAutomatedLoginStepReady}. Set by the validating background
 * (never by an injected frame), so an interpreter can trust the workflow identity. Auto-submit
 * login is the only workflow today; the discriminant is the extension point for future automations.
 */
export const AutomationWorkflow = Object.freeze({
  autoSubmitLogin: "autoSubmitLogin",
} as const);

export type AutomationWorkflow = (typeof AutomationWorkflow)[keyof typeof AutomationWorkflow];

/**
 * A background-validated automated-login workflow frame reporting readiness for its next
 * fill-and-submit step. Distinct from a raw page transition: it asserts an automation is
 * *progressing*, and carries the workflow identity (stamped by the validating background, never by
 * the frame). See `lifecycle.design.md`.
 */
export type AutomatedLoginStepReady = Readonly<{
  tab: chrome.tabs.Tab;
  tabId: number;
  frameId: number | undefined;
  frameUrl: string;
  workflow: AutomationWorkflow;
}>;

/**
 * A page transition reconciled against monitoring — the *Resolved* state of the
 * buffering state machine (see `lifecycle.design.md`).
 */
export type PageTransitionResolved = Readonly<{
  tab: chrome.tabs.Tab;
  /**
   * Use this to validate secure operations target the tab that sent the event.
   */
  tabId: number;
  /**
   * Use this to validate secure operations target the frame that sent the event.
   */
  frameId: number | undefined;
  /**
   * Use this to validate secure operations target the URL that sent the event.
   */
  frameUrl: string;
}>;

/**
 * Owns the autofill monitoring lifecycle in the extension. Tracks which
 * injected frames are live, commanding them to start and stop monitoring as
 * login state changes, and buffering page-transition reports until the frame
 * they target is monitoring. See `lifecycle.design.md` for the full design.
 */
export abstract class AutofillLifecycleService {
  /**
   * Wires the background listeners and reactive pipelines. Call once, when the
   * background starts.
   */
  abstract init: () => void;
  /**
   * Records a page transition reported by a page-lifecycle monitor. The
   * transition is buffered until its frame is monitoring, at which point
   * `pageTransitionResolved$` emits, unless the frame is retired first.
   *
   * `url` and `frameId` should report browser-supplied values. They are carried
   * through to resolved page transitions. Transitions that fail to supply a tab
   * and URL are dropped.
   */
  abstract reportPageTransition: (
    tab: chrome.tabs.Tab,
    frameId: number | undefined,
    url: string | undefined,
  ) => void;
  /**
   * Emits once for each page transition reconciled against monitoring.
   */
  abstract pageTransitionResolved$: Observable<PageTransitionResolved>;
  /**
   * Records that a background-validated automated-login workflow frame is ready for its next
   * fill-and-submit step. The caller is responsible for the workflow's policy validation
   * before reporting.
   *
   * `url` and `frameId` should report browser-supplied values. They are carried
   * through to downstream automated logins. Reports that fail to supply a tab
   * and URL are dropped.
   *
   * `workflow` must not be derived from a frame-controlled message body.
   */
  abstract reportAutomatedLoginStepReady: (
    tab: chrome.tabs.Tab,
    frameId: number | undefined,
    url: string | undefined,
    workflow: AutomationWorkflow,
  ) => void;
  /**
   * Emits each automated-login step-ready fact for a consumer (the orchestrator) to interpret.
   */
  abstract automatedLoginStepReady$: Observable<AutomatedLoginStepReady>;
  /**
   * Fires when a tab is removed. Tab removal is a lifecycle concern; consumers
   * that key work by tab (e.g. per-tab reactive groups) can use this signal to
   * dispose when the tab is removed.
   */
  abstract tabRemoved$: (tabId: number) => Observable<void>;
  /**
   * The open tab ids, published only once a fresh seed has succeeded. Cold: each
   * subscription runs the seed again, so a consumer can re-subscribe to retry a
   * failed seed.
   *
   * If the seed fails the stream errors.
   */
  abstract liveTabs$: Observable<ReadonlySet<number>>;
  /**
   * Begins monitoring a freshly-injected frame: commands it to start when an
   * account is logged in. Called by the injection path once a frame's scripts
   * are in place.
   */
  abstract startMonitoringFrame: (tab: chrome.tabs.Tab, frameId: number) => Promise<void>;
  /**
   * Retires every live frame from monitoring and tears down its connection.
   */
  abstract retireAllFrames: () => void;
}
