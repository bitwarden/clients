import { combineLatest, map, of, Observable } from "rxjs";
import { switchMap, distinctUntilChanged, shareReplay } from "rxjs/operators";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CipherType } from "@bitwarden/common/vault/enums";

import { uuidAsString } from "../../platform/abstractions/sdk/sdk.service";
import { CipherLike } from "../types/cipher-like";
import { CipherViewLikeUtils } from "../utils/cipher-view-like-utils";

export type RestrictedCipherType = {
  cipherType: CipherType;
  allowViewOrgIds: string[];
};

export class RestrictedItemTypesService {
  /**
   * Emits an array of RestrictedCipherType objects:
   * - cipherType: each type restricted by at least one org-level policy
   * - allowViewOrgIds: org IDs that allow viewing that type
   */
  readonly restricted$: Observable<RestrictedCipherType[]> = this.configService
    .getFeatureFlag$(FeatureFlag.RemoveCardItemTypePolicy)
    .pipe(
      switchMap((flagOn) => {
        if (!flagOn) {
          return of([]);
        }

        return this.accountService.activeAccount$.pipe(
          getOptionalUserId,
          switchMap((userId) => {
            if (userId == null) {
              return of([]); // No user logged in, no restrictions
            }
            return combineLatest([
              this.organizationService.organizations$(userId),
              this.policyService.policiesByType$(PolicyType.RestrictedItemTypes, userId),
            ]);
          }),
          map(([orgs, enabledPolicies]) => {
            // Helper to extract restricted types from policy data
            const restrictedTypes = (p: any) => {
              if (!p.data) {
                return [];
              }

              let parsedData = p.data;

              // If data is a string, try to parse it as JSON
              if (typeof p.data === "string") {
                try {
                  parsedData = JSON.parse(p.data);
                } catch {
                  return [];
                }
              }

              let result: CipherType[] = [];

              // Handle both old format (direct array) and new format (object with RestrictedItemTypes property)
              if (Array.isArray(parsedData)) {
                result = parsedData as CipherType[];
              } else if (
                typeof parsedData === "object" &&
                parsedData &&
                "RestrictedItemTypes" in parsedData
              ) {
                result = (parsedData.RestrictedItemTypes as CipherType[]) ?? [];
              } else if (
                typeof parsedData === "object" &&
                parsedData &&
                "restrictedItemTypes" in parsedData
              ) {
                result = (parsedData.restrictedItemTypes as CipherType[]) ?? [];
              }

              return result;
            };

            // Union across all enabled policies
            const allRestrictedTypes = Array.from(
              new Set(enabledPolicies.flatMap(restrictedTypes)),
            ) as CipherType[];

            const result = allRestrictedTypes.map((cipherType) => {
              // Determine which orgs allow viewing this type
              const allowViewOrgIds = orgs
                .filter((org: any) => {
                  const orgPolicy = enabledPolicies.find((p: any) => p.organizationId === org.id);
                  // no policy for this org => allows everything
                  if (!orgPolicy) {
                    return true;
                  }
                  // if this type not in their restricted list => they allow it
                  return !restrictedTypes(orgPolicy).includes(cipherType);
                })
                .map((org: any) => org.id);

              return { cipherType, allowViewOrgIds };
            });

            return result;
          }),
        );
      }),
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

  constructor(
    private configService: ConfigService,
    private accountService: AccountService,
    private organizationService: OrganizationService,
    private policyService: PolicyService,
  ) {}

  /**
   * Determines if a cipher is restricted from being viewed by the user.
   *
   * @param cipher - The cipher to check
   * @param restrictedTypes - Array of restricted cipher types (from restricted$ observable)
   * @returns true if the cipher is restricted, false otherwise
   *
   * Restriction logic:
   * - If cipher type is not restricted by any org → allowed
   * - If cipher belongs to an org that allows this type → allowed
   * - Otherwise → restricted
   */
  isCipherRestricted(cipher: CipherLike, restrictedTypes: RestrictedCipherType[]): boolean {
    const cipherType = CipherViewLikeUtils.getType(cipher);
    const restriction = restrictedTypes.find((r) => r.cipherType === cipherType);

    // If cipher type is not restricted by any organization, allow it
    if (!restriction) {
      return false;
    }

    // If cipher belongs to an organization
    if (cipher.organizationId) {
      // Check if this organization allows viewing this cipher type
      return !restriction.allowViewOrgIds.includes(uuidAsString(cipher.organizationId));
    }

    // Cipher is restricted by at least one organization, restrict it
    return true;
  }

  /**
   * Convenience method that combines getting restrictions and checking a cipher.
   *
   * @param cipher - The cipher to check
   * @returns Observable<boolean> indicating if the cipher is restricted
   */
  isCipherRestricted$(cipher: CipherLike): Observable<boolean> {
    return this.restricted$.pipe(
      map((restrictedTypes) => this.isCipherRestricted(cipher, restrictedTypes)),
    );
  }
}
