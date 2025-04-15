import { Injectable, inject } from "@angular/core";
import { Observable, combineLatest, from } from "rxjs";
import { map } from "rxjs/operators";

import { VaultProfileService } from "@bitwarden/angular/vault/services/vault-profile.service";
import { PinServiceAbstraction } from "@bitwarden/auth/common";
import { VaultTimeoutSettingsService } from "@bitwarden/common/key-management/vault-timeout";
import { UserId } from "@bitwarden/common/types/guid";

import { DefaultSingleNudgeService } from "../default-single-nudge.service";
import { VaultNudgeType } from "../vault-nudges.service";

/**
 * Custom Nudge Service to use for the Account Security nudges in the Vault.
 */
@Injectable({
  providedIn: "root",
})
export class AccountSecurityNudgeService extends DefaultSingleNudgeService {
  pinService = inject(PinServiceAbstraction);
  vaultProfileService = inject(VaultProfileService);
  vaultTimeoutSettingsService = inject(VaultTimeoutSettingsService);

  shouldShowNudge$(nudgeType: VaultNudgeType, userId: UserId): Observable<boolean> {
    const isNotDismissed$ = this.isDismissed$(nudgeType, userId).pipe(
      map((dismissed) => !dismissed),
    );

    const accountNewerThan30Days$ = from(
      this.vaultProfileService.getProfileCreationDate(userId),
    ).pipe(
      map((profileCreatedDate) => {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 30);
        return profileCreatedDate >= cutoffDate;
      }),
    );

    const unlockMethodSet$ = combineLatest([
      from(this.pinService.isPinSet(userId)),
      from(this.vaultTimeoutSettingsService.isBiometricLockSet()),
    ]).pipe(map(([isPinSet, isBiometricLockSet]) => isPinSet || isBiometricLockSet));

    return combineLatest([isNotDismissed$, accountNewerThan30Days$, unlockMethodSet$]).pipe(
      map(
        ([isNotDismissed, accountNewerThan30Days, unlockMethodSet]) =>
          isNotDismissed && accountNewerThan30Days && !unlockMethodSet,
      ),
    );
  }

  dismissNudge(userId: UserId): Promise<void> {
    return this.setNudgeStatus(VaultNudgeType.AccountSecurity, true, userId);
  }
}
