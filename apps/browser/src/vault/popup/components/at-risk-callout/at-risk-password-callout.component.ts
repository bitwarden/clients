import { CommonModule } from "@angular/common";
import { Component, inject, effect, signal, Signal, WritableSignal, computed } from "@angular/core";
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
      initialValue: [],
    },
  );

  dismissedClicked: WritableSignal<boolean> = signal(false);

  showTasksResolvedBanner = computed(() => {
    if (this.dismissedClicked()) {
      return false;
    }

    if (
      (this.atRiskPasswordStateSignal()?.showTasksCompleteBanner &&
        this.currentPendingTasks()?.length === 0 &&
        !this.atRiskPasswordStateSignal()?.hadPendingTasks) ||
      (this.atRiskPasswordStateSignal()?.hadPendingTasks &&
        this.currentPendingTasks()?.length === 0)
    ) {
      return true;
    } else {
      return false;
    }
  });

  constructor() {
    effect(() => {
      // If the user has resolved all tasks, we will show the banner
      if (
        this.atRiskPasswordStateSignal()?.hadPendingTasks &&
        this.currentPendingTasks()?.length === 0
      ) {
        const updateObject: AtRiskPasswordCalloutData = {
          hadPendingTasks: false,
          showTasksCompleteBanner: true,
          tasksBannerDismissed: false,
        };
        this.atRiskPasswordCalloutService.updateAtRiskPasswordState(
          this.userIdSignal()!,
          updateObject,
        );
      }

      // Will show callout, will remove any previous dismissed banner state
      if (this.currentPendingTasks()?.length > 0) {
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

    this.dismissedClicked.set(true);
  }
}
