import { Injectable } from "@angular/core";
import { combineLatest, filter, map, Observable, of, switchMap } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";

interface EnterpriseOrgStatus {
  isFreeFamilyPolicyEnabled: boolean;
  belongToOneEnterpriseOrgs: boolean;
  belongToMultipleEnterpriseOrgs: boolean;
}

@Injectable({ providedIn: "root" })
export class FreeFamiliesPolicyService {
  protected enterpriseOrgStatus: EnterpriseOrgStatus = {
    isFreeFamilyPolicyEnabled: false,
    belongToOneEnterpriseOrgs: false,
    belongToMultipleEnterpriseOrgs: false,
  };

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
    const { belongToOneEnterpriseOrgs, isFreeFamilyPolicyEnabled } = orgStatus;
    const canManageSponsorships = organizations.filter((org) => org.canManageSponsorships);
    return canManageSponsorships && !(belongToOneEnterpriseOrgs && isFreeFamilyPolicyEnabled);
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

    if (!belongToOneEnterpriseOrgs) {
      return of({
        isFreeFamilyPolicyEnabled: false,
        belongToOneEnterpriseOrgs,
        belongToMultipleEnterpriseOrgs,
      });
    }

    const organizationId = this.getOrganizationIdForOneEnterprise(organizations);
    if (!organizationId) {
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
        isFreeFamilyPolicyEnabled: policies.some(
          (policy) => policy.organizationId === organizationId && policy.enabled,
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

  private getOrganizationIdForOneEnterprise(organizations: any[]): string | null {
    const enterpriseOrganizations = organizations.filter((org) => org.canManageSponsorships);
    return enterpriseOrganizations.length === 1 ? enterpriseOrganizations[0].id : null;
  }
}
