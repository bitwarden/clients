import { Directive } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/auth/abstractions/master-password.service.abstraction";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { VerificationType } from "@bitwarden/common/auth/enums/verification-type";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { PasswordRequest } from "@bitwarden/common/auth/models/request/password.request";
import { UpdateTempPasswordRequest } from "@bitwarden/common/auth/models/request/update-temp-password.request";
import { MasterPasswordVerification } from "@bitwarden/common/auth/types/verification";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/common/tools/generator/password";
import { MasterKey, UserKey } from "@bitwarden/common/types/key";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { DialogService } from "@bitwarden/components";

import { ChangePasswordComponent as BaseChangePasswordComponent } from "./change-password.component";

@Directive()
export class UpdateTempPasswordComponent extends BaseChangePasswordComponent {
  hint: string;
  key: string;
  enforcedPolicyOptions: MasterPasswordPolicyOptions;
  showPassword = false;
  reason: ForceSetPasswordReason = ForceSetPasswordReason.None;
  verification: MasterPasswordVerification = {
    type: VerificationType.MasterPassword,
    secret: "",
  };

  onSuccessfulChangePassword: () => Promise<any>;

  get requireCurrentPassword(): boolean {
    return this.reason === ForceSetPasswordReason.WeakMasterPassword;
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
    protected router: Router,
    dialogService: DialogService,
    private accountService: AccountService,
    private masterPasswordService: InternalMasterPasswordServiceAbstraction,
  ) {
    super(
      i18nService,
      cryptoService,
      messagingService,
      passwordGenerationService,
      platformUtilsService,
      policyService,
      stateService,
      dialogService,
    );
  }

  async ngOnInit() {
    await this.syncService.fullSync(true);

    const userId = (await firstValueFrom(this.accountService.activeAccount$))?.id;
    this.reason = await firstValueFrom(this.masterPasswordService.forceSetPasswordReason$(userId));

    // If we somehow end up here without a reason, go back to the home page
    if (this.reason == ForceSetPasswordReason.None) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.router.navigate(["/"]);
      return;
    }

    await super.ngOnInit();
  }

  get masterPasswordWarningText(): string {
    return this.reason == ForceSetPasswordReason.WeakMasterPassword
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
        this.kdfConfig,
      );
      const newPasswordHash = await this.cryptoService.hashMasterKey(
        this.masterPassword,
        newMasterKey,
      );

      // Grab user key
      const userKey = await this.cryptoService.getUserKey();

      // Encrypt user key with new master key
      const newProtectedUserKey = await this.cryptoService.encryptUserKeyWithMasterKey(
        newMasterKey,
        userKey,
      );

      await this.performSubmitActions(newPasswordHash, newMasterKey, newProtectedUserKey);
    } catch (e) {
      this.logService.error(e);
    }
  }

  async performSubmitActions(
    masterPasswordHash: string,
    masterKey: MasterKey,
    userKey: [UserKey, EncString],
  ) {
    try {
      switch (this.reason) {
        case ForceSetPasswordReason.AdminForcePasswordReset:
          this.formPromise = this.updateTempPassword(masterPasswordHash, userKey);
          break;
        case ForceSetPasswordReason.WeakMasterPassword:
          this.formPromise = this.updatePassword(masterPasswordHash, userKey);
          break;
      }

      await this.formPromise;
      this.platformUtilsService.showToast(
        "success",
        null,
        this.i18nService.t("updatedMasterPassword"),
      );

      const userId = (await firstValueFrom(this.accountService.activeAccount$))?.id;
      await this.masterPasswordService.setForceSetPasswordReason(
        ForceSetPasswordReason.None,
        userId,
      );

      if (this.onSuccessfulChangePassword != null) {
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
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
      PasswordRequest,
    );
    request.masterPasswordHint = this.hint;
    request.newMasterPasswordHash = newMasterPasswordHash;
    request.key = userKey[1].encryptedString;

    return this.apiService.postPassword(request);
  }
}
