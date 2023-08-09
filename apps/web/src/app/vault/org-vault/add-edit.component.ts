import { Component } from "@angular/core";

import { DialogServiceAbstraction } from "@bitwarden/angular/services/dialog";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { TotpService } from "@bitwarden/common/abstractions/totp.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/common/tools/generator/password";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CollectionService } from "@bitwarden/common/vault/abstractions/collection.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { PasswordRepromptService } from "@bitwarden/common/vault/abstractions/password-reprompt.service";
import { CipherData } from "@bitwarden/common/vault/models/data/cipher.data";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";

import { AddEditComponent as BaseAddEditComponent } from "../individual-vault/add-edit.component";

@Component({
  selector: "app-org-vault-add-edit",
  templateUrl: "../individual-vault/add-edit.component.html",
})
export class AddEditComponent extends BaseAddEditComponent {
  originalCipher: Cipher = null;
  protected override componentName = "app-org-vault-add-edit";

  constructor(
    cipherService: CipherService,
    folderService: FolderService,
    i18nService: I18nService,
    platformUtilsService: PlatformUtilsService,
    auditService: AuditService,
    stateService: StateService,
    collectionService: CollectionService,
    totpService: TotpService,
    passwordGenerationService: PasswordGenerationServiceAbstraction,
    private apiService: ApiService,
    messagingService: MessagingService,
    eventCollectionService: EventCollectionService,
    policyService: PolicyService,
    logService: LogService,
    passwordRepromptService: PasswordRepromptService,
    organizationService: OrganizationService,
    sendApiService: SendApiService,
    dialogService: DialogServiceAbstraction
  ) {
    super(
      cipherService,
      folderService,
      i18nService,
      platformUtilsService,
      auditService,
      stateService,
      collectionService,
      totpService,
      passwordGenerationService,
      messagingService,
      eventCollectionService,
      policyService,
      organizationService,
      logService,
      passwordRepromptService,
      sendApiService,
      dialogService
    );
  }

  protected allowOwnershipAssignment() {
    if (
      this.ownershipOptions != null &&
      (this.ownershipOptions.length > 1 || !this.allowPersonal)
    ) {
      if (this.organization != null) {
        return this.cloneMode && this.organization.canEditAnyCollection;
      } else {
        return !this.editMode || this.cloneMode;
      }
    }
    return false;
  }

  protected loadCollections() {
    if (!this.organization.canEditAnyCollection) {
      return super.loadCollections();
    }
    return Promise.resolve(this.collections);
  }

  protected async loadCipher() {
    if (!this.organization.canEditAnyCollection) {
      return await super.loadCipher();
    }
    const response = await this.apiService.getCipherAdmin(this.cipherId);
    const data = new CipherData(response);

    data.edit = true;
    const cipher = new Cipher(data);
    this.originalCipher = cipher;
    return cipher;
  }

  protected encryptCipher() {
    if (!this.organization.canEditAnyCollection) {
      return super.encryptCipher();
    }
    return this.cipherService.encrypt(this.cipher, null, this.originalCipher);
  }

  protected async deleteCipher() {
    if (!this.organization.canEditAnyCollection) {
      return super.deleteCipher();
    }
    return this.cipher.isDeleted
      ? this.apiService.deleteCipherAdmin(this.cipherId)
      : this.apiService.putDeleteCipherAdmin(this.cipherId);
  }
}
