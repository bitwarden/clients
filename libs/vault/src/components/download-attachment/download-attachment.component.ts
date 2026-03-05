import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
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
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DownloadAttachmentComponent {
  /** Attachment to download */
  readonly attachment = input.required<AttachmentView>();

  /** The cipher associated with the attachment */
  readonly cipher = input.required<CipherView>();

  /** When in view mode, we will want to check for the master password reprompt */
  readonly checkPwReprompt = input<boolean>(false);

  /** Required for fetching attachment data when viewed from cipher via emergency access */
  readonly emergencyAccessId = input<EmergencyAccessId>();

  /** When owners/admins can manage all items and when accessing from the admin console, use the admin endpoint */
  readonly admin = input<boolean>(false);

  constructor(
    private i18nService: I18nService,
    private apiService: ApiService,
    private fileDownloadService: FileDownloadService,
    private toastService: ToastService,
    private stateProvider: StateProvider,
    private cipherService: CipherService,
  ) {}

  protected readonly isDecryptionFailure = computed(() => this.attachment().hasDecryptionError);

  /** Download the attachment */
  download = async () => {
    const attachment = this.attachment();
    const cipher = this.cipher();
    let url: string | undefined;

    if (!attachment.id) {
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("errorOccurred"),
      });
      return;
    }

    try {
      const attachmentDownloadResponse = this.admin()
        ? await this.apiService.getAttachmentDataAdmin(cipher.id, attachment.id)
        : await this.apiService.getAttachmentData(
            cipher.id,
            attachment.id,
            this.emergencyAccessId(),
          );
      url = attachmentDownloadResponse.url;
    } catch (e) {
      if (e instanceof ErrorResponse && (e as ErrorResponse).statusCode === 404) {
        url = attachment.url;
      } else if (e instanceof ErrorResponse) {
        throw new Error((e as ErrorResponse).getSingleMessage());
      } else {
        throw e;
      }
    }

    if (!url) {
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("errorOccurred"),
      });
      return;
    }

    const response = await fetch(new Request(url, { cache: "no-store" }));
    if (response.status !== 200) {
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("errorOccurred"),
      });
      return;
    }

    try {
      const userId = await firstValueFrom(this.stateProvider.activeUserId$);

      if (!userId || !attachment.fileName) {
        this.toastService.showToast({
          variant: "error",
          message: this.i18nService.t("errorOccurred"),
        });
        return;
      }

      const decBuf = await this.cipherService.getDecryptedAttachmentBuffer(
        cipher.id as CipherId,
        attachment,
        response,
        userId,
        // When the emergency access ID is present, the cipher is being viewed via emergency access.
        // Force legacy decryption in these cases.
        Boolean(this.emergencyAccessId()),
      );

      this.fileDownloadService.download({
        fileName: attachment.fileName,
        blobData: decBuf as BlobPart,
      });
    } catch {
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("errorOccurred"),
      });
    }
  };
}
