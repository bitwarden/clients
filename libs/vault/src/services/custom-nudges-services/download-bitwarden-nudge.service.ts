import { Injectable, OnInit, inject } from "@angular/core";
import { Observable, combineLatest, firstValueFrom, map, of } from "rxjs";

import { VaultProfileService } from "@bitwarden/angular/vault/services/vault-profile.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";

import { DefaultSingleNudgeService } from "../default-single-nudge.service";
import { NudgeStatus, VaultNudgeType } from "../vault-nudges.service";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Custom Nudge Service to use for the DownloadBitwarden Nudge in the Vault
 */
@Injectable({
  providedIn: "root",
})
export class DownloadBitwardenNudgeService extends DefaultSingleNudgeService implements OnInit {
  vaultProfileService = inject(VaultProfileService);
  accountService = inject(AccountService);
  logService = inject(LogService);

  activeUserId: UserId | null = null;
  profileCreatedDate: Date = new Date();

  async ngOnInit() {
    this.activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    try {
      this.profileCreatedDate = await this.vaultProfileService.getProfileCreationDate(
        this.activeUserId,
      );
    } catch (e) {
      this.logService.error("Error getting profile creation date", e);
      // Default to before the cutoff date to ensure the callout is shown
      this.profileCreatedDate = new Date("2024-12-24");
    }
  }

  shouldShowNudge$(nudgeType: VaultNudgeType, userId: UserId): Observable<NudgeStatus> {
    return combineLatest([
      this.getNudgeStatus$(nudgeType, userId),
      of(Date.now() - THIRTY_DAYS_MS),
    ]).pipe(
      map(([status, profileCutoff]) => {
        const profileOlderThanCutoff = this.profileCreatedDate.getTime() > profileCutoff;
        return {
          hasBadgeDismissed: status.hasBadgeDismissed || profileOlderThanCutoff,
          hasSpotlightDismissed: status.hasSpotlightDismissed || profileOlderThanCutoff,
        };
      }),
    );
  }
}
