import { inject, Injectable } from "@angular/core";
import { combineLatest, from, Observable, of, switchMap } from "rxjs";
import { catchError } from "rxjs/operators";

import { VaultProfileService } from "@bitwarden/angular/vault/services/vault-profile.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";

import { DefaultSingleNudgeService } from "../default-single-nudge.service";
import { NudgeStatus, NudgeType } from "../nudges.service";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Custom Nudge Service Checking Nudge Status For Welcome Nudge With Populated Vault
 */
@Injectable({
  providedIn: "root",
})
export class HasItemsNudgeService extends DefaultSingleNudgeService {
  cipherService = inject(CipherService);
  vaultProfileService = inject(VaultProfileService);
  logService = inject(LogService);

  nudgeStatus$(nudgeType: NudgeType, userId: UserId): Observable<NudgeStatus> {
    const profileDate$ = from(this.vaultProfileService.getProfileCreationDate(userId)).pipe(
      catchError(() => {
        this.logService.error("Error getting profile creation date");
        // Default to today to ensure we show the nudge
        return of(new Date());
      }),
    );

    return combineLatest([
      this.cipherService.cipherViews$(userId),
      this.getNudgeStatus$(nudgeType, userId),
      profileDate$,
      of(Date.now() - THIRTY_DAYS_MS),
    ]).pipe(
      switchMap(async ([ciphers, nudgeStatus, profileDate, profileCutoff]) => {
        const profileOlderThanCutoff = profileDate.getTime() < profileCutoff;
        const filteredCiphers = ciphers?.filter((cipher) => {
          return cipher.deletedDate == null;
        });

        if (
          profileOlderThanCutoff &&
          filteredCiphers.length > 0 &&
          !nudgeStatus.hasSpotlightDismissed
        ) {
          const dismissedStatus = {
            hasSpotlightDismissed: true,
            hasBadgeDismissed: true,
          };
          // permanently dismiss both the Empty Vault Nudge and Has Items Vault Nudge if the profile is older than 30 days
          await this.setNudgeStatus(nudgeType, dismissedStatus, userId);
          await this.setNudgeStatus(NudgeType.EmptyVaultNudge, dismissedStatus, userId);
          return dismissedStatus;
        } else if (nudgeStatus.hasSpotlightDismissed) {
          return nudgeStatus;
        } else {
          return {
            hasBadgeDismissed: filteredCiphers == null || filteredCiphers.length === 0,
            hasSpotlightDismissed: filteredCiphers == null || filteredCiphers.length === 0,
          };
        }
      }),
    );
  }
}
