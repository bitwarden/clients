// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Directive, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom, map } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/auth/abstractions/master-password.service.abstraction";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { VerificationType } from "@bitwarden/common/auth/enums/verification-type";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { PasswordRequest } from "@bitwarden/common/auth/models/request/password.request";
import { UpdateTdeOffboardingPasswordRequest } from "@bitwarden/common/auth/models/request/update-tde-offboarding-password.request";
import { UpdateTempPasswordRequest } from "@bitwarden/common/auth/models/request/update-temp-password.request";
import { MasterPasswordVerification } from "@bitwarden/common/auth/types/verification";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { MasterKey, UserKey } from "@bitwarden/common/types/key";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { DialogService, ToastService } from "@bitwarden/components";
import { KdfConfigService, KeyService } from "@bitwarden/key-management";

import { ChangePasswordComponent as BaseChangePasswordComponent } from "./change-password.component";

@Directive()
export class UpdateTempPasswordComponent extends BaseChangePasswordComponent implements OnInit {
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
    policyService: PolicyService,
    keyService: KeyService,
    messagingService: MessagingService,
    private apiService: ApiService,
    private syncService: SyncService,
    private logService: LogService,
    private userVerificationService: UserVerificationService,
    protected router: Router,
    dialogService: DialogService,
    kdfConfigService: KdfConfigService,
    accountService: AccountService,
    masterPasswordService: InternalMasterPasswordServiceAbstraction,
    toastService: ToastService,
  ) {
    super(
      i18nService,
      keyService,
      messagingService,
      platformUtilsService,
      policyService,
      dialogService,
      kdfConfigService,
      masterPasswordService,
      accountService,
      toastService,
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
    if (this.reason == ForceSetPasswordReason.WeakMasterPassword) {
      return this.i18nService.t("updateWeakMasterPasswordWarning");
    } else if (this.reason == ForceSetPasswordReason.TdeOffboarding) {
      return this.i18nService.t("tdeDisabledMasterPasswordRequired");
    } else {
      return this.i18nService.t("updateMasterPasswordWarning");
    }
  }

  togglePassword(confirmField: boolean) {
    this.showPassword = !this.showPassword;
    document.getElementById(confirmField ? "masterPasswordRetype" : "masterPassword").focus();
  }

  async setupSubmitActions(): Promise<boolean> {
    this.email = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((a) => a?.email)),
    );
    this.kdfConfig = await this.kdfConfigService.getKdfConfig();
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
      const newMasterKey = await this.keyService.makeMasterKey(
        this.masterPassword,
        this.email.trim().toLowerCase(),
        this.kdfConfig,
      );
      const newPasswordHash = await this.keyService.hashMasterKey(
        this.masterPassword,
        newMasterKey,
      );

      // Grab user key
      const userKey = await this.keyService.getUserKey();

      // Encrypt user key with new master key
      const newProtectedUserKey = await this.keyService.encryptUserKeyWithMasterKey(
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
        case ForceSetPasswordReason.TdeOffboarding:
          this.formPromise = this.updateTdeOffboardingPassword(masterPasswordHash, userKey);
          break;
      }

      await this.formPromise;
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("updatedMasterPassword"),
      });

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

  private async updateTdeOffboardingPassword(
    masterPasswordHash: string,
    userKey: [UserKey, EncString],
  ) {
    const request = new UpdateTdeOffboardingPasswordRequest();
    request.key = userKey[1].encryptedString;
    request.newMasterPasswordHash = masterPasswordHash;
    request.masterPasswordHint = this.hint;

    return this.apiService.putUpdateTdeOffboardingPassword(request);
  }
}
