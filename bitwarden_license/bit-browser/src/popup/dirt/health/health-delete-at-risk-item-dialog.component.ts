import { DIALOG_DATA } from "@angular/cdk/dialog";
import { Component, ChangeDetectionStrategy, input, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import type { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogModule, ButtonModule, DialogRef, ToastService } from "@bitwarden/components";

export interface HealthDeleteAtRiskItemDialogData {
  item: CipherView;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "health-delete-at-risk-item-dialog",
  templateUrl: "./health-delete-at-risk-item-dialog.component.html",
  imports: [DialogModule, ButtonModule],
})
export class HealthDeleteAtRiskItemDialogComponent {
  readonly accountService = inject(AccountService);
  readonly cipherService = inject(CipherService);
  readonly toastService = inject(ToastService);
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
      message: "Item deleted",
      variant: "success",
    });

    await this.dialogRef.close();
  };
}
