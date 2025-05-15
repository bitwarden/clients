import { Injectable, inject } from "@angular/core";
import { Observable, combineLatest, from, of } from "rxjs";
import { catchError, map } from "rxjs/operators";

import { VaultProfileService } from "@bitwarden/angular/vault/services/vault-profile.service";
import { PinServiceAbstraction } from "@bitwarden/auth/common";
import { VaultTimeoutSettingsService } from "@bitwarden/common/key-management/vault-timeout";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";

import { DefaultSingleNudgeService } from "../default-single-nudge.service";
import { NudgeStatus, NudgeType } from "../nudges.service";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable({ providedIn: "root" })
export class AccountSecurityNudgeService extends DefaultSingleNudgeService {
  private vaultProfileService = inject(VaultProfileService);
  private logService = inject(LogService);
  private pinService = inject(PinServiceAbstraction);
  private vaultTimeoutSettingsService = inject(VaultTimeoutSettingsService);

  nudgeStatus$(nudgeType: NudgeType, userId: UserId): Observable<NudgeStatus> {
    const profileDate$ = from(this.vaultProfileService.getProfileCreationDate(userId)).pipe(
      catchError(() => {
        this.logService.error("Failed to load profile date:");
        // Default to today to ensure the nudge is shown in case of an error
        return of(new Date());
      }),
    );

    return combineLatest([
      profileDate$,
      this.getNudgeStatus$(nudgeType, userId),
      of(Date.now() - THIRTY_DAYS_MS),
      from(this.pinService.isPinSet(userId)),
      from(this.vaultTimeoutSettingsService.isBiometricLockSet(userId)),
    ]).pipe(
      map(([profileCreationDate, status, profileCutoff, isPinSet, isBiometricLockSet]) => {
        const profileOlderThanCutoff = profileCreationDate.getTime() < profileCutoff;
        const hideNudge = profileOlderThanCutoff || isPinSet || isBiometricLockSet;
        return {
          hasBadgeDismissed: status.hasBadgeDismissed || hideNudge,
          hasSpotlightDismissed: status.hasSpotlightDismissed || hideNudge,
        };
      }),
    );
  }
}
