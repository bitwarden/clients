import { Injectable } from "@angular/core";
import { combineLatest, map, Observable, of } from "rxjs";
import { distinctUntilChanged, shareReplay, switchMap } from "rxjs/operators";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CipherType } from "@bitwarden/common/vault/enums";

export type RestrictedCipherType = { cipherType: CipherType; allowView: boolean };
@Injectable({ providedIn: "root" })
export class RestrictedItemTypesService {
  constructor(
    private policyService: PolicyService,
    private accountService: AccountService,
    private organizationService: OrganizationService,
    private configService: ConfigService,
  ) {}

  /**
   * Emits an array of objects { cipherType, allowView } for each cipher type
   * that is restricted by at least one org. `allowView` is true if at least one
   * org either has not enabled the policy or does not list that cipherType in its
   * restricted list. If every org has enabled the policy and includes this cipherType,
   * then allowView is false.
   */
  readonly restricted$: Observable<RestrictedCipherType[]> = this.configService
    .getFeatureFlag$(FeatureFlag.RemoveCardItemTypePolicy)
    .pipe(
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true }),
      switchMap((isEnabled) => {
        if (!isEnabled) {
          return of([] as { cipherType: CipherType; allowView: boolean }[]);
        }

        return this.accountService.activeAccount$.pipe(
          getUserId,
          switchMap((userId) =>
            combineLatest([
              this.organizationService.organizations$(userId),
              this.policyService.policies$(userId),
            ]),
          ),
          map(([organizations, allPolicies]) => {
            // 1. Collect all enabled RestrictedItemTypes policies
            const enabledPolicies = allPolicies.filter(
              (p) => p.type === PolicyType.RestrictedItemTypes && p.enabled,
            );

            // 2. Build a Set of all cipher types restricted by at least one policy
            const unionRestricted = new Set<CipherType>();
            enabledPolicies.forEach((policy) => {
              const restrictedList: CipherType[] = policy.data
                ? (policy.data as CipherType[])
                : [CipherType.Card];
              restrictedList.forEach((ct) => unionRestricted.add(ct));
            });

            // 3. For each cipherType in unionRestricted, determine allowView:
            //    - allowView = true if there exists any org where:
            //       • that org has no enabled policy, OR
            //       • that org's enabled policy does not list this cipherType
            //    - Otherwise (every org has an enabled policy AND each lists this cipherType),
            //      allowView = false.
            const result: { cipherType: CipherType; allowView: boolean }[] = [];
            unionRestricted.forEach((cipherType) => {
              // Check if at least one org "allows" this type
              const someOrgAllows = organizations.some((org) => {
                // Find this org's policy (if any)
                const policyForOrg = enabledPolicies.find((p) => p.organizationId === org.id);
                // If no enabled policy for this org → it allows everything
                if (!policyForOrg) {
                  return true;
                }
                // Otherwise, if policyForOrg.data is undefined → default to [CipherType.Card]
                const restrictedList: CipherType[] = policyForOrg.data
                  ? (policyForOrg.data as CipherType[])
                  : [CipherType.Card];
                // If this cipherType is not in that restricted list → org allows it
                return !restrictedList.includes(cipherType);
              });

              result.push({
                cipherType,
                allowView: someOrgAllows,
              });
            });

            return result;
          }),
          shareReplay({ bufferSize: 1, refCount: true }),
        );
      }),
    );
}
