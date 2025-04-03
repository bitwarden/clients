import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import {
  ReactiveFormsModule,
  FormBuilder,
  Validators,
  FormGroup,
  FormControl,
} from "@angular/forms";
import { firstValueFrom } from "rxjs";

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
import {
  DEFAULT_KDF_CONFIG,
  KdfConfig,
  KdfConfigService,
  KeyService,
} from "@bitwarden/key-management";

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
   * - Input: New password confirm
   * - Input: New password hint
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
  private kdfConfig?: KdfConfig;
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
      newPasswordConfirm: ["", Validators.required],
      newPasswordHint: [
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
          "newPasswordConfirm",
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
        this.formBuilder.control<boolean>(false),
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

    if (this.email == null) {
      throw new Error("Email is required to create master key.");
    }

    this.kdfConfig = (await this.kdfConfigService.getKdfConfig()) || DEFAULT_KDF_CONFIG;

    const currentPassword = this.formGroup.get("currentPassword")?.value;
    const { newPassword, newPasswordHint, checkForBreaches } = this.formGroup.value;

    // 1. Verify current password is correct (if necessary)
    if (
      this.inputPasswordFlow === InputPasswordFlow.ChangeExistingPassword ||
      this.inputPasswordFlow ===
        InputPasswordFlow.ChangeExistingPasswordAndOptionallyRotateAccountEncryptionKey
    ) {
      const currentPasswordIsCorrect = await this.verifyCurrentPassword(currentPassword);
      if (!currentPasswordIsCorrect) {
        return;
      }
    }

    // 2. Evaluate new password
    const newPasswordEvaluatedSuccessfully = await this.evaluateNewPassword(
      newPassword,
      this.passwordStrengthScore,
      checkForBreaches,
    );
    if (!newPasswordEvaluatedSuccessfully) {
      return;
    }

    // 3. Create cryptographic keys
    const newMasterKey = await this.keyService.makeMasterKey(
      newPassword,
      this.email.trim().toLowerCase(),
      this.kdfConfig,
    );

    const newServerMasterKeyHash = await this.keyService.hashMasterKey(
      newPassword,
      newMasterKey,
      HashPurpose.ServerAuthorization,
    );

    const newLocalMasterKeyHash = await this.keyService.hashMasterKey(
      newPassword,
      newMasterKey,
      HashPurpose.LocalAuthorization,
    );

    const passwordInputResult: PasswordInputResult = {
      newPassword,
      newMasterKey,
      newServerMasterKeyHash,
      newLocalMasterKeyHash,
      newPasswordHint,
      kdfConfig: this.kdfConfig,
    };

    if (
      this.inputPasswordFlow === InputPasswordFlow.ChangePassword ||
      this.inputPasswordFlow === InputPasswordFlow.ChangePasswordWithOptionalUserKeyRotation
    ) {
      const currentMasterKey = await this.keyService.makeMasterKey(
        currentPassword,
        this.email.trim().toLowerCase(),
        this.kdfConfig,
      );

      const currentServerMasterKeyHash = await this.keyService.hashMasterKey(
        currentPassword,
        currentMasterKey,
        HashPurpose.ServerAuthorization,
      );

      const currentLocalMasterKeyHash = await this.keyService.hashMasterKey(
        currentPassword,
        currentMasterKey,
        HashPurpose.LocalAuthorization,
      );

      passwordInputResult.currentPassword = currentPassword;
      passwordInputResult.currentMasterKey = currentMasterKey;
      passwordInputResult.currentServerMasterKeyHash = currentServerMasterKeyHash;
      passwordInputResult.currentLocalMasterKeyHash = currentLocalMasterKeyHash;
    }

    if (
      this.inputPasswordFlow ===
      InputPasswordFlow.ChangeExistingPasswordAndOptionallyRotateAccountEncryptionKey
    ) {
      passwordInputResult.rotateAccountEncryptionKey = this.rotateAccountEncryptionKey;
    }

    // 4. Emit cryptographic keys and other password related properties
    this.onPasswordFormSubmit.emit(passwordInputResult);
  };

  /**
   * Returns true if the current password is correct, false otherwise
   */
  private async verifyCurrentPassword(currentPassword: string): Promise<boolean> {
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));

    const currentMasterKey = await this.keyService.makeMasterKey(
      currentPassword,
      this.email.trim().toLowerCase(),
      this.kdfConfig,
    );

    const decryptedUserKey = await this.masterPasswordService.decryptUserKeyWithMasterKey(
      currentMasterKey,
      userId,
    );

    if (decryptedUserKey == null) {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("invalidMasterPassword"),
      });

      return false;
    }

    return true;
  }

  /**
   * Returns true if the new password passes all checks, false otherwise
   */
  private async evaluateNewPassword(
    newPassword: string,
    passwordStrengthScore: PasswordStrengthScore,
    checkForBreaches: boolean,
  ): Promise<boolean> {
    // Check if the password is breached, weak, or both
    const passwordIsBreached =
      checkForBreaches && (await this.auditService.passwordLeaked(newPassword)) > 0;

    const passwordIsWeak = passwordStrengthScore != null && passwordStrengthScore < 3;

    if (passwordIsBreached && passwordIsWeak) {
      const userAcceptedDialog = await this.dialogService.openSimpleDialog({
        title: { key: "weakAndExposedMasterPassword" },
        content: { key: "weakAndBreachedMasterPasswordDesc" },
        type: "warning",
      });

      if (!userAcceptedDialog) {
        return false;
      }
    } else if (passwordIsWeak) {
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
    const rotateUserKey = this.formGroup.get("rotateUserKey")?.value;

    if (rotateUserKey) {
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

        (this.formGroup.get("rotateUserKey") as unknown as FormControl<boolean>)?.setValue(false);
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
        (this.formGroup.get("rotateUserKey") as unknown as FormControl<boolean>)?.setValue(false);
      }
    }
  }
}
