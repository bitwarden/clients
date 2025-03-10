// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, EventEmitter, Input, Output } from "@angular/core";
import { ReactiveFormsModule, FormBuilder, Validators } from "@angular/forms";

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
} from "@bitwarden/components";
import { DEFAULT_KDF_CONFIG, KeyService } from "@bitwarden/key-management";

// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { InputsFieldMatch } from "../../../../angular/src/auth/validators/inputs-field-match.validator";
// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { SharedModule } from "../../../../components/src/shared";
import { PasswordCalloutComponent } from "../password-callout/password-callout.component";

import { PasswordInputResult } from "./password-input-result";

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
export class InputPasswordComponent {
  @Output() onPasswordFormSubmit = new EventEmitter<PasswordInputResult>();

  @Input({ required: true }) email: string;
  @Input() buttonText: string;
  @Input() masterPasswordPolicyOptions: MasterPasswordPolicyOptions | null = null;
  @Input() loading: boolean = false;
  @Input() btnBlock: boolean = true;

  private minHintLength = 0;
  protected maxHintLength = 50;
  protected minPasswordLength = Utils.minimumPasswordLength;
  protected minPasswordMsg = "";
  protected passwordStrengthScore: PasswordStrengthScore;
  protected showErrorSummary = false;
  protected showPassword = false;

  protected formGroup = this.formBuilder.group(
    {
      password: ["", [Validators.required, Validators.minLength(this.minPasswordLength)]],
      confirmedPassword: ["", Validators.required],
      hint: [
        "", // must be string (not null) because we check length in validation
        [Validators.minLength(this.minHintLength), Validators.maxLength(this.maxHintLength)],
      ],
      checkForBreaches: true,
    },
    {
      validators: [
        InputsFieldMatch.compareInputs(
          "match",
          "password",
          "confirmedPassword",
          this.i18nService.t("masterPassDoesntMatch"),
        ),
        InputsFieldMatch.compareInputs(
          "doNotMatch",
          "password",
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

    const password = this.formGroup.controls.password.value;

    const passwordEvaluatedSuccessfully = await this.evaluatePassword(
      password,
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
      password,
      this.email.trim().toLowerCase(),
      kdfConfig,
    );

    const masterKeyHash = await this.keyService.hashMasterKey(password, masterKey);

    const localMasterKeyHash = await this.keyService.hashMasterKey(
      password,
      masterKey,
      HashPurpose.LocalAuthorization,
    );

    this.onPasswordFormSubmit.emit({
      masterKey,
      masterKeyHash,
      localMasterKeyHash,
      kdfConfig,
      hint: this.formGroup.controls.hint.value,
      password,
    });
  };

  // Returns true if the password passes all checks, false otherwise
  private async evaluatePassword(
    password: string,
    passwordStrengthScore: PasswordStrengthScore,
    checkForBreaches: boolean,
  ) {
    // Check if the password is breached, weak, or both
    const passwordIsBreached =
      checkForBreaches && (await this.auditService.passwordLeaked(password));

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
        password,
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
