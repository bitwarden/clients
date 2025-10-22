import { Component, EventEmitter, Input, OnInit, Output, ViewChild } from "@angular/core";
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
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { HashPurpose } from "@bitwarden/common/platform/enums";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import {
  AsyncActionsModule,
  ButtonModule,
  CheckboxModule,
  DialogService,
  FormFieldModule,
  IconButtonModule,
  InputModule,
  LinkModule,
  ToastService,
  Translation,
} from "@bitwarden/components";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/generator-legacy";
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
   * Form Fields: `[newPassword, newPasswordConfirm, newPasswordHint, checkForBreaches]`
   *
   * Note: this flow does not receive an active account `userId` as an `@Input`
   */
  SetInitialPasswordAccountRegistration,
  /**
   * Form Fields: `[newPassword, newPasswordConfirm, newPasswordHint, checkForBreaches]`
   */
  SetInitialPasswordAuthedUser,
  /**
   * Form Fields: `[currentPassword, newPassword, newPasswordConfirm, newPasswordHint, checkForBreaches]`
   */
  ChangePassword,
  /**
   * Form Fields: `[currentPassword, newPassword, newPasswordConfirm, newPasswordHint, checkForBreaches, rotateUserKey]`
   */
  ChangePasswordWithOptionalUserKeyRotation,
  /**
   * This flow is used when a user changes the password for another user's account, such as:
   * - Emergency Access Takeover
   * - Account Recovery
   *
   * Since both of those processes use a dialog, the `InputPasswordComponent` will not display
   * buttons for `ChangePasswordDelegation` because the dialog will have its own buttons.
   *
   * Form Fields: `[newPassword, newPasswordConfirm]`
   *
   * Note: this flow does not receive an active account `userId` or `email` as `@Input`s
   */
  ChangePasswordDelegation,
}

interface InputPasswordForm {
  currentPassword?: FormControl<string>;

  newPassword: FormControl<string>;
  newPasswordConfirm: FormControl<string>;
  newPasswordHint?: FormControl<string>;

  checkForBreaches?: FormControl<boolean>;
  rotateUserKey?: FormControl<boolean>;
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "auth-input-password",
  templateUrl: "./input-password.component.html",
  imports: [
    AsyncActionsModule,
    ButtonModule,
    CheckboxModule,
    FormFieldModule,
    IconButtonModule,
    InputModule,
    JslibModule,
    PasswordCalloutComponent,
    PasswordStrengthV2Component,
    ReactiveFormsModule,
    LinkModule,
    SharedModule,
  ],
})
export class InputPasswordComponent implements OnInit {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ViewChild(PasswordStrengthV2Component) passwordStrengthComponent:
    | PasswordStrengthV2Component
    | undefined = undefined;

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() onPasswordFormSubmit = new EventEmitter<PasswordInputResult>();
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() onSecondaryButtonClick = new EventEmitter<void>();
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() isSubmitting = new EventEmitter<boolean>();

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input({ required: true }) flow!: InputPasswordFlow;

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input({ transform: (val: string) => val?.trim().toLowerCase() }) email?: string;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() userId?: UserId;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() loading = false;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() masterPasswordPolicyOptions?: MasterPasswordPolicyOptions;

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() inlineButtons = false;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() primaryButtonText?: Translation;
  protected primaryButtonTextStr: string = "";
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
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
    },
    {
      validators: [
        compareInputs(
          ValidationGoal.InputsShouldMatch,
          "newPassword",
          "newPasswordConfirm",
          this.i18nService.t("masterPassDoesntMatch"),
        ),
      ],
    },
  );

  protected get minPasswordLengthMsg() {
    if (
      this.masterPasswordPolicyOptions != undefined &&
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
    private passwordGenerationService: PasswordGenerationServiceAbstraction,
    private platformUtilsService: PlatformUtilsService,
    private policyService: PolicyService,
    private toastService: ToastService,
    private validationService: ValidationService,
  ) {}

  ngOnInit(): void {
    this.addFormFieldsIfNecessary();
    this.setButtonText();
  }

  private addFormFieldsIfNecessary() {
    if (this.flow !== InputPasswordFlow.ChangePasswordDelegation) {
      this.formGroup.addControl(
        "newPasswordHint",
        this.formBuilder.nonNullable.control("", [
          Validators.minLength(this.minHintLength),
          Validators.maxLength(this.maxHintLength),
        ]),
      );

      this.formGroup.addValidators([
        compareInputs(
          ValidationGoal.InputsShouldNotMatch,
          "newPassword",
          "newPasswordHint",
          this.i18nService.t("hintEqualsPassword"),
        ),
      ]);

      this.formGroup.addControl("checkForBreaches", this.formBuilder.nonNullable.control(true));
    }

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

  submit = async (): Promise<PasswordInputResult | undefined> => {
    try {
      this.isSubmitting.emit(true);

      this.verifyFlow();

      this.formGroup.markAllAsTouched();

      if (this.formGroup.invalid) {
        this.showErrorSummary = true;
        return;
      }

      const currentPassword = this.formGroup.controls.currentPassword?.value ?? "";
      const newPassword = this.formGroup.controls.newPassword.value;
      const newPasswordHint = this.formGroup.controls.newPasswordHint?.value ?? "";
      const checkForBreaches = this.formGroup.controls.checkForBreaches?.value ?? true;

      if (this.flow === InputPasswordFlow.ChangePasswordDelegation) {
        return await this.handleChangePasswordDelegationFlow(newPassword);
      }

      if (!this.email) {
        throw new Error("Email is required to create master key.");
      }

      // 1. Determine kdfConfig
      if (this.flow === InputPasswordFlow.SetInitialPasswordAccountRegistration) {
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

      const salt =
        this.userId != null
          ? await firstValueFrom(this.masterPasswordService.saltForUser$(this.userId))
          : this.masterPasswordService.emailToSalt(this.email);
      if (salt == null) {
        throw new Error("Salt is required to create master key.");
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
        salt,
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
      return passwordInputResult;
    } catch (e) {
      this.validationService.showError(e);
    } finally {
      this.isSubmitting.emit(false);
    }
  };

  /**
   * We cannot mark the `userId` or `email` `@Input`s as required because some flows
   * require them, and some do not. This method enforces that:
   * - Certain flows MUST have a `userId` and/or `email` passed down
   * - Certain flows must NOT have a `userId` and/or `email` passed down
   */
  private verifyFlow() {
    /** UserId checks */

    // These flows require that an active account userId must NOT be passed down
    if (
      this.flow === InputPasswordFlow.SetInitialPasswordAccountRegistration ||
      this.flow === InputPasswordFlow.ChangePasswordDelegation
    ) {
      if (this.userId) {
        throw new Error("There should be no active account userId passed down in a this flow.");
      }
    }

    // All other flows require that an active account userId MUST be passed down
    if (
      this.flow !== InputPasswordFlow.SetInitialPasswordAccountRegistration &&
      this.flow !== InputPasswordFlow.ChangePasswordDelegation
    ) {
      if (!this.userId) {
        throw new Error("This flow requires that an active account userId be passed down.");
      }
    }

    /** Email checks */

    // This flow requires that an email must NOT be passed down
    if (this.flow === InputPasswordFlow.ChangePasswordDelegation) {
      if (this.email) {
        throw new Error("There should be no email passed down in this flow.");
      }
    }

    // All other flows require that an email MUST be passed down
    if (this.flow !== InputPasswordFlow.ChangePasswordDelegation) {
      if (!this.email) {
        throw new Error("This flow requires that an email be passed down.");
      }
    }
  }

  private async handleChangePasswordDelegationFlow(
    newPassword: string,
  ): Promise<PasswordInputResult | undefined> {
    const newPasswordVerified = await this.verifyNewPassword(
      newPassword,
      this.passwordStrengthScore,
      false,
    );
    if (!newPasswordVerified) {
      return;
    }

    const passwordInputResult: PasswordInputResult = {
      newPassword,
    };

    this.onPasswordFormSubmit.emit(passwordInputResult);
    return passwordInputResult;
  }

  /**
   * Returns `true` if the current password is correct (it can be used to successfully decrypt
   * the masterKeyEncryptedUserKey), `false` otherwise
   */
  private async verifyCurrentPassword(
    currentPassword: string,
    kdfConfig: KdfConfig,
  ): Promise<boolean> {
    if (!this.email) {
      throw new Error("Email is required to verify current password.");
    }
    if (!this.userId) {
      throw new Error("userId is required to verify current password.");
    }

    const currentMasterKey = await this.keyService.makeMasterKey(
      currentPassword,
      this.email,
      kdfConfig,
    );

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

  protected async generatePassword() {
    const options = (await this.passwordGenerationService.getOptions())?.[0] ?? {};
    this.formGroup.patchValue({
      newPassword: await this.passwordGenerationService.generatePassword(options),
    });

    if (!this.passwordStrengthComponent) {
      throw new Error("PasswordStrengthComponent is not initialized");
    }

    this.passwordStrengthComponent.updatePasswordStrength(
      this.formGroup.controls.newPassword.value,
    );
  }

  protected copy() {
    const value = this.formGroup.value.newPassword;
    if (value == null) {
      return;
    }

    this.platformUtilsService.copyToClipboard(value, { window: window });
    this.toastService.showToast({
      variant: "info",
      title: "",
      message: this.i18nService.t("valueCopied", this.i18nService.t("password")),
    });
  }
}
