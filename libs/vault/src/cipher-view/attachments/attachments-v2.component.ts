import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { NEVER, switchMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { EncryptService } from "@bitwarden/common/platform/abstractions/encrypt.service";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { EncArrayBuffer } from "@bitwarden/common/platform/models/domain/enc-array-buffer";
import { StateProvider } from "@bitwarden/common/platform/state";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  ToastService,
  ItemModule,
  IconButtonModule,
  SectionComponent,
  SectionHeaderComponent,
} from "@bitwarden/components";
import { PasswordRepromptService } from "@bitwarden/vault";

@Component({
  selector: "app-attachments-v2",
  templateUrl: "attachments-v2.component.html",
  standalone: true,
  imports: [
    CommonModule,
    JslibModule,
    ItemModule,
    IconButtonModule,
    SectionComponent,
    SectionHeaderComponent,
  ],
})
export class AttachmentsV2Component {
  @Input() cipher: CipherView;

  canAccessPremium: boolean;
  orgKey: OrgKey;
  private passwordReprompted = false;

  constructor(
    private passwordRepromptService: PasswordRepromptService,
    private i18nService: I18nService,
    private apiService: ApiService,
    private fileDownloadService: FileDownloadService,
    private cryptoService: CryptoService,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
    private toastService: ToastService,
    private stateProvider: StateProvider,
    private encryptService: EncryptService,
  ) {
    this.subscribeToHasPremiumCheck();
    this.subscribeToOrgKey();
  }

  subscribeToHasPremiumCheck() {
    this.billingAccountProfileStateService.hasPremiumFromAnySource$
      .pipe(takeUntilDestroyed())
      .subscribe((data) => {
        this.canAccessPremium = data;
      });
  }

  subscribeToOrgKey() {
    this.stateProvider.activeUserId$
      .pipe(
        switchMap((userId) => (userId != null ? this.cryptoService.orgKeys$(userId) : NEVER)),
        takeUntilDestroyed(),
      )
      .subscribe((data: Record<OrganizationId, OrgKey> | null) => {
        if (data) {
          this.orgKey = data[this.cipher.organizationId as OrganizationId];
        }
      });
  }

  async downloadAttachment(attachment: any) {
    this.passwordReprompted = await this.passwordRepromptService.promptPasswordCheck(
      this.cipher,
      this.passwordReprompted,
    );
    if (!this.passwordReprompted) {
      return;
    }
    const file = attachment as any;

    if (file.downloading) {
      return;
    }

    if (this.cipher.organizationId == null && !this.canAccessPremium) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("premiumRequired"),
        message: this.i18nService.t("premiumRequiredDesc"),
      });
      return;
    }

    let url: string;
    try {
      const attachmentDownloadResponse = await this.apiService.getAttachmentData(
        this.cipher.id,
        attachment.id,
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

    file.downloading = true;
    const response = await fetch(new Request(url, { cache: "no-store" }));
    if (response.status !== 200) {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("errorOccurred"),
      });
      file.downloading = false;
      return;
    }

    try {
      const encBuf = await EncArrayBuffer.fromResponse(response);
      const key = attachment.key != null ? attachment.key : this.orgKey;
      const decBuf = await this.encryptService.decryptToBytes(encBuf, key);
      this.fileDownloadService.download({
        fileName: attachment.fileName,
        blobData: decBuf,
      });
    } catch (e) {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("errorOccurred"),
      });
    }

    file.downloading = false;
  }
}
