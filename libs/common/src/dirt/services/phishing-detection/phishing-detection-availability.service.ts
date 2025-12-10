import { combineLatest, Observable, of, switchMap } from "rxjs";
import { catchError, map } from "rxjs/operators";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

/**
 * Exposes phishing detection availability
 */
export abstract class PhishingDetectionAvailabilityAbstraction {
  /**
   * An observable for whether phishing detection is available for the active user account
   */
  abstract available$: Observable<boolean>;
  /**
   * Determine whether the active account has access to phishing detection.
   *
   * Access is granted only when the PhishingDetection feature flag is enabled and
   * at least one of the following is true for the active account:
   * - the user has a personal premium subscription
   * - the user is a member of a Family org (ProductTierType.Families)
   * - the user is a member of an Enterprise org with `usePhishingBlocker` enabled
   */
  abstract activeAccountHasAccess$(): Observable<boolean>;
}

export class PhishingDetectionAvailabilityService
  implements PhishingDetectionAvailabilityAbstraction
{
  readonly available$: Observable<boolean>;

  constructor(
    private accountService: AccountService,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
    private configService: ConfigService,
    private organizationService: OrganizationService,
  ) {
    this.available$ = this.activeAccountHasAccess$();
  }

  activeAccountHasAccess$(): Observable<boolean> {
    return combineLatest([
      this.accountService.activeAccount$,
      this.configService.getFeatureFlag$(FeatureFlag.PhishingDetection),
    ]).pipe(
      switchMap(([account, featureEnabled]) => {
        if (!account || !featureEnabled) {
          return of(false);
        }
        return combineLatest([
          this.billingAccountProfileStateService
            .hasPremiumPersonally$(account.id)
            .pipe(catchError(() => of(false))),
          this.organizationService.organizations$(account.id).pipe(catchError(() => of([]))),
        ]).pipe(
          map(([hasPremium, organizations]) => hasPremium || this.orgGrantsAccess(organizations)),
          catchError(() => of(false)),
        );
      }),
    );
  }

  // Helper to check if any of the organizations grant access to phishing detection
  private orgGrantsAccess(organizations: Organization[]): boolean {
    return organizations.some((org) => {
      if (!org.canAccess || !org.isMember || !org.usersGetPremium) {
        return false;
      }
      return (
        org.productTierType === ProductTierType.Families ||
        (org.productTierType === ProductTierType.Enterprise && org.usePhishingBlocker)
      );
    });
  }
}
