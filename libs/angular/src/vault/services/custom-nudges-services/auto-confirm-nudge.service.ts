import { inject, Injectable } from "@angular/core";
import { combineLatest, Observable, of, switchMap } from "rxjs";

import { AutomaticUserConfirmationService } from "@bitwarden/auto-confirm";
import { UserId } from "@bitwarden/user-core";

import { DefaultSingleNudgeService } from "../default-single-nudge.service";
import { NudgeType, NudgeStatus } from "../nudges.service";

@Injectable({ providedIn: "root" })
export class AutoConfirmNudgeService extends DefaultSingleNudgeService {
  autoConfirmService = inject(AutomaticUserConfirmationService);

  nudgeStatus$(nudgeType: NudgeType, userId: UserId): Observable<NudgeStatus> {
    return combineLatest([
      this.getNudgeStatus$(nudgeType, userId),
      this.autoConfirmService.configuration$(userId),
    ]).pipe(
      switchMap(([nudgeStatus, autoConfirmState]) => {
        const dismissed = autoConfirmState.showBrowserNotification === false;

        const status: NudgeStatus = {
          hasBadgeDismissed: dismissed,
          hasSpotlightDismissed: dismissed,
        };

        if (nudgeStatus.hasBadgeDismissed || nudgeStatus.hasSpotlightDismissed) {
          return of(nudgeStatus);
        }

        return of(status);
      }),
    );
  }
}
