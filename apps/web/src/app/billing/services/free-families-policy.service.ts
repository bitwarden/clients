import { Injectable } from "@angular/core";
import { combineLatest, filter, from, map, Observable, of, switchMap } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

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
    private configService: ConfigService,
  ) {}

  get showFreeFamilies$(): Observable<boolean> {
    return this.isFreeFamilyFlagEnabled$.pipe(
      switchMap((isFreeFamilyFlagEnabled) =>
        isFreeFamilyFlagEnabled
          ? this.getFreeFamiliesVisibility$()
          : this.organizationService.canManageSponsorships$,
      ),
    );
  }

  private getFreeFamiliesVisibility$(): Observable<boolean> {
    return combineLatest([
      this.checkEnterpriseOrganizationsAndFetchPolicy(),
      this.organizationService.canManageSponsorships$,
    ]).pipe(
      map(([orgStatus, canManageSponsorships]) =>
        this.shouldShowFreeFamilyLink(orgStatus, canManageSponsorships),
      ),
    );
  }

  private shouldShowFreeFamilyLink(
    orgStatus: EnterpriseOrgStatus | null,
    canManageSponsorships: boolean,
  ): boolean {
    if (!orgStatus) {
      return false;
    }
    const { belongToOneEnterpriseOrgs, isFreeFamilyPolicyEnabled } = orgStatus;
    return canManageSponsorships && !(belongToOneEnterpriseOrgs && isFreeFamilyPolicyEnabled);
  }

  checkEnterpriseOrganizationsAndFetchPolicy(): Observable<EnterpriseOrgStatus> {
    return this.organizationService.organizations$.pipe(
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

    return this.policyService.getAll$(PolicyType.FreeFamiliesSponsorshipPolicy).pipe(
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

  private get isFreeFamilyFlagEnabled$(): Observable<boolean> {
    return from(this.configService.getFeatureFlag(FeatureFlag.DisableFreeFamiliesSponsorship));
  }
}
