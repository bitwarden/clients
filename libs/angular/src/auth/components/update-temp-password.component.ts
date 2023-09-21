import { Directive } from "@angular/core";
import { Router } from "@angular/router";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { VerificationType } from "@bitwarden/common/auth/enums/verification-type";
import { ForceResetPasswordReason } from "@bitwarden/common/auth/models/domain/force-reset-password-reason";
import { PasswordRequest } from "@bitwarden/common/auth/models/request/password.request";
import { UpdateTempPasswordRequest } from "@bitwarden/common/auth/models/request/update-temp-password.request";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { MasterKey, UserKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/common/tools/generator/password";
import { Verification } from "@bitwarden/common/types/verification";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { DialogService } from "@bitwarden/components";

import { ChangePasswordComponent as BaseChangePasswordComponent } from "./change-password.component";

@Directive()
export class UpdateTempPasswordComponent extends BaseChangePasswordComponent {
  hint: string;
  key: string;
  enforcedPolicyOptions: MasterPasswordPolicyOptions;
  showPassword = false;
  reason: ForceResetPasswordReason = ForceResetPasswordReason.None;
  verification: Verification = {
    type: VerificationType.MasterPassword,
    secret: "",
  };

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
    private userVerificationService: UserVerificationService,
    private router: Router,
    dialogService: DialogService
  ) {
    super(
      i18nService,
      cryptoService,
      messagingService,
      passwordGenerationService,
      platformUtilsService,
      policyService,
      stateService,
      dialogService
    );
  }

  async ngOnInit() {
    await this.syncService.fullSync(true);

    this.reason = await this.stateService.getForcePasswordResetReason();

    // If we somehow end up here without a reason, go back to the home page
    if (this.reason == ForceResetPasswordReason.None) {
      this.router.navigate(["/"]);
      return;
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
      const newMasterKey = await this.cryptoService.makeMasterKey(
        this.masterPassword,
        this.email.trim().toLowerCase(),
        this.kdf,
        this.kdfConfig
      );
      const newPasswordHash = await this.cryptoService.hashMasterKey(
        this.masterPassword,
        newMasterKey
      );

      // Grab user key
      const userKey = await this.cryptoService.getUserKey();

      // Encrypt user key with new master key
      const newProtectedUserKey = await this.cryptoService.encryptUserKeyWithMasterKey(
        newMasterKey,
        userKey
      );

      await this.performSubmitActions(newPasswordHash, newMasterKey, newProtectedUserKey);
    } catch (e) {
      this.logService.error(e);
    }
  }

  async performSubmitActions(
    masterPasswordHash: string,
    masterKey: MasterKey,
    userKey: [UserKey, EncString]
  ) {
    try {
      switch (this.reason) {
        case ForceResetPasswordReason.AdminForcePasswordReset:
          this.formPromise = this.updateTempPassword(masterPasswordHash, userKey);
          break;
        case ForceResetPasswordReason.WeakMasterPassword:
          this.formPromise = this.updatePassword(masterPasswordHash, userKey);
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
  private async updateTempPassword(masterPasswordHash: string, userKey: [UserKey, EncString]) {
    const request = new UpdateTempPasswordRequest();
    request.key = userKey[1].encryptedString;
    request.newMasterPasswordHash = masterPasswordHash;
    request.masterPasswordHint = this.hint;

    return this.apiService.putUpdateTempPassword(request);
  }

  private async updatePassword(newMasterPasswordHash: string, userKey: [UserKey, EncString]) {
    const request = await this.userVerificationService.buildRequest(
      this.verification,
      PasswordRequest
    );
    request.masterPasswordHint = this.hint;
    request.newMasterPasswordHash = newMasterPasswordHash;
    request.key = userKey[1].encryptedString;

    return this.apiService.postPassword(request);
  }
}
