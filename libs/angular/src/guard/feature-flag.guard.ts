import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigServiceAbstraction } from "@bitwarden/common/platform/abstractions/config/config.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

// Replace this with a type safe lookup of the feature flag values in PM-2282
type FlagValue = boolean | number | string;

/**
 * Returns a CanActivateFn that checks if the feature flag is enabled. If not, it shows an "Access Denied!"
 * toast and optionally redirects to the specified url.
 * @param featureFlag - The feature flag to check
 * @param requiredFlagValue - Optional value to the feature flag must be equal to, defaults to true
 * @param redirectUrlOnDisabled - Optional url to redirect to if the feature flag is disabled
 */
export const canAccessFeature = (
  featureFlag: FeatureFlag,
  requiredFlagValue: FlagValue = true,
  redirectUrlOnDisabled?: string
): CanActivateFn => {
  return async () => {
    const configService = inject(ConfigServiceAbstraction);
    const platformUtilsService = inject(PlatformUtilsService);
    const router = inject(Router);
    const i18nService = inject(I18nService);
    const logService = inject(LogService);

    try {
      const flagValue = await configService.getFeatureFlag(featureFlag);

      if (flagValue === requiredFlagValue) {
        return true;
      }

      platformUtilsService.showToast("error", null, i18nService.t("accessDenied"));

      if (redirectUrlOnDisabled != null) {
        return router.createUrlTree([redirectUrlOnDisabled]);
      }
      return false;
    } catch (e) {
      logService.error(e);
      return false;
    }
  };
};
