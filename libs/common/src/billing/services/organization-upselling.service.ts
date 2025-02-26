import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { OrganizationUpsellingServiceAbstraction } from "@bitwarden/common/billing/abstractions/organization-upselling.service.abstraction";
import { ProductTierType } from "@bitwarden/common/billing/enums";

export class OrganizationUpsellingService implements OrganizationUpsellingServiceAbstraction {
  isUpsellingPoliciesEnabled(organization: Organization): boolean {
    if (organization === null || organization === undefined) {
      return false;
    }

    return organization.productTierType === ProductTierType.Teams;
  }
}
