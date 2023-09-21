import { Component, OnDestroy, OnInit } from "@angular/core";

import { AddEditComponent as BaseAddEditComponent } from "@bitwarden/angular/vault/components/add-edit.component";
import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { TotpService } from "@bitwarden/common/abstractions/totp.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { EventType, ProductType } from "@bitwarden/common/enums";
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
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { DialogService } from "@bitwarden/components";

@Component({
  selector: "app-vault-add-edit",
  templateUrl: "add-edit.component.html",
})
export class AddEditComponent extends BaseAddEditComponent implements OnInit, OnDestroy {
  canAccessPremium: boolean;
  totpCode: string;
  totpCodeFormatted: string;
  totpDash: number;
  totpSec: number;
  totpLow: boolean;
  showRevisionDate = false;
  hasPasswordHistory = false;
  viewingPasswordHistory = false;
  viewOnly = false;
  showPasswordCount = false;

  protected totpInterval: number;
  protected override componentName = "app-vault-add-edit";

  constructor(
    cipherService: CipherService,
    folderService: FolderService,
    i18nService: I18nService,
    platformUtilsService: PlatformUtilsService,
    auditService: AuditService,
    stateService: StateService,
    collectionService: CollectionService,
    protected totpService: TotpService,
    protected passwordGenerationService: PasswordGenerationServiceAbstraction,
    protected messagingService: MessagingService,
    eventCollectionService: EventCollectionService,
    protected policyService: PolicyService,
    organizationService: OrganizationService,
    logService: LogService,
    passwordRepromptService: PasswordRepromptService,
    sendApiService: SendApiService,
    dialogService: DialogService
  ) {
    super(
      cipherService,
      folderService,
      i18nService,
      platformUtilsService,
      auditService,
      stateService,
      collectionService,
      messagingService,
      eventCollectionService,
      policyService,
      logService,
      passwordRepromptService,
      organizationService,
      sendApiService,
      dialogService
    );
  }

  async ngOnInit() {
    await super.ngOnInit();
    await this.load();
    // remove when all the title for all clients are updated to New Item
    if (this.cloneMode || !this.editMode) {
      this.title = this.i18nService.t("newItem");
    }
    this.showRevisionDate = this.cipher.passwordRevisionDisplayDate != null;
    this.hasPasswordHistory = this.cipher.hasPasswordHistory;
    this.cleanUp();

    this.canAccessPremium = await this.stateService.getCanAccessPremium();
    if (this.showTotp()) {
      await this.totpUpdateCode();
      const interval = this.totpService.getTimeInterval(this.cipher.login.totp);
      await this.totpTick(interval);

      this.totpInterval = window.setInterval(async () => {
        await this.totpTick(interval);
      }, 1000);
    }
  }

  ngOnDestroy() {
    super.ngOnDestroy();
  }

  toggleFavorite() {
    this.cipher.favorite = !this.cipher.favorite;
  }

  togglePassword() {
    super.togglePassword();

    // Hide password count when password is hidden to be safe
    if (!this.showPassword && this.showPasswordCount) {
      this.togglePasswordCount();
    }
  }

  togglePasswordCount() {
    this.showPasswordCount = !this.showPasswordCount;

    if (this.editMode && this.showPasswordCount) {
      this.eventCollectionService.collect(
        EventType.Cipher_ClientToggledPasswordVisible,
        this.cipherId
      );
    }
  }

  launch(uri: LoginUriView) {
    if (!uri.canLaunch) {
      return;
    }

    this.platformUtilsService.launchUri(uri.launchUri);
  }

  copy(value: string, typeI18nKey: string, aType: string) {
    if (value == null) {
      return;
    }

    this.platformUtilsService.copyToClipboard(value, { window: window });
    this.platformUtilsService.showToast(
      "info",
      null,
      this.i18nService.t("valueCopied", this.i18nService.t(typeI18nKey))
    );

    if (this.editMode) {
      if (typeI18nKey === "password") {
        this.eventCollectionService.collect(EventType.Cipher_ClientCopiedPassword, this.cipherId);
      } else if (typeI18nKey === "securityCode") {
        this.eventCollectionService.collect(EventType.Cipher_ClientCopiedCardCode, this.cipherId);
      } else if (aType === "H_Field") {
        this.eventCollectionService.collect(
          EventType.Cipher_ClientCopiedHiddenField,
          this.cipherId
        );
      }
    }
  }

  async generatePassword(): Promise<boolean> {
    const confirmed = await super.generatePassword();
    if (confirmed) {
      const options = (await this.passwordGenerationService.getOptions())?.[0] ?? {};
      this.cipher.login.password = await this.passwordGenerationService.generatePassword(options);
    }
    return confirmed;
  }

  premiumRequired() {
    if (!this.canAccessPremium) {
      this.messagingService.send("premiumRequired");
      return;
    }
  }

  upgradeOrganization() {
    this.messagingService.send("upgradeOrganization", {
      organizationId: this.cipher.organizationId,
    });
  }

  showGetPremium() {
    if (this.canAccessPremium) {
      return;
    }
    if (this.cipher.organizationUseTotp) {
      this.upgradeOrganization();
    } else {
      this.premiumRequired();
    }
  }

  viewHistory() {
    this.viewingPasswordHistory = !this.viewingPasswordHistory;
  }

  protected cleanUp() {
    if (this.totpInterval) {
      window.clearInterval(this.totpInterval);
    }
  }

  protected async totpUpdateCode() {
    if (
      this.cipher == null ||
      this.cipher.type !== CipherType.Login ||
      this.cipher.login.totp == null
    ) {
      if (this.totpInterval) {
        window.clearInterval(this.totpInterval);
      }
      return;
    }

    this.totpCode = await this.totpService.getCode(this.cipher.login.totp);
    if (this.totpCode != null) {
      if (this.totpCode.length > 4) {
        const half = Math.floor(this.totpCode.length / 2);
        this.totpCodeFormatted =
          this.totpCode.substring(0, half) + " " + this.totpCode.substring(half);
      } else {
        this.totpCodeFormatted = this.totpCode;
      }
    } else {
      this.totpCodeFormatted = null;
      if (this.totpInterval) {
        window.clearInterval(this.totpInterval);
      }
    }
  }

  protected allowOwnershipAssignment() {
    return (
      (!this.editMode || this.cloneMode) &&
      this.ownershipOptions != null &&
      (this.ownershipOptions.length > 1 || !this.allowPersonal)
    );
  }

  protected showTotp() {
    return (
      this.cipher.type === CipherType.Login &&
      this.cipher.login.totp &&
      this.organization?.planProductType != ProductType.Free &&
      (this.cipher.organizationUseTotp || this.canAccessPremium)
    );
  }

  private async totpTick(intervalSeconds: number) {
    const epoch = Math.round(new Date().getTime() / 1000.0);
    const mod = epoch % intervalSeconds;

    this.totpSec = intervalSeconds - mod;
    this.totpDash = +(Math.round(((78.6 / intervalSeconds) * mod + "e+2") as any) + "e-2");
    this.totpLow = this.totpSec <= 7;
    if (mod === 0) {
      await this.totpUpdateCode();
    }
  }
}
