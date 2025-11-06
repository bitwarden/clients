import { inject, Injectable } from "@angular/core";
import { combineLatest, map, Observable } from "rxjs";

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
      this.autoConfirmService.canManageAutoConfirm$(userId),
    ]).pipe(
      map(([nudgeStatus, autoConfirmState, canManageAutoConfirm]) => {
        if (!canManageAutoConfirm) {
          return {
            hasBadgeDismissed: true,
            hasSpotlightDismissed: true,
          };
        }

        const dismissed = autoConfirmState.showBrowserNotification === false;

        const status: NudgeStatus = {
          hasBadgeDismissed: dismissed,
          hasSpotlightDismissed: dismissed,
        };

        if (nudgeStatus.hasBadgeDismissed || nudgeStatus.hasSpotlightDismissed) {
          return nudgeStatus;
        }

        return status;
      }),
    );
  }
}
