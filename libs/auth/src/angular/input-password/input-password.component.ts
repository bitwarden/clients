import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { ReactiveFormsModule, FormBuilder, Validators, FormControl } from "@angular/forms";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  PasswordStrengthScore,
  PasswordStrengthV2Component,
} from "@bitwarden/angular/tools/password-strength/password-strength-v2.component";
import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { MasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { HashPurpose } from "@bitwarden/common/platform/enums";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { UserId } from "@bitwarden/common/types/guid";
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
 * Determines which form elements will be displayed in the UI
 * and which cryptographic keys will be created and emitted.
 */
// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum InputPasswordFlow {
  /**
   * Form elements displayed:
   * - [Input] New password
   * - [Input] New password confirm
   * - [Input] New password hint
   * - [Checkbox] Check for breaches
   */
  AccountRegistration, // important: this flow does not involve an activeAccount/userId
  SetInitialPasswordAuthedUser,
  /*
   * All form elements above, plus: [Input] Current password (as the first element in the UI)
   */
  ChangePassword,
  /**
   * All form elements above, plus: [Checkbox] Rotate account encryption key (as the last element in the UI)
   */
  ChangePasswordWithOptionalUserKeyRotation,
}

interface InputPasswordForm {
  newPassword: FormControl<string>;
  newPasswordConfirm: FormControl<string>;
  newPasswordHint: FormControl<string>;
  checkForBreaches: FormControl<boolean>;

  currentPassword?: FormControl<string>;
  rotateUserKey?: FormControl<boolean>;
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

  @Input({ required: true }) flow!: InputPasswordFlow;
  @Input({ required: true, transform: (val: string) => val.trim().toLowerCase() }) email!: string;

  @Input() userId?: UserId;
  @Input() loading = false;
  @Input() masterPasswordPolicyOptions: MasterPasswordPolicyOptions | null = null;

  @Input() inlineButtons = false;
  @Input() primaryButtonText?: Translation;
  protected primaryButtonTextStr: string = "";
  @Input() secondaryButtonText?: Translation;
  protected secondaryButtonTextStr: string = "";

  protected InputPasswordFlow = InputPasswordFlow;
  private kdfConfig: KdfConfig | null = null;
  private minHintLength = 0;
  protected maxHintLength = 50;
  protected minPasswordLength = Utils.minimumPasswordLength;
  protected minPasswordMsg = "";
  protected passwordStrengthScore: PasswordStrengthScore = 0;
  protected showErrorSummary = false;
  protected showPassword = false;

  protected formGroup = this.formBuilder.nonNullable.group<InputPasswordForm>(
    {
      newPassword: this.formBuilder.nonNullable.control("", [
        Validators.required,
        Validators.minLength(this.minPasswordLength),
      ]),
      newPasswordConfirm: this.formBuilder.nonNullable.control("", Validators.required),
      newPasswordHint: this.formBuilder.nonNullable.control("", [
        Validators.minLength(this.minHintLength),
        Validators.maxLength(this.maxHintLength),
      ]),
      checkForBreaches: this.formBuilder.nonNullable.control(true),
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
          "newPasswordHint",
          this.i18nService.t("hintEqualsPassword"),
        ),
      ],
    },
  );

  protected get minPasswordLengthMsg() {
    if (
      this.masterPasswordPolicyOptions != null &&
      this.masterPasswordPolicyOptions.minLength > 0
    ) {
      return this.i18nService.t("characterMinimum", this.masterPasswordPolicyOptions.minLength);
    } else {
      return this.i18nService.t("characterMinimum", this.minPasswordLength);
    }
  }

  constructor(
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
    this.addFormFieldsIfNecessary();
    this.setButtonText();
  }

  private addFormFieldsIfNecessary() {
    if (
      this.flow === InputPasswordFlow.ChangePassword ||
      this.flow === InputPasswordFlow.ChangePasswordWithOptionalUserKeyRotation
    ) {
      this.formGroup.addControl(
        "currentPassword",
        this.formBuilder.nonNullable.control("", Validators.required),
      );

      this.formGroup.addValidators([
        compareInputs(
          ValidationGoal.InputsShouldNotMatch,
          "currentPassword",
          "newPassword",
          this.i18nService.t("yourNewPasswordCannotBeTheSameAsYourCurrentPassword"),
        ),
      ]);
    }

    if (this.flow === InputPasswordFlow.ChangePasswordWithOptionalUserKeyRotation) {
      this.formGroup.addControl("rotateUserKey", this.formBuilder.nonNullable.control(false));
    }
  }

  private setButtonText() {
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

  protected submit = async () => {
    this.verifyFlowAndUserId();

    this.formGroup.markAllAsTouched();

    if (this.formGroup.invalid) {
      this.showErrorSummary = true;
      return;
    }

    if (!this.email) {
      throw new Error("Email is required to create master key.");
    }

    const currentPassword = this.formGroup.controls.currentPassword?.value ?? "";
    const newPassword = this.formGroup.controls.newPassword.value;
    const newPasswordHint = this.formGroup.controls.newPasswordHint.value;
    const checkForBreaches = this.formGroup.controls.checkForBreaches.value;

    // 1. Determine kdfConfig
    if (this.flow === InputPasswordFlow.AccountRegistration) {
      this.kdfConfig = DEFAULT_KDF_CONFIG;
    } else {
      if (!this.userId) {
        throw new Error("userId not passed down");
      }
      this.kdfConfig = await firstValueFrom(this.kdfConfigService.getKdfConfig$(this.userId));
    }

    if (this.kdfConfig == null) {
      throw new Error("KdfConfig is required to create master key.");
    }

    // 2. Verify current password is correct (if necessary)
    if (
      this.flow === InputPasswordFlow.ChangePassword ||
      this.flow === InputPasswordFlow.ChangePasswordWithOptionalUserKeyRotation
    ) {
      const currentPasswordVerified = await this.verifyCurrentPassword(
        currentPassword,
        this.kdfConfig,
      );
      if (!currentPasswordVerified) {
        return;
      }
    }

    // 3. Verify new password
    const newPasswordVerified = await this.verifyNewPassword(
      newPassword,
      this.passwordStrengthScore,
      checkForBreaches,
    );
    if (!newPasswordVerified) {
      return;
    }

    // 4. Create cryptographic keys and build a PasswordInputResult object
    const newMasterKey = await this.keyService.makeMasterKey(
      newPassword,
      this.email,
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
      this.flow === InputPasswordFlow.ChangePassword ||
      this.flow === InputPasswordFlow.ChangePasswordWithOptionalUserKeyRotation
    ) {
      const currentMasterKey = await this.keyService.makeMasterKey(
        currentPassword,
        this.email,
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

    if (this.flow === InputPasswordFlow.ChangePasswordWithOptionalUserKeyRotation) {
      passwordInputResult.rotateUserKey = this.formGroup.controls.rotateUserKey?.value;
    }

    // 5. Emit cryptographic keys and other password related properties
    this.onPasswordFormSubmit.emit(passwordInputResult);
  };

  /**
   * This method prevents a dev from passing down the wrong `InputPasswordFlow`
   * from the parent component or from failing to pass down a `userId` for flows
   * that require it.
   *
   * We cannot mark the `userId` `@Input` as required because in an account registration
   * flow we will not have an active account `userId` to pass down.
   */
  private verifyFlowAndUserId() {
    /**
     * There can be no active account (and thus no userId) in an account registration
     * flow. If there is a userId, it means the dev passed down the wrong InputPasswordFlow
     * from the parent component.
     */
    if (this.flow === InputPasswordFlow.AccountRegistration) {
      if (this.userId) {
        throw new Error(
          "There can be no userId in an account registration flow. Please pass down the appropriate InputPasswordFlow from the parent component.",
        );
      }
    }

    /**
     * There MUST be an active account (and thus a userId) in all other flows.
     * If no userId is passed down, it means the dev either:
     *  (a) passed down the wrong InputPasswordFlow, or
     *  (b) passed down the correct InputPasswordFlow but failed to pass down a userId
     */
    if (this.flow !== InputPasswordFlow.AccountRegistration) {
      if (!this.userId) {
        throw new Error("The selected InputPasswordFlow requires that a userId be passed down");
      }
    }
  }

  /**
   * Returns `true` if the current password is correct (it can be used to successfully decrypt
   * the masterKeyEncrypedUserKey), `false` otherwise
   */
  private async verifyCurrentPassword(
    currentPassword: string,
    kdfConfig: KdfConfig,
  ): Promise<boolean> {
    const currentMasterKey = await this.keyService.makeMasterKey(
      currentPassword,
      this.email,
      kdfConfig,
    );

    if (!this.userId) {
      throw new Error("userId not passed down");
    }

    const decryptedUserKey = await this.masterPasswordService.decryptUserKeyWithMasterKey(
      currentMasterKey,
      this.userId,
    );

    if (decryptedUserKey == null) {
      this.toastService.showToast({
        variant: "error",
        title: "",
        message: this.i18nService.t("invalidMasterPassword"),
      });

      return false;
    }

    return true;
  }

  /**
   * Returns `true` if the new password is not weak or breached and it passes
   * any enforced org policy options, `false` otherwise
   */
  private async verifyNewPassword(
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

  protected async rotateUserKeyClicked() {
    const rotateUserKeyCtrl = this.formGroup.controls.rotateUserKey;

    const rotateUserKey = rotateUserKeyCtrl?.value;

    if (rotateUserKey) {
      if (!this.userId) {
        throw new Error("userId not passed down");
      }

      const ciphers = await this.cipherService.getAllDecrypted(this.userId);

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

        rotateUserKeyCtrl.setValue(false);
        return;
      }

      const result = await this.dialogService.openSimpleDialog({
        title: { key: "rotateEncKeyTitle" },
        content:
          this.i18nService.t("updateEncryptionKeyWarning") +
          " " +
          this.i18nService.t("updateEncryptionKeyAccountExportWarning") +
          " " +
          this.i18nService.t("rotateEncKeyConfirmation"),
        type: "warning",
      });

      if (!result) {
        rotateUserKeyCtrl.setValue(false);
      }
    }
  }

  protected getPasswordStrengthScore(score: PasswordStrengthScore) {
    this.passwordStrengthScore = score;
  }
}
