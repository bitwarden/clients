import { Injectable } from "@angular/core";
import { catchError, combineLatest, from, map, Observable, of, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { UserId } from "@bitwarden/user-core";
import { AccountBillingClient } from "@bitwarden/web-vault/app/billing/clients";

@Injectable()
export class PremiumSubscriptionRoutingService {
  constructor(
    private accountService: AccountService,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
    private logService: LogService,
    private platformUtilsService: PlatformUtilsService,
    private accountBillingClient: AccountBillingClient,
  ) {}

  getSubscriptionRoute$(): Observable<string | null> {
    const hasPremiumFromAnyOrganization$ = this.ifAccountExistsCheck((userId) =>
      this.billingAccountProfileStateService.hasPremiumFromAnyOrganization$(userId),
    );

    if (this.platformUtilsService.isSelfHost()) {
      const hasPremiumPersonally$ = this.ifAccountExistsCheck((userId) =>
        this.billingAccountProfileStateService.hasPremiumPersonally$(userId),
      );

      return combineLatest([hasPremiumFromAnyOrganization$, hasPremiumPersonally$]).pipe(
        map(([hasPremiumFromAnyOrganization, hasPremiumPersonally]) => {
          if (hasPremiumPersonally) {
            return "settings/subscription/user-subscription";
          }
          if (!hasPremiumFromAnyOrganization) {
            return "settings/subscription/premium";
          }
          return null;
        }),
      );
    }

    const hasSubscription$ = this.ifAccountExistsCheck(() =>
      from(this.accountBillingClient.getSubscription()).pipe(
        map((subscription) => !!subscription),
        catchError((error: unknown) => {
          this.logService.error("Failed to fetch subscription for routing", error);
          return of(false);
        }),
      ),
    );

    return combineLatest([hasSubscription$, hasPremiumFromAnyOrganization$]).pipe(
      map(([hasSubscription, hasPremiumFromAnyOrganization]) => {
        if (!hasPremiumFromAnyOrganization || hasSubscription) {
          return hasSubscription
            ? "settings/subscription/user-subscription"
            : "settings/subscription/premium";
        }
        return null;
      }),
    );
  }

  private ifAccountExistsCheck(predicate$: (userId: UserId) => Observable<boolean>) {
    return this.accountService.activeAccount$.pipe(
      switchMap((account) => (account ? predicate$(account.id) : of(false))),
    );
  }
}
