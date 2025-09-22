import { Injectable } from "@angular/core";
import { Observable, NEVER } from "rxjs";
import { distinctUntilChanged, filter, map, shareReplay, switchMap } from "rxjs/operators";

import { InternalPolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { getUserId } from "@bitwarden/common/auth/services/account.service";

@Injectable({ providedIn: "root" })
export class DesktopAutotypeDefaultSettingPolicy {
  constructor(
    private readonly accountService: AccountService,
    private readonly authService: AuthService,
    private readonly policyService: InternalPolicyService,
  ) {}

  /**
   * Emits the autotype policy's enabled status (true | false | null) when unlocked.
   * - true: autotype policy exists and is enabled
   * - false: autotype policy exists and is disabled
   * - null: no autotype policy exists for the user's organization
   */
  readonly autotypeDefaultSetting$: Observable<boolean | null> =
    this.accountService.activeAccount$.pipe(
      filter((account) => account != null),
      getUserId,
      distinctUntilChanged(),
      switchMap((userId) => {
        const isUnlocked$ = this.authService.authStatusFor$(userId).pipe(
          map((status) => status === AuthenticationStatus.Unlocked),
          distinctUntilChanged(),
        );

        const policy$ = this.policyService.policies$(userId).pipe(
          map((policies) =>
            policies.find((policy) => policy.type === PolicyType.AutotypeDefaultSetting),
          ),
          map((policy) => (policy ? policy.enabled : null)),
          distinctUntilChanged(),
          shareReplay({ bufferSize: 1, refCount: true }),
        );

        return isUnlocked$.pipe(switchMap((unlocked) => (unlocked ? policy$ : NEVER)));
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
}
