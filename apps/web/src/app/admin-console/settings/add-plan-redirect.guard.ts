import { inject } from "@angular/core";
import { ActivatedRouteSnapshot, CanActivateFn, Router } from "@angular/router";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

/**
 * When the VFO1 foundation flag is on, `settings/add-plan` replaces `/create-organization`.
 * Redirects there, preserving all query params (and fragment) so marketing deep links
 * (e.g. `?plan=...&product=...&trialLength=...`) keep working.
 */
export const addPlanRedirectGuard: CanActivateFn = async (route: ActivatedRouteSnapshot) => {
  const router = inject(Router);
  const configService = inject(ConfigService);
  const logService = inject(LogService);

  try {
    if (!(await configService.getFeatureFlag(FeatureFlag.VFO1Foundation))) {
      return true;
    }

    return router.createUrlTree(["/settings/add-plan"], {
      queryParams: route.queryParams,
      fragment: route.fragment ?? undefined,
    });
  } catch (error) {
    logService.error("Error in addPlanRedirectGuard", error);
    // Fail open to the legacy create-organization page; the redirect is a UX
    // re-homing, not an authorization gate.
    return true;
  }
};
