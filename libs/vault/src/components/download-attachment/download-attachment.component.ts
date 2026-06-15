import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { StateProvider } from "@bitwarden/common/platform/state";
import { CipherId, EmergencyAccessId, UserId } from "@bitwarden/common/types/guid";
import { CipherSdkService } from "@bitwarden/common/vault/abstractions/cipher-sdk.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { AttachmentView } from "@bitwarden/common/vault/models/view/attachment.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { AsyncActionsModule, IconButtonModule, ToastService } from "@bitwarden/components";
import {
  isCipherAdminGetAttachmentDownloadUrlError,
  isCipherGetAttachmentDownloadUrlError,
} from "@bitwarden/sdk-internal";

type DownloadOptions = { asAdmin?: boolean; emergencyAccessId?: EmergencyAccessId };

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
    private readonly i18nService: I18nService,
    private readonly apiService: ApiService,
    private readonly fileDownloadService: FileDownloadService,
    private readonly toastService: ToastService,
    private readonly stateProvider: StateProvider,
    private readonly cipherService: CipherService,
    private readonly configService: ConfigService,
    private readonly cipherSdkService: CipherSdkService,
  ) {}

  protected readonly isDecryptionFailure = computed(() => this.attachment().hasDecryptionError);

  /** Download the attachment */
  readonly download = async () => {
    const attachment = this.attachment();
    const cipher = this.cipher();

    if (!attachment.id || !attachment.fileName) {
      this.showErrorToast();
      return;
    }

    const userId = await firstValueFrom(this.stateProvider.activeUserId$);
    if (!userId) {
      this.showErrorToast();
      return;
    }

    const url = await this.fetchUrl(cipher.id, attachment, userId);
    if (!url) {
      this.showErrorToast();
      return;
    }

    const response = await fetch(new Request(url, { cache: "no-store" }));
    if (response.status !== 200) {
      this.showErrorToast();
      return;
    }

    try {
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
      this.showErrorToast();
    }
  };

  private async fetchUrl(
    cipherId: string,
    attachment: AttachmentView,
    userId: UserId,
  ): Promise<string | undefined> {
    const useSdk = await firstValueFrom(
      this.configService.getFeatureFlag$(FeatureFlag.PM28192_CipherAttachmentOpsToSdk),
    );

    if (!attachment.id) {
      return undefined;
    }

    try {
      if (useSdk) {
        return await this.cipherSdkService.getAttachmentDownloadUrl(
          cipherId as CipherId,
          attachment.id,
          userId,
          this.downloadOptions(),
        );
      }

      const response = this.admin()
        ? await this.apiService.getAttachmentDataAdmin(cipherId, attachment.id)
        : await this.apiService.getAttachmentData(
            cipherId,
            attachment.id,
            this.emergencyAccessId(),
          );
      return response.url;
    } catch (e) {
      if (e instanceof ErrorResponse && e.statusCode === 404) {
        return attachment.url;
      }
      if (
        useSdk &&
        (isCipherAdminGetAttachmentDownloadUrlError(e) ||
          isCipherGetAttachmentDownloadUrlError(e)) &&
        e.variant === "NotFound"
      ) {
        return attachment.url;
      }
      if (e instanceof ErrorResponse) {
        throw new Error(e.getSingleMessage());
      }
      throw e;
    }
  }

  private downloadOptions(): DownloadOptions | undefined {
    if (this.admin()) {
      return { asAdmin: true };
    }
    const eaId = this.emergencyAccessId();
    if (eaId) {
      return { emergencyAccessId: eaId };
    }
    return undefined;
  }

  private showErrorToast() {
    this.toastService.showToast({
      variant: "error",
      message: this.i18nService.t("errorOccurred"),
    });
  }
}
