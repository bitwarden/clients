import { DIALOG_DATA } from "@angular/cdk/dialog";
import { Component, ChangeDetectionStrategy, input, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import type { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  DialogModule,
  ButtonModule,
  DialogRef,
  ToastService,
  SectionComponent,
  SectionHeaderComponent,
  IconTileComponent,
  CardComponent,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

export interface HealthDeleteAtRiskItemDialogData {
  item: CipherView;
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
  ],
})
export class HealthDeleteAtRiskItemDialogComponent {
  readonly accountService = inject(AccountService);
  readonly cipherService = inject(CipherService);
  readonly toastService = inject(ToastService);
  readonly i18nService = inject(I18nService);
  readonly dialogRef = inject(DialogRef);
  readonly inputData = inject<HealthDeleteAtRiskItemDialogData>(DIALOG_DATA);

  readonly item = input<CipherView>(this.inputData.item);

  readonly onDeleteItem = async () => {
    const user = await firstValueFrom(this.accountService.activeAccount$);
    if (!user) {
      return;
    }

    await this.cipherService.softDeleteWithServer(this.item().id, user.id);

    this.toastService.showToast({
      message: this.i18nService.t("deletedItem"),
      variant: "success",
    });

    await this.dialogRef.close();
  };
}
