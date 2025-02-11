// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DatePipe } from "@angular/common";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { firstValueFrom, map } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { AddEditComponent as BaseAddEditComponent } from "@bitwarden/angular/vault/components/add-edit.component";
import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { isCardExpired } from "@bitwarden/common/autofill/utils";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { EventType } from "@bitwarden/common/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { Launchable } from "@bitwarden/common/vault/interfaces/launchable";
import { CipherAuthorizationService } from "@bitwarden/common/vault/services/cipher-authorization.service";
import { DialogService, ToastService } from "@bitwarden/components";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/generator-legacy";
import { PasswordRepromptService } from "@bitwarden/vault";

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
  cardIsExpired: boolean = false;

  protected totpInterval: number;
  protected override componentName = "app-vault-add-edit";

  constructor(
    cipherService: CipherService,
    folderService: FolderService,
    i18nService: I18nService,
    platformUtilsService: PlatformUtilsService,
    auditService: AuditService,
    accountService: AccountService,
    collectionService: CollectionService,
    protected totpService: TotpService,
    protected passwordGenerationService: PasswordGenerationServiceAbstraction,
    protected messagingService: MessagingService,
    eventCollectionService: EventCollectionService,
    protected policyService: PolicyService,
    organizationService: OrganizationService,
    logService: LogService,
    passwordRepromptService: PasswordRepromptService,
    dialogService: DialogService,
    datePipe: DatePipe,
    configService: ConfigService,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
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
      messagingService,
      eventCollectionService,
      policyService,
      logService,
      passwordRepromptService,
      organizationService,
      dialogService,
      window,
      datePipe,
      configService,
      cipherAuthorizationService,
      toastService,
      sdkService,
    );
  }

  async ngOnInit() {
    await super.ngOnInit();
    await this.load();

    // https://bitwarden.atlassian.net/browse/PM-10413
    // cannot generate ssh keys so block creation
    if (
      this.type === CipherType.SshKey &&
      this.cipherId == null &&
      !(await this.configService.getFeatureFlag(FeatureFlag.SSHKeyVaultItem))
    ) {
      this.type = CipherType.Login;
      this.cipher.type = CipherType.Login;
    }

    this.viewOnly = !this.cipher.edit && this.editMode;
    // remove when all the title for all clients are updated to New Item
    if (this.cloneMode || !this.editMode) {
      this.title = this.i18nService.t("newItem");
    }
    this.showRevisionDate = this.cipher.passwordRevisionDisplayDate != null;
    this.hasPasswordHistory = this.cipher.hasPasswordHistory;
    this.cleanUp();

    const activeUserId = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((a) => a.id)),
    );

    this.canAccessPremium = await firstValueFrom(
      this.billingAccountProfileStateService.hasPremiumFromAnySource$(activeUserId),
    );

    if (this.showTotp()) {
      await this.totpUpdateCode();
      const interval = this.totpService.getTimeInterval(this.cipher.login.totp);
      await this.totpTick(interval);

      this.totpInterval = window.setInterval(async () => {
        await this.totpTick(interval);
      }, 1000);
    }

    this.cardIsExpired = isCardExpired(this.cipher.card);
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
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.eventCollectionService.collect(
        EventType.Cipher_ClientToggledPasswordVisible,
        this.cipherId,
      );
    }
  }

  launch(uri: Launchable) {
    if (!uri.canLaunch) {
      return;
    }

    this.platformUtilsService.launchUri(uri.launchUri);
  }

  async copy(value: string, typeI18nKey: string, aType: string): Promise<boolean> {
    if (value == null) {
      return false;
    }

    this.platformUtilsService.copyToClipboard(value, { window: window });
    this.toastService.showToast({
      variant: "info",
      title: null,
      message: this.i18nService.t("valueCopied", this.i18nService.t(typeI18nKey)),
    });

    if (this.editMode) {
      if (typeI18nKey === "password") {
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.eventCollectionService.collect(EventType.Cipher_ClientCopiedPassword, this.cipherId);
      } else if (typeI18nKey === "securityCode") {
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.eventCollectionService.collect(EventType.Cipher_ClientCopiedCardCode, this.cipherId);
      } else if (aType === "H_Field") {
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.eventCollectionService.collect(
          EventType.Cipher_ClientCopiedHiddenField,
          this.cipherId,
        );
      }
    }

    return true;
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
      this.organization?.productTierType != ProductTierType.Free &&
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
