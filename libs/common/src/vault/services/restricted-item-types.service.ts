import { combineLatest, map, of, Observable } from "rxjs";
import { switchMap, distinctUntilChanged, shareReplay } from "rxjs/operators";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CipherType } from "@bitwarden/common/vault/enums";

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
          getUserId,
          switchMap((userId) =>
            combineLatest([
              this.organizationService.organizations$(userId),
              this.policyService.policiesByType$(PolicyType.RestrictedItemTypes, userId),
            ]),
          ),
          map(([orgs, enabledPolicies]) => {
            // Helper to extract restricted types, defaulting to [Card]
            const restrictedTypes = (p: (typeof enabledPolicies)[number]) =>
              (p.data as CipherType[]) ?? [CipherType.Card];

            // Union across all enabled policies
            const allRestrictedTypes = Array.from(
              new Set(enabledPolicies.flatMap(restrictedTypes)),
            );

            return allRestrictedTypes.map((cipherType) => {
              // Determine which orgs allow viewing this type
              const allowViewOrgIds = orgs
                .filter((org) => {
                  const orgPolicy = enabledPolicies.find((p) => p.organizationId === org.id);
                  // no policy for this org => allows everything
                  if (!orgPolicy) {
                    return true;
                  }
                  // if this type not in their restricted list => they allow it
                  return !restrictedTypes(orgPolicy).includes(cipherType);
                })
                .map((org) => org.id);

              return { cipherType, allowViewOrgIds };
            });
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
    const restriction = restrictedTypes.find(
      (r) => r.cipherType === CipherViewLikeUtils.getType(cipher),
    );

    // If cipher type is not restricted by any organization, allow it
    if (!restriction) {
      return false;
    }

    // If cipher belongs to an organization
    if (cipher.organizationId) {
      // Check if this organization allows viewing this cipher type
      return !restriction.allowViewOrgIds.includes(cipher.organizationId);
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
