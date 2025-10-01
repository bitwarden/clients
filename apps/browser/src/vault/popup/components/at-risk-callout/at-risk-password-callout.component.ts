import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom, switchMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { CalloutModule, BannerModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { AtRiskPasswordCalloutData, AtRiskPasswordCalloutService } from "@bitwarden/vault";

@Component({
  selector: "vault-at-risk-password-callout",
  imports: [CommonModule, CalloutModule, I18nPipe, BannerModule, JslibModule],
  providers: [AtRiskPasswordCalloutService],
  templateUrl: "./at-risk-password-callout.component.html",
})
export class AtRiskPasswordCalloutComponent {
  private activeAccount$ = inject(AccountService).activeAccount$.pipe(getUserId);
  private atRiskPasswordCalloutService = inject(AtRiskPasswordCalloutService);
  private router = inject(Router);

  showTasksBanner$ = this.activeAccount$.pipe(
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

  async navigateToAtRiskPasswords() {
    await this.router.navigate(["/at-risk-passwords"]);
  }
}
