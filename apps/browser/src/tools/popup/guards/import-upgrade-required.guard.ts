import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

/**
 * Blocks the new import picker's own extension-tab route unless the new import experience is
 * enabled — a safety net for a stale link or direct navigation once the flag is later disabled
 * again, mirroring `importUpgradeRedirectGuard`'s protection of the legacy route in the other
 * direction.
 */
export const importUpgradeRequiredGuard: CanActivateFn = async () => {
  const configService = inject(ConfigService);
  const router = inject(Router);

  if (await configService.getFeatureFlag(FeatureFlag.ImportUpgrade)) {
    return true;
  }

  return router.parseUrl("/tabs/vault");
};
