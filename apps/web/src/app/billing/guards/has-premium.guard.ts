import { inject } from "@angular/core";
import {
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router,
  CanActivateFn,
  UrlTree,
} from "@angular/router";
import { Observable, of } from "rxjs";
import { switchMap, tap } from "rxjs/operators";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";

/**
 * CanActivate guard that checks if the user has premium and otherwise triggers the "premiumRequired"
 * message and blocks navigation.
 */
export function hasPremiumGuard(): CanActivateFn {
  return (
    _route: ActivatedRouteSnapshot,
    _state: RouterStateSnapshot,
  ): Observable<boolean | UrlTree> => {
    const router = inject(Router);
    const messagingService = inject(MessagingService);
    const billingAccountProfileStateService = inject(BillingAccountProfileStateService);
    const accountService = inject(AccountService);

    return accountService.activeAccount$.pipe(
      switchMap((account) =>
        account
          ? billingAccountProfileStateService.hasPremiumFromAnySource$(account.id)
          : of(false),
      ),
      tap((userHasPremium: boolean) => {
        if (!userHasPremium) {
          messagingService.send("premiumRequired");
        }
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
