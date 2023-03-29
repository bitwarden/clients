import { Directive } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { CryptoService } from "@bitwarden/common/abstractions/crypto.service";
import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/abstractions/platformUtils.service";
import { StateService } from "@bitwarden/common/abstractions/state.service";
import { UserVerificationService } from "@bitwarden/common/abstractions/userVerification/userVerification.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { VerificationType } from "@bitwarden/common/auth/enums/verification-type";
import { ForceResetPasswordReason } from "@bitwarden/common/auth/models/domain/force-reset-password-reason";
import { PasswordRequest } from "@bitwarden/common/auth/models/request/password.request";
import { UpdateTempPasswordRequest } from "@bitwarden/common/auth/models/request/update-temp-password.request";
import { EncString } from "@bitwarden/common/models/domain/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/models/domain/symmetric-crypto-key";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/common/tools/generator/password";
import { Verification } from "@bitwarden/common/types/verification";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";

import { ChangePasswordComponent as BaseChangePasswordComponent } from "./change-password.component";

@Directive()
export class UpdateTempPasswordComponent extends BaseChangePasswordComponent {
  hint: string;
  key: string;
  enforcedPolicyOptions: MasterPasswordPolicyOptions;
  showPassword = false;
  reason: ForceResetPasswordReason = ForceResetPasswordReason.None;
  currentMasterPassword: string;

  onSuccessfulChangePassword: () => Promise<any>;

  get requireCurrentPassword(): boolean {
    return this.reason === ForceResetPasswordReason.WeakMasterPassword;
  }

  constructor(
    i18nService: I18nService,
    platformUtilsService: PlatformUtilsService,
    passwordGenerationService: PasswordGenerationServiceAbstraction,
    policyService: PolicyService,
    cryptoService: CryptoService,
    messagingService: MessagingService,
    private apiService: ApiService,
    stateService: StateService,
    private syncService: SyncService,
    private logService: LogService,
    private userVerificationService: UserVerificationService
  ) {
    super(
      i18nService,
      cryptoService,
      messagingService,
      passwordGenerationService,
      platformUtilsService,
      policyService,
      stateService
    );
  }

  async ngOnInit() {
    await this.syncService.fullSync(true);

    this.reason = await this.stateService.getForcePasswordResetReason();

    // If we somehow end up here without a reason, fallback to the original behavior of an admin password reset
    if (this.reason == ForceResetPasswordReason.None) {
      this.reason = ForceResetPasswordReason.AdminForcePasswordReset;
    }

    await super.ngOnInit();
  }

  get masterPasswordWarningText(): string {
    return this.reason == ForceResetPasswordReason.WeakMasterPassword
      ? this.i18nService.t("updateWeakMasterPasswordWarning")
      : this.i18nService.t("updateMasterPasswordWarning");
  }

  togglePassword(confirmField: boolean) {
    this.showPassword = !this.showPassword;
    document.getElementById(confirmField ? "masterPasswordRetype" : "masterPassword").focus();
  }

  async setupSubmitActions(): Promise<boolean> {
    if (this.requireCurrentPassword) {
      if (this.currentMasterPassword == null || this.currentMasterPassword === "") {
        this.platformUtilsService.showToast(
          "error",
          this.i18nService.t("errorOccurred"),
          this.i18nService.t("masterPasswordRequired")
        );
        return false;
      }

      const secret: Verification = {
        type: VerificationType.MasterPassword,
        secret: this.currentMasterPassword,
      };
      try {
        await this.userVerificationService.verifyUser(secret);
      } catch (e) {
        this.platformUtilsService.showToast(
          "error",
          this.i18nService.t("errorOccurred"),
          e.message
        );
        return false;
      }
    }

    this.email = await this.stateService.getEmail();
    this.kdf = await this.stateService.getKdfType();
    this.kdfConfig = await this.stateService.getKdfConfig();
    return true;
  }

  async submit() {
    // Validation
    if (!(await this.strongPassword())) {
      return;
    }

    if (!(await this.setupSubmitActions())) {
      return;
    }

    try {
      // Create new key and hash new password
      const newKey = await this.cryptoService.makeKey(
        this.masterPassword,
        this.email.trim().toLowerCase(),
        this.kdf,
        this.kdfConfig
      );
      const newPasswordHash = await this.cryptoService.hashPassword(this.masterPassword, newKey);

      // Grab user's current enc key
      const userEncKey = await this.cryptoService.getEncKey();

      // Create new encKey for the User
      const newEncKey = await this.cryptoService.remakeEncKey(newKey, userEncKey);

      await this.performSubmitActions(newPasswordHash, newKey, newEncKey);
    } catch (e) {
      this.logService.error(e);
    }
  }

  async performSubmitActions(
    masterPasswordHash: string,
    key: SymmetricCryptoKey,
    encKey: [SymmetricCryptoKey, EncString]
  ) {
    try {
      switch (this.reason) {
        case ForceResetPasswordReason.AdminForcePasswordReset:
          this.formPromise = this.updateTempPassword(masterPasswordHash, encKey);
          break;
        case ForceResetPasswordReason.WeakMasterPassword:
          this.formPromise = this.updatePassword(masterPasswordHash, encKey);
          break;
      }

      await this.formPromise;
      this.platformUtilsService.showToast(
        "success",
        null,
        this.i18nService.t("updatedMasterPassword")
      );

      await this.stateService.setForcePasswordResetReason(ForceResetPasswordReason.None);

      if (this.onSuccessfulChangePassword != null) {
        this.onSuccessfulChangePassword();
      } else {
        this.messagingService.send("logout");
      }
    } catch (e) {
      this.logService.error(e);
    }
  }
  private async updateTempPassword(
    masterPasswordHash: string,
    encKey: [SymmetricCryptoKey, EncString]
  ) {
    const request = new UpdateTempPasswordRequest();
    request.key = encKey[1].encryptedString;
    request.newMasterPasswordHash = masterPasswordHash;
    request.masterPasswordHint = this.hint;

    return this.apiService.putUpdateTempPassword(request);
  }

  private async updatePassword(
    newMasterPasswordHash: string,
    encKey: [SymmetricCryptoKey, EncString]
  ) {
    const request = new PasswordRequest();
    request.masterPasswordHash = await this.cryptoService.hashPassword(
      this.currentMasterPassword,
      null
    );
    request.masterPasswordHint = this.hint;
    request.newMasterPasswordHash = newMasterPasswordHash;
    request.key = encKey[1].encryptedString;

    return this.apiService.postPassword(request);
  }
}
