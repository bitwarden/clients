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
   * transition is buffered until its frame is monitoring, then resolved into a
   * page-details collection — or dropped if the frame is retired first.
   */
  abstract reportPageTransition: (tab: chrome.tabs.Tab, frameId: number | undefined) => void;
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
