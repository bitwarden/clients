import { LiveAnnouncer } from "@angular/cdk/a11y";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { combineLatest, of, Observable, from, Subject } from "rxjs";
import {
  distinctUntilChanged,
  filter,
  map,
  mergeMap,
  pairwise,
  switchMap,
  takeUntil,
} from "rxjs/operators";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { VaultNudgeType, VaultNudgesService } from "@bitwarden/vault";

@Component({
  selector: "app-tabs-v2",
  templateUrl: "./tabs-v2.component.html",
  providers: [VaultNudgesService],
})
export class TabsV2Component implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  showBerry$: Observable<boolean> = of(false);

  nudgeTypes = [
    VaultNudgeType.HasVaultItems,
    VaultNudgeType.IntroCarouselDismissal,
    // add additional nudge types here as needed
  ];

  constructor(
    private vaultNudgesService: VaultNudgesService,
    private accountService: AccountService,
    private ariaLive: LiveAnnouncer,
    private i18nService: I18nService,
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
          distinctUntilChanged(),
        );
      }),
      takeUntilDestroyed(),
    );
  }

  ngOnInit() {
    this.showBerry$
      .pipe(
        pairwise(),
        filter(([prev, curr]) => !prev && curr),
        mergeMap(() => from(this.ariaLive.announce(this.i18nService.t("newNotification")))),
        distinctUntilChanged(),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
