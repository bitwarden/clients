import { ChangeDetectionStrategy, Component, inject, viewChild } from "@angular/core";

import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  ButtonModule,
  DIALOG_DATA,
  DialogModule,
  DialogRef,
  DialogService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { ShareItemFormComponent } from "@bitwarden/vault";

export interface ShareItemDesktopDialogData {
  cipher: CipherView;
}

@Component({
  selector: "app-share-item-desktop",
  templateUrl: "share-item-desktop.component.html",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogModule, ButtonModule, I18nPipe, ShareItemFormComponent],
})
export class ShareItemDesktopComponent {
  private readonly dialogRef = inject(DialogRef);
  protected readonly data: ShareItemDesktopDialogData = inject(DIALOG_DATA);
  protected readonly shareItemForm = viewChild.required(ShareItemFormComponent);

  protected async createAndCopyLink(): Promise<void> {
    await this.shareItemForm().createAndCopyLink();
  }

  protected async close(): Promise<void> {
    await this.dialogRef.close();
  }

  static open(dialogService: DialogService, cipher: CipherView) {
    return dialogService.open(ShareItemDesktopComponent, {
      data: { cipher },
    });
  }
}
