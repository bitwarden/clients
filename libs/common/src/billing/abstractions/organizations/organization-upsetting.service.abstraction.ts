import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";

export abstract class OrganizationUpsellingServiceAbstraction {
  abstract isUpsellingPoliciesEnabled(organization: Organization): Promise<boolean>;
}
