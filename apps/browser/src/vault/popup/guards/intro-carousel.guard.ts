import { inject } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { IntroCarouselService } from "../services/intro-carousel.service";

export const IntroCarouselGuard = async () => {
  const router = inject(Router);
  const configService = inject(ConfigService);
  const introCarouselService = inject(IntroCarouselService);

  const hasOnboardingNudgesFlag = await configService.getFeatureFlag(
    FeatureFlag.PM8851_BrowserOnboardingNudge,
  );

  const hasIntroCarouselDismissed = await firstValueFrom(introCarouselService.introCarouselState$);

  if (!hasOnboardingNudgesFlag || hasIntroCarouselDismissed) {
    return true;
  }

  return router.createUrlTree(["/intro-carousel"]);
};
