import { Component } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { combineLatest, of, Observable } from "rxjs";
import { map, switchMap } from "rxjs/operators";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { VaultNudgeType, VaultNudgesService } from "@bitwarden/vault";

@Component({
  selector: "app-tabs-v2",
  templateUrl: "./tabs-v2.component.html",
  providers: [VaultNudgesService],
})
export class TabsV2Component {
  showBerry$: Observable<boolean> = of(false);

  nudgeTypes = [
    VaultNudgeType.HasVaultItems,
    VaultNudgeType.IntroCarouselDismissal,
    // add additional nudge types here as needed
  ];

  constructor(
    private vaultNudgesService: VaultNudgesService,
    private accountService: AccountService,
  ) {
    this.showBerry$ = this.accountService.activeAccount$.pipe(
      switchMap((activeAccount) => {
        // Listen for navigation events to determine if the current route is the vault
        const userId = activeAccount?.id;
        if (!userId) {
          return of(false);
        }
        const nudgeObservables: Observable<boolean>[] = this.nudgeTypes.map((nudge) =>
          this.vaultNudgesService.showNudge$(nudge, userId),
        );
        // Combine all nudge observables; emit true if any of the nudges are true
        return combineLatest(nudgeObservables).pipe(
          map((nudgeStates) => nudgeStates.some((state) => state)),
        );
      }),
      takeUntilDestroyed(),
    );
  }
}
