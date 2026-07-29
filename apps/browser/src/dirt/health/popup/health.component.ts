import { Component, ChangeDetectionStrategy, inject, OnInit, DestroyRef } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { map, switchMap } from "rxjs";

import { CurrentAccountComponent } from "@bitwarden/browser/auth/popup/account-switching/current-account.component";
import { PopOutComponent } from "@bitwarden/browser/platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "@bitwarden/browser/platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "@bitwarden/browser/platform/popup/layout/popup-page.component";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nPipe } from "@bitwarden/ui-common";

import { HealthAccessService } from "./services/health-access.service";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "health",
  templateUrl: "./health.component.html",
  imports: [
    PopupPageComponent,
    PopupHeaderComponent,
    PopOutComponent,
    CurrentAccountComponent,
    I18nPipe,
  ],
})
export class HealthComponent implements OnInit {
  readonly destroyRef = inject(DestroyRef);
  readonly accountService = inject(AccountService);
  readonly healthAccessService = inject(HealthAccessService);

  readonly userId = toSignal(
    this.accountService.activeAccount$.pipe(map((account) => account?.id)),
  );

  ngOnInit(): void {
    const userId = this.userId();
    if (!userId) {
      return;
    }

    this.healthAccessService
      .healthHasBeenOpened$(userId)
      .pipe(
        switchMap(async (hasBeenOpened) => {
          if (!hasBeenOpened) {
            await this.healthAccessService.setHealthHasBeenOpened(userId);
          }
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
}
