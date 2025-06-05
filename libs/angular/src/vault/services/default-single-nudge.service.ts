import { inject, Injectable } from "@angular/core";
import { map, Observable } from "rxjs";

import { StateProvider } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";

import { NudgeStatus, NUDGE_DISMISSED_DISK_KEY, NudgeType } from "./nudges.service";

/**
 * Base interface for handling a nudge's status
 */
export interface SingleNudgeService {
  nudgeStatus$(nudgeType: NudgeType, userId: UserId): Observable<NudgeStatus>;

  setNudgeStatus(nudgeType: NudgeType, newStatus: NudgeStatus, userId: UserId): Promise<void>;
}

/**
 * Default implementation for nudges. Set and Show Nudge dismissed state
 */
@Injectable({
  providedIn: "root",
})
export class DefaultSingleNudgeService implements SingleNudgeService {
  stateProvider = inject(StateProvider);

  protected getNudgeStatus$(nudgeType: NudgeType, userId: UserId): Observable<NudgeStatus> {
    return this.stateProvider
      .getUser(userId, NUDGE_DISMISSED_DISK_KEY)
      .state$.pipe(
        map(
          (nudges) =>
            nudges?.[nudgeType] ?? { hasBadgeDismissed: false, hasSpotlightDismissed: false },
        ),
      );
  }

  nudgeStatus$(nudgeType: NudgeType, userId: UserId): Observable<NudgeStatus> {
    return this.getNudgeStatus$(nudgeType, userId);
  }

  async setNudgeStatus(nudgeType: NudgeType, status: NudgeStatus, userId: UserId): Promise<void> {
    await this.stateProvider.getUser(userId, NUDGE_DISMISSED_DISK_KEY).update((nudges) => {
      nudges ??= {};
      nudges[nudgeType] = status;
      return nudges;
    });
  }
}
