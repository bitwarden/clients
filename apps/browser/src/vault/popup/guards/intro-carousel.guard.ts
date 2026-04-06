import { inject } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { IntroCarouselService } from "../services/intro-carousel.service";

export const IntroCarouselGuard = async () => {
  const router = inject(Router);
  const introCarouselService = inject(IntroCarouselService);

  const hasIntroCarouselDismissed = await firstValueFrom(introCarouselService.introCarouselState$);

  if (hasIntroCarouselDismissed) {
    return true;
  }

  return router.createUrlTree(["/intro-carousel"]);
};
