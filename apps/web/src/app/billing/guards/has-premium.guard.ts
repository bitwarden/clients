import { inject } from "@angular/core";
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from "@angular/router";
import { from, Observable, of } from "rxjs";
import { switchMap, tap } from "rxjs/operators";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";

/**
 * CanActivate guard that checks if the user has premium and otherwise triggers the premium upgrade
 * flow and blocks navigation.
 */
export function hasPremiumGuard(): CanActivateFn {
  return (
    _route: ActivatedRouteSnapshot,
    _state: RouterStateSnapshot,
  ): Observable<boolean | UrlTree> => {
    const router = inject(Router);
    const premiumUpgradePromptService = inject(PremiumUpgradePromptService);
    const billingAccountProfileStateService = inject(BillingAccountProfileStateService);
    const accountService = inject(AccountService);

    return accountService.activeAccount$.pipe(
      switchMap((account) =>
        account
          ? billingAccountProfileStateService.hasPremiumFromAnySource$(account.id)
          : of(false),
      ),
      switchMap((userHasPremium: boolean) => {
        // Can't call async method inside observables so instead, wait for service then switch back to the boolean
        if (!userHasPremium) {
          return from(premiumUpgradePromptService.promptForPremium()).pipe(
            switchMap(() => of(userHasPremium)),
          );
        }
        return of(userHasPremium);
      }),
      // Prevent trapping the user on the login page, since that's an awful UX flow
      tap((userHasPremium: boolean) => {
        if (!userHasPremium && router.url === "/login") {
          return router.createUrlTree(["/"]);
        }
      }),
    );
  };
}
