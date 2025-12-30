import { Injectable } from "@angular/core";
import { Observable, of } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";

import { SingleNudgeService } from "../default-single-nudge.service";
import { NudgeStatus, NudgeType } from "../nudges.service";

/**
 * A no-op nudge service that always returns dismissed status.
 * Use this for nudges that should be completely ignored/hidden in certain clients.
 * For example, browser-specific nudges can use this as the default in non-browser clients.
 */
@Injectable({ providedIn: "root" })
export class NoOpNudgeService implements SingleNudgeService {
  nudgeStatus$(_nudgeType: NudgeType, _userId: UserId): Observable<NudgeStatus> {
    return of({ hasBadgeDismissed: true, hasSpotlightDismissed: true });
  }

  async setNudgeStatus(
    _nudgeType: NudgeType,
    _newStatus: NudgeStatus,
    _userId: UserId,
  ): Promise<void> {
    // No-op: state changes are ignored
  }
}
