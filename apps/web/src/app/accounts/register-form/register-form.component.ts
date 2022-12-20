import { Component, Input, OnInit } from "@angular/core";
import { UntypedFormBuilder } from "@angular/forms";
import { Router } from "@angular/router";

import { RegisterComponent as BaseRegisterComponent } from "@bitwarden/angular/components/register.component";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AuthService } from "@bitwarden/common/abstractions/auth.service";
import { CryptoService } from "@bitwarden/common/abstractions/crypto.service";
import { EnvironmentService } from "@bitwarden/common/abstractions/environment.service";
import { FormValidationErrorsService } from "@bitwarden/common/abstractions/formValidationErrors.service";
import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/abstractions/log.service";
import { PasswordGenerationService } from "@bitwarden/common/abstractions/passwordGeneration.service";
import { PlatformUtilsService } from "@bitwarden/common/abstractions/platformUtils.service";
import { PolicyService } from "@bitwarden/common/abstractions/policy/policy.service.abstraction";
import { StateService } from "@bitwarden/common/abstractions/state.service";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/models/domain/master-password-policy-options";
import { ReferenceEventRequest } from "@bitwarden/common/models/request/reference-event.request";

@Component({
  selector: "app-register-form",
  templateUrl: "./register-form.component.html",
})
export class RegisterFormComponent extends BaseRegisterComponent implements OnInit {
  @Input() queryParamEmail: string;
  @Input() enforcedPolicyOptions: MasterPasswordPolicyOptions;
  @Input() referenceDataValue: ReferenceEventRequest;

  showErrorSummary = false;

  constructor(
    formValidationErrorService: FormValidationErrorsService,
    formBuilder: UntypedFormBuilder,
    authService: AuthService,
    router: Router,
    i18nService: I18nService,
    cryptoService: CryptoService,
    apiService: ApiService,
    stateService: StateService,
    platformUtilsService: PlatformUtilsService,
    passwordGenerationService: PasswordGenerationService,
    private policyService: PolicyService,
    environmentService: EnvironmentService,
    logService: LogService
  ) {
    super(
      formValidationErrorService,
      formBuilder,
      authService,
      router,
      i18nService,
      cryptoService,
      apiService,
      stateService,
      platformUtilsService,
      passwordGenerationService,
      environmentService,
      logService
    );
  }

  async ngOnInit() {
    this.referenceData = this.referenceDataValue;

    if (this.queryParamEmail) {
      this.formGroup.get("email")?.setValue(this.queryParamEmail);
    }
  }

  async submit() {
    if (
      this.enforcedPolicyOptions != null &&
      !this.policyService.evaluateMasterPassword(
        this.passwordStrengthResult.score,
        this.formGroup.value.masterPassword,
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

    await super.submit(false);
  }
}
