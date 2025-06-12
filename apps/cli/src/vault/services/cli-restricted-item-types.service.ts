import { firstValueFrom } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { RestrictedCipherType } from "@bitwarden/vault";

export class CliRestrictedItemTypesService {
  constructor(
    private configService: ConfigService,
    private organizationService: OrganizationService,
    private policyApiService: PolicyApiServiceAbstraction,
    private logService: LogService,
  ) {}

  /**
   * Gets all restricted cipher types across user's organizations by fetching policies from the API.
   *
   * @param userId - The ID of the user to get restrictions for
   * @returns Promise resolving to array of restricted cipher types with allowed organization IDs
   *
   */
  async getRestrictedTypes(userId: UserId): Promise<RestrictedCipherType[]> {
    if (!(await this.isFeatureEnabled())) {
      return [];
    }

    const organizations = await this.getUserOrganizations(userId);
    if (!organizations.length) {
      return [];
    }

    const policyPromises = organizations.map((org) => this.getPolicyForOrganization(org.id));
    const policies = await Promise.all(policyPromises);

    const enabledPolicies = policies.filter(
      (policy): policy is Policy => policy !== null && policy.enabled,
    );

    if (!enabledPolicies.length) {
      return [];
    }

    // Get all unique restricted types across all policies
    const allRestrictedTypes = Array.from(
      new Set(
        enabledPolicies.flatMap((policy) => (policy.data as CipherType[]) ?? [CipherType.Card]),
      ),
    );

    // For each restricted type, determine which orgs allow viewing it
    return allRestrictedTypes.map((cipherType) => ({
      cipherType,
      allowViewOrgIds: organizations
        .filter((org) => {
          const orgPolicy = enabledPolicies.find((p) => p.organizationId === org.id);

          // If org has no policy, it allows everything
          if (!orgPolicy) {
            return true;
          }

          // Check if this cipher type is NOT in the org's restricted list
          const restrictedTypes = (orgPolicy.data as CipherType[]) ?? [CipherType.Card];
          return !restrictedTypes.includes(cipherType);
        })
        .map((org) => org.id),
    }));
  }

  /**
   * Filters restricted ciphers based on organization policies.
   *
   * @param ciphers - An array of ciphers to filter
   * @param userId - The user ID to get restrictions for
   * @returns Promise resolving to filtered array with restricted ciphers removed
   */
  async filterRestrictedCiphers(ciphers: CipherView[], userId: UserId): Promise<CipherView[]>;
  /**
   * Filters restricted cipher based on organization policies.
   *
   * @param cipher - A single cipher to check
   * @param userId - The user ID to get restrictions for
   * @returns Promise resolving to the cipher if allowed, or null if restricted
   */
  async filterRestrictedCiphers(ciphers: CipherView, userId: UserId): Promise<CipherView | null>;
  /**
   * Implementation for filterRestrictedCiphers method overloads.
   *
   * @internal
   */
  async filterRestrictedCiphers(
    ciphers: CipherView | CipherView[],
    userId: UserId,
  ): Promise<CipherView | CipherView[] | null> {
    const restrictions = await this.getRestrictedTypes(userId);

    const isRestricted = (cipher: CipherView): boolean => {
      return restrictions.some((item) => item.cipherType === cipher.type);
    };

    if (Array.isArray(ciphers)) {
      return ciphers.filter((cipher) => !isRestricted(cipher));
    }

    return isRestricted(ciphers) ? null : ciphers;
  }

  /**
   * Gets all organizations for the specified user.
   *
   * @param userId - The user ID to get organizations for
   * @returns Promise resolving to array of user's organizations
   * @private
   */
  private async getUserOrganizations(userId: UserId): Promise<Organization[]> {
    return firstValueFrom(this.organizationService.organizations$(userId));
  }

  /**
   * Fetches the RestrictedItemTypes policy for a specific organization.
   *
   * @param organizationId - The organization ID to fetch policy for
   * @returns Promise resolving to Policy object if found, null otherwise
   * @private
   */
  private async getPolicyForOrganization(organizationId: string): Promise<Policy | null> {
    try {
      const policyResponse = await this.policyApiService.getPolicy(
        organizationId,
        PolicyType.RestrictedItemTypes,
      );

      return Policy.fromResponse(policyResponse);
    } catch (error) {
      this.logService.error(
        `Failed to fetch restricted item types policy for organization ${organizationId}: ${error}`,
      );
      return null;
    }
  }

  private async isFeatureEnabled(): Promise<boolean> {
    return this.configService.getFeatureFlag(FeatureFlag.RemoveCardItemTypePolicy);
  }
}
