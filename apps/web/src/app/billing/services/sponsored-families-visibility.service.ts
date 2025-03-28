import { Injectable } from "@angular/core";
import { combineLatest, map, Observable, switchMap } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

@Injectable({ providedIn: "root" })
export class SponsoredFamiliesVisibilityService {
  constructor(
    private policyService: PolicyService,
    private organizationService: OrganizationService,
    private accountService: AccountService,
    private configService: ConfigService,
  ) {}

  /**
   * Determines whether to show the sponsored families dropdown in the organization layout
   * @param organization The organization to check
   * @returns Observable<boolean> indicating whether to show the dropdown
   */
  showSponsoredFamiliesDropdown$(organization: Observable<Organization>): Observable<boolean> {
    const enterpriseOrganization$ = organization.pipe(
      map((org) => org.productTierType === ProductTierType.Enterprise),
    );

    return this.accountService.activeAccount$.pipe(
      getUserId,
      map((userId) => {
        const policies$ = this.policyService.policiesByType$(
          PolicyType.FreeFamiliesSponsorshipPolicy,
          userId,
        );

        return combineLatest([
          enterpriseOrganization$,
          this.configService.getFeatureFlag$(FeatureFlag.PM17772_AdminInitiatedSponsorships),
          organization,
          policies$,
        ]).pipe(
          map(([isEnterprise, featureFlagEnabled, org, policies]) => {
            const familiesFeatureDisabled = policies.some(
              (policy) => policy.organizationId === org.id && policy.enabled,
            );

            return (
              isEnterprise &&
              featureFlagEnabled &&
              !familiesFeatureDisabled &&
              org.useAdminSponsoredFamilies &&
              (org.isAdmin || org.isOwner || org.canManageUsers)
            );
          }),
        );
      }),
      switchMap((observable) => observable),
    );
  }
}
