import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import { RouterModule } from "@angular/router";
import { firstValueFrom, switchMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { AnchorLinkDirective, CalloutModule, BannerModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { AtRiskPasswordCalloutData, AtRiskPasswordCalloutService } from "@bitwarden/vault";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "vault-at-risk-password-callout",
  imports: [
    AnchorLinkDirective,
    CommonModule,
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

  showCompletedTasksBanner$ = this.activeAccount$.pipe(
    switchMap((userId) => this.atRiskPasswordCalloutService.showCompletedTasksBanner$(userId)),
  );

  currentPendingTasks$ = this.activeAccount$.pipe(
    switchMap((userId) => this.atRiskPasswordCalloutService.pendingTasks$(userId)),
  );

  async successBannerDismissed() {
    const updateObject: AtRiskPasswordCalloutData = {
      hasInteractedWithTasks: true,
      tasksBannerDismissed: true,
    };
    const userId = await firstValueFrom(this.activeAccount$);
    this.atRiskPasswordCalloutService.updateAtRiskPasswordState(userId, updateObject);
  }
}
