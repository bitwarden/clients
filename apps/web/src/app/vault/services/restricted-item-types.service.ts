import { Injectable } from "@angular/core";
import { of } from "rxjs";
import { distinctUntilChanged, map, shareReplay, switchMap } from "rxjs/operators";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { getFirstPolicy } from "@bitwarden/common/admin-console/services/policy/default-policy.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CipherType } from "@bitwarden/common/vault/enums";

@Injectable({ providedIn: "root" })
export class RestrictedItemTypesService {
  constructor(
    private policyService: PolicyService,
    private accountService: AccountService,
    private configService: ConfigService,
  ) {}
  get restricted$() {
    return this.configService.getFeatureFlag$(FeatureFlag.RemoveCardItemTypePolicy).pipe(
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true }),
      switchMap((isEnabled) => {
        if (!isEnabled) {
          return of([] as CipherType[]);
        }
        return this.accountService.activeAccount$.pipe(
          getUserId,
          switchMap((userId) =>
            this.policyService
              .policiesByType$(PolicyType.RestrictedItemTypes, userId)
              .pipe(getFirstPolicy),
          ),
          map((policy) => {
            if (!policy) {
              return [];
            }
            if (!policy.data) {
              // Default to Card if no data is set
              return [CipherType.Card];
            }
            return policy.data as CipherType[];
          }),
        );
      }),
    );
  }
}
