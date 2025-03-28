import { inject } from "@angular/core";
import { ActivatedRouteSnapshot, CanActivateFn, Router } from "@angular/router";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

export const IntroCarouselGuard: CanActivateFn = async (route: ActivatedRouteSnapshot) => {
  const router = inject(Router);
  const configService = inject(ConfigService);

  const hasOnboardingNudgesFlag = await configService.getFeatureFlag(
    FeatureFlag.PM8851_BrowserOnboardingNudge,
  );

  if (!hasOnboardingNudgesFlag) {
    return true;
  }

  return router.createUrlTree(["/intro-carousel"]);
};
