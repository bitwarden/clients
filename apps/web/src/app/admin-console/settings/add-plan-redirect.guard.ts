import { inject } from "@angular/core";
import { ActivatedRouteSnapshot, CanActivateFn, Router } from "@angular/router";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

/**
 * When the VFO1 foundation flag is on, `settings/add-plan` replaces `/create-organization`.
 * Redirects there, preserving query params so marketing deep links
 * (`?plan=...&product=...&trialLength=...`) keep working.
 */
export const addPlanRedirectGuard: CanActivateFn = async (route: ActivatedRouteSnapshot) => {
  const router = inject(Router);
  const configService = inject(ConfigService);

  if (!(await configService.getFeatureFlag(FeatureFlag.VFO1Foundation))) {
    return true;
  }

  return router.createUrlTree(["/settings/add-plan"], {
    queryParams: route.queryParams,
    fragment: route.fragment ?? undefined,
  });
};
