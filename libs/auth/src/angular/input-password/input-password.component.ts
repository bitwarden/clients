import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  PasswordStrengthScore,
  PasswordStrengthV2Component,
} from "@bitwarden/angular/tools/password-strength/password-strength-v2.component";
import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { HashPurpose } from "@bitwarden/common/platform/enums";
import { Utils } from "@bitwarden/common/platform/misc/utils";
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
import { DEFAULT_KDF_CONFIG, KeyService } from "@bitwarden/key-management";

// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { SharedModule } from "../../../../components/src/shared";
import { PasswordCalloutComponent } from "../password-callout/password-callout.component";
import { compareInputs, ValidationGoal } from "../validators/compare-inputs.validator";

import { PasswordInputResult } from "./password-input-result";

/**
 * Determines which form input elements will be displayed in the UI.
 */
// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
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

  constructor(
    private auditService: AuditService,
    private keyService: KeyService,
    private dialogService: DialogService,
    private formBuilder: FormBuilder,
    private i18nService: I18nService,
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

    const newPassword = this.formGroup.controls.newPassword.value;

    const passwordEvaluatedSuccessfully = await this.evaluateNewPassword(
      newPassword,
      this.passwordStrengthScore,
      this.formGroup.controls.checkForBreaches.value,
    );

    if (!passwordEvaluatedSuccessfully) {
      return;
    }

    // Create and hash new master key
    const kdfConfig = DEFAULT_KDF_CONFIG;

    if (this.email == null) {
      throw new Error("Email is required to create master key.");
    }

    const masterKey = await this.keyService.makeMasterKey(
      newPassword,
      this.email.trim().toLowerCase(),
      kdfConfig,
    );

    const serverMasterKeyHash = await this.keyService.hashMasterKey(
      newPassword,
      masterKey,
      HashPurpose.ServerAuthorization,
    );

    const localMasterKeyHash = await this.keyService.hashMasterKey(
      newPassword,
      masterKey,
      HashPurpose.LocalAuthorization,
    );

    const passwordInputResult: PasswordInputResult = {
      newPassword,
      hint: this.formGroup.controls.hint.value,
      kdfConfig,
      masterKey,
      serverMasterKeyHash,
      localMasterKeyHash,
    };

    if (
      this.inputPasswordFlow === InputPasswordFlow.ChangePassword ||
      this.inputPasswordFlow === InputPasswordFlow.ChangePasswordWithOptionalUserKeyRotation
    ) {
      passwordInputResult.currentPassword = this.formGroup.get("currentPassword")?.value;
    }

    if (this.inputPasswordFlow === InputPasswordFlow.ChangePasswordWithOptionalUserKeyRotation) {
      passwordInputResult.rotateUserKey = this.formGroup.get("rotateUserKey")?.value;
    }

    this.onPasswordFormSubmit.emit(passwordInputResult);
  };

  // Returns true if the password passes all checks, false otherwise
  private async evaluateNewPassword(
    newPassword: string,
    passwordStrengthScore: PasswordStrengthScore,
    checkForBreaches: boolean,
  ) {
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
}
