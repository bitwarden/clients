import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { map, of, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";

export const hasPremiumGuard: CanActivateFn = () => {
  const accountService = inject(AccountService);
  const billingService = inject(BillingAccountProfileStateService);
  const router = inject(Router);

  return accountService.activeAccount$.pipe(
    switchMap((account) =>
      account ? billingService.hasPremiumFromAnySource$(account.id) : of(false),
    ),
    map((isPremium) => (isPremium ? true : router.createUrlTree(["/tabs/reports"]))),
  );
};
