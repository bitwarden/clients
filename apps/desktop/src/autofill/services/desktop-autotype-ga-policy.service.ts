import { Injectable } from "@angular/core";
import { Observable, of } from "rxjs";
import { distinctUntilChanged, filter, map, shareReplay, switchMap } from "rxjs/operators";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { AutotypeFeatureFlagState } from "@bitwarden/common/desktop-native/enums/autotype-feature-flag-state.enum";
import { autotypeFeatureFlagState$ } from "@bitwarden/common/desktop-native/services/autotype-feature-flags";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

@Injectable({ providedIn: "root" })
export class DesktopAutotypeGaPolicy {
  constructor(
    private readonly accountService: AccountService,
    private readonly authService: AuthService,
    private readonly policyService: PolicyService,
    private readonly configService: ConfigService,
  ) {}

  readonly autotypeGaDefaultSetting$: Observable<boolean | null> = autotypeFeatureFlagState$(
    this.configService,
  ).pipe(
    switchMap((autotypeFeatureFlagState) => {
      if (autotypeFeatureFlagState !== AutotypeFeatureFlagState.Ga) {
        return of(null);
      }

      return this.accountService.activeAccount$.pipe(
        filter((account) => account != null && account.id != null),
        getUserId,
        distinctUntilChanged(),
        switchMap((userId) => {
          const isUnlocked$ = this.authService.authStatusFor$(userId).pipe(
            map((status) => status === AuthenticationStatus.Unlocked),
            distinctUntilChanged(),
          );

          const policy$ = this.policyService
            .policyAppliesToUser$(PolicyType.AutotypeGaPolicy, userId)
            .pipe(
              map((applies) => (applies ? true : null)),
              distinctUntilChanged(),
            );

          return isUnlocked$.pipe(switchMap((unlocked) => (unlocked ? policy$ : of(null))));
        }),
      );
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );
}
