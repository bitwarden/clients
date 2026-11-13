import { Injectable } from "@angular/core";
import { Observable, combineLatest, map, of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserId } from "@bitwarden/common/types/guid";
import { StateProvider } from "@bitwarden/state";

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
  constructor(
    stateProvider: StateProvider,
    private accountService: AccountService,
  ) {
    super(stateProvider);
  }

  nudgeStatus$(nudgeType: NudgeType, userId: UserId): Observable<NudgeStatus> {
    const profileDate$ = this.accountService.accounts$.pipe(
      map((accounts) => accounts[userId]?.creationDate ?? new Date()),
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
