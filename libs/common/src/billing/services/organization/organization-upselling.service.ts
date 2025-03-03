import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { OrganizationUpsellingServiceAbstraction } from "@bitwarden/common/billing/abstractions/organizations/organization-upselling.service.abstraction";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

export class OrganizationUpsellingService implements OrganizationUpsellingServiceAbstraction {
  constructor(private readonly configService: ConfigService) {}

  async isUpsellingPoliciesEnabled(organization: Organization): Promise<boolean> {
    if (organization === null || organization === undefined) {
      return Promise.resolve(false);
    }

    // When removing the feature flag, also replace org-policy-permissions.guard.ts with org-permissions.guard.ts.
    if (!(await this.configService.getFeatureFlag(FeatureFlag.PM12276_BreadcrumbEventLogs))) {
      return Promise.resolve(false);
    }

    return Promise.resolve(organization.productTierType === ProductTierType.Teams);
  }
}
