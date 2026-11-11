import { Injectable } from "@angular/core";
import { Observable, combineLatest, map, of } from "rxjs";
import { catchError } from "rxjs/operators";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { StateProvider } from "@bitwarden/state";

import { DefaultSingleNudgeService } from "../default-single-nudge.service";
import { NudgeStatus, NudgeType } from "../nudges.service";

export const VFO1_GA_RELEASE_DATE = new Date("2026-11-19T00:00:00.000Z");

/** How long after GA the VFO1 onboarding messages stay eligible to show. */
export const VFO1_ONBOARDING_WINDOW_MONTHS = 6;

function onboardingWindowEnd(): number {
  const end = new Date(VFO1_GA_RELEASE_DATE);
  end.setMonth(end.getMonth() + VFO1_ONBOARDING_WINDOW_MONTHS);
  return end.getTime();
}

/**
 * The inverse of {@link NewAccountNudgeService}: hides a nudge for accounts *newer* than the
 * cutoff, rather than older.
 */
@Injectable({
  providedIn: "root",
})
export class Vfo1OnboardingNudgeService extends DefaultSingleNudgeService {
  constructor(
    stateProvider: StateProvider,
    private accountService: AccountService,
    private logService: LogService,
  ) {
    super(stateProvider);
  }

  nudgeStatus$(nudgeType: NudgeType, userId: UserId): Observable<NudgeStatus> {
    const profileDate$ = this.accountService.activeAccount$.pipe(
      map((account) => account?.creationDate ?? new Date()),
      catchError(() => {
        this.logService.error("Error getting profile creation date");
        // Default to today, which reads as an account created after GA and hides the message —
        // safer than telling a brand new user that a vault they have never seen has changed.
        return of(new Date());
      }),
    );

    return combineLatest([profileDate$, this.getNudgeStatus$(nudgeType, userId)]).pipe(
      map(([profileCreationDate, status]) => {
        const accountTooNew = profileCreationDate.getTime() >= VFO1_GA_RELEASE_DATE.getTime();
        const windowClosed = Date.now() > onboardingWindowEnd();
        const autoDismiss = accountTooNew || windowClosed;

        return {
          hasBadgeDismissed: status.hasBadgeDismissed || autoDismiss,
          hasSpotlightDismissed: status.hasSpotlightDismissed || autoDismiss,
        };
      }),
    );
  }
}
