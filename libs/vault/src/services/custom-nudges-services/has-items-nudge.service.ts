import { inject, Injectable } from "@angular/core";
import { combineLatest, Observable, switchMap } from "rxjs";

import { VaultProfileService } from "@bitwarden/angular/vault/services/vault-profile.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";

import { DefaultSingleNudgeService } from "../default-single-nudge.service";
import { NudgeStatus, VaultNudgeType } from "../vault-nudges.service";

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

  nudgeStatus$(nudgeType: VaultNudgeType, userId: UserId): Observable<NudgeStatus> {
    return combineLatest([
      this.cipherService.cipherViews$(userId),
      this.getNudgeStatus$(nudgeType, userId),
    ]).pipe(
      switchMap(async ([ciphers, nudgeStatus]) => {
        try {
          const creationDate = await this.vaultProfileService.getProfileCreationDate(userId);
          const thirtyDays = new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000);
          const isRecentAcct = creationDate >= thirtyDays;

          if (!isRecentAcct || nudgeStatus.hasSpotlightDismissed) {
            return nudgeStatus;
          } else {
            return {
              hasBadgeDismissed: ciphers == null || ciphers.length === 0,
              hasSpotlightDismissed: ciphers == null || ciphers.length === 0,
            };
          }
        } catch (error) {
          this.logService.error("Failed to fetch profile creation date: ", error);
          return nudgeStatus;
        }
      }),
    );
  }
}
