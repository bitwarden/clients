import { DIALOG_DATA } from "@angular/cdk/dialog";
import { Component, ChangeDetectionStrategy, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { CipherHealthView } from "@bitwarden/bit-common/dirt/access-intelligence/models/view/cipher-health.view";
import { RiskCategory } from "@bitwarden/bit-common/dirt/vault-health/models";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import {
  DialogModule,
  ButtonModule,
  DialogRef,
  ToastService,
  TypographyModule,
  AsyncActionsModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { HealthAdditionalRisksComponent } from "./health-additional-risks.component";

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
    HealthAdditionalRisksComponent,
    I18nPipe,
    AsyncActionsModule,
    TypographyModule,
  ],
})
export class HealthDeleteAtRiskItemDialogComponent {
  readonly accountService = inject(AccountService);
  readonly cipherService = inject(CipherService);
  readonly toastService = inject(ToastService);
  readonly i18nService = inject(I18nService);
  readonly dialogRef = inject(DialogRef);
  readonly inputData = inject<HealthDeleteAtRiskItemDialogData>(DIALOG_DATA);

  readonly item = this.inputData.item;
  readonly currentCategory = this.inputData.currentCategory;

  readonly onDeleteItem = async () => {
    const user = await firstValueFrom(this.accountService.activeAccount$);
    if (!user) {
      return;
    }

    // The soft delete sets deletedDate, which the report's scope filter excludes,
    // so the vault-change refresh takes the row out on its own.
    await this.cipherService.softDeleteWithServer(this.item.cipherId, user.id);

    this.toastService.showToast({
      message: this.i18nService.t("deletedItem"),
      variant: "success",
    });

    await this.dialogRef.close();
  };
}
