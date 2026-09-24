import { Injectable } from "@angular/core";
import { Observable, combineLatest, from, map, of } from "rxjs";
import { catchError } from "rxjs/operators";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { StateProvider } from "@bitwarden/state";

import { DefaultSingleNudgeService } from "../default-single-nudge.service";
import { NudgeStatus, NudgeType } from "../nudges.service";
import { VaultProfileService } from "../vault-profile.service";

/**
 * The date the vault redesign became generally available. Accounts created on or after this date
 * never see the VFO1 onboarding messages, because nothing changed for them.
 *
 * TODO(https://bitwarden.atlassian.net/browse/PM-44017): Confirm the final GA date with Product
 * before release.
 */
export const VFO1_GA_RELEASE_DATE = new Date("2026-10-01T00:00:00.000Z");

/** How long after GA the VFO1 onboarding messages stay eligible to show. */
export const VFO1_ONBOARDING_WINDOW_MONTHS = 6;

/** The moment the onboarding window closes, after which every VFO1 message stays hidden. */
function onboardingWindowEnd(): number {
  const end = new Date(VFO1_GA_RELEASE_DATE);
  end.setMonth(end.getMonth() + VFO1_ONBOARDING_WINDOW_MONTHS);
  return end.getTime();
}

/**
 * Custom nudge service for the VFO1 onboarding messages.
 *
 * Hides a message in two cases: the account was created on or after the GA release date, or the
 * onboarding window has closed. This is the inverse of {@link NewAccountNudgeService}, which hides
 * a nudge once an account grows older than a cutoff.
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
        // Default to today, which reads as an account created after GA and hides the message.
        // Withholding the message is the safer failure: it avoids telling a brand new user that
        // a vault they have never seen has changed.
        return of(new Date());
      }),
    );

    return combineLatest([profileDate$, this.getNudgeStatus$(nudgeType, userId)]).pipe(
      map(([profileCreationDate, status]) => {
        const accountCreatedAfterGa =
          profileCreationDate.getTime() >= VFO1_GA_RELEASE_DATE.getTime();
        const windowClosed = Date.now() > onboardingWindowEnd();
        const autoDismiss = accountCreatedAfterGa || windowClosed;

        return {
          hasBadgeDismissed: status.hasBadgeDismissed || autoDismiss,
          hasSpotlightDismissed: status.hasSpotlightDismissed || autoDismiss,
        };
      }),
    );
  }
}
