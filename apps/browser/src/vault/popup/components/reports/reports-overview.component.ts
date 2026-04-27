import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { RouterModule } from "@angular/router";
import { switchMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { filterOutNullish } from "@bitwarden/common/vault/utils/observable-utilities";
import { ButtonModule, IconTileComponent, TypographyModule } from "@bitwarden/components";

import { CurrentAccountComponent } from "../../../../auth/popup/account-switching/current-account.component";
import { PopOutComponent } from "../../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../../platform/popup/layout/popup-page.component";
import { PersonalVaultAlertService } from "../../services/personal-vault-alert.service";

@Component({
  selector: "app-reports-overview",
  templateUrl: "./reports-overview.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    JslibModule,
    RouterModule,
    PopupPageComponent,
    PopupHeaderComponent,
    PopOutComponent,
    CurrentAccountComponent,
    ButtonModule,
    IconTileComponent,
    TypographyModule,
  ],
})
export class ReportsOverviewComponent {
  private readonly accountService = inject(AccountService);
  private readonly billingService = inject(BillingAccountProfileStateService);
  private readonly alertService = inject(PersonalVaultAlertService);

  protected readonly isScanning$ = this.alertService.isScanning$;
  protected readonly summary$ = this.alertService.summary$;
  protected readonly totalCount$ = this.alertService.totalCount$;

  protected readonly isPremium$ = this.accountService.activeAccount$.pipe(
    getUserId,
    filterOutNullish(),
    switchMap((userId) => this.billingService.hasPremiumPersonally$(userId)),
  );

  rescan(): void {
    this.alertService.rescan();
  }
}
