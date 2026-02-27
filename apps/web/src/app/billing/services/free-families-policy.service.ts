import { Injectable } from "@angular/core";
import { combineLatest, filter, map, Observable, of, switchMap } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { ProductTierType } from "@bitwarden/common/billing/enums";

interface EnterpriseOrgStatus {
  isFreeFamilyPolicyEnabled: boolean;
  belongToOneEnterpriseOrgs: boolean;
  belongToMultipleEnterpriseOrgs: boolean;
}

@Injectable({ providedIn: "root" })
export class FreeFamiliesPolicyService {
  constructor(
    private policyService: PolicyService,
    private organizationService: OrganizationService,
    private accountService: AccountService,
  ) {}

  organizations$ = this.accountService.activeAccount$.pipe(
    switchMap((account) => {
      if (account?.id) {
        return this.organizationService.organizations$(account?.id);
      } else {
        return of();
      }
    }),
  );

  get showFreeFamilies$(): Observable<boolean> {
    return this.getFreeFamiliesVisibility$();
  }

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
      switchMap((userId) => {
        const policies$ = this.policyService.policiesByType$(
          PolicyType.FreeFamiliesSponsorshipPolicy,
          userId,
        );

        return combineLatest([enterpriseOrganization$, organization, policies$]).pipe(
          map(([isEnterprise, org, policies]) => {
            const familiesFeatureDisabled = policies.some(
              (policy) => policy.organizationId === org.id && policy.enabled,
            );

            return (
              isEnterprise &&
              !familiesFeatureDisabled &&
              org.useAdminSponsoredFamilies &&
              (org.isAdmin || org.isOwner || org.canManageUsers)
            );
          }),
        );
      }),
    );
  }

  private getFreeFamiliesVisibility$(): Observable<boolean> {
    return combineLatest([
      this.checkEnterpriseOrganizationsAndFetchPolicy(),
      this.organizations$,
    ]).pipe(
      map(([orgStatus, organizations]) => this.shouldShowFreeFamilyLink(orgStatus, organizations)),
    );
  }

  private shouldShowFreeFamilyLink(
    orgStatus: EnterpriseOrgStatus | null,
    organizations: Organization[],
  ): boolean {
    if (!orgStatus) {
      return false;
    }
    const { isFreeFamilyPolicyEnabled } = orgStatus;
    const hasSponsorshipOrgs = organizations.some((org) => org.canManageSponsorships);

    // Hide if ANY organization has the policy enabled
    return hasSponsorshipOrgs && !isFreeFamilyPolicyEnabled;
  }

  checkEnterpriseOrganizationsAndFetchPolicy(): Observable<EnterpriseOrgStatus> {
    return this.organizations$.pipe(
      filter((organizations) => Array.isArray(organizations) && organizations.length > 0),
      switchMap((organizations) => this.fetchEnterpriseOrganizationPolicy(organizations)),
    );
  }

  private fetchEnterpriseOrganizationPolicy(
    organizations: Organization[],
  ): Observable<EnterpriseOrgStatus> {
    const { belongToOneEnterpriseOrgs, belongToMultipleEnterpriseOrgs } =
      this.evaluateEnterpriseOrganizations(organizations);

    // Get all enterprise organization IDs
    const enterpriseOrgIds = organizations
      .filter((org) => org.canManageSponsorships)
      .map((org) => org.id);

    if (enterpriseOrgIds.length === 0) {
      return of({
        isFreeFamilyPolicyEnabled: false,
        belongToOneEnterpriseOrgs,
        belongToMultipleEnterpriseOrgs,
      });
    }

    return this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) =>
        this.policyService.policiesByType$(PolicyType.FreeFamiliesSponsorshipPolicy, userId),
      ),
      map((policies) => ({
        isFreeFamilyPolicyEnabled: enterpriseOrgIds.every((orgId) =>
          policies.some((policy) => policy.organizationId === orgId && policy.enabled),
        ),
        belongToOneEnterpriseOrgs,
        belongToMultipleEnterpriseOrgs,
      })),
    );
  }

  private evaluateEnterpriseOrganizations(organizations: any[]): {
    belongToOneEnterpriseOrgs: boolean;
    belongToMultipleEnterpriseOrgs: boolean;
  } {
    const enterpriseOrganizations = organizations.filter((org) => org.canManageSponsorships);
    const count = enterpriseOrganizations.length;

    return {
      belongToOneEnterpriseOrgs: count === 1,
      belongToMultipleEnterpriseOrgs: count > 1,
    };
  }
}
