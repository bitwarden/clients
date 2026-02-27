// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import { SendAccessToken } from "@bitwarden/common/auth/send-access";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { EncArrayBuffer } from "@bitwarden/common/platform/models/domain/enc-array-buffer";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { SendAccessRequest } from "@bitwarden/common/tools/send/models/request/send-access.request";
import { SendAccessView } from "@bitwarden/common/tools/send/models/view/send-access.view";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { ToastService } from "@bitwarden/components";

import { SharedModule } from "../../../shared";

@Component({
  selector: "app-send-access-file",
  templateUrl: "send-access-file.component.html",
  imports: [SharedModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SendAccessFileComponent {
  readonly send = input<SendAccessView | null>(null);
  readonly decKey = input<SymmetricCryptoKey | null>(null);
  readonly accessRequest = input<SendAccessRequest | null>(null);
  readonly accessToken = input<SendAccessToken | null>(null);

  constructor(
    private i18nService: I18nService,
    private toastService: ToastService,
    private encryptService: EncryptService,
    private fileDownloadService: FileDownloadService,
    private sendApiService: SendApiService,
    private configService: ConfigService,
  ) {}

  protected download = async () => {
    const sendEmailOtp = await this.configService.getFeatureFlag(FeatureFlag.SendEmailOTP);
    const accessToken = this.accessToken();
    const accessRequest = this.accessRequest();
    const authMissing = (sendEmailOtp && !accessToken) || (!sendEmailOtp && !accessRequest);
    if (this.send() == null || this.decKey() == null || authMissing) {
      return;
    }

    const downloadData = sendEmailOtp
      ? await this.sendApiService.getSendFileDownloadDataV2(this.send(), accessToken)
      : await this.sendApiService.getSendFileDownloadData(this.send(), accessRequest);

    if (Utils.isNullOrWhitespace(downloadData.url)) {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("missingSendFile"),
      });
      return;
    }

    const response = await fetch(new Request(downloadData.url, { cache: "no-store" }));
    if (response.status !== 200) {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("errorOccurred"),
      });
      return;
    }

    try {
      const encBuf = await EncArrayBuffer.fromResponse(response);
      const decBuf = await this.encryptService.decryptFileData(encBuf, this.decKey());
      this.fileDownloadService.download({
        fileName: this.send().file.fileName,
        blobData: decBuf as BlobPart,
        downloadMethod: "save",
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
