import { inject, Injectable } from "@angular/core";
import { combineLatest, map, Observable, shareReplay, switchMap } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

/**
 * Service for evaluating Send-related policy restrictions for the current user.
 */
@Injectable({
  providedIn: "root",
})
export class SendPolicyService {
  private policyService = inject(PolicyService);
  private accountService = inject(AccountService);
  private configService = inject(ConfigService);

  private readonly flagAndUser$ = combineLatest([
    this.configService.getFeatureFlag$(FeatureFlag.SendControls),
    this.accountService.activeAccount$.pipe(getUserId),
  ]);

  /**
   * Emits `true` when the active user is prohibited from creating or editing Sends.
   * Respects the `pm-31885-send-controls` feature flag:
   *   - Flag ON  → checks `PolicyType.SendControls` OR legacy `PolicyType.DisableSend`
   *   - Flag OFF → checks `PolicyType.DisableSend`
   */
  readonly disableSend$: Observable<boolean> = this.flagAndUser$.pipe(
    switchMap(([sendControlsEnabled, userId]) =>
      sendControlsEnabled
        ? combineLatest([
            this.policyService
              .policiesByType$(PolicyType.SendControls, userId)
              .pipe(
                map((policies) => policies?.some((p) => p.data?.disableSend === true) ?? false),
              ),
            this.policyService.policyAppliesToUser$(PolicyType.DisableSend, userId),
          ]).pipe(map(([sendControls, legacyDisableSend]) => sendControls || legacyDisableSend))
        : this.policyService.policyAppliesToUser$(PolicyType.DisableSend, userId),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  /**
   * Emits `true` when the active user is prohibited from hiding their email on Sends.
   * Respects the `pm-31885-send-controls` feature flag:
   *   - Flag ON  → checks `PolicyType.SendControls` OR legacy `PolicyType.SendOptions`
   *   - Flag OFF → checks `PolicyType.SendOptions` with `data.disableHideEmail`
   */
  readonly disableHideEmail$: Observable<boolean> = this.flagAndUser$.pipe(
    switchMap(([sendControlsEnabled, userId]) =>
      sendControlsEnabled
        ? combineLatest([
            this.policyService
              .policiesByType$(PolicyType.SendControls, userId)
              .pipe(
                map(
                  (policies) => policies?.some((p) => p.data?.disableHideEmail === true) ?? false,
                ),
              ),
            this.policyService
              .policiesByType$(PolicyType.SendOptions, userId)
              .pipe(map((policies) => policies?.some((p) => p.data?.disableHideEmail) ?? false)),
          ]).pipe(map(([sendControls, legacySendOptions]) => sendControls || legacySendOptions))
        : this.policyService
            .policiesByType$(PolicyType.SendOptions, userId)
            .pipe(map((policies) => policies?.some((p) => p.data?.disableHideEmail) ?? false)),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );
}
