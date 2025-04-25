import { Injectable, inject } from "@angular/core";
import { Observable, combineLatest, from, map, of } from "rxjs";

import { VaultProfileService } from "@bitwarden/angular/vault/services/vault-profile.service";
import { UserId } from "@bitwarden/common/types/guid";

import { DefaultSingleNudgeService } from "../default-single-nudge.service";
import { NudgeStatus, VaultNudgeType } from "../vault-nudges.service";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Custom Nudge Service to use for the Autofill Nudge in the Vault
 */
@Injectable({
  providedIn: "root",
})
export class AutofillNudgeService extends DefaultSingleNudgeService {
  vaultProfileService = inject(VaultProfileService);

  shouldShowNudge$(nudgeType: VaultNudgeType, userId: UserId): Observable<NudgeStatus> {
    return combineLatest([
      from(this.vaultProfileService.getProfileCreationDate(userId)),
      this.getNudgeStatus$(nudgeType, userId),
      of(Date.now() - THIRTY_DAYS_MS),
    ]).pipe(
      map(([profileCreationDate, status, profileCutoff]) => {
        const profileOlderThanCutoff = profileCreationDate.getTime() < profileCutoff;
        return {
          hasBadgeDismissed: status.hasBadgeDismissed || profileOlderThanCutoff,
          hasSpotlightDismissed: status.hasSpotlightDismissed || profileOlderThanCutoff,
        };
      }),
    );
  }
}
