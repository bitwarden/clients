import { inject, Injectable } from "@angular/core";
import { combineLatest, distinctUntilChanged, map, Observable, of, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserId } from "@bitwarden/common/types/guid";

import { DefaultSingleNudgeService } from "../default-single-nudge.service";
import { NudgeStatus, VaultNudgeType } from "../vault-nudges.service";

/**
 * Custom Nudge Service used for showing if the user has any existing nudge in the Vault.
 */
@Injectable({
  providedIn: "root",
})
export class HasNudgeService extends DefaultSingleNudgeService {
  private accountService = inject(AccountService);

  private nudgeTypes: VaultNudgeType[] = [
    VaultNudgeType.EmptyVaultNudge,
    // add additional nudge types here as needed
  ];

  /**
   * Returns an observable that emits true if any of the provided nudge types are present
   */
  nudgeStatus$(): Observable<NudgeStatus> {
    return this.accountService.activeAccount$.pipe(
      switchMap((activeAccount) => {
        const userId: UserId | undefined = activeAccount?.id;
        if (!userId) {
          return of({ hasBadgeDismissed: true, hasSpotlightDismissed: true });
        }

        const nudgeObservables: Observable<NudgeStatus>[] = this.nudgeTypes.map((nudge) =>
          super.nudgeStatus$(nudge, userId),
        );

        return combineLatest(nudgeObservables).pipe(
          map((nudgeStates) => {
            return {
              hasBadgeDismissed: true,
              hasSpotlightDismissed: nudgeStates.some((state) => state.hasSpotlightDismissed),
            };
          }),
          distinctUntilChanged(),
        );
      }),
    );
  }
}
