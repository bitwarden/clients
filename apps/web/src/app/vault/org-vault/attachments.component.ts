// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherData } from "@bitwarden/common/vault/models/data/cipher.data";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { AttachmentView } from "@bitwarden/common/vault/models/view/attachment.view";
import { DialogService, ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

import { AttachmentsComponent as BaseAttachmentsComponent } from "../individual-vault/attachments.component";

@Component({
  selector: "app-org-vault-attachments",
  templateUrl: "../individual-vault/attachments.component.html",
})
export class AttachmentsComponent extends BaseAttachmentsComponent implements OnInit {
  viewOnly = false;
  organization: Organization;

  constructor(
    cipherService: CipherService,
    i18nService: I18nService,
    keyService: KeyService,
    encryptService: EncryptService,
    stateService: StateService,
    platformUtilsService: PlatformUtilsService,
    apiService: ApiService,
    logService: LogService,
    fileDownloadService: FileDownloadService,
    dialogService: DialogService,
    billingAccountProfileStateService: BillingAccountProfileStateService,
    accountService: AccountService,
    toastService: ToastService,
  ) {
    super(
      cipherService,
      i18nService,
      keyService,
      encryptService,
      stateService,
      platformUtilsService,
      apiService,
      logService,
      fileDownloadService,
      dialogService,
      billingAccountProfileStateService,
      accountService,
      toastService,
    );
  }

  async ngOnInit() {
    await super.ngOnInit();
  }

  protected async reupload(attachment: AttachmentView) {
    if (this.organization.canEditAllCiphers && this.showFixOldAttachments(attachment)) {
      await super.reuploadCipherAttachment(attachment, true);
    }
  }

  protected async loadCipher() {
    if (!this.organization.canEditAllCiphers) {
      const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      return await super.loadCipher(activeUserId);
    }
    const response = await this.apiService.getCipherAdmin(this.cipherId);
    return new Cipher(new CipherData(response));
  }

  protected saveCipherAttachment(file: File, userId: UserId) {
    return this.cipherService.saveAttachmentWithServer(
      this.cipherDomain,
      file,
      userId,
      this.organization.canEditAllCiphers,
    );
  }

  protected deleteCipherAttachment(attachmentId: string, userId: UserId) {
    if (!this.organization.canEditAllCiphers) {
      return super.deleteCipherAttachment(attachmentId, userId);
    }
    return this.apiService.deleteCipherAttachmentAdmin(this.cipherId, attachmentId);
  }

  protected showFixOldAttachments(attachment: AttachmentView) {
    return attachment.key == null && this.organization.canEditAllCiphers;
  }
}
