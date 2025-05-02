import { Injectable, inject } from "@angular/core";
import { Observable, combineLatest, from, map, of } from "rxjs";
import { catchError } from "rxjs/operators";

import { VaultProfileService } from "@bitwarden/angular/vault/services/vault-profile.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";

import { DefaultSingleNudgeService } from "../default-single-nudge.service";
import { NudgeStatus, VaultNudgeType } from "../vault-nudges.service";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable({
  providedIn: "root",
})
export class AutofillNudgeService extends DefaultSingleNudgeService {
  vaultProfileService = inject(VaultProfileService);
  logService = inject(LogService);

  nudgeStatus$(_: VaultNudgeType, userId: UserId): Observable<NudgeStatus> {
    const profileDate$ = from(this.vaultProfileService.getProfileCreationDate(userId)).pipe(
      catchError(() => {
        this.logService.error("Error getting profile creation date");
        // Default to the past to ensure the nudge is shown
        return of(new Date("2024-12-31"));
      }),
    );

    return combineLatest([
      profileDate$,
      this.getNudgeStatus$(VaultNudgeType.AutofillNudge, userId),
      of(Date.now() - THIRTY_DAYS_MS),
    ]).pipe(
      map(([profileCreationDate, status, profileCutoff]) => {
        const profileOlderThanCutoff = profileCreationDate.getTime() > profileCutoff;
        return {
          hasBadgeDismissed: status.hasBadgeDismissed || profileOlderThanCutoff,
          hasSpotlightDismissed: status.hasSpotlightDismissed || profileOlderThanCutoff,
        };
      }),
    );
  }
}
