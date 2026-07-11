import { Observable } from "rxjs";

/**
 * A page transition reconciled against monitoring — the *Resolved* state of the
 * buffering state machine (see `lifecycle.design.md`). It names a fill
 * *opportunity*, not a warranted fill; the autofill side alone decides what to
 * make of it. `tabId` is definite: `reportPageTransition` drops undefined-id
 * tabs at the entry guard, so a resolved opportunity never carries an undefined
 * tab id.
 */
export type PageTransitionResolved = {
  tab: chrome.tabs.Tab;
  tabId: number;
  frameId: number | undefined;
};

/**
 * Owns the autofill monitoring lifecycle in the background: tracking which
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
   */
  abstract reportPageTransition: (tab: chrome.tabs.Tab, frameId: number | undefined) => void;
  /**
   * Emits once for each page transition reconciled against monitoring.
   */
  abstract pageTransitionResolved$: Observable<PageTransitionResolved>;
  /**
   * Fires when a tab is removed. Tab removal is a lifecycle concern; consumers
   * that key work by tab (e.g. per-tab reactive groups) end that work on this
   * signal so it cannot outlive the tab.
   */
  abstract tabRemoved$: (tabId: number) => Observable<void>;
  /**
   * Begins monitoring a freshly-injected frame: commands it to start when an
   * account is logged in. Called by the injection path once a frame's scripts
   * are in place.
   */
  abstract startMonitoringFrame: (tab: chrome.tabs.Tab, frameId: number) => Promise<void>;
  /**
   * Retires every live frame from monitoring and tears down its connection,
   * ahead of a full re-injection.
   */
  abstract retireAllFrames: () => void;
}
