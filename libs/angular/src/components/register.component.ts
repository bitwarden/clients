import { Directive, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { AbstractControl, UntypedFormBuilder, ValidatorFn, Validators } from "@angular/forms";
import { Router } from "@angular/router";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { PasswordLogInCredentials } from "@bitwarden/common/auth/models/domain/log-in-credentials";
import { RegisterResponse } from "@bitwarden/common/auth/models/response/register.response";
import { DEFAULT_KDF_CONFIG, DEFAULT_KDF_TYPE } from "@bitwarden/common/enums";
import { KeysRequest } from "@bitwarden/common/models/request/keys.request";
import { ReferenceEventRequest } from "@bitwarden/common/models/request/reference-event.request";
import { RegisterRequest } from "@bitwarden/common/models/request/register.request";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/common/tools/generator/password";
import { DialogService } from "@bitwarden/components";

import { CaptchaProtectedComponent } from "../auth/components/captcha-protected.component";
import {
  AllValidationErrors,
  FormValidationErrorsService,
} from "../platform/abstractions/form-validation-errors.service";
import { PasswordColorText } from "../shared/components/password-strength/password-strength.component";
import { InputsFieldMatch } from "../validators/inputsFieldMatch.validator";

@Directive()
export class RegisterComponent extends CaptchaProtectedComponent implements OnInit {
  @Input() isInTrialFlow = false;
  @Output() createdAccount = new EventEmitter<string>();

  showPassword = false;
  formPromise: Promise<RegisterResponse>;
  referenceData: ReferenceEventRequest;
  showTerms = true;
  showErrorSummary = false;
  passwordStrengthResult: any;
  characterMinimumMessage: string;
  minimumLength = Utils.minimumPasswordLength;
  color: string;
  text: string;

  formGroup = this.formBuilder.group(
    {
      email: ["", [Validators.required, Validators.email]],
      name: [""],
      masterPassword: ["", [Validators.required, Validators.minLength(this.minimumLength)]],
      confirmMasterPassword: ["", [Validators.required, Validators.minLength(this.minimumLength)]],
      hint: [
        null,
        [
          InputsFieldMatch.validateInputsDoesntMatch(
            "masterPassword",
            this.i18nService.t("hintEqualsPassword")
          ),
        ],
      ],
      checkForBreaches: [true],
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
    i18nService: I18nService,
    protected cryptoService: CryptoService,
    protected apiService: ApiService,
    protected stateService: StateService,
    platformUtilsService: PlatformUtilsService,
    protected passwordGenerationService: PasswordGenerationServiceAbstraction,
    environmentService: EnvironmentService,
    protected logService: LogService,
    protected auditService: AuditService,
    protected dialogService: DialogService
  ) {
    super(environmentService, i18nService, platformUtilsService);
    this.showTerms = !platformUtilsService.isSelfHost();
    this.characterMinimumMessage = this.i18nService.t("characterMinimum", this.minimumLength);
  }

  async ngOnInit() {
    this.setupCaptcha();
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
        case "minlength":
          return this.i18nService.t("masterPasswordMinlength", Utils.minimumPasswordLength);
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

    const passwordWeak =
      this.passwordStrengthResult != null && this.passwordStrengthResult.score < 3;
    const passwordLeak =
      this.formGroup.controls.checkForBreaches.value &&
      (await this.auditService.passwordLeaked(this.formGroup.controls.masterPassword.value)) > 0;

    if (passwordWeak && passwordLeak) {
      const result = await this.dialogService.openSimpleDialog({
        title: { key: "weakAndExposedMasterPassword" },
        content: { key: "weakAndBreachedMasterPasswordDesc" },
        type: "warning",
      });

      if (!result) {
        return { isValid: false };
      }
    } else if (passwordWeak) {
      const result = await this.dialogService.openSimpleDialog({
        title: { key: "weakMasterPassword" },
        content: { key: "weakMasterPasswordDesc" },
        type: "warning",
      });

      if (!result) {
        return { isValid: false };
      }
    } else if (passwordLeak) {
      const result = await this.dialogService.openSimpleDialog({
        title: { key: "exposedMasterPassword" },
        content: { key: "exposedMasterPasswordDesc" },
        type: "warning",
      });

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
    const kdfConfig = DEFAULT_KDF_CONFIG;
    const key = await this.cryptoService.makeMasterKey(masterPassword, email, kdf, kdfConfig);
    const newUserKey = await this.cryptoService.makeUserKey(key);
    const masterKeyHash = await this.cryptoService.hashMasterKey(masterPassword, key);
    const keys = await this.cryptoService.makeKeyPair(newUserKey[0]);
    const request = new RegisterRequest(
      email,
      name,
      masterKeyHash,
      hint,
      newUserKey[1].encryptedString,
      this.referenceData,
      this.captchaToken,
      kdf,
      kdfConfig.iterations,
      kdfConfig.memory,
      kdfConfig.parallelism
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
}
