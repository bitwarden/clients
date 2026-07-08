import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { AutofillLifecycleService } from "./abstractions/autofill-lifecycle.service";

/**
 * Foreground stand-in for the autofill lifecycle. The lifecycle is a
 * background-only responsibility — it owns the injected-script ports,
 * monitoring state, and page-transition buffering, all of which live in the
 * service worker. The popup builds its own `AutofillService` but never drives
 * the injection paths that touch the lifecycle, so it binds this no-op rather
 * than a second, partially-live `DefaultAutofillLifecycleService`.
 *
 * These methods are safe to leave empty because the popup never invokes them:
 * the lifecycle members are reached only through `AutofillService`'s injection
 * paths (`injectAutofillScripts`, `reloadAutofillScripts`,
 * `loadAutofillScriptsOnInstall`), and every caller of those lives in the
 * background. Each method logs a warning if called, turning that invariant into
 * a runtime tripwire: a warning here means a popup-reachable code path now
 * drives the lifecycle and belongs on the real service in the background.
 */
export class NoopAutofillLifecycleService implements AutofillLifecycleService {
  constructor(private logService: LogService) {}

  init() {
    this.warnInvoked("init");
  }

  reportPageTransition() {
    this.warnInvoked("reportPageTransition");
  }

  startMonitoringFrame(): Promise<void> {
    this.warnInvoked("startMonitoringFrame");
    return Promise.resolve();
  }

  retireAllFrames() {
    this.warnInvoked("retireAllFrames");
  }

  /**
   * Reports an unexpected foreground call. Only the method name is logged —
   * the `(tab, frameId)` arguments are withheld so a tab URL never reaches the
   * log.
   */
  private warnInvoked(method: string) {
    this.logService.warning(
      `NoopAutofillLifecycleService.${method} was invoked in the foreground. ` +
        "The autofill lifecycle runs only in the background service worker, so this call has no effect. " +
        "It likely belongs on the real service in the background.",
    );
  }
}
