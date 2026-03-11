import { inject, Injectable } from "@angular/core";
import { combineLatest, map, shareReplay, switchMap } from "rxjs";
import type { Observable } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

@Injectable({ providedIn: "root" })
export class SendPolicyService {
  private policyService = inject(PolicyService);
  private accountService = inject(AccountService);
  private configService = inject(ConfigService);

  private readonly flagAndUser$ = combineLatest([
    this.configService.getFeatureFlag$(FeatureFlag.SendControls),
    this.accountService.activeAccount$.pipe(getUserId),
  ]);

  readonly disableSend$: Observable<boolean> = this.flagAndUser$.pipe(
    switchMap(([sendControlsEnabled, userId]) =>
      sendControlsEnabled
        ? this.policyService
            .policiesByType$(PolicyType.DisableSend, userId)
            .pipe(map((policies) => policies?.some((p) => p.enabled) ?? false))
        : this.policyService.policyAppliesToUser$(PolicyType.DisableSend, userId),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  // Both flag branches read from PolicyType.SendOptions because the server does not have a
  // PolicyType.SendControls type. The SendControls dialog always saves disableHideEmail to
  // SendOptions, so enforcement always reads from there regardless of the flag state.
  readonly disableHideEmail$: Observable<boolean> = this.flagAndUser$.pipe(
    switchMap(([, userId]) =>
      this.policyService
        .policiesByType$(PolicyType.SendOptions, userId)
        .pipe(map((policies) => policies?.some((p) => p.data?.disableHideEmail) ?? false)),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );
}
