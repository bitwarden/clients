import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { ProductTierType } from "@bitwarden/common/billing/enums";

export function isUpsellingPoliciesEnabled(organization: Organization): boolean {
  if (organization === null || organization === undefined) {
    return false;
  }

  return organization.productTierType === ProductTierType.Teams;
}
