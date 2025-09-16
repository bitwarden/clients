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
import { AtRiskPasswordCalloutData, AtRiskPasswordCalloutService } from "@bitwarden/vault";

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

  showTasksCompleteBanner = toSignal(
    this.atRiskPasswordCalloutService.shouldShowCompletionBanner$(this.userIdSignal()!),
    { initialValue: false },
  );

  currentPendingTasks: Signal<SecurityTask[] | null> = toSignal(
    this.atRiskPasswordCalloutService.pendingTasks$(this.userIdSignal()!),
    {
      initialValue: [],
    },
  );

  dismissedClicked: WritableSignal<boolean> = signal(false);

  constructor() {
    effect(() => {
      const pendingTasksLength = this.currentPendingTasks()?.length ?? 0;

      this.atRiskPasswordCalloutService.updatePendingTasksState(
        this.userIdSignal()!,
        pendingTasksLength,
      );
    });
  }

  successBannerDismissed() {
    const updateObject: AtRiskPasswordCalloutData = {
      hadPendingTasks: false,
      showTasksCompleteBanner: false,
      tasksBannerDismissed: true,
    };
    this.atRiskPasswordCalloutService.updateAtRiskPasswordState(this.userIdSignal()!, updateObject);
    this.dismissedClicked.set(true);
  }
}
