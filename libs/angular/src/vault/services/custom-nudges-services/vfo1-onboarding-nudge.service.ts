import { Injectable } from "@angular/core";
import { Observable, combineLatest, from, map, of } from "rxjs";
import { catchError } from "rxjs/operators";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { StateProvider } from "@bitwarden/state";

import { DefaultSingleNudgeService } from "../default-single-nudge.service";
import { NudgeStatus, NudgeType } from "../nudges.service";
import { VaultProfileService } from "../vault-profile.service";

export const VFO1_GA_RELEASE_DATE = new Date("2026-11-02T00:00:00.000Z");

/** How long after GA the VFO1 onboarding messages stay eligible to show. */
export const VFO1_ONBOARDING_WINDOW_MONTHS = 6;

/** The walkthrough is for long-term users, so accounts created in the 30 days before GA are excluded. */
export const VFO1_WALKTHROUGH_ACCOUNT_AGE_DAYS = 30;

function accountCutoff(nudgeType: NudgeType): number {
  if (nudgeType !== NudgeType.Vfo1Walkthrough) {
    return VFO1_GA_RELEASE_DATE.getTime();
  }
  const cutoff = new Date(VFO1_GA_RELEASE_DATE);
  cutoff.setDate(cutoff.getDate() - VFO1_WALKTHROUGH_ACCOUNT_AGE_DAYS);
  return cutoff.getTime();
}

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
    private vaultProfileService: VaultProfileService,
    private logService: LogService,
  ) {
    super(stateProvider);
  }

  nudgeStatus$(nudgeType: NudgeType, userId: UserId): Observable<NudgeStatus> {
    const profileDate$ = from(this.vaultProfileService.getProfileCreationDate(userId)).pipe(
      catchError(() => {
        this.logService.error("Error getting profile creation date");
        // Default to today, which reads as an account created after GA and hides the message —
        // safer than telling a brand new user that a vault they have never seen has changed.
        return of(new Date());
      }),
    );

    return combineLatest([profileDate$, this.getNudgeStatus$(nudgeType, userId)]).pipe(
      map(([profileCreationDate, status]) => {
        const accountTooNew = profileCreationDate.getTime() >= accountCutoff(nudgeType);
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
