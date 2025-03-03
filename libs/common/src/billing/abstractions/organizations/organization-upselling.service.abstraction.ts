import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";

export abstract class OrganizationUpsellingServiceAbstraction {
  /**
   * Determines if upselling policies is enabled for the organizations meeting certain criteria.
   * @param organization
   */
  abstract isUpsellingPoliciesEnabled(organization: Organization): Promise<boolean>;
}
