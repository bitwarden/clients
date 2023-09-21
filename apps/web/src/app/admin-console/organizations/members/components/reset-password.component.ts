import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
} from "@angular/core";
import { Subject, takeUntil } from "rxjs";
import zxcvbn from "zxcvbn";

import { PasswordStrengthComponent } from "@bitwarden/angular/shared/components/password-strength/password-strength.component";
import { OrganizationUserService } from "@bitwarden/common/abstractions/organization-user/organization-user.service";
import { OrganizationUserResetPasswordRequest } from "@bitwarden/common/abstractions/organization-user/requests";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { KdfConfig } from "@bitwarden/common/auth/models/domain/kdf-config";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import {
  SymmetricCryptoKey,
  UserKey,
} from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/common/tools/generator/password";
import { DialogService } from "@bitwarden/components";

@Component({
  selector: "app-reset-password",
  templateUrl: "reset-password.component.html",
})
export class ResetPasswordComponent implements OnInit, OnDestroy {
  @Input() name: string;
  @Input() email: string;
  @Input() id: string;
  @Input() organizationId: string;
  @Output() onPasswordReset = new EventEmitter();
  @ViewChild(PasswordStrengthComponent) passwordStrengthComponent: PasswordStrengthComponent;

  enforcedPolicyOptions: MasterPasswordPolicyOptions;
  newPassword: string = null;
  showPassword = false;
  passwordStrengthResult: zxcvbn.ZXCVBNResult;
  formPromise: Promise<any>;

  private destroy$ = new Subject<void>();

  constructor(
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private passwordGenerationService: PasswordGenerationServiceAbstraction,
    private policyService: PolicyService,
    private cryptoService: CryptoService,
    private logService: LogService,
    private organizationUserService: OrganizationUserService,
    private dialogService: DialogService
  ) {}

  async ngOnInit() {
    this.policyService
      .masterPasswordPolicyOptions$()
      .pipe(takeUntil(this.destroy$))
      .subscribe(
        (enforcedPasswordPolicyOptions) =>
          (this.enforcedPolicyOptions = enforcedPasswordPolicyOptions)
      );
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get loggedOutWarningName() {
    return this.name != null ? this.name : this.i18nService.t("thisUser");
  }

  async generatePassword() {
    const options = (await this.passwordGenerationService.getOptions())?.[0] ?? {};
    this.newPassword = await this.passwordGenerationService.generatePassword(options);
    this.passwordStrengthComponent.updatePasswordStrength(this.newPassword);
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
    document.getElementById("newPassword").focus();
  }

  copy(value: string) {
    if (value == null) {
      return;
    }

    this.platformUtilsService.copyToClipboard(value, { window: window });
    this.platformUtilsService.showToast(
      "info",
      null,
      this.i18nService.t("valueCopied", this.i18nService.t("password"))
    );
  }

  async submit() {
    // Validation
    if (this.newPassword == null || this.newPassword === "") {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("masterPasswordRequired")
      );
      return false;
    }

    if (this.newPassword.length < Utils.minimumPasswordLength) {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("masterPasswordMinlength", Utils.minimumPasswordLength)
      );
      return false;
    }

    if (
      this.enforcedPolicyOptions != null &&
      !this.policyService.evaluateMasterPassword(
        this.passwordStrengthResult.score,
        this.newPassword,
        this.enforcedPolicyOptions
      )
    ) {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("masterPasswordPolicyRequirementsNotMet")
      );
      return;
    }

    if (this.passwordStrengthResult.score < 3) {
      const result = await this.dialogService.openSimpleDialog({
        title: { key: "weakMasterPassword" },
        content: { key: "weakMasterPasswordDesc" },
        type: "warning",
      });

      if (!result) {
        return false;
      }
    }

    // Get user Information (kdf type, kdf iterations, resetPasswordKey, private key) and change password
    try {
      this.formPromise = this.organizationUserService
        .getOrganizationUserResetPasswordDetails(this.organizationId, this.id)
        .then(async (response) => {
          if (response == null) {
            throw new Error(this.i18nService.t("resetPasswordDetailsError"));
          }

          const kdfType = response.kdf;
          const kdfIterations = response.kdfIterations;
          const kdfMemory = response.kdfMemory;
          const kdfParallelism = response.kdfParallelism;
          const resetPasswordKey = response.resetPasswordKey;
          const encryptedPrivateKey = response.encryptedPrivateKey;

          // Decrypt Organization's encrypted Private Key with org key
          const orgSymKey = await this.cryptoService.getOrgKey(this.organizationId);
          const decPrivateKey = await this.cryptoService.decryptToBytes(
            new EncString(encryptedPrivateKey),
            orgSymKey
          );

          // Decrypt User's Reset Password Key to get UserKey
          const decValue = await this.cryptoService.rsaDecrypt(resetPasswordKey, decPrivateKey);
          const existingUserKey = new SymmetricCryptoKey(decValue) as UserKey;

          // Create new master key and hash new password
          const newMasterKey = await this.cryptoService.makeMasterKey(
            this.newPassword,
            this.email.trim().toLowerCase(),
            kdfType,
            new KdfConfig(kdfIterations, kdfMemory, kdfParallelism)
          );
          const newMasterKeyHash = await this.cryptoService.hashMasterKey(
            this.newPassword,
            newMasterKey
          );

          // Create new encrypted user key for the User
          const newUserKey = await this.cryptoService.encryptUserKeyWithMasterKey(
            newMasterKey,
            existingUserKey
          );

          // Create request
          const request = new OrganizationUserResetPasswordRequest();
          request.key = newUserKey[1].encryptedString;
          request.newMasterPasswordHash = newMasterKeyHash;

          // Change user's password
          return this.organizationUserService.putOrganizationUserResetPassword(
            this.organizationId,
            this.id,
            request
          );
        });

      await this.formPromise;
      this.platformUtilsService.showToast(
        "success",
        null,
        this.i18nService.t("resetPasswordSuccess")
      );
      this.onPasswordReset.emit();
    } catch (e) {
      this.logService.error(e);
    }
  }

  getStrengthResult(result: zxcvbn.ZXCVBNResult) {
    this.passwordStrengthResult = result;
  }
}
