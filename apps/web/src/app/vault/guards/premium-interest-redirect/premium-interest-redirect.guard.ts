import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { PremiumInterestStateService } from "@bitwarden/angular/billing/services/premium-interest/premium-interest-state.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

export const premiumInterestRedirectGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const accountService = inject(AccountService);
  const premiumInterestStateService = inject(PremiumInterestStateService);

  const currentAcct = await firstValueFrom(accountService.activeAccount$);
  const userId = currentAcct.id;

  const intendsToSetupPremium = await premiumInterestStateService.getPremiumInterest(userId);

  if (intendsToSetupPremium) {
    return router.createUrlTree(["/settings/subscription/premium"]);
  }

  return true;
};
