import { Injectable } from "@angular/core";
import { map, Observable, of, switchMap } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CipherType } from "@bitwarden/common/vault/enums";

@Injectable({ providedIn: "root" })
export class RestrictedItemTypesService {
  readonly restricted$: Observable<CipherType[]> = this.configService
    .getFeatureFlag$(FeatureFlag.RemoveCardItemTypePolicy)
    .pipe(
      switchMap((isEnabled) => {
        if (!isEnabled) {
          return of([] as CipherType[]);
        }

        return this.accountService.activeAccount$.pipe(
          getUserId,
          switchMap((userId) => {
            return this.policyService.policiesByType$(PolicyType.RestrictedItemTypes, userId).pipe(
              map((enabledPolicies) => {
                if (enabledPolicies.length === 0) {
                  return [];
                }

                const allRestricted = new Set(
                  enabledPolicies.flatMap((policy) =>
                    policy.data ? (policy.data as CipherType[]) : [CipherType.Card],
                  ),
                );

                return Array.from(allRestricted);
              }),
            );
          }),
        );
      }),
    );

  constructor(
    private policyService: PolicyService,
    private accountService: AccountService,
    private configService: ConfigService,
  ) {}
}
