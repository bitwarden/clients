import { Injectable, inject } from "@angular/core";
import { Observable, combineLatest, from, map, of } from "rxjs";
import { catchError } from "rxjs/operators";

import { VaultProfileService } from "@bitwarden/angular/vault/services/vault-profile.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";

import { DefaultSingleNudgeService } from "../default-single-nudge.service";
import { NudgeStatus, NudgeType } from "../nudges.service";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Custom Nudge Service to check if account is older than 30 days
 */
@Injectable({
  providedIn: "root",
})
export class NewAccountNudgeService extends DefaultSingleNudgeService {
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
      profileDate$,
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
