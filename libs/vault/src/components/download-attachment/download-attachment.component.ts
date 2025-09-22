// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { DECRYPT_ERROR } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { StateProvider } from "@bitwarden/common/platform/state";
import { CipherId, EmergencyAccessId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { AttachmentView } from "@bitwarden/common/vault/models/view/attachment.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { AsyncActionsModule, IconButtonModule, ToastService } from "@bitwarden/components";

@Component({
  selector: "app-download-attachment",
  templateUrl: "./download-attachment.component.html",
  imports: [AsyncActionsModule, CommonModule, JslibModule, IconButtonModule],
})
export class DownloadAttachmentComponent {
  /** Attachment to download */
  @Input({ required: true }) attachment: AttachmentView;

  /** The cipher associated with the attachment */
  @Input({ required: true }) cipher: CipherView;

  // When in view mode, we will want to check for the master password reprompt
  @Input() checkPwReprompt?: boolean = false;

  // Required for fetching attachment data when viewed from cipher via emergency access
  @Input() emergencyAccessId?: EmergencyAccessId;

  /** When owners/admins can mange all items and when accessing from the admin console, use the admin endpoint */
  @Input() admin?: boolean = false;

  constructor(
    private i18nService: I18nService,
    private apiService: ApiService,
    private fileDownloadService: FileDownloadService,
    private toastService: ToastService,
    private stateProvider: StateProvider,
    private cipherService: CipherService,
  ) {}

  protected get isDecryptionFailure(): boolean {
    return this.attachment.fileName === DECRYPT_ERROR;
  }

  /** Download the attachment */
  download = async () => {
    let url: string;

    try {
      const attachmentDownloadResponse = this.admin
        ? await this.apiService.getAttachmentDataAdmin(this.cipher.id, this.attachment.id)
        : await this.apiService.getAttachmentData(
            this.cipher.id,
            this.attachment.id,
            this.emergencyAccessId,
          );
      url = attachmentDownloadResponse.url;
    } catch (e) {
      if (e instanceof ErrorResponse && (e as ErrorResponse).statusCode === 404) {
        url = this.attachment.url;
      } else if (e instanceof ErrorResponse) {
        throw new Error((e as ErrorResponse).getSingleMessage());
      } else {
        throw e;
      }
    }

    const response = await fetch(new Request(url, { cache: "no-store" }));
    if (response.status !== 200) {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("errorOccurred"),
      });
      return;
    }

    try {
      const userId = await firstValueFrom(this.stateProvider.activeUserId$);

      const decBuf = await this.cipherService.getDecryptedAttachmentBuffer(
        this.cipher.id as CipherId,
        this.attachment,
        response,
        userId,
        // When the emergency access ID is present, the cipher is being viewed via emergency access.
        // Force legacy decryption in these cases.
        this.emergencyAccessId ? true : false,
      );

      this.fileDownloadService.download({
        fileName: this.attachment.fileName,
        blobData: decBuf,
      });
      // FIXME: Remove when updating file. Eslint update
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("errorOccurred"),
      });
    }
  };
}
