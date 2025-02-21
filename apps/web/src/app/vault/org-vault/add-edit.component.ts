// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DatePipe } from "@angular/common";
import { Component } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";
import { CipherData } from "@bitwarden/common/vault/models/data/cipher.data";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CipherAuthorizationService } from "@bitwarden/common/vault/services/cipher-authorization.service";
import { DialogService, ToastService } from "@bitwarden/components";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/generator-legacy";
import { PasswordRepromptService } from "@bitwarden/vault";

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
    accountService: AccountService,
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
    dialogService: DialogService,
    datePipe: DatePipe,
    configService: ConfigService,
    billingAccountProfileStateService: BillingAccountProfileStateService,
    cipherAuthorizationService: CipherAuthorizationService,
    toastService: ToastService,
    sdkService: SdkService,
  ) {
    super(
      cipherService,
      folderService,
      i18nService,
      platformUtilsService,
      auditService,
      accountService,
      collectionService,
      totpService,
      passwordGenerationService,
      messagingService,
      eventCollectionService,
      policyService,
      organizationService,
      logService,
      passwordRepromptService,
      dialogService,
      datePipe,
      configService,
      billingAccountProfileStateService,
      cipherAuthorizationService,
      toastService,
      sdkService,
    );
  }

  protected loadCollections() {
    if (!this.organization.canEditAllCiphers) {
      return super.loadCollections();
    }
    return Promise.resolve(this.collections);
  }

  protected async loadCipher() {
    this.isAdminConsoleAction = true;
    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    // Calling loadCipher first to assess if the cipher is unassigned. If null use apiService getCipherAdmin
    const firstCipherCheck = await super.loadCipher(activeUserId);

    if (!this.organization.canEditAllCiphers && firstCipherCheck != null) {
      return firstCipherCheck;
    }
    const response = await this.apiService.getCipherAdmin(this.cipherId);
    const data = new CipherData(response);

    data.edit = true;
    const cipher = new Cipher(data);
    this.originalCipher = cipher;
    return cipher;
  }

  protected encryptCipher(userId: UserId) {
    if (!this.organization.canEditAllCiphers) {
      return super.encryptCipher(userId);
    }

    return this.cipherService.encrypt(this.cipher, userId, null, null, this.originalCipher);
  }

  protected async deleteCipher() {
    if (!this.organization.canEditAllCiphers) {
      const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      return super.deleteCipher(activeUserId);
    }
    return this.cipher.isDeleted
      ? this.apiService.deleteCipherAdmin(this.cipherId)
      : this.apiService.putDeleteCipherAdmin(this.cipherId);
  }
}
