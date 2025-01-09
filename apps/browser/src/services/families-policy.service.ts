import { Injectable } from "@angular/core";
import { map, Observable, of, switchMap } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";

@Injectable({ providedIn: "root" })
export class FamiliesPolicyService {
  constructor(
    private policyService: PolicyService,
    private organizationService: OrganizationService,
  ) {}

  hasSingleEnterpriseOrg$(): Observable<boolean> {
    // Retrieve all organizations the user is part of
    return this.organizationService.getAll$().pipe(
      map((organizations) => {
        // Filter to only those organizations that can manage sponsorships
        const sponsorshipOrgs = organizations.filter((org) => org.canManageSponsorships);

        // Check if there is exactly one organization that can manage sponsorships.
        // This is important because users that are part of multiple organizations
        // may always access free bitwarden family menu. We want to restrict access
        // to the policy only when there is a single enterprise organization and the free family policy is turn.
        return sponsorshipOrgs.length === 1;
      }),
    );
  }

  isFreeFamilyPolicyEnabled$(): Observable<boolean> {
    return this.hasSingleEnterpriseOrg$().pipe(
      switchMap((hasSingleEnterpriseOrg) => {
        if (!hasSingleEnterpriseOrg) {
          return of(false);
        }
        return this.organizationService.getAll$().pipe(
          map((organizations) => organizations.find((org) => org.canManageSponsorships)?.id),
          switchMap((enterpriseOrgId) =>
            this.policyService
              .getAll$(PolicyType.FreeFamiliesSponsorshipPolicy)
              .pipe(
                map(
                  (policies) =>
                    policies.find((policy) => policy.organizationId === enterpriseOrgId)?.enabled ??
                    false,
                ),
              ),
          ),
        );
      }),
    );
  }
}
