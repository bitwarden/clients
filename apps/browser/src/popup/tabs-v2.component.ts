import { Component } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Router, NavigationEnd } from "@angular/router";
import { combineLatest, of, Observable } from "rxjs";
import { filter, map, startWith, switchMap } from "rxjs/operators";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserId } from "@bitwarden/common/types/guid";
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
    private router: Router,
    private vaultNudgesService: VaultNudgesService,
    private accountService: AccountService,
  ) {
    this.showBerry$ = combineLatest([
      this.accountService.activeAccount$,
      this.router.events.pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        startWith(new NavigationEnd(0, "/tabs/vault", "/tabs/vault")),
      ),
    ]).pipe(
      switchMap(([activeAccount, navEvent]): Observable<boolean> => {
        if (!activeAccount || !navEvent.urlAfterRedirects.includes("tabs/vault")) {
          return of(false);
        }
        const userId: UserId = activeAccount.id;
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
