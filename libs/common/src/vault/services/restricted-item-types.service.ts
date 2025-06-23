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
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

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
}

/**
 * Filter that returns whether a cipher is restricted from being viewed by the user
 * Criteria:
 * - the cipher's type is restricted by at least one org
 * UNLESS
 * - the cipher belongs to an organization and that organization does not restrict that type
 * OR
 * - the cipher belongs to the user's personal vault and at least one other organization does not restrict that type
 */
export function isCipherViewRestricted(
  cipher: CipherView,
  restrictedTypes: RestrictedCipherType[],
) {
  return restrictedTypes.some(
    (restrictedType) =>
      restrictedType.cipherType === cipher.type &&
      (cipher.organizationId
        ? !restrictedType.allowViewOrgIds.includes(cipher.organizationId)
        : restrictedType.allowViewOrgIds.length === 0),
  );
}
