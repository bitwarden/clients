import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from "@angular/forms";
import { firstValueFrom, map } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  PasswordStrengthScore,
  PasswordStrengthV2Component,
} from "@bitwarden/angular/tools/password-strength/password-strength-v2.component";
import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { MasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { HashPurpose } from "@bitwarden/common/platform/enums";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import {
  AsyncActionsModule,
  ButtonModule,
  CheckboxModule,
  DialogService,
  FormFieldModule,
  IconButtonModule,
  InputModule,
  ToastService,
  Translation,
} from "@bitwarden/components";
import { DEFAULT_KDF_CONFIG, KdfConfigService, KeyService } from "@bitwarden/key-management";

// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { SharedModule } from "../../../../components/src/shared";
import { PasswordCalloutComponent } from "../password-callout/password-callout.component";
import { compareInputs, ValidationGoal } from "../validators/compare-inputs.validator";

import { PasswordInputResult } from "./password-input-result";

/**
 * Determines which form input elements will be displayed in the UI.
 */
export enum InputPasswordFlow {
  /**
   * - Input: New password
   * - Input: Confirm new password
   * - Input: Hint
   * - Checkbox: Check for breaches
   */
  SetInitialPassword,
  /**
   * Everything above, plus:
   * - Input: Current password (as the first element in the UI)
   */
  ChangePassword,
  /**
   * Everything above, plus:
   * - Checkbox: Rotate account encryption key (as the last element in the UI)
   */
  ChangePasswordWithOptionalUserKeyRotation,
}

@Component({
  standalone: true,
  selector: "auth-input-password",
  templateUrl: "./input-password.component.html",
  imports: [
    AsyncActionsModule,
    ButtonModule,
    CheckboxModule,
    FormFieldModule,
    IconButtonModule,
    InputModule,
    ReactiveFormsModule,
    SharedModule,
    PasswordCalloutComponent,
    PasswordStrengthV2Component,
    JslibModule,
  ],
})
export class InputPasswordComponent implements OnInit {
  @Output() onPasswordFormSubmit = new EventEmitter<PasswordInputResult>();
  @Output() onSecondaryButtonClick = new EventEmitter<void>();

  @Input({ required: true }) inputPasswordFlow!: InputPasswordFlow;
  @Input({ required: true }) email!: string;

  @Input() loading = false;
  @Input() masterPasswordPolicyOptions: MasterPasswordPolicyOptions | null = null;

  @Input() inlineButtons = false;
  @Input() primaryButtonText?: Translation;
  protected primaryButtonTextStr: string = "";
  @Input() secondaryButtonText?: Translation;
  protected secondaryButtonTextStr: string = "";

  protected InputPasswordFlow = InputPasswordFlow;
  private minHintLength = 0;
  protected maxHintLength = 50;
  protected minPasswordLength = Utils.minimumPasswordLength;
  protected minPasswordMsg = "";
  protected passwordStrengthScore: PasswordStrengthScore = 0;
  protected showErrorSummary = false;
  protected showPassword = false;

  protected formGroup = this.formBuilder.nonNullable.group(
    {
      newPassword: ["", [Validators.required, Validators.minLength(this.minPasswordLength)]],
      confirmNewPassword: ["", Validators.required],
      hint: [
        "", // must be string (not null) because we check length in validation
        [Validators.minLength(this.minHintLength), Validators.maxLength(this.maxHintLength)],
      ],
      checkForBreaches: [true],
    },
    {
      validators: [
        compareInputs(
          ValidationGoal.InputsShouldMatch,
          "newPassword",
          "confirmNewPassword",
          this.i18nService.t("masterPassDoesntMatch"),
        ),
        compareInputs(
          ValidationGoal.InputsShouldNotMatch,
          "newPassword",
          "hint",
          this.i18nService.t("hintEqualsPassword"),
        ),
      ],
    },
  );

  get currentPassword() {
    return this.formGroup.controls.currentPassword.value;
  }

  get newPassword() {
    return this.formGroup.controls.newPassword.value;
  }

  get confirmNewPassword() {
    return this.formGroup.controls.confirmNewPassword.value;
  }

  get hint() {
    return this.formGroup.controls.hint.value;
  }

  get checkForBreaches() {
    return this.formGroup.controls.checkForBreaches.value;
  }

  get rotateAccountEncryptionKey() {
    return this.formGroup.controls.rotateAccountEncryptionKey.value;
  }

  constructor(
    private accountService: AccountService,
    private auditService: AuditService,
    private cipherService: CipherService,
    private dialogService: DialogService,
    private formBuilder: FormBuilder,
    private i18nService: I18nService,
    private kdfConfigService: KdfConfigService,
    private keyService: KeyService,
    private masterPasswordService: MasterPasswordServiceAbstraction,
    private platformUtilsService: PlatformUtilsService,
    private policyService: PolicyService,
    private toastService: ToastService,
  ) {}

  ngOnInit(): void {
    if (
      this.inputPasswordFlow === InputPasswordFlow.ChangePassword ||
      this.inputPasswordFlow === InputPasswordFlow.ChangePasswordWithOptionalUserKeyRotation
    ) {
      // https://github.com/angular/angular/issues/48794
      (this.formGroup as FormGroup<any>).addControl(
        "currentPassword",
        this.formBuilder.control("", Validators.required),
      );
    }

    if (this.inputPasswordFlow === InputPasswordFlow.ChangePasswordWithOptionalUserKeyRotation) {
      // https://github.com/angular/angular/issues/48794
      (this.formGroup as FormGroup<any>).addControl(
        "rotateUserKey",
        this.formBuilder.control(false),
      );
    }

    if (this.primaryButtonText) {
      this.primaryButtonTextStr = this.i18nService.t(
        this.primaryButtonText.key,
        ...(this.primaryButtonText?.placeholders ?? []),
      );
    }

    if (this.secondaryButtonText) {
      this.secondaryButtonTextStr = this.i18nService.t(
        this.secondaryButtonText.key,
        ...(this.secondaryButtonText?.placeholders ?? []),
      );
    }
  }

  get minPasswordLengthMsg() {
    if (
      this.masterPasswordPolicyOptions != null &&
      this.masterPasswordPolicyOptions.minLength > 0
    ) {
      return this.i18nService.t("characterMinimum", this.masterPasswordPolicyOptions.minLength);
    } else {
      return this.i18nService.t("characterMinimum", this.minPasswordLength);
    }
  }

  getPasswordStrengthScore(score: PasswordStrengthScore) {
    this.passwordStrengthScore = score;
  }

  protected submit = async () => {
    this.formGroup.markAllAsTouched();

    if (this.formGroup.invalid) {
      this.showErrorSummary = true;
      return;
    }

    // 1. Evaluate current password
    if (
      this.inputPasswordFlow === InputPasswordFlow.ChangeExistingPassword ||
      this.inputPasswordFlow ===
        InputPasswordFlow.ChangeExistingPasswordAndOptionallyRotateAccountEncryptionKey
    ) {
      const currentPasswordEvaluatedSuccessfully = await this.evaluateCurrentPassword();
      if (!currentPasswordEvaluatedSuccessfully) {
        return;
      }
    }

    // 2. Evaluate new password
    const newPasswordEvaluatedSuccessfully = await this.evaluateNewPassword(
      this.newPassword,
      this.passwordStrengthScore,
      this.checkForBreaches,
    );
    if (!newPasswordEvaluatedSuccessfully) {
      return;
    }

    // 3. Create cryptographic keys
    if (this.email == null) {
      throw new Error("Email is required to create master key.");
    }

    const kdfConfig = (await this.kdfConfigService.getKdfConfig()) || DEFAULT_KDF_CONFIG; // TODO-rr-bw: confirm this

    const masterKey = await this.keyService.makeMasterKey(
      this.newPassword,
      this.email.trim().toLowerCase(),
      kdfConfig,
    );

    const masterKeyHash = await this.keyService.hashMasterKey(this.newPassword, masterKey);

    const localMasterKeyHash = await this.keyService.hashMasterKey(
      this.newPassword,
      masterKey,
      HashPurpose.LocalAuthorization,
    );

    // 3. Emit cryptographic keys and other password related properties
    const passwordInputResult: PasswordInputResult = {
      newPassword: this.newPassword,
      hint: this.hint,
      kdfConfig,
      masterKey,
      serverMasterKeyHash,
      localMasterKeyHash,
    };

    if (
      this.inputPasswordFlow === InputPasswordFlow.ChangePassword ||
      this.inputPasswordFlow === InputPasswordFlow.ChangePasswordWithOptionalUserKeyRotation
    ) {
      passwordInputResult.currentPassword = this.currentPassword;
    }

    if (
      this.inputPasswordFlow ===
      InputPasswordFlow.ChangeExistingPasswordAndOptionallyRotateAccountEncryptionKey
    ) {
      passwordInputResult.rotateAccountEncryptionKey = this.rotateAccountEncryptionKey;
    }

    this.onPasswordFormSubmit.emit(passwordInputResult);
  };

  // Returns true if the current password is correct, false otherwise
  private async evaluateCurrentPassword(): Promise<boolean> {
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));

    const masterKey = await this.keyService.makeMasterKey(
      this.currentPassword,
      await firstValueFrom(this.accountService.activeAccount$.pipe(map((a) => a?.email))),
      await this.kdfConfigService.getKdfConfig(),
    );

    const userKey = await this.masterPasswordService.decryptUserKeyWithMasterKey(masterKey, userId);

    if (userKey == null) {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("invalidMasterPassword"),
      });

      return false;
    }

    return true;
  }

  // Returns true if the password passes all checks, false otherwise
  private async evaluateNewPassword(
    newPassword: string,
    passwordStrengthScore: PasswordStrengthScore,
    checkForBreaches: boolean,
  ): Promise<boolean> {
    // Check if the password is breached, weak, or both
    const passwordIsBreached =
      checkForBreaches && (await this.auditService.passwordLeaked(newPassword));

    const passwordWeak = passwordStrengthScore != null && passwordStrengthScore < 3;

    if (passwordIsBreached && passwordWeak) {
      const userAcceptedDialog = await this.dialogService.openSimpleDialog({
        title: { key: "weakAndExposedMasterPassword" },
        content: { key: "weakAndBreachedMasterPasswordDesc" },
        type: "warning",
      });

      if (!userAcceptedDialog) {
        return false;
      }
    } else if (passwordWeak) {
      const userAcceptedDialog = await this.dialogService.openSimpleDialog({
        title: { key: "weakMasterPasswordDesc" },
        content: { key: "weakMasterPasswordDesc" },
        type: "warning",
      });

      if (!userAcceptedDialog) {
        return false;
      }
    } else if (passwordIsBreached) {
      const userAcceptedDialog = await this.dialogService.openSimpleDialog({
        title: { key: "exposedMasterPassword" },
        content: { key: "exposedMasterPasswordDesc" },
        type: "warning",
      });

      if (!userAcceptedDialog) {
        return false;
      }
    }

    // Check if password meets org policy requirements
    if (
      this.masterPasswordPolicyOptions != null &&
      !this.policyService.evaluateMasterPassword(
        this.passwordStrengthScore,
        newPassword,
        this.masterPasswordPolicyOptions,
      )
    ) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("masterPasswordPolicyRequirementsNotMet"),
      });

      return false;
    }

    return true;
  }

  async rotateUserKeyClicked() {
    if (this.rotateUserKey) {
      const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

      const ciphers = await this.cipherService.getAllDecrypted(activeUserId);
      let hasOldAttachments = false;
      if (ciphers != null) {
        for (let i = 0; i < ciphers.length; i++) {
          if (ciphers[i].organizationId == null && ciphers[i].hasOldAttachments) {
            hasOldAttachments = true;
            break;
          }
        }
      }

      if (hasOldAttachments) {
        const learnMore = await this.dialogService.openSimpleDialog({
          title: { key: "warning" },
          content: { key: "oldAttachmentsNeedFixDesc" },
          acceptButtonText: { key: "learnMore" },
          cancelButtonText: { key: "close" },
          type: "warning",
        });

        if (learnMore) {
          this.platformUtilsService.launchUri(
            "https://bitwarden.com/help/attachments/#add-storage-space",
          );
        }

        this.formGroup.controls.rotateUserKey.setValue(false);
        return;
      }

      const result = await this.dialogService.openSimpleDialog({
        title: { key: "rotateEncKeyTitle" },
        content:
          this.i18nService.t("updateEncryptionKeyWarning") +
          " " +
          this.i18nService.t("updateEncryptionKeyExportWarning") +
          " " +
          this.i18nService.t("rotateEncKeyConfirmation"),
        type: "warning",
      });

      if (!result) {
        this.formGroup.controls.rotateUserKey.setValue(false);
      }
    }
  }
}
