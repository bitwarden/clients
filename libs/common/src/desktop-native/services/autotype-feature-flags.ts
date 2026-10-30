import { combineLatest, distinctUntilChanged, map, Observable } from "rxjs";

import { FeatureFlag } from "../../enums/feature-flag.enum";
import { ConfigService } from "../../platform/abstractions/config/config.service";
import { AutotypeFeatureFlagState } from "../enums/autotype-feature-flag-state.enum";

// Combines all Autotype feature flags into a single observable so the feature flags
// are only subscribed to in one location.
function autotypeFeatureFlags$(configService: ConfigService): Observable<[boolean, boolean]> {
  return combineLatest([
    configService.getFeatureFlag$(FeatureFlag.WindowsDesktopAutotype), // mvp
    configService.getFeatureFlag$(FeatureFlag.WindowsDesktopAutotypeGA), // ga
  ]);
}

/**
 * Emits the AutotypeFeatureFlagState enum based on the resolution of all possible Autotype
 * feature flag values. Both flags on resolves to `Off`.
 *
 * Consumers that only care "is any Autotype implementation available" should compare
 * `state !== AutotypeFeatureFlagState.Off`. Consumers coupled to one specific implementation
 * (e.g. an MVP-only settings control, or the MVP-only org default-enable policy) should compare
 * against that exact member instead.
 */
export function autotypeFeatureFlagState$(
  configService: ConfigService,
): Observable<AutotypeFeatureFlagState> {
  return autotypeFeatureFlags$(configService).pipe(
    map(([mvpEnabled, gaEnabled]) => {
      let resolvedAutotypeFeatureFlagState: AutotypeFeatureFlagState = AutotypeFeatureFlagState.Off;

      if (mvpEnabled && !gaEnabled) {
        resolvedAutotypeFeatureFlagState = AutotypeFeatureFlagState.Mvp;
      } else if (!mvpEnabled && gaEnabled) {
        resolvedAutotypeFeatureFlagState = AutotypeFeatureFlagState.Ga;
      }

      return resolvedAutotypeFeatureFlagState;
    }),
    // Consumers feed this into a switchMap chain or a signal.set(), so suppressing
    // no-op re-emissions avoids restarting downstream subscriptions or triggering
    // unnecessary change detection.
    distinctUntilChanged(),
  );
}
