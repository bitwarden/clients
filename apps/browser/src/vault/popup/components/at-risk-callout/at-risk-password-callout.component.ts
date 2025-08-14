import { CommonModule } from "@angular/common";
import { Component, inject, effect, signal, Signal, WritableSignal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { RouterModule } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { SecurityTask } from "@bitwarden/common/vault/tasks";
import { AnchorLinkDirective, CalloutModule, BannerModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import {
  AtRiskPasswordCalloutData,
  AtRiskPasswordCalloutService,
} from "@bitwarden/web-vault/app/vault/services/at-risk-password-callout.service";

@Component({
  selector: "vault-at-risk-password-callout",
  imports: [
    CommonModule,
    AnchorLinkDirective,
    RouterModule,
    CalloutModule,
    I18nPipe,
    BannerModule,
    JslibModule,
  ],
  providers: [AtRiskPasswordCalloutService],
  templateUrl: "./at-risk-password-callout.component.html",
})
export class AtRiskPasswordCalloutComponent {
  private activeAccount$ = inject(AccountService).activeAccount$.pipe(getUserId);
  private atRiskPasswordCalloutService = inject(AtRiskPasswordCalloutService);
  private userIdSignal = toSignal(this.activeAccount$, { initialValue: null });

  private atRiskPasswordStateSignal = toSignal(
    this.atRiskPasswordCalloutService.atRiskPasswordState(this.userIdSignal()!).state$,
    {
      initialValue: {
        hadPendingTasks: false,
        showTasksCompleteBanner: false,
        tasksBannerDismissed: false,
      } as AtRiskPasswordCalloutData,
    },
  );

  currentPendingTasks: Signal<SecurityTask[] | null> = toSignal(
    this.atRiskPasswordCalloutService.pendingTasks$(this.userIdSignal()!),
    {
      initialValue: null,
    },
  );

  showTasksResolvedBanner: WritableSignal<boolean> = signal(false);

  constructor() {
    effect(() => {
      // If the user had the banner showing and left the extension, when they come back the banner should still appear
      if (this.currentPendingTasks() === null) {
        this.showTasksResolvedBanner.set(false);
      } else if (
        this.atRiskPasswordStateSignal()?.showTasksCompleteBanner &&
        this.currentPendingTasks()?.length === 0 &&
        !this.atRiskPasswordStateSignal()?.hadPendingTasks
      ) {
        this.showTasksResolvedBanner.set(true);
      } else if (
        this.atRiskPasswordStateSignal()?.hadPendingTasks &&
        this.currentPendingTasks()?.length === 0
      ) {
        // If the user has resolved all tasks, we will show the banner
        const updateObject: AtRiskPasswordCalloutData = {
          hadPendingTasks: false,
          showTasksCompleteBanner: true,
          tasksBannerDismissed: false,
        };
        this.atRiskPasswordCalloutService.updateAtRiskPasswordState(
          this.userIdSignal()!,
          updateObject,
        );
        this.showTasksResolvedBanner.set(true);
      } else if (this.currentPendingTasks()?.length > 0) {
        // Will show callout, will remove any previous dismissed banner state
        const updateObject: AtRiskPasswordCalloutData = {
          hadPendingTasks: true,
          showTasksCompleteBanner: false,
          tasksBannerDismissed: false,
        };
        this.atRiskPasswordCalloutService.updateAtRiskPasswordState(
          this.userIdSignal()!,
          updateObject,
        );
      }
    });
  }

  successBannerDismissed() {
    // If the user dismisses the banner, we will update the state to reflect that
    const updateObject: AtRiskPasswordCalloutData = {
      hadPendingTasks: false,
      showTasksCompleteBanner: false,
      tasksBannerDismissed: true,
    };
    this.atRiskPasswordCalloutService.updateAtRiskPasswordState(this.userIdSignal()!, updateObject);
    this.showTasksResolvedBanner.set(false);
  }
}
