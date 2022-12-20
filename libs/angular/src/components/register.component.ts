import { Directive, EventEmitter, Input, Output } from "@angular/core";
import { AbstractControl, UntypedFormBuilder, ValidatorFn, Validators } from "@angular/forms";
import { Router } from "@angular/router";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AuthService } from "@bitwarden/common/abstractions/auth.service";
import { CryptoService } from "@bitwarden/common/abstractions/crypto.service";
import { EnvironmentService } from "@bitwarden/common/abstractions/environment.service";
import {
  AllValidationErrors,
  FormValidationErrorsService,
} from "@bitwarden/common/abstractions/formValidationErrors.service";
import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/abstractions/log.service";
import { PasswordGenerationService } from "@bitwarden/common/abstractions/passwordGeneration.service";
import { PlatformUtilsService } from "@bitwarden/common/abstractions/platformUtils.service";
import { StateService } from "@bitwarden/common/abstractions/state.service";
import { DEFAULT_KDF_ITERATIONS, DEFAULT_KDF_TYPE } from "@bitwarden/common/enums/kdfType";
import { Utils } from "@bitwarden/common/misc/utils";
import { PasswordLogInCredentials } from "@bitwarden/common/models/domain/log-in-credentials";
import { KeysRequest } from "@bitwarden/common/models/request/keys.request";
import { ReferenceEventRequest } from "@bitwarden/common/models/request/reference-event.request";
import { RegisterRequest } from "@bitwarden/common/models/request/register.request";
import { RegisterResponse } from "@bitwarden/common/models/response/authentication/register.response";

import { PasswordColorText } from "../shared/components/password-strength/password-strength.component";
import { InputsFieldMatch } from "../validators/inputsFieldMatch.validator";

@Directive()
export class RegisterComponent {
  @Input() isInTrialFlow = false;
  @Output() createdAccount = new EventEmitter<string>();

  protected captchaSiteKey?: string;
  protected captchaToken?: string;

  showPassword = false;
  formPromise: Promise<RegisterResponse>;
  referenceData: ReferenceEventRequest;
  showTerms = true;
  showErrorSummary = false;
  passwordStrengthResult: any;
  color: string;
  text: string;

  formGroup = this.formBuilder.group(
    {
      email: ["", [Validators.required, Validators.email]],
      name: [""],
      masterPassword: ["", [Validators.required, Validators.minLength(8)]],
      confirmMasterPassword: ["", [Validators.required, Validators.minLength(8)]],
      hint: [
        null,
        [
          InputsFieldMatch.validateInputsDoesntMatch(
            "masterPassword",
            this.i18nService.t("hintEqualsPassword")
          ),
        ],
      ],
      acceptPolicies: [false, [this.acceptPoliciesValidation()]],
    },
    {
      validator: InputsFieldMatch.validateFormInputsMatch(
        "masterPassword",
        "confirmMasterPassword",
        this.i18nService.t("masterPassDoesntMatch")
      ),
    }
  );

  protected successRoute = "login";

  protected accountCreated = false;

  protected captchaBypassToken: string = null;

  constructor(
    protected formValidationErrorService: FormValidationErrorsService,
    protected formBuilder: UntypedFormBuilder,
    protected authService: AuthService,
    protected router: Router,
    protected i18nService: I18nService,
    protected cryptoService: CryptoService,
    protected apiService: ApiService,
    protected stateService: StateService,
    protected platformUtilsService: PlatformUtilsService,
    protected passwordGenerationService: PasswordGenerationService,
    protected environmentService: EnvironmentService,
    protected logService: LogService
  ) {
    this.showTerms = !platformUtilsService.isSelfHost();
  }

  async submit(showToast = true) {
    let email = this.formGroup.value.email;
    email = email.trim().toLowerCase();
    let name = this.formGroup.value.name;
    name = name === "" ? null : name; // Why do we do this?
    const masterPassword = this.formGroup.value.masterPassword;
    try {
      if (!this.accountCreated) {
        const registerResponse = await this.registerAccount(
          await this.buildRegisterRequest(email, masterPassword, name),
          showToast
        );
        if (!registerResponse.successful) {
          return;
        }
        this.captchaBypassToken = registerResponse.captchaBypassToken;
        this.accountCreated = true;
      }
      if (this.isInTrialFlow) {
        if (!this.accountCreated) {
          this.platformUtilsService.showToast(
            "success",
            null,
            this.i18nService.t("trialAccountCreated")
          );
        }
        const loginResponse = await this.logIn(email, masterPassword, this.captchaBypassToken);
        if (loginResponse.captchaRequired) {
          return;
        }
        this.createdAccount.emit(this.formGroup.value.email);
      } else {
        this.platformUtilsService.showToast(
          "success",
          null,
          this.i18nService.t("newAccountCreated")
        );
        this.router.navigate([this.successRoute], { queryParams: { email: email } });
      }
    } catch (e) {
      this.logService.error(e);

      // Invalidate the captcha
      this.captchaToken = undefined;
    }
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  getStrengthResult(result: any) {
    this.passwordStrengthResult = result;
  }

  getPasswordScoreText(event: PasswordColorText) {
    this.color = event.color;
    this.text = event.text;
  }

  private getErrorToastMessage() {
    const error: AllValidationErrors = this.formValidationErrorService
      .getFormValidationErrors(this.formGroup.controls)
      .shift();

    if (error) {
      switch (error.errorName) {
        case "email":
          return this.i18nService.t("invalidEmail");
        case "inputsDoesntMatchError":
          return this.i18nService.t("masterPassDoesntMatch");
        case "inputsMatchError":
          return this.i18nService.t("hintEqualsPassword");
        default:
          return this.i18nService.t(this.errorTag(error));
      }
    }

    return;
  }

  private errorTag(error: AllValidationErrors): string {
    const name = error.errorName.charAt(0).toUpperCase() + error.errorName.slice(1);
    return `${error.controlName}${name}`;
  }

  //validation would be ignored on selfhosted
  private acceptPoliciesValidation(): ValidatorFn {
    return (control: AbstractControl) => {
      const ctrlValue = control.value;

      return !ctrlValue && this.showTerms ? { required: true } : null;
    };
  }

  private async validateRegistration(showToast: boolean): Promise<{ isValid: boolean }> {
    this.formGroup.markAllAsTouched();
    this.showErrorSummary = true;

    if (this.formGroup.get("acceptPolicies").hasError("required")) {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("acceptPoliciesRequired")
      );
      return { isValid: false };
    }

    //web
    if (this.formGroup.invalid && !showToast) {
      return { isValid: false };
    }

    //desktop, browser
    if (this.formGroup.invalid && showToast) {
      const errorText = this.getErrorToastMessage();
      this.platformUtilsService.showToast("error", this.i18nService.t("errorOccurred"), errorText);
      return { isValid: false };
    }

    if (this.passwordStrengthResult != null && this.passwordStrengthResult.score < 3) {
      const result = await this.platformUtilsService.showDialog(
        this.i18nService.t("weakMasterPasswordDesc"),
        this.i18nService.t("weakMasterPassword"),
        this.i18nService.t("yes"),
        this.i18nService.t("no"),
        "warning"
      );
      if (!result) {
        return { isValid: false };
      }
    }
    return { isValid: true };
  }

  private async buildRegisterRequest(
    email: string,
    masterPassword: string,
    name: string
  ): Promise<RegisterRequest> {
    const hint = this.formGroup.value.hint;
    const kdf = DEFAULT_KDF_TYPE;
    const kdfIterations = DEFAULT_KDF_ITERATIONS;
    const key = await this.cryptoService.makeKey(masterPassword, email, kdf, kdfIterations);
    const encKey = await this.cryptoService.makeEncKey(key);
    const hashedPassword = await this.cryptoService.hashPassword(masterPassword, key);
    const keys = await this.cryptoService.makeKeyPair(encKey[0]);
    const request = new RegisterRequest(
      email,
      name,
      hashedPassword,
      hint,
      encKey[1].encryptedString,
      kdf,
      kdfIterations,
      this.referenceData,
      this.captchaToken
    );
    request.keys = new KeysRequest(keys[0], keys[1].encryptedString);
    const orgInvite = await this.stateService.getOrganizationInvitation();
    if (orgInvite != null && orgInvite.token != null && orgInvite.organizationUserId != null) {
      request.token = orgInvite.token;
      request.organizationUserId = orgInvite.organizationUserId;
    }
    return request;
  }

  private async registerAccount(
    request: RegisterRequest,
    showToast: boolean
  ): Promise<{ successful: boolean; captchaBypassToken?: string }> {
    if (!(await this.validateRegistration(showToast)).isValid) {
      return { successful: false };
    }
    this.formPromise = this.apiService.postRegister(request);
    try {
      const response = await this.formPromise;
      return { successful: true, captchaBypassToken: response.captchaBypassToken };
    } catch (e) {
      if (this.handleCaptchaRequired(e)) {
        return { successful: false };
      } else {
        throw e;
      }
    }
  }

  private async logIn(
    email: string,
    masterPassword: string,
    captchaBypassToken: string
  ): Promise<{ captchaRequired: boolean }> {
    const credentials = new PasswordLogInCredentials(
      email,
      masterPassword,
      captchaBypassToken,
      null
    );
    const loginResponse = await this.authService.logIn(credentials);
    if (this.handleCaptchaRequired(loginResponse)) {
      return { captchaRequired: true };
    }
    return { captchaRequired: false };
  }

  private handleCaptchaRequired(response: any): boolean {
    if (Utils.isNullOrWhitespace(response.captchaSiteKey)) {
      return false;
    }

    this.captchaSiteKey = response.captchaSiteKey;
    return true;
  }

  protected setCaptchaToken(token: string) {
    this.captchaToken = token;
    this.submit();
  }
}
