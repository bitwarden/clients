import { DIALOG_DATA } from "@angular/cdk/dialog";
import { Component, ChangeDetectionStrategy, inject, computed } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { CipherHealthView } from "@bitwarden/bit-common/dirt/access-intelligence/models/view/cipher-health.view";
import { RiskCategory } from "@bitwarden/bit-common/dirt/vault-health/models";
import { VaultHealthReportService } from "@bitwarden/bit-common/dirt/vault-health/services";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import {
  DialogModule,
  ButtonModule,
  DialogRef,
  ToastService,
  SectionComponent,
  SectionHeaderComponent,
  IconTileComponent,
  CardComponent,
  TypographyModule,
  AsyncActionsModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

export interface HealthDeleteAtRiskItemDialogData {
  currentCategory: RiskCategory;
  item: CipherHealthView;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "health-delete-at-risk-item-dialog",
  templateUrl: "./health-delete-at-risk-item-dialog.component.html",
  imports: [
    DialogModule,
    ButtonModule,
    SectionComponent,
    SectionHeaderComponent,
    IconTileComponent,
    CardComponent,
    I18nPipe,
    AsyncActionsModule,
    TypographyModule,
  ],
})
export class HealthDeleteAtRiskItemDialogComponent {
  readonly accountService = inject(AccountService);
  readonly cipherService = inject(CipherService);
  readonly vaultHealthReportService = inject(VaultHealthReportService);
  readonly toastService = inject(ToastService);
  readonly i18nService = inject(I18nService);
  readonly dialogRef = inject(DialogRef);
  readonly inputData = inject<HealthDeleteAtRiskItemDialogData>(DIALOG_DATA);

  readonly item = this.inputData.item;
  readonly currentCategory = this.inputData.currentCategory;

  readonly additionalRisks = computed<{ showWeak: boolean; showReused: boolean }>(() => {
    // only show additional risk categories when the item currently being viewed also falls into lower risk categories. respects the at-risk hierarchy: exposed > weak > reused (implemented in DefaultVaultHealthReportService.highestRiskCategory)
    switch (this.currentCategory) {
      case RiskCategory.Exposed:
        return { showWeak: this.item.hasWeakPassword, showReused: this.item.hasReusedPassword };
      case RiskCategory.Weak:
        return { showWeak: false, showReused: this.item.hasReusedPassword };
      case RiskCategory.Reused:
      default:
        return { showWeak: false, showReused: false };
    }
  });

  readonly onDeleteItem = async () => {
    const user = await firstValueFrom(this.accountService.activeAccount$);
    if (!user) {
      return;
    }

    await this.cipherService.softDeleteWithServer(this.item.cipherId, user.id);

    // update the health report to remove item from current category
    this.vaultHealthReportService.deleteItemFromReport(
      this.item.cipherId,
      this.currentCategory,
      user.id,
    );

    this.toastService.showToast({
      message: this.i18nService.t("deletedItem"),
      variant: "success",
    });

    await this.dialogRef.close();
  };
}
