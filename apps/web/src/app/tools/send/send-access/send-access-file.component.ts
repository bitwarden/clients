// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Input } from "@angular/core";

import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
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
})
export class SendAccessFileComponent {
  @Input() send: SendAccessView;
  @Input() decKey: SymmetricCryptoKey;
  @Input() accessRequest: SendAccessRequest;
  constructor(
    private i18nService: I18nService,
    private toastService: ToastService,
    private encryptService: EncryptService,
    private fileDownloadService: FileDownloadService,
    private sendApiService: SendApiService,
  ) {}

  protected download = async () => {
    if (this.send == null || this.decKey == null) {
      return;
    }

    const downloadData = await this.sendApiService.getSendFileDownloadData(
      this.send,
      this.accessRequest,
    );

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
      const decBuf = await this.encryptService.decryptFileData(encBuf, this.decKey);
      this.fileDownloadService.download({
        fileName: this.send.file.fileName,
        blobData: decBuf,
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
