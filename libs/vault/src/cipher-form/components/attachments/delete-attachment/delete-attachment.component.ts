import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, Output } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { AttachmentView } from "@bitwarden/common/vault/models/view/attachment.view";
import {
  AsyncActionsModule,
  ButtonModule,
  DialogService,
  IconButtonModule,
  ToastService,
} from "@bitwarden/components";

@Component({
  standalone: true,
  selector: "app-delete-attachment",
  templateUrl: "./delete-attachment.component.html",
  imports: [AsyncActionsModule, CommonModule, JslibModule, ButtonModule, IconButtonModule],
})
export class DeleteAttachmentComponent {
  /** Id of the cipher associated with the attachment */
  @Input({ required: true }) cipherId!: string;

  /** The attachment that is can be deleted */
  @Input({ required: true }) attachment!: AttachmentView;

  /** Emits when the attachment is successfully deleted */
  @Output() onDeletionSuccess = new EventEmitter<void>();

  constructor(
    private toastService: ToastService,
    private i18nService: I18nService,
    private cipherService: CipherService,
    private logService: LogService,
    private dialogService: DialogService,
    private accountService: AccountService,
  ) {}

  delete = async () => {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "deleteAttachment" },
      content: { key: "permanentlyDeleteAttachmentConfirmation" },
      type: "warning",
    });

    if (!confirmed) {
      return;
    }

    try {
      const activeUserId = await firstValueFrom(
        this.accountService.activeAccount$.pipe(getOptionalUserId),
      );

      if (activeUserId == null) {
        throw new Error("An active user is expected while deleting an attachment.");
      }

      await this.cipherService.deleteAttachmentWithServer(
        this.cipherId,
        this.attachment.id,
        activeUserId,
      );

      this.toastService.showToast({
        variant: "success",
        title: "",
        message: this.i18nService.t("deletedAttachment"),
      });

      this.onDeletionSuccess.emit();
    } catch (e) {
      this.logService.error(e);
    }
  };
}
