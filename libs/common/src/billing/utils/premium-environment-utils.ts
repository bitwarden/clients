import { Observable, of, switchMap } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { Environment } from "@bitwarden/common/platform/abstractions/environment.service";

/**
 * Emits whether the current environment should be treated as cloud for subscription pricing
 * and premium purchase purposes.
 *
 * Premium purchases are intentionally unavailable on self-hosted environments, where users
 * subscribe through the web app so they can download and apply their license file. However,
 * Bitwarden-owned QA and dev cloud environments are also classified as self-hosted because
 * their URLs are not production cloud regions, which blocks QA from testing the premium
 * upgrade flows. The PM38393_DisableSelfHostPremiumCheck feature flag — only ever served by
 * internal QA environments — bypasses the self-host check so those environments behave as
 * cloud.
 *
 * The bypass is one-directional: a cloud environment is always treated as cloud — and never
 * consults the feature flag — regardless of the flag's value. Self-hosted-classified
 * environments re-emit when the resolved flag value changes, so a flag served after the
 * initial config fetch still takes effect.
 */
export function isPremiumCloudEnvironment$(
  environment$: Observable<Environment>,
  configService: ConfigService,
): Observable<boolean> {
  return environment$.pipe(
    switchMap((environment) =>
      environment.isCloud()
        ? of(true)
        : configService.getFeatureFlag$(FeatureFlag.PM38393_DisableSelfHostPremiumCheck),
    ),
  );
}
