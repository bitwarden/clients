import { inject, Injectable } from "@angular/core";
import { map, Observable } from "rxjs";

import { StateProvider } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";

import { VAULT_NUDGE_DISMISSED_DISK_KEY, VaultNudgeType } from "./vault-nudges.service";

/**
 * Base interface for handling a nudge's status
 */
export interface SingleNudgeService {
  shouldShowNudge$(nudgeType: VaultNudgeType, userId: UserId): Observable<boolean>;

  setNudgeStatus(nudgeType: VaultNudgeType, dismissed: boolean, userId: UserId): Promise<void>;
}

/**
 * Default implementation for nudges. Set and Show Nudge dismissed state
 */
@Injectable({
  providedIn: "root",
})
export class DefaultSingleNudgeService implements SingleNudgeService {
  stateProvider = inject(StateProvider);

  protected isDismissed$(nudgeType: VaultNudgeType, userId: UserId): Observable<boolean> {
    return this.stateProvider
      .getUser(userId, VAULT_NUDGE_DISMISSED_DISK_KEY)
      .state$.pipe(map((nudges) => nudges?.includes(nudgeType) ?? false));
  }

  shouldShowNudge$(nudgeType: VaultNudgeType, userId: UserId): Observable<boolean> {
    return this.isDismissed$(nudgeType, userId).pipe(map((dismissed) => !dismissed));
  }

  async setNudgeStatus(
    nudgeType: VaultNudgeType,
    dismissed: boolean,
    userId: UserId,
  ): Promise<void> {
    await this.stateProvider.getUser(userId, VAULT_NUDGE_DISMISSED_DISK_KEY).update((nudges) => {
      nudges ??= [];
      if (dismissed) {
        nudges.push(nudgeType);
      } else {
        nudges = nudges.filter((n) => n !== nudgeType);
      }
      return nudges;
    });
  }
}
