import { Signal, inject, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";

import { PamConnectivityService } from "@bitwarden/bit-pam";

/**
 * Whether PAM actions are unavailable right now, for a component's template. Always `false` where
 * the client provides no {@link PamConnectivityService}, so those clients keep their behaviour.
 * Call from an injection context.
 */
export function injectPamOffline(): Signal<boolean> {
  const connectivity = inject(PamConnectivityService, { optional: true });
  if (connectivity == null) {
    return signal(false).asReadonly();
  }
  return toSignal(connectivity.offline$, { initialValue: false });
}

/** Whether this client reports connectivity at all; the web vault does not. */
export function injectPamConnectivityProvided(): boolean {
  return inject(PamConnectivityService, { optional: true }) != null;
}
