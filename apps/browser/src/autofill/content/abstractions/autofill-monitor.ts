/**
 * Contract for services participating in the content-script monitoring
 * lifecycle. Implementors observe the page only between `startMonitoring()`
 * and `stopMonitoring()`.
 *
 * - Construction is inert: no I/O, no listeners attached to globals.
 * - Monitoring may be started and stopped many times across the life of
 *   the content script.
 * - Both methods are idempotent. Implementors guard via an
 *   `isMonitoring` flag and may additionally rely on operations being
 *   inherently safe on empty/disconnected resources (e.g. disconnecting
 *   an already-disconnected observer, clearing a null timeout).
 *   `destroy()` may chain through `stopMonitoring()` unconditionally.
 * - Cached observation state is monitoring-scoped: cleared in
 *   `stopMonitoring()` so a future `startMonitoring()` starts fresh
 *   against the current page.
 * - Implementors must not populate monitoring-scoped state from
 *   operational paths invoked while stopped. Controllers are
 *   responsible for gating those calls; see
 *   `AutofillInit.getExtensionMessageHandler` for the canonical gate.
 * - When a monitor is composed under a controller (as the
 *   content-script services are under `AutofillInit`), the controller
 *   is the sole caller of `startMonitoring()` / `stopMonitoring()` on
 *   the sub-monitors.
 * - For implementors that also expose `destroy()`, the identity holds:
 *   `destroy()` ≡ `stopMonitoring()` + graph disposal.
 */
export interface AutofillMonitor {
  startMonitoring(): void;
  stopMonitoring(): void;
}
