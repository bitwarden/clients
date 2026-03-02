import { inject } from "@angular/core";
import { CanActivateFn, Router, UrlTree } from "@angular/router";
import { Observable, of } from "rxjs";
import { map, switchMap } from "rxjs/operators";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";

/**
 * CanActivate guard that checks if the user has a personal premium subscription.
 * Redirects to the premium upgrade page if not.
 */
export const hasPremiumPersonallyGuard: CanActivateFn = (): Observable<boolean | UrlTree> => {
  const router = inject(Router);
  const accountService = inject(AccountService);
  const billingAccountProfileStateService = inject(BillingAccountProfileStateService);

  return accountService.activeAccount$.pipe(
    switchMap((account) =>
      account ? billingAccountProfileStateService.hasPremiumPersonally$(account.id) : of(false),
    ),
    map((hasPremium) => hasPremium || router.createUrlTree(["/settings/subscription/premium"])),
  );
};
