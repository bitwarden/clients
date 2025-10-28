import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

import { SetupPremiumService } from "../../billing/individual/premium/setup-premium.service";

export const setupPremiumRedirectGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const accountService = inject(AccountService);
  const setupPremiumService = inject(SetupPremiumService);

  const currentAcct = await firstValueFrom(accountService.activeAccount$);

  const intentToSetupPremium = await setupPremiumService.getIntentToSetupPremium(currentAcct.id);

  if (intentToSetupPremium) {
    return router.createUrlTree(["/setup-premium"]);
  }

  return true;
};
