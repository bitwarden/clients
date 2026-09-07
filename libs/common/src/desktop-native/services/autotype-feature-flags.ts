import { combineLatest, distinctUntilChanged, map, Observable } from "rxjs";

import { FeatureFlag } from "../../enums/feature-flag.enum";
import { ConfigService } from "../../platform/abstractions/config/config.service";

/**
 * Combines all Autotype feature flags into a single observable so the feature flags
 * are only subscribed to in one location. Emits `[mvpEnabled, gaEnabled]`.
 *
 * Consumers that need to distinguish the MVP implementation from the GA implementation
 * (for example, GA-only UI that must stay hidden while MVP is active) should use this.
 * Consumers that only care "is some Autotype implementation available" should use
 * {@link autotypeFeatureFlagEnabled$} instead.
 */
export function autotypeFeatureFlags$(
  configService: ConfigService,
): Observable<[boolean, boolean]> {
  return combineLatest([
    configService.getFeatureFlag$(FeatureFlag.WindowsDesktopAutotype), // mvp
    configService.getFeatureFlag$(FeatureFlag.WindowsDesktopAutotypeGA), // ga
  ]);
}

/**
 * Emits true when the Autotype implementation is feature-flagged on,
 * independent of user setting, premium status, or lock state. Consumers that only care
 * "is some Autotype implementation available" (Settings UI visibility, the org
 * default-enable policy) should use this instead of checking a single flag directly.
 */
export function autotypeFeatureFlagEnabled$(configService: ConfigService): Observable<boolean> {
  return autotypeFeatureFlags$(configService).pipe(
    map(([mvpEnabled, gaEnabled]) => mvpEnabled || gaEnabled),
    // Consumers feed this into a switchMap chain or a signal.set(), so suppressing
    // no-op re-emissions avoids restarting downstream subscriptions or triggering
    // unnecessary change detection.
    distinctUntilChanged(),
  );
}
