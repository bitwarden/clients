import { Injectable } from "@angular/core";
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

export type RestrictedCipherType = {
  cipherType: CipherType;
  allowViewOrgIds: string[];
};

@Injectable({ providedIn: "root" })
export class RestrictedItemTypesService {
  /**
   * Emits an array of RestrictedCipherType objects:
   * - cipherType: each type restricted by at least one policy
   * - allowViewOrgIds: array of org IDs that allow viewing this type
   */
  readonly restricted$: Observable<RestrictedCipherType[]> = this.configService
    .getFeatureFlag$(FeatureFlag.RemoveCardItemTypePolicy)
    .pipe(
      switchMap((flagOn) => {
        if (!flagOn) {
          return of([] as RestrictedCipherType[]);
        }
        return this.accountService.activeAccount$.pipe(
          getUserId,
          switchMap((userId) =>
            combineLatest([
              this.organizationService.organizations$(userId),
              this.policyService.policies$(userId),
            ]),
          ),
          map(([orgs, policies]) => {
            const enabledPolicies = policies.filter(
              (p) => p.type === PolicyType.RestrictedItemTypes && p.enabled,
            );

            // default restricted list helper
            const listFor = (p: (typeof enabledPolicies)[number]) =>
              (p.data as CipherType[]) ?? [CipherType.Card];

            // union of all restricted types
            const union = Array.from(new Set(enabledPolicies.flatMap((p) => listFor(p))));

            return union.map((cipherType) => {
              // collect org IDs that allow this type
              const allowViewOrgIds = orgs
                .filter((org) => {
                  const orgPol = enabledPolicies.find((p) => p.organizationId === org.id);
                  // if no policy → allows everything
                  if (!orgPol) {
                    return true;
                  }
                  // otherwise, if this type is not restricted in their list
                  return !listFor(orgPol).includes(cipherType);
                })
                .map((org) => org.id);

              return { cipherType, allowViewOrgIds };
            });
          }),
        );
      }),
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

  constructor(
    private configService: ConfigService,
    private accountService: AccountService,
    private organizationService: OrganizationService,
    private policyService: PolicyService,
  ) {}
}
