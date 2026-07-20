/**
 * Contract for services participating in the content-script monitoring
 * lifecycle. Implementors examine the page only between
 * `startMonitoring()` and `stopMonitoring()`.
 *
 * When composed under a controller (as the content-script services are
 * under `AutofillInit`), the controller is the sole caller of these
 * methods on its sub-monitors.
 *
 * See `apps/browser/src/autofill/lifecycle.design.md` for the
 * rationale, broader invariants, and end-to-end protocol.
 */
export interface AutofillMonitor {
  /**
   * Attach observation surfaces and begin examining the page. Safe to
   * call when already monitoring — callers do not need to track state.
   */
  startMonitoring(): void;

  /**
   * Detach observation surfaces, cancel pending work, and clear
   * monitoring-scoped caches. Safe to call when already stopped, and
   * safe to chain through from `destroy()` without checking state
   * first.
   */
  stopMonitoring(): void;
}
