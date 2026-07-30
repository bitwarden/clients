import { combineLatest, distinctUntilChanged, map, Observable } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

// Combines the MVP and GA feature flags into a single observable so the feature flags
// are only subscribed to in one location.
//
// `autotypeState$` and `autotypeMvpOrGaEnabled$` both consume this.
export function autotypeFeatureFlags$(
  configService: ConfigService,
): Observable<[boolean, boolean]> {
  return combineLatest([
    configService.getFeatureFlag$(FeatureFlag.WindowsDesktopAutotype), // mvp
    configService.getFeatureFlag$(FeatureFlag.WindowsDesktopAutotypeGA), // ga
  ]);
}

/**
 * Emits true when either the MVP or GA Autotype implementation is feature-flagged on,
 * independent of user setting, premium status, or lock state. Consumers that only care
 * "is some Autotype implementation available" (Settings UI visibility, the org
 * default-enable policy) should use this instead of checking a single flag directly --
 * `DesktopAutotypeService.autotypeState$` is the only place that needs the two flags
 * individually, to decide MVP-vs-GA precedence.
 */
export function autotypeMvpOrGaEnabled$(configService: ConfigService): Observable<boolean> {
  return autotypeFeatureFlags$(configService).pipe(
    map(([mvpEnabled, gaEnabled]) => mvpEnabled || gaEnabled),
    // Consumers feed this into a switchMap chain or a signal.set(), so suppressing
    // no-op re-emissions avoids restarting downstream subscriptions or triggering
    // unnecessary change detection.
    distinctUntilChanged(),
  );
}
