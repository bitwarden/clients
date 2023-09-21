import { Component } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherData } from "@bitwarden/common/vault/models/data/cipher.data";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { AttachmentView } from "@bitwarden/common/vault/models/view/attachment.view";
import { DialogService } from "@bitwarden/components";

import { AttachmentsComponent as BaseAttachmentsComponent } from "../individual-vault/attachments.component";

@Component({
  selector: "app-org-vault-attachments",
  templateUrl: "../individual-vault/attachments.component.html",
})
export class AttachmentsComponent extends BaseAttachmentsComponent {
  viewOnly = false;
  organization: Organization;

  constructor(
    cipherService: CipherService,
    i18nService: I18nService,
    cryptoService: CryptoService,
    stateService: StateService,
    platformUtilsService: PlatformUtilsService,
    apiService: ApiService,
    logService: LogService,
    fileDownloadService: FileDownloadService,
    dialogService: DialogService
  ) {
    super(
      cipherService,
      i18nService,
      cryptoService,
      stateService,
      platformUtilsService,
      apiService,
      logService,
      fileDownloadService,
      dialogService
    );
  }

  protected async reupload(attachment: AttachmentView) {
    if (this.organization.canEditAnyCollection && this.showFixOldAttachments(attachment)) {
      await super.reuploadCipherAttachment(attachment, true);
    }
  }

  protected async loadCipher() {
    if (!this.organization.canEditAnyCollection) {
      return await super.loadCipher();
    }
    const response = await this.apiService.getCipherAdmin(this.cipherId);
    return new Cipher(new CipherData(response));
  }

  protected saveCipherAttachment(file: File) {
    return this.cipherService.saveAttachmentWithServer(
      this.cipherDomain,
      file,
      this.organization.canEditAnyCollection
    );
  }

  protected deleteCipherAttachment(attachmentId: string) {
    if (!this.organization.canEditAnyCollection) {
      return super.deleteCipherAttachment(attachmentId);
    }
    return this.apiService.deleteCipherAttachmentAdmin(this.cipherId, attachmentId);
  }

  protected showFixOldAttachments(attachment: AttachmentView) {
    return attachment.key == null && this.organization.canEditAnyCollection;
  }
}
