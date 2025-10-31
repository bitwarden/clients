import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { PremiumSetupIntentStateService } from "@bitwarden/angular/billing/services/premium-setup-intent/premium-setup-intent-state.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

export const premiumSetupIntentRedirectGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const accountService = inject(AccountService);
  const premiumSetupIntentStateService = inject(PremiumSetupIntentStateService);

  const currentAcct = await firstValueFrom(accountService.activeAccount$);
  const userId = currentAcct.id;

  const intendsToSetupPremium = await premiumSetupIntentStateService.getPremiumSetupIntent(userId);

  if (intendsToSetupPremium) {
    return router.createUrlTree(["/settings/subscription/premium"]);
  }

  return true;
};
